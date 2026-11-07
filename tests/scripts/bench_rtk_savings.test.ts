
import { describe, expect, it } from 'vitest';

import { aggregate } from '../../internal/bench/core/bench_rtk_savings.js';


interface DeltaIn {
    chars_saved: number;
    tokens_saved: number;
    pct_saved: number;
}
function okRow(id: string, delta: DeltaIn): Record<string, unknown> {
    return { id, description: '', skipped: null, raw: {}, rtk: {}, delta };
}
function skipRow(id: string): Record<string, unknown> {
    return { id, description: '', skipped: 'x', raw: null, rtk: null, delta: null };
}

describe('bench_rtk_savings.ts — aggregate() pure layer', () => {
    it('floor-divides per-request and picks the upper-median pct', () => {
        const agg = aggregate([
            okRow('a', { chars_saved: 233, tokens_saved: 58, pct_saved: 34.467 }),
            okRow('b', { chars_saved: -1, tokens_saved: -1, pct_saved: 0.0 }),
            skipRow('c'),
            okRow('d', { chars_saved: 100, tokens_saved: 25, pct_saved: 50.0 }),
        ] as never);
        expect(agg.commands_measured).toBe(3);
        expect(agg.commands_skipped).toBe(1);
        expect(agg.total_chars_saved).toBe(332);
        expect(agg.total_tokens_saved).toBe(82);
        // sorted pcts [0, 34.467, 50]; median = index len//2 = 1 → 34.467
        expect(agg.median_pct_saved).toBeCloseTo(34.467, 9);
        // 82 // 3 = 27 (floor)
        expect(agg.tokens_saved_per_request).toBe(27);
    });

    it('empty (all-skipped) aggregate zeroes everything', () => {
        const agg = aggregate([skipRow('a'), skipRow('b')] as never);
        expect(agg).toEqual({
            commands_measured: 0,
            commands_skipped: 2,
            total_chars_saved: 0,
            total_tokens_saved: 0,
            median_pct_saved: 0.0,
            tokens_saved_per_request: 0,
        });
    });
});
