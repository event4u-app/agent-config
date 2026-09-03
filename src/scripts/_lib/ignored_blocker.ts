/**
 * The ignored-blocker detector (`road-to-runtime-event-journal` Phase 3).
 *
 * `outcome_envelope.ts` already refuses to report a failure as a success. The
 * gap it left is one layer up: nothing recorded whether the ORCHESTRATOR did
 * anything with that failure. A `blocked` return the orchestrator dropped and a
 * `blocked` return it read and deliberately set aside were byte-identical, so
 * an ignored blocker was undetectable by construction — not hard to detect,
 * *undetectable*, because the distinguishing fact was never written down.
 *
 * The acknowledgment field set closes that, and this module is the predicate
 * over it. One rule, stated once:
 *
 *   a return in a NON-SUCCESS state carrying NO acknowledgment is an
 *   IGNORED BLOCKER.
 *
 * Two boundaries follow from it and are load-bearing in opposite directions:
 *
 * 1. **`rejected-with-reason` is NOT a finding.** A reader who read the
 *    blocker, weighed it and rejected it with a named reason has consumed the
 *    return. Reporting that would make the detector fire on the compliant
 *    path, and a detector that punishes the behaviour it wants is a detector
 *    people route around.
 * 2. **A success carrying no acknowledgment is NOT a finding.** Requiring an
 *    acknowledgment on every return would make the field a formality on the
 *    99 % path and noise on the 1 % that matters. Only a non-success return
 *    was ever owed a decision.
 *
 * Nothing here is a gate. It is a predicate plus a query shape, so both the
 * in-session check and the after-the-fact journal query answer the same
 * question with the same rule rather than two that drift.
 */

import { NON_SUCCESS_STATES } from './outcome_envelope.js';
import type { ConsumptionState, OutcomeEnvelope, TerminalState } from './outcome_envelope.js';

/**
 * Is this return an ignored blocker?
 *
 * The core condition, in one place so that neutralising it for a sensitivity
 * probe neutralises BOTH the live check and the journal query — a test that can
 * only be broken in one of the two would establish sensitivity for half the
 * mechanism.
 */
export function isIgnoredBlocker(env: Pick<OutcomeEnvelope, 'state' | 'acknowledgment'>): boolean {
    return NON_SUCCESS_STATES.has(env.state) && env.acknowledgment === undefined;
}

/** Why a return was reported, in a form a caller can print without re-deriving it. */
export interface IgnoredBlockerFinding {
    readonly state: TerminalState;
    /** The producer's next action — the thing that went unactioned. */
    readonly suggestion: string;
    /** Set when the finding came from a journal row; null for an in-session envelope. */
    readonly episodeId: string | null;
}

/** Report the ignored blockers in a batch of returns held in memory. */
export function findIgnoredBlockers(
    envelopes: readonly Pick<OutcomeEnvelope, 'state' | 'suggestion' | 'acknowledgment'>[],
): IgnoredBlockerFinding[] {
    return envelopes
        .filter((e) => isIgnoredBlocker(e))
        .map((e) => ({ state: e.state, suggestion: e.suggestion, episodeId: null }));
}

// ---------------------------------------------------------------------------
// The journal join (Phase 3.2)
// ---------------------------------------------------------------------------

/**
 * One journal row, as far as THIS question needs it.
 *
 * Deliberately a structural type over four field names rather than an import
 * of the journal module's own row type. The journal is written on a sibling
 * track; coupling this predicate to its internal API would make the answer to
 * "was this blocker ignored" un-testable until that module lands, and would
 * couple two things whose only real contract is the four names below.
 *
 * The contract this join depends on, and nothing else:
 *
 * | field          | type                          | source                                   |
 * |----------------|-------------------------------|------------------------------------------|
 * | `episode_id`   | `string`                      | the episode spine (Phase 2.1)            |
 * | `state`        | `TerminalState`               | reused verbatim from `outcome_envelope`  |
 * | `consumption`  | `ConsumptionState` \| `null`  | this phase's field set (Phase 3.1)       |
 * | `suggestion`   | `string`                      | the envelope's next action               |
 *
 * `consumption` is NULL — not absent — in the journal, because a SQL column
 * has no third state. {@link rowIsIgnoredBlocker} maps that null onto the
 * envelope's absent case, and that mapping is the whole of the impedance
 * between the two representations.
 */
export interface JournalConsumptionRow {
    readonly episode_id: string;
    readonly state: TerminalState;
    readonly consumption: ConsumptionState | null;
    readonly suggestion: string;
}

/**
 * The join, as SQL, for the journal's own reader to run once the table exists.
 *
 * Kept beside the predicate rather than in the journal module so the two
 * cannot drift: if this string and {@link rowIsIgnoredBlocker} ever disagree,
 * the disagreement is visible in one file. It is a documented query shape, not
 * a live query — nothing in this module opens a database.
 *
 * The `IN` list is DERIVED from {@link NON_SUCCESS_STATES}, not written out.
 * It used to be four hand-typed literals, and "kept beside the predicate so the
 * two cannot drift" was true of the FILE and false of the LIST: when the run
 * vocabulary gained a seventh state (`road-to-wired-instruments` 2.3) the
 * predicate picked it up from the set and this string did not, so the same
 * module answered its own question two ways. Co-location is not a binding.
 */
export const IGNORED_BLOCKER_QUERY = `
SELECT episode_id, state, suggestion
FROM journal_events
WHERE state IN (${[...NON_SUCCESS_STATES].map((s) => `'${s}'`).join(', ')})
  AND consumption IS NULL
ORDER BY episode_id
`.trim();

/**
 * The row-level twin of {@link isIgnoredBlocker}, expressed THROUGH it so the
 * two cannot answer the same question differently.
 */
export function rowIsIgnoredBlocker(row: JournalConsumptionRow): boolean {
    return isIgnoredBlocker({
        state: row.state,
        ...(row.consumption === null ? {} : { acknowledgment: acknowledgmentOfRow(row.consumption) }),
    });
}

/**
 * Rehydrate a row's `consumption` column into an acknowledgment.
 *
 * The reason is not carried on this projection — the detector never reads it,
 * and inventing one here would put a fabricated string where a real reason
 * belongs. `rejected-with-reason` therefore gets a locator instead of prose.
 */
function acknowledgmentOfRow(consumption: ConsumptionState): NonNullable<OutcomeEnvelope['acknowledgment']> {
    return consumption === 'rejected-with-reason'
        ? { consumption, reason: '(recorded in the journal row)' }
        : { consumption };
}

/** Report the ignored blockers in a set of journal rows. */
export function findIgnoredBlockersInJournal(
    rows: readonly JournalConsumptionRow[],
): IgnoredBlockerFinding[] {
    return rows
        .filter((r) => rowIsIgnoredBlocker(r))
        .map((r) => ({ state: r.state, suggestion: r.suggestion, episodeId: r.episode_id }));
}
