/**
 * The run-continuation termination ladder — the pure decision, on its own.
 *
 * Extracted from `hooks/run_continuation_hook.ts` by `road-to-wired-instruments`
 * Phase 2, for two reasons and one constraint. The reasons: the ladder is a pure
 * function over a state record and three numbers, and it is the surface Phase 2
 * changes, so the rung under change gets a home where it can be read without
 * 1,500 lines of I/O around it. The constraint: `check_source_size_budget` is a
 * ratchet and the hook sits PAST the 1,500-line cap, where every added line is
 * an added violation — so the phase pays for its additions by moving the code it
 * is editing to a file under the cap, rather than by raising a baseline.
 *
 * `LadderState` is structural on purpose. The hook's `RunState` carries a dozen
 * fields this decision has no business reading, and taking the whole record here
 * would invert the dependency: a `_lib` module importing from a hook.
 */

import type { UnavailableDependency } from './loop_guards.js';
import type { RunTerminalState } from './outcome_vocabularies.js';

/** Iterations one run may spend before the cap ends it. */
export const MAX_ITERATIONS = 25;
/** Wall-clock a run may span before the clock ends it. */
export const WALL_CLOCK_CAP_MS = 4 * 60 * 60 * 1000;
/** Identical consecutive open-step readings that read as a stall. */
export const STALL_WINDOW = 3;

export type LadderAction =
    | 'engage'
    | 'complete'
    | 'blocked'
    | 'halt-max-iterations'
    | 'halt-wall-clock'
    | 'halt-stall'
    | 'halt-dependency-unavailable'
    | 'halt-premise-invalidated';

/** The terminal rungs — the set `RunState.halted` may hold. */
/**
 * `halt-roadmap-absent` is deliberately NOT in this union and not in
 * `LadderAction`. It is an event name the caller emits directly when the claimed
 * roadmap is unreadable from the authoritative tree, and it CLEARS the state
 * rather than stamping `halted` — widening the union would let `parseRecord`
 * accept it as a `halted` value, which would mean a run whose budget was cleared
 * also carried a halt stamp. The two are mutually exclusive by construction.
 */
export const HALT_ACTIONS: readonly LadderAction[] = [
    'halt-max-iterations',
    'halt-wall-clock',
    'halt-stall',
    // Phase 5.4. Checked BEFORE the counter rungs: a dependency the run cannot
    // obtain is not something more iterations close, so consuming the budget
    // against it is the waste the rung exists to stop.
    'halt-dependency-unavailable',
    // `road-to-wired-instruments` 2.2, and BEFORE the counter rungs for the same
    // reason: a run whose plan premise moved does not become correct by running
    // more iterations against the stale plan, and letting it cap out reports
    // `exhausted` — a budget problem, whose remedy is a bigger budget — for what
    // is actually a staleness problem, whose remedy is a re-probe.
    'halt-premise-invalidated',
];

/**
 * The delivery state machine — `road-to-adversarial-verification-and-long-runs`
 * Phase 8.1, in the order a run walks it.
 *
 * A run's checkboxes and its DELIVERY are two different completions, and until
 * now only the first one could end a run. That is the defect: a run whose
 * roadmap reads zero-open while its PR sits on red CI, or on a target that moved
 * underneath it, reported `complete` — a completion claim about work whose only
 * evidence (the CI verdict on the final head) says otherwise.
 *
 * Two of these are ENDINGS and the rest are not:
 *   · `merged` — a grant existed and was spent.
 *   · `open-green` — no grant; the PR is open, its CI is green on the head CI
 *     actually observed, and the run says so. This is a success, not a
 *     shortfall: a run without a merge grant is not supposed to merge.
 * Every earlier position means work remains, whatever the checkboxes read.
 */
export const DELIVERY_STATES = [
    'working',
    'local-green',
    'pushed',
    'pr-open',
    'ci-pending',
    'ci-red',
    'target-sync-check',
    'target-moved',
    'delivery-ready',
    'merged',
    'open-green',
] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

/** The two positions at which a run has actually delivered. */
export const DELIVERY_ENDINGS: readonly DeliveryState[] = ['merged', 'open-green'];

