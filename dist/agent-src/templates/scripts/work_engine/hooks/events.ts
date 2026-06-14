/**
 * Hook event surface for `work_engine`.
 *
 * TypeScript twin of `work_engine/hooks/events.py` (ADR-094 py2ts —
 * work_engine.hooks subpackage). Mirrors the Python `str`-Enum 1:1: each
 * value is the event name verbatim, so round-trips stay trivial for
 * telemetry and JSON tracing.
 *
 * Ten events split across two layers per
 * `agents/roadmaps/road-to-work-engine-hooks.md` (locked).
 *
 * Dispatcher-layer events fire from inside `dispatcher.dispatch()` and
 * operate on `DeliveryState` (legacy, internal). CLI-layer events fire
 * from `cli.main()` and operate on `WorkState` (v1 envelope) plus
 * auxiliary refs (`state_file`, `fmt`, `args`).
 */

/**
 * Lifecycle events emitted by the work engine.
 *
 * Modelled as a const object + value-union so it behaves like the Python
 * `str`-Enum: members compare equal to their string value, and the value
 * IS the event name. `HookEvent.BEFORE_STEP === 'before_step'`.
 */
export const HookEvent = {
    // Dispatcher layer (DeliveryState).
    BEFORE_STEP: 'before_step',
    AFTER_STEP: 'after_step',
    ON_HALT: 'on_halt',
    ON_ERROR: 'on_error',

    // CLI layer (WorkState).
    BEFORE_LOAD: 'before_load',
    AFTER_LOAD: 'after_load',
    BEFORE_DISPATCH: 'before_dispatch',
    AFTER_DISPATCH: 'after_dispatch',
    BEFORE_SAVE: 'before_save',
    AFTER_SAVE: 'after_save',
} as const;

export type HookEvent = (typeof HookEvent)[keyof typeof HookEvent];

/**
 * Iteration order over every event, mirroring Python `for event in HookEvent`
 * (declaration order). Used by {@link TraceHook} to register on all events.
 */
export const HOOK_EVENTS: readonly HookEvent[] = [
    HookEvent.BEFORE_STEP,
    HookEvent.AFTER_STEP,
    HookEvent.ON_HALT,
    HookEvent.ON_ERROR,
    HookEvent.BEFORE_LOAD,
    HookEvent.AFTER_LOAD,
    HookEvent.BEFORE_DISPATCH,
    HookEvent.AFTER_DISPATCH,
    HookEvent.BEFORE_SAVE,
    HookEvent.AFTER_SAVE,
];
