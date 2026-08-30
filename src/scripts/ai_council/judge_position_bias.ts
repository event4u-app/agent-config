/**
 * Per-judge position-consistency — order-swap over sampled pairwise judgments.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 3, step 3.5:
 * "repeat sampled pairwise judgments with candidate order reversed; emit a
 * per-judge position-consistency metric", verified by "the metric exists per
 * judge and is reported with the verdict".
 *
 * ── What already existed, and why this is not a second copy of it ────────────
 * `check_quality_regression.evaluatePair` (`:84-108`) already judges every pair
 * in both orders and resolves a flip to `inconsistent` rather than to a winner,
 * and `_lib/judge_hygiene.ts:5-9` records that as stronger than the step that
 * asked for it. Two things it does not do, and both are the point here:
 *
 *   1. It is SINGLE-JUDGE. `aggregate` returns one run-wide `inconsistency_rate`
 *      (`:216`), so two judges of differing reliability average into one number
 *      that describes neither. The step asks for the metric PER JUDGE, which is
 *      what makes it actionable: you can drop the flipper.
 *   2. It reports presence, not DIRECTION. A judge that flips at random and a
 *      judge that always prefers whatever it was shown first produce the same
 *      inconsistency rate and need opposite remedies — the first is noise, the
 *      second is a systematic bias that survives averaging and quietly decides
 *      verdicts. `first_position_rate` separates them.
 *
 * That module is the thin-vs-eager token gate and is not council code; this one
 * is council-side and stays a pure library — no transport, no fixture path, no
 * `main`. The judge is an injected function, so the whole surface is testable
 * against a scripted judge and costs nothing to exercise.
 *
 * ── Honest scope ────────────────────────────────────────────────────────────
 * The shipped council has NO pairwise judging stage (`grep -rn pairwise
 * src/scripts/ai_council` returns nothing): members deliberate, peer-review and
 * are scored on findings, never compared two at a time. So this module is the
 * metric and its renderer, exercised by the provider-leakage bench that Phase 3
 * builds; it does not claim a live council verdict currently carries the line,
 * because there is currently no live council judgment for it to describe.
 */

import { _sha256_hex } from './blind_review.js';

/** A judge's preference between the two PRESENTED candidates — order-relative. */
export type PairwiseVerdict = 'first' | 'second' | 'tie';

/**
 * The pluggable judge. `first`/`second` are the candidate bodies in PRESENTED
 * order, so a judge implementation cannot tell which arm it is looking at
 * unless the bodies themselves leak it.
 */
export type PairwiseJudge = (ctx: { readonly id: string }, first: string, second: string) => PairwiseVerdict;

/** How a pair resolved once both orders were seen. */
export type PairResolution = 'a' | 'b' | 'tie' | 'inconsistent';

export interface SwapObservation {
    readonly id: string;
    /** Verdict with A presented first. */
    readonly forward: PairwiseVerdict;
    /** Verdict with B presented first. */
    readonly reverse: PairwiseVerdict;
    readonly resolution: PairResolution;
}

/**
 * Judge one (a, b) pair in BOTH orders.
 *
 * A verdict that does not survive the swap resolves to `inconsistent`, never to
 * a winner — a flagged tie would still be a tie in somebody's denominator,
 * while `inconsistent` is its own bucket with its own reported rate.
 */
export function judgeBothOrders(id: string, a: string, b: string, judge: PairwiseJudge): SwapObservation {
    const ctx = { id };
    const forward = judge(ctx, a, b);
    const reverse = judge(ctx, b, a);
    // Normalise each verdict to the CANDIDATE it names, not the position.
    const wf: PairResolution = forward === 'first' ? 'a' : forward === 'second' ? 'b' : 'tie';
    const wr: PairResolution = reverse === 'first' ? 'b' : reverse === 'second' ? 'a' : 'tie';
    const resolution: PairResolution = wf === wr ? wf : 'inconsistent';
    return { id, forward, reverse, resolution };
}

