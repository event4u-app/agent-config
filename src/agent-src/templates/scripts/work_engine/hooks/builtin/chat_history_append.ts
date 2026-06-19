/**
 * `ChatHistoryAppendHook` — phase-boundary persistence.
 *
 * TypeScript twin of `work_engine/hooks/builtin/chat_history_append.py`
 * (ADR-200 py2ts — work_engine.hooks.builtin subpackage). Fires on
 * `after_step`. Appends a `--type phase` entry whenever a step closed with
 * `Outcome.SUCCESS`. Failures bubble up as {@link HookError} so the runner
 * converts them to warnings — append errors must not break the main flow.
 */
import { Outcome } from '../../delivery_state.js';
import type { HookContext } from '../context.js';
import { HookEvent } from '../events.js';
import { HookError } from '../exceptions.js';
import type { HookRegistry } from '../registry.js';
import { EXIT_OK, _ChatHistoryHookBase, _getattr, _pyJsonDumps } from './_chat_history_base.js';

/** Arbitrary value, mirroring the Python `Any` payload values. */
type Any = unknown;

/** Append a phase-boundary entry after every successful step. */
export class ChatHistoryAppendHook extends _ChatHistoryHookBase {
    register(registry: HookRegistry): void {
        registry.register(HookEvent.AFTER_STEP, (ctx) => this._on_after_step(ctx));
    }

    private _on_after_step(ctx: HookContext): void {
        const result = ctx.result;
        if (
            result === null ||
            result === undefined ||
            _getattr(result, 'outcome', null) !== Outcome.SUCCESS
        ) {
            return;
        }
        const payload: Record<string, Any> = { step: ctx.step_name || '<unknown>' };
        const proc = this._invoke('append', '--type', 'phase', '--json', _pyJsonDumps(payload));
        if (proc.returncode !== EXIT_OK) {
            throw new HookError(`chat-history append failed (exit ${proc.returncode})`);
        }
    }
}
