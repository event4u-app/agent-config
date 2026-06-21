/**
 * Lightweight project-context detector for the council handoff preamble.
 *
 * TypeScript twin of `src/scripts/ai_council/project_context.py` (ADR-200 —
 * Python→TS migration, Phase 1). Reads the bare minimum from the repo root —
 * `composer.json`, `package.json`, root `README.md` — and returns a neutral
 * `ProjectContext`. All fields are optional; missing data is `null` and the
 * preamble silently omits the line.
 *
 * Iron law of neutrality (`ai-council` skill): nothing here may carry
 * host-agent identity, prior reasoning, or framing. Manifest fields and
 * README prose only.
 *
 * Truncation strategy (locked by council review, 2026-05-02): `repo_purpose`
 * is capped at `REPO_PURPOSE_MAX_CHARS` by stopping at the last full sentence
 * ≤ 400 chars, with an ellipsis when truncation occurred. Never cut
 * mid-sentence.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const REPO_PURPOSE_MAX_CHARS = 400;

// Python: re.compile(r"^\s*#"), re.compile(r"^\s*(\[!\[|!\[|<).*"),
// re.compile(r"<[^>]+>"). re.match anchors at the start (not ^$ MULTILINE);
// these are applied to single stripped lines so anchoring is implicit.
const _HEADING_RE = /^\s*#/;
const _BADGE_RE = /^\s*(\[!\[|!\[|<).*/;
const _HTML_RE = /<[^>]+>/g; // re.sub replaces all → global flag.

/** Neutral project description for the council handoff preamble. */
export class ProjectContext {
    name: string | null;
    stack: string | null;
    repo_purpose: string | null;

    constructor(
        name: string | null = null,
        stack: string | null = null,
        repoPurpose: string | null = null,
    ) {
        this.name = name;
        this.stack = stack;
        this.repo_purpose = repoPurpose;
    }

    is_empty(): boolean {
        return this.name === null && this.stack === null && this.repo_purpose === null;
    }
}

type JsonDict = Record<string, unknown>;

function _isPlainObject(v: unknown): v is JsonDict {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _read_json(p: string): JsonDict | null {
    // Python: if not path.exists(): return None
    if (!fs.existsSync(p)) {
        return null;
    }
    let raw: string;
    try {
        raw = fs.readFileSync(p, 'utf-8');
    } catch {
        // OSError → None
        return null;
    }
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        // json.JSONDecodeError → None
        return null;
    }
    // Python: return data if isinstance(data, dict) else None
    return _isPlainObject(data) ? data : null;
}

function _name_from(
    composer: JsonDict | null,
    pkg: JsonDict | null,
    root: string,
): string | null {
    for (const src of [composer, pkg]) {
        if (src) {
            const nameVal = src['name'];
            if (typeof nameVal === 'string' && nameVal.trim() !== '') {
                return nameVal.trim();
            }
        }
    }
    // Fall back to the directory name; useful for repos without manifests.
    // Python: root.resolve().name or None  (root is already resolved by caller).
    try {
        const base = path.basename(root);
        return base || null;
    } catch {
        // OSError → None
        return null;
    }
}

function _asObject(v: unknown): JsonDict {
    // Python `(x.get("y") or {})` — falsy (None, missing) → {}. Here: only a
    // plain object survives; anything else (null, undefined, non-dict) → {}.
    return _isPlainObject(v) ? v : {};
}

function _stack_from(composer: JsonDict | null, pkg: JsonDict | null): string | null {
    const parts: string[] = [];
    if (composer) {
        const require0 = _asObject(composer['require']);
        const phpV = require0['php'];
        if (typeof phpV === 'string') {
            parts.push(`PHP ${phpV}`);
        }
        // Detect well-known frameworks without claiming the project IS one.
        const requireMerged: JsonDict = {
            ..._asObject(composer['require']),
            ..._asObject(composer['require-dev']),
        };
        for (const [needle, label] of [
            ['laravel/framework', 'Laravel'],
            ['symfony/framework-bundle', 'Symfony'],
            ['laminas/laminas-mvc', 'Laminas'],
        ] as Array<[string, string]>) {
            if (needle in requireMerged) {
                parts.push(label);
                break;
            }
        }
    }
    if (pkg) {
        const engines = _asObject(pkg['engines']);
        // Python: isinstance(engines, dict) and isinstance(engines.get("node"), str)
        if (typeof engines['node'] === 'string') {
            parts.push(`Node ${engines['node'] as string}`);
        }
        const deps: JsonDict = {
            ..._asObject(pkg['dependencies']),
            ..._asObject(pkg['devDependencies']),
        };
        for (const [needle, label] of [
            ['next', 'Next.js'],
            ['react', 'React'],
            ['vue', 'Vue'],
            ['@angular/core', 'Angular'],
        ] as Array<[string, string]>) {
            if (needle in deps) {
                parts.push(label);
                break;
            }
        }
    }
    if (parts.length === 0) {
        return null;
    }
    return parts.join(' · ');
}

