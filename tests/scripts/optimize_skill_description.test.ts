import { describe, expect, it } from 'vitest';

import { pairedPick, type TriggerQuery } from '../../src/scripts/optimize_skill_description.js';

const queries = (n: number): TriggerQuery[] => Array.from({ length: n }, (_, i) => ({ q: `q${String(i)}`, trigger: true }));

describe('pairedPick — one selection rule', () => {
    it('does not pick a candidate that is better on one of five held-out queries', () => {
        const fires = (desc: string, q: string): boolean => (desc === 'cand' ? q !== 'q4' : q === 'q0' || q === 'q1' || q === 'q2');
        const r = pairedPick(fires, 'cur', ['cand'], queries(5));
        expect(r.verdicts[0]?.kind).toBe('underpowered');
        expect(r.pick).toBe(0);
    });

    it('picks a candidate that wins enough discordant queries', () => {
        const fires = (desc: string): boolean => desc === 'cand';
        const r = pairedPick(fires, 'cur', ['cand'], queries(8));
        expect(r.verdicts[0]?.kind).toBe('pass');
        expect(r.pick).toBe(1);
    });

    it('corrects across candidates, so five marginal wins pick nothing', () => {
        const fires = (desc: string): boolean => desc !== 'cur';
        const r = pairedPick(fires, 'cur', ['a', 'b', 'c', 'd', 'e'], queries(5));
        expect(r.verdicts.every((v) => v.kind === 'no-change')).toBe(true);
        expect(r.pick).toBe(0);
    });
});
