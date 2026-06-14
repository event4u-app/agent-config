/**
 * Shared plumbing for chat-history hooks.
 *
 * TypeScript twin of `work_engine/hooks/builtin/_chat_history_base.py`
 * (ADR-096 py2ts — work_engine.hooks.builtin subpackage). Subprocess-driven
 * so the work-engine package stays decoupled from `scripts/chat_history.py`'s
 * internals. The `runner` injection point is the test seam — production passes
 * the default runner, tests pass a fake.
 */
import { spawnSync } from 'node:child_process';
import * as process from 'node:process';

/**
 * Subset of Python's `subprocess.CompletedProcess[str]` the hooks read:
 * the return code plus the captured streams.
 */
export interface CompletedProcess {
    returncode: number;
    stdout: string;
    stderr: string;
}

/** Callable that runs a subprocess. Production default: {@link _default_runner}. */
export type ProcessRunner = (cmd: string[]) => CompletedProcess;

export const EXIT_OK = 0;
export const EXIT_MISSING = 10;
export const EXIT_FOREIGN = 11;
export const EXIT_RETURNING = 12;

export function _default_runner(cmd: string[]): CompletedProcess {
    const [program, ...args] = cmd;
    const proc = spawnSync(program as string, args, {
        encoding: 'utf8',
    });
    return {
        // `null` status (signal/spawn failure) maps to a non-OK code.
        returncode: proc.status === null ? -1 : proc.status,
        stdout: proc.stdout ?? '',
        stderr: proc.stderr ?? '',
    };
}

/**
 * Shared plumbing — script path and runner.
 *
 * Schema v4 derives session attribution from the platform `session_id`,
 * not from a derived first-user-msg. work-engine internal hooks have no
 * platform session in scope, so they omit `--session-id` and entries land
 * in the `<unknown>` session bucket.
 */
export class _ChatHistoryHookBase {
    readonly script_path: string;
    private readonly _runner: ProcessRunner;

    constructor(script_path: string, options: { runner?: ProcessRunner | null } = {}) {
        this.script_path = script_path;
        this._runner = options.runner ?? _default_runner;
    }

    protected _invoke(...args: string[]): CompletedProcess {
        // `sys.executable` → the active interpreter; here `python3`.
        const cmd = ['python3', this.script_path, ...args];
        void process; // imported for parity with Python's `sys` usage.
        return this._runner(cmd);
    }
}

/** Python `getattr(obj, name, default)` for a duck-typed object. */
export function _getattr(obj: unknown, name: string, dflt: unknown): unknown {
    if (obj !== null && typeof obj === 'object' && name in (obj as object)) {
        return (obj as Record<string, unknown>)[name];
    }
    return dflt;
}

/**
 * Python `json.dumps(obj)` with default separators (`", "`, `": "`) and
 * `ensure_ascii=True`. Covers the simple `{"step": str}` /
 * `{"step": str, "questions": [str, …]}` payloads the chat-history hooks
 * build: strings, numbers, booleans, null, arrays, and plain objects in
 * insertion order.
 */
export function _pyJsonDumps(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyJsonDumps(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const items = Object.keys(obj).map((k) => `${_jsonStrAscii(k)}: ${_pyJsonDumps(obj[k])}`);
        return `{${items.join(', ')}}`;
    }
    return _jsonStrAscii(String(value));
}

/** Python `json.dumps(s, ensure_ascii=True)` for a single string. */
function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return `${out}"`;
}
