import { describe, expect, it } from 'vitest';

import {
    changedSymbols,
    decideBars,
    graphOnlySet,
    majoritySet,
    packetFor,
    parseFiles,
    parseOldRanges,
    renderB1,
    renderB2,
    scoreCase,
    type CaseScore,
    type Payload,
} from '../../../internal/bench/code-graph/counterfactual_review.js';
import type { CodeNode } from '../../../src/scripts/code_graph/types.js';

const node = (id: string, kind: CodeNode['kind'], loc: number[]) => ({ id, label: id.split('#')[1] ?? id, kind, source_file: id.split('#')[0] as string, source_location: loc });

describe('parseOldRanges', () => {
    it('reads the parent side of modified, deleted and pure-insertion hunks', () => {
        const diff = [
            'diff --git a/src/a.ts b/src/a.ts',
            '--- a/src/a.ts',
            '+++ b/src/a.ts',
            '@@ -10,3 +10,4 @@ fn',
            '@@ -20 +21 @@',
            '@@ -30,0 +32,2 @@',
            'diff --git a/src/new.ts b/src/new.ts',
            '--- /dev/null',
            '+++ b/src/new.ts',
            '@@ -0,0 +1,5 @@',
        ].join('\n');
        expect(parseOldRanges(diff)).toEqual([
            { file: 'src/a.ts', start: 10, end: 12 },
            { file: 'src/a.ts', start: 20, end: 20 },
            { file: 'src/a.ts', start: 30, end: 30 },
        ]);
    });
});

describe('changedSymbols', () => {
    const nodes = [
        node('src/a.ts', 'file', []),
        node('src/a.ts#C', 'class', [1, 1, 40, 2]),
        node('src/a.ts#C::run', 'method', [5, 3, 12, 4]),
        node('src/a.ts#helper', 'function', [20, 1, 25, 2]),
        node('tests/a.test.ts#t', 'function', [1, 1, 9, 2]),
    ];
    const isSource = (f: string) => f.startsWith('src/');

    it('takes the innermost declaration and marks a touched first line as a signature change', () => {
        const out = changedSymbols(nodes, [{ file: 'src/a.ts', start: 7, end: 8 }, { file: 'src/a.ts', start: 20, end: 21 }], isSource);
        expect(out).toEqual([
            { id: 'src/a.ts#C::run', signature_touched: false },
            { id: 'src/a.ts#helper', signature_touched: true },
        ]);
    });

    it('ignores ranges outside every declaration and files the predicate rejects', () => {
        expect(changedSymbols(nodes, [{ file: 'src/a.ts', start: 50, end: 51 }, { file: 'tests/a.test.ts', start: 2, end: 2 }], isSource)).toEqual([]);
    });
});

describe('parseFiles and majoritySet', () => {
    it('extracts and normalises the file list, and refuses a malformed reply', () => {
        expect(parseFiles('Sure.\n```json\n{"files": ["./src/b.ts", "a/src/c.ts:12", "src/b.ts"]}\n```')).toEqual(['src/b.ts', 'src/c.ts']);
        expect(parseFiles('no json here')).toBeNull();
        expect(parseFiles('{"files": "src/b.ts"}')).toBeNull();
    });

    it('keeps a file named by more than half of the valid runs', () => {
        expect(majoritySet([['x', 'y'], ['x'], ['z']])).toEqual(['x']);
        expect(majoritySet([['x'], null, ['x', 'y']])).toEqual(['x']);
        expect(majoritySet([null, null, null])).toBeNull();
    });
});

describe('packets', () => {
    const payload: Payload = {
        checks: [
            { id: 'untested-change', status: 'finding', items: [{ label: 'run', verdict: 'untested', witness: 'src/a.ts:5' }] },
            { id: 'missing-co-change', status: 'unknown', reason: 'shallow clone', items: [] },
        ],
        reads: [{ path: 'src/a.ts', lines: [5, 12] }, { path: 'src/b.ts', lines: [3, 9] }],
    };

    it('carries every fact of the payload in both B1 and B2', () => {
        for (const text of [renderB1(payload), renderB2(payload)]) {
            for (const fact of ['untested-change', 'finding', 'run', 'untested', 'src/a.ts:5', 'missing-co-change', 'unknown', 'shallow clone', 'src/b.ts']) expect(text).toContain(fact);
        }
        expect(renderB1(payload)).toContain('src/b.ts:3-9');
        expect(renderB2(payload)).toContain('src/b.ts lines 3 to 9');
    });

    it('gives arm A the diff alone and differs between arms only after the pull request', () => {
        const a = packetFor('A', 'T', 'DIFF', payload);
        const b1 = packetFor('B1', 'T', 'DIFF', payload);
        expect(a).not.toContain('Recommended reads');
        expect(b1.startsWith(a.slice(0, a.indexOf('END PULL REQUEST') + 'END PULL REQUEST'.length))).toBe(true);
    });

    it('reads arm G off the read list, outside the diff', () => {
        expect(graphOnlySet(payload, new Set(['src/a.ts']))).toEqual(['src/b.ts']);
    });
});

describe('scoring', () => {
    const diff = new Set(['src/a.ts']);

    it('scores hits, recall and extras outside the diff, and the two bar quantities', () => {
        const s = scoreCase('c1', ['src/b.ts', 'src/c.ts'], { A: ['src/b.ts', 'src/a.ts'], B1: ['src/b.ts', 'src/c.ts', 'src/z.ts'], B2: null }, diff);
        expect(s.hits).toEqual({ A: 1, B1: 2 });
        expect(s.recall).toEqual({ A: 0.5, B1: 1, B2: null });
        expect(s.extra).toEqual({ A: 0, B1: 1 });
        expect(s.b1_catches).toBe(1);
        expect(s.b1_unsupported).toBe(1);
        expect(s.invalid_arms).toEqual(['B2']);
    });

    const row = (id: string, a: number, b1: number, catches: number, unsupported: number): CaseScore => ({
        id,
        truth: 2,
        hits: {},
        recall: { A: a, B1: b1, B2: a },
        extra: {},
        b1_catches: catches,
        b1_unsupported: unsupported,
        invalid_arms: [],
    });

    it('lifts the advisory status only when both bars and the direction pass', () => {
        const winning = Array.from({ length: 10 }, (_, i) => row(`w${String(i)}`, 0.5, 1, 1, 0));
        const lifted = decideBars(winning);
        expect(lifted.bar_i).toBe(true);
        expect(lifted.bar_ii).toBe(true);
        expect(lifted.b1_vs_a.kind).toBe('pass');
        expect(lifted.advisory_lifted).toBe(true);

        const noisy = winning.map((r, i) => (i < 2 ? { ...r, b1_unsupported: 1 } : r));
        expect(decideBars(noisy).bar_ii).toBe(false);
        expect(decideBars(noisy).advisory_lifted).toBe(false);

        const rare = winning.map((r, i) => (i < 7 ? { ...r, b1_catches: 0, recall: { A: 1, B1: 1, B2: 1 } } : r));
        expect(decideBars(rare).bar_i).toBe(false);
    });
});
