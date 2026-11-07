// road-to-rewrites-that-keep-their-facts 3.2: fact conservation is the bench's
// free third metric — per split, from the fact witness, with no judge call.
import { describe, expect, it } from 'vitest';

import { diffFacts } from '../../src/scripts/_lib/fact_diff.js';
import { factAggregate, factConservation, loadPairs, renderFactSection } from '../../internal/bench/core/bench_humanizer_eval.js';

describe('bench fact conservation', () => {
    const pairs = loadPairs();

    it('counts what the witness adds and loses per pair', () => {
        for (const p of pairs) {
            const d = diffFacts(p.before, p.after);
            expect(factConservation(p)).toEqual({ added: d.added.length, lost: d.lost.length });
        }
    });

    it('aggregates fact_added_pairs and fact_lost_pairs per split', () => {
        for (const split of ['tune', 'holdout'] as const) {
            const rows = pairs.filter((p) => p.split === split).map((p) => ({ facts: factConservation(p) }));
            const agg = factAggregate(rows);
            expect(agg.fact_added_pairs).toBe(rows.filter((r) => r.facts.added > 0).length);
            expect(agg.fact_lost_pairs).toBe(rows.filter((r) => r.facts.lost > 0).length);
            expect(agg.pairs).toBe(rows.length);
        }
    });

    it('a pair that keeps its facts counts as conserved', () => {
        expect(factAggregate([{ facts: { added: 0, lost: 0 } }, { facts: { added: 2, lost: 0 } }])).toEqual({
            pairs: 2,
            fact_added_pairs: 1,
            fact_lost_pairs: 0,
            fact_conserved_pairs: 1,
        });
    });

    it('the rendered section names fact_added_pairs for each split', () => {
        const md = renderFactSection({
            tune: { pairs: 12, fact_added_pairs: 9, fact_lost_pairs: 7, fact_conserved_pairs: 1 },
            holdout: { pairs: 8, fact_added_pairs: 8, fact_lost_pairs: 2, fact_conserved_pairs: 0 },
        });
        expect(md).toContain('fact_added_pairs');
        expect(md).toMatch(/tune[^\n]*9\/12/);
        expect(md).toMatch(/holdout[^\n]*8\/8/);
    });
});
