import { describe, expect, it } from 'vitest';

import {
    addedLines,
    reviewPr,
    ReviewError,
    type CandidateFinding,
    type DisproveResult,
    type PrReviewPort,
} from '../../src/scripts/analysis_pr_review.js';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

const DIFF = [
    'diff --git a/src/pay.ts b/src/pay.ts',
    '--- a/src/pay.ts',
    '+++ b/src/pay.ts',
    '@@ -10,3 +10,4 @@ export function charge(',
    ' const amount = input.amount;',
    '-const total = amount * rate;',
    '+const total = amount * rate;',
    '+if (total < 0) return;',
    ' log(total);',
    '',
].join('\n');

function port(): PrReviewPort & { writes: string[]; removed: string[] } {
    const writes: string[] = [];
    const removed: string[] = [];
    return {
        writes,
        removed,
        openWorktree: (sha) => `/tmp/wt-${sha.slice(0, 7)}`,
        removeWorktree: (p) => {
            removed.push(p);
        },
        diff: () => DIFF,
        comment: (pr, body) => {
            writes.push(`#${pr}: ${body}`);
        },
    };
}

const planted: CandidateFinding = {
    severity: 'high',
    file: 'src/pay.ts',
    line: 12,
    claim: 'a negative total returns silently instead of refusing the charge',
    evidence: 'src/pay.ts:12 returns undefined; the caller treats undefined as success',
    fix: 'throw a ChargeRefused error',
    confidence: 0.9,
    reproduction: 'charge({ amount: -1 }) resolves instead of rejecting',
    family: 'anthropic',
};

const kept = (): DisproveResult => ({ refuted: false, family: 'openai', note: 'could not refute' });

describe('reviewPr (step 5.2)', () => {
    it('reads the added head lines per file from a unified diff', () => {
        expect(addedLines(DIFF).get('src/pay.ts')).toEqual(new Set([11, 12]));
    });

    it('reports a planted defect with file:line, marks it introduced here, and writes nothing to the PR', () => {
        const p = port();
        const v = reviewPr({ pr: 7, baseSha: BASE, headSha: HEAD, comment: false }, p, () => [planted], kept);
        expect(v.findings).toHaveLength(1);
        expect(v.findings[0]).toMatchObject({ file: 'src/pay.ts', line: 12, origin: 'introduced' });
        expect(v.text).toContain('src/pay.ts:12');
        expect(v.text).toContain('introduced here');
        expect(p.writes).toEqual([]);
        expect(p.removed).toEqual([`/tmp/wt-${HEAD.slice(0, 7)}`]);
    });

    it('a clean fixture reports no finding above threshold and makes no write call', () => {
        const p = port();
        const v = reviewPr({ pr: 7, baseSha: BASE, headSha: HEAD, comment: false }, p, () => [], kept);
        expect(v.findings).toEqual([]);
        expect(v.text).toContain('no finding above threshold');
        expect(p.writes).toEqual([]);
    });

    it('drops refuted and below-threshold findings, folds duplicates, and counts each', () => {
        const low = { ...planted, line: 11, claim: 'style nit', confidence: 0.3 };
        const refuted = { ...planted, line: 11, claim: 'rate may be undefined' };
        const dup = { ...planted, confidence: 0.8, claim: '  A negative total returns silently instead of refusing the charge ' };
        const v = reviewPr({ pr: 7, baseSha: BASE, headSha: HEAD, comment: false }, port(), () => [planted, low, refuted, dup], (f) =>
            f.claim === 'rate may be undefined' ? { refuted: true, family: 'openai', note: 'rate is a required parameter' } : kept(),
        );
        expect(v.findings).toHaveLength(1);
        expect(v.findings[0]?.confidence).toBe(0.9);
        expect({ below: v.belowThreshold, refuted: v.refuted, duplicates: v.duplicates }).toEqual({ below: 1, refuted: 1, duplicates: 1 });
    });

    it('a finding outside the diff is pre-existing, and only a diff-anchored reproduced finding counts toward the metric', () => {
        const old = { ...planted, line: 40, claim: 'the logger leaks the amount' };
        const v = reviewPr({ pr: 7, baseSha: BASE, headSha: HEAD, comment: false }, port(), () => [planted, old], kept);
        expect(v.findings.map((f) => f.origin)).toEqual(['introduced', 'pre-existing']);
        expect(v.metric).toBe(1);
    });

    it('refuses a disprove pass by the same model family', () => {
        expect(() =>
            reviewPr({ pr: 7, baseSha: BASE, headSha: HEAD, comment: false }, port(), () => [planted], () => ({
                refuted: false,
                family: 'anthropic',
                note: '',
            })),
        ).toThrow(ReviewError);
    });

    it('posts exactly once only with --comment', () => {
        const p = port();
        reviewPr({ pr: 7, baseSha: BASE, headSha: HEAD, comment: true }, p, () => [planted], kept);
        expect(p.writes).toHaveLength(1);
        expect(p.writes[0]).toMatch(/^#7: /u);
    });

    it('refuses a SHA that is not a full object id before opening a worktree', () => {
        expect(() => reviewPr({ pr: 7, baseSha: 'main', headSha: HEAD, comment: false }, port(), () => [], kept)).toThrow(ReviewError);
    });

    it('removes the throwaway worktree even when an analyst throws', () => {
        const p = port();
        expect(() =>
            reviewPr({ pr: 7, baseSha: BASE, headSha: HEAD, comment: false }, p, () => {
                throw new Error('seat failed');
            }, kept),
        ).toThrow('seat failed');
        expect(p.removed).toHaveLength(1);
    });
});
