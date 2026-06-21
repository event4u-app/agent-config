#!/usr/bin/env tsx
/**
 * Tier-usage report — aggregate the local tier-usage log into a frequency table.
 *
 * TypeScript twin of `src/agent-src/templates/scripts/tier_usage_report.py`
 * (ADR-094, consumer-template surface-discipline telemetry). The CLI
 * contract mirrors the Python original EXACTLY — same exit codes,
 * stdout/stderr split, byte-identical messages, byte-identical table +
 * `--json` output (matching json.dumps(indent=2)). No behaviour changes —
 * latent Python bugs are replicated and flagged as divergence candidates.
 *
 * Phase 5 Step 3 of road-to-surface-discipline. Reads the JSONL log
 * written by the dispatcher (default `.agent-tier-usage.jsonl`; override
 * via `telemetry.tier_usage.output.path`) and emits a per-command
 * frequency table grouped by tier, plus distinct `user_hash` counts.
 * Run-local-only; no upload, no remote aggregation.
 *
 * Privacy floor mirrors the contract in
 * `docs/contracts/command-clusters.md#tier-usage-signal-contract` and
 * the four-layer enforcement model used by artefact-engagement telemetry.
 * Records that carry any field outside the contract whitelist are dropped
 * at the read gate — the report refuses to render leaked shapes rather
 * than re-emit them.
 *
 * The `telemetry.settings` reader is inlined here (the `read_tier_usage_settings`
 * slice + `DEFAULT_TIER_USAGE_LOG_PATH`) rather than imported across the
 * still-unported `telemetry/settings.py` boundary — a `.ts` twin must not
 * import a `.py`. The inlined coercion mirrors the Python source exactly.
 *
 * Usage:
 *     tier_usage_report                       # last 30d, table
 *     tier_usage_report --window-days 7       # last 7d
 *     tier_usage_report --window-days 0       # full log
 *     tier_usage_report --json                # JSON for tooling
 *     tier_usage_report --log-path X.jsonl    # archived snapshot
 *
 * Exit codes:
 *     0   success or telemetry disabled (single header line)
 *     1   no records survived the privacy floor on a non-empty file
 *     2   IO error (permission denied; passed path missing)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

// Contract whitelist (see `docs/contracts/command-clusters.md`).
const ALLOWED_FIELDS: ReadonlySet<string> = new Set(['ts_bucket', 'command', 'tier', 'outcome', 'user_hash']);
const ALLOWED_OUTCOMES: ReadonlySet<string> = new Set(['success', 'error', 'blocked']);

// Defaults for the tier-usage signal (mirrors telemetry/settings.py).
const DEFAULT_TIER_USAGE_LOG_PATH = '.agent-tier-usage.jsonl';
const DEFAULT_TIER_USAGE_RETIER = { window_days: 30, min_invocations: 20, min_distinct_users: 3 };

interface TierUsageSettings {
    enabled: boolean;
    log_path: string;
    window_days: number;
    min_invocations: number;
    min_distinct_users: number;
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Mirror telemetry.settings._coerce_bool. */
function _coerce_bool(value: unknown, def: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalised = value.trim().toLowerCase();
        if (['true', 'yes', 'on', '1'].includes(normalised)) {
            return true;
        }
        if (['false', 'no', 'off', '0'].includes(normalised)) {
            return false;
        }
    }
    return def;
}

/** Mirror telemetry.settings._coerce_path. */
function _coerce_path(value: unknown, def: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        return def;
    }
    return value.trim();
}

