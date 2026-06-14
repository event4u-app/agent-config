/**
 * Pass-through handler for UI directive slots that have no work.
 *
 * TypeScript twin of `directives/ui/_passthrough.py` (ADR-094 py2ts). Public
 * API names stay snake_case to mirror the Python module 1:1 (Python style is
 * part of the contract). The handler is intentionally pure and
 * side-effect-free: it neither reads nor writes `state`.
 *
 * Phase 6 of the UI track retired the Phase 3 deferral stub once design /
 * apply / review / polish landed. Two slots remain semantically empty for the
 * UI track:
 *
 * - `memory` — the UI track does not consult the four memory types the
 *   backend retrieves over. UI work pivots on the audit findings in
 *   `state.ui_audit` instead.
 * - `plan` — `.design` produces the locked design brief that `.apply`
 *   follows verbatim. The brief IS the plan.
 *
 * Both slots return `Outcome.SUCCESS` without writing to state.
 */
import {
    type DeliveryState,
    Outcome,
    StepResult,
} from '../../delivery_state.js';

/** Pass-through never blocks — empty surface, declared intent. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [];

/**
 * Return `SUCCESS` without mutating state.
 *
 * The handler neither reads nor writes `state`. The dispatcher records the
 * step as successful in `state.outcomes` (its own bookkeeping) and advances to
 * the next slot.
 */
export function run(state: DeliveryState): StepResult {
    void state; // explicitly unused — the slot is a no-op by design
    return new StepResult({ outcome: Outcome.SUCCESS });
}
