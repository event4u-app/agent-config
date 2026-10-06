import { describe, expect, it } from 'vitest';

import { bench, distribution, percentile } from '../../src/scripts/bench_graph_feeder_latency.js';

describe('bench_graph_feeder_latency — step 3.5 of road-to-a-graph-that-feeds-the-gate', () => {
    it('takes nearest-rank percentiles, so p95 of twenty samples is the nineteenth', () => {
        const s = Array.from({ length: 20 }, (_, i) => i + 1);
        expect(percentile(s, 50)).toBe(10);
        expect(percentile(s, 95)).toBe(19);
        expect(percentile(s, 100)).toBe(20);
        expect(Number.isNaN(percentile([], 50))).toBe(true);
        expect(distribution([3, 1, 2])).toStrictEqual({ n: 3, p50: 2, p95: 3, max: 3 });
    });

    it('measures both arms on the same turn, with the feeder on its full path and the exit code unmoved', async () => {
        const r = await bench({ runs: 3, files: 3 });
        // The `with` arm must reach the path the step prices — an uncommitted
        // edit over a built graph — or the reading measures the short-circuit.
        expect(r.graphState).toBe('edited');
        expect(r.with.n).toBe(3);
        expect(r.without.n).toBe(3);
        expect(r.feederOnly.n).toBe(3);
        // Detector F refuses in both arms, and the graph does not change that.
        expect(r.exitCodes.with).toStrictEqual([1]);
        expect(r.exitCodes.without).toStrictEqual([1]);
        // The feeder's own work is real work, not a no-op that reads as free.
        expect(r.feederOnly.p50).toBeGreaterThan(0);
    }, 120_000);

    it('leaves an unset home variable unset, not the string "undefined"', async () => {
        const saved = process.env.USERPROFILE;
        delete process.env.USERPROFILE;
        try {
            await bench({ runs: 1, files: 1 });
            expect('USERPROFILE' in process.env).toBe(false);
        } finally {
            if (saved !== undefined) process.env.USERPROFILE = saved;
        }
    }, 120_000);
});
