/**
 * The git-backed ports of analyze:pr against a local temporary repository —
 * no network, no remote: what the diff classifies and what a patch carries.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gitOptimizePort } from '../../src/scripts/analysis_pr_optimize.js';
import { addedLines, gitGhReviewPort } from '../../src/scripts/analysis_pr_review.js';

let repo: string;
/** The ports spawn git with the process environment, so the identity has to live there too (CI has none). */
const GIT_ENV: Record<string, string> = {
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@example.com',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@example.com',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
};
const saved: Record<string, string | undefined> = {};
const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim();
const write = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), body);
};

beforeEach(() => {
    for (const [k, v] of Object.entries(GIT_ENV)) {
        saved[k] = process.env[k];
        process.env[k] = v;
    }
    repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-git-')));
    git('init', '-q', '-b', 'main');
    write('a.ts', 'one\ntwo\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
});

afterEach(() => {
    for (const k of Object.keys(GIT_ENV)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
    fs.rmSync(repo, { recursive: true, force: true });
});

describe('gitGhReviewPort.diff', () => {
    it('diffs from the merge base, so a later base commit is not "introduced" by the PR', () => {
        git('switch', '-q', '-c', 'feat');
        write('b.ts', 'pr line\n');
        git('add', '.');
        git('commit', '-q', '-m', 'pr');
        const head = git('rev-parse', 'HEAD');
        git('switch', '-q', 'main');
        write('a.ts', 'one\nTWO\n');
        git('commit', '-q', '-am', 'base moves');
        const base = git('rev-parse', 'HEAD');
        const added = addedLines(gitGhReviewPort(repo).diff(base, head));
        expect([...added.keys()]).toEqual(['b.ts']);
    });
});

describe('gitOptimizePort', () => {
    it('a patch carries new files, is cut at the pinned head, and leaves the caller checkout clean', () => {
        const pinned = git('rev-parse', 'HEAD');
        write('a.ts', 'one\ntwo\nlocal edit\n');
        git('commit', '-q', '-am', 'caller moved on');
        const port = gitOptimizePort(repo, (_fixes, dir) => {
            fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'tests/regression.test.ts'), 'it("red", () => {});\n');
        });
        const file = port.writePatch(7, pinned, [{ findingKey: 'f1', disposition: { kind: 'regression-test-red', test: 'tests/regression.test.ts' } }]);
        const patch = fs.readFileSync(file, 'utf8');
        expect(patch).toContain('tests/regression.test.ts');
        expect(patch).not.toContain('local edit');
        expect(git('status', '--porcelain')).toBe('');
        expect(git('worktree', 'list').split('\n')).toHaveLength(1);
    });

    it('applyFixes commits new files in its own worktree at the base, never in the caller checkout', () => {
        const base = git('rev-parse', 'HEAD');
        const port = gitOptimizePort(repo, (_fixes, dir) => {
            fs.writeFileSync(path.join(dir, 'new.ts'), 'x\n');
        });
        const next = port.applyFixes([{ findingKey: 'f1', disposition: { kind: 'static-check', check: 'tsc' } }], base);
        expect(git('show', '--name-only', '--format=', next)).toBe('new.ts');
        expect(git('status', '--porcelain')).toBe('');
        port.dispose();
        expect(git('worktree', 'list').split('\n')).toHaveLength(1);
    });
});
