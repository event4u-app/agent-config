/**
 * Shared secret-detection + scrub primitives for the workspace stores.
 *
 * TypeScript twin of `src/cli/python/workspace_secrets.py` (ADR-200,
 * py2ts Phase 1). Byte-for-byte behavioral mirror — same exported
 * snake_case names, same regex semantics (Python `re` → JS `RegExp`),
 * same `subn`/`finditer` counting, same `scrub_obj` depth + cycle guard,
 * same `[SECRET]` placeholder.
 *
 * Leaf module — `RegExp` only, **zero internal imports** — so the
 * hot-path analytics `emit()` and the heavier `knowledge_ingest` can both
 * depend on it cheaply without dragging in PII redaction, chunking, or file
 * I/O. Every workspace store that persists text or arbitrary payloads at rest
 * routes through this module before writing (Phase 8 Step 5 secret-hygiene
 * sweep).
 *
 * Two confidence tiers:
 *
 * - **HIGH** — structurally unambiguous credentials (AWS access-key id, GitHub
 *   PAT, OpenAI key, PEM private-key block). Near-zero false-positive rate, so
 *   safe to scrub destructively or to refuse a write over.
 * - **FUZZY** — the generic `key/secret/token/password = <value>` assignment.
 *   Fires on legitimate prose ("password reset token: see attached"), so it is
 *   warn-only on user-authored content and only scrubbed on disposable,
 *   machine-generated telemetry (sessions / analytics).
 *
 * The `[SECRET]` placeholder matches the knowledge-ingestion redactor so the
 * two surfaces stay byte-consistent.
 */

export const PLACEHOLDER = '[SECRET]';

// --- HIGH-confidence patterns (gitleaks-equivalent subset) ------------------
//
// Python compiles each pattern once; JS needs a FRESH `RegExp` per match call
// because the `g` flag carries `lastIndex` state. `_finditer` / `_subn` below
// each construct a local global-flagged copy, so the module-level patterns
// stay stateless (matching Python's stateless compiled patterns).
//
// `[\s\S]` mirrors Python `re.DOTALL`-style `[\s\S]` (the .py uses the same
// idiom, not the DOTALL flag). `*?` is lazy in both engines.
const _RE_PRIVATE_KEY =
    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/;
const _RE_AWS = /AKIA[0-9A-Z]{16}/;
const _RE_GH = /gh[pousr]_[A-Za-z0-9]{36,}/;
const _RE_OPENAI = /sk-[A-Za-z0-9]{20,}/;

// --- FUZZY pattern (heuristic key/value assignment) -------------------------
// Python `(?i)` inline flag → JS `i` flag. Character class is identical.
const _RE_KV_SECRET =
    /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/i;

type PatternEntry = readonly [string, RegExp];

// Ordered HIGH-confidence first so the private-key block is consumed before
// the narrower key patterns can fragment it.
export const HIGH_CONFIDENCE: readonly PatternEntry[] = [
    ['private_key', _RE_PRIVATE_KEY],
    ['aws_access_key', _RE_AWS],
    ['github_pat', _RE_GH],
    ['openai_key', _RE_OPENAI],
];
export const FUZZY: readonly PatternEntry[] = [['kv_secret', _RE_KV_SECRET]];
export const ALL_PATTERNS: readonly PatternEntry[] = [...HIGH_CONFIDENCE, ...FUZZY];

// Recursion guard for `scrub_obj` — deep / cyclic structures degrade to a
// controlled return instead of a RangeError on the never-raises hot path.
const _MAX_DEPTH = 50;

/** One secret match. Carries the pattern name + tier, never the value. */
export interface Finding {
    /** e.g. "aws_access_key" */
    pattern: string;
    /** "high" | "fuzzy" */
    confidence: string;
}

/**
 * Build a global-flagged clone of `pat` so `matchAll` / `replace` get
 * left-to-right non-overlapping iteration matching Python `finditer` / `subn`,
 * without mutating the shared stateless module-level pattern.
 */
function _global(pat: RegExp): RegExp {
    const flags = pat.flags.includes('g') ? pat.flags : pat.flags + 'g';
    return new RegExp(pat.source, flags);
}

