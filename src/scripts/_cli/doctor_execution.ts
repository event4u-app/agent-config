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
import {
    FORGE_TOTAL_BUDGET_MS,
    budgetOf,
    forgeReadingFor,
    liveForgeApi,
    originUrl,
    resolveForgeRepo,
} from '../_lib/forge_reader.js';

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
export function forgeProtectionJson(reading: ForgeReading, repo: string | null = null): Dict {
    const rows = forgeProtectionRows(reading);
    // `{owner}/{repo}` is a TEMPLATE until a repository is known. Substituting
    // it is what turns "a value came from this call" into "a value came from
    // this call against this repository" — and which repository is exactly what
    // stopped being obvious when the read went live. `origin` can be a fork, a
    // mirror, or somebody else's project in a consumer install.
    const named = (s: string): string => (repo === null ? s : s.replace(/\{owner\}\/\{repo\}/g, repo));
    return {
        repository: repo,
        rows: rows.map((r) => ({
            id: r.id,
            state: r.state,
            source: named(r.source),
            detail: r.detail,
        })),
        actions: protectionActions(rows).map(named),
        read_from_forge: rows.some((r) => r.state !== 'unread'),
    };
}

/**
 * The block as `doctor` itself builds it — AC-5.
 *
 * Phase 3.2 left `forgeProtectionJson` with no production caller, so the
 * command the criterion names reported five `unread` rows while the forge
 * satisfied all five, and the rows were only ever established by a human
 * running `gh api` and reading the mapper in a test. This is the wiring that
 * makes the named command answer for itself.
 *
 * **The offline behaviour Phase 3.2 argued for is unchanged**, which is why
 * this is an addition rather than a reversal of that note: every failure path
 * in `forgeReadingFor` — opt-out switch, no GitHub remote, no `gh`, no
 * credentials, timeout, unparseable payload, a throw — returns the same
 * `UNREAD_FORGE` reading, so `doctor` offline prints exactly what it printed
 * before, including the source each unread row would have come from.
 *
 * `process.env` and the git remote are read HERE rather than inside the reader,
 * so the reader stays injectable and every branch above is reachable from a
 * test without spawning anything.
 */
export function forgeProtectionJsonFor(root: string): Dict {
    const remaining = budgetOf(FORGE_TOTAL_BUDGET_MS);
    const read = forgeReadingFor({
        env: process.env,
        // A thunk, so the opt-out short-circuits before `git remote` spawns.
        resolveRepo: () => resolveForgeRepo(originUrl(root)),
        // The per-call ceiling is whatever is left of the whole-read budget, so
        // a call admitted near the deadline cannot run past it.
        api: liveForgeApi(remaining),
        remaining,
    });
    return forgeProtectionJson(read.reading, read.repo);
}
