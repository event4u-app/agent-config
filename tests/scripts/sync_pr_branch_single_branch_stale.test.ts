/**
 * A single-branch clone fetches only its own branch, so `git fetch origin`
 * never moves a base tracking ref fetched once by hand. Counting against that
 * ref read "already current" while the server was ahead.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../src/scripts/sync_pr_branch.js';

const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

const commitFile = (cwd: string, file: string, content: string): void => {
    fs.writeFileSync(path.join(cwd, file), content);
    git(cwd, 'add', file);
    git(cwd, 'commit', '-q', '-m', file);
};

function singleBranchCloneWithStaleMain(): { work: string; serverMain: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-single-branch-'));
    made.push(root);
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', remote);
    const seed = path.join(root, 'seed');
    git(root, 'clone', '-q', remote, seed);
    commitFile(seed, 'a.txt', 'a\n');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    git(seed, 'push', '-q', 'origin', 'HEAD:feature');
    const work = path.join(root, 'work');
    git(root, 'clone', '-q', '--single-branch', '-b', 'feature', remote, work);
    // Fetched once by hand; the clone's refspec never updates it again.
    git(work, 'fetch', '-q', 'origin', '+refs/heads/main:refs/remotes/origin/main');
    commitFile(seed, 'b.txt', 'b\n');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    return { work, serverMain: git(seed, 'rev-parse', 'HEAD') };
}

const run = (repo: string, ...args: string[]): { code: number; out: string } => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = main(['--repo', repo, '--base', 'main', ...args]);
        return { code, out: spy.mock.calls.map((c) => String(c[0])).join('') };
    } finally {
        spy.mockRestore();
    }
};

describe('a single-branch clone with a stale base tracking ref', () => {
    it('counts against the commit the server has, never "already current"', () => {
        const { work } = singleBranchCloneWithStaleMain();
        const r = run(work, '--dry-run');
        expect(r.out).not.toContain('already current');
        expect(r.out).toContain('1 behind');
    });

    it('merges the server commit', () => {
        const { work, serverMain } = singleBranchCloneWithStaleMain();
        const r = run(work);
        expect(r.code).toBe(0);
        expect(git(work, 'merge-base', '--is-ancestor', serverMain, 'HEAD')).toBe('');
    });
});