/** Count of non-overlapping matches — mirrors `len(list(pat.finditer(text)))`. */
function _finditerCount(pat: RegExp, text: string): number {
    let n = 0;
    for (const _m of text.matchAll(_global(pat))) n += 1;
    return n;
}

/** `pat.subn(repl, text)` → `[clean, count]` (non-overlapping, left-to-right). */
function _subn(pat: RegExp, repl: string, text: string): [string, number] {
    let count = 0;
    const clean = text.replace(_global(pat), () => {
        count += 1;
        return repl;
    });
    return [clean, count];
}

/**
 * Non-destructive detection: one {@link Finding} per match.
 *
 * Never echoes the matched secret value — only the pattern name and tier,
 * so a caller can warn or refuse without re-leaking the secret into a log.
 */
export function scan(text: unknown, opts?: { include_fuzzy?: boolean }): Finding[] {
    const include_fuzzy = opts?.include_fuzzy ?? true;
    if (typeof text !== 'string' || !text) {
        return [];
    }
    const out: Finding[] = [];
    for (const [name, pat] of HIGH_CONFIDENCE) {
        const n = _finditerCount(pat, text);
        for (let i = 0; i < n; i += 1) out.push({ pattern: name, confidence: 'high' });
    }
    if (include_fuzzy) {
        for (const [name, pat] of FUZZY) {
            const n = _finditerCount(pat, text);
            for (let i = 0; i < n; i += 1) out.push({ pattern: name, confidence: 'fuzzy' });
        }
    }
    return out;
}

/** Replace every secret match with `[SECRET]`; return `[clean, count]`. */
export function scrub(text: unknown, opts?: { include_fuzzy?: boolean }): [string, number] {
    const include_fuzzy = opts?.include_fuzzy ?? true;
    if (typeof text !== 'string' || !text) {
        return [text as string, 0];
    }
    let out = text;
    let count = 0;
    const patterns = include_fuzzy ? ALL_PATTERNS : HIGH_CONFIDENCE;
    for (const [, pat] of patterns) {
        const [next, n] = _subn(pat, PLACEHOLDER, out);
        out = next;
        count += n;
    }
    return [out, count];
}

/**
 * Recursively scrub string leaves in object / array structures.
 *
 * Non-string leaves (number, boolean, null) pass through untouched. Recursion
 * is bounded by a depth cap and a cycle guard so malformed or self-referential
 * payloads degrade to a controlled return, never a stack overflow — callers on
 * a never-raises hot path (`workspace_analytics.emit`) rely on this. Returns
 * `[clean, count]`.
 *
 * Python distinguishes `list` (→ list) from `tuple` (→ tuple); JS has only
 * `Array`, so an array round-trips as an array, matching the Python `list`
 * branch (the workspace stores never feed a tuple through this path).
 */
export function scrub_obj(
    obj: unknown,
    opts?: { include_fuzzy?: boolean; _depth?: number; _seen?: Set<unknown> },
): [unknown, number] {
    const include_fuzzy = opts?.include_fuzzy ?? true;
    const _depth = opts?._depth ?? 0;
    const _seen = opts?._seen ?? new Set<unknown>();
    if (_depth > _MAX_DEPTH) {
        return [obj, 0];
    }
    if (typeof obj === 'string') {
        return scrub(obj, { include_fuzzy });
    }
    if (Array.isArray(obj)) {
        if (_seen.has(obj)) {
            return [obj, 0];
        }
        _seen.add(obj);
        let total = 0;
        const items: unknown[] = [];
        for (const value of obj) {
            const [cv, n] = scrub_obj(value, { include_fuzzy, _depth: _depth + 1, _seen });
            items.push(cv);
            total += n;
        }
        return [items, total];
    }
    if (obj !== null && typeof obj === 'object') {
        if (_seen.has(obj)) {
            return [obj, 0];
        }
        _seen.add(obj);
        let total = 0;
        const clean: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const [cv, n] = scrub_obj(value, { include_fuzzy, _depth: _depth + 1, _seen });
            clean[key] = cv;
            total += n;
        }
        return [clean, total];
    }
    return [obj, 0];
}