export interface JudgeConsistency {
    readonly judge: string;
    /** Pairs actually repeated in both orders. */
    readonly sampled: number;
    /** Both orders named the same candidate, or both said tie. */
    readonly consistent: number;
    /** The two orders disagreed. */
    readonly inconsistent: number;
    /**
     * `consistent / sampled`. `null` at zero pairs — a rate over an empty
     * denominator is not 1.0, and reporting it as 1.0 would make an unrun swap
     * indistinguishable from a perfectly stable judge.
     */
    readonly position_consistency: number | null;
    /**
     * Share of DECISIVE verdicts (`first`/`second`, both orders pooled) that
     * named whichever candidate was shown FIRST. ~0.5 is unbiased; near 1.0 is
     * primacy, near 0.0 recency. `null` when nothing decisive was said.
     *
     * This is the direction an inconsistency rate cannot show, and the reason a
     * judge that flips at random is a different problem from one that always
     * prefers the top of the list.
     */
    readonly first_position_rate: number | null;
    /** Decisive verdicts counted for `first_position_rate`. */
    readonly decisive_verdicts: number;
}

/** Per-judge metric over that judge's own swapped observations. */
export function positionConsistency(judge: string, obs: readonly SwapObservation[]): JudgeConsistency {
    let consistent = 0;
    let inconsistent = 0;
    let firstWins = 0;
    let decisive = 0;
    for (const o of obs) {
        if (o.resolution === 'inconsistent') {
            inconsistent += 1;
        } else {
            consistent += 1;
        }
        for (const v of [o.forward, o.reverse]) {
            if (v === 'first') {
                decisive += 1;
                firstWins += 1;
            } else if (v === 'second') {
                decisive += 1;
            }
        }
    }
    const sampled = obs.length;
    return {
        judge,
        sampled,
        consistent,
        inconsistent,
        position_consistency: sampled > 0 ? consistent / sampled : null,
        first_position_rate: decisive > 0 ? firstWins / decisive : null,
        decisive_verdicts: decisive,
    };
}

/**
 * Deterministic sample of `ids` at `rate`, seeded by `seed`.
 *
 * The step says "SAMPLED pairwise judgments", because the swap doubles judge
 * calls and doubling every one of them to measure the judge is a cost the
 * measurement does not need. Deterministic so a published consistency figure is
 * reproducible from the report's own seed — a sample nobody can re-draw is a
 * number nobody can check.
 *
 * `rate <= 0` samples nothing; `rate >= 1` samples everything.
 */
export function sampleForSwap(ids: readonly string[], rate: number, seed: string): string[] {
    if (!(rate > 0)) {
        return [];
    }
    if (rate >= 1) {
        return [...ids];
    }
    return ids.filter((id) => _unitHash(`${seed} ${id}`) < rate);
}

/**
 * Stable [0,1) hash of a string.
 *
 * Reuses `blind_review._sha256_hex` rather than carrying a local one. That
 * export exists for exactly this reason — `blind_review.ts:38-44` records that
 * two hashes of one input are two answers to one question and the second is the
 * one nobody updates. A hand-rolled FNV-1a was tried here first and its low bits
 * were skewed enough that a rate of 0.25 sampled half the corpus; the test that
 * caught it is kept.
 */
function _unitHash(s: string): number {
    return parseInt(_sha256_hex(s).slice(0, 8), 16) / 4294967296;
}

/**
 * One report line per judge, for emission BESIDE a verdict.
 *
 * `n/a` rather than a number when nothing was sampled: the step's verify is
 * that the metric is reported, and a report that silently prints nothing for an
 * unrun swap satisfies it only by looking like it ran.
 */
export function renderPositionConsistency(rows: readonly JudgeConsistency[]): string {
    if (rows.length === 0) {
        return 'position consistency: no judge sampled — order-swap NOT RUN.';
    }
    const pct = (v: number | null): string => (v === null ? 'n/a' : `${(v * 100).toFixed(0)}%`);
    return rows
        .map(
            (r) =>
                `position consistency · ${r.judge}: ${pct(r.position_consistency)} ` +
                `(${String(r.consistent)}/${String(r.sampled)} pairs survived the swap; ` +
                `first-position rate ${pct(r.first_position_rate)} over ${String(r.decisive_verdicts)} decisive verdicts)`,
        )
        .join('\n');
}
