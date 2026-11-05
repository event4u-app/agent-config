import { describe, expect, it } from 'vitest';

import { truthDocRefusal, truthFromDoc, type TruthDoc } from '../../../internal/bench/code-graph/run_bench_v3.js';

const doc = (over: Partial<TruthDoc['items'][number]>[] = []): TruthDoc => ({
    human_check: { sample: ['s-1'] },
    items: [
        { id: 's-1', status: 'oracle', files: ['a.php'], human_checked: 'agree' },
        { id: 'o-1', status: 'oracle', files: ['b.php', 'c.php'] },
        { id: 'p-1', status: 'oracle-partial', files: ['d.php'] },
        { id: 'h-1', status: 'human-required', files: ['routes/web.php'], human_checked: 'corrected' },
        { id: 'h-2', status: 'human-required', files: [] },
        { id: 'n-1', status: 'void', files: ['e.php'] },
        { id: 'n-2', status: 'confirms-empty', files: [] },
        ...over.map((o) => ({ id: 'x', status: 'oracle', files: [], ...o })),
    ],
});

describe('truthDocRefusal', () => {
    it('refuses while any sampled item lacks a human verdict, naming it', () => {
        const d = doc();
        expect(truthDocRefusal(d)).toBeNull();
        (d.items[0] as { human_checked?: string | null }).human_checked = null;
        expect(truthDocRefusal(d)).toMatch(/s-1/);
        d.human_check.sample.push('missing-id');
        expect(truthDocRefusal(d)).toMatch(/missing-id/);
    });
});

describe('truthFromDoc', () => {
    it('scores a complete oracle answer and a human-sealed one, and leaves the rest pending', () => {
        expect(truthFromDoc({ id: 'o-1' }, doc())).toEqual({ kind: 'set', files: ['b.php', 'c.php'] });
        expect(truthFromDoc({ id: 'h-1' }, doc())).toEqual({ kind: 'set', files: ['routes/web.php'] });
        expect(truthFromDoc({ id: 'p-1' }, doc())).toEqual({ kind: 'pending' });
        expect(truthFromDoc({ id: 'h-2' }, doc())).toEqual({ kind: 'pending' });
    });

    it('voids a negative control the oracle reached, unless a person corrected it', () => {
        expect(truthFromDoc({ id: 'n-1', expected: 'empty' }, doc())).toBe('void');
        expect(truthFromDoc({ id: 'n-2', expected: 'empty' }, doc())).toEqual({ kind: 'expected-empty' });
        const corrected = doc();
        (corrected.items[5] as { human_checked?: string | null }).human_checked = 'corrected';
        expect(truthFromDoc({ id: 'n-1', expected: 'empty' }, corrected)).toEqual({ kind: 'expected-empty' });
    });

    it('falls back to the corpus for a question the truth file does not carry', () => {
        expect(truthFromDoc({ id: 'absent', truth: 'pending-oracle' }, doc())).toEqual({ kind: 'pending' });
    });
});
