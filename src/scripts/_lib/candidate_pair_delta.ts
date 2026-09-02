/**
 * The missing seam: two candidate records over one observation, and one signed
 * delta per trial.
 *
 * A recorded search over this tree established that nothing read two
 * {@link CandidateRecord}s and emitted a delta, a {@link PairedVerdict} or a
 * {@link MetricVector}. The only live `decidePairedVerdict` caller runs over
 * benchmark task pairs, the only paired-row construction is a deserialiser, and
 * the evaluation cascade takes its vector from the caller. So the comparison a
 * two-arm proposer experiment needs had no producer at all: the verdict
 * function existed and nothing could feed it from candidates.
 *
 * This module is that producer, and it is deliberately the only thing it is.
 *
 * Everything about the SHAPE of the comparison is derived from constants
 * committed before either arm existed: the sign convention from
 * {@link PairedInput}'s own contract, the direction handling from
 * {@link MetricDirection}, the tie epsilon from the value the A/B report
 * already uses, the aggregation and the significance bar from
 * {@link decidePairedVerdict}. What is NOT here is the outcome scalar itself.
 * {@link TrialOutcome} is supplied by a caller, because choosing what a trial
 * MEASURES is the one decision in this experiment that could favour an arm, and
 * a module that invented one would be answering it in the wrong place.
 *
 * The honest consequence, stated rather than left to be discovered: this
 * producer has no live population today. No shipped evaluator emits a
 * {@link TrialOutcome} for a candidate over the frozen corpus, so every test
 * here supplies its own. A producer with no population is exactly as honest as
 * a guard with no caller, and the same disclosure applies.
 */

import type { CandidateRecord } from './candidate_record.js';
import {
    ARTIFACT_COUNT_METRIC,
    buildVector,
    type MetricDirection,
    type MetricRow,
    type MetricVector,
} from './evaluation_vector.js';
import { decidePairedVerdict, type PairedVerdict } from './paired_verdict.js';

/**
 * Deltas within this of zero are ties.
 *
 * NOT chosen here: it is the value the A/B report's own direction counts
 * already use, and its reason is recorded there, that two definitions of a tie
 * in one report is how the numbers start disagreeing. Restating that value
 * rather than picking a fresh one keeps a candidate comparison and a bench
 * comparison answering to the same notion of no difference.
 */
export const TIE_EPSILON = 1e-9;

export class PairingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PairingError';
    }
}

/**
 * The pairing key, derived from the record alone.
 *
 * A record carries no observation field, so the key is reconstructed from what
 * it does carry: the mutation dimension and the sorted mutation paths. That is
 * exactly the observation identity for this experiment, because each fixed
 * recipe owns one dimension and each observation names one subject. Keying on
 * the candidate id would pair nothing, since an id hashes the mutated bytes, so
 * two arms that produced different text have different ids by construction,
 * which is the whole reason there is something to compare.
 */
export function pairingKey(record: CandidateRecord): string {
    const paths = record.mutations.map((m) => m.path).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `${record.dimension} ${paths.join(' ')}`;
}

export interface CandidatePair {
    readonly key: string;
    readonly control: CandidateRecord;
    readonly treatment: CandidateRecord;
    /**
     * The arms produced byte-identical mutations.
     *
     * Not an error and not silently dropped. It means every trial on this pair
     * is a structural tie, so the pair contributes to the trial count and to no
     * discordant count, and a reader who sees `underpowered` without this flag
     * would look for the cause in the measurement rather than in the arms.
     */
    readonly identical_arms: boolean;
}

function serialiseMutations(r: CandidateRecord): string {
    return [...r.mutations]
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .map((m) => `${m.path} ${m.content}`)
        .join('');
}

/**
 * Pair two arms' record sets, refusing every shape where half a pair exists.
 *
 * An unmatched record on either side is refused rather than dropped. Dropping
 * it would make the trial count depend on which observations each arm happened
 * to satisfy, and a comparison whose denominator is chosen by one of the arms
 * is not a paired comparison.
 */
export function pairCandidates(
    control: readonly CandidateRecord[],
    treatment: readonly CandidateRecord[],
): CandidatePair[] {
    const byKey = new Map<string, CandidateRecord>();
    for (const r of treatment) {
        const k = pairingKey(r);
        if (byKey.has(k)) {
            throw new PairingError(
                `treatment arm emitted two records for '${k}': one observation is one candidate ` +
                    'per arm, and a second would make the pairing pick a winner before any trial ran',
            );
        }
        byKey.set(k, r);
    }
    const out: CandidatePair[] = [];
    const seen = new Set<string>();
    for (const c of control) {
        const k = pairingKey(c);
        if (seen.has(k)) {
            throw new PairingError(`control arm emitted two records for '${k}'`);
        }
        seen.add(k);
        const t = byKey.get(k);
        if (t === undefined) {
            throw new PairingError(
                `no treatment record for '${k}': half a pair is no result, not a partial one`,
            );
        }
        out.push({
            key: k,
            control: c,
            treatment: t,
            identical_arms: serialiseMutations(c) === serialiseMutations(t),
        });
    }
    for (const k of byKey.keys()) {
        if (!seen.has(k)) {
            throw new PairingError(
                `no control record for '${k}': the treatment arm ran an observation the control did not`,
            );
        }
    }
    return out;
}

