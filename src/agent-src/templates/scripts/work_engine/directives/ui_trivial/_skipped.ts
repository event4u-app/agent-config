/**
 * Pass-through handler for slots the trivial path skips.
 *
 * TypeScript twin of `directives/ui_trivial/_skipped.py` (ADR-094 py2ts).
 * Public API names stay snake_case to mirror the Python module 1:1.
 *
 * The `ui-trivial` directive set short-circuits the audit / design / review /
 * polish loop. The dispatcher's `STEP_ORDER` is fixed (eight slots, no
 * branching), so the trivial set fills the unused slots — `memory`,
 * `analyze`, `plan`, `verify` — with this no-op handler. It returns `SUCCESS`
 * without touching state, mutates nothing, and declares zero ambiguities.
 */
import {
    type DeliveryState,
    Outcome,
    StepResult,
} from '../../delivery_state.js';

/** No ambiguities — the slot is unconditionally skipped on the trivial path. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [];

/**
 * Return `SUCCESS` without touching `state`.
 *
 * Shared handler for the slots the trivial path intentionally bypasses.
 * Keeping the slot wired (rather than raising) preserves the dispatcher's
 * completeness-check invariant: every slot in `STEP_ORDER` has a callable
 * handler, every directive set has a uniform shape.
 */
export function run(state: DeliveryState): StepResult {
    void state;
    return new StepResult({ outcome: Outcome.SUCCESS });
}
