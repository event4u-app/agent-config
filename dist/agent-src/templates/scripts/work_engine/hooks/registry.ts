/**
 * `HookRegistry` — insertion-ordered map from event to callbacks.
 *
 * TypeScript twin of `work_engine/hooks/registry.py` (ADR-096 py2ts —
 * work_engine.hooks subpackage). Phase 1 ships insertion-ordered
 * registration only.
 *
 * The registry is a plain container. It does not invoke callbacks, does
 * not catch exceptions, and does not know about the error contract; that
 * responsibility lives in {@link HookRunner}.
 */
import { HookContext } from './context.js';
import { HookEvent } from './events.js';

/**
 * A hook callback. Returns `void` on success, throws `HookError` or
 * `HookHalt` to signal control flow per `exceptions.ts`.
 */
export type HookCallback = (ctx: HookContext) => void;

/**
 * Insertion-ordered registry of hook callbacks per event.
 *
 * Single instance per CLI invocation. Built once and shared with
 * `dispatch()` so dispatcher events and CLI events are routed through the
 * same callback set.
 */
export class HookRegistry {
    // Map preserves insertion order, mirroring Python's dict ordering.
    private _hooks: Map<HookEvent, HookCallback[]> = new Map();

    /**
     * Register `callback` for `event`.
     *
     * Multiple callbacks for the same event are allowed; they fire in
     * registration order.
     */
    register(event: HookEvent, callback: HookCallback): void {
        let list = this._hooks.get(event);
        if (list === undefined) {
            list = [];
            this._hooks.set(event, list);
        }
        list.push(callback);
    }

    /**
     * Return callbacks registered for `event` in insertion order.
     *
     * Returns an empty array when no callbacks are registered — the runner
     * uses this to short-circuit a no-op fast path.
     */
    for_event(event: HookEvent): HookCallback[] {
        const list = this._hooks.get(event);
        return list === undefined ? [] : [...list];
    }

    /**
     * Iterate over events that have at least one callback.
     *
     * Diagnostics-only; not used on the hot path.
     */
    events(): IterableIterator<HookEvent> {
        return this._hooks.keys();
    }
}
