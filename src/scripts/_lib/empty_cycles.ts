/**
 * A double trigger is one event, not two outcomes.
 *
 * Hosts fire the same slot more than once for a single logical event —
 * `run_continuation_hook.ts` documents the same quirk on `stop` and dedupes it
 * with an ordinal + open-count + short-window key. The consequence here is
 * arithmetic rather than cosmetic: if a duplicate fire writes a second outcome
 * record, every per-asset rate computed over the stream is inflated by exactly
 * the duplication rate, and nothing downstream can separate the two.
 *
 * But a duplicate is not nothing, and discarding it silently is the other
 * failure. The number of times a trigger fired without producing new work is
 * itself a signal — it is how an idle loop looks from the outside. So a
 * duplicate produces NO second outcome and DOES increment an empty-cycle
 * counter, which is reported as its own quantity rather than folded into
 * either the numerator or the denominator of a success rate.
 *
 * Pure and host-free on purpose: this is the seam the hook consumes, so the
 * arithmetic can be tested without constructing a host payload.
 */

/** Default coincidence window. Same value the stop-slot dedupe uses. */
export const DUPLICATE_WINDOW_MS = 60 * 1000;

export interface TriggerFire {
    /**
     * Identity of the logical event. Two fires sharing a key inside the window
     * are the same event seen twice. Id-shaped — never free-form text.
     */
    key: string;
    /** Epoch milliseconds. */
    at: number;
}

export interface CycleState {
    /** The most recent fire that produced an outcome, or `null` before any. */
    last: TriggerFire | null;
    /** Fires suppressed as duplicates so far. */
    empty_cycles: number;
}

export function initialCycleState(): CycleState {
    return { last: null, empty_cycles: 0 };
}

export interface CycleDecision {
    /** Whether this fire should produce an outcome record. */
    emit_outcome: boolean;
    /** The state to carry forward. */
    state: CycleState;
}

/**
 * Decide what one fire means.
 *
 * A fire is a duplicate when it carries the SAME key as the last
 * outcome-producing fire AND lands inside the window. Both conjuncts are
 * required and neither is sufficient:
 *
 * - Key alone would collapse a genuine repeat of the same work an hour later
 *   into an empty cycle, erasing a real outcome.
 * - Window alone would collapse two DIFFERENT events that happen to be close
 *   together, which is the common case under any kind of fan-out.
 *
 * A duplicate does not advance `last`. That is deliberate: three fires inside
 * one window are one outcome and two empty cycles, not one outcome, one empty
 * cycle, and a third fire that has drifted out of the window and looks new.
 */
export function observeFire(
    state: CycleState,
    fire: TriggerFire,
    windowMs: number = DUPLICATE_WINDOW_MS,
): CycleDecision {
    const prev = state.last;
    const isDuplicate =
        prev !== null && prev.key === fire.key && fire.at - prev.at < windowMs;

    if (isDuplicate) {
        return {
            emit_outcome: false,
            state: { last: prev, empty_cycles: state.empty_cycles + 1 },
        };
    }
    return {
        emit_outcome: true,
        state: { last: fire, empty_cycles: state.empty_cycles },
    };
}