/** Mirror telemetry.settings.read_tier_usage_settings (the slice this report uses). */
function read_tier_usage_settings(p: string): TierUsageSettings {
    let section: Record<string, unknown> = {};
    if (_isFile(p)) {
        // The `yaml` npm dependency is always present; the ImportError branch
        // (PyYAML absent → all-defaults) is unreachable in the TS twin.
        let raw: unknown = {};
        try {
            raw = parseYaml(fs.readFileSync(p, 'utf-8')) ?? {};
        } catch {
            raw = {};
        }
        if (_isPlainObject(raw)) {
            const tele = raw['telemetry'];
            if (_isPlainObject(tele)) {
                const tu = tele['tier_usage'];
                if (_isPlainObject(tu)) {
                    section = tu;
                }
            }
        }
    }
    const output = _isPlainObject(section['output']) ? (section['output'] as Record<string, unknown>) : {};
    const retier = _isPlainObject(section['retier']) ? (section['retier'] as Record<string, unknown>) : {};
    const defaults = DEFAULT_TIER_USAGE_RETIER;

    const _coerce_int = (value: unknown, def: number): number => {
        if (typeof value === 'boolean') {
            return def;
        }
        if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
            return value;
        }
        return def;
    };

    return {
        enabled: _coerce_bool(section['enabled'], false),
        log_path: _coerce_path(output['path'], DEFAULT_TIER_USAGE_LOG_PATH),
        window_days: _coerce_int(retier['window_days'], defaults.window_days),
        min_invocations: _coerce_int(retier['min_invocations'], defaults.min_invocations),
        min_distinct_users: _coerce_int(retier['min_distinct_users'], defaults.min_distinct_users),
    };
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

interface SanitizedRecord {
    ts_bucket: string;
    command: string;
    tier: number;
    outcome: string;
    user_hash: string;
}

/** Return a sanitized record or null when the line violates the floor. */
function _parse_record(raw: string): SanitizedRecord | null {
    let obj: unknown;
    try {
        obj = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!_isPlainObject(obj)) {
        return null;
    }
    for (const k of Object.keys(obj)) {
        if (!ALLOWED_FIELDS.has(k)) {
            return null;
        }
    }
    const cmd = obj['command'];
    if (typeof cmd !== 'string' || !cmd || cmd.includes('/') || cmd.includes('\\')) {
        return null;
    }
    const tier = obj['tier'];
    if (typeof tier !== 'number' || !Number.isInteger(tier) || typeof tier === 'boolean' || ![0, 1, 2, 3].includes(tier)) {
        return null;
    }
    if (typeof obj['outcome'] !== 'string' || !ALLOWED_OUTCOMES.has(obj['outcome'])) {
        return null;
    }
    const uh = obj['user_hash'];
    if (typeof uh !== 'string' || uh.length !== 16) {
        return null;
    }
    if (typeof obj['ts_bucket'] !== 'string') {
        return null;
    }
    return obj as unknown as SanitizedRecord;
}

/** Mirror datetime.fromisoformat(ts_bucket.replace("Z","+00:00")) → ms epoch, or null. */
function _parseIso(ts: string): number | null {
    const s = ts.replace('Z', '+00:00');
    // datetime.fromisoformat (3.10): "YYYY-MM-DD[THH:MM:SS[.ffffff]][+HH:MM]".
    const m =
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:([+-]\d{2}:\d{2}))?)?$/.exec(s);
    if (!m) {
        return null;
    }
    const [, y, mo, d, h, mi, sec, frac, tz] = m;
    let ms = Date.UTC(
        Number(y),
        Number(mo) - 1,
        Number(d),
        h ? Number(h) : 0,
        mi ? Number(mi) : 0,
        sec ? Number(sec) : 0,
        frac ? Number((frac + '000000').slice(0, 6)) / 1000 : 0,
    );
    let hadOffset = false;
    if (tz) {
        hadOffset = true;
        const sign = tz[0] === '-' ? -1 : 1;
        const oh = Number(tz.slice(1, 3));
        const om = Number(tz.slice(4, 6));
        ms -= sign * (oh * 60 + om) * 60 * 1000;
    }
    // Python: a naive ts (no tzinfo) gets .replace(tzinfo=utc); offsetless input
    // is therefore treated as UTC. Date.UTC already did that, so `hadOffset`
    // distinction is not needed for the comparison value.
    void hadOffset;
    return ms;
}

function _within_window(ts_bucket: string, window_days: number | null): boolean {
    if (window_days === null || window_days === 0) {
        return true;
    }
    const ms = _parseIso(ts_bucket);
    if (ms === null) {
        return false;
    }
    return ms >= Date.now() - window_days * 24 * 60 * 60 * 1000;
}

type BucketKey = string; // `${tier} ${command}` — composite (tier, command) key.
interface RowStats {
    count: number;
    distinct_users: number;
}

