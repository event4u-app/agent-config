import { describe, expect, it } from 'vitest';

import { c_false_positive_rate, cost_percentiles, net_value, paired, percentile, sign_test_p } from '../../src/scripts/bench_headroom_17_report.js';

const run = (cap: boolean, errored = false, fp: boolean | null = null): Record<string, unknown> => ({
    capability_pass: cap,
    errored,
    orchestration: fp === null ? {} : { tests_fp: fp },
});

describe('bench_headroom_17_report', () => {
    it('sign test matches the binomial tail', () => {
        expect(sign_test_p(6, 0)).toBeCloseTo(1 / 64, 10);
        expect(sign_test_p(5, 1)).toBeCloseTo(7 / 64, 10);
        expect(sign_test_p(0, 0)).toBe(1);
    });
    it('an errored run is a fail even when the verifier passed (budget stop = fail)', () => {
        const recs = [{ id: 't', arms: { 'h17-c': [run(true, true)], 'h17-b': [run(false)] } }];
        expect(paired(recs, 'h17-c', 'h17-b')).toMatchObject({ pairs: 1, t_pass: 0, t_only: 0 });
    });
    it('pairs by seed index and counts discordance both ways', () => {
        const recs = [{ id: 't', arms: { 'h17-c': [run(true), run(false), run(true)], 'h17-b': [run(false), run(true), run(true)] } }];
        expect(paired(recs, 'h17-c', 'h17-b')).toMatchObject({ pairs: 3, t_only: 1, b_only: 1 });
    });
    it('the cluster filter keeps only its tasks', () => {
        const recs = [
            { id: 'a', arms: { 'h17-c': [run(true)], 'h17-b': [run(false)] } },
            { id: 'b', arms: { 'h17-c': [run(true)], 'h17-b': [run(false)] } },
        ];
        expect(paired(recs, 'h17-c', 'h17-b', (id) => id === 'a').pairs).toBe(1);
    });
    it('FP rate counts only runs that produced tests', () => {
        const recs = [{ id: 't', arms: { 'h17-c': [run(false, false, true), run(false, false, false), run(false)] } }];
        expect(c_false_positive_rate(recs)).toEqual({ with_tests: 2, fp: 1, rate: 0.5 });
    });
    it('percentile is nearest-rank over the sorted values', () => {
        expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3);
        expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
        expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 0.95)).toBe(19);
        expect(percentile([], 0.5)).toBeNull();
    });
    it('cost per run prices every run, an errored one included, from its own token buckets', () => {
        const rates = { input: 1, output: 10, cache_write: 0, cache_read: 0 };
        const tok = (i: number, o: number, errored = false) => ({ errored, tokens_breakdown: { input_tokens: i * 1e6, output_tokens: o * 1e6 } });
        const recs = [{ id: 't', arms: { 'h17-a': [tok(1, 0), tok(2, 0), tok(3, 0, true)] } }];
        expect(cost_percentiles(recs, ['h17-a'], rates)).toEqual({ 'h17-a': { n: 3, p50_usd: 2, p95_usd: 3, errored: 1 } });
    });
    it('net value follows D4: p_catch·D − C_extra − r_FP·C_FP, with D = 10× and C_FP = 1× arm A p50', () => {
        const v = net_value({ p_catch: 0.25, r_fp: 0.5, p50_a: 0.2, p50_b: 0.3, p50_t: 0.7 });
        expect(v.D).toBeCloseTo(2, 10);
        expect(v.C_FP).toBeCloseTo(0.2, 10);
        expect(v.C_extra).toBeCloseTo(0.4, 10);
        expect(v.net_usd_per_run).toBeCloseTo(0.25 * 2 - 0.4 - 0.5 * 0.2, 10);
    });
});
