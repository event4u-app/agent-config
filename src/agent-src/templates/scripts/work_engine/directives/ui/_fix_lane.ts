/**
 * Fix-intent right-sizing for the UI chain (2026-08-04).
 *
 * A `ui-fix` run (defect repair on an existing surface) enters the chain at
 * `apply`: the audit and design gates pass through instead of halting to
 * delegate `existing-ui-audit` / `design-intelligence` — both skills stay
 * available on demand. Gated by the pre-registered ui-triviality eval
 * (recall 1.00 at the frozen corpus) — no chain trim on a misrouting
 * classifier.
 *
 * The design-fidelity floor is untouched BY CONSTRUCTION: when the ticket
 * references an existing design artifact (mockup, figma, prototype,
 * screenshot, wireframe, a *design.html handover), the passthrough refuses
 * and the mandatory resource-first audit halt fires exactly as before.
 */
import type { DeliveryState } from '../../delivery_state.js';

export const UI_FIX_INTENT = 'ui-fix';

// Mirrors the design-fidelity rule's handover classes (mockup keyword,
// *design.html filename convention) — a fix that must MATCH a provided
// design is fidelity-gated work, not a lane shortcut.
export const DESIGN_ARTIFACT_MARKERS: RegExp =
    /\b(mockup|figma|prototype|wireframe|screenshot|design\s+(?:file|system|spec|artifact))\b|design\.html/iu;

export function is_fix_intent(state: DeliveryState): boolean {
    const ticket = (state.ticket ?? {}) as Record<string, unknown>;
    return ticket['intent'] === UI_FIX_INTENT;
}

/** Scan every string value of the ticket for a design-artifact reference. */
export function references_design_artifact(state: DeliveryState): boolean {
    const ticket = (state.ticket ?? {}) as Record<string, unknown>;
    for (const value of Object.values(ticket)) {
        if (typeof value === 'string' && DESIGN_ARTIFACT_MARKERS.test(value)) {
            return true;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === 'string' && DESIGN_ARTIFACT_MARKERS.test(item)) {
                    return true;
                }
            }
        }
    }
    return false;
}

/** True when the fix lane may skip a mandatory-audit/design halt. */
export function fix_lane_passthrough(state: DeliveryState): boolean {
    return is_fix_intent(state) && !references_design_artifact(state);
}
