/**
 * The two version questions the systems lane asks, answered conservatively.
 *
 * `satisfies` covers the range forms manifests actually use — exact, `^`, `~`,
 * comparison operators, `x`/`*` wildcards, hyphen ranges, `||` and Composer's
 * space- or comma-joined AND — and returns `null` for anything else. A `null`
 * is "not judged", never "disagrees": a drift finding built on a parser guess
 * would be a false fact.
 */

type V = [number, number, number];

function parse(v: string): V | null {
    const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim());
    return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

const cmp = (a: V, b: V): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** One comparator clause → a predicate, or null when the form is unknown. */
function clause(c: string): ((v: V) => boolean) | null {
    const s = c.trim();
    if (s === '' || s === '*' || /^[xX*](\.[xX*])*$/.test(s)) return () => true;
    const wild = /^v?(\d+)(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/.exec(s);
    if (wild && (wild[2] === undefined || /[xX*]/.test(wild[2]) || wild[3] === undefined || /[xX*]/.test(wild[3]))) {
        const maj = Number(wild[1]);
        const min = wild[2] !== undefined && !/[xX*]/.test(wild[2]) ? Number(wild[2]) : null;
        // `8` and `8.3` as a bare constraint mean 8.*.* / 8.3.* in both ecosystems
        return (v) => v[0] === maj && (min === null || v[1] === min);
    }
    const op = /^(\^|~|>=|<=|>|<|=|==)?\s*(v?\d+(?:\.\d+){0,2})/.exec(s);
    if (!op) return null;
    const base = parse(op[2] as string);
    if (!base) return null;
    const parts = (op[2] as string).replace(/^v/, '').split('.').length;
    switch (op[1]) {
        case '^':
            if (base[0] > 0) return (v) => v[0] === base[0] && cmp(v, base) >= 0;
            if (base[1] > 0 || parts < 3) return (v) => v[0] === 0 && v[1] === base[1] && cmp(v, base) >= 0;
            return (v) => cmp(v, base) === 0;
        case '~':
            return parts === 1 ? (v) => v[0] === base[0] : (v) => v[0] === base[0] && v[1] === base[1] && cmp(v, base) >= 0;
        case '>=':
            return (v) => cmp(v, base) >= 0;
        case '<=':
            return (v) => cmp(v, base) <= 0;
        case '>':
            return (v) => cmp(v, base) > 0;
        case '<':
            return (v) => cmp(v, base) < 0;
        default:
            return (v) => cmp(v, base) === 0;
    }
}

/** Whether `version` satisfies `range`; null when the range form is not one this reads. */
export function satisfies(version: string, range: string): boolean | null {
    const v = parse(version);
    if (!v) return null;
    let any = false;
    for (const alt of range.split('||')) {
        const hyphen = /^\s*(\S+)\s+-\s+(\S+)\s*$/.exec(alt);
        const parts = hyphen
            ? [`>=${hyphen[1]}`, `<=${hyphen[2]}`]
            : alt
                  .trim()
                  .replace(/(>=|<=|==|>|<|=|\^|~)\s+/g, '$1')
                  .split(/[\s,]+/)
                  .filter(Boolean);
        const preds: Array<(v: V) => boolean> = [];
        for (const p of parts.length ? parts : ['*']) {
            const f = clause(p.replace(/@.*$/, ''));
            if (!f) return null;
            preds.push(f);
        }
        if (preds.every((f) => f(v))) any = true;
    }
    return any;
}

const NODE_BUILTINS = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib', 'test',
]);

/** The package an import specifier names, or null for a builtin, a relative path or an alias. */
export function packageOfSpecifier(spec: string): string | null {
    if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:') || spec.startsWith('<')) return null;
    if (spec.startsWith('#') || spec.startsWith('~') || spec.startsWith('@/')) return null;
    const parts = spec.split('/');
    const name = spec.startsWith('@') ? (parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null) : (parts[0] as string);
    if (!name || NODE_BUILTINS.has(name)) return null;
    return /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(name) ? name : null;
}
