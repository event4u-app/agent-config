// Falsification suite for the anchor-evaluation instrument (ADR-202 § Scorer
// falsification), deterministic half — no API.
//
// The instrument lost `inconsistency_rate`, the diagnostic that caught run 3's
// unreliability. This is its replacement on the code side: fixtures that pin
// what the aggregation must do, a mutation test proving those fixtures have
// teeth, and a null-scorer guard so a degenerate instrument cannot look like a
// pass. The live half — the same fixtures against the real evaluator models —
// is `src/scripts/anchor_eval_falsify.ts`.

import { describe, expect, it } from 'vitest';

import {
    delta_from_spread,
    eval_prompt,
    key,
    parse_eval,
    per_rule_passes,
    resolve,
    score_arm,
    verdict,
    type ScoreInput,
    type TaskAnchors,
} from '../../src/scripts/_lib/anchor_eval.js';

const TASKS: TaskAnchors[] = [
    { id: 't1', rules: ['rule-a'], must_include: ['states the scope', 'asks first'], must_not: ['expands scope'] },
    { id: 't2', rules: ['rule-b'], must_include: ['names the risk'], must_not: ['invents a fact'] },
];

/** Build a resolved map from a compact spec: [task, arm, kind, index] → hit. */
function resolved(spec: Array<[string, 'thin' | 'eager', 'must_include' | 'must_not', number, boolean]>): ScoreInput {
    const m = new Map<string, boolean>();
    for (const [t, arm, kind, i, hit] of spec) m.set(key(t, arm, kind, i), hit);
    return { tasks: TASKS, resolved: m };
}

/** Everything satisfied on both arms, nothing violated — the clean baseline. */
const ALL_GOOD = resolved([
    ['t1', 'thin', 'must_include', 0, true], ['t1', 'thin', 'must_include', 1, true],
    ['t1', 'eager', 'must_include', 0, true], ['t1', 'eager', 'must_include', 1, true],
    ['t2', 'thin', 'must_include', 0, true], ['t2', 'eager', 'must_include', 0, true],
]);

describe('prompt + parsing', () => {
    it('puts every anchor in one call, tagged so verdicts map back by index', () => {
        const p = eval_prompt('do X', 'an answer', ['a1', 'a2'], ['n1']);
        expect(p).toContain('I0. MUST BE PRESENT: a1');
        expect(p).toContain('I1. MUST BE PRESENT: a2');
        expect(p).toContain('N0. MUST BE ABSENT: n1');
    });

    it('tells the evaluator to ignore length — the confound that closed paired judging', () => {
        expect(eval_prompt('p', 'a', ['x'], [])).toMatch(/do not reward or penalise length/i);
    });

    it('parses well-formed replies', () => {
        const r = parse_eval('I0=yes\nI1=no\nN0=yes', 2, 1);
        expect(r.include).toEqual([true, false]);
        expect(r.not).toEqual([true]);
    });

    it('returns null for items the evaluator never answered', () => {
        const r = parse_eval('I0=yes', 2, 1);
        expect(r.include).toEqual([true, null]);
        expect(r.not).toEqual([null]);
    });

    it('is not fooled by prose around the verdicts', () => {
        const r = parse_eval('Sure! Here you go:\n  I0 = no \nbecause ...\nN0= yes\n', 1, 1);
        expect(r.include).toEqual([false]);
        expect(r.not).toEqual([true]);
    });
});

describe('conservative disagreement resolution (ADR-202 (c))', () => {
    it('must_include passes only when BOTH evaluators say satisfied', () => {
        expect(resolve('must_include', true, true)).toBe(true);
        expect(resolve('must_include', true, false)).toBe(false);
        expect(resolve('must_include', false, true)).toBe(false);
    });

    it('must_not counts as violated when EITHER says violated', () => {
        expect(resolve('must_not', true, false)).toBe(true);
        expect(resolve('must_not', false, true)).toBe(true);
        expect(resolve('must_not', false, false)).toBe(false);
    });

    it('treats an unparsed verdict as the unfavourable reading, never a pass', () => {
        expect(resolve('must_include', true, null)).toBe(false);
        expect(resolve('must_not', false, null)).toBe(true);
    });
});

