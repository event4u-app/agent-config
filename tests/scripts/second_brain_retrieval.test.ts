/**
 * Second-brain retrieval-precision harness
 * (road-to-second-brain-retrieval-precision). Live model arms are spend-bearing
 * and NOT exercised; the deterministic surfaces (real retrieval, precision@k,
 * tie-set, sign test, dry-run wiring) are.
 */
import { describe, expect, it } from 'vitest';

import {
    bindStore,
    loadCorpus,
    retrieveFor,
    run,
    signTestP,
} from '../../src/scripts/second_brain_retrieval.js';

describe('signTestP', () => {
    it('matches the exact binomial two-sided tail', () => {
        expect(signTestP(8, 0)).toBeCloseTo(2 / 256, 6);
        expect(signTestP(3, 3)).toBe(1);
        expect(signTestP(0, 0)).toBe(1);
    });
});

describe('retrieveFor — real memory_lookup against the store', () => {
    it('recalls the needed decision into the top-k and reports the tie-set', () => {
        bindStore();
        const { tasks, type, k } = loadCorpus();
        for (const task of tasks) {
            const r = retrieveFor(task, type, k);
            expect(r.rank).toBeGreaterThanOrEqual(0); // needed entry is retrieved at all
            expect(r.rank).toBeLessThan(k); // and within top-k
            expect(r.topk.map((x) => x.id)).toContain(task.needed);
            expect(r.tieSetSize).toBeGreaterThanOrEqual(1);
        }
    });

    it('confusers create a tie-set > 1 (the discrimination signal)', () => {
        bindStore();
        const { tasks, type, k } = loadCorpus();
        const maxTie = Math.max(...tasks.map((t) => retrieveFor(t, type, k).tieSetSize));
        expect(maxTie).toBeGreaterThan(1); // keyword scorer does not rank — proves the store bites
    });
});

describe('run --dry-run', () => {
    it('reports real precision@k + tie-set with stubbed arms, no spend', async () => {
        const report = await run({ mode: 'dry-run', host: 'stub', seeds: 3 });
        expect((report.cost as { calls: number }).calls).toBe(0);
        expect(report.precision_at_k).toBe(1); // 9/9 recalled at k=5 at this scale
        expect(report.mean_tie_set_size as number).toBeGreaterThan(1);
        const agg = report.aggregate as Record<string, { pass: number; total: number }>;
        expect(agg['retrieval-on']!.pass).toBe(agg['retrieval-on']!.total);
        expect(agg['retrieval-off']!.pass).toBe(0);
        expect(agg['placebo']!.pass).toBe(0);
        expect(report.verdict).toBe('PASS');
    });
});