/** Mirror Python `str.splitlines()` — splits on the universal newline set. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    // Python splitlines() boundaries include LF CR CRLF VT FF FS GS RS
    // NEL LS PS. README content in practice only carries LF / CRLF, but
    // replicate the full set for faithfulness.
    const parts = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/u);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

function _purpose_from_readme(p: string): string | null {
    if (!fs.existsSync(p)) {
        return null;
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        // OSError → None
        return null;
    }
    const paragraph: string[] = [];
    for (const raw of _splitlines(text)) {
        // Python: line = raw.rstrip(); stripped = line.strip()
        const stripped = raw.trim();
        if (!stripped) {
            if (paragraph.length > 0) {
                break;
            }
            continue;
        }
        if (_HEADING_RE.test(stripped) || _BADGE_RE.test(stripped)) {
            if (paragraph.length > 0) {
                break;
            }
            continue;
        }
        paragraph.push(stripped);
    }
    if (paragraph.length === 0) {
        return null;
    }
    let joined = paragraph.join(' ');
    joined = joined.replace(_HTML_RE, '').trim();
    if (!joined) {
        return null;
    }
    if (_pyLen(joined) > REPO_PURPOSE_MAX_CHARS) {
        joined = _truncate_at_sentence(joined, REPO_PURPOSE_MAX_CHARS);
    }
    return joined;
}

/** Mirror Python `len(str)` — code-point count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Mirror Python `str.rstrip()` with no args — strip trailing whitespace. */
function _pyRstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/**
 * Truncate at the last full sentence ≤ limit chars; append an ellipsis.
 * Total return length is always ≤ `limit` (ellipsis included).
 */
function _truncate_at_sentence(text: string, limit: number): string {
    const budget = Math.max(1, limit - 2);
    // Python head = text[:budget] slices by code point. JS string indexing is
    // UTF-16; slice by code points to match for astral chars.
    const head = _pySlice(text, budget);
    const cut = Math.max(_rfind(head, '. '), _rfind(head, '! '), _rfind(head, '? '));
    if (cut >= 0) {
        // Python head[: cut + 1] — cut is a code-point index from rfind below,
        // applied to the same code-point head; slice by code point again.
        return _pyRstrip(_pySliceRange(head, 0, cut + 1)) + ' …';
    }
    return _pyRstrip(head) + ' …';
}

/** Python text[:n] — first n code points. */
function _pySlice(text: string, n: number): string {
    const cps = Array.from(text);
    return cps.slice(0, n).join('');
}

/** Python text[a:b] — code-point slice [a, b). */
function _pySliceRange(text: string, a: number, b: number): string {
    const cps = Array.from(text);
    return cps.slice(a, b).join('');
}

/**
 * Python str.rfind(sub) — highest code-point index where sub starts, or -1.
 * Operates on code-point indices to match Python's slicing semantics.
 */
function _rfind(haystack: string, needle: string): number {
    const cps = Array.from(haystack);
    const hLen = cps.length;
    const nCps = Array.from(needle);
    const nLen = nCps.length;
    if (nLen === 0) {
        return hLen;
    }
    for (let i = hLen - nLen; i >= 0; i -= 1) {
        let match = true;
        for (let j = 0; j < nLen; j += 1) {
            if (cps[i + j] !== nCps[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            return i;
        }
    }
    return -1;
}

/**
 * Return a `ProjectContext` for `root` (default: cwd).
 *
 * Always returns — never raises. Missing manifest files / README → the
 * matching field is `null`, and `handoff_preamble()` will omit the line.
 */
export function detect_project_context(root?: string | null): ProjectContext {
    // Python: root = (root or Path.cwd()).resolve()
    const resolvedRoot = path.resolve(root ?? process.cwd());
    const composer = _read_json(path.join(resolvedRoot, 'composer.json'));
    const pkg = _read_json(path.join(resolvedRoot, 'package.json'));
    return new ProjectContext(
        _name_from(composer, pkg, resolvedRoot),
        _stack_from(composer, pkg),
        _purpose_from_readme(path.join(resolvedRoot, 'README.md')),
    );
}
