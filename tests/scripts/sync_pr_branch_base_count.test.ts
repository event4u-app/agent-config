/**
 * "Already current" must mean the branch was counted against the remote base
 * and found 0 behind — never that the count could not be taken.
 *
 * Two reproduced false greens: `--base main` counted against the local `main`,
 * a clone-time copy that never moves, and a single-branch clone counted against
 * an `origin/main` it never fetched, where the failed `rev-list` read as 0.
 */
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TmpDirs, advanceMain, fixture, git, isolateUserGlobal, runSync } from './_git_convention_repo.js';

const tmp = new TmpDirs();
let restore: () => void = () => {};

beforeEach(() => {
    restore = isolateUserGlobal(tmp);
});

afterEach(() => {
    restore();
    tmp.cleanup();
});

describe('sync_pr_branch counts against the remote base', () => {
    it('reads a bare --base main as origin/main, not the stale local main', () => {
        const f = fixture(tmp);
        advanceMain(f);
        const r = runSync(f.work, 'main');
        expect(r.out).not.toContain('already current');
        expect(r.out).toContain('origin/main');
        expect(r.after).not.toBe(r.before);
    });

    it('reads --base refs/heads/main as the fetched origin/main, not the stale local main', () => {
        const f = fixture(tmp);
        advanceMain(f);
        const r = runSync(f.work, 'refs/heads/main');
        expect(r.out).not.toContain('already current');
        expect(r.out).toContain('refs/remotes/origin/main');
        expect(r.after).not.toBe(r.before);
        expect(git(f.work, 'merge-base', '--is-ancestor', git(f.seed, 'rev-parse', 'HEAD').trim(), 'HEAD')).toBe('');
    });

    it('refuses rather than reporting current when the base ref was never fetched', () => {
        const f = fixture(tmp);
        git(f.work, 'push', '-q', 'origin', 'feature');
        const single = path.join(path.dirname(f.work), 'single');
        git(path.dirname(f.work), 'clone', '-q', '--single-branch', '-b', 'feature', f.remote, single);
        advanceMain(f);
        const r = runSync(single, 'origin/main');
        expect(r.out).not.toContain('already current');
        expect(r.out).toMatch(/cannot count .*origin\/main/);
        expect(r.code).not.toBe(0);
    });
});