/**
 * True when this delivery position means work remains.
 *
 * `null` — nothing recorded a position — is NOT incomplete. The ladder runs on
 * the Stop path, where a `gh` probe is not affordable, so the position is READ
 * from what the run wrote rather than measured here. An unrecorded position
 * therefore means *this run does not report delivery*, and inventing
 * incompleteness from that absence would hang every run that never adopted the
 * field. Fail-open, in the one direction that cannot manufacture a stall.
 */
export function deliveryBlocksCompletion(state: DeliveryState | null | undefined): boolean {
    if (state === null || state === undefined) return false;
    return !DELIVERY_ENDINGS.includes(state);
}

/**
 * The subset of a run's state this decision reads. The hook's `RunState`
 * satisfies it structurally; nothing here may widen beyond what the rungs use.
 */
export interface LadderState {
    readonly halted?: LadderAction;
    readonly iterations: number;
    readonly started_at: string;
    readonly history: readonly number[];
}

/**
 * The run terminal state each ladder action reports, or `null` for the one
 * action that is not terminal.
 *
 * This is a REAL crossing between two vocabularies, and the reason it exists at
 * all is that a terminal state nothing produces is the defect this roadmap is
 * named after. The ladder decides in its own words — the rung a reader of the
 * ledger needs — and the run vocabulary is what a closing report must say
 * (`contexts/execution/terminal-states.md`). Registered as a row in
 * `outcome_vocabularies.CROSS_DOMAIN_MAPPINGS`, which is the one place a reader
 * looks to learn a crossing exists.
 *
 * `halt-wall-clock` and `halt-max-iterations` both report `exhausted`: they are
 * two budgets, and the contract's word covers "a declared budget ran out"
 * without distinguishing which. `halt-dependency-unavailable` reports `blocked`
 * — a thing that is absent, which is that state's own definition.
 */
export const TERMINAL_STATE_BY_ACTION: Readonly<Record<LadderAction, RunTerminalState | null>> = {
    engage: null,
    complete: 'success',
    blocked: 'blocked',
    'halt-max-iterations': 'exhausted',
    'halt-wall-clock': 'exhausted',
    'halt-stall': 'stagnated',
    'halt-dependency-unavailable': 'blocked',
    'halt-premise-invalidated': 'premise-invalidated',
};

/** The run terminal state for a ladder action; `null` while the run continues. */
export function terminalStateFor(action: LadderAction): RunTerminalState | null {
    return TERMINAL_STATE_BY_ACTION[action] ?? null;
}

/**
 * The termination ladder, pure. `state` is the record BEFORE this stop;
 * `openCount` is the scan of the claimed roadmap as it stands now.
 */
