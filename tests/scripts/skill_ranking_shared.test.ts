// The formula pin for `src/shared/skillRanking.ts`.
//
// WHY THIS FILE EXISTS, measured rather than assumed. Phase 1.1 of
// `road-to-skill-delivery-over-mcp` single-sourced the relevance formula so the
// pure stdio dispatcher and the disk-reading ranker cannot drift (risk 6). The
// obvious evidence for "the move changed nothing" was that
// `tests/scripts/score_skill_relevance.test.ts` stayed green — and it is NOT
// evidence: changing the weight from 70 to 71 in the shared module leaves all 15
// of its tests passing. That suite pins the CLI contract (flags, exit codes,
// table bytes), not the arithmetic.
//
// So the arithmetic is pinned here, on synthetic inputs, independent of how the
// skill corpus happens to look on any given day. Sabotage-checked in both
// directions: 70 -> 71 reddens `keyword overlap is weighted 70`, and dropping
// the persona branch reddens `a persona hit adds exactly 30`.
import { describe, expect, it } from 'vitest';

import {
    rankSkills,
    roundHalfToEven,
    scoreSkill,
    skillTerms,
    tokenize,
} from '../../src/shared/skillRanking.js';

describe('skillRanking — tokenizer', () => {
    it('lowercases, splits on the [a-z][a-z0-9]+ shape and drops stopwords', () => {
        expect([...tokenize('Resolve the MERGE conflict in Foo2')].sort()).toEqual([
            'conflict',
            'foo2',
            'merge',
            'resolve',
        ]);
    });

    it('drops tokens of two code points or fewer', () => {
        expect([...tokenize('go to db ci abc')]).toEqual(['abc']);
    });

    it('splits hyphenated names into their parts', () => {
        expect([...tokenize('merge-conflicts')].sort()).toEqual(['conflicts', 'merge']);
    });
});

describe('skillRanking — the formula', () => {
    const skill = { name: 'merge-conflicts', description: 'resolve merge conflicts' };

    it('keyword overlap is weighted 70', () => {
        // task terms: merge, conflict, rebase (3). skill terms: merge,
        // conflicts, resolve. Intersection is {merge} only — `conflict` does not
        // match `conflicts`, the tokenizer does no stemming. 1/3 * 70 = 23.33.
        const task = tokenize('merge conflict rebase');
        expect(task.size).toBe(3);
        expect(scoreSkill(task, skill, skillTerms(skill))).toBe(23);
    });

    it('a full overlap scores exactly 70 without a persona', () => {
        const task = tokenize('merge conflicts resolve');
        expect(scoreSkill(task, skill, skillTerms(skill))).toBe(70);
    });

    it('a persona hit adds exactly 30', () => {
        const withPersona = { ...skill, personas: ['reviewer'] };
        const task = tokenize('merge conflicts resolve reviewer');
        // overlap 3/4 = 52.5 -> half-to-even -> 52, plus 30.
        expect(scoreSkill(task, withPersona, skillTerms(withPersona))).toBe(82);
        // Same task, no persona declared: the 30 is gone and only overlap remains.
        expect(scoreSkill(task, skill, skillTerms(skill))).toBe(52);
    });

    it('matches a persona by one hyphen-separated part', () => {
        const s = { name: 'x', description: '', personas: ['security-auditor'] };
        expect(scoreSkill(tokenize('auditor review'), s, skillTerms(s))).toBe(30);
    });

    it('an empty task scores zero, never NaN', () => {
        expect(scoreSkill(tokenize('a of the'), skill, skillTerms(skill))).toBe(0);
    });

    it('rounds half to even, like Python round()', () => {
        expect(roundHalfToEven(0.5)).toBe(0);
        expect(roundHalfToEven(1.5)).toBe(2);
        expect(roundHalfToEven(2.5)).toBe(2);
        expect(roundHalfToEven(52.5)).toBe(52);
    });
});

describe('skillRanking — triggers are opt-in (Phase 3.1)', () => {
    const skill = {
        name: 'authz-review',
        description: 'review authorization',
        triggerText: ['permission check', 'tenant scope'],
    };

    it('ignores trigger text by default (keyword-v1)', () => {
        expect(skillTerms(skill).has('tenant')).toBe(false);
        expect(scoreSkill(tokenize('tenant scope'), skill, skillTerms(skill))).toBe(0);
    });

    it('indexes trigger text when asked (keyword-v2)', () => {
        const terms = skillTerms(skill, { includeTriggers: true });
        expect(terms.has('tenant')).toBe(true);
        expect(scoreSkill(tokenize('tenant scope'), skill, terms)).toBe(70);
    });
});

describe('skillRanking — rankSkills', () => {
    const skills = [
        { name: 'zebra', description: 'merge things' },
        { name: 'alpha', description: 'merge things' },
        { name: 'unrelated', description: 'nothing at all here' },
    ];

    it('drops zero scores and breaks ties on name', () => {
        const rows = rankSkills('merge things', skills);
        expect(rows.map((r) => r.name)).toEqual(['alpha', 'zebra']);
        expect(rows[0]!.score).toBe(70);
    });

    it('returns an empty list rather than throwing on an unmatchable task', () => {
        expect(rankSkills('zzzzqqq', skills)).toEqual([]);
    });
});
