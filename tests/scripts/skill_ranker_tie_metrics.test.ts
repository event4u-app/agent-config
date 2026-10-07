// `road-to-a-ranker-whose-ties-break-on-signal` 2.1 — the two tie metrics of
// `report_skill_ranker_confusion`.
//
// The fixture half pins the definitions on synthetic rankings. The corpus half
// reproduces the evidence page's figures — 67 of 315 tuning rows and 15 of 75
// sealed rows lost on the alphabet under `keyword-v1` — from the committed
// routing matrix and skill catalogue. Both inputs move, so the corpus half
// asserts their sizes FIRST: a red on the population lines means the corpus or
// the catalogue moved since 2026-10-01 (risk 4), not that the metric broke.
// Reading the sealed slice here is a baseline re-derivation of a published
// count under `keyword-v1`, never a reading under the new flag (D1).
import { describe, expect, it } from 'vitest';

import {
    REPO,
    SKILLS_DIR,
    partitionBySlice,
    readMatrixLabelledPrompts,
} from '../../src/scripts/measure_skill_ranker_baseline.js';
import {
    abstentionReading,
    readRows,
    tieReading,
    type RowReading,
} from '../../src/scripts/report_skill_ranker_confusion.js';
import { _globSkillMd, type RankRow } from '../../src/scripts/skill_tools/score_skill_relevance.js';

const rows: RankRow[] = [
    ['alpha', 40, []],
    ['beta', 40, []],
    ['gamma', 20, []],
];

describe('tieReading — definitions', () => {
    it('a miss inside the top-score block, no flag, is a tie loss', () => {
        expect(tieReading(rows, new Map(), ['beta'], false)).toEqual({ inBlock: true, lostOnTie: true });
    });

    it('a hit is in the block and never a tie loss', () => {
        expect(tieReading(rows, new Map(), ['alpha'], false)).toEqual({ inBlock: true, lostOnTie: false });
    });

    it('a miss below the block is neither', () => {
        expect(tieReading(rows, new Map(), ['gamma'], false)).toEqual({ inBlock: false, lostOnTie: false });
    });

    it('under the flag, a different unrounded score is not a tie loss', () => {
        const raw = new Map([
            ['alpha', 40.2],
            ['beta', 39.8],
        ]);
        expect(tieReading(rows, raw, ['beta'], true)).toEqual({ inBlock: true, lostOnTie: false });
    });

    it('under the flag, an equal unrounded score still is', () => {
        const raw = new Map([
            ['alpha', 40],
            ['beta', 40],
        ]);
        expect(tieReading(rows, raw, ['beta'], true)).toEqual({ inBlock: true, lostOnTie: true });
    });

    it('an empty ranking is neither', () => {
        expect(tieReading([], new Map(), ['beta'], false)).toEqual({ inBlock: false, lostOnTie: false });
    });
});

describe('abstentionReading', () => {
    const hit = (topScore: number): RowReading => ({
        id: 'x',
        expected: ['a'],
        rankedFirst: 'a',
        topScore,
        rankOfExpected: 1,
        expectedInTopScoreBlock: true,
        lostOnTie: false,
    });

    it('counts empties below the threshold beside the hits it suppresses', () => {
        expect(abstentionReading([hit(10), hit(30)], [0, 5, 40], 20)).toEqual({
            empties: 3,
            noSkill: 1,
            threshold: 20,
            abstainedEmpties: 2,
            correctHits: 2,
            hitsLost: 1,
        });
    });

    it('a null threshold reads the no-skill rate only', () => {
        expect(abstentionReading([], [0, 5], null).abstainedEmpties).toBe(0);
    });
});

describe('tie metrics on the committed corpus (keyword-v1)', () => {
    const whole = readMatrixLabelledPrompts(REPO);

    it('the population is the one the evidence page measured', () => {
        expect(whole.length, 'routing-matrix labelled rows moved since 2026-10-01').toBe(390);
        expect(_globSkillMd(SKILLS_DIR).length, 'skill catalogue moved since 2026-10-01').toBe(299);
    });

    it('reproduces 67 of 315 on tuning and 15 of 75 on sealed', () => {
        const tuning = readRows(partitionBySlice(whole, 'tuning'), SKILLS_DIR, 'keyword-v1');
        const sealed = readRows(partitionBySlice(whole, 'sealed'), SKILLS_DIR, 'keyword-v1');
        expect([tuning.length, tuning.filter((r) => r.lostOnTie).length]).toEqual([315, 67]);
        expect([sealed.length, sealed.filter((r) => r.lostOnTie).length]).toEqual([75, 15]);
    }, 120_000);
});
