import { describe, expect, it } from 'vitest';

import {
    DEFAULT_RANKING_METRIC,
    isRankingMetric,
    RANKING_METRICS,
    rankArms,
    type ArmResult,
} from '../../../src/scripts/_lib/arm_ranking.js';
import {
    readWriteRatio,
    stablePrefixShare,
    validateCacheBlock,
    unavailable,
} from '../../../src/scripts/_lib/benchmark_cache_fields.js';

describe('4.2 — cost-per-solved is available, not the default', () => {
    it('the default is still tokens', () => {
        expect(DEFAULT_RANKING_METRIC).toBe('tokens');
        expect([...RANKING_METRICS]).toEqual(['tokens', 'cost-per-solved']);
        expect(isRankingMetric('cost')).toBe(false);
    });

    // The whole justification for the option: an arm can win on tokens and lose
    // on cost, because rewriting a prefix pays the cache-WRITE rate. If the two
    // metrics could not disagree, the option would be cosmetic.
    const arms: ArmResult[] = [
        // Fewer tokens, but it rewrites its prefix — expensive per solve.
        { arm: 'rewriter', tokens: 1_000, cost_usd: 9.0, solved: 3 },
        // More tokens, stable prefix — cheap per solve.
        { arm: 'stable', tokens: 4_000, cost_usd: 4.0, solved: 8 },
    ];

    it('ranks the two arms in DIFFERENT orders under the two metrics', () => {
        const byTokens = rankArms(arms, 'tokens').map((a) => a.arm);
        const byCost = rankArms(arms, 'cost-per-solved').map((a) => a.arm);

        expect(byTokens).toEqual(['rewriter', 'stable']);
        expect(byCost).toEqual(['stable', 'rewriter']);
        // The assertion that makes this a demonstration rather than a coincidence.
        expect(byTokens).not.toEqual(byCost);
    });

    it('scores are the metric, not a rank index', () => {
        const [first] = rankArms(arms, 'cost-per-solved');
        expect(first?.score).toBeCloseTo(0.5, 10); // 4.0 / 8
    });

    it('an arm that solved nothing has NO cost-per-solved, not an infinite one', () => {
        const withZero = [...arms, { arm: 'broken', tokens: 10, cost_usd: 1, solved: 0 }];
        const ranked = rankArms(withZero, 'cost-per-solved');
        const broken = ranked.find((a) => a.arm === 'broken');
        expect(broken?.score).toBeNull();
        expect(broken?.reason).toContain('undefined');
        // Undefined scores sort last rather than winning by being smallest.
        expect(ranked[ranked.length - 1]?.arm).toBe('broken');
    });

    it('the same arm still ranks on tokens when that metric is chosen', () => {
        const withZero = [...arms, { arm: 'broken', tokens: 10, cost_usd: 1, solved: 0 }];
        expect(rankArms(withZero, 'tokens')[0]?.arm).toBe('broken');
    });
});

describe('4.1 — the cache block is required and never a fabricated number', () => {
    it('a report with no cache block fails, naming both fields', () => {
        const problems = validateCacheBlock({ schema_version: 1 });
        expect(problems.map((p) => p.field).sort()).toEqual(['read_write_ratio', 'stable_prefix_share']);
        expect(problems.every((p) => p.kind === 'missing')).toBe(true);
    });

    it('each missing field is named individually', () => {
        expect(validateCacheBlock({ cache: { read_write_ratio: 2 } })).toEqual([
            { field: 'stable_prefix_share', kind: 'missing' },
        ]);
    });

    it('unavailable needs a reason — a blank one is refused', () => {
        expect(validateCacheBlock({ cache: { read_write_ratio: unavailable(''), stable_prefix_share: 0.5 } })).toEqual([
            { field: 'read_write_ratio', kind: 'blank-unavailable' },
        ]);
    });

    it('a valid block passes', () => {
        expect(validateCacheBlock({ cache: { read_write_ratio: 2.5, stable_prefix_share: 0.8 } })).toEqual([]);
    });

    it('zero cache-creation tokens is UNDEFINED, not zero and not infinite', () => {
        const v = readWriteRatio(500, 0);
        expect(typeof v).toBe('object');
        expect((v as { unavailable: string }).unavailable).toContain('undefined rather than zero');
    });

    it('a real ratio is computed when both legs exist', () => {
        expect(readWriteRatio(900, 300)).toBe(3);
    });

    it('an empty cohort yields a stated reason, not a 0.0 share', () => {
        const v = stablePrefixShare(0, 0);
        expect(typeof v).toBe('object');
        expect((v as { unavailable: string }).unavailable).toContain('no dispatch');
    });

    it('a real share is computed when the cohorts have data', () => {
        expect(stablePrefixShare(3, 1)).toBe(0.75);
    });

    it('a share above 1 is out of range', () => {
        expect(validateCacheBlock({ cache: { read_write_ratio: 2, stable_prefix_share: 1.5 } })[0]?.kind).toBe('out-of-range');
    });
});
