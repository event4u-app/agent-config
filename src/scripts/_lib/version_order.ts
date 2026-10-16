/**
 * Version ordering for policy decisions — SemVer 2.0.0 precedence including
 * prereleases, and the subset of npm range syntax that `engines.node` uses.
 *
 * Pure: no filesystem, no network, no process state. Every function answers
 * `null` (or `false` for the boolean helper in `update_check.ts`) on input it
 * cannot parse, because a caller deciding whether to act must treat "cannot
 * tell" as "do not act", never as "older" or "newer".
 */

export interface ParsedVersion {
    readonly major: number;
    readonly minor: number;
    readonly patch: number;
    readonly pre: readonly (string | number)[];
}

const NUM = '(0|[1-9]\\d*)';
const IDENT = '[0-9A-Za-z-]+';
const VERSION_RE = new RegExp(
    `^v*${NUM}\\.${NUM}\\.${NUM}(?:-(${IDENT}(?:\\.${IDENT})*))?(?:\\+${IDENT}(?:\\.${IDENT})*)?$`,
);

export function parse_version(v: unknown): ParsedVersion | null {
    if (typeof v !== 'string') return null;
    const m = VERSION_RE.exec(v.trim());
    if (!m) return null;
    const pre = m[4] === undefined ? [] : m[4].split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id));
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre };
}

function cmp_num(a: number, b: number): number {
    return a === b ? 0 : a < b ? -1 : 1;
}

function compare_parsed(a: ParsedVersion, b: ParsedVersion): number {
    const core = cmp_num(a.major, b.major) || cmp_num(a.minor, b.minor) || cmp_num(a.patch, b.patch);
    if (core !== 0) return core;
    if (a.pre.length === 0 || b.pre.length === 0) return cmp_num(b.pre.length, a.pre.length);
    for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i += 1) {
        const x = a.pre[i];
        const y = b.pre[i];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        if (typeof x === 'number' && typeof y === 'number') {
            if (x !== y) return cmp_num(x, y);
        } else if (typeof x === 'number') {
            return -1;
        } else if (typeof y === 'number') {
            return 1;
        } else if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return 0;
}

/** -1 / 0 / 1 by SemVer precedence; `null` when either side does not parse. */
export function compare_versions(a: unknown, b: unknown): -1 | 0 | 1 | null {
    const pa = parse_version(a);
    const pb = parse_version(b);
    if (pa === null || pb === null) return null;
    return compare_parsed(pa, pb) as -1 | 0 | 1;
}

interface Bound {
    readonly op: '>=' | '<' | '>' | '<=' | '=';
    readonly v: ParsedVersion;
}

const PARTIAL_RE = /^(\^|~|>=|<=|>|<|=)?v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/;

function at(major: number, minor = 0, patch = 0): ParsedVersion {
    return { major, minor, patch, pre: [] };
}

function bounds_for(token: string): Bound[] | null {
    if (token === '*' || token === 'x' || token === 'X') return [];
    const m = PARTIAL_RE.exec(token);
    if (!m) return null;
    const op = m[1] ?? '=';
    const parts = [m[2], m[3], m[4]];
    const known: number[] = [];
    for (const p of parts) {
        if (p === undefined || /^[xX*]$/.test(p)) break;
        known.push(Number(p));
    }
    if (known.length === 0) return op === '<' || op === '>' ? null : [];
    const [M, mi = 0, pa = 0] = known;
    const full = known.length === 3;
    const next = known.length === 1 ? at(M! + 1) : known.length === 2 ? at(M!, mi + 1) : at(M!, mi, pa + 1);
    const base = at(M!, mi, pa);
    switch (op) {
        case '^': {
            const upper = M! > 0 ? at(M! + 1) : known.length === 1 ? at(1) : mi > 0 ? at(0, mi + 1) : full ? at(0, 0, pa + 1) : at(0, 1);
            return [{ op: '>=', v: base }, { op: '<', v: upper }];
        }
        case '~':
            return [{ op: '>=', v: base }, { op: '<', v: known.length === 1 ? at(M! + 1) : at(M!, mi + 1) }];
        case '>=':
            return [{ op: '>=', v: base }];
        case '<':
            return [{ op: '<', v: base }];
        case '>':
            return [full ? { op: '>', v: base } : { op: '>=', v: next }];
        case '<=':
            return [full ? { op: '<=', v: base } : { op: '<', v: next }];
        default:
            return full ? [{ op: '=', v: base }] : [{ op: '>=', v: base }, { op: '<', v: next }];
    }
}

function holds(b: Bound, v: ParsedVersion): boolean {
    const c = compare_parsed(v, b.v);
    if (b.op === '>=') return c >= 0;
    if (b.op === '>') return c > 0;
    if (b.op === '<') return c < 0;
    if (b.op === '<=') return c <= 0;
    return c === 0;
}

/**
 * Does `runtime` (a `process.version` string) satisfy the `engines.node`
 * range? `null` when either side cannot be parsed. A prerelease runtime
 * satisfies no range, matching npm's default of excluding prereleases.
 */
export function node_engine_satisfied(range: unknown, runtime: unknown): boolean | null {
    const v = parse_version(runtime);
    if (v === null || typeof range !== 'string') return null;
    const sets: Bound[][] = [];
    for (const alt of range.split('||')) {
        const tokens = alt.trim().replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1').split(/\s+/).filter(Boolean);
        if (tokens.includes('-')) return null;
        const set: Bound[] = [];
        for (const t of tokens) {
            const b = bounds_for(t);
            if (b === null) return null;
            set.push(...b);
        }
        sets.push(set);
    }
    if (v.pre.length > 0) return false;
    return sets.some((set) => set.every((b) => holds(b, v)));
}
