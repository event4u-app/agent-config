/**
 * PREREG amendment v2 — the size claim decides on TWO bars, kept separate.
 *
 * These tests exist because the amendment is easy to describe and easy to
 * implement wrong in three specific ways, each of which happened on the way in
 * and each of which is pinned below:
 *
 *   1. replacing Wilcoxon outright, so a clean sweep of NEGLIGIBLE improvements
 *      claims a size win — the failure both council seats independently named;
 *   2. applying the strict "direction bar must be met" reading to the anti-
 *      golfing REFUSAL, which makes the refusal vanish on a report with no
 *      direction counts — a missing input silently rescuing an arm;
 *   3. reading `pass` as "complexity rose" on the complexity endpoint, where
 *      `pass` means it FELL. That inverts the guard and reads correctly in
 *      English.
 */
import { describe, expect, it } from 'vitest';

import {
    ALPHA,
    T1_MEDIAN_LINES_PCT,
    evaluateSizeClaim,
    type PairedContinuous,
    type PairedRate,
} from '../../src/scripts/_lib/bench_ab_size_claim.js';

const size = (over: Partial<PairedContinuous> = {}): PairedContinuous => ({
    measured: true,
    n_pairs: 10,
    median_delta_pct: -30,
    median_delta: -30,
    wilcoxon_p: 0.001,
    direction_wins: 10,
    direction_losses: 0,
    ...over,
});

const flatComplexity = (over: Partial<PairedContinuous> = {}): PairedContinuous => ({
    measured: true,
    n_pairs: 10,
    median_delta_pct: 0,
    median_delta: 0,
    wilcoxon_p: 1,
    direction_wins: 0,
    direction_losses: 0,
    ...over,
});

const safeHeld: PairedRate = {
    measured: true,
    n_pairs: 10,
    rate_treatment: 1,
    rate_baseline: 1,
    mcnemar_p: 1,
};

const claim = (s: PairedContinuous, c = flatComplexity(), sf = safeHeld): ReturnType<typeof evaluateSizeClaim> =>
    evaluateSizeClaim({ arm_treatment: 't', arm_baseline: 'b', size: s, complexity: c, safety: sf });

describe('the two bars are independent', () => {
    it('passes when BOTH the magnitude bar and the direction bar are met', () => {
        expect(claim(size()).verdict).toBe('PASS');
    });

    it('REFUSES a clean directional sweep whose magnitude is negligible', () => {
        // 10/10 non-tied pairs favour the treatment — the direction bar is met
        // decisively — but the median fell 1%, far short of the pre-registered
        // -10%. This is the case a bare sign test would wrongly pass.
        const v = claim(size({ median_delta_pct: -1, median_delta: -1 }));
        expect(v.verdict).toBe('NO-SIZE-WIN');
        expect(v.reason).toContain(String(T1_MEDIAN_LINES_PCT));
    });

    it('REFUSES a large magnitude whose direction is below the derived floor', () => {
        // Wilcoxon would have passed this: p=0.001 is still in the block, and it
        // now decides nothing. Four non-tied pairs cannot clear alpha at all.
        const v = claim(size({ direction_wins: 4, direction_losses: 0 }));
        expect(v.verdict).toBe('NO-SIZE-WIN');
        expect(v.reason).toContain('underpowered');
    });

    it('REFUSES a magnitude win whose direction is a coin flip', () => {
        const v = claim(size({ direction_wins: 5, direction_losses: 5 }));
        expect(v.verdict).toBe('NO-SIZE-WIN');
    });

    it('names the at-floor warning when the sample sits exactly on the floor', () => {
        const v = claim(size({ direction_wins: 5, direction_losses: 0 }));
        expect(v.verdict).toBe('PASS');
        expect(v.reason).toContain('Raise the trial count');
    });

    it('reports the Wilcoxon p for triage and says it decides nothing', () => {
        const v = claim(size({ direction_wins: 5, direction_losses: 5 }));
        expect(v.reason).toContain('decides nothing');
    });
});

describe('a pre-amendment report cannot claim a win, and cannot escape a refusal', () => {
    const legacy = (over: Partial<PairedContinuous> = {}): PairedContinuous => {
        const s = size(over);
        delete (s as { direction_wins?: number }).direction_wins;
        delete (s as { direction_losses?: number }).direction_losses;
        return s;
    };

    it('no direction counts → no PASS, even with a significant Wilcoxon p', () => {
        const v = claim(legacy());
        expect(v.verdict).toBe('NO-SIZE-WIN');
        expect(v.reason).toContain('pre-amendment');
    });

    it('the anti-golfing REFUSAL still fires from the legacy signal alone', () => {
        // The asymmetry: a refusal must not disappear because an input is
        // missing. Complexity rose, Wilcoxon says significantly, no direction
        // counts — the arm is still refused.
        const rose = legacy({ median_delta: 5, median_delta_pct: 5, wilcoxon_p: ALPHA / 10 });
        const v = claim(size(), rose);
        expect(v.verdict).toBe('REFUSED-GOLFING');
    });

    it('and fires from the direction counts when they are present', () => {
        const rose = flatComplexity({
            median_delta: 5,
            median_delta_pct: 5,
            wilcoxon_p: 1,
            direction_wins: 0,
            direction_losses: 9,
        });
        expect(claim(size(), rose).verdict).toBe('REFUSED-GOLFING');
    });

    it('does NOT fire when complexity FELL — the inversion this pins', () => {
        const fell = flatComplexity({
            median_delta: -5,
            median_delta_pct: -5,
            wilcoxon_p: 0.001,
            direction_wins: 9,
            direction_losses: 0,
        });
        expect(claim(size(), fell).verdict).toBe('PASS');
    });
});
