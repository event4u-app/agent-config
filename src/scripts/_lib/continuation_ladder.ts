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
): LadderAction {
    // A halt is terminal for this run id. Checked BEFORE `complete` so a
    // halted run whose roadmap later reads zero-open does not report a
    // completion it never reached.
    if (state.halted) return state.halted;
    // `scanOpenSteps` EXCLUDES `blocked-by:` steps from `openCount`, so zero-open
    // with blocked steps left is exhaustion of runnable work, not completion —
    // ADR-235's own terminal outcome, and never a sixth halt.
    if (openCount === 0) return blockedCount > 0 ? 'blocked' : 'complete';
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
    const tail = state.history.slice(-caps.stallWindow);
    if (tail.length >= caps.stallWindow && tail.every((n) => n === openCount)) {
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
