/**
 * The repeated-failure rate — computed over the AMENDED view, by construction.
 *
 * This is the roadmap's single pre-registered core metric, and the reason it
 * needed the amendment path first is arithmetic rather than aesthetic. A repeat
 * is precisely the signal that surfaces AFTER an episode's terminal record is
 * written: rework lands, a regression is found, a review comes back. A rate
 * computed over unamended rows therefore undercounts the exact thing it exists
 * to measure, and undercounts it in the flattering direction.
 *
 * The guarantee here is structural, not documentary: this module's input type
 * is {@link EpisodeReconstruction}, which is the folded projection. It has no
 * overload taking raw `JournalEvent[]`, so a caller CANNOT accidentally compute
 * the rate over unamended rows — there is nothing to pass.
 */

import type { BasisTag } from './evidence_basis.js';
import type { EpisodeReconstruction } from './runtime_journal.js';
import { RUN_TERMINAL_STATES, type RunTerminalState } from './outcome_vocabularies.js';

/**
 * Terminal states that count as a failure for this metric.
 *
 * `clean-no-op` is deliberately NOT a failure: an episode that correctly
 * determined there was nothing to do succeeded at the thing it was asked. And
 * `approval-required` is not one either — it is the safety floor working, and
 * counting a floor doing its job as a failure would make the metric fall every
 * time governance fires.
 */
export const FAILURE_TERMINALS: ReadonlySet<RunTerminalState> = new Set([
    'blocked',
    'exhausted',
    'stagnated',
]);

/** States that count as a success for the metric. */
export const SUCCESS_TERMINALS: ReadonlySet<RunTerminalState> = new Set([
    'success',
    'clean-no-op',
]);

/**
 * Neither a failure nor a success for this metric, and each excluded for its own
 * reason rather than by omission.
 *
 * `approval-required` is the safety floor working; counting a floor doing its
 * job as a failure would make the metric fall every time governance fires.
 *
 * `premise-invalidated` is the same shape one layer out: the run stopped because
 * the world it planned against moved, which is the drift detector working, not
 * the work failing. It is also the state whose base rate is set by OTHER people's
 * pushes rather than by this run's quality — `origin/main` moves constantly — so
 * counting it as a failure would make the repeated-failure rate track repository
 * traffic. That is the concrete form of this roadmap's Risk 1, arriving through
 * the metric instead of through the ladder.
 */
const EXCLUDED: ReadonlySet<RunTerminalState> = new Set(['approval-required', 'premise-invalidated']);

// Every terminal state is classified or deliberately excluded -- silence about
// one is how a metric quietly changes meaning when the vocabulary grows.
const CLASSIFIED = new Set<string>([...FAILURE_TERMINALS, ...SUCCESS_TERMINALS, ...EXCLUDED]);
const _unclassified = RUN_TERMINAL_STATES.filter((t) => !CLASSIFIED.has(t));
if (_unclassified.length > 0) {
    throw new Error(
        `repeated_failure: terminal state(s) ${_unclassified.join(', ')} are neither a failure, ` +
            'a success, nor explicitly excluded. Classify them or the rate silently changes meaning.',
    );
}

export interface RepeatedFailureRate {
    /** Episodes whose EFFECTIVE terminal state is a failure. */
    failed: number;
    /** Episodes with any classifiable effective terminal state. */
    classified: number;
    /** Episodes whose terminal state is absent or excluded. Its own share. */
    unknown: number;
    /** `failed / classified`, or `null` when nothing was classifiable. */
    rate: number | null;
    /** How many of the counted episodes carried at least one amendment. */
    amended_episodes: number;
    basis: BasisTag;
}

/**
 * Compute the rate.
 *
 * `rate` is `null`, never `0`, when nothing classifiable was seen — the same
 * rule the per-asset report follows, for the same reason: zero is a measurement
 * and null is an absence, and a reader acts on the first while asking about the
 * second.
 */
export function repeatedFailureRate(
    episodes: readonly EpisodeReconstruction[],
): RepeatedFailureRate {
    let failed = 0;
    let classified = 0;
    let unknown = 0;
    let amended_episodes = 0;

    for (const ep of episodes) {
        if (ep.amendment_count > 0) amended_episodes += 1;

        // `ep.terminal_state` is already the AMENDED verdict: reconstructEpisode
        // drops superseded rows and takes the LAST effective terminal state.
        const t = ep.terminal_state;
        if (t === null || !CLASSIFIED.has(t) || EXCLUDED.has(t)) {
            unknown += 1;
            continue;
        }
        classified += 1;
        if (FAILURE_TERMINALS.has(t)) failed += 1;
    }

    return {
        failed,
        classified,
        unknown,
        rate: classified === 0 ? null : failed / classified,
        amended_episodes,
        basis: 'estimated:ratio-over-amended-episode-terminals',
    };
}
