// Pure-function tests for the length-neutral judge rerun (design invariants).
import { describe, expect, it } from 'vitest';

import {
    decide_verdict,
    price_usd,
    spearman,
    within_band,
} from '../../src/scripts/bench_quality_rerun.js';

describe('within_band (±15% output-token pairing)', () => {
    it('keeps matched pairs, drops divergent ones', () => {
        expect(within_band(100, 110)).toBe(true);
        expect(within_band(100, 115)).toBe(true); // exactly 15/115 ≈ 13%
        expect(within_band(100, 200)).toBe(false);
        expect(within_band(0, 0)).toBe(true);
    });
});

describe('spearman', () => {
    it('perfect monotone → 1; anti-monotone → -1; noise → near 0', () => {
        expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 9);
        expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 9);
        expect(Math.abs(spearman([1, 2, 3, 4, 5, 6], [1, -1, 1, -1, 1, -1]))).toBeLessThan(0.5);
    });
});

describe('decide_verdict (pre-registered logic)', () => {
    it('low κ withholds', () => {
        expect(decide_verdict({ kappa: 0.4, rho: 0, agreed_thin: 30, agreed_eager: 5 })).toContain('low-kappa');
    });
    it('length flag withholds even with a strong split', () => {
        expect(decide_verdict({ kappa: 0.9, rho: 0.5, agreed_thin: 30, agreed_eager: 5 })).toContain('length-confounded');
    });
    it('significant ≥10pp effect ships or records the honest null', () => {
        expect(decide_verdict({ kappa: 0.9, rho: 0.1, agreed_thin: 28, agreed_eager: 8 })).toContain('ships-lift');
        expect(decide_verdict({ kappa: 0.9, rho: 0.1, agreed_thin: 8, agreed_eager: 28 })).toContain('honest-null');
    });
    it('non-significant → underpowered', () => {
        expect(decide_verdict({ kappa: 0.9, rho: 0.1, agreed_thin: 10, agreed_eager: 8 })).toContain('underpowered');
    });
});

describe('price_usd', () => {
    it('matches pricing.yaml tiers by substring', () => {
        expect(price_usd('claude-opus-4-8', 1e6, 0)).toBeCloseTo(15, 6);
        expect(price_usd('claude-sonnet-4-5', 0, 1e6)).toBeCloseTo(15, 6);
        expect(price_usd('gpt-4o', 1e6, 1e6)).toBeCloseTo(12.5, 6);
    });
});
