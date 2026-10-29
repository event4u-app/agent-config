/**
 * The changed-file list and the diff hunks name the same paths: both relative
 * to the graph root, also when that root is a subdirectory of the repository.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { changedFiles } from '../../../src/scripts/code_graph/cli.js';
import { diffHunks } from '../../../src/scripts/code_graph/review_risk.js';

let repo: string;
const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@example.com' } });
const w = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), body);
};

beforeAll(() => {
    repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-relative-')));
    git('init', '-q', '-b', 'main');
    w('pkg/src/a.ts', 'export const a = 1;\n');
    git('add', '.');
    git('commit', '-qm', 'init');
    w('pkg/src/a.ts', 'export const a = 2;\n');
    git('commit', '-qam', 'change');
});
afterAll(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('changed files and hunks agree on the root', () => {
    it('both are relative to a subdirectory root', () => {
        const root = path.join(repo, 'pkg');
        expect(changedFiles(root, 'HEAD~1')).toEqual(['src/a.ts']);
        expect(diffHunks(root, 'HEAD~1')?.map((h) => h.file)).toEqual(['src/a.ts']);
    });
});
