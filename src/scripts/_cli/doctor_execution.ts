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
import {
    forgeProtectionRows,
    protectionActions,
    type ForgeReading,
} from '../_lib/forge_protection.js';

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

/**
 * The `forge_protection` block of `doctor --json` — Phase 3.2.
 *
 * **`doctor` does NOT reach the network on its own.** A diagnostic that makes a
 * `gh` call on every invocation is one nobody runs offline, and the sibling
 * anchor gate already declined that cost for the same reason. So the reading is
 * INJECTED: a caller that has queried the forge passes it, and a caller that has
 * not passes the all-null reading, which produces five `unread` rows that still
 * name the call each value would come from.
 *
 * That is the honest shape for *read, never guessed*: the block is always
 * present, a value appears only when a named call produced it, and `unread` is a
 * third state rather than a quiet `false`. A row that was never looked at and a
 * row that was looked at and failed are different repairs.
 *
 * `actions` carries the human ACTION lines — the step's own words are that a
 * missing row is a blocker entry and NOT a halt, so this reports and returns.
 */
export function forgeProtectionJson(reading: ForgeReading): Dict {
    const rows = forgeProtectionRows(reading);
    return {
        rows: rows.map((r) => ({
            id: r.id,
            state: r.state,
            source: r.source,
            detail: r.detail,
        })),
        actions: protectionActions(rows),
        read_from_forge: rows.some((r) => r.state !== 'unread'),
    };
}

/** The all-null reading: nothing was queried. */
export const UNREAD_FORGE: ForgeReading = {
    rulesets: null,
    defaultBranch: null,
    allowAutoMerge: null,
    deployRestricted: null,
};
