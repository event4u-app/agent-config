// MCP telemetry healthcheck — Phase 1 J6.
//
// Asserts that the per-consumer JSONL sink at
// `<consumer_root>/agents/runtime/mcp-telemetry/calls.jsonl` received at least
// one record inside a configurable window (default 24 h). Exits non-zero
// on silence so the caller's alert sink — Sentry, email, GitHub Actions
// failure, cron mailer — fires.
//
// Per `agents/roadmaps/archive/road-to-mcp-full-coverage.md` §Phase 1 J6, the
// healthcheck protects Phase 2 K1 against waking to an empty dataset: a
// silent telemetry pipeline must be visible *during* Phase 1, not after
// the observation window closes.
//
// Usage:
//
//   ./scripts-run src/scripts/mcp_telemetry_health                # 24h window
//   ./scripts-run src/scripts/mcp_telemetry_health --window-hours 6
//   ./scripts-run src/scripts/mcp_telemetry_health --allow-missing  # CI mode
//   ./scripts-run src/scripts/mcp_telemetry_health --json           # machine-readable
//
// TS twin of mcp_telemetry_health.py (py2ts). Mirrors the full public
// surface: HealthReport, resolve_log_path, evaluate, main.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { TELEMETRY_FILENAME, TELEMETRY_REL_DIR } from './mcp_server/telemetry.js';

export const DEFAULT_WINDOW_HOURS = 24;
const _ISO_FMT = '%Y-%m-%dT%H:%M:%SZ';

/** Outcome of a single healthcheck run. Serialised when --json fires. */
export interface HealthReport {
    status: string; // "healthy" | "silent" | "missing" | "unreadable"
    path: string;
    window_hours: number;
    records_in_window: number;
    last_ts: string | null;
    message: string;
}

/** Field-ordered dict mirroring HealthReport.as_dict(). */
function as_dict(report: HealthReport): Record<string, unknown> {
    return {
        status: report.status,
        path: report.path,
        window_hours: report.window_hours,
        records_in_window: report.records_in_window,
        last_ts: report.last_ts,
        message: report.message,
    };
}

/**
 * Compact JSON, Python `json.dumps(obj, separators=(",", ":"))` byte-parity:
 * insertion order preserved, `ensure_ascii=True` (non-ASCII → `\uXXXX`).
 */
function _py_json_dumps(value: unknown): string {
    if (value === null) {
        return 'null';
    }
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            return String(value);
        case 'string':
            return _py_json_string(value);
        case 'object':
            break;
        default:
            throw new TypeError(`Object of type ${typeof value} is not JSON serializable`);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _py_json_dumps(v)).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    const parts = Object.keys(obj).map(
        (k) => `${_py_json_string(k)}:${_py_json_dumps(obj[k])}`,
    );
    return `{${parts.join(',')}}`;
}

/** Escape a string like Python `json.dumps(..., ensure_ascii=True)`. */
function _py_json_string(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i += 1) {
        const code = s.charCodeAt(i);
        const ch = s[i] as string;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code >= 0x20 && code <= 0x7e) out += ch;
        else out += `\\u${code.toString(16).padStart(4, '0')}`;
    }
    return out + '"';
}

/**
 * Resolve a path like Python `Path(...).resolve()` — realpath the existing
 * prefix, tolerating a non-existent tail (Python resolve does not require
 * the path to exist; `fs.realpathSync` does, so fall back on ENOENT).
 */
function _resolvePath(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
}

/**
 * Best-effort ISO-8601 → epoch. Returns null for malformed input.
 *
 * Byte-faithful mirror of Python
 * `time.mktime(time.strptime(ts, _ISO_FMT)) - time.timezone`:
 *
 * - `time.strptime` builds a *naive* struct_time from the wall-clock
 *   fields (no timezone — the trailing `Z` is matched literally, NOT
 *   interpreted as UTC).
 * - `time.mktime` reads that naive struct as *local* time and returns
 *   the epoch using the local zone's actual offset for that date
 *   (DST-aware).
 * - Subtracting `time.timezone` (the local zone's *standard*, non-DST
 *   offset, seconds west of UTC) then shifts the result.
 *
 * On a DST date this does NOT yield the true UTC epoch — it carries the
 * DST delta. We reproduce that exact (intentionally faithful) arithmetic
 * so the in-window bucketing matches Python on the same host: interpret
 * the fields as local time via `new Date(y, mo, d, ...)`, then subtract
 * `time.timezone`, which equals January's `getTimezoneOffset()*60`
 * (standard-time offset, seconds west of UTC).
 */
function _parse_iso(ts: string): number | null {
    void _ISO_FMT;
    // %Y-%m-%dT%H:%M:%SZ — strict strptime-equivalent parse.
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(ts);
    if (m === null) {
        return null;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6]);
    // strptime/mktime validate ranges (e.g. month 13 → ValueError). Mirror
    // by rejecting any field a Date constructor would silently roll over.
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 61) {
        return null;
    }
    // time.mktime(naive_struct): naive fields interpreted as local time.
    const localEpochSec = new Date(year, month - 1, day, hour, minute, second).getTime() / 1000;
    if (Number.isNaN(localEpochSec)) {
        return null;
    }
    // time.timezone: standard-time (non-DST) offset, seconds west of UTC.
    // getTimezoneOffset() returns minutes (positive = west) for the given
    // date; January is guaranteed standard time in the northern hemisphere
    // and matches Python's `time.timezone` on the same host.
    const timeTimezoneSec = new Date(year, 0, 1).getTimezoneOffset() * 60;
    return localEpochSec - timeTimezoneSec;
}

