/**
 * Where a team's git convention is read from, as behaviour rather than prose.
 *
 * The `git.*` keys were read from the developer settings layers only. Those are
 * gitignored, so a worktree, a fresh clone and CI never saw a declared `rebase`
 * and merged; the committed team file and the user-global file the GUI writes
 * were read as "not set"; and the gitignored local layer and a subdirectory's
 * own project file could each override what the repository root declared.
 */
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSettingsGet } from '../../src/scripts/_cli/cmd_settings_get.js';
import { checkoutSource, readGitConventionKey } from '../../src/scripts/_lib/git_convention.js';
import { resolveWriteRoot } from '../../src/server/writeRoot.js';

import { TmpDirs, advanceMain, commitIn, fixture, git, isolateUserGlobal, runSync, write } from './_git_convention_repo.js';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

const tmp = new TmpDirs();
let restore: () => void;
beforeEach(() => {
    restore = isolateUserGlobal(tmp);
});
afterEach(() => {
    restore();
    tmp.cleanup();
});

function settingsGet(key: string, cwd: string): { set: boolean; dropped: string | null } {
    const r = runSettingsGet({ key, cwd, packageRoot: PACKAGE_ROOT, json: true });
    const parsed = JSON.parse(r.out.join('\n')) as { set: boolean; user_global_dropped: string | null };
    return { set: parsed.set, dropped: parsed.user_global_dropped };
}

describe('the developer layers do not travel', () => {
    it('a worktree with its own commit merges while the primary checkout refuses', () => {
        const f = fixture(tmp);
        write(f.work, '.agent-settings.yml', 'git:\n  update_strategy: rebase\n');
        const wt = path.join(path.dirname(f.work), 'wt');
        git(f.work, 'worktree', 'add', '-q', '-b', 'feature-wt', wt);
        commitIn(wt, 'w.txt', 'w\n');
        advanceMain(f);

        const primary = runSync(f.work);
        expect(primary.code).toBe(3);
        expect(primary.after).toBe(primary.before);

        const worktree = runSync(wt);
        expect(worktree.code).toBe(0);
        expect(worktree.after).not.toBe(worktree.before);
        expect(worktree.parents).toBe(2);
    });

    it('a key in the committed team file reads "not set"', () => {
        const f = fixture(tmp, { '.agent-project-settings.yml': 'git:\n  update_strategy: rebase\n' });
        expect(settingsGet('git.update_strategy', f.work).set).toBe(false);
        expect(readGitConventionKey('update_strategy', checkoutSource(f.work)).state).toBe('absent');
    });

    it('a key written through the GUI write root reads "not set"', () => {
        const f = fixture(tmp);
        const { writeRoot, mode } = resolveWriteRoot({ cwd: f.work });
        expect(mode).toBe('global');
        const written = write(writeRoot, 'settings/.agent-settings.yml', 'git:\n  update_strategy: rebase\n');
        const got = settingsGet('git.update_strategy', f.work);
        expect(got.set).toBe(false);
        expect(got.dropped).toBe(written);
    });

    it('the gitignored local layer overrides the canonical file', () => {
        const f = fixture(tmp);
        write(f.work, 'agents/settings/.agent-settings.yml', 'git:\n  commit_format: ticket-scope\n');
        const local = write(f.work, 'agents/settings/.agent-settings.local.yml', 'git:\n  commit_format: ticket-conventional\n');
        const r = readGitConventionKey('commit_format', checkoutSource(f.work));
        expect(r).toMatchObject({ value: 'ticket-conventional', source: local, state: 'valid' });
    });

    it('a subdirectory with its own project file resolves a different value than the repository root', () => {
        const f = fixture(tmp);
        write(f.work, '.agent-settings.yml', 'git:\n  branch_pattern: "{type}/{slug}"\n');
        write(f.work, 'sub/.agent-settings.yml', 'git:\n  branch_pattern: "feature/{slug}"\n');
        const atRoot = readGitConventionKey('branch_pattern', checkoutSource(f.work));
        const atSub = readGitConventionKey('branch_pattern', checkoutSource(path.join(f.work, 'sub')));
        expect(atRoot.value).toBe('{type}/{slug}');
        expect(atSub.value).toBe('feature/{slug}');
    });
});