export function ladder(
    state: LadderState,
    openCount: number,
    nowMs: number,
    // No default: `= 0` would silently restore the complete-instead-of-blocked
    // behaviour for any caller that omitted it.
    blockedCount: number,
    caps: { maxIterations: number; wallClockMs: number; stallWindow: number } = {
        maxIterations: MAX_ITERATIONS,
        wallClockMs: WALL_CLOCK_CAP_MS,
        stallWindow: STALL_WINDOW,
    },
    // Phase 5.4. `null` when nothing unobtainable was detected. Optional so every
    // existing caller and test keeps its meaning unchanged.
    unavailable: UnavailableDependency | null = null,
    // `road-to-wired-instruments` 2.1. TRUE only when the run's engaged-under
    // fingerprint and its newest observation are BOTH known and differ — see
    // `_lib/context_observation.premiseMoved`. Optional and defaulted false, so
    // a caller that cannot observe the world decides exactly as it did before.
    premiseInvalidated: boolean = false,
    // `road-to-adversarial-verification-and-long-runs` 8.1. The delivery position
    // the run RECORDED, or `null` where it recorded none. Optional and defaulted,
    // so a caller that does not track delivery decides exactly as it did before.
    delivery: DeliveryState | null = null,
): LadderAction {
    // A halt is terminal for this run id. Checked BEFORE `complete` so a
    // halted run whose roadmap later reads zero-open does not report a
    // completion it never reached.
    if (state.halted) return state.halted;
    // `scanOpenSteps` EXCLUDES `blocked-by:` steps from `openCount`, so zero-open
    // with blocked steps left is exhaustion of runnable work, not completion —
    // ADR-235's own terminal outcome, and never a sixth halt.
    //
    // 8.1 — delivery is checked INSIDE the zero-open branch and only against
    // `complete`. Two boundaries, both deliberate. It does not touch `blocked`:
    // a run whose remaining work is blocked has not failed to deliver, it has
    // run out of deliverable work, and holding it open on a PR it cannot advance
    // would convert a nameable blocker into a stall. And it is not checked while
    // steps are still open, because there the run continues anyway — adding a
    // second reason to continue would only make the ledger's `open` count lie
    // about why.
    const deliveringOnly =
        openCount === 0 && blockedCount === 0 && deliveryBlocksCompletion(delivery);
    if (openCount === 0) {
        if (blockedCount > 0) return 'blocked';
        if (!deliveringOnly) return 'complete';
        // Fall THROUGH to the budget rungs rather than returning `engage` here.
        // Returning early would put the run outside every bound in this function
        // — an unbounded loop, which is the failure the ladder exists against —
        // so a run held open for delivery is still capped by iterations and the
        // wall clock. Only the STALL rung is exempted, below.
    }
    // BEFORE the counter rungs, deliberately: a missing credential, an absent
    // binary or an exhausted quota is not closed by iterating, so spending the
    // budget on it converts a nameable blocker into an anonymous cap-out.
    if (unavailable !== null) return 'halt-dependency-unavailable';
    // 2.2 — also before the counter rungs, and AFTER the zero-open rungs: a run
    // that has actually finished its scope reports `complete`, because a stale
    // premise cannot un-finish work already done and verified. Everything below
    // this line is a budget, and a budget is the wrong word for staleness.
    if (premiseInvalidated) return 'halt-premise-invalidated';
    if (state.iterations >= caps.maxIterations) return 'halt-max-iterations';
    const started = Date.parse(state.started_at);
    if (Number.isFinite(started) && nowMs - started >= caps.wallClockMs) {
        return 'halt-wall-clock';
    }
    // The stall rung reads OPEN-STEP progress, and during delivery open-step
    // progress is definitionally zero: the checkboxes are all flipped and the
    // remaining work is a CI red or a moved target. Applying it here would halt
    // a healthy delivery loop on its third turn — a stall manufactured by the
    // stall detector, which is exactly the failure `run_continuation_hook`'s own
    // header warns about in the abstract and the one this file's mechanics call
    // "a metric that stops moving because the MEASUREMENT broke". The iteration
    // and wall-clock caps above still bound the loop; only this rung is skipped.
    const tail = state.history.slice(-caps.stallWindow);
    if (!deliveringOnly && tail.length >= caps.stallWindow && tail.every((n) => n === openCount)) {
        return 'halt-stall';
    }
    return 'engage';
}

/**
 * Read a persisted `halted` stamp tolerantly.
 *
 * `road-to-wired-instruments` 2.3. `LadderAction` is the SECOND value domain
 * this phase widened — the run-state file records the rung that ended a run —
 * so it owes the same forward-compatibility answer the run vocabulary got. The
 * previous reader accepted only members of `HALT_ACTIONS` and dropped anything
 * else, which does not crash but downgrades a halt stamped by a newer build to
 * NO HALT: the older binary then re-engages a run that was deliberately ended.
 * Fail-open in the one direction a budget must not fail open.
 *
 * So an unrecognised `halt-`prefixed value is PRESERVED. That is safe by
 * inspection of every consumer: `ladder` returns a stamp verbatim, and the
 * caller's branches are equality tests against known names whose default is
 * "allow this stop and write nothing" — the correct behaviour for a halt whose
 * name this build cannot interpret. The old reader's docblock claimed such a
 * value would "become an action no branch below handles"; that was never true
 * for a halt-prefixed one, and the claim is corrected here rather than carried.
 *
 * Anything not `halt-`prefixed is still dropped: `engage`, `complete` and
 * `blocked` are not stamps, and accepting one here would immortalise a state
 * file that the terminal branches delete.
 */
export function parseHaltStamp(v: unknown): LadderAction | null {
    if (typeof v !== 'string') return null;
    if ((HALT_ACTIONS as readonly string[]).includes(v)) return v as LadderAction;
    return v.startsWith('halt-') ? (v as LadderAction) : null;
}
