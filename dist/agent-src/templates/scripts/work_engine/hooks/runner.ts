/**
 * `HookRunner` — single emit point for hook callbacks.
 *
 * TypeScript twin of `work_engine/hooks/runner.py` (ADR-096 py2ts —
 * work_engine.hooks subpackage). Implements the three-tier error contract
 * documented in `exceptions.ts`:
 *
 * - `HookError` from a callback → caught, a warning is emitted, the runner
 *   continues with the next callback for the same event. Returns `null`
 *   once the event is fully drained.
 * - `HookHalt` from a callback → caught, **returned** to the caller with
 *   no further callbacks invoked for this event. The caller decides how to
 *   surface the halt. Never re-raised through the dispatch loop.
 * - any other `Error` → propagates unchanged. Treated as a hook bug;
 *   dispatch unwinds.
 *
 * Python parity note (intentional, documented): the original emits the
 * non-fatal warning via `warnings.warn`, whose surface format
 * (`<file>:<line>: UserWarning: …`) and per-location de-duplication are
 * interpreter-internal and not portable. This twin emits the same message
 * to `process.stderr` through the `warn` seam. The observable contract —
 * the HookError is swallowed and dispatch continues — is preserved; the
 * exact stderr warning text is normalised in the golden harness.
 */
import { HookContext } from './context.js';
import { HookEvent } from './events.js';
import { HookError, HookHalt } from './exceptions.js';
import { HookRegistry } from './registry.js';

/**
 * Emit hook events through a {@link HookRegistry}.
 *
 * Construct once per CLI invocation, share between the CLI and the
 * dispatcher. `emit` is the only public method on the hot path.
 */
export class HookRunner {
    private _registry: HookRegistry;

    constructor(registry: HookRegistry | null = null) {
        this._registry = registry !== null ? registry : new HookRegistry();
    }

    /**
     * Return the underlying registry.
     *
     * Exposed so callers can register additional hooks after construction
     * (e.g. in tests). Not used on the hot path.
     */
    get registry(): HookRegistry {
        return this._registry;
    }

    /**
     * Fire all callbacks registered for `event`.
     *
     * Returns `null` when every callback completed (with or without a
     * swallowed {@link HookError}). Returns the first {@link HookHalt}
     * raised, after which no further callbacks are invoked for this event.
     * Any other error propagates.
     */
    emit(event: HookEvent, ctx: HookContext): HookHalt | null {
        const callbacks = this._registry.for_event(event);
        if (callbacks.length === 0) {
            return null;
        }
        for (const callback of callbacks) {
            try {
                callback(ctx);
            } catch (exc) {
                if (exc instanceof HookHalt) {
                    return exc;
                }
                if (exc instanceof HookError) {
                    this.warn(`hook ${event} raised HookError: ${exc.message}`);
                    continue;
                }
                throw exc;
            }
        }
        return null;
    }

    /**
     * Emit a non-fatal hook warning. Test seam — overridable. Mirrors the
     * role of `warnings.warn` in the Python original.
     */
    protected warn(message: string): void {
        process.stderr.write(`${message}\n`);
    }
}
