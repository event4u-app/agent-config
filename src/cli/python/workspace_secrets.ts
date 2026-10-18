/**
 * Shared secret-detection + scrub primitives for the workspace stores.
 *
 * TypeScript twin of `src/cli/python/workspace_secrets.py` (ADR-200,
 * py2ts Phase 1). Byte-for-byte behavioral mirror — same exported
 * snake_case names, same regex semantics (Python `re` → JS `RegExp`),
 * same `subn`/`finditer` counting, same `scrub_obj` depth + cycle guard,
 * same `[SECRET]` placeholder.
 *
 * Near-leaf module — its one import is the pure rule table (no I/O) — so the
 * hot-path analytics `emit()` and the heavier `knowledge_ingest` can both
 * depend on it cheaply without dragging in PII redaction, chunking, or file
 * I/O. Every workspace store that persists text or arbitrary payloads at rest
 * routes through this module before writing (Phase 8 Step 5 secret-hygiene
 * sweep).
 *
 * Two confidence tiers:
 *
 * - **HIGH** — structurally unambiguous credentials: the credential rows of
 *   the one rule table (vendor keys, tokens, PEM private-key block, a
 *   connection URI with an inline password). Near-zero false-positive rate, so
 *   safe to scrub destructively or to refuse a write over.
 * - **FUZZY** — the generic `key/secret/token/password = <value>` assignment.
 *   Fires on legitimate prose ("password reset token: see attached"), so it is
 *   warn-only on user-authored content and only scrubbed on disposable,
 *   machine-generated telemetry (sessions / analytics).
 *
 * The `[SECRET]` placeholder matches the knowledge-ingestion redactor so the
 * two surfaces stay byte-consistent.
 */

import {
    detect,
    EGRESS_RULES,
    type EgressRule,
    pemMaskEnd,
    prefixesOf,
    rawKeyPrefixPattern,
    replacementEnd,
} from '../../scripts/_lib/egress_rules.js';

export const PLACEHOLDER = '[SECRET]';

// --- HIGH-confidence tier: the credential rows of the one rule table -------
//
// Detection lives in `src/scripts/_lib/egress_rules.ts`, the only place a
// credential pattern is defined (road-to-one-detector-and-the-senders-we-own
// 2.2); this module keeps its own policy — the `[SECRET]` placeholder, the
// HIGH/FUZZY tiers and the counts. `generic-assignment` is left to the FUZZY tier
// below, which is this module's own, looser reading of the same shape.

const HIGH_RULES: readonly EgressRule[] = EGRESS_RULES.filter(
    (r) => r.class === 'credential' && r.rule !== 'generic-assignment',
);

// The finding names this module has always reported; a row without one reports
// its rule id.
const LEGACY_NAME: Readonly<Record<string, string>> = {
    'pem-private-key': 'private_key',
    'aws-access-key': 'aws_access_key',
    'github-pat': 'github_pat',
    'github-app-token': 'github_pat',
    'openai-api-key': 'openai_key',
};
const LEGACY_ORDER = ['private_key', 'aws_access_key', 'github_pat', 'openai_key'];
const rank = (name: string): number => {
    const i = LEGACY_ORDER.indexOf(name);
    return i < 0 ? LEGACY_ORDER.length : i;
};

// This module's own, looser readings of two shapes, kept so the move to the
// table narrows nothing: the GitHub token family at any length and an OpenAI key
// glued to a preceding word. The prefixes are the table's.
const OWN_SHAPES: ReadonlyArray<readonly [string, RegExp]> = [
    [
        'github_pat',
        rawKeyPrefixPattern(36, [...prefixesOf('github-pat'), ...prefixesOf('github-app-token')], {
            boundary: 'never',
            tail: 'A-Za-z0-9',
        }),
    ],
    ['openai_key', rawKeyPrefixPattern(20, prefixesOf('openai-api-key'), { boundary: 'never', tail: 'A-Za-z0-9' })],
];

type Span = { name: string; start: number; end: number };

/** HIGH spans in report order, each widened to the bytes a scrub must remove. */
function highSpans(text: string): Span[] {
    const spans: Span[] = detect(text, HIGH_RULES).map((s) => ({
        name: LEGACY_NAME[s.rule] ?? s.rule,
        start: s.start,
        // A masking surface cannot refuse; an unproven extent masks through the
        // nearest key-end marker, else the detection span.
        end: replacementEnd(text, s) ?? (s.rule === 'pem-private-key' ? pemMaskEnd(text, s) : null) ?? s.end,
    }));
    for (const [name, re] of OWN_SHAPES) {
        for (const m of text.matchAll(re)) spans.push({ name, start: m.index, end: m.index + m[0].length });
    }
    // One finding per value: a span inside another span of the same name is that span.
    const kept = spans.filter(
        (a, i) =>
            !spans.some(
                (b, j) =>
                    j !== i &&
                    b.name === a.name &&
                    b.start <= a.start &&
                    b.end >= a.end &&
                    (b.end - b.start > a.end - a.start || j < i),
            ),
    );
    return kept.sort((x, y) => rank(x.name) - rank(y.name) || x.start - y.start);
}

// --- FUZZY pattern (heuristic key/value assignment) -------------------------
// Python `(?i)` inline flag → JS `i` flag. Character class is identical.
const _RE_KV_SECRET =
    /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/i;

type PatternEntry = readonly [string, RegExp];

export const FUZZY: readonly PatternEntry[] = [['kv_secret', _RE_KV_SECRET]];

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
    const out: Finding[] = highSpans(text).map((s) => ({ pattern: s.name, confidence: 'high' }));
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
    const spans = highSpans(text).sort((x, y) => x.start - y.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const sp of spans) {
        const last = merged[merged.length - 1];
        if (last !== undefined && sp.start < last.end) last.end = Math.max(last.end, sp.end);
        else merged.push({ start: sp.start, end: sp.end });
    }
    let out = text;
    for (let i = merged.length - 1; i >= 0; i -= 1) {
        const m = merged[i] as { start: number; end: number };
        out = out.slice(0, m.start) + PLACEHOLDER + out.slice(m.end);
    }
    let count = merged.length;
    if (include_fuzzy) {
        for (const [, pat] of FUZZY) {
            const [next, n] = _subn(pat, PLACEHOLDER, out);
            out = next;
            count += n;
        }
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
