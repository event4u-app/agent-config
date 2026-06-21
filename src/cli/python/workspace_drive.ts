#!/usr/bin/env -S node --import tsx
/**
 * Tier-1 host drive loop — TypeScript twin of `src/cli/python/workspace_drive.py`
 * (ADR-200, py2ts Phase 1). Byte-for-byte behavioral mirror of the Python
 * original: same `drive(host, prompt, …)` adapter, same per-host envelope
 * parsers, same error taxonomy + error-turn shape, and the same
 * `drive --host <id> --prompt-file <f|-> [--cwd <d>] [--timeout <s>]
 * [--resume-session-id <id>] [--json]` CLI (exit 0 ok / 1 failed drive /
 * 2 argparse usage).
 *
 * A Tier-1 host (Claude Code / Codex / Gemini — ADR-023, host-agent-protocol)
 * is CLI-drivable: spawn `claude -p "<prompt>" --output-format json`, parse the
 * JSON envelope, and record the turn. This module is the executor
 * `detectHostTier` (ADR-068) reported as `tier1-drive-pending`. The rendered
 * prompt comes from `workspace_render.py` (ADR-069); the caller appends the
 * returned turn to the session store via `workspace_sessions.py append
 * --kind host.turn`.
 *
 * Design (AI-council 2026-06-08, claude-sonnet-4-5 + gpt-4o, design mode):
 *
 * - **Single-turn v0.** One prompt → one host call → one turn record. Tool
 *   calls in the envelope are recorded as opaque JSON, never executed.
 * - **Explicit envelope contract per host.** A missing required key (or
 *   `is_error: true`) fails closed.
 * - **Unified adapter.** One `drive(host, prompt, …)` with a per-host config.
 * - **Sync, bounded.** Default 90 s timeout. CLI-missing / non-zero-exit /
 *   timeout / unrecognised-envelope all return an `ok=false` error turn.
 * - **`runner` injectable** so tests never spawn a real host CLI.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `subprocess.run(..., timeout=)` → `spawnSync(...)`; a `spawnSync` error
 *   with `code === 'ETIMEDOUT'` (or a set `r.signal`) maps to the Python
 *   `TimeoutExpired` → `timeout`; `ENOENT` → `FileNotFoundError` →
 *   `cli-missing`; any other spawn error → `OSError` → `spawn-failed`.
 * - `json.dumps(turn, sort_keys=True)` → `_jsonDumpsSorted` (compact, sorted
 *   keys, `ensure_ascii=True`).
 * - `main()` returns an exit code; the entry guard sets `process.exitCode`
 *   (never `process.exit()`). argparse usage errors throw `ArgparseExit(2)`.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

export const DEFAULT_TIMEOUT = 90; // seconds (AI-council 2026-06-08)

/** argparse usage exit (code 2). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** The host CLI returned output that does not match its declared contract. */
export class EnvelopeError extends Error {}

type Turn = Record<string, unknown>;

/** Injectable runner — `[returncode, stdout, stderr]`. */
export type Runner = (
    args: string[],
    cwd: string | null,
    timeout: number,
) => [number, string, string];

interface HostConfig {
    build_args: (prompt: string, cwd: string | null) => string[];
    build_resume_args: (sid: string, prompt: string, cwd: string | null) => string[];
    supports_resume: boolean;
    parse: (stdout: string) => Turn;
}

// --- per-host envelope parsers (stdout → uniform turn) ----------------------
// Each parser owns its host's full stdout shape: a single JSON object
// (claude / gemini) or a newline-delimited event stream (codex). Required keys
// are validated; a missing one raises EnvelopeError → fail-closed.

function _turn(opts: {
    text: unknown;
    model?: unknown;
    usage?: unknown;
    session_id?: unknown;
    cost_usd?: unknown;
    num_turns?: unknown;
    tool_calls?: unknown;
}): Turn {
    return {
        text: opts.text,
        model: opts.model ?? null,
        usage: opts.usage ?? null,
        session_id: opts.session_id ?? null,
        cost_usd: opts.cost_usd ?? null,
        num_turns: opts.num_turns ?? null,
        tool_calls: Array.isArray(opts.tool_calls) ? opts.tool_calls : [],
    };
}

