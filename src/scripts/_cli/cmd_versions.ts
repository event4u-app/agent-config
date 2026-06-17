/**
 * `agent-config versions` — list available package versions (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_versions.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same subprocess invocation. Read-only (queries npm; never mutates).
 * No behaviour changes; latent quirks are replicated and flagged inline.
 *
 * Queries the npm registry for available versions of `@event4u/agent-config`
 * and prints them. Marks the current pin (from `.agent-settings.yml`
 * `agent_config_version`) and the latest published version.
 *
 * Offline-tolerant: when `--offline` is passed or the registry is unreachable,
 * falls back to reading the local `package.json` version and prints a
 * single-line notice instead of failing.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns the exit code; the CLI entry guard sets `process.exitCode`
 *   and never calls `process.exit()`. argparse usage errors throw
 *   `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)`.
 * - JSON byte-parity: `json.dumps(obj, indent=2)` (Python default
 *   `ensure_ascii=True`, `sort_keys=False`) → `_jsonDumpsIndentAscii(obj, 2)`
 *   + `print` newline. Object key insertion order is preserved.
 * - `subprocess.run(["npm", "view", PKG, "versions", "--json"],
 *   capture_output=True, text=True, timeout=15)` → `spawnSync('npm', [...],
 *   { encoding: 'utf8', timeout: 15000 })`. The Python `except
 *   (FileNotFoundError, subprocess.TimeoutExpired)` → `[]` is mirrored by
 *   inspecting `spawnSync`'s `error`: `ENOENT` (binary missing) and `ETIMEDOUT`
 *   (`signal === 'SIGTERM'` / `error.code === 'ETIMEDOUT'`) both yield `[]`.
 * - `proc.returncode != 0 → []`; `json.loads(stdout)` parse error → `[]`.
 *   A JSON string result becomes `[str]`; a list becomes `[str(v) ...]`;
 *   anything else → `[]`.
 * - `Path(__file__).resolve().parents[3]` (repo root) is mirrored from
 *   `import.meta.url` → 3 `path.dirname` hops (… /_cli/cmd_versions.ts →
 *   /_cli → /scripts → /src → repo root).
 * - `_pinned_version()` does a line-prefix scan + `partition(":")`; mirrored
 *   exactly (Python `str.partition` keeps text before the FIRST `:`).
 * - `versions[-limit:]` (negative slice) → `versions.slice(Math.max(0, n - limit))`.
 */

import process from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { project_settings_path, resolve_project_root } from '../_lib/agent_settings.js';

const PACKAGE_NAME = '@event4u/agent-config';

const _HERE_DIR = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

/** argparse usage-error / help sentinel: exit 2 for errors, 0 for --help. */
class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

interface OutSink {
    write(text: string): void;
}
function _stdoutSink(): OutSink {
    return { write: (t) => process.stdout.write(t) };
}
function _stderrSink(): OutSink {
    return { write: (t) => process.stderr.write(t) };
}
/** `print(line)` — append a trailing newline like Python's print. */
function _print(out: OutSink, line = ''): void {
    out.write(line + '\n');
}

