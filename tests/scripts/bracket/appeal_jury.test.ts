import { describe, expect, it } from 'vitest';

import {
    BINDING_UNLOCKED,
    countsAsPaid,
    resolveJuryMode,
    tallyAppealJury,
    type JurorVote,
} from '../../../src/scripts/bracket/appeal_jury.js';
import {
    appealByJury,
    collect,
    declineAppeal,
    initState,
    markOutputs,
    next,
    pairRound,
    playCard,
    type Seat,
    type Verdict,
} from '../../../src/scripts/bracket/engine.js';

const seat = (id: string, family: string, billing: Seat['billing'] = 'subscription'): Seat => ({ id, family, billing });
const vote = (s: Seat, ab: JurorVote['ab'], ba: JurorVote['ba'] = ab): JurorVote => ({ seat: s, ab, ba });

const A = seat('claude', 'anthropic');
const O = seat('codex', 'openai');
const G = seat('gemini', 'google');
const FREE = seat('free-llama', 'meta', 'free-quota');
const LOCAL = seat('local', 'qwen', 'self-hosted');

describe('countsAsPaid', () => {
    it('counts subscriptions and metered seats, never free or self-hosted', () => {
        expect(['subscription', 'per-token'].map((b) => countsAsPaid(seat('x', 'f', b as Seat['billing'])))).toEqual([true, true]);
        expect([FREE, LOCAL].map(countsAsPaid)).toEqual([false, false]);
    });
});

describe('tallyAppealJury', () => {
    it('readmits on a strict majority of consistent paid votes across two families', () => {
        const r = tallyAppealJury([vote(A, 'readmit'), vote(O, 'readmit')]);
        expect(r.outcome).toBe('readmit');
        expect(r.counted).toBe(2);
        expect(r.families).toEqual(['anthropic', 'openai']);
    });
    it('denies on a strict majority against', () => {
        expect(tallyAppealJury([vote(A, 'deny'), vote(O, 'deny'), vote(G, 'readmit')]).outcome).toBe('deny');
    });
    it('a split is inconclusive, never a fall-back to one seat', () => {
        const r = tallyAppealJury([vote(A, 'readmit'), vote(O, 'deny')]);
        expect(r.outcome).toBe('inconclusive');
        expect(r.reason).toMatch(/no strict majority/);
    });
    it('one order-flipping paid juror makes the jury inconclusive, even beside a 2-of-3 majority (D2)', () => {
        const r = tallyAppealJury([vote(A, 'readmit'), vote(G, 'readmit'), vote(O, 'readmit', 'deny')]);
        expect(r.inconsistent).toEqual(['codex']);
        expect(r.outcome).toBe('inconclusive');
        expect(r.reason).toMatch(/inconsistent/);
    });
    it('a duplicate seat is refused, it cannot turn a tie into a majority', () => {
        expect(() => tallyAppealJury([vote(A, 'readmit'), vote(A, 'readmit'), vote(O, 'deny')])).toThrow(/duplicate seat claude/);
    });
    it('unpaid observers never change a decisive paid verdict, however many sit', () => {
        const observers = ['f1', 'f2', 'f3', 'f4'].map((id) => vote(seat(id, `free-${id}`, 'free-quota'), 'deny'));
        const r = tallyAppealJury([vote(A, 'readmit'), vote(O, 'readmit'), ...observers]);
        expect(r.outcome).toBe('readmit');
        expect(r.ignored).toHaveLength(4);
    });
    it('records every juror with both answers, so the claim statistics are reproducible from state', () => {
        const r = tallyAppealJury([vote(A, 'readmit'), vote(O, 'deny', 'readmit'), vote(FREE, 'readmit')]);
        expect(r.votes).toEqual([
            { seat: 'claude', family: 'anthropic', billing: 'subscription', ab: 'readmit', ba: 'readmit', counted: true },
            { seat: 'codex', family: 'openai', billing: 'subscription', ab: 'deny', ba: 'readmit', counted: true },
            { seat: 'free-llama', family: 'meta', billing: 'free-quota', ab: 'readmit', ba: 'readmit', counted: false },
        ]);
    });
    it('free votes never enter the binding tally, whatever they say', () => {
        const r = tallyAppealJury([vote(A, 'readmit'), vote(O, 'deny'), vote(FREE, 'readmit'), vote(LOCAL, 'readmit')]);
        expect(r.counted).toBe(2);
        expect(r.ignored).toEqual(['free-llama', 'local']);
        expect(r.outcome).toBe('inconclusive');
    });
    it('one paid family is under-seated, however many seats it has', () => {
        const r = tallyAppealJury([vote(A, 'readmit'), vote(seat('claude-2', 'anthropic'), 'readmit')]);
        expect(r.outcome).toBe('inconclusive');
        expect(r.reason).toMatch(/two paid families/);
    });
    it('more than five paid seats is refused rather than truncated', () => {
        const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => vote(seat(id, `fam-${i}`), 'readmit'));
        expect(tallyAppealJury(many).outcome).toBe('inconclusive');
        expect(tallyAppealJury(many).reason).toMatch(/at most 5/);
    });
});

