/**
 * Shared plumbing for chat-history hooks.
 *
 * TypeScript twin of `work_engine/hooks/builtin/_chat_history_base.py`
 * (ADR-200 py2ts — work_engine.hooks.builtin subpackage). Subprocess-driven
 * so the work-engine package stays decoupled from `scripts/chat_history.py`'s
 * internals. The `runner` injection point is the test seam — production passes
 * the default runner, tests pass a fake.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
    const proc: SpawnSyncReturns<string> = spawnSync(program as string, args, {
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
 * Resolve the invocation for the chat-history script as a TypeScript twin.
 *
 * The chat-history script ships as a `.ts` file run through `tsx` — no
 * python3 dependency. A `.py` `script_path` (the historical default /
 * config value) is mapped to its `.ts` sibling. The `tsx` binary is found
 * by walking up from the script's directory to a `node_modules/.bin/tsx`,
 * falling back to `npx tsx`. Mirrors `dispatch_hook.ts::_resolve_tsx_invocation`
 * and `run.ts::resolveTsxInvocation`.
 */
export function _resolve_chat_history_invocation(script_path: string): string[] {
    const tsScript = script_path.replace(/\.py$/, '.ts');
    const binName = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
    let dir = path.dirname(path.resolve(tsScript));
    for (;;) {
        const candidate = path.join(dir, 'node_modules', '.bin', binName);
        try {
            if (fs.statSync(candidate).isFile()) {
                return [candidate, tsScript];
            }
        } catch {
            // not here — keep walking up.
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return ['npx', 'tsx', tsScript];
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
        // Run the chat-history `.ts` script through `tsx` — no python3
        // dependency. `script_path` (a `.py` default / config value) maps to
        // its `.ts` sibling, prefixed by the resolved `tsx` binary.
        const cmd = [..._resolve_chat_history_invocation(this.script_path), ...args];
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