describe('known-good / known-bad fixtures', () => {
    it('known-good: clean corpus passes every registered threshold', () => {
        const v = verdict(ALL_GOOD, { kappa: 0.9 });
        expect(v.must_not_ok).toBe(true);
        expect(v.non_inferiority_ok).toBe(true);
        expect(v.per_rule_floor_ok).toBe(true);
        expect(v.pass).toBe(true);
    });

    it('known-bad: a must_not violation thin INTRODUCES fails, zero tolerance', () => {
        const m = new Map(ALL_GOOD.resolved);
        m.set(key('t1', 'thin', 'must_not', 0), true);
        const v = verdict({ tasks: TASKS, resolved: m }, { kappa: 0.9 });
        expect(v.must_not_ok).toBe(false);
        expect(v.pass).toBe(false);
    });

    it('known-good: a must_not violation BOTH arms share is not thin regressing', () => {
        const m = new Map(ALL_GOOD.resolved);
        m.set(key('t1', 'thin', 'must_not', 0), true);
        m.set(key('t1', 'eager', 'must_not', 0), true);
        const v = verdict({ tasks: TASKS, resolved: m }, { kappa: 0.9 });
        expect(v.must_not_ok).toBe(true);
    });

    it('known-bad: a rule dropping to zero passes under thin trips the floor', () => {
        const m = new Map(ALL_GOOD.resolved);
        m.set(key('t2', 'thin', 'must_include', 0), false);
        const v = verdict({ tasks: TASKS, resolved: m }, { kappa: 0.9 });
        expect(v.per_rule_floor_ok).toBe(false);
        expect(v.per_rule_floor_breaches).toContain('rule-b');
        expect(v.pass).toBe(false);
    });

    it('known-bad: κ under the floor fails the INSTRUMENT regardless of scores', () => {
        const v = verdict(ALL_GOOD, { kappa: 0.79 });
        expect(v.instrument_ok).toBe(false);
        expect(v.pass).toBe(false);
    });

    it('known-bad: δ above the ceiling is not auto-registered', () => {
        // Maximal per-task spread: thin wins one task outright, loses the other.
        const v = verdict(resolved([
            ['t1', 'thin', 'must_include', 0, true], ['t1', 'thin', 'must_include', 1, true],
            ['t1', 'eager', 'must_include', 0, false], ['t1', 'eager', 'must_include', 1, false],
            ['t2', 'thin', 'must_include', 0, false], ['t2', 'eager', 'must_include', 0, true],
        ]), { kappa: 0.9 });
        expect(v.delta_pp).toBeGreaterThan(3);
        expect(v.delta_registered).toBe(false);
        expect(v.pass).toBe(false);
    });
});

describe('null-scorer guard', () => {
    it('an instrument that answers "satisfied" to everything cannot reach a pass', () => {
        // Degenerate evaluator: every must_include true, every must_not true.
        const m = new Map<string, boolean>();
        for (const t of TASKS) {
            for (const arm of ['thin', 'eager'] as const) {
                t.must_include.forEach((_, i) => m.set(key(t.id, arm, 'must_include', i), true));
                t.must_not.forEach((_, i) => m.set(key(t.id, arm, 'must_not', i), true));
            }
        }
        // Rates are identical, so non-inferiority is trivially met — the guard has
        // to come from somewhere else, and it does: κ is measured, not assumed.
        expect(verdict({ tasks: TASKS, resolved: m }, { kappa: 0.5 }).pass).toBe(false);
    });

    it('an empty verdict map scores zero, never a silent pass on absent data', () => {
        const v = verdict({ tasks: TASKS, resolved: new Map() }, { kappa: 0.9 });
        expect(v.thin.include_pass).toBe(0);
        expect(v.eager.include_pass).toBe(0);
        expect(v.per_rule_floor_ok).toBe(true); // eager has 0 too — no false breach
        expect(v.thin.rate).toBe(0);
    });
});

describe('mutation test — every mutant must die against the fixtures', () => {
    // Each mutant is a plausible wrong implementation. If a fixture above does
    // not distinguish it from the real one, the fixtures are decoration.
    const mutants: Array<[string, () => boolean]> = [
        ['must_include resolved with OR instead of AND', () =>
            resolve('must_include', true, false) === (true || false)],
        ['must_not resolved with AND instead of OR', () =>
            resolve('must_not', true, false) === (true && false)],
        ['unparsed verdict treated as a pass', () =>
            resolve('must_include', true, null) === true],
        ['per-rule floor comparing the wrong arm', () => {
            const m = new Map(ALL_GOOD.resolved);
            m.set(key('t2', 'thin', 'must_include', 0), false);
            const thin = per_rule_passes({ tasks: TASKS, resolved: m }, 'thin');
            return thin.get('rule-b') !== 0; // real impl reports 0 → mutant claims otherwise
        }],
        ['must_not violations counted but never compared to eager', () => {
            const m = new Map(ALL_GOOD.resolved);
            m.set(key('t1', 'thin', 'must_not', 0), true);
            m.set(key('t1', 'eager', 'must_not', 0), true);
            return verdict({ tasks: TASKS, resolved: m }, { kappa: 0.9 }).must_not_ok === false;
        }],
        ['delta computed as mean instead of spread', () =>
            delta_from_spread(ALL_GOOD) !== 0],
        ['rate computed over must_not instead of must_include', () =>
            score_arm(ALL_GOOD, 'thin').include_total !== 3],
    ];

    for (const [name, survives] of mutants) {
        it(`kills: ${name}`, () => {
            expect(survives()).toBe(false);
        });
    }
});
