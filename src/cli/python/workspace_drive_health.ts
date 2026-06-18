#!/usr/bin/env tsx
/**
 * Drive health + kill-switch — ADR-073 (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_drive_health.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same
 * subcommands, same exit codes, same `json.dumps(..., sort_keys=True)` output,
 * same fail-open `_read()` shape, same `status` text format, same atomic-write
 * semantics. No behaviour changes — latent quirks are replicated, not fixed
 * (notably: an invalid host id on `record`/`gate`/`kill`/`reset` re-raises from
 * `_write` → uncaught error → exit 1, while `status` reads fail-open).
 *
 * The Tier-1 drive loop (ADR-070/071/072) records every turn in the session
 * store (`host.turn` / `host.error`) — that store is the **canonical** history.
 * But the kill-switch needs a *cheap, frequent* read ("is this host healthy
 * enough to drive?") on every launch; scanning encrypted session files per
 * launch is wrong. So this module keeps a tiny per-host **cache** counter at
 * `<root>/<host>.json` and a kill-switch derived from it.
 *
 * Design (AI-council 2026-06-08, claude-sonnet-4-5 + gpt-4o, design mode):
 *
 * - **Counter is a cache; the session log is canonical.** A missing /
 *   unreadable health file fails **open** (host treated as healthy) — the cache
 *   never fabricates a kill.
 * - **Minimal schema** — `consecutive_failures`, `killed`, lifetime totals, last
 *   outcome. No time-bucketed histograms (that would be v0 over-engineering).
 * - **Auto-trip at N=5 consecutive failures** + a **manual** `kill`.
 * - **Auto-cooldown recovery (ADR-073 v1, circuit-breaker).** An auto-tripped
 *   host is `open` (inbox-only) during a cooldown, then `half_open` — the next
 *   real launch drives as a **probe**: success closes the circuit (un-kills),
 *   failure re-opens it and restarts the cooldown. Bounded by `MAX_AUTO_TRIPS`
 *   (after which the host goes sticky → manual reset). A **manual** `kill` is
 *   sticky (never auto-recovers). Cooldown is env-tunable
 *   (`AGENT_CONFIG_DRIVE_COOLDOWN_SEC`, default 600 s); the whole behaviour is
 *   behind `AGENT_CONFIG_DRIVE_AUTO_RECOVERY` (default on; off → v0
 *   manual-only).
 * - **Atomic writes** (temp + rename) so a concurrent writer never sees a
 *   half-written file. Increments are best-effort under true concurrency (a
 *   lost increment is acceptable — the session log remains the source of
 *   truth).
 *
 * CLI:
 *
 *     workspace_drive_health.ts record --host <h> --outcome ok|fail [--error-kind <k>] --root <dir>
 *     workspace_drive_health.ts status [--host <h>] [--json] --root <dir>
 *     workspace_drive_health.ts kill   --host <h> --root <dir>
 *     workspace_drive_health.ts reset  --host <h> --root <dir>
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const KILL_STREAK = 5; // consecutive failures that auto-trip the kill-switch (council)
const MAX_AUTO_TRIPS = 3; // flapping guard: after N auto-trips a host goes sticky (ADR-073 v1)
const PROBE_LEASE_SEC = 120; // a probe in flight for < this blocks a concurrent probe
const HOST_RE = /^[a-z][a-z0-9-]*$/;

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** A non-argparse `SystemExit(str)` — prints `str` to stderr, exits 1. */
class SystemExitError extends Error {
    constructor(public readonly message_: string) {
        super(message_);
    }
}

/** `ValueError` raised by `_host_path` on a bad host id (uncaught → exit 1). */
class ValueErr extends Error {}

// --- JSON byte-parity (compact, ensure_ascii=True, sort_keys=True) ----------
//
// `json.dumps(obj, sort_keys=True)` (no indent) → default separators
// `(", ", ": ")`, every non-ASCII code point escaped to `\uXXXX`, keys sorted.

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
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
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    const v = code - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out +=
                        '\\u' +
                        hi.toString(16).padStart(4, '0') +
                        '\\u' +
                        lo.toString(16).padStart(4, '0');
                }
        }
    }
    return out + '"';
}