/** Python `dict.get(k)` semantics on a parsed-JSON value. */
function _get(obj: unknown, key: string): unknown {
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
        return (obj as Record<string, unknown>)[key];
    }
    return undefined;
}

function _isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Python `int(x or 0)` for a JSON scalar. */
function _intOrZero(v: unknown): number {
    return Math.trunc(Number(v) || 0);
}

/**
 * `claude -p --output-format json` → single JSON envelope.
 * Required: `result` (assistant text). Truthy `is_error` fails closed.
 */
function _parse_claude(stdout: string): Turn {
    const env = JSON.parse(stdout);
    if (!_isObject(env)) {
        throw new EnvelopeError('envelope is not a JSON object');
    }
    if (_get(env, 'is_error') === true) {
        throw new EnvelopeError(
            `host reported is_error: ${String(_get(env, 'result') ?? '').slice(0, 200)}`,
        );
    }
    if (typeof _get(env, 'result') !== 'string') {
        throw new EnvelopeError('missing required key: result');
    }
    const usageRaw = _get(env, 'usage');
    const usage = _isObject(usageRaw) ? usageRaw : null;
    return _turn({
        text: _get(env, 'result'),
        model: _get(env, 'model'),
        usage,
        session_id: _get(env, 'session_id'),
        cost_usd: _get(env, 'total_cost_usd'),
        num_turns: _get(env, 'num_turns'),
        tool_calls: _get(env, 'tool_calls'),
    });
}

/**
 * `codex exec --json` → newline-delimited JSON event stream. The final
 * assistant text is the last `item.completed` event's `item.content[].text`;
 * token usage comes from `turn.completed`; `session.created` carries the
 * session id. Unknown events are skipped. Required: at least one item with text.
 */
function _parse_codex(stdout: string): Turn {
    let text = '';
    let usage: Record<string, number> | null = null;
    let session_id: string | null = null;
    const tool_calls: unknown[] = [];
    for (const rawLine of stdout.split('\n')) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        let event: unknown;
        try {
            event = JSON.parse(line);
        } catch {
            continue;
        }
        if (!_isObject(event)) {
            continue;
        }
        const etype = _get(event, 'type');
        if (etype === 'item.completed') {
            const item = _get(event, 'item') ?? {};
            if (_isObject(item)) {
                const content = _get(item, 'content') ?? [];
                if (Array.isArray(content)) {
                    const chunks: string[] = [];
                    for (const e of content) {
                        if (_isObject(e) && _get(e, 'text')) {
                            chunks.push(String(_get(e, 'text')));
                        }
                    }
                    if (chunks.length) {
                        text = chunks.join('\n').trim();
                    }
                }
                // Tool items are recorded opaquely (never executed).
                const itype = _get(item, 'type');
                if (itype === 'tool_call' || itype === 'function_call' || itype === 'command') {
                    tool_calls.push(item);
                }
            }
        } else if (etype === 'turn.completed') {
            const u = _get(event, 'usage') ?? {};
            if (_isObject(u)) {
                usage = {
                    input_tokens: _intOrZero(_get(u, 'input_tokens')),
                    output_tokens: _intOrZero(_get(u, 'output_tokens')),
                };
            }
        } else if (etype === 'session.created' && _get(event, 'session_id')) {
            session_id = String(_get(event, 'session_id'));
        }
    }
    if (text === '') {
        throw new EnvelopeError('no item.completed text in codex event stream');
    }
    return _turn({ text, usage, session_id, tool_calls });
}

/**
 * `gemini -p … --output-format json` → single JSON envelope.
 * Required: `response` (assistant text). Token usage is nested under
 * `stats.models.<model>.tokens` (model name is dynamic); take the first
 * model entry best-effort. `session_id` is top-level.
 */
