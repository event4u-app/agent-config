/**
 * `ChatHistoryHaltAppendHook` — capture halt surfaces in the log.
 *
 * TypeScript twin of `work_engine/hooks/builtin/chat_history_halt_append.py`
 * (ADR-094 py2ts — work_engine.hooks.builtin subpackage). Fires on `on_halt`.
 * Records a `--type decision` entry with the step name and any pending
 * questions so a fresh chat can resume from the persisted log alone.
 */
import { HookContext } from '../context.js';
import { HookEvent } from '../events.js';
import { HookError } from '../exceptions.js';
import { HookRegistry } from '../registry.js';
import { EXIT_OK, _ChatHistoryHookBase, _getattr, _pyJsonDumps } from './_chat_history_base.js';

/** Arbitrary value, mirroring the Python `Any` payload values. */
type Any = unknown;

/** Append a decision entry whenever a step halts. */
export class ChatHistoryHaltAppendHook extends _ChatHistoryHookBase {
    register(registry: HookRegistry): void {
        registry.register(HookEvent.ON_HALT, (ctx) => this._on_halt(ctx));
    }

    private _on_halt(ctx: HookContext): void {
        let questions: string[] = [];
        if (ctx.result !== null && ctx.result !== undefined) {
            questions = _pyList(_pyOr(_getattr(ctx.result, 'questions', []), []));
        }
        if (questions.length === 0 && ctx.delivery !== null && ctx.delivery !== undefined) {
            questions = _pyList(_pyOr(_getattr(ctx.delivery, 'questions', []), []));
        }
        const payload: Record<string, Any> = {
            step: ctx.step_name || '<unknown>',
            questions,
        };
        const proc = this._invoke('append', '--type', 'decision', '--json', _pyJsonDumps(payload));
        if (proc.returncode !== EXIT_OK) {
            throw new HookError(`chat-history halt-append failed (exit ${proc.returncode})`);
        }
    }
}

/** Python `a or b`. */
function _pyOr(a: Any, b: Any): Any {
    return _pyTruthy(a) ? a : b;
}

/** Python `list(x)` for the iterable shapes `questions` can be. */
function _pyList(x: Any): string[] {
    if (x === null || x === undefined) {
        return [];
    }
    if (Array.isArray(x)) {
        return [...x] as string[];
    }
    if (typeof x === 'string') {
        return [...x];
    }
    if (typeof (x as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
        return [...(x as Iterable<string>)];
    }
    return [];
}

/** Python `bool(x)` truthiness for the list / falsy shapes seen here. */
function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (value instanceof Map || value instanceof Set) {
        return value.size > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
}
