/**
 * Hook control-flow signals.
 *
 * TypeScript twin of `work_engine/hooks/exceptions.py` (ADR-094 py2ts —
 * work_engine.hooks subpackage). Class names stay 1:1 with the Python module.
 *
 * Three-tier error contract (locked by roadmap P1):
 *
 * - `HookError` — non-fatal. Hook implementation failed; the runner
 *   catches it, warns, and continues with the next callback for the same
 *   event. Work proceeds.
 * - `HookHalt` — fatal-controlled. Hook demands a clean stop (canonical
 *   example: chat-history `turn-check` foreign session). The runner
 *   catches it and **returns** it to the caller, who decides how to
 *   surface it (engine halt, CLI exit code 2 + readable surface). Not
 *   re-raised through the dispatch loop.
 * - any other `Error` — fatal-uncontrolled. Treated as a bug in the
 *   hook. The runner lets it propagate verbatim; dispatch unwinds.
 *
 * Both signals share a private `_HookSignal` base so the runner can
 * distinguish hook-originated control flow from genuine bugs.
 */

/**
 * Internal marker for hook-originated control flow.
 *
 * Not part of the public API. The runner uses `instanceof` checks
 * against the concrete subclasses below; the base exists only so a
 * single `instanceof _HookSignal` would cover both signals if a future
 * refactor needs it.
 */
export class _HookSignal extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, _HookSignal.prototype);
        this.name = '_HookSignal';
    }
}

/**
 * Non-fatal hook failure.
 *
 * Raised when a hook callback fails in a way the *engine* should ignore.
 * The runner catches it, emits a warning with the message, and moves
 * on to the next callback registered for the event.
 *
 * Use this for transient or non-critical hook failures (telemetry
 * sinks, optional reporters). Do **not** use it to signal "stop the
 * engine" — that is what {@link HookHalt} is for.
 */
export class HookError extends _HookSignal {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, HookError.prototype);
        this.name = 'HookError';
    }
}

/**
 * Fatal-controlled stop requested by a hook.
 *
 * Hooks raise this when execution must not continue. The runner catches
 * it and returns it to the caller; the caller turns it into the
 * appropriate halt surface (dispatcher `Outcome.BLOCKED`, CLI exit 2).
 *
 * `surface` is a list of pre-formatted numbered options per the
 * `user-interaction` rule (one entry per line). Callers must not
 * reformat — surface is rendered verbatim.
 *
 * `reason` is a short machine-readable code (e.g. `"foreign"`,
 * `"missing"`, `"validation_failed"`) for logging and tests; it is not
 * shown to the user.
 */
export class HookHalt extends _HookSignal {
    readonly reason: string;
    readonly surface: string[];

    constructor(reason: string, surface: string[] | null = null) {
        super(reason);
        Object.setPrototypeOf(this, HookHalt.prototype);
        this.name = 'HookHalt';
        this.reason = reason;
        this.surface = surface ? [...surface] : [];
    }
}
