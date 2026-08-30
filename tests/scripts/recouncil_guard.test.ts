/**
 * Tests for the re-council guard
 * (`src/scripts/ai_council/recouncil_guard.ts`,
 * road-to-inbox-harvest-2026-08-e-council-topology-evidence Phase 1A).
 *
 * Each step states its verify clause as an observable, and three of the four
 * are NEGATIVES — "a one-token edit is not detected as exact", "no code path
 * can turn the warning into an unconditional block", "a fixture per state
 * renders the matching state AND NO OTHER". Those are the assertions that
 * carry weight here; the accepting cases exist so a guard that fired on
 * everything would not pass either.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { _sha256_hex } from '../../src/scripts/ai_council/blind_review.js';
import {
    checkRecouncil,
    configFingerprint,
    NEAR_DUPLICATE_THRESHOLD,
    readPriorRuns,
    renderRecouncilWarning,
    type PriorRun,
} from '../../src/scripts/ai_council/recouncil_guard.js';
import { jaccardSimilarity, MERGE_THRESHOLD } from '../../src/scripts/_lib/text_similarity.js';

const QUESTION = 'Should the user-scope rule bucket become a gated bucket in the preamble payload budget?';
const CONFIG = configFingerprint(['anthropic/x', 'openai/y'], 2);

function prior(over: Partial<PriorRun> = {}): PriorRun {
    return {
        artifactPath: '/tmp/prior.md',
        questionPath: 'q/prior.md',
        ranAt: '2026-08-29',
        configFingerprint: CONFIG,
        questionHash: _sha256_hex(QUESTION),
        questionText: QUESTION,
        ...over,
    };
}

const made: string[] = [];
afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('1A.1 — exact repeats, on the EXISTING hash', () => {
    it('detects a re-run of a retained question', () => {
        const v = checkRecouncil(QUESTION, CONFIG, [prior()]);
        expect(v?.state).toBe('exact-same-config');
        expect(v?.similarity).toBe(1);
    });

    it('a ONE-TOKEN edit is not detected as exact', () => {
        // The step's own negative. It may well be a near-duplicate — that is a
        // different state — but it must not report as the same question.
        const v = checkRecouncil(`${QUESTION} Also consider cost.`, CONFIG, [prior()]);
        expect(v?.state).not.toBe('exact-same-config');
        expect(v?.state).not.toBe('exact-stale-config');
    });

    it('uses the same hash the council already uses — no second implementation', () => {
        // Asserted by construction: the guard's exact match is `_sha256_hex` of
        // the text, which is the function blind_review seeds stances with.
        const v = checkRecouncil(QUESTION, CONFIG, [prior({ questionHash: _sha256_hex(QUESTION) })]);
        expect(v?.state).toBe('exact-same-config');
    });

    it('a prior whose question file vanished is kept, but cannot match by text', () => {
        const v = checkRecouncil(QUESTION, CONFIG, [prior({ questionHash: null, questionText: null })]);
        expect(v).toBeNull();
    });
});

describe('1A.2 — warn, never prohibit', () => {
    it('the verdict type carries NO field a caller could read as a block', () => {
        const v = checkRecouncil(QUESTION, CONFIG, [prior()]);
        expect(v).not.toBeNull();
        const keys = Object.keys(v as object).sort();
        expect(keys).toEqual(['prior', 'similarity', 'state']);
        for (const forbidden of ['block', 'refuse', 'deny', 'severity', 'fatal', 'exitCode']) {
            expect(keys).not.toContain(forbidden);
        }
    });

    it('the warning says it is a warning and names the re-run path', () => {
        const text = renderRecouncilWarning(checkRecouncil(QUESTION, CONFIG, [prior()])!);
        expect(text).toContain('WARNING, never a refusal');
        expect(text).toContain('--confirm');
    });

    it('a question with no prior is silent — null, not an empty warning', () => {
        expect(checkRecouncil('an entirely unrelated question about typography', CONFIG, [prior()])).toBeNull();
    });
});

describe('1A.3 — near duplicates on the already-imported mechanism', () => {
    it('the threshold IS the pre-registered one — reused, never re-declared', () => {
        // 1A.3 asks for a threshold fixed before tuning on this corpus.
        // MERGE_THRESHOLD was set by an AI-council verdict of 2026-07-05, long
        // before this guard existed, so it cannot have been tuned against the
        // council-question corpus. Re-declaring 0.8 here would fork it — the
        // same defect 1A.1 forbids for the hash.
        expect(NEAR_DUPLICATE_THRESHOLD).toBe(MERGE_THRESHOLD);
    });

    it('the warning prints the similarity score', () => {
        const v = checkRecouncil(QUESTION, CONFIG, [prior()])!;
        expect(renderRecouncilWarning(v)).toMatch(/similarity\s+1\.00 \(threshold 0\.8, pre-registered\)/);
    });

    it('a reworded question above the threshold is caught', () => {
        const reworded = 'Should the user-scope rule bucket become a gated bucket in the preamble payload budget??';
        const v = checkRecouncil(reworded, CONFIG, [prior()]);
        expect(v?.state).toBe('near-duplicate');
        expect(v!.similarity).toBeGreaterThanOrEqual(NEAR_DUPLICATE_THRESHOLD);
    });

    it('a different question on the same TOPIC stays below the threshold', () => {
        // The value the pre-registration encodes: "the same question with a few
        // words moved", not "a question about the same area".
        const other = 'How often should the preamble payload budget be re-measured, and by whom?';
        expect(jaccardSimilarity(other, QUESTION)).toBeLessThan(NEAR_DUPLICATE_THRESHOLD);
        expect(checkRecouncil(other, CONFIG, [prior()])).toBeNull();
    });

    it('an empty prior text cannot match — the module treats it as no evidence', () => {
        expect(jaccardSimilarity('', QUESTION)).toBe(0);
        expect(checkRecouncil(QUESTION, CONFIG, [prior({ questionHash: 'nope', questionText: '' })])).toBeNull();
    });
});

describe('1A.4 — three states, each rendering itself and no other', () => {
    const cases: Array<[string, () => ReturnType<typeof checkRecouncil>, string, string[]]> = [
        [
            'exact-same-config',
            () => checkRecouncil(QUESTION, CONFIG, [prior()]),
            'configuration that would run it is unchanged',
            ['members or round count have moved', 'above the pre-registered similarity'],
        ],
        [
            'exact-stale-config',
            () => checkRecouncil(QUESTION, configFingerprint(['anthropic/x'], 2), [prior()]),
            'members or round count have moved',
            ['configuration that would run it is unchanged', 'above the pre-registered similarity'],
        ],
        [
            'near-duplicate',
            () => checkRecouncil(`${QUESTION}?`, CONFIG, [prior()]),
            'above the pre-registered similarity threshold',
            ['configuration that would run it is unchanged', 'members or round count have moved'],
        ],
    ];

    for (const [state, run, expected, forbidden] of cases) {
        it(`${state} renders its own line and NOT the other two`, () => {
            const v = run();
            expect(v?.state, state).toBe(state);
            const text = renderRecouncilWarning(v!);
            expect(text).toContain(expected);
            for (const f of forbidden) expect(text).not.toContain(f);
        });
    }

    it('an exact match beats a near-duplicate — one finding, the informative one', () => {
        const near = prior({ artifactPath: '/tmp/near.md', questionText: `${QUESTION}?`, questionHash: 'nope' });
        const exact = prior({ artifactPath: '/tmp/exact.md' });
        expect(checkRecouncil(QUESTION, CONFIG, [near, exact])?.prior.artifactPath).toBe('/tmp/exact.md');
    });
});

describe('readPriorRuns — tolerant of every read failure', () => {
    function tree(): { repo: string; responses: string } {
        const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'recouncil-'));
        made.push(repo);
        const responses = path.join(repo, 'agents', 'runtime', 'council', 'responses');
        fs.mkdirSync(responses, { recursive: true });
        fs.mkdirSync(path.join(repo, 'q'), { recursive: true });
        return { repo, responses };
    }

    it('reads the artefact header and hashes the question it names', () => {
        const { repo, responses } = tree();
        fs.writeFileSync(path.join(repo, 'q', 'a.md'), QUESTION);
        fs.writeFileSync(
            path.join(responses, 'a.md'),
            `${JSON.stringify({ artefact: 'q/a.md', members: ['b', 'a'], rounds: 2 }, null, 2)}\n\nprose`,
        );
        const runs = readPriorRuns(responses, repo);
        expect(runs).toHaveLength(1);
        expect(runs[0]?.questionHash).toBe(_sha256_hex(QUESTION));
        expect(runs[0]?.configFingerprint).toBe('a,b|rounds=2'); // sorted, so member order cannot matter
    });

    it('skips a malformed artefact instead of throwing — an advisory must not break a run', () => {
        const { repo, responses } = tree();
        fs.writeFileSync(path.join(responses, 'bad.md'), 'not json at all');
        expect(() => readPriorRuns(responses, repo)).not.toThrow();
        expect(readPriorRuns(responses, repo)).toHaveLength(0);
    });

    it('keeps a run whose question file is gone, with null text fields', () => {
        const { repo, responses } = tree();
        fs.writeFileSync(
            path.join(responses, 'a.md'),
            `${JSON.stringify({ artefact: 'q/missing.md', members: [], rounds: 1 })}\n`,
        );
        const runs = readPriorRuns(responses, repo);
        expect(runs).toHaveLength(1);
        expect(runs[0]?.questionHash).toBeNull();
    });

    it('returns [] for a directory that does not exist', () => {
        expect(readPriorRuns('/tmp/no-such-responses-dir', '/tmp')).toEqual([]);
    });
});
