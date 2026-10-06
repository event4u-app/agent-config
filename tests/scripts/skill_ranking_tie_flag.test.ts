// `road-to-a-ranker-whose-ties-break-on-signal` 3.1 — the `tieBreakUnrounded`
// flag orders a block of equal INTEGER scores by the unrounded score, and with
// the flag off the order is the Python-parity `(-score, name)` one.
//
// The fixture tie is built so both halves are observable: a task of 200
// distinct terms makes each matched term worth 0.35 points, so 65 matches
// (22.75) and 66 matches (23.10) both round to 23 while their unrounded scores
// differ. Off, the alphabet puts `aaa-skill` first; on, the larger unrounded
// score puts `zzz-skill` first. Sabotage-checked: making `compareRanked`
// ignore the flag reddens `the flag reorders a fixture tie`.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    compareRanked,
    rankSkills,
    rawSkillScore,
    scoreSkill,
    skillTerms,
    tokenize,
} from '../../src/shared/skillRanking.js';
import { rank, rankDetailed } from '../../src/scripts/skill_tools/score_skill_relevance.js';

const TERMS = Array.from({ length: 200 }, (_, i) => `tok${String(i)}`);
const TASK = TERMS.join(' ');
const AAA = { name: 'aaa-skill', description: TERMS.slice(0, 65).join(' ') };
const ZZZ = { name: 'zzz-skill', description: TERMS.slice(0, 66).join(' ') };

describe('tieBreakUnrounded — the fixture is a real tie', () => {
    it('both skills round to the same integer and differ unrounded', () => {
        const t = tokenize(TASK);
        expect(scoreSkill(t, AAA, skillTerms(AAA))).toBe(23);
        expect(scoreSkill(t, ZZZ, skillTerms(ZZZ))).toBe(23);
        expect(rawSkillScore(t, ZZZ, skillTerms(ZZZ))).toBeGreaterThan(rawSkillScore(t, AAA, skillTerms(AAA)));
    });
});

describe('tieBreakUnrounded — rankSkills', () => {
    it('flag off: the alphabet decides the tie, scores unchanged', () => {
        const rows = rankSkills(TASK, [ZZZ, AAA]);
        expect(rows.map((r) => [r.name, r.score])).toEqual([
            ['aaa-skill', 23],
            ['zzz-skill', 23],
        ]);
    });

    it('the flag reorders a fixture tie, and changes no score', () => {
        const rows = rankSkills(TASK, [AAA, ZZZ], { tieBreakUnrounded: true });
        expect(rows.map((r) => [r.name, r.score])).toEqual([
            ['zzz-skill', 23],
            ['aaa-skill', 23],
        ]);
    });

    it('an exact unrounded tie still falls back to the name', () => {
        const twin = { name: 'mmm-skill', description: AAA.description };
        const rows = rankSkills(TASK, [twin, AAA], { tieBreakUnrounded: true });
        expect(rows.map((r) => r.name)).toEqual(['aaa-skill', 'mmm-skill']);
    });
});

describe('compareRanked', () => {
    const raw = new Map([
        ['a', 1],
        ['b', 2],
    ]);
    it('score first, whatever the flag', () => {
        expect(compareRanked('a', 30, 'b', 20, { tieBreakUnrounded: true }, raw)).toBeLessThan(0);
    });
    it('equal score: name when off, unrounded when on', () => {
        expect(compareRanked('a', 20, 'b', 20, {}, raw)).toBeLessThan(0);
        expect(compareRanked('a', 20, 'b', 20, { tieBreakUnrounded: true }, raw)).toBeGreaterThan(0);
    });
});

describe('tieBreakUnrounded — the disk ranker agrees', () => {
    const dirs: string[] = [];
    afterEach(() => {
        for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    });

    function catalogue(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tie-flag-'));
        dirs.push(root);
        for (const s of [AAA, ZZZ]) {
            fs.mkdirSync(path.join(root, s.name));
            fs.writeFileSync(
                path.join(root, s.name, 'SKILL.md'),
                `---\nname: ${s.name}\ndescription: "${s.description}"\n---\n# ${s.name}\n`,
            );
        }
        return root;
    }

    it('flag off matches rank(); flag on reorders the tie', () => {
        const root = catalogue();
        const off = rank(TASK, root);
        expect(off.map((r) => [r[0], r[1]])).toEqual([
            ['aaa-skill', 23],
            ['zzz-skill', 23],
        ]);
        expect(rankDetailed(TASK, root).rows).toEqual(off);
        const on = rank(TASK, root, { tieBreakUnrounded: true });
        expect(on.map((r) => [r[0], r[1]])).toEqual([
            ['zzz-skill', 23],
            ['aaa-skill', 23],
        ]);
    });
});
