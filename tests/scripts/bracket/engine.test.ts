// road-to-a-loss-that-can-be-appealed — the bracket engine's refusals and its
// one guarantee: every bracket ends with exactly one line.

import { describe, expect, it } from 'vitest';

import {
    alive,
    BracketError,
    collect,
    correct,
    decide,
    declineAppeal,
    dedupeWave,
    finalCompare,
    initState,
    markDuplicate,
    markOutputs,
    MAX_CARDS,
    next,
    pairRound,
    playCard,
    renderBrief,
    total,
    type BracketState,
    type Scores,
    type Seat,
    type Verdict,
} from '../../../src/scripts/bracket/engine.js';
import { simulateOnce } from '../../../src/scripts/bracket/simulate.js';

const PAID: Seat = { id: 'p', family: 'fam-a', billing: 'per-token' };
const FREE: Seat = { id: 'f', family: 'fam-b', billing: 'free-quota' };

function flat(v: number): Scores {
    return { correctness: v, requirements: v, robustness: v, clarity: v, efficiency: v };
}

function verdict(a: number, b: number, extra: Partial<Verdict> = {}): Verdict {
    return { a: flat(a), b: flat(b), fatal: { a: 'none', b: 'none' }, pick: a >= b ? 'a' : 'b', seat: PAID, ...extra };
}

function started(n: number, seed = 3, auditRate = 0): BracketState {
    const s = initState({ runId: 't', task: 'task', n, seed, tier: 'S1', auditRate });
    markOutputs(s, new Set(s.lines.map((l) => l.id)));
    pairRound(s);
    return s;
}

describe('scoring is the script, not the judge', () => {
    it('totals the weighted rubric to 0–100', () => {
        expect(total(flat(10))).toBe(100);
        expect(total(flat(0))).toBe(0);
    });
    it('points overrule a contradicting pick and say so', () => {
        const d = decide({ ...verdict(8, 6), pick: 'b' });
        expect(d.winner).toBe('a');
        expect(d.notes.join()).toMatch(/overruled by points/);
    });
    it('an upheld FATAL loses lexicographically, whatever the points', () => {
        expect(decide({ ...verdict(9, 2), fatal: { a: 'upheld', b: 'none' } }).winner).toBe('b');
    });
    it('a rebutted FATAL does not decide', () => {
        expect(decide({ ...verdict(9, 2), fatal: { a: 'rebutted', b: 'none' } }).winner).toBe('a');
    });
});

describe('ADR-257 made mechanical: who may carry a verdict', () => {
    it('refuses a verdict carried by a free-quota seat', () => {
        const s = started(2);
        const m = s.matches[0]?.id ?? '';
        expect(() => collect(s, m, verdict(7, 6, { seat: FREE }))).toThrow(/free-quota/);
        expect(s.matches[0]?.winner).toBeNull();
    });
    it('refuses an unreadable verdict instead of letting the orchestrator pick', () => {
        const s = started(2);
        expect(() => collect(s, s.matches[0]?.id ?? '', { pick: 'a' })).toThrow(BracketError);
    });
    it('refuses a card played by a free-quota seat', () => {
        const s = started(2);
        const m = collect(s, s.matches[0]?.id ?? '', verdict(6, 6.2));
        expect(m.appeal).toBe('open');
        expect(() => playCard(s, m.loser ?? '', { seat: FREE, newEvidence: true })).toThrow(/free-quota/);
    });
});

