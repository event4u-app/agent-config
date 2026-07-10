/**
 * Cohen's Kappa second-judge validation (road-to-retrieval-substrate-hardening B7b).
 */
import { describe, expect, it } from 'vitest';

import { cohensKappa, judgeKappa } from '../../src/scripts/check_quality_regression.js';
import type { PairResult } from '../../src/scripts/check_quality_regression.js';

describe('cohensKappa', () => {
    it('is 1 for perfect agreement', () => {
        expect(cohensKappa(['thin', 'eager', 'tie'], ['thin', 'eager', 'tie'])).toBe(1);
    });
    it('is ~0 for chance-level agreement', () => {
        // Two raters, 2 labels, independent 50/50 → kappa near 0.
        const a = ['thin', 'thin', 'eager', 'eager'];
        const b = ['thin', 'eager', 'thin', 'eager'];
        expect(Math.abs(cohensKappa(a, b))).toBeLessThan(0.01);
    });
    it('is negative when raters systematically disagree', () => {
        expect(cohensKappa(['thin', 'eager'], ['eager', 'thin'])).toBeLessThan(0);
    });
    it('is NaN with no data', () => {
        expect(Number.isNaN(cohensKappa([], []))).toBe(true);
    });
});

describe('judgeKappa — aligns two judges by task id', () => {
    const mk = (id: string, winner: PairResult['winner']): PairResult => ({
        id,
        winner,
        length_delta: 0,
        winner_is_longer: null,
    });

    it('measures agreement on the per-pair winner label', () => {
        const a = [mk('t1', 'thin'), mk('t2', 'eager'), mk('t3', 'tie')];
        const b = [mk('t1', 'thin'), mk('t2', 'eager'), mk('t3', 'tie')];
        expect(judgeKappa(a, b)).toBe(1);
    });

    it('only compares tasks present for both judges', () => {
        const a = [mk('t1', 'thin'), mk('t2', 'eager')];
        const b = [mk('t1', 'thin')]; // t2 missing → excluded
        expect(judgeKappa(a, b)).toBe(1);
    });
});