describe('resolveJuryMode', () => {
    it('defaults to shadow', () => {
        expect(resolveJuryMode(undefined)).toBe('shadow');
    });
    it('refuses binding while the pre-registered claim is not backed', () => {
        expect(BINDING_UNLOCKED).toBe(false);
        expect(() => resolveJuryMode('binding')).toThrow(/paid-appeal-jury/);
    });
    it('rejects an unknown mode', () => {
        expect(() => resolveJuryMode('vote')).toThrow(/off \| shadow \| binding/);
    });
});

const flat = (v: number) => ({ correctness: v, requirements: v, robustness: v, clarity: v, efficiency: v });
const verdict = (a: number, b: number): Verdict => ({
    a: flat(a),
    b: flat(b),
    fatal: { a: 'none', b: 'none' },
    pick: a >= b ? 'a' : 'b',
    seat: A,
});

function appealable() {
    const s = initState({ runId: 't', task: 'x', n: 2, seed: 1, tier: 'S1', auditRate: 0 });
    markOutputs(s, new Set(['L001', 'L002']));
    pairRound(s);
    const m = collect(s, s.matches[0]?.id ?? '', verdict(6, 6.2));
    return { s, m, loser: m.loser ?? '' };
}

describe('the card seat', () => {
    it('refuses a self-hosted seat like a free one — neither is paid', () => {
        const { s, m, loser } = appealable();
        expect(() => playCard(s, loser, { seat: LOCAL, newEvidence: false })).toThrow(/paid seat/);
        expect(() => playCard(s, loser, { seat: FREE, newEvidence: false })).toThrow(/paid seat/);
        expect(m.appeal).toBe('open');
        expect(s.lines.every((x) => x.cards === 0)).toBe(true);
    });
});

describe('shadow jury on the card', () => {
    it('is recorded on the match and does not change who decides', () => {
        const { s, m, loser } = appealable();
        const jury = tallyAppealJury([vote(A, 'deny'), vote(O, 'deny')]);
        playCard(s, loser, { seat: A, newEvidence: false, jury });
        expect(m.appeal).toBe('card');
        expect(m.jury?.outcome).toBe('deny');
        expect(m.notes.join(' ')).toMatch(/shadow jury: deny/);
    });
    it('is recorded on a decline too', () => {
        const { s, m, loser } = appealable();
        declineAppeal(s, loser, tallyAppealJury([vote(A, 'readmit'), vote(O, 'readmit')]));
        expect(m.jury?.outcome).toBe('readmit');
    });
});

describe('appealByJury (binding path, exercised directly)', () => {
    it('readmits and spends one card', () => {
        const { s, loser } = appealable();
        const l = appealByJury(s, loser, { votes: [vote(A, 'readmit'), vote(O, 'readmit')], newEvidence: false });
        expect(l?.cards).toBe(1);
        expect(l?.status).toBe('alive');
    });
    it('an inconclusive jury leaves the elimination and spends no card', () => {
        const { s, m, loser } = appealable();
        const l = appealByJury(s, loser, { votes: [vote(A, 'readmit'), vote(O, 'deny')], newEvidence: false });
        expect(l).toBeNull();
        expect(m.appeal).toBe('declined');
        expect(m.notes.join(' ')).toMatch(/inconclusive.*no card spent/);
        expect(s.lines.every((x) => x.cards === 0)).toBe(true);
        expect(next(s).kind).toBe('done');
    });
    it('a third readmission is still refused', () => {
        const { s, loser } = appealable();
        s.lines.find((x) => x.id === loser)!.cards = 2;
        expect(() => appealByJury(s, loser, { votes: [vote(A, 'readmit'), vote(O, 'readmit')], newEvidence: true })).toThrow(/cards/);
    });
});