function _parse_gemini(stdout: string): Turn {
    const env = JSON.parse(stdout);
    if (!_isObject(env)) {
        throw new EnvelopeError('envelope is not a JSON object');
    }
    if (typeof _get(env, 'response') !== 'string') {
        throw new EnvelopeError('missing required key: response');
    }
    let model: string | null = null;
    let usage: Record<string, number> | null = null;
    const stats = _get(env, 'stats');
    const models = _isObject(stats) ? _get(stats, 'models') : undefined;
    if (_isObject(stats) && _isObject(models) && Object.keys(models).length > 0) {
        model = Object.keys(models)[0] as string;
        const modelEntry = (models as Record<string, unknown>)[model];
        const tokens = _isObject(modelEntry) ? _get(modelEntry, 'tokens') : undefined;
        if (_isObject(tokens)) {
            const promptTok = _get(tokens, 'prompt');
            const inTok = _intOrZero(promptTok !== undefined ? promptTok : _get(tokens, 'input'));
            const total = _intOrZero(_get(tokens, 'total'));
            usage = { input_tokens: inTok, output_tokens: Math.max(total - inTok, 0) };
        }
    }
    return _turn({
        text: _get(env, 'response'),
        model,
        usage,
        session_id: _get(env, 'session_id'),
    });
}

export const HOST_CONFIGS: Record<string, HostConfig> = {
    // All three Tier-1 hosts (ADR-023). Each owns its CLI flags + envelope
    // parser; the unified drive() never changes. `build_resume_args` continues
    // a prior session by its host session id (ADR-076); all three expose a
    // documented non-interactive resume, so `supports_resume` is true for each.
    'claude-code': {
        build_args: (prompt) => ['claude', '-p', prompt, '--output-format', 'json'],
        build_resume_args: (sid, prompt) => [
            'claude',
            '--resume',
            sid,
            '-p',
            prompt,
            '--output-format',
            'json',
        ],
        supports_resume: true,
        parse: _parse_claude,
    },
    codex: {
        build_args: (prompt) => ['codex', 'exec', '--json', prompt],
        build_resume_args: (sid, prompt) => ['codex', 'exec', 'resume', sid, '--json', prompt],
        supports_resume: true,
        parse: _parse_codex,
    },
    gemini: {
        build_args: (prompt) => ['gemini', '-p', prompt, '--output-format', 'json'],
        build_resume_args: (sid, prompt) => [
            'gemini',
            '--resume',
            sid,
            '-p',
            prompt,
            '--output-format',
            'json',
        ],
        supports_resume: true,
        parse: _parse_gemini,
    },
};

/** Default runner: spawn the host CLI. Injectable so tests stay hermetic. */
function _subprocess_runner(
    args: string[],
    cwd: string | null,
    timeout: number,
): [number, string, string] {
    const r = spawnSync(args[0] as string, args.slice(1), {
        cwd: cwd ?? undefined,
        encoding: 'utf8',
        timeout: timeout * 1000,
    });
    if (r.error) {
        // Re-throw with the original error so drive() maps it to a kind.
        throw r.error;
    }
    return [r.status ?? 0, r.stdout ?? '', r.stderr ?? ''];
}

function _error_turn(host: string, message: string, kind: string): Turn {
    return { ok: false, host, error: message, error_kind: kind };
}

// Verified host "resume session not found / expired" stderr signatures
// (ADR-080, probed 2026-06-09). Substring, case-insensitive.
export const SESSION_EXPIRED_SIGNATURES = [
    'no conversation found with session',
    'invalid session identifier',
    'no rollout found for thread',
    'thread/resume failed',
    'session not found',
];

function _is_session_expired(stderr: string | null): boolean {
    const s = (stderr ?? '').toLowerCase();
    return SESSION_EXPIRED_SIGNATURES.some((sig) => s.includes(sig));
}

interface DriveOptions {
    cwd?: string | null;
    timeout?: number;
    resume_session_id?: string | null;
    runner?: Runner | null;
}

/**
 * Drive one Tier-1 host turn → a uniform turn record. Returns
 * `{ok: true, host, text, model, usage, session_id, cost_usd, num_turns,
 * tool_calls}` on success, or `{ok: false, host, error, error_kind}` on any
 * failure. Never throws for an operational failure.
 */
