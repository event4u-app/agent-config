// A review-input copy is a copy of a diff that was already reviewed, so it must
// not compete for a review chunk, and the coverage record must count it as a
// copy rather than as unreviewed. Parity with the R2 reviewer's exclusion is
// asserted directly. The span is a throwaway git repository under the OS temp
// directory.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REVIEW_SCOPE_EXCLUDES } from '../../src/scripts/dispatch_r2_reviewer.js';
import {
    REVIEW_COPY_PREFIX,
    buildPlan,
    coverageBlock,
    isReviewablePath,
} from '../../src/scripts/self_review_gate.js';

function git(cwd: string, args: string[]): void {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
}

function write(repo: string, rel: string, body: string): void {
    const abs = join(repo, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, 'utf8');
}

describe('review-input copies spend no review chunk', () => {
    let repo: string;

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'review-copy-'));
        git(repo, ['init', '-q', '-b', 'main']);
        git(repo, ['config', 'user.email', 'test@example.com']);
        git(repo, ['config', 'user.name', 'test']);
        write(repo, 'README.md', 'base\n');
        git(repo, ['add', '.']);
        git(repo, ['commit', '-qm', 'base']);
        git(repo, ['branch', 'base']);
        git(repo, ['checkout', '-q', '-b', 'feature/x']);
        write(repo, 'src/scripts/x.ts', 'export const x = 1;\n');
        write(repo, 'agents/evidence/reviews/lane-x.review-input/diff.patch', '+export const x = 1;\n');
        git(repo, ['add', '.']);
        git(repo, ['commit', '-qm', 'x plus its review input']);
    });

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true });
    });

    it('excludes the tree the R2 reviewer excludes', () => {
        expect(REVIEW_SCOPE_EXCLUDES).toContain(`:(exclude,top)${REVIEW_COPY_PREFIX.replace(/\/$/u, '')}`);
        expect(isReviewablePath('agents/evidence/reviews/a.review-input/diff.patch')).toBe(false);
        expect(isReviewablePath('agents/evidence/reports/a.md')).toBe(true);
        expect(isReviewablePath('src/scripts/x.ts')).toBe(true);
    });

    it('plans one chunk for one source file and one review-input copy', () => {
        const plan = buildPlan('base', repo);
        expect(plan.files).toEqual(['src/scripts/x.ts']);
        expect(plan.requests).toBe(1);
        expect(plan.partition.chunks.flatMap((c) => c.files)).toEqual(['src/scripts/x.ts']);
        expect(plan.unreviewed).toEqual([]);
        expect(plan.reviewCopies).toEqual(['agents/evidence/reviews/lane-x.review-input/diff.patch']);
    });

    it('states the copies as copies, never as unreviewed', () => {
        const block = coverageBlock({ chunks: 1, filesReviewed: 1, filesTotal: 1, unreviewed: [], reviewCopies: 1 });
        expect(block).toContain('copies of an already-reviewed diff');
        expect(block).not.toContain('NOT reviewed');
    });
});
