// Tests for src/scripts/memory_consolidation.ts (road-to-context-fidelity
// Phase 2, step 2).
import { describe, expect, it } from 'vitest';

import { candidatePairs } from '../../src/scripts/memory_consolidation.js';

const rows = [
    { id: 'a', type: 'product-rules', text: 'the roadmap archives inside the PR that completes it' },
    { id: 'b', type: 'historical-patterns', text: 'the roadmap archives inside the PR that completes it' },
    { id: 'c', type: 'product-rules', text: 'council spend is authorised on the subscription transport' },
];

describe('candidatePairs', () => {
    it('surfaces an identical pair across types', () => {
        // Cross-type duplication is invisible to any per-type scan, and it is
        // the shape worth surfacing: one claim, two rows in a capped index.
        const pairs = candidatePairs(rows, 0.4);
        expect(pairs).toHaveLength(1);
        expect(pairs[0]).toMatchObject({ a: 'a', b: 'b', type_a: 'product-rules', type_b: 'historical-patterns' });
        expect(pairs[0].score).toBe(1);
        expect(pairs[0].band).toBe('merge');
    });

    it('reports each pair once, never mirrored', () => {
        expect(candidatePairs(rows, 0.4).filter((p) => p.a === 'b' && p.b === 'a')).toHaveLength(0);
    });

    it('honours a threshold below the shared warn band', () => {
        // Regression: the first version filtered on the similarity BAND as
        // well, which made --threshold inert below 0.4 and reported zero
        // whether or not the store was clean — a check that cannot fire.
        const loose = candidatePairs(rows, 0);
        expect(loose.length).toBeGreaterThan(1);
        expect(loose.some((p) => p.band === 'create')).toBe(true);
    });

    it('finds nothing in a store with no overlap', () => {
        expect(candidatePairs([rows[0], rows[2]], 0.4)).toEqual([]);
    });
});
