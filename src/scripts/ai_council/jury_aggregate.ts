/**
 * Jury aggregation — road-to-admissible-council-seats 3.2.
 *
 * BESIDE `consensus.ts`, not inside it, and the separation is the design.
 * `consensus.ts` aggregates a COUNCIL, whose members carry verdicts.
 * A jury does not: per ADR-257 a route this package did not pay for may propose
 * and may score, never decide. Folding jury scoring into the consensus path
 * would put a scorer on the code path that produces verdicts, which is the
 * exact transition this roadmap's Risk 5 names — "scoring quietly becomes
 * deciding".
 *
 * Two rules, and both are refusals.
 *
 * 1. **At least two model families, or the panel is ABSENT.** Not a warning, a
 *    refusal: `docs/CLAIMS.md` records that a same-posture second vendor's
 *    catches were a strict SUBSET of the first's. A same-family panel therefore
 *    measures redundancy, and reporting redundancy as agreement is the failure
 *    a diversity requirement exists to prevent.
 * 2. **The aggregate is a trimmed statistic, never a vote count.** For the same
 *    reason: counting agreeing voices rewards a panel for being correlated.
 *
 * What "trimmed" means here, exactly: with n >= 3 the single lowest and single highest score are dropped and the
 * rest averaged — which at n = 3 IS the median, and is why one corrupted score
 * in a three-judge panel cannot move the result the way it moves an arithmetic
 * mean. With n = 2 there is nothing to trim; the mean is returned with
 * `trimmed: 0` so a reader can see that no robustness was available rather than
 * inferring it from a method name.
 */

import {
    judgeBothOrders,
    positionConsistency,
    type JudgeConsistency,
    type PairResolution,
    type PairwiseJudge,
    type SwapObservation,
} from './judge_position_bias.js';

/** One judge's score for one item. `family` is the MODEL family, not the seat. */
export interface JuryScore {
    readonly judge: string;
    readonly family: string;
    /** Any finite number. The aggregator does not impose a scale. */
    readonly score: number;
}

/** Why a panel produced no aggregate. Each value is a REFUSAL, not an error. */
export type JuryAbsentReason = 'no_scores' | 'single_family' | 'non_finite_score';

export type JuryResult =
    | {
          readonly present: false;
          readonly absentReason: JuryAbsentReason;
          readonly reason: string;
      }
    | {
          readonly present: true;
          readonly aggregate: number;
          readonly method: 'trimmed-mean';
          /** How many scores the trim discarded. 0 when n < 3. */
          readonly trimmed: number;
          readonly judges: number;
          readonly families: readonly string[];
      };

/**
 * Aggregate one item's jury scores.
 *
 * Never throws on panel composition: a refused panel is a VERDICT the caller
 * reads, the same shape the transport resolver uses for a refused seat. An
 * exception would make "this panel does not qualify" indistinguishable from a
 * bug at every call site.
 */
export function juryAggregate(scores: readonly JuryScore[]): JuryResult {
    if (scores.length === 0) {
        return { present: false, absentReason: 'no_scores', reason: 'no jury scores supplied' };
    }
    for (const s of scores) {
        if (!Number.isFinite(s.score)) {
            return {
                present: false,
                absentReason: 'non_finite_score',
                reason: `judge ${s.judge} returned a non-finite score; the panel is refused rather than silently dropping it`,
            };
        }
    }
    const families = [...new Set(scores.map((s) => s.family))].sort();
    if (families.length < 2) {
        return {
            present: false,
            absentReason: 'single_family',
            reason:
                `panel spans ${families.length} model family (${families.join(', ') || 'none'}); ` +
                'at least two are required — a same-family panel measures redundancy, not agreement',
        };
    }
    const sorted = [...scores.map((s) => s.score)].sort((a, b) => a - b);
    const trimmed = sorted.length >= 3 ? 2 : 0;
    const kept = trimmed === 0 ? sorted : sorted.slice(1, sorted.length - 1);
    const aggregate = kept.reduce((acc, v) => acc + v, 0) / kept.length;
    return {
        present: true,
        aggregate,
        method: 'trimmed-mean',
        trimmed,
        judges: scores.length,
        families,
    };
}

/** One judge's swapped observation plus the family it belongs to. */
export interface JuryPairwiseJudge {
    readonly judge: string;
    readonly family: string;
    readonly fn: PairwiseJudge;
}

export interface JuryPairwiseResult {
    readonly present: boolean;
    readonly absentReason: JuryAbsentReason | null;
    readonly reason: string | null;
    /** Panel resolution, or `null` when the panel is absent. */
    readonly resolution: PairResolution | null;
    readonly observations: readonly SwapObservation[];
    readonly consistency: readonly JudgeConsistency[];
}

/**
 * Run a pairwise jury with the position swap applied PER JUDGE.
 *
 * Reuses `judge_position_bias.ts` rather than re-implementing the swap: a
 * second implementation of "show both orders and reconcile" is a second place
 * for the reconciliation to be subtly wrong, and that module already resolves a
 * verdict that does not survive the swap to `inconsistent` rather than to a
 * winner.
 *
 * The panel resolution is the strict majority of the judges' own resolutions,
 * and `inconsistent` judges are counted in the DENOMINATOR — a judge that
 * flipped has an opinion about nothing, and dropping it from the denominator
 * would let two stable judges out of five look unanimous.
 */
export function juryPairwise(
    id: string,
    a: string,
    b: string,
    judges: readonly JuryPairwiseJudge[],
): JuryPairwiseResult {
    const families = [...new Set(judges.map((j) => j.family))].sort();
    if (judges.length === 0 || families.length < 2) {
        return {
            present: false,
            absentReason: judges.length === 0 ? 'no_scores' : 'single_family',
            reason:
                judges.length === 0
                    ? 'no judges supplied'
                    : `panel spans ${families.length} model family; at least two are required`,
            resolution: null,
            observations: [],
            consistency: [],
        };
    }
    const observations: SwapObservation[] = [];
    const consistency: JudgeConsistency[] = [];
    const tally = new Map<PairResolution, number>();
    for (const j of judges) {
        const obs = judgeBothOrders(id, a, b, j.fn);
        observations.push(obs);
        consistency.push(positionConsistency(j.judge, [obs]));
        tally.set(obs.resolution, (tally.get(obs.resolution) ?? 0) + 1);
    }
    let resolution: PairResolution = 'inconsistent';
    for (const [k, v] of tally) {
        if (v * 2 > judges.length) {
            resolution = k;
        }
    }
    return { present: true, absentReason: null, reason: null, resolution, observations, consistency };
}