describe('the appeal card', () => {
    it('opens an appeal on a close gap and never on a clear loss without signals', () => {
        const s = started(4, 3, 0);
        const [m1, m2] = s.matches;
        expect(collect(s, m1?.id ?? '', verdict(6, 6.3)).appeal).toBe('open');
        expect(collect(s, m2?.id ?? '', verdict(9, 2)).appeal).toBeNull();
    });
    it('a line spends at most two cards; the second needs new evidence', () => {
        const s = initState({ runId: 't', task: 'x', n: 2, seed: 1, tier: 'S1', auditRate: 0 });
        markOutputs(s, new Set(['L001', 'L002']));
        const loseAgain = (): string => {
            pairRound(s);
            const m = s.matches[s.matches.length - 1];
            const loserIsA = m?.a === 'L002';
            return collect(s, m?.id ?? '', loserIsA ? verdict(6, 6.2) : verdict(6.2, 6)).loser ?? '';
        };
        expect(loseAgain()).toBe('L002');
        playCard(s, 'L002', { seat: PAID, newEvidence: false });
        expect(loseAgain()).toBe('L002');
        expect(() => playCard(s, 'L002', { seat: PAID, newEvidence: false })).toThrow(/new evidence/);
        playCard(s, 'L002', { seat: PAID, newEvidence: true });
        expect(loseAgain()).toBe('L002');
        expect(s.matches[s.matches.length - 1]?.appeal).toBeNull();
        expect(s.lines.find((l) => l.id === 'L002')?.cards).toBe(MAX_CARDS);
        expect(next(s)).toEqual({ kind: 'done', winner: 'L001' });
    });
    it('a paraphrase cannot reset the counter: cards are counted on the lineage', () => {
        const s = initState({ runId: 't', task: 'x', n: 3, seed: 1, tier: 'S1', auditRate: 0 });
        markOutputs(s, new Set(['L001', 'L002', 'L003']));
        markDuplicate(s, 'L003', 'L002');
        const l3 = s.lines.find((l) => l.id === 'L003');
        if (l3) l3.cards = 2;
        pairRound(s);
        const m = s.matches[0];
        const loser = collect(s, m?.id ?? '', m?.a === 'L002' ? verdict(6, 6.2) : verdict(6.2, 6)).loser;
        expect(loser).toBe('L002');
        expect(() => playCard(s, 'L002', { seat: PAID, newEvidence: true })).toThrow(/spent 2 cards/);
    });
    it('no card while an upheld FATAL stands', () => {
        const s = started(2);
        const m = collect(s, s.matches[0]?.id ?? '', { ...verdict(6, 6.2), fatal: { a: 'upheld', b: 'none' } });
        expect(m.appeal).toBeNull();
    });
    it('the returnee meets a new opponent while one exists, and the winner stays in', () => {
        const s = started(4, 5, 0);
        const [m1, m2] = s.matches;
        const r1 = collect(s, m1?.id ?? '', verdict(6, 6.2));
        collect(s, m2?.id ?? '', verdict(9, 1));
        playCard(s, r1.loser ?? '', { seat: PAID, newEvidence: false });
        expect(alive(s).map((l) => l.id)).toContain(r1.winner);
        const round2 = pairRound(s);
        const own = round2.find((m) => m.a === r1.loser || m.b === r1.loser);
        expect([own?.a, own?.b]).not.toContain(r1.winner);
    });
    it('a judging error is corrected without spending a card', () => {
        const s = started(2);
        const m = collect(s, s.matches[0]?.id ?? '', verdict(6, 6.2));
        const before = m.loser;
        correct(s, m.id, 'misread-check');
        expect(m.winner).toBe(before);
        expect(s.lines.every((l) => l.cards === 0)).toBe(true);
        expect(() => correct(s, m.id, 'misread-check')).toThrow(/already corrected/);
    });
    it('a declined appeal closes it', () => {
        const s = started(2);
        const m = collect(s, s.matches[0]?.id ?? '', verdict(6, 6.2));
        declineAppeal(s, m.loser ?? '');
        expect(next(s)).toEqual({ kind: 'done', winner: m.winner });
    });
    it('an attached jury must span two families and keep a paid seat', () => {
        const s = started(2);
        const m = collect(s, s.matches[0]?.id ?? '', verdict(6, 6.2));
        expect(() =>
            playCard(s, m.loser ?? '', { seat: PAID, newEvidence: false, jury: { resolution: 'a', seats: [FREE, { ...FREE, id: 'g', family: 'fam-c' }] } }),
        ).toThrow(/paid seat/);
    });
});

describe('completion and briefs', () => {
    it('a missing output is asked for twice, then recorded NO OUTPUT', () => {
        const s = initState({ runId: 't', task: 'x', n: 2, seed: 1, tier: 'S1' });
        markOutputs(s, new Set(['L001']));
        expect(next(s)).toEqual({ kind: 'generate', lines: ['L002'] });
        markOutputs(s, new Set(['L001']));
        expect(s.lines[1]?.status).toBe('no-output');
        expect(next(s)).toEqual({ kind: 'done', winner: 'L001' });
    });
    it('the task travels byte-identical in every brief', () => {
        const task = 'line one\n  indented `code` ünïcode\n';
        for (const angle of [null, 'start from the tests']) expect(renderBrief(task, 'L001', angle).endsWith(task)).toBe(true);
    });
});

describe('termination', () => {
    it.each([1, 2, 3, 7, 10, 20, 100])('every bracket of %i lines ends with exactly one line', (n) => {
        for (let seed = 1; seed <= 25; seed++) {
            for (const cards of [false, true]) {
                const r = simulateOnce({ n, flip: 0.15, sigma: 3, cards, seed, evidence: 0.5 });
                expect(r.winner).toMatch(/^L\d{3}$/);
                expect(r.cards).toBeLessThanOrEqual(2 * n);
            }
        }
    });
});

describe('the blind final comparison', () => {
    it('a verdict that flips with the order is "no clear winner"', () => {
        expect(finalCompare('W', 'B', () => 'first')).toBe('no clear winner');
        expect(finalCompare('W', 'B', (_c, x) => (x === 'W' ? 'first' : 'second'))).toBe('winner');
    });
});

describe('dedupe waves feed the saturation stop', () => {
    it('merges a near-duplicate into its lineage and counts only novel lines', () => {
        const s = initState({ runId: 't', task: 'x', n: 4, seed: 1, tier: 'S1' });
        markOutputs(s, new Set(['L001', 'L002', 'L003', 'L004']));
        const texts = new Map([
            ['L001', 'alpha'],
            ['L002', 'alpha'],
            ['L003', 'beta'],
            ['L004', 'beta'],
        ]);
        const r = dedupeWave(s, texts, (a, b) => a === b, ['L001', 'L002', 'L003', 'L004']);
        expect(r).toEqual({ novel: 2, duplicates: ['L002', 'L004'] });
        expect(s.lines.find((l) => l.id === 'L004')?.lineage).toBe('L003');
        expect(s.waves).toEqual([{ spawned: 4, novel: 2 }]);
    });
});
