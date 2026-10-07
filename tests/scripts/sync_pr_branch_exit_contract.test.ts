/**
 * The exit contract for an unreadable `git.update_strategy`, one row at a time.
 *
 * The target is `--base`, else the default branch; nothing is inferred from a
 * forge. A target that names no commit is exit 1, a target whose commit cannot
 * be fetched is `unverified` (exit 0, nothing touched), and a refusing carrier
 * or developer file is exit 4. `strategyExit` is the one function that decides;
 * the rows below pin it directly and through real repositories.
 */
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { conventionReading, type GitConventionReading, type GitConventionState } from '../../src/scripts/_lib/git_convention.js';
import { CARRIER_PATH } from '../../src/scripts/_lib/git_convention_carrier.js';
import { main as syncMain, makeGitDeps, strategyExit, type BaseDeps } from '../../src/scripts/sync_pr_branch.js';

import { TmpDirs, advanceMain, commitIn, fixture, git, isolateUserGlobal, runSync, write } from './_git_convention_repo.js';

const tmp = new TmpDirs();
let restore: () => void;
beforeEach(() => {
    restore = isolateUserGlobal(tmp);
});
afterEach(() => {
    restore();
    tmp.cleanup();
});

const reading = (state: GitConventionState, value: string | null = null): GitConventionReading =>
    conventionReading('update_strategy', state, value, CARRIER_PATH, state === 'unresolvable' ? 'the target detail' : null);

describe('strategyExit — the table', () => {
    it.each<[string, GitConventionReading, boolean, GitConventionReading, 0 | 1 | 4 | null]>([
        ['a readable strategy goes on', reading('valid', 'rebase'), true, reading('absent'), null],
        ['an absent strategy goes on', reading('absent'), true, reading('absent'), null],
        ['a malformed carrier at the target', reading('malformed'), true, reading('absent'), 4],
        ['an invalid carrier at the target', reading('invalid'), true, reading('absent'), 4],
        ['a user-global-only value', reading('discarded'), true, reading('absent'), 4],
        ['a developer file that refuses, target unresolved', reading('unresolvable'), false, reading('malformed'), 4],
        ['a developer file that refuses, target unfetched', reading('unresolvable'), true, reading('invalid'), 4],
        ['a target that names no commit', reading('unresolvable'), false, reading('absent'), 1],
        ['a target that names no commit, developer rebase', reading('unresolvable'), false, reading('valid', 'rebase'), 1],
        ['a named commit that could not be fetched', reading('unresolvable'), true, reading('absent'), 0],
        ['a named commit that could not be fetched, developer rebase', reading('unresolvable'), true, reading('valid', 'rebase'), 0],
    ])('%s', (_name, inForce, baseResolved, developer, exit) => {
        const gate = strategyExit(inForce, baseResolved, developer);
        expect(gate.exit).toBe(exit);
        if (exit === 1) expect(gate.line).toContain('base could not be resolved — the target detail');
        if (exit === 0) expect(gate.line).toContain('unverified — the target detail');
        if (exit === 4) expect(gate.line).toContain('refused');
    });
});

function quiet(run: () => number): { code: number; out: string } {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = run();
        return { code, out: spy.mock.calls.map((c) => String(c[0])).join('') };
    } finally {
        spy.mockRestore();
    }
}

describe('the rows through a real repository', () => {
    it('a --base the server does not know is exit 1', () => {
        const f = fixture(tmp);
        const r = runSync(f.work, 'origin/no-such-branch');
        expect(r.code).toBe(1);
        expect(r.out).toContain('base could not be resolved');
        expect(r.after).toBe(r.before);
    });

    it('a repository with no origin is exit 1, with or without --base', () => {
        const f = fixture(tmp);
        git(f.work, 'remote', 'remove', 'origin');
        expect(runSync(f.work).code).toBe(1);
        const r = quiet(() => syncMain(['--repo', f.work]));
        expect(r.code).toBe(1);
        expect(r.out).toContain('base could not be resolved');
    });

    it('no --base and no default branch is exit 1', () => {
        const f = fixture(tmp);
        const deps: BaseDeps = { ...makeGitDeps(f.work), defaultBranch: () => null };
        const r = quiet(() => syncMain(['--repo', f.work], deps));
        expect(r.code).toBe(1);
        expect(r.out).toContain('no --base was given');
    });

    it('origin unreachable is exit 1 for the default base and for any other base alike', () => {
        const f = fixture(tmp);
        git(f.seed, 'switch', '-q', '-c', 'release');
        git(f.seed, 'push', '-q', 'origin', 'release');
        git(f.work, 'fetch', '-q', 'origin');
        git(f.work, 'remote', 'set-url', 'origin', path.join(path.dirname(f.work), 'unreachable.git'));
        for (const base of ['origin/main', 'origin/release']) {
            const r = runSync(f.work, base);
            expect(r.code, base).toBe(1);
            expect(r.out, base).toContain('base could not be resolved');
            expect(r.after, base).toBe(r.before);
        }
    });

    it('a target the server names whose commit cannot be fetched is unverified, exit 0, nothing merged', () => {
        const f = fixture(tmp);
        advanceMain(f);
        const deps: BaseDeps = { ...makeGitDeps(f.work), remoteSha: () => 'e'.repeat(40) };
        const before = git(f.work, 'rev-parse', 'HEAD');
        const r = quiet(() => syncMain(['--repo', f.work, '--base', 'origin/main'], deps));
        expect(r.code).toBe(0);
        expect(r.out).toContain('unverified');
        expect(git(f.work, 'rev-parse', 'HEAD')).toBe(before);
    });

    it('a carrier at the target that does not parse is exit 4', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  update_strategy: rebase\nx: [\n' });
        const r = runSync(f.work);
        expect(r.code).toBe(4);
        expect(r.out).toContain('git-convention-malformed');
    });

    it('a developer file that refuses is exit 4 even when the target cannot be resolved', () => {
        const f = fixture(tmp);
        write(f.work, '.agent-settings.yml', 'git:\n  update_strategy: rebsae\n');
        commitIn(f.work, 'c.txt', 'c\n');
        const r = runSync(f.work, 'origin/no-such-branch');
        expect(r.code).toBe(4);
        expect(r.after).toBe(r.before);
    });
});
