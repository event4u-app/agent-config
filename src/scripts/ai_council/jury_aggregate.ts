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

import { cohensKappa } from '../check_quality_regression.js';
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
export type JuryAbsentReason = 'no_scores' | 'single_family' | 'non_finite_score' | 'panel_over_cap';

/**
 * K10: past five judges the effective number of independent votes stops
 * growing, so a sixth seat adds cost and correlated agreement, not evidence.
 * Different architectures beat more seats.
 */
export const MAX_JURY_JUDGES = 5;

function _overCap(n: number): string | null {
    return n > MAX_JURY_JUDGES
        ? `${String(n)} judges exceed the cap of ${String(MAX_JURY_JUDGES)}; past five, more judges add correlated agreement, not independence`
        : null;
}

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
    const overCap = _overCap(scores.length);
    if (overCap !== null) {
        return { present: false, absentReason: 'panel_over_cap', reason: overCap };
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
    const overCap = _overCap(judges.length);
    if (overCap !== null) {
        return {
            present: false,
            absentReason: 'panel_over_cap',
            reason: overCap,
            resolution: null,
            observations: [],
            consistency: [],
        };
    }
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

/** One seat on a jury. `billing` is carried, never consulted: a free seat may judge. */
export interface JurorSeat {
    readonly judge: string;
    readonly family: string;
    readonly billing?: string | null;
}

/** A panel description, validated: every judge named once, at most five. */
export function validateJuryPanel(raw: unknown): { panel: JurorSeat[] } | { error: string } {
    const judges = (raw as { judges?: unknown } | null)?.judges;
    if (!Array.isArray(judges) || judges.length === 0) return { error: 'a jury panel needs a non-empty `judges` list' };
    const overCap = _overCap(judges.length);
    if (overCap !== null) return { error: overCap };
    const panel: JurorSeat[] = [];
    for (const j of judges as unknown[]) {
        const o = j as Partial<JurorSeat> | null;
        if (typeof o?.judge !== 'string' || typeof o.family !== 'string') {
            return { error: `every judge needs a string \`judge\` and \`family\` (got ${JSON.stringify(j)})` };
        }
        if (panel.some((p) => p.judge === o.judge)) return { error: `judge ${o.judge} is listed twice` };
        panel.push({ judge: o.judge, family: o.family, billing: o.billing ?? null });
    }
    return { panel };
}

/**
 * The prompt every juror receives. It takes the task and the item and nothing
 * else, so no juror can be shown another juror's answer by construction.
 */
export function jurorPrompt(task: string, item: string): string {
    return `${task}\n\n---\n\n${item}`;
}

export interface BlindJuryResult {
    /** Why nothing was dispatched, or null. */
    readonly refused: string | null;
    readonly answers: ReadonlyArray<{ readonly judge: string; readonly family: string; readonly answer: string }>;
}

/**
 * Ask every juror at once with the same prompt. All calls start before any
 * answer is awaited, so no answer can reach another juror before synthesis.
 */
export async function dispatchJuryBlind(
    task: string,
    item: string,
    jurors: readonly JurorSeat[],
    ask: (juror: JurorSeat, prompt: string) => Promise<string>,
): Promise<BlindJuryResult> {
    const overCap = _overCap(jurors.length);
    if (overCap !== null) return { refused: overCap, answers: [] };
    const prompt = jurorPrompt(task, item);
    const pending = jurors.map((j) => ask(j, prompt));
    const answers = await Promise.all(pending);
    return { refused: null, answers: jurors.map((j, i) => ({ judge: j.judge, family: j.family, answer: answers[i] as string })) };
}

export interface JuryIndependence {
    readonly k: number;
    readonly items: number;
    /** Each judge's Cohen's κ against the ground truth — the claim's own statistic, unchanged. */
    readonly kappa: ReadonlyArray<{ readonly judge: string; readonly kappa: number }>;
    /** Pairwise φ over error indicators; null where a judge's errors do not vary. */
    readonly phi: ReadonlyArray<{ readonly a: string; readonly b: string; readonly phi: number | null }>;
    readonly undefinedPairs: number;
    /** Mean of the defined φ values, or null when none is defined. */
    readonly phiBar: number | null;
    /** Kish effective n = k / (1 + (k−1)·φ̄), with φ̄ floored at 0 so n_eff never exceeds k. */
    readonly nEff: number | null;
    readonly nEffRatio: number | null;
}

function _phi(x: readonly boolean[], y: readonly boolean[]): number | null {
    let n11 = 0;
    let n10 = 0;
    let n01 = 0;
    let n00 = 0;
    x.forEach((xi, i) => {
        const yi = y[i] === true;
        if (xi && yi) n11 += 1;
        else if (xi) n10 += 1;
        else if (yi) n01 += 1;
        else n00 += 1;
    });
    const den = (n11 + n10) * (n01 + n00) * (n11 + n01) * (n10 + n00);
    return den === 0 ? null : (n11 * n00 - n10 * n01) / Math.sqrt(den);
}

/**
 * Family count is a proxy for independence; correlated errors are the thing
 * itself. A judge's error on item i is `labels[i] !== gold[i]`; φ is the
 * Pearson correlation of two judges' error vectors, and n_eff is reported
 * beside κ rather than in place of it.
 */
export function juryIndependence(
    gold: readonly string[],
    judges: ReadonlyArray<{ readonly judge: string; readonly labels: readonly string[] }>,
): JuryIndependence {
    const errors = judges.map((j) => gold.map((g, i) => j.labels[i] !== g));
    const phi: Array<{ a: string; b: string; phi: number | null }> = [];
    for (let i = 0; i < judges.length; i += 1) {
        for (let k = i + 1; k < judges.length; k += 1) {
            phi.push({
                a: (judges[i] as { judge: string }).judge,
                b: (judges[k] as { judge: string }).judge,
                phi: _phi(errors[i] as boolean[], errors[k] as boolean[]),
            });
        }
    }
    const defined = phi.map((p) => p.phi).filter((v): v is number => v !== null);
    const phiBar = defined.length === 0 ? null : defined.reduce((a, v) => a + v, 0) / defined.length;
    const k = judges.length;
    const nEff = phiBar === null ? null : k / (1 + (k - 1) * Math.max(0, phiBar));
    return {
        k,
        items: gold.length,
        kappa: judges.map((j) => ({ judge: j.judge, kappa: cohensKappa(gold, j.labels) })),
        phi,
        undefinedPairs: phi.length - defined.length,
        phiBar,
        nEff,
        nEffRatio: nEff === null || k === 0 ? null : nEff / k,
    };
}
