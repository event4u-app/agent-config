import { describe, expect, it } from 'vitest';

import { type ArmAnswer, classSummary, scoreAnswer, strictTruthFromDoc, truthFromDoc, type TruthDoc } from '../../../internal/bench/code-graph/run_bench_v3.js';

const answer = (files: string[]): ArmAnswer => ({ status: 'ANSWERED', files: new Set(files), confidence: new Map(), raw: [] });

const doc: TruthDoc = {
    human_check: { sample: [], checked_by: 'council' },
    items: [
        { id: 'lb', status: 'oracle-partial', files: ['a.php', 'b.php'], checked: 'corrected', lower_bound: true },
        { id: 'st', status: 'oracle-partial', files: ['a.php', 'b.php', 'c.php', 'tests/FakeTest.php'], checked: 'corrected', two_voice_files: ['c.php'], faked_files: ['tests/FakeTest.php'] },
        { id: 'pl', status: 'oracle', files: ['a.php'] },
    ],
};

describe('lower_bound — recall-only (registration § Residual strata, item 2)', () => {
    it('carries the marking into the truth and leaves precision uncomputed', () => {
        const t = truthFromDoc({ id: 'lb' }, doc);
        expect(t).toEqual({ kind: 'set', files: ['a.php', 'b.php'], lowerBound: true });
        const s = scoreAnswer(answer(['a.php', 'x.php']), t as Exclude<typeof t, 'void'>);
        expect(s).toMatchObject({ status: 'SCORED', recall: 0.5, precision: null });
    });

    it('keeps a recall-only item out of the class mean precision, but in the mean recall', () => {
        const lb = scoreAnswer(answer(['a.php', 'x.php', 'y.php']), { kind: 'set', files: ['a.php', 'b.php'], lowerBound: true });
        const full = scoreAnswer(answer(['q.php']), { kind: 'set', files: ['q.php'] });
        expect(classSummary([lb, full])).toMatchObject({ status: 'SCORED', precision: 1, recall: 0.75 });
    });
});

describe('strict stratum (items 1 and 3)', () => {
    it('removes two-voice and faked files from the truth, and nothing else', () => {
        expect(strictTruthFromDoc({ id: 'st' }, doc)).toEqual({ kind: 'set', files: ['a.php', 'b.php'] });
        expect(strictTruthFromDoc({ id: 'pl' }, doc)).toEqual({ kind: 'set', files: ['a.php'] });
    });

    it('leaves the full truth untouched by the markings', () => {
        expect(truthFromDoc({ id: 'st' }, doc)).toEqual({ kind: 'set', files: ['a.php', 'b.php', 'c.php', 'tests/FakeTest.php'] });
    });
});