// --- JSON byte-parity (ensure_ascii=True, sort_keys=False, insertion order) ---

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        const ch = s[i] as string;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20 || code > 0x7e) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _jsonScalarAscii(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        return String(value);
    }
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpIndentAscii(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalarAscii(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndentAscii(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrAscii(k)}: ${_dumpIndentAscii(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(data, indent=N)` — Python default (ensure_ascii, sort_keys=False). */
function _jsonDumpsIndentAscii(value: unknown, indent: number): string {
    return _dumpIndentAscii(value, indent, 0);
}

// ---------------------------------------------------------------------------

function _project_root(): string {
    const [root] = resolve_project_root(null);
    return root;
}

/** Return `version` from the local `package.json`, or `""` if absent. */
function _local_package_version(): string {
    const candidates = [
        path.join(path.resolve(_HERE_DIR, '..', '..', '..'), 'package.json'),
        path.join(_project_root(), 'package.json'),
    ];
    for (const p of candidates) {
        let exists: boolean;
        try {
            fs.statSync(p);
            exists = true;
        } catch {
            exists = false;
        }
        if (exists) {
            try {
                const data = JSON.parse(fs.readFileSync(p, { encoding: 'utf-8' }));
                const v = (data as Record<string, unknown>)?.['version'];
                return v === undefined || v === null ? '' : String(v);
            } catch {
                // json.JSONDecodeError / OSError → try next candidate.
                continue;
            }
        }
    }
    return '';
}

/** Return the `agent_config_version` pin from `.agent-settings.yml`. */
function _pinned_version(): string {
    const settings = project_settings_path(_project_root());
    let exists: boolean;
    try {
        fs.statSync(settings);
        exists = true;
    } catch {
        exists = false;
    }
    if (!exists) {
        return '';
    }
    try {
        const text = fs.readFileSync(settings, { encoding: 'utf-8' });
        for (const rawLine of _splitlines(text)) {
            const line = _pyStrip(rawLine);
            if (line.startsWith('agent_config_version')) {
                // Python `partition(":")` — text before the FIRST ":".
                const idx = line.indexOf(':');
                const rhs = idx === -1 ? '' : line.slice(idx + 1);
                return _pyStripChars(_pyStripChars(_pyStrip(rhs), '"'), "'");
            }
        }
    } catch {
        // OSError → "".
    }
    return '';
}

/** Run `npm view <pkg> versions --json`; return parsed list or `[]`. */
function _query_npm(): string[] {
    const proc = spawnSync('npm', ['view', PACKAGE_NAME, 'versions', '--json'], {
        encoding: 'utf8',
        timeout: 15000,
    });
    // Python: `except (FileNotFoundError, subprocess.TimeoutExpired): return []`.
    // spawnSync surfaces both via `proc.error` (ENOENT, ETIMEDOUT).
    if (proc.error) {
        return [];
    }
    if (proc.status !== 0) {
        return [];
    }
    let data: unknown;
    try {
        data = JSON.parse(proc.stdout ?? '');
    } catch {
        return [];
    }
    if (typeof data === 'string') {
        return [data];
    }
    if (Array.isArray(data)) {
        return data.map((v) => String(v));
    }
    return [];
}

function _format_table(
    versions: string[],
    current: string,
    pinned: string,
    limit: number,
): string {
    const rows: string[] = [];
    const head = limit > 0 ? versions.slice(Math.max(0, versions.length - limit)) : versions;
    for (const v of head) {
        const marks: string[] = [];
        if (v === pinned) {
            marks.push('← pinned');
        }
        if (v === current) {
            marks.push('← latest');
        }
        const suffix = marks.length ? '  ' + marks.join(' ') : '';
        rows.push(`  ${v}${suffix}`);
    }
    return rows.join('\n');
}

// --- small Python-string helpers (strip / splitlines) ---

function _isPyWs(code: number): boolean {
    return (
        code === 0x09 ||
        code === 0x0a ||
        code === 0x0b ||
        code === 0x0c ||
        code === 0x0d ||
        code === 0x1c ||
        code === 0x1d ||
        code === 0x1e ||
        code === 0x1f ||
        code === 0x20 ||
        code === 0x85 ||
        code === 0xa0 ||
        code === 0x1680 ||
        (code >= 0x2000 && code <= 0x200a) ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0x202f ||
        code === 0x205f ||
        code === 0x3000
    );
}

/** Python `str.strip()` (no args) — strip leading + trailing whitespace. */
function _pyStrip(s: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && _isPyWs(s.charCodeAt(start))) start += 1;
    while (end > start && _isPyWs(s.charCodeAt(end - 1))) end -= 1;
    return s.slice(start, end);
}

/** Python `str.strip(chars)` for a single-character `chars` set. */
function _pyStripChars(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) start += 1;
    while (end > start && s[end - 1] === ch) end -= 1;
    return s.slice(start, end);
}

/** Python `str.splitlines()`. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (ch === '\r') {
            if (text[i + 1] === '\n') i += 1;
            out.push(cur);
            cur = '';
        } else if (
            ch === '\n' ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    if (cur !== '') out.push(cur);
    return out;
}

// ---------------------------------------------------------------------------
// arg parsing — mirrors argparse flags + usage / error exits
// ---------------------------------------------------------------------------

interface Opts {
    offline: boolean;
    limit: number;
    as_json: boolean;
}

function _parse(argv: string[], out: OutSink, err: OutSink): Opts {
    const prog = 'agent-config versions';
    const usage = `usage: ${prog} [-h] [--offline] [--limit LIMIT] [--json]\n`;

    const emitError = (msg: string): never => {
        err.write(usage);
        err.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    const opts: Opts = { offline: false, limit: 20, as_json: false };

    const parseLimit = (raw: string): number => {
        // argparse `type=int` — Python int() accepts optional sign + digits,
        // with surrounding whitespace and underscores between digits.
        const t = _pyStrip(raw);
        if (!/^[+-]?\d(?:_?\d)*$/.test(t)) {
            emitError(`argument --limit: invalid int value: '${raw}'`);
        }
        return parseInt(t.replace(/_/g, ''), 10);
    };

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            out.write(usage);
            throw new ArgparseExit(0);
        } else if (tok === '--offline') {
            opts.offline = true;
            i += 1;
        } else if (tok === '--json') {
            opts.as_json = true;
            i += 1;
        } else if (tok === '--limit') {
            const val: string | undefined = argv[i + 1];
            if (val === undefined) {
                emitError('argument --limit: expected one argument');
            }
            opts.limit = parseLimit(val as string);
            i += 2;
        } else if (tok.startsWith('--limit=')) {
            opts.limit = parseLimit(tok.slice('--limit='.length));
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return opts;
}

interface MainOptions {
    out?: OutSink;
    err?: OutSink;
}

export function main(argv: string[] | null = null, options: MainOptions = {}): number {
    const out = options.out ?? _stdoutSink();
    const err = options.err ?? _stderrSink();
    const opts = _parse(argv ?? process.argv.slice(2), out, err);

    // AGENT_CONFIG_OFFLINE=1 (set by `install.py --offline`) is honored as a
    // global kill-switch even when the per-command --offline flag is absent.
    const offline = opts.offline || process.env['AGENT_CONFIG_OFFLINE'] === '1';

    const local = _local_package_version();
    const pinned = _pinned_version();
    let versions: string[] = [];
    if (!offline) {
        versions = _query_npm();
    }
    const latest = versions.length ? (versions[versions.length - 1] as string) : local;

    if (opts.as_json) {
        _print(
            out,
            _jsonDumpsIndentAscii(
                {
                    pinned,
                    local,
                    latest,
                    versions,
                    source: versions.length ? 'npm' : 'local',
                },
                2,
            ),
        );
        return 0;
    }

    _print(out, `package: ${PACKAGE_NAME}`);
    _print(out, `pinned:  ${pinned || '— (no .agent-settings.yml)'}`);
    _print(out, `local:   ${local || '—'}`);
    if (!versions.length) {
        if (offline) {
            _print(out, 'offline mode — registry query skipped');
        } else {
            _print(out, '⚠️   npm registry unreachable; showing local only');
        }
        return 0;
    }
    _print(out, `latest:  ${latest}`);
    _print(out);
    _print(out, `available versions (${opts.limit > 0 ? 'last ' + String(opts.limit) : 'all'}):`);
    _print(out, _format_table(versions, latest, pinned, opts.limit));
    return 0;
}

// CLI entry guard — set process.exitCode; never call process.exit().
// Python: `if __name__ == "__main__": raise SystemExit(main())` (no argv slice;
// argparse reads sys.argv[1:] inside `_parse` default).
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main();
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}