export function drive(host: string, prompt: string, opts: DriveOptions = {}): Turn {
    const cwd = opts.cwd ?? null;
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const resume_session_id = opts.resume_session_id ?? null;

    const cfg = HOST_CONFIGS[host];
    if (cfg === undefined) {
        return _error_turn(host, `host is not a drivable Tier-1 host in v0: ${host}`, 'unsupported-host');
    }
    if (typeof prompt !== 'string' || prompt.trim() === '') {
        return _error_turn(host, 'prompt is empty', 'empty-prompt');
    }

    let args: string[];
    if (resume_session_id !== null) {
        if (!cfg.supports_resume) {
            return _error_turn(host, `host ${host} does not support resume`, 'resume-unsupported');
        }
        args = cfg.build_resume_args(resume_session_id, prompt, cwd);
    } else {
        args = cfg.build_args(prompt, cwd);
    }
    const run: Runner = opts.runner ?? _subprocess_runner;
    let rc: number;
    let stdout: string;
    let stderr: string;
    try {
        [rc, stdout, stderr] = run(args, cwd, timeout);
    } catch (err) {
        const e = err as NodeJS.ErrnoException & { signal?: string };
        if (e.code === 'ETIMEDOUT' || (e.signal !== undefined && e.signal !== null)) {
            return _error_turn(host, `host CLI timed out after ${timeout}s`, 'timeout');
        }
        if (e.code === 'ENOENT') {
            return _error_turn(host, `host CLI not found: ${args[0]}`, 'cli-missing');
        }
        return _error_turn(host, `host CLI spawn failed: ${String(e.message ?? e)}`, 'spawn-failed');
    }

    // On a resume, a host whose session has expired / is unknown reports it on
    // stderr (ADR-080) → distinct `session-expired`. Only on the resume path.
    if (resume_session_id !== null && _is_session_expired(stderr)) {
        return _error_turn(
            host,
            `host session expired: ${(stderr ?? '').trim().slice(0, 200)}`,
            'session-expired',
        );
    }

    if (rc !== 0) {
        return _error_turn(
            host,
            `host CLI exited ${rc}: ${(stderr ?? '').trim().slice(0, 200)}`,
            'nonzero-exit',
        );
    }

    let turn: Turn;
    try {
        turn = cfg.parse(stdout);
    } catch (err) {
        if (err instanceof EnvelopeError || err instanceof SyntaxError) {
            return _error_turn(host, `unrecognised envelope: ${(err as Error).message}`, 'bad-envelope');
        }
        throw err;
    }

    turn['ok'] = true;
    turn['host'] = host;
    return turn;
}

// --- JSON byte-parity: json.dumps(..., sort_keys=True) (ensure_ascii=True) ---

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

/** `json.dumps(value, sort_keys=True)` — compact, sorted keys, ensure_ascii. */
function _jsonDumpsSorted(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _jsonDumpsSorted(v)).join(', ') + ']';
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        const items = keys.map((k) => `${_jsonStrAscii(k)}: ${_jsonDumpsSorted(obj[k])}`);
        return '{' + items.join(', ') + '}';
    }
    return _jsonStrAscii(String(value));
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

function eprint(line = ''): void {
    process.stderr.write(line + '\n');
}

// argparse usage strings (COLUMNS=80 wrapping, matching the Python output).
const _TOP_USAGE = 'usage: workspace_drive [-h] {drive} ...';
const _DRIVE_USAGE =
    'usage: workspace_drive drive [-h] --host HOST --prompt-file PROMPT_FILE\n' +
    '                             [--cwd CWD] [--timeout TIMEOUT]\n' +
    '                             [--resume-session-id RESUME_SESSION_ID] [--json]';

/** argparse top-level error: usage + `prog: error: <msg>` to stderr, exit 2. */
function _topError(msg: string): never {
    eprint(_TOP_USAGE);
    eprint(`workspace_drive: error: ${msg}`);
    throw new ArgparseExit(2);
}

/** argparse `drive` subparser error. */
function _driveError(msg: string): never {
    eprint(_DRIVE_USAGE);
    eprint(`workspace_drive drive: error: ${msg}`);
    throw new ArgparseExit(2);
}