/** Pick the JSONL location — matches telemetry.py's resolver. */
export function resolve_log_path(consumer_root?: string | null): string {
    const root = _resolvePath(consumer_root ?? process.cwd());
    return path.join(root, TELEMETRY_REL_DIR, TELEMETRY_FILENAME);
}

/** Return a HealthReport — pure function, no exit calls. */
export function evaluate(options: {
    consumer_root?: string | null;
    window_hours?: number;
    now?: number | null;
} = {}): HealthReport {
    const window_hours = options.window_hours ?? DEFAULT_WINDOW_HOURS;
    const target = resolve_log_path(options.consumer_root ?? null);
    const nowVal = options.now !== undefined && options.now !== null ? options.now : Date.now() / 1000;
    const cutoff = nowVal - window_hours * 3600;

    if (!fs.existsSync(target)) {
        return {
            status: 'missing',
            path: target,
            window_hours,
            records_in_window: 0,
            last_ts: null,
            message:
                `Telemetry sink not found at ${target}. ` +
                'Either the MCP server has never run, or the consumer root is wrong.',
        };
    }

    let lines: string[];
    try {
        // Python str.splitlines() splits on every Unicode line boundary and
        // drops a trailing newline. For our ASCII-newline JSONL, splitting on
        // \r\n / \r / \n and dropping a single trailing empty matches.
        const text = fs.readFileSync(target, { encoding: 'utf-8' });
        lines = _splitlines(text);
    } catch (exc) {
        const message = exc instanceof Error ? exc.message : String(exc);
        return {
            status: 'unreadable',
            path: target,
            window_hours,
            records_in_window: 0,
            last_ts: null,
            message: `Telemetry sink unreadable: ${message}`,
        };
    }

    let in_window = 0;
    let last_ts: string | null = null;
    for (const line of lines) {
        if (line.trim() === '') {
            continue;
        }
        let record: unknown;
        try {
            record = JSON.parse(line);
        } catch {
            continue;
        }
        if (record === null || typeof record !== 'object' || Array.isArray(record)) {
            continue;
        }
        const ts = (record as Record<string, unknown>)['ts'];
        if (typeof ts !== 'string') {
            continue;
        }
        const epoch = _parse_iso(ts);
        if (epoch === null) {
            continue;
        }
        if (last_ts === null || ts > last_ts) {
            last_ts = ts;
        }
        if (epoch >= cutoff) {
            in_window += 1;
        }
    }

    if (in_window === 0) {
        return {
            status: 'silent',
            path: target,
            window_hours,
            records_in_window: 0,
            last_ts,
            message:
                `No telemetry records in the past ${window_hours}h. ` +
                'Phase 2 K1 dataset is at risk — verify the MCP server is reachable ' +
                'and that consumers are calling tools.',
        };
    }

    return {
        status: 'healthy',
        path: target,
        window_hours,
        records_in_window: in_window,
        last_ts,
        message: `${in_window} record(s) logged in the past ${window_hours}h.`,
    };
}

/** Mirror Python `str.splitlines()` for the newline forms in a JSONL sink. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const parts = text.split(/\r\n|\r|\n/);
    // splitlines() does not yield a trailing empty element for a final newline.
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

interface ParsedArgs {
    consumer_root: string | null;
    window_hours: number;
    allow_missing: boolean;
    json: boolean;
}

/** Minimal argparse mirror for this CLI's flags. */
function _parse_args(argv: string[]): ParsedArgs {
    const args: ParsedArgs = {
        consumer_root: null,
        window_hours: DEFAULT_WINDOW_HOURS,
        allow_missing: false,
        json: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--consumer-root') {
            args.consumer_root = argv[++i] as string;
        } else if (a.startsWith('--consumer-root=')) {
            args.consumer_root = a.slice('--consumer-root='.length);
        } else if (a === '--window-hours') {
            args.window_hours = Number.parseInt(argv[++i] as string, 10);
        } else if (a.startsWith('--window-hours=')) {
            args.window_hours = Number.parseInt(a.slice('--window-hours='.length), 10);
        } else if (a === '--allow-missing') {
            args.allow_missing = true;
        } else if (a === '--json') {
            args.json = true;
        }
    }
    return args;
}

const _ICON: Record<string, string> = {
    healthy: '✅',
    silent: '❌',
    missing: '⚠️',
    unreadable: '❌',
};

export function main(argv?: string[]): number {
    const args = _parse_args(argv ?? process.argv.slice(2));
    const report = evaluate({
        consumer_root: args.consumer_root,
        window_hours: args.window_hours,
    });

    if (args.json) {
        process.stdout.write(_py_json_dumps(as_dict(report)) + '\n');
    } else {
        const icon = _ICON[report.status] as string;
        process.stdout.write(`${icon}  ${report.message}\n`);
        if (report.last_ts) {
            process.stdout.write(`   last record: ${report.last_ts}\n`);
        }
        process.stdout.write(`   sink: ${report.path}\n`);
    }

    if (report.status === 'healthy') {
        return 0;
    }
    if (report.status === 'missing' && args.allow_missing) {
        return 0;
    }
    return 1;
}

// Entry point — `process.exitCode`, never `process.exit`, so large stdout
// drains before the process ends.
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
