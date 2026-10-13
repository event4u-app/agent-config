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
        // 299 -> 300 on 2026-10-11: `svg-authoring` landed. Re-measured against
        // the tree rather than loosened, and the canary did exactly what its
        // header says it is for — it reddened on a catalogue move while the
        // metric was intact. The published figures below were re-derived at 300
        // and are UNCHANGED (315/67 tuning, 75/15 sealed), so the evidence page
        // needs no re-take: the new skill scores on no labelled prompt in the
        // routing matrix, which is why a bigger catalogue moved no tie. The
        // labelled-row count is untouched at 390 — the branch added no fixture.
        expect(whole.length, 'routing-matrix labelled rows moved since 2026-10-01').toBe(390);
        expect(_globSkillMd(SKILLS_DIR).length, 'skill catalogue moved since 2026-10-11').toBe(300);
    });

    // 67/15 -> 69/14 on 2026-10-13: the TOKENIZER moved, not the corpus and not
    // the metric. `src/shared/skillRanking.ts` now extracts a Unicode letter
    // class instead of `[a-z][a-z0-9]+`, so a term that used to fragment at an
    // umlaut is one token, and two tuning rows crossed into a tie block while
    // one sealed row crossed out of one. Re-measured against the tree rather
    // than loosened — the canary did what its header says it is for, reddening
    // on a scoring-input change while the metric itself was intact.
    //
    // The evidence page that published 67/15 is a DATED record of a reading
    // taken under the old token class; it is annotated rather than rewritten,
    // because its `idf` narration is about a comparison made that day. The pin
    // below is the live reading, which is what this test is for.
    it('reproduces 69 of 315 on tuning and 14 of 75 on sealed', () => {
        const tuning = readRows(partitionBySlice(whole, 'tuning'), SKILLS_DIR, 'keyword-v1');
        const sealed = readRows(partitionBySlice(whole, 'sealed'), SKILLS_DIR, 'keyword-v1');
        expect([tuning.length, tuning.filter((r) => r.lostOnTie).length]).toEqual([315, 69]);
        expect([sealed.length, sealed.filter((r) => r.lostOnTie).length]).toEqual([75, 14]);
    }, 120_000);
});
