
import { describe, expect, it } from 'vitest';

import { aggregate, chars_to_tokens } from '../../internal/bench/core/bench_condense_memory.js';


describe('bench_condense_memory.ts — pure helpers', () => {
    it('chars_to_tokens uses banker rounding (round(n/4))', () => {
        expect(chars_to_tokens(0)).toBe(0);
        expect(chars_to_tokens(4)).toBe(1);
        expect(chars_to_tokens(6)).toBe(2); // 1.5 → 2 (round-half-to-even)
        expect(chars_to_tokens(10)).toBe(2); // 2.5 → 2 (round-half-to-even)
        expect(chars_to_tokens(14)).toBe(4); // 3.5 → 4
        expect(chars_to_tokens(100)).toBe(25);
    });

    it('aggregate handles fewer-than-10 savings (min/max fallback)', () => {
        const rows = [
            mkRow('a.md', 'cat1', 100, 90),
            mkRow('b.md', 'cat1', 200, 150),
            mkRow('c.md', 'cat2', 50, 60),
            { path: 'd.md', category: 'cat2', error: 'not-found' },
        ];
        const agg = aggregate(rows);
        expect(agg.calls).toBe(4);
        expect(agg.errors).toBe(1);
        // 3 ok rows → quantiles fall back to min/max.
        expect(agg.p10_saving_pct).toBeCloseTo(Math.min(10, 25, -20), 9);
        expect(agg.p90_saving_pct).toBeCloseTo(Math.max(10, 25, -20), 9);
        expect(Object.keys(agg.by_category_median_pct).sort()).toEqual(['cat1', 'cat2']);
    });
});

// --- helpers --------------------------------------------------------------

interface OkRow {
    path: string;
    category: string;
    before_chars: number;
    after_chars: number;
    delta_chars: number;
    saving_pct_chars: number;
    before_tokens_est: number;
    after_tokens_est: number;
    delta_tokens_est: number;
    saving_pct_tokens_est: number;
}

function mkRow(p: string, cat: string, before: number, after: number): OkRow {
    const beforeTok = chars_to_tokens(before);
    const afterTok = chars_to_tokens(after);
    return {
        path: p,
        category: cat,
        before_chars: before,
        after_chars: after,
        delta_chars: after - before,
        saving_pct_chars: ((before - after) * 100) / before,
        before_tokens_est: beforeTok,
        after_tokens_est: afterTok,
        delta_tokens_est: afterTok - beforeTok,
        saving_pct_tokens_est: beforeTok ? ((beforeTok - afterTok) * 100) / beforeTok : 0.0,
    };
}

