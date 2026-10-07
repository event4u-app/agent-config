/**
 * A non-default target that is itself behind its default branch.
 *
 * Under the branch-convergence policy such a target carries the default in its
 * base set. Under a strategy other than `merge`, rebasing the branch onto the
 * target cannot make it current — the target is what is behind — so the
 * ordinary "the branch is behind, rebase on request" message sends the reader
 * to an update that would leave `sync_pr_branch` exiting 3 on every run.
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

const POLICY = 'branchConvergence:\n  enabled: true\n  targets:\n    release:\n      defaultBranch: include\n';

/** A feature branch on `release`; `targetStale` advances main past release, `branchBehindTarget` advances release past the branch. */
function checkout(opts: { targetStale: boolean; branchBehindTarget: boolean }): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-target-stale-'));
    made.push(root);
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', remote);
    const seed = path.join(root, 'seed');
    git(root, 'clone', '-q', remote, seed);
    commitFile(seed, 'a.txt', 'a\n');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    git(seed, 'switch', '-q', '-c', 'release');
    commitFile(seed, '.branch-convergence.yml', POLICY);
    git(seed, 'push', '-q', 'origin', 'release');

    const work = path.join(root, 'work');
    git(root, 'clone', '-q', remote, work);
    git(work, 'switch', '-q', '-c', 'feature', 'origin/release');
    fs.writeFileSync(path.join(work, '.agent-settings.yml'), 'git:\n  update_strategy: rebase\n');

    if (opts.branchBehindTarget) {
        commitFile(seed, 'r.txt', 'r\n');
        git(seed, 'push', '-q', 'origin', 'release');
    }
    git(seed, 'switch', '-q', 'main');
    if (opts.targetStale) {
        commitFile(seed, 'm.txt', 'm\n');
        git(seed, 'push', '-q', 'origin', 'main');
    } else {
        git(seed, 'merge', '-q', '--ff-only', 'origin/release');
        git(seed, 'push', '-q', 'origin', 'main');
    }
    return work;
}

const run = (repo: string): { code: number; out: string } => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = main(['--repo', repo, '--base', 'origin/release']);
        return { code, out: spy.mock.calls.map((c) => String(c[0])).join('') };
    } finally {
        spy.mockRestore();
    }
};

describe('a target behind its own default', () => {
    it('is refused with TARGET_POLICY_STALE, not the ordinary behind message', () => {
        const repo = checkout({ targetStale: true, branchBehindTarget: false });
        const head = git(repo, 'rev-parse', 'HEAD');
        const r = run(repo);
        expect(r.code).toBe(3);
        expect(r.out).toContain('TARGET_POLICY_STALE');
        expect(r.out).toContain('origin/release');
        expect(r.out).not.toContain('Rebase on request instead');
        expect(git(repo, 'rev-parse', 'HEAD')).toBe(head);
    });

    it('still names TARGET_POLICY_STALE when the branch is also behind the target', () => {
        const r = run(checkout({ targetStale: true, branchBehindTarget: true }));
        expect(r.code).toBe(3);
        expect(r.out).toContain('TARGET_POLICY_STALE');
    });

    it('keeps the ordinary message when only the branch is behind a current target', () => {
        const r = run(checkout({ targetStale: false, branchBehindTarget: true }));
        expect(r.code).toBe(3);
        expect(r.out).not.toContain('TARGET_POLICY_STALE');
        expect(r.out).toContain('Rebase on request instead');
    });
});