function _jsonScalarSorted(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpSorted(value: unknown): string {
    const scalar = _jsonScalarSorted(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _dumpSorted(v)).join(', ') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return (
            '{' +
            keys.map((k) => `${_jsonStrAscii(k)}: ${_dumpSorted(obj[k])}`).join(', ') +
            '}'
        );
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(value, sort_keys=True)` (compact, ensure_ascii=True). */
function jsonDumpsSorted(value: unknown): string {
    return _dumpSorted(value);
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

// ---------------------------------------------------------------------------
// Module body (workspace_drive_health.py).
// ---------------------------------------------------------------------------

type State = Record<string, unknown>;

function _now(): number {
    return Date.now() / 1000;
}

/**
 * Auto-recovery cooldown (ADR-073 v1). Env-tunable, global; no code deploy
 * needed to retune. Default 600 s (10 min).
 */
function _cooldownSec(): number {
    const raw = process.env['AGENT_CONFIG_DRIVE_COOLDOWN_SEC'] ?? '600';
    // Mirror Python `int(raw)`: strict base-10 integer parse; any non-integer
    // → ValueError → default 600.
    if (/^[+-]?\d+$/.test(raw.trim())) {
        return Math.max(parseInt(raw.trim(), 10), 0);
    }
    return 600;
}

/**
 * Feature flag / escape hatch (council: mandatory). Default ON; set to
 * 0/false/off to revert to v0 manual-reset-only behaviour.
 */
function _autoRecoveryEnabled(): boolean {
    const v = (process.env['AGENT_CONFIG_DRIVE_AUTO_RECOVERY'] ?? '').trim().toLowerCase();
    return !['0', 'false', 'off', 'no'].includes(v);
}

function _hostPath(root: string, host: string): string {
    if (!HOST_RE.test(host || '')) {
        throw new ValueErr(`invalid host id: ${host}`);
    }
    return path.join(root, `${host}.json`);
}

function _defaultState(host: string): State {
    return {
        host: host,
        consecutive_failures: 0,
        killed: false,
        total_success: 0,
        total_failure: 0,
        last_outcome: null,
        last_error_kind: null,
        // ADR-073 v1 circuit-breaker fields:
        killed_at: null, // epoch when tripped (auto or manual)
        kill_reason: null, // "auto" (cooldown-recoverable) | "manual" (sticky)
        trip_count: 0, // auto-trips so far (flapping guard → sticky at MAX_AUTO_TRIPS)
        probe_started_at: null, // half-open probe-in-flight lease
        last_was_probe: false, // observability: was the last outcome a recovery probe?
    };
}

/** Read a host's health cache. Fails open: any error → default (healthy). */
function _read(root: string, host: string): State {
    let p: string;
    try {
        p = _hostPath(root, host);
    } catch (e) {
        if (e instanceof ValueErr) return _defaultState(host);
        throw e;
    }
    try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
        if (_isPlainObject(data)) {
            const base = _defaultState(host);
            for (const k of Object.keys(base)) {
                if (Object.prototype.hasOwnProperty.call(data, k)) {
                    base[k] = (data as Record<string, unknown>)[k];
                }
            }
            return base;
        }
    } catch {
        // OSError / JSONDecodeError → fall through to default.
    }
    return _defaultState(host);
}

/** `isinstance(data, dict)` — a JSON object, not array / scalar / null. */
function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _write(root: string, host: string, state: State): void {
    const p = _hostPath(root, host);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    // `Path.with_suffix(f".{pid}.tmp")` replaces the LAST suffix
    // (`claude.json` → `claude.<pid>.tmp`).
    const ext = path.extname(p);
    const tmp = (ext ? p.slice(0, p.length - ext.length) : p) + `.${process.pid}.tmp`;
    fs.writeFileSync(tmp, jsonDumpsSorted(state), 'utf-8');
    fs.renameSync(tmp, p); // atomic — a concurrent reader never sees a partial file
}

/**
 * Record one drive outcome. A success closes the circuit (un-kills — safe
 * because a real drive only runs when closed or half-open). A failure trips the
 * auto kill-switch at KILL_STREAK; a *probe* failure re-opens immediately and
 * restarts the cooldown. ``trip_count`` bounds flapping → sticky.
 */
function record(
    root: string,
    host: string,
    ok: boolean,
    errorKind: string | null = null,
    opts: { isProbe?: boolean; now?: number | null } = {},
): State {
    const isProbe = opts.isProbe ?? false;
    const now = opts.now == null ? _now() : opts.now;
    const state = _read(root, host);
    state['probe_started_at'] = null; // any recorded outcome ends the probe lease
    state['last_was_probe'] = isProbe;
    if (ok) {
        state['consecutive_failures'] = 0;
        state['total_success'] = (state['total_success'] as number) + 1;
        state['last_outcome'] = 'ok';
        state['last_error_kind'] = null;
        // Auto-recovery: a successful drive closes the circuit. A manual
        // (sticky) kill is NOT auto-cleared — only `reset` clears it.
        if (state['killed'] && state['kill_reason'] === 'auto') {
            state['killed'] = false;
            state['killed_at'] = null;
            state['kill_reason'] = null;
        }
    } else {
        state['consecutive_failures'] = (state['consecutive_failures'] as number) + 1;
        state['total_failure'] = (state['total_failure'] as number) + 1;
        state['last_outcome'] = 'fail';
        state['last_error_kind'] = errorKind;
        if (isProbe && state['killed']) {
            // half-open probe failed → re-open, restart the cooldown.
            state['killed_at'] = now;
            state['trip_count'] = (state['trip_count'] as number) + 1;
        } else if (
            !state['killed'] &&
            (state['consecutive_failures'] as number) >= KILL_STREAK
        ) {
            state['killed'] = true;
            state['kill_reason'] = 'auto';
            state['killed_at'] = now;
            state['trip_count'] = (state['trip_count'] as number) + 1;
        }
    }
    _write(root, host, state);
    return state;
}

/**
 * Circuit-breaker decision for the launch path → ``closed`` | ``open`` |
 * ``half_open``. A missing cache fails open (``closed``). When it returns
 * ``half_open`` and ``mark_probe`` is set, it stamps the probe-in-flight lease
 * so a concurrent launch sees ``open`` instead of a second simultaneous probe.
 */
function gate(
    root: string,
    host: string,
    opts: { now?: number | null; markProbe?: boolean } = {},
): string {
    const now = opts.now == null ? _now() : opts.now;
    const markProbe = opts.markProbe ?? true;
    const state = _read(root, host);
    if (!state['killed']) {
        return 'closed';
    }
    // Sticky cases → stay open (manual reset only):
    if (
        !_autoRecoveryEnabled() ||
        state['kill_reason'] === 'manual' ||
        (state['trip_count'] as number) >= MAX_AUTO_TRIPS ||
        state['killed_at'] === null
    ) {
        return 'open';
    }
    if (now < (state['killed_at'] as number) + _cooldownSec()) {
        return 'open'; // still cooling
    }
    // Cooled down → half-open, unless a probe is already in flight (lease).
    const started = state['probe_started_at'];
    if (started !== null && started !== undefined && now < (started as number) + PROBE_LEASE_SEC) {
        return 'open';
    }
    if (markProbe) {
        state['probe_started_at'] = now;
        _write(root, host, state);
    }
    return 'half_open';
}

/** Raw kill flag (status read). Missing / unreadable cache → False. */
function isKilled(root: string, host: string): boolean {
    return _read(root, host)['killed'] === true;
}

/** Manual kill — **sticky**: never auto-recovers, only `reset` clears it. */
function kill(root: string, host: string, opts: { now?: number | null } = {}): State {
    const state = _read(root, host);
    state['killed'] = true;
    state['kill_reason'] = 'manual';
    state['killed_at'] = opts.now == null ? _now() : opts.now;
    state['probe_started_at'] = null;
    _write(root, host, state);
    return state;
}

function reset(root: string, host: string): State {
    const state = _read(root, host);
    Object.assign(state, {
        killed: false,
        consecutive_failures: 0,
        killed_at: null,
        kill_reason: null,
        trip_count: 0,
        probe_started_at: null,
    });
    _write(root, host, state);
    return state;
}

function status(root: string, host: string | null = null): State {
    if (host !== null) {
        return _read(root, host);
    }
    const out: Record<string, State> = {};
    if (_isDir(root)) {
        // `sorted(root.glob("*.json"))` — sort by full path string; all entries
        // share the same dir, so this is equivalent to sorting by filename.
        const files = fs
            .readdirSync(root)
            .filter((f) => f.endsWith('.json'))
            .map((f) => path.join(root, f))
            .sort();
        for (const f of files) {
            const h = path.basename(f, '.json'); // `f.stem`
            if (HOST_RE.test(h)) {
                out[h] = _read(root, h);
            }
        }
    }
    return out;
}

/** `root.is_dir()` — guarded, false on any stat error. */
function _isDir(root: string): boolean {
    try {
        return fs.statSync(root).isDirectory();
    } catch {
        return false;
    }
}

function _validateCliRoot(root: string): string {
    const resolved = path.resolve(root); // `Path.resolve()`
    if (path.basename(resolved) !== 'health') {
        throw new SystemExitError(
            `--root must be a workspace/health directory; got '${root}'`,
        );
    }
    return resolved;
}

// ---------------------------------------------------------------------------
// argparse-equivalent CLI.
// ---------------------------------------------------------------------------

const PROG = 'workspace_drive_health';

const USAGE = `usage: ${PROG} [-h] {record,gate,status,kill,reset} ...\n`;
const USAGE_RECORD =
    `usage: ${PROG} record [-h] --host HOST --outcome {ok,fail}\n` +
    `                                     [--error-kind ERROR_KIND] [--is-probe]\n` +
    `                                     --root ROOT\n`;
const USAGE_GATE = `usage: ${PROG} gate [-h] --host HOST --root ROOT\n`;
const USAGE_STATUS = `usage: ${PROG} status [-h] [--host HOST] [--json] --root ROOT\n`;
const USAGE_KILL = `usage: ${PROG} kill [-h] --host HOST --root ROOT\n`;
const USAGE_RESET = `usage: ${PROG} reset [-h] --host HOST --root ROOT\n`;

const SUBCOMMANDS = ['record', 'gate', 'status', 'kill', 'reset'] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

function _subUsage(cmd: Subcommand): string {
    switch (cmd) {
        case 'record':
            return USAGE_RECORD;
        case 'gate':
            return USAGE_GATE;
        case 'status':
            return USAGE_STATUS;
        case 'kill':
            return USAGE_KILL;
        case 'reset':
            return USAGE_RESET;
    }
}

function _argError(usage: string, prog: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${prog}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

interface ParsedArgs {
    cmd: Subcommand;
    host?: string;
    outcome?: string;
    error_kind?: string;
    is_probe: boolean;
    json: boolean;
    root?: string;
}

/**
 * Each subparser's option spec: which `--flags` it accepts, which require a
 * value, which are required, and the order required-args are reported in (the
 * declaration order argparse uses for "the following arguments are required").
 */
interface OptSpec {
    valueFlags: Set<string>; // flags that consume one value
    storeTrue: Set<string>; // store_true flags (no value)
    choices: Record<string, readonly string[]>; // value-flag → allowed choices
    required: string[]; // required flags, in declaration order
}

const SPECS: Record<Subcommand, OptSpec> = {
    record: {
        valueFlags: new Set(['--host', '--outcome', '--error-kind', '--root']),
        storeTrue: new Set(['--is-probe']),
        choices: { '--outcome': ['ok', 'fail'] },
        required: ['--host', '--outcome', '--root'],
    },
    gate: {
        valueFlags: new Set(['--host', '--root']),
        storeTrue: new Set(),
        choices: {},
        required: ['--host', '--root'],
    },
    status: {
        valueFlags: new Set(['--host', '--root']),
        storeTrue: new Set(['--json']),
        choices: {},
        required: ['--root'],
    },
    kill: {
        valueFlags: new Set(['--host', '--root']),
        storeTrue: new Set(),
        choices: {},
        required: ['--host', '--root'],
    },
    reset: {
        valueFlags: new Set(['--host', '--root']),
        storeTrue: new Set(),
        choices: {},
        required: ['--host', '--root'],
    },
};

/** `--flag` → ParsedArgs key. */
const FLAG_KEY: Record<string, keyof ParsedArgs> = {
    '--host': 'host',
    '--outcome': 'outcome',
    '--error-kind': 'error_kind',
    '--root': 'root',
    '--is-probe': 'is_probe',
    '--json': 'json',
};

function _parse(argv: string[]): ParsedArgs {
    let i = 0;
    // Top-level -h/--help before the subcommand.
    if (i < argv.length && (argv[i] === '-h' || argv[i] === '--help')) {
        process.stdout.write(USAGE);
        throw new ArgparseExit(0);
    }
    if (i >= argv.length) {
        _argError(USAGE, PROG, 'the following arguments are required: cmd');
    }
    const cmdRaw = argv[i] as string;
    i += 1;
    if (!(SUBCOMMANDS as readonly string[]).includes(cmdRaw)) {
        _argError(
            USAGE,
            PROG,
            `argument cmd: invalid choice: '${cmdRaw}' (choose from 'record', 'gate', 'status', 'kill', 'reset')`,
        );
    }
    const cmd = cmdRaw as Subcommand;
    const spec = SPECS[cmd];
    const subUsage = _subUsage(cmd);
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = { cmd, is_probe: false, json: false };
    const seen = new Set<string>();
    const positionals: string[] = [];
    // argparse collects leftover args it cannot consume and reports the whole
    // list against the TOP-LEVEL parser as "unrecognized arguments". Order
    // preserved.
    const unrecognized: string[] = [];

    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        // `--flag=value` form.
        let flag = a;
        let inlineValue: string | null = null;
        if (a.startsWith('--') && a.includes('=')) {
            const eq = a.indexOf('=');
            flag = a.slice(0, eq);
            inlineValue = a.slice(eq + 1);
        }
        if (spec.valueFlags.has(flag)) {
            let value: string;
            if (inlineValue !== null) {
                value = inlineValue;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(subUsage, subProg, `argument ${flag}: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            const choices = spec.choices[flag];
            if (choices !== undefined && !choices.includes(value)) {
                const choiceList = choices.map((c) => `'${c}'`).join(', ');
                _argError(
                    subUsage,
                    subProg,
                    `argument ${flag}: invalid choice: '${value}' (choose from ${choiceList})`,
                );
            }
            const key = FLAG_KEY[flag] as keyof ParsedArgs;
            (out as unknown as Record<string, unknown>)[key] = value;
            seen.add(flag);
            i += 1;
            continue;
        }
        if (spec.storeTrue.has(flag) && inlineValue === null) {
            const key = FLAG_KEY[flag] as keyof ParsedArgs;
            (out as unknown as Record<string, unknown>)[key] = true;
            seen.add(flag);
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            unrecognized.push(a);
            i += 1;
            continue;
        }
        positionals.push(a);
        i += 1;
    }

    // Required-arg check (declaration order) takes precedence over the
    // top-level unrecognized-args report — argparse reports missing required
    // sub-args first.
    const missing = spec.required.filter((f) => !seen.has(f));
    if (missing.length > 0) {
        _argError(
            subUsage,
            subProg,
            `the following arguments are required: ${missing.join(', ')}`,
        );
    }
    // Leftover positionals / unknown flags → top-level "unrecognized arguments".
    const extra = [...positionals, ...unrecognized];
    if (extra.length > 0) {
        _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
    }
    return out;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    const root = _validateCliRoot(args.root as string);

    if (args.cmd === 'record') {
        const state = record(root, args.host as string, args.outcome === 'ok', args.error_kind ?? null, {
            isProbe: args.is_probe,
        });
        print(jsonDumpsSorted(state));
        return 0;
    }
    if (args.cmd === 'gate') {
        print(gate(root, args.host as string));
        return 0;
    }
    if (args.cmd === 'status') {
        const result = status(root, args.host ?? null);
        if (args.json || args.host === undefined) {
            print(jsonDumpsSorted(result));
        } else {
            print(
                `${args.host}: killed=${pyBool(result['killed'])} ` +
                    `streak=${result['consecutive_failures']} ` +
                    `ok=${result['total_success']} fail=${result['total_failure']}`,
            );
        }
        return 0;
    }
    if (args.cmd === 'kill') {
        print(jsonDumpsSorted(kill(root, args.host as string)));
        return 0;
    }
    if (args.cmd === 'reset') {
        print(jsonDumpsSorted(reset(root, args.host as string)));
        return 0;
    }
    return 2;
}

/** Python `str(bool)` → `True` / `False` (the `status` text-format render). */
function pyBool(v: unknown): string {
    return v ? 'True' : 'False';
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else if (e instanceof SystemExitError) {
            // `raise SystemExit(str)` → message to stderr, exit 1.
            process.stderr.write(e.message_ + '\n');
            process.exitCode = 1;
        } else {
            // ValueErr from a bad host id (record/gate/kill/reset) propagates
            // uncaught — Python prints a traceback and exits 1.
            throw e;
        }
    }
}

export {
    ArgparseExit,
    jsonDumpsSorted,
    record,
    gate,
    isKilled,
    kill,
    reset,
    status,
};
