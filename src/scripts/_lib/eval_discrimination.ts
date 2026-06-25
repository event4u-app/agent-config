/**
 * eval_discrimination — the "falsifier of the falsifier" for the cross-model
 * parity smoke (roadmap `road-to-operator-runtime-harvest`, T-003).
 *
 * A green parity result is trustworthy only if the eval *can* go red — and not
 * just on a gross violation, but on a subtle, just-over-threshold one. A gross
 * negative control proves "the harness can fail"; the SUBTLE control proves it
 * is sensitive enough that an "all hosts pass" reading (outcome (a) in T-006)
 * is not the underpowered-null trap wearing a green check. `discrimination_ok`
 * is therefore gated on the SUBTLE control being caught — a gross-only control
 * set is explicitly insufficient.
 *
 * Pure, dependency-free, host-agnostic: the smoke computes each control's
 * `caught` from its assertion results (via `controlCaughtFromAssertions`) and
 * passes the set here. No vendor calls happen in this module.
 */

export type ControlSeverity = 'gross' | 'subtle';

export interface NegativeControl {
    /** Stable id of the planted-violation control scenario. */
    id: string;
    /** How blatant the planted RDP violation is. */
    severity: ControlSeverity;
    /**
     * Did the harness flag this control (grade it RED)? A control is "caught"
     * when NOT all of its assertions passed — i.e. the harness correctly
     * detected the planted violation. Caught is the *desired* outcome.
     */
    caught: boolean;
}

export interface DiscriminationResult {
    /**
     * True only when the harness caught the SUBTLE control (and a gross one
     * exists and was also caught). This is the strict gate the parity smoke
     * checks before trusting an "all hosts pass" reading.
     */
    discrimination_ok: boolean;
    gross_caught: boolean;
    subtle_caught: boolean;
    /** Human-readable reason, surfaced in the smoke's emitted summary. */
    reason: string;
}

/**
 * A control is "caught" iff at least one of its assertions explicitly failed.
 * `pass: null` (e.g. an ungraded `rubric` assertion deferred to a sub-agent
 * grader) is NOT a fail — an un-graded assertion cannot count as catching a
 * violation, so only explicit `false` qualifies.
 */
export function controlCaughtFromAssertions(
    assertionResults: ReadonlyArray<{ pass: boolean | null }>,
): boolean {
    return assertionResults.some((r) => r.pass === false);
}

/**
 * Decide whether the eval discriminates well enough to trust a green reading.
 * Requires at least one `gross` AND one `subtle` control; gates on the subtle.
 */
export function computeDiscrimination(
    controls: ReadonlyArray<NegativeControl>,
): DiscriminationResult {
    const gross = controls.filter((c) => c.severity === 'gross');
    const subtle = controls.filter((c) => c.severity === 'subtle');

    const gross_caught = gross.length > 0 && gross.every((c) => c.caught);
    const subtle_caught = subtle.length > 0 && subtle.every((c) => c.caught);

    let discrimination_ok = false;
    let reason: string;

    if (gross.length === 0 || subtle.length === 0) {
        reason =
            'GRADED control set incomplete: need at least one `gross` and one `subtle` ' +
            'negative control. A single severity cannot establish sensitivity — outcome (a) stays invalid.';
    } else if (!gross_caught) {
        reason =
            'Harness is blind to a GROSS violation — it cannot fail at all. ' +
            'Any "all hosts pass" reading is meaningless.';
    } else if (!subtle_caught) {
        reason =
            'Underpowered: the gross control was caught but the SUBTLE one slipped through. ' +
            'This is the uninformative-null trap with a green check in front — outcome (a) is ' +
            'INVALID until the subtle control is caught.';
    } else {
        discrimination_ok = true;
        reason =
            'Both gross and subtle negative controls were caught — the eval discriminates; ' +
            'an "all hosts pass" reading is trustworthy.';
    }

    return { discrimination_ok, gross_caught, subtle_caught, reason };
}
