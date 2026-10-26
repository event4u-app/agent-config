// road-to-tells-a-near-miss-can-refute 2.5: the render rules hold the bar on
// rendered near-misses and fire on their positives. Browser-gated.
import { describe, expect, it } from 'vitest';

import { runBench } from '../../internal/bench/design-slop-render/run.js';
import { chromiumAvailable } from '../../src/scripts/ui_conformance_probe.js';

describe('render bench', () => {
    it.skipIf(!chromiumAvailable())(
        'M1 = 0 on every rendered near-miss, and every render rule fires on its positive',
        async () => {
            const r = await runBench();
            expect(r.unrendered).toEqual([]);
            expect(r.near_miss).toEqual({});
            for (const [rule, v] of Object.entries(r.recall)) expect(v.fired, `${rule} on ${v.file}`).toBe(true);
            expect(Object.keys(r.recall).sort()).toEqual([
                'slop-l1-hero-metric',
                'slop-l2-identical-cards',
                'slop-l6-clipped-popover',
                'slop-l7-overflow',
                'slop-v7-nested-cards',
            ]);
        },
        300_000,
    );
});