interface AggregateResult {
    table: Map<BucketKey, RowStats>;
    keyMeta: Map<BucketKey, { tier: number; command: string }>;
    total: number;
    kept: number;
}

/** Return ((tier, command) -> stats, total_lines, kept) over the window. */
function aggregate(log_path: string, window_days: number): AggregateResult {
    const counts = new Map<BucketKey, number>();
    const users = new Map<BucketKey, Set<string>>();
    const keyMeta = new Map<BucketKey, { tier: number; command: string }>();
    let total = 0;
    let kept = 0;
    if (!_exists(log_path)) {
        return { table: new Map(), keyMeta: new Map(), total: 0, kept: 0 };
    }
    // Python opens the file; a permission error raises OSError → caller exit 2.
    const text = fs.readFileSync(log_path, 'utf-8');
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        total += 1;
        const rec = _parse_record(line);
        if (rec === null) {
            continue;
        }
        if (!_within_window(rec.ts_bucket, window_days)) {
            continue;
        }
        kept += 1;
        const tier = Math.trunc(rec.tier);
        const key = `${tier} ${rec.command}`;
        if (!keyMeta.has(key)) {
            keyMeta.set(key, { tier, command: rec.command });
            counts.set(key, 0);
            users.set(key, new Set());
        }
        counts.set(key, (counts.get(key) ?? 0) + 1);
        (users.get(key) as Set<string>).add(rec.user_hash);
    }
    const table = new Map<BucketKey, RowStats>();
    for (const [k, c] of counts) {
        table.set(k, { count: c, distinct_users: (users.get(k) as Set<string>).size });
    }
    return { table, keyMeta, total, kept };
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Left-pad to width with spaces (mirror f"{s:<width}"). */
function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** Right-justify to width with spaces (mirror f"{s:>width}"). */
function _rjust(s: string, width: number): string {
    return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function render(result: AggregateResult, window_days: number): string {
    const suffix = window_days ? ` (last ${window_days}d)` : ' (full log)';
    if (result.table.size === 0) {
        return `(no tier-usage records${suffix})\n`;
    }
    // sorted by (tier, -count, command)
    const rows = [...result.table.entries()].sort((a, b) => {
        const ma = result.keyMeta.get(a[0]) as { tier: number; command: string };
        const mb = result.keyMeta.get(b[0]) as { tier: number; command: string };
        if (ma.tier !== mb.tier) {
            return ma.tier - mb.tier;
        }
        if (b[1].count !== a[1].count) {
            return b[1].count - a[1].count;
        }
        return ma.command < mb.command ? -1 : ma.command > mb.command ? 1 : 0;
    });
    const header = `${_ljust('Tier', 6)}${_ljust('Command', 32)}${_rjust('Calls', 8)}${_rjust('Users', 8)}`;
    const lines: string[] = [header, '-'.repeat(header.length)];
    for (const [key, stats] of rows) {
        const meta = result.keyMeta.get(key) as { tier: number; command: string };
        lines.push(
            `${_ljust(String(meta.tier), 6)}${_ljust(meta.command, 32)}${_rjust(String(stats.count), 8)}${_rjust(
                String(stats.distinct_users),
                8,
            )}`,
        );
    }
    lines.push(`\n(window:${suffix.trim()})`);
    return lines.join('\n') + '\n';
}

interface ParsedArgs {
    window_days: number;
    json: boolean;
    log_path: string | null;
    settings_file: string;
}

const _PROG = 'tier_usage_report.py';
const _USAGE =
    'usage: tier_usage_report.py [-h] [--window-days WINDOW_DAYS] [--json]\n' +
    '                            [--log-path LOG_PATH]\n' +
    '                            [--settings-file SETTINGS_FILE]\n';

/** Mirror argparse error: usage + "<prog>: error: <msg>" to stderr, exit 2. */
function _argError(msg: string): never {
    process.stderr.write(_USAGE);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exit(2);
}

/** Mirror argparse `type=int` coercion + its error message. */
function _parseIntArg(value: string | undefined, flag: string): number {
    if (value === undefined) {
        _argError(`argument ${flag}: expected one argument`);
    }
    // Python int() accepts surrounding whitespace and a leading sign.
    const trimmed = (value as string).trim();
    if (!/^[+-]?\d+$/.test(trimmed)) {
        _argError(`argument ${flag}: invalid int value: '${value as string}'`);
    }
    return Number(trimmed);
}

function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = {
        window_days: 30,
        json: false,
        log_path: null,
        settings_file: '.agent-settings.yml',
    };
    const takeValue = (flag: string, i: number): [string, number] => {
        const v = argv[i + 1];
        if (v === undefined) {
            _argError(`argument ${flag}: expected one argument`);
        }
        return [v as string, i + 1];
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--window-days') {
            args.window_days = _parseIntArg(argv[++i], '--window-days');
        } else if (a.startsWith('--window-days=')) {
            args.window_days = _parseIntArg(a.slice('--window-days='.length), '--window-days');
        } else if (a === '--json') {
            args.json = true;
        } else if (a === '--log-path') {
            const [v, ni] = takeValue('--log-path', i);
            args.log_path = v;
            i = ni;
        } else if (a.startsWith('--log-path=')) {
            args.log_path = a.slice('--log-path='.length);
        } else if (a === '--settings-file') {
            const [v, ni] = takeValue('--settings-file', i);
            args.settings_file = v;
            i = ni;
        } else if (a.startsWith('--settings-file=')) {
            args.settings_file = a.slice('--settings-file='.length);
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(_USAGE);
            process.exit(0);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

// --- JSON output (json.dumps(payload, indent=2)) ----------------------------

function pyJsonDumps(value: unknown, indent: number): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0));
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map((k) => `${pad}${_jsonStrAscii(k)}: ${_dumpsIndent(value[k], indent, depth + 1)}`);
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

