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
    type Runner,
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
 * **THIS function does not reach the network; `doctor` now does.** The mapper
 * stays pure and takes an INJECTED reading — a caller that queried the forge
 * passes it, one that did not passes the all-null reading, which produces five
 * `unread` rows that still name the call each value would come from. What
 * changed is the caller: `forgeProtectionJsonFor` below acquires that reading,
 * so `doctor --json` does make `gh` calls. Phase 3.2's "`doctor` does not reach
 * the network" is SUPERSEDED, and this header said otherwise for three review
 * rounds while the function forty lines down called it a reversal — the third
 * copy of a refuted argument in this diff, each found by a different round.
 * Corrected here for the reason the others were: a header is where a dead
 * argument gets reused.
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
    const readFromForge = rows.some((r) => r.state !== 'unread');
    // **The slug is reported only when something was actually read, and that
    // invariant is structural rather than a caller's promise.** The first
    // version reported whatever the git remote resolved to, which is a LOCAL
    // read that succeeds with no network — so an ordinary offline run (GitHub
    // remote present, no connectivity, no opt-out) emitted a named repository
    // and substituted sources while every row was `unread`. That made the
    // claim this change rests on — offline output is what Phase 3.2 shipped —
    // false on exactly the failed-live path the council condition names. The
    // earlier verification only ever exercised the opt-out switch and read it
    // as offline; the two are not the same path.
    const anonymous = repo === null || !readFromForge;
    const name = (s: string): string =>
        anonymous ? s : s.replace(/\{owner\}\/\{repo\}/g, () => repo);
    return {
        repository: readFromForge ? repo : null,
        rows: rows.map((r) => ({
            id: r.id,
            state: r.state,
            source: name(r.source),
            detail: r.detail,
        })),
        actions: protectionActions(rows).map(name),
        read_from_forge: readFromForge,
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
 * **This IS a reversal of Phase 3.2's module boundary, and the roadmap records
 * the supersession.** An earlier draft of this comment argued the opposite —
 * "an addition rather than a reversal" — which a 2/2 convergent council pass
 * refuted: that note recorded two boundaries, `doctor` does not reach the
 * network AND the reading is injected, and this reverses both. The refuted
 * argument is corrected here rather than left standing, because a comment is
 * what the next reader of this module finds first and is where a refuted
 * reasoning would get reused.
 *
 * What survives is the AVAILABILITY property, which is narrower than the
 * earlier claim and is the one the supersession rests on: every failure path in
 * `forgeReadingFor` — opt-out switch, no GitHub remote, no `gh`, no
 * credentials, timeout, unparseable payload, a throw — returns the same
 * `UNREAD_FORGE` reading, so offline the ROWS, their `source` templates and the
 * action lines are what Phase 3.2 printed. Not the whole document: the block
 * gained a top-level `repository` key, which is `null` on every such path. A
 * consumer validating `forge_protection` against a closed schema sees that one
 * added key; "prints exactly what it printed before" was too strong and is not
 * claimed.
 *
 * `process.env` and the git remote are read HERE rather than inside the reader,
 * so the reader stays injectable and every branch above is reachable from a
 * test without spawning anything.
 */
export interface ForgeDeps {
    readonly env?: Readonly<Record<string, string | undefined>>;
    /** The subprocess runner for both `git` and `gh`. */
    readonly run?: Runner;
}

export function forgeProtectionJsonFor(root: string, deps: ForgeDeps = {}): Dict {
    // The composition root — budget, thunk, host and cwd wired together — had
    // no seam and therefore no test, so the opt-out-before-spawn and host
    // binding were asserted one layer down against fakes while a regression in
    // the real wiring stayed invisible. `deps` is that seam; production passes
    // nothing and gets `process.env` plus the real spawn.
    const env = deps.env ?? process.env;
    const run = deps.run;
    const remaining = budgetOf(FORGE_TOTAL_BUDGET_MS);
    const read = forgeReadingFor({
        env,
        // A thunk, so the opt-out short-circuits before `git` spawns.
        resolveRepo: () => resolveForgeRepo(originUrl(root, run)),
        // Built from the RESOLVED target, so `gh` is addressed at the host and
        // directory the slug came from. The per-call ceiling is whatever is
        // left of the whole-read budget, so a call admitted near the deadline
        // cannot run past it.
        apiFor: (t) => liveForgeApi(remaining, run, { host: t.host, cwd: root }),
        remaining,
    });
    return forgeProtectionJson(read.reading, read.repo);
}
