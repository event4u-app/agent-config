/**
 * The `execution` block of `agent-config doctor --json`.
 *
 * `road-to-adversarial-verification-and-long-runs` Phase 0.3. Its own module
 * rather than a function inside `cmd_doctor.ts` for the reason
 * `_lib/continuation_ladder.ts` states for itself: `check_source_size_budget` is
 * a shrink-only ratchet and `cmd_doctor.ts` sits far past the 1,500-line cap, so
 * every line added there is an added violation. A phase pays for its additions by
 * putting new code in a file under the cap rather than by raising a baseline.
 *
 * `owner_owned_check` appears here as the ladder's last RUNG rather than as a
 * separate field, because it is not a separate switch: it is the rung that
 * decides whether the residue is owner-owned at all, and lifting it out would
 * suggest it can be toggled independently of the order it sits in.
 */

import {
    executionPostureFromOverrides,
    resolveExecutionPosture,
} from '../../shared/missionExecution.js';

type Dict = Record<string, unknown>;

/** A settings-override stream, in the shape `iter_setting_overrides` yields. */
export type OverrideStream = Iterable<readonly [string, unknown, string]>;

/**
 * Build the payload block from a settings-override stream.
 *
 * A stream that throws yields the defaults rather than propagating — a
 * diagnostic that cannot report because its own input is malformed is the one
 * shape `doctor` must never take.
 */
export function executionJson(overrides: () => OverrideStream): Dict {
    let posture;
    try {
        posture = executionPostureFromOverrides(overrides());
    } catch {
        posture = resolveExecutionPosture({});
    }
    return {
        fix_loop_max: posture.fix_loop_max,
        escalation: [...posture.escalation],
    };
}