function _jsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
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
                if (code < 0x20) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

export function main(argv?: string[]): number {
    const args = _parseArgs(argv ?? process.argv.slice(2));

    const settings = read_tier_usage_settings(args.settings_file);
    const log_path = args.log_path || settings.log_path || DEFAULT_TIER_USAGE_LOG_PATH;

    if (args.log_path === null && !settings.enabled) {
        process.stdout.write(
            '(tier-usage telemetry disabled; set ' +
                '`telemetry.tier_usage.enabled: true` in .agent-settings.yml)\n',
        );
        return 0;
    }

    let result: AggregateResult;
    try {
        result = aggregate(log_path, args.window_days);
    } catch (exc) {
        process.stderr.write(`❌  ${_osErrorMessage(exc, log_path)}\n`);
        return 2;
    }

    if (result.total > 0 && result.kept === 0) {
        process.stderr.write(
            `❌  ${result.total} record(s) read; 0 survived the privacy floor — ` + 'report refused\n',
        );
        return 1;
    }

    if (args.json) {
        // sorted(table.items(), key=(tier, command))
        const sortedKeys = [...result.table.entries()].sort((a, b) => {
            const ma = result.keyMeta.get(a[0]) as { tier: number; command: string };
            const mb = result.keyMeta.get(b[0]) as { tier: number; command: string };
            if (ma.tier !== mb.tier) {
                return ma.tier - mb.tier;
            }
            return ma.command < mb.command ? -1 : ma.command > mb.command ? 1 : 0;
        });
        const payload = {
            window_days: args.window_days,
            log_path: String(log_path),
            records_total: result.total,
            records_kept: result.kept,
            rows: sortedKeys.map(([key, v]) => {
                const meta = result.keyMeta.get(key) as { tier: number; command: string };
                return { tier: meta.tier, command: meta.command, count: v.count, distinct_users: v.distinct_users };
            }),
        };
        process.stdout.write(`${pyJsonDumps(payload, 2)}\n`);
    } else {
        process.stdout.write(render(result, args.window_days));
    }
    return 0;
}

/** Mirror str(OSError) shapes for the exit-2 stderr line. */
function _osErrorMessage(exc: unknown, log_path: string): string {
    const err = exc as NodeJS.ErrnoException;
    if (err && err.code === 'ENOENT') {
        return `[Errno 2] No such file or directory: '${log_path}'`;
    }
    if (err && err.code === 'EACCES') {
        return `[Errno 13] Permission denied: '${log_path}'`;
    }
    if (err && err.code === 'EISDIR') {
        return `[Errno 21] Is a directory: '${log_path}'`;
    }
    return err && err.message ? err.message : String(exc);
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}
