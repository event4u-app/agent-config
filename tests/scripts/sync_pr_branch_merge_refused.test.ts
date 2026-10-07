/**
 * A `git merge` git refuses before it starts — local changes it would
 * overwrite, an untracked file in the way — leaves no unmerged path. Reporting
 * it as a conflict printed "1 conflict(s)" over an empty path list and dropped
 * the one line that says what to do: git's own refusal.
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

/** A feature branch one commit behind main, where main's new commit writes `file`. */
function behind(file: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-merge-refused-'));
    made.push(root);
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', remote);
    const seed = path.join(root, 'seed');
    git(root, 'clone', '-q', remote, seed);
    commitFile(seed, 'a.txt', 'a\n');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    const work = path.join(root, 'work');
    git(root, 'clone', '-q', remote, work);
    git(work, 'switch', '-q', '-c', 'feature');
    commitFile(seed, file, 'from main\n');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    return work;
}

const run = (repo: string): { code: number; out: string } => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = main(['--repo', repo]);
        return { code, out: spy.mock.calls.map((c) => String(c[0])).join('') };
    } finally {
        spy.mockRestore();
    }
};

describe('a merge git refuses without an unmerged path', () => {
    it('reports git\'s refusal for a dirty file the merge would overwrite, never a conflict', () => {
        const repo = behind('a.txt');
        fs.writeFileSync(path.join(repo, 'a.txt'), 'edited, not committed\n');
        const r = run(repo);
        expect(r.code).toBe(1);
        expect(r.out).not.toMatch(/conflict\(s\)/);
        expect(r.out).toContain('would be overwritten');
        expect(r.out).toContain('nothing was merged');
    });

    it('reports git\'s refusal for an untracked file in the way, never a conflict', () => {
        const repo = behind('b.txt');
        fs.writeFileSync(path.join(repo, 'b.txt'), 'untracked\n');
        const r = run(repo);
        expect(r.code).toBe(1);
        expect(r.out).not.toMatch(/conflict\(s\)/);
        expect(r.out).toContain('untracked working tree file');
    });
});