interface DriveArgs {
    host?: string;
    prompt_file?: string;
    cwd?: string;
    timeout: number;
    resume_session_id?: string;
    json: boolean;
}

/** Mirror argparse for the `drive` subparser (value flags + store_true). */
function _parseDriveArgs(rest: string[]): DriveArgs {
    const out: DriveArgs = { timeout: DEFAULT_TIMEOUT, json: false };
    const valueFlags: Record<string, keyof DriveArgs> = {
        '--host': 'host',
        '--prompt-file': 'prompt_file',
        '--cwd': 'cwd',
        '--timeout': 'timeout',
        '--resume-session-id': 'resume_session_id',
    };
    let i = 0;
    while (i < rest.length) {
        const tok = rest[i] as string;
        if (tok === '-h' || tok === '--help') {
            print(_DRIVE_USAGE);
            throw new ArgparseExit(0);
        }
        if (tok === '--json') {
            out.json = true;
            i += 1;
            continue;
        }
        // Support both `--flag value` and `--flag=value`.
        let flag = tok;
        let inlineVal: string | undefined;
        const eq = tok.indexOf('=');
        if (tok.startsWith('--') && eq !== -1) {
            flag = tok.slice(0, eq);
            inlineVal = tok.slice(eq + 1);
        }
        const dest = valueFlags[flag];
        if (dest === undefined) {
            _driveError(`unrecognized arguments: ${tok}`);
        }
        let val: string;
        if (inlineVal !== undefined) {
            val = inlineVal;
            i += 1;
        } else {
            if (i + 1 >= rest.length) {
                _driveError(`argument ${flag}: expected one argument`);
            }
            val = rest[i + 1] as string;
            i += 2;
        }
        if (dest === 'timeout') {
            const n = Number(val);
            if (!Number.isInteger(n)) {
                _driveError(`argument --timeout: invalid int value: '${val}'`);
            }
            out.timeout = n;
        } else if (dest === 'host') {
            out.host = val;
        } else if (dest === 'prompt_file') {
            out.prompt_file = val;
        } else if (dest === 'cwd') {
            out.cwd = val;
        } else if (dest === 'resume_session_id') {
            out.resume_session_id = val;
        }
    }
    const missing: string[] = [];
    if (out.host === undefined) missing.push('--host');
    if (out.prompt_file === undefined) missing.push('--prompt-file');
    if (missing.length) {
        _driveError(`the following arguments are required: ${missing.join(', ')}`);
    }
    return out;
}

export function main(argv?: string[] | null): number {
    const args = argv ?? process.argv.slice(2);
    // Top-level: required subcommand `cmd` ∈ {drive}.
    if (args.length === 0) {
        _topError('the following arguments are required: cmd');
    }
    const first = args[0] as string;
    if (first === '-h' || first === '--help') {
        print(_TOP_USAGE);
        throw new ArgparseExit(0);
    }
    if (first !== 'drive') {
        _topError(`argument cmd: invalid choice: '${first}' (choose from 'drive')`);
    }

    const parsed = _parseDriveArgs(args.slice(1));
    const promptFile = parsed.prompt_file as string;
    const prompt =
        promptFile === '-'
            ? fs.readFileSync(0, 'utf-8')
            : fs.readFileSync(promptFile, { encoding: 'utf-8' });
    const turn = drive(parsed.host as string, prompt, {
        cwd: parsed.cwd ?? null,
        timeout: parsed.timeout,
        resume_session_id: parsed.resume_session_id ?? null,
    });
    if (parsed.json) {
        print(_jsonDumpsSorted(turn));
    } else if (turn['ok']) {
        process.stdout.write(turn['text'] as string);
    } else {
        eprint(`${turn['error_kind']}: ${turn['error']}`);
    }
    // Exit 1 on a failed drive so the Node caller degrades to the inbox.
    return turn['ok'] ? 0 : 1;
}

const _isMain =
    typeof process.argv[1] === 'string' &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_isMain) {
    try {
        process.exitCode = main();
    } catch (err) {
        if (err instanceof ArgparseExit) {
            process.exitCode = err.code;
        } else {
            throw err;
        }
    }
}
