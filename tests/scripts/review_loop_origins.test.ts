import { describe, expect, it } from 'vitest';

import {
    agreement,
    leverFor,
    mergeReaders,
    risingShares,
    type ReaderOutput,
} from '../../src/scripts/review_loop_origins.js';

function f(round: number, n: number, cls: string, severity = 'medium'): { id: string; summary: string; severity: string; class: string } {
    return { id: `${round}.${n}`, summary: 's', severity, class: cls };
}

const a: ReaderOutput = {
    subject: 'x',
    round1_findings: 2,
    rounds: [
        { round: 2, visible: true, findings: [f(2, 1, 'fix-introduced'), f(2, 2, 'single-seat'), f(2, 3, 'other')] },
        { round: 3, visible: true, findings: [f(3, 1, 'other')] },
        { round: 4, visible: false, findings: [] },
    ],
};
const b: ReaderOutput = {
    subject: 'x',
    round1_findings: 2,
    rounds: [
        { round: 2, visible: true, findings: [f(2, 1, 'fix-introduced'), f(2, 2, 'single-seat'), f(2, 3, 'other')] },
        { round: 3, visible: true, findings: [f(3, 1, 're-raised'), f(3, 2, 'other')] },
        { round: 4, visible: false, findings: [] },
    ],
};

describe('agreement', () => {
    it('measures per-round class-count overlap and names the disputed rounds', () => {
        const g = agreement(a, b);
        expect(g.disputed).toEqual([3]);
        // round 2: 3 of 3 agree; round 3: min-overlap {other:1} of max {other:1, re-raised:1} → 1 of 2.
        expect(g.overlap).toBeCloseTo(4 / 5);
        expect(g.roundsCompared).toBe(3);
        expect(g.roundsExact).toBe(2);
    });
});

describe('mergeReaders', () => {
    it('keeps agreed rounds and takes the adjudicator on disputed ones', () => {
        const adj: ReaderOutput = { subject: 'x', round1_findings: 2, rounds: [{ round: 3, visible: true, findings: [f(3, 1, 're-raised')] }] };
        const m = mergeReaders(a, b, adj);
        expect(m.rounds.find((r) => r.round === 2)?.findings.map((x) => x.class)).toEqual(['fix-introduced', 'single-seat', 'other']);
        expect(m.rounds.find((r) => r.round === 3)?.findings.map((x) => x.class)).toEqual(['re-raised']);
    });

    it('refuses to merge a disputed round the adjudicator did not settle', () => {
        expect(() => mergeReaders(a, b, { subject: 'x', round1_findings: 2, rounds: [] })).toThrow(/round 3/);
    });
});

describe('risingShares', () => {
    it('pools findings of rising rounds only and folds a deterministic class into `other`', () => {
        const final: ReaderOutput = {
            subject: 'x',
            round1_findings: 1,
            rounds: [
                // 3 > 1 → rising
                { round: 2, visible: true, findings: [f(2, 1, 'fix-introduced'), f(2, 2, 'other'), f(2, 3, 'single-seat')] },
                // 1 < 3 → not rising
                { round: 3, visible: true, findings: [f(3, 1, 'single-seat')] },
                // 2 > 1 → rising
                { round: 4, visible: true, findings: [f(4, 1, 'other'), f(4, 2, 'single-seat')] },
            ],
        };
        const s = risingShares([final], new Map([['x', new Map([[2, ['scope-widened']]])]]));
        expect(s.risingRounds).toBe(2);
        expect(s.total).toBe(5);
        expect(s.counts).toEqual({ 'fix-introduced': 1, 'scope-widened': 1, 'single-seat': 2, other: 1, 're-raised': 0, 'rebind-non-code': 0 });
        const sum = Object.values(s.shares).reduce((x, y) => x + y, 0);
        expect(sum).toBeCloseTo(100);
    });

    it('skips a round whose predecessor is not visible', () => {
        const final: ReaderOutput = {
            subject: 'y',
            round1_findings: null,
            rounds: [{ round: 2, visible: true, findings: [f(2, 1, 'other')] }],
        };
        expect(risingShares([final], new Map()).risingRounds).toBe(0);
    });
});

describe('leverFor', () => {
    it('applies the pre-registered threshold table', () => {
        expect(leverFor({ 'scope-widened': 41, 'single-seat': 30, 'fix-introduced': 29 })).toBe('generated-packet');
        expect(leverFor({ 'single-seat': 45, 'fix-introduced': 20 })).toBe('seat-novelty');
        expect(leverFor({ 'fix-introduced': 60 })).toBe('fix-size');
        expect(leverFor({ 'fix-introduced': 40, 'single-seat': 40, other: 20 })).toBe('criterion-only');
    });
});
