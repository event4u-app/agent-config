// Synthetic pre-validation of the residual-detection scorer, BEFORE any paid
// model call (road-to-adversarial-council-benchmark Phase 1; the review-#7 /
// defect-finding-benchmark lesson: prove the scorer red/green on known
// hit/miss/wrong-file/wrong-category/clean outputs first, or the paid run is a
// measurement artifact). No model calls here — pure fixtures.
import { describe, expect, it } from 'vitest';

import {
    categoryFamily,
    caughtDefect,
    isFalsePositive,
    recall,
    fpRate,
    type GroundTruth,
    type Finding,
} from '../../src/scripts/_lib/adversarial_bench_score.js';

const defect: GroundTruth = {
    id: 'sec-01',
    is_clean: false,
    defect_files: ['documentShare.ts'],
    defect_category: 'access-control',
};
const multiFile: GroundTruth = {
    id: 'mfi-02',
    is_clean: false,
    defect_files: ['idempotency.ts', 'webhook.ts'],
    defect_category: 'concurrency',
};
const clean: GroundTruth = { id: 'clean-01', is_clean: true, defect_files: [], defect_category: 'none' };

describe('categoryFamily normalization', () => {
    it('maps synonyms to families', () => {
        expect(categoryFamily('IDOR')).toBe('access-control');
        expect(categoryFamily('Broken Access Control')).toBe('access-control');
        expect(categoryFamily('BOLA / ownership')).toBe('access-control');
        expect(categoryFamily('race condition')).toBe('concurrency');
        expect(categoryFamily('non-atomic idempotency')).toBe('concurrency');
        expect(categoryFamily('SSRF')).toBe('ssrf');
        expect(categoryFamily('path traversal')).toBe('path-traversal');
        expect(categoryFamily('resource leak')).toBe('resource-leak');
        expect(categoryFamily('off-by-one')).toBe('correctness');
        expect(categoryFamily('something vague')).toBe('other');
    });
});

describe('caughtDefect — the matching rule (file + category family, NOT exact line)', () => {
    it('CATCHES: right file basename + right category family, any path form, any/no line', () => {
        const f: Finding[] = [{ file: 'src/routes/documentShare.ts', category: 'Broken Access Control' }];
        expect(caughtDefect(defect, f)).toBe(true);
    });
    it('CATCHES even when the model cites a different line / path prefix (the last-bench bug fix)', () => {
        // last time an exact file:line token was required and mis-scored real catches.
        const f: Finding[] = [{ file: 'documentShare.ts', category: 'authorization bug' }];
        expect(caughtDefect(defect, f)).toBe(true);
    });
    it('MISS: no finding at all', () => {
        expect(caughtDefect(defect, [])).toBe(false);
    });
    it('NO CREDIT: right file, WRONG category family', () => {
        const f: Finding[] = [{ file: 'src/routes/documentShare.ts', category: 'performance' }];
        expect(caughtDefect(defect, f)).toBe(false);
    });
    it('NO CREDIT: right category, WRONG file (scattershot)', () => {
        const f: Finding[] = [{ file: 'src/other.ts', category: 'access control' }];
        expect(caughtDefect(defect, f)).toBe(false);
    });
    it('multi-file: matching EITHER involved file counts', () => {
        expect(caughtDefect(multiFile, [{ file: 'src/webhook.ts', category: 'race' }])).toBe(true);
        expect(caughtDefect(multiFile, [{ file: 'src/idempotency.ts', category: 'non-atomic' }])).toBe(true);
    });
    it('clean control never "catches" (use isFalsePositive instead)', () => {
        expect(caughtDefect(clean, [{ file: 'src/resolve-config.ts', category: 'correctness' }])).toBe(false);
    });
});

describe('isFalsePositive — clean controls only', () => {
    it('FP when any high/medium-confidence finding is raised on the clean file', () => {
        expect(isFalsePositive(clean, [{ file: 'src/resolve-config.ts', category: 'correctness' }])).toBe(true);
    });
    it('NO FP when the reviewer raises nothing on the clean control', () => {
        expect(isFalsePositive(clean, [])).toBe(false);
    });
    it('low-confidence hedges are NOT counted as a false positive', () => {
        expect(
            isFalsePositive(clean, [{ file: 'src/resolve-config.ts', category: 'style', confidence: 'low' }]),
        ).toBe(false);
    });
    it('defect fixtures never register a false positive', () => {
        expect(isFalsePositive(defect, [{ file: 'src/routes/documentShare.ts', category: 'access-control' }])).toBe(false);
    });
});

describe('recall + fpRate aggregation', () => {
    it('recall = caught / total defects', () => {
        expect(recall({ a: true, b: false, c: true, d: false })).toBe(0.5);
        expect(recall({})).toBe(0);
    });
    it('fpRate = fp controls / total controls', () => {
        expect(fpRate({ c1: false, c2: false, c3: true })).toBeCloseTo(1 / 3, 6);
        expect(fpRate({})).toBe(0);
    });
});
