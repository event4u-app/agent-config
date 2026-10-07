/**
 * The commit being integrated is governed by the policy it carries.
 *
 * `git.update_strategy` is read at the target SHA resolved once; the merge
 * re-pins the target right before mutating and may see a newer SHA. These rows
 * drive that window with injected deps: the first server answer is the commit
 * the strategy was read at, every later one is the advanced tip.
 */
import { execFileSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { conventionReading } from '../../src/scripts/_lib/git_convention.js';
import { CARRIER_PATH } from '../../src/scripts/_lib/git_convention_carrier.js';
import { integrateWithPinnedBase, main as syncMain, makeGitDeps, policyMovedStop, type BaseDeps } from '../../src/scripts/sync_pr_branch.js';

import { TmpDirs, advanceMain, commitIn, fixture, git, isolateUserGlobal, type Fixture } from './_git_convention_repo.js';

const tmp = new TmpDirs();
let restore: () => void;
beforeEach(() => {
    restore = isolateUserGlobal(tmp);
});
afterEach(() => {
    restore();
    tmp.cleanup();
});

/** The server reports `first` once, then `later` for every further question. */
function movingTarget(f: Fixture, first: string, later: string): BaseDeps {
    let asked = 0;
    return { ...makeGitDeps(f.work), remoteSha: () => (asked++ === 0 ? first : later) };
}

function run(f: Fixture, deps: BaseDeps): { code: number; out: string } {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = syncMain(['--repo', f.work, '--base', 'origin/main'], deps);
        return { code, out: spy.mock.calls.map((c) => String(c[0])).join('') };
    } finally {
        spy.mockRestore();
    }
}

const contains = (repo: string, sha: string): boolean => {
    try {
        execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: repo, stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
};

describe('the target moves between the strategy read and the merge', () => {
    it('an unchanged strategy at the new commit proceeds against it', () => {
        const f = fixture(tmp);
        const a = git(f.seed, 'rev-parse', 'HEAD').trim();
        commitIn(f.work, 'c.txt', 'c\n');
        const b = advanceMain(f);
        const r = run(f, movingTarget(f, a, b));
        expect(r.code, r.out).toBe(0);
        expect(contains(f.work, b)).toBe(true);
    });

    it('a changed strategy at the new commit stops without merging', () => {
        const f = fixture(tmp);
        const a = git(f.seed, 'rev-parse', 'HEAD').trim();
        commitIn(f.work, 'c.txt', 'c\n');
        const b = advanceMain(f, { [CARRIER_PATH]: 'git:\n  update_strategy: rebase\n' });
        const head = git(f.work, 'rev-parse', 'HEAD').trim();
        const branch = git(f.work, 'rev-parse', 'refs/heads/feature').trim();
        const r = run(f, movingTarget(f, a, b));
        expect(r.code).toBe(1);
        expect(r.out).toContain(`the target moved from ${a.slice(0, 12)} to ${b.slice(0, 12)}`);
        expect(r.out).toContain('git.update_strategy changed from merge to rebase');
        expect(r.out).toContain('run again');
        expect(git(f.work, 'rev-parse', 'HEAD').trim()).toBe(head);
        expect(git(f.work, 'rev-parse', 'refs/heads/feature').trim()).toBe(branch);
        expect(contains(f.work, b)).toBe(false);
    });
});

describe('policyMovedStop — what counts as a change', () => {
    const a = 'a'.repeat(40);
    const b = 'b'.repeat(40);
    it('an absent carrier and an explicit merge put the same strategy in force', () => {
        expect(policyMovedStop(a, b, conventionReading('update_strategy', 'absent', null, CARRIER_PATH), conventionReading('update_strategy', 'valid', 'merge', CARRIER_PATH))).toBeNull();
    });
    it('a carrier that no longer parses at the new commit stops', () => {
        const stop = policyMovedStop(a, b, conventionReading('update_strategy', 'valid', 'merge', CARRIER_PATH), conventionReading('update_strategy', 'malformed', null, CARRIER_PATH));
        expect(stop).toContain('changed from merge to unreadable (malformed)');
    });
});

describe('integrateWithPinnedBase — a refused pin merges nothing', () => {
    it('stops before the first merge', () => {
        const merged: string[] = [];
        const out = integrateWithPinnedBase(['origin/main'], {
            remoteSha: () => 'b'.repeat(40),
            merge: (ref) => {
                merged.push(ref);
                return { ok: true, conflicted: [] };
            },
            checkPin: () => 'stop',
        });
        expect(out).toMatchObject({ ok: false, stopped: true, message: 'stop', conflicted: [] });
        expect(merged).toEqual([]);
    });
});

describe('integrateWithPinnedBase — the policy is checked before the first merge only', () => {
    it('a base that moves after a merge goes to the base-moved retry, never to a "nothing was merged" stop', () => {
        const merged: string[] = [];
        let asked = 0;
        const shas = ['a'.repeat(40), 'b'.repeat(40), 'b'.repeat(40), 'b'.repeat(40)];
        const checks: number[] = [];
        const out = integrateWithPinnedBase(['origin/main'], {
            remoteSha: () => shas[Math.min(asked++, shas.length - 1)] as string,
            merge: (ref) => {
                merged.push(ref);
                return { ok: true, conflicted: [] };
            },
            checkPin: (pinned) => {
                checks.push(pinned.length);
                return checks.length > 1 ? 'nothing was merged' : null;
            },
        });
        expect(merged.length).toBeGreaterThan(0);
        expect(checks).toHaveLength(1);
        expect(out.message).not.toContain('nothing was merged');
        expect(out).toMatchObject({ ok: true, conflicted: [] });
        expect(out.attempts.map((a) => a.attempt)).toEqual([1, 2]);
    });

    it('end to end: the strategy changes after attempt 1 merged — the report names no unmerged tree', () => {
        const f = fixture(tmp);
        const a = git(f.seed, 'rev-parse', 'HEAD').trim();
        commitIn(f.work, 'c.txt', 'c\n');
        const b = advanceMain(f, { [CARRIER_PATH]: 'git:\n  update_strategy: rebase\n' });
        // Strategy read and pin both see `a`; after attempt 1's merge the server reports `b`.
        let asked = 0;
        const deps: BaseDeps = { ...makeGitDeps(f.work), remoteSha: () => (asked++ < 2 ? a : b) };
        const r = run(f, deps);
        const mergedA = contains(f.work, a);
        expect(mergedA).toBe(true);
        expect(r.out).not.toContain('nothing was merged');
    });
});
