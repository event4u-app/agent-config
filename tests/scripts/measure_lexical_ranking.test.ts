/**
 * Ranking-lift measurement (road-to-retrieval-substrate-hardening B2).
 *
 * Locks the gate that authorises shipping the lexical index: on the
 * retrieval-precision corpus the BM25 index must rank strictly better than the
 * `_score` bucket scorer (smaller top tie-set) with no precision regression.
 */
import { describe, expect, it } from 'vitest';

import { measure } from '../../src/scripts/measure_lexical_ranking.js';

describe('measure_lexical_ranking', () => {
    it('the index breaks keyword ties the bucket scorer leaves (3.333 → 1.0)', () => {
        const { summary } = measure();
        // Baseline reproduces the documented "recalls but does not rank" gap.
        expect(summary.baseline_mean_tie_set).toBeGreaterThan(1);
        // The index uniquely top-ranks every needed entry.
        expect(summary.index_mean_tie_set).toBe(1);
        expect(summary.index_mean_tie_set).toBeLessThan(summary.baseline_mean_tie_set);
    });

    it('precision is not regressed by the re-ranking', () => {
        const { summary } = measure();
        expect(summary.index_precision_at_1).toBeGreaterThanOrEqual(summary.baseline_precision_at_1);
        expect(summary.index_precision_at_k).toBeGreaterThanOrEqual(summary.baseline_precision_at_k);
        expect(summary.index_precision_at_k).toBe(1);
    });

    it('is deterministic across runs', () => {
        expect(JSON.stringify(measure().summary)).toBe(JSON.stringify(measure().summary));
    });
});