/**
 * One measured trial: the same scalar, on both arms, under the same conditions.
 *
 * Both values are required. An absent arm is refused rather than imputed,
 * because imputing it would put a number the run did not observe into a
 * denominator that decides a verdict.
 */
export interface TrialOutcome {
    readonly trial_id: string;
    readonly control: number;
    readonly treatment: number;
}

/**
 * The signed deltas for one pair. Positive favours the TREATMENT, always.
 *
 * The convention is not this module's to set: the verdict's own input contract
 * states one signed delta per trial with positive favouring the treatment, so
 * the direction handling here is a translation of {@link MetricDirection} into
 * that fixed convention rather than a second convention beside it. For a
 * lower-better metric the subtraction is reversed, so a caller never has to
 * remember which endpoint it is looking at.
 */
export function pairedDeltas(
    outcomes: readonly TrialOutcome[],
    direction: MetricDirection,
): number[] {
    if (outcomes.length === 0) {
        throw new PairingError(
            'no trials: a verdict over zero trials is a fabricated result, not an empty one',
        );
    }
    const ids = new Set<string>();
    for (const o of outcomes) {
        if (ids.has(o.trial_id)) {
            throw new PairingError(
                `duplicate trial id '${o.trial_id}': one trial counted twice inflates the discordant count`,
            );
        }
        ids.add(o.trial_id);
        if (!Number.isFinite(o.control) || !Number.isFinite(o.treatment)) {
            throw new PairingError(
                `trial '${o.trial_id}' carries a non-finite outcome: an unmeasured trial is absent, never zero`,
            );
        }
    }
    return outcomes.map((o) =>
        direction === 'higher-better' ? o.treatment - o.control : o.control - o.treatment,
    );
}

export interface PairComparison {
    readonly pairs: readonly CandidatePair[];
    readonly trials: number;
    readonly verdict: PairedVerdict;
    /** Pairs whose arms produced identical bytes, so every one of their trials tied. */
    readonly identical_pairs: readonly string[];
}

export interface ComparisonInput {
    readonly control: readonly CandidateRecord[];
    readonly treatment: readonly CandidateRecord[];
    /** Trials keyed by pairing key. Every pair must carry at least one. */
    readonly outcomes: Readonly<Record<string, readonly TrialOutcome[]>>;
    readonly direction: MetricDirection;
}

/**
 * The comparison, pooled across pairs.
 *
 * Pooling is what raises the experiment off the discordant floor: with one
 * delta per pair the trial count equals the corpus size, which sits exactly on
 * the derived floor, so a single dissent makes a pass arithmetically
 * unreachable before the run starts. Pooling per-trial deltas across pairs
 * makes the count the number of TRIALS rather than the number of pairs.
 *
 * The assumption that buys it is stated rather than assumed away: the exact
 * sign test treats each delta as an independent draw, and trials on the same
 * pair share a subject. A caller that cannot defend that independence should
 * pass one aggregate delta per pair and accept the smaller sample, which this
 * function supports by simply being given fewer trials.
 */
export function compareArms(input: ComparisonInput): PairComparison {
    const pairs = pairCandidates(input.control, input.treatment);
    const deltas: number[] = [];
    for (const p of pairs) {
        const trials = input.outcomes[p.key];
        if (trials === undefined || trials.length === 0) {
            throw new PairingError(
                `pair '${p.key}' has no trials: a pair present in the arms and absent from the ` +
                    'measurements silently shrinks the denominator',
            );
        }
        deltas.push(...pairedDeltas(trials, input.direction));
    }
    return {
        pairs,
        trials: deltas.length,
        verdict: decidePairedVerdict({ deltas, tieEpsilon: TIE_EPSILON }),
        identical_pairs: pairs.filter((p) => p.identical_arms).map((p) => p.key),
    };
}

/**
 * Module-level on purpose, not for reuse.
 *
 * Inlined as an arrow inside {@link comparisonVector} it put a `): number`
 * immediately after that function's `: MetricVector` return annotation, which
 * is the shape the no-scalar-collapse scanner in
 * `tests/scripts/evaluation_vector.test.ts` matches. The scanner is right to be
 * blunt there, so the code moves rather than the pattern.
 */
function distinctMutationPaths(records: readonly CandidateRecord[]): number {
    return new Set(records.flatMap((r) => r.mutations.map((m) => m.path))).size;
}

/**
 * The comparison as a metric vector the evaluation cascade can consume.
 *
 * The artifact-count row is not optional and is not this function's to omit:
 * the vector builder refuses a vector without it, so a comparison that reached
 * the promotion verdict without a measured artifact delta is unconstructible.
 * The delta counted here is the treatment arm's distinct mutated paths minus
 * the control arm's, which is a fact about the records rather than an outcome.
 */
export function comparisonVector(
    candidate_id: string,
    metric: string,
    direction: MetricDirection,
    comparison: PairComparison,
): MetricVector {
    const rows: MetricRow[] = [
        { kind: 'paired', metric, direction, verdict: comparison.verdict },
        {
            kind: 'counted',
            metric: ARTIFACT_COUNT_METRIC,
            direction: 'lower-better',
            delta:
                distinctMutationPaths(comparison.pairs.map((p) => p.treatment)) -
                distinctMutationPaths(comparison.pairs.map((p) => p.control)),
        },
    ];
    return buildVector(candidate_id, rows);
}
