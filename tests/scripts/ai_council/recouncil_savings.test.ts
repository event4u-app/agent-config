/**
 * Re-council savings reconciliation — step 10.5.
 *
 * The load-bearing assertion in this file is the NULL CONTRACT: three of the
 * four figures step 10.5 names are not observable, because the guard that
 * would produce them persists nothing, and the module must report that as
 * `null` rather than as `0`. A zero would be a claim ("the guard prevented no
 * duplicate"); a null is a fact about the mechanism ("nothing records this").
 *
 * Everything else here is arithmetic over synthetic fixtures — no corpus, no
 * network, no provider call. The real corpus is gitignored and local, so a
 * test may not depend on it; the published figures live in
 * `agents/evidence/analysis/recouncil-savings-reconstruction-2026-08-31.md`
 * and this file pins the code that produced them.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NEAR_DUPLICATE_THRESHOLD } from '../../../src/scripts/ai_council/recouncil_guard.js';
import {
    SAVINGS_LIMITS,
    computeSavings,
    exactRepeats,
    nearDuplicatePairs,
    questionsInPairs,
    readQuestions,
    renderSavings,
} from '../../../src/scripts/ai_council/recouncil_savings.js';
import type { QuestionRecord } from '../../../src/scripts/ai_council/recouncil_savings.js';

let root = '';

function q(rel: string, text: string): void {
    const abs = path.join(root, 'agents/runtime/council/questions', rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text, 'utf8');
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'recouncil-savings-'));
    fs.mkdirSync(path.join(root, 'agents/runtime/council/questions'), { recursive: true });
    fs.mkdirSync(path.join(root, 'agents/runtime/council/responses'), { recursive: true });
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const ALPHA = 'should the council adopt a shared retention policy for artefacts';
const ALPHA_NUDGED = 'should the council adopt a shared retention policy for council artefacts';
const BETA = 'what typography scale fits a dense analytics dashboard on mobile';

describe('the null contract — three figures are not observable', () => {
    it('reports duplicates_prevented, reruns_confirmed and spend_saved_usd as null, never 0', () => {
        q('a.md', ALPHA);
        const s = computeSavings(root);
        expect(s.duplicates_prevented).toBeNull();
        expect(s.reruns_confirmed).toBeNull();
        expect(s.spend_saved_usd).toBeNull();
        // The distinction this test exists for: null is not 0, and a reader who
        // reads `0` would take it as a measured absence of prevented duplicates.
        expect(s.duplicates_prevented).not.toBe(0);
        expect(s.reruns_confirmed).not.toBe(0);
        expect(s.spend_saved_usd).not.toBe(0);
    });

    it('renders them as "not observable", not as a number', () => {
        q('a.md', ALPHA);
        const out = renderSavings(computeSavings(root));
        expect(out).toMatch(/duplicates prevented\s+null \(not observable\)/);
        expect(out).toMatch(/reruns confirmed\s+null \(not observable\)/);
        expect(out).toMatch(/spend saved \(USD\)\s+null \(not observable\)/);
    });

    it('prints both structural limits with the figures rather than footnoting them', () => {
        q('a.md', ALPHA);
        const out = renderSavings(computeSavings(root));
        expect(SAVINGS_LIMITS).toHaveLength(2);
        for (const limit of SAVINGS_LIMITS) expect(out).toContain(limit);
        expect(out).toContain('RECONSTRUCTION, NOT INSTRUMENTATION');
        expect(out).toContain('ACCIDENTAL DENOMINATOR');
    });
});

describe('exact repeats count second and later occurrences only', () => {
    it('counts nothing when every text is distinct', () => {
        const recs: QuestionRecord[] = [
            { rel: 'a', text: ALPHA, sha256: 'h1' },
            { rel: 'b', text: BETA, sha256: 'h2' },
        ];
        expect(exactRepeats(recs)).toHaveLength(0);
    });

    it('counts two repeats for three identical files, not three', () => {
        const recs: QuestionRecord[] = [
            { rel: 'a', text: ALPHA, sha256: 'h1' },
            { rel: 'b', text: ALPHA, sha256: 'h1' },
            { rel: 'c', text: ALPHA, sha256: 'h1' },
        ];
        expect(exactRepeats(recs).map((r) => r.rel)).toEqual(['b', 'c']);
    });
});

describe('near-duplicate sweep at the pre-registered threshold', () => {
    it('does not double-count an exact repeat as a near duplicate', () => {
        const recs: QuestionRecord[] = [
            { rel: 'a', text: ALPHA, sha256: 'h1' },
            { rel: 'b', text: ALPHA, sha256: 'h1' },
        ];
        expect(nearDuplicatePairs(recs)).toHaveLength(0);
    });

    it('pairs two texts at or above the threshold', () => {
        const recs: QuestionRecord[] = [
            { rel: 'a', text: ALPHA, sha256: 'h1' },
            { rel: 'b', text: ALPHA_NUDGED, sha256: 'h2' },
        ];
        const pairs = nearDuplicatePairs(recs);
        expect(pairs).toHaveLength(1);
        expect(pairs[0]?.score).toBeGreaterThanOrEqual(NEAR_DUPLICATE_THRESHOLD);
    });

    it('DENIAL — unrelated texts produce no pair, so a zero means "nothing there"', () => {
        const recs: QuestionRecord[] = [
            { rel: 'a', text: ALPHA, sha256: 'h1' },
            { rel: 'b', text: BETA, sha256: 'h2' },
        ];
        expect(nearDuplicatePairs(recs)).toHaveLength(0);
    });

    it('counts distinct questions in pairs, not pair endpoints', () => {
        expect(
            questionsInPairs([
                { a: 'x', b: 'y', score: 0.9 },
                { a: 'y', b: 'z', score: 0.85 },
            ]),
        ).toBe(3);
    });
});

describe('corpus reconciliation over a synthetic tree', () => {
    it('reconciles questions, distinct hashes, exact repeats and pairs', () => {
        q('a.md', ALPHA);
        q('nested/b.md', ALPHA); // exact repeat, different path
        q('c.md', ALPHA_NUDGED); // near duplicate of both
        q('d.md', BETA); // unrelated
        q('e.txt', ALPHA); // not markdown — must not be read

        const s = computeSavings(root);
        expect(s.questions).toBe(4);
        expect(s.distinct_hashes).toBe(3);
        expect(s.exact_repeat_files).toBe(1);
        // ALPHA appears twice and each copy pairs with ALPHA_NUDGED; the
        // ALPHA↔ALPHA pair is excluded as an exact repeat.
        expect(s.near_duplicate_pairs).toBe(2);
        expect(s.near_duplicate_questions).toBe(3);
        expect(s.threshold).toBe(NEAR_DUPLICATE_THRESHOLD);
    });

    it('reads markdown recursively and ignores other extensions', () => {
        q('a.md', ALPHA);
        q('deep/deeper/b.md', BETA);
        q('c.json', '{}');
        expect(readQuestions(path.join(root, 'agents/runtime/council/questions')).map((r) => r.rel).sort()).toEqual(
            ['a.md', path.join('deep', 'deeper', 'b.md')].sort(),
        );
    });

    it('an empty corpus reconciles to zeros without throwing', () => {
        const s = computeSavings(root);
        expect(s.questions).toBe(0);
        expect(s.near_duplicate_pairs).toBe(0);
        expect(s.prior_runs_readable).toBe(0);
        expect(s.guard_would_flag).toBe(0);
    });
});

describe('the guard replay does not flag a question against its own prior run', () => {
    it('flags zero when the only prior run IS this question', () => {
        q('a.md', ALPHA);
        fs.writeFileSync(
            path.join(root, 'agents/runtime/council/responses/r1.md'),
            `${JSON.stringify({
                artefact: 'agents/runtime/council/questions/a.md',
                members: ['anthropic/x'],
                rounds: 1,
            })}\n\nbody\n`,
            'utf8',
        );
        const s = computeSavings(root);
        expect(s.prior_runs_readable).toBe(1);
        expect(s.prior_runs_with_question_text).toBe(1);
        expect(s.guard_would_flag).toBe(0);
    });

    it('flags one when a DIFFERENT retained question is a near duplicate', () => {
        q('a.md', ALPHA);
        q('b.md', ALPHA_NUDGED);
        fs.writeFileSync(
            path.join(root, 'agents/runtime/council/responses/r1.md'),
            `${JSON.stringify({
                artefact: 'agents/runtime/council/questions/a.md',
                members: ['anthropic/x'],
                rounds: 1,
            })}\n\nbody\n`,
            'utf8',
        );
        // `b` sees `a` as a prior run; `a` sees only itself and is excluded.
        expect(computeSavings(root).guard_would_flag).toBe(1);
    });

    it('counts an artefact with no leading JSON as rejected, not as a prior run', () => {
        q('a.md', ALPHA);
        fs.writeFileSync(path.join(root, 'agents/runtime/council/responses/junk.md'), 'no json here\n', 'utf8');
        const s = computeSavings(root);
        expect(s.prior_runs_readable).toBe(0);
        expect(s.prior_runs_rejected).toBe(1);
    });
});
