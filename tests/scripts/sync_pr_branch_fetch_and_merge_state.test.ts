/**
 * Two ways the sync reported a state it had not established.
 *
 * - The per-ref fetch of a base ran unchecked, so when it failed the count read
 *   whatever the tracking ref still named — "already current" against a commit
 *   the server no longer had.
 * - `git merge` ran under the 8 s network timeout. A merge whose hook outlived it
 *   was killed mid-flight and reported "nothing was merged" over a repository
 *   left with MERGE_HEAD in place.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../src/scripts/sync_pr_branch.js';

const made: string[] = [];
afterEach(() => {
    vi.unstubAllEnvs();
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

function fixture(prefix: string): { root: string; remote: string; seed: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(root);
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', remote);
    const seed = path.join(root, 'seed');
    git(root, 'clone', '-q', remote, seed);
    commitFile(seed, 'a.txt', 'a\n');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    return { root, remote, seed };
}

const run = (repo: string, ...args: string[]): { code: number; out: string } => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = main(['--repo', repo, ...args]);
        return { code, out: spy.mock.calls.map((c) => String(c[0])).join('') };
    } finally {
        spy.mockRestore();
    }
};

describe('a per-ref base fetch that fails', () => {
    it('reads as unverified, never as a count against the stale tracking ref', () => {
        const { root, remote, seed } = fixture('sync-ref-fetch-');
        git(seed, 'push', '-q', 'origin', 'HEAD:feature');
        const work = path.join(root, 'work');
        git(root, 'clone', '-q', '--single-branch', '-b', 'feature', remote, work);
        // Fetched once by hand, outside the clone's refspec, then the server moves on.
        git(work, 'fetch', '-q', 'origin', '+refs/heads/main:refs/remotes/origin/main');
        commitFile(seed, 'b.txt', 'b\n');
        git(seed, 'push', '-q', 'origin', 'HEAD:main');
        // The server answers, but the tracking ref cannot be updated.
        fs.writeFileSync(path.join(work, '.git', 'refs', 'remotes', 'origin', 'main.lock'), '');

        const r = run(work, '--base', 'main', '--dry-run');
        expect(r.code).toBe(0);
        expect(r.out).toContain('unverified');
        expect(r.out).toContain('origin/main');
        expect(r.out).not.toContain('already current');
    });
});

describe('a merge that outlives its timeout', () => {
    function behindWithSlowHook(seconds: number): string {
        const { root, remote, seed } = fixture('sync-merge-timeout-');
        const work = path.join(root, 'work');
        git(root, 'clone', '-q', remote, work);
        git(work, 'switch', '-q', '-c', 'feature');
        commitFile(work, 'f.txt', 'feature\n');
        commitFile(seed, 'b.txt', 'from main\n');
        git(seed, 'push', '-q', 'origin', 'HEAD:main');
        const hook = path.join(work, '.git', 'hooks', 'pre-merge-commit');
        fs.writeFileSync(hook, `#!/bin/sh\nsleep ${String(seconds)}\n`, { mode: 0o755 });
        return work;
    }

    it('is not killed by the network timeout', () => {
        const work = behindWithSlowHook(10);
        const r = run(work);
        expect(r.code).toBe(0);
        expect(git(work, 'rev-parse', '-q', '--verify', 'HEAD^2')).not.toBe('');
    }, 30_000);

    it('reports a merge it killed as half-applied, never "nothing was merged"', () => {
        vi.stubEnv('AGENT_CONFIG_SYNC_MERGE_TIMEOUT_MS', '1000');
        const work = behindWithSlowHook(5);
        const r = run(work);
        expect(r.code).toBe(1);
        expect(git(work, 'diff', '--cached', '--name-only')).toBe('b.txt');
        expect(r.out).toContain('stopped after 1 s');
        expect(r.out).toContain('git reset --merge');
        expect(r.out).not.toContain('nothing was merged');
    }, 30_000);

    it('reports a merge its hook stopped as in progress, never "nothing was merged"', () => {
        const work = behindWithSlowHook(0);
        fs.writeFileSync(path.join(work, '.git', 'hooks', 'pre-merge-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
        const r = run(work);
        expect(r.code).toBe(1);
        expect(fs.existsSync(path.join(work, '.git', 'MERGE_HEAD'))).toBe(true);
        expect(r.out).toContain('merge in progress');
        expect(r.out).toContain('git merge --abort');
        expect(r.out).not.toContain('nothing was merged');
    });
});
