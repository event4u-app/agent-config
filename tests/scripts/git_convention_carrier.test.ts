/**
 * Where a team's git convention is read from, as behaviour rather than prose.
 *
 * The `git.*` keys were read from the developer settings layers only. Those are
 * gitignored, so a worktree, a fresh clone and CI never saw a declared `rebase`
 * and merged; the gitignored local layer and a subdirectory's own project file
 * could each override what the repository root declared. With the convention
 * committed in `.git-convention.yml` (ADR-283) those three facts are reversed.
 *
 * Two stay as they were, by decision: the legacy team file and the user-global
 * file the GUI writes still carry no `git.*` key, because the carrier is where
 * a team declares.
 */
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSettingsGet } from '../../src/scripts/_cli/cmd_settings_get.js';
import { checkoutSource, readGitConventionKey } from '../../src/scripts/_lib/git_convention.js';
import { CARRIER_PATH, readCommittedConvention } from '../../src/scripts/_lib/git_convention_carrier.js';
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

describe('where the convention is read from', () => {
    it('a worktree with its own commit refuses like the primary checkout once the convention is committed', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  update_strategy: rebase\n' });
        const wt = path.join(path.dirname(f.work), 'wt');
        git(f.work, 'worktree', 'add', '-q', '-b', 'feature-wt', wt);
        commitIn(wt, 'w.txt', 'w\n');
        advanceMain(f);

        const primary = runSync(f.work);
        expect(primary.code).toBe(3);
        expect(primary.after).toBe(primary.before);

        const worktree = runSync(wt);
        expect(worktree.code).toBe(3);
        expect(worktree.after).toBe(worktree.before);
    });

    it('a developer-only rebase still reaches the checkout it was written in and no worktree', () => {
        const f = fixture(tmp);
        write(f.work, '.agent-settings.yml', 'git:\n  update_strategy: rebase\n');
        const wt = path.join(path.dirname(f.work), 'wt');
        git(f.work, 'worktree', 'add', '-q', '-b', 'feature-wt', wt);
        commitIn(wt, 'w.txt', 'w\n');
        advanceMain(f);
        expect(runSync(f.work).code).toBe(3);
        expect(runSync(wt).parents).toBe(2);
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

    it('the gitignored local layer no longer overrides a committed declaration', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  commit_format: ticket-scope\n' });
        write(f.work, 'agents/settings/.agent-settings.yml', 'git:\n  commit_format: ticket-scope\n');
        write(f.work, 'agents/settings/.agent-settings.local.yml', 'git:\n  commit_format: ticket-conventional\n');
        const r = readCommittedConvention(f.work, { keys: ['commit_format'] }).readings.commit_format;
        expect(r).toMatchObject({ value: 'ticket-scope', state: 'valid' });
        expect(r?.source).toContain(CARRIER_PATH);
        expect(readGitConventionKey('commit_format', checkoutSource(f.work)).value).toBe('ticket-conventional');
    });

    it('a subdirectory with its own project file resolves the same value as the repository root', () => {
        const f = fixture(tmp);
        write(f.work, '.agent-settings.yml', 'git:\n  branch_pattern: "{type}/{slug}"\n');
        write(f.work, 'sub/.agent-settings.yml', 'git:\n  branch_pattern: "feature/{slug}"\n');
        const atRoot = readCommittedConvention(f.work, { keys: ['branch_pattern'] }).readings.branch_pattern;
        const atSub = readCommittedConvention(path.join(f.work, 'sub'), { keys: ['branch_pattern'] }).readings.branch_pattern;
        expect(atRoot?.value).toBe('{type}/{slug}');
        expect(atSub?.value).toBe('{type}/{slug}');
    });
});
