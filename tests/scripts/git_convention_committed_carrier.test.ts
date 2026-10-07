/**
 * The committed `.git-convention.yml` (ADR-282) as behaviour, one authority row
 * of the ADR at a time.
 *
 * `update_strategy` is read at the commit the branch is judged against, so a
 * worktree, a fresh clone and CI agree, and a pull request cannot change the
 * strategy its own update is judged by. `commit_format` and `branch_pattern`
 * are read at `HEAD`, at the repository root, over every developer layer.
 */
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { showConvention } from '../../src/scripts/_cli/cmd_git_convention.js';
import { CARRIER_PATH, makeTargetDeps, readCommittedConvention, type TargetDeps } from '../../src/scripts/_lib/git_convention_carrier.js';
import { classify_target } from '../../src/scripts/hooks/block_config_weakening.js';

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

const REBASE = 'git:\n  update_strategy: rebase\n';
const MERGE = 'git:\n  update_strategy: merge\n';

/** Real git, but no forge: there is never an open pull request. */
function noPr(repo: string): TargetDeps {
    return { ...makeTargetDeps(repo), prBase: () => null };
}

describe('update_strategy is read at the target commit', () => {
    it('a worktree and a fresh clone resolve a committed rebase, and none of them merges', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: REBASE });
        const wt = path.join(path.dirname(f.work), 'wt');
        git(f.work, 'worktree', 'add', '-q', '-b', 'feature-wt', wt);
        commitIn(wt, 'w.txt', 'w\n');
        const fresh = path.join(path.dirname(f.work), 'fresh');
        git(path.dirname(f.work), 'clone', '-q', f.remote, fresh);
        git(fresh, 'switch', '-q', '-c', 'feature-fresh');
        advanceMain(f);

        for (const repo of [f.work, wt, fresh]) {
            const r = runSync(repo);
            expect(r.code, repo).toBe(3);
            expect(r.after, repo).toBe(r.before);
            expect(r.out).toContain('git.update_strategy is `rebase`');
        }
    });

    it('the carrier overrides a developer layer that says merge', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: REBASE });
        write(f.work, 'agents/settings/.agent-settings.local.yml', MERGE);
        advanceMain(f);
        expect(runSync(f.work).code).toBe(3);
    });

    it('a pull request cannot loosen the strategy it is judged by', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: REBASE });
        commitIn(f.work, CARRIER_PATH, MERGE);
        advanceMain(f);
        const r = runSync(f.work);
        expect(r.code).toBe(3);
        expect(r.after).toBe(r.before);
    });

    it('a pull request that introduces rebase is still judged by the target, and the branch value is a candidate', () => {
        const f = fixture(tmp);
        commitIn(f.work, CARRIER_PATH, REBASE);
        advanceMain(f);
        const read = readCommittedConvention(f.work, { override: 'origin/main', keys: ['update_strategy'] });
        expect(read.readings.update_strategy).toMatchObject({ value: 'merge', state: 'absent' });
        expect(read.candidates.update_strategy).toMatchObject({ value: 'rebase', state: 'valid' });
        const r = runSync(f.work);
        expect(r.code).toBe(0);
        expect(r.parents).toBe(2);
    });

    it('a carrier that does not parse at the target is exit 4, never merge', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  update_strategy: rebase\nx: [\n' });
        advanceMain(f);
        const r = runSync(f.work);
        expect(r.code).toBe(4);
        expect(r.out).toContain('git-convention-malformed');
        expect(r.out).toContain(CARRIER_PATH);
        expect(r.after).toBe(r.before);
    });

    it('malformed is judged on the target blob, not the branch copy', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: REBASE });
        commitIn(f.work, CARRIER_PATH, 'x: [\n');
        expect(runSync(f.work).code).toBe(0);
        advanceMain(f);
        expect(runSync(f.work).code).toBe(3);
    });

    it('a value outside the schema in the carrier is exit 4', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  update_strategy: rebsae\n' });
        advanceMain(f);
        const r = runSync(f.work);
        expect(r.code).toBe(4);
        expect(r.out).toContain('git-convention-invalid');
    });

    it('a target the server does not know is exit 4, never merge', () => {
        const f = fixture(tmp);
        advanceMain(f);
        const r = runSync(f.work, 'origin/no-such-branch');
        expect(r.code).toBe(4);
        expect(r.out).toContain('git-convention-unresolvable');
        expect(r.after).toBe(r.before);
    });

    it('without a pull request the default branch is the target; with one, its base is', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: MERGE });
        git(f.seed, 'switch', '-q', '-c', 'release');
        commitIn(f.seed, CARRIER_PATH, REBASE);
        git(f.seed, 'push', '-q', 'origin', 'release');

        const viaDefault = readCommittedConvention(f.work, { deps: noPr(f.work), keys: ['update_strategy'] });
        expect(viaDefault.target).toMatchObject({ ref: 'origin/main', reason: 'repository-default-branch' });
        expect(viaDefault.readings.update_strategy?.value).toBe('merge');

        const viaPr = readCommittedConvention(f.work, { deps: { ...noPr(f.work), prBase: () => 'release' }, keys: ['update_strategy'] });
        expect(viaPr.target).toMatchObject({ ref: 'origin/release', reason: 'pull-request-target' });
        expect(viaPr.readings.update_strategy?.value).toBe('rebase');
        expect(viaPr.readAt.update_strategy).toBe(git(f.seed, 'rev-parse', 'HEAD').trim());
    });

    it('a remote branch whose name ends in the target name never stands in for it', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: MERGE });
        const mainSha = git(f.seed, 'rev-parse', 'HEAD').trim();
        git(f.seed, 'switch', '-q', '-c', 'backport/main');
        commitIn(f.seed, CARRIER_PATH, REBASE);
        git(f.seed, 'push', '-q', 'origin', 'backport/main');
        expect(git(f.work, 'ls-remote', '--heads', 'origin', 'main').split('\n')[0]).toContain('refs/heads/backport/main');

        expect(makeTargetDeps(f.work).remoteSha('origin/main')).toBe(mainSha);
        const read = readCommittedConvention(f.work, { deps: noPr(f.work), keys: ['update_strategy'] });
        expect(read.readAt.update_strategy).toBe(mainSha);
        expect(read.readings.update_strategy?.value).toBe('merge');
    });

    it('no pull request and no default branch is unresolvable', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: REBASE });
        const deps: TargetDeps = { ...noPr(f.work), defaultBranch: () => null };
        const read = readCommittedConvention(f.work, { deps, keys: ['update_strategy'] });
        expect(read.readings.update_strategy).toMatchObject({ state: 'unresolvable', reason: 'git-convention-unresolvable', value: null });
    });
});

describe('commit_format and branch_pattern are read at HEAD, at the repository root', () => {
    it('the committed carrier overrides the gitignored local layer (D8)', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  commit_format: ticket-scope\n' });
        write(f.work, 'agents/settings/.agent-settings.local.yml', 'git:\n  commit_format: ticket-conventional\n');
        const read = readCommittedConvention(f.work, { keys: ['commit_format'] });
        expect(read.readings.commit_format).toMatchObject({ value: 'ticket-scope', state: 'valid' });
        expect(read.readings.commit_format?.source).toContain(CARRIER_PATH);
    });

    it('a developer layer still decides a key the carrier does not set', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  commit_format: ticket-scope\n' });
        write(f.work, '.agent-settings.yml', 'git:\n  branch_pattern: "feature/{slug}"\n');
        const read = readCommittedConvention(f.work, { keys: ['branch_pattern'] });
        expect(read.readings.branch_pattern).toMatchObject({ value: 'feature/{slug}', source: path.join(f.work, '.agent-settings.yml') });
    });

    it('a subdirectory with its own project file resolves the repository root value', () => {
        const f = fixture(tmp);
        write(f.work, '.agent-settings.yml', 'git:\n  branch_pattern: "{type}/{slug}"\n');
        write(f.work, 'sub/.agent-settings.yml', 'git:\n  branch_pattern: "feature/{slug}"\n');
        const atRoot = readCommittedConvention(f.work, { keys: ['branch_pattern'] });
        const atSub = readCommittedConvention(path.join(f.work, 'sub'), { keys: ['branch_pattern'] });
        expect(atSub.readings.branch_pattern?.value).toBe('{type}/{slug}');
        expect(atSub.readings.branch_pattern).toEqual(atRoot.readings.branch_pattern);
    });

    it('a committed change on the branch is in force for it; an uncommitted one is a candidate', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  commit_format: ticket-scope\n' });
        commitIn(f.work, CARRIER_PATH, 'git:\n  commit_format: ticket-conventional\n');
        expect(readCommittedConvention(f.work, { keys: ['commit_format'] }).readings.commit_format?.value).toBe('ticket-conventional');
        write(f.work, CARRIER_PATH, 'git:\n  commit_format: ticket-scope\n');
        const read = readCommittedConvention(f.work, { keys: ['commit_format'] });
        expect(read.readings.commit_format?.value).toBe('ticket-conventional');
        expect(read.candidates.commit_format).toMatchObject({ value: 'ticket-scope', source: path.join(f.work, CARRIER_PATH) });
    });

    it('a carrier at HEAD that does not parse is malformed', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git: [\n' });
        expect(readCommittedConvention(f.work, { keys: ['commit_format'] }).readings.commit_format?.state).toBe('malformed');
    });
});

describe('git:convention show', () => {
    it('names the value in force, the commit it was read at, and the branch-local candidate', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: MERGE });
        commitIn(f.work, CARRIER_PATH, REBASE);
        const r = showConvention(['--base', 'origin/main'], f.work, noPr(f.work));
        expect(r.code).toBe(0);
        const text = r.out.join('\n');
        expect(text).toContain('git.update_strategy = merge');
        expect(text).toMatch(/read at +[0-9a-f]{12} — origin\/main/);
        expect(text).toMatch(/candidate rebase \(valid\) from .*\.git-convention\.yml — this checkout's value; the value above is in force/);

        const json = JSON.parse(showConvention(['--json', '--base', 'origin/main'], f.work, noPr(f.work)).out.join('\n')) as {
            keys: Record<string, { value: string; read_at: string; candidate: { value: string } | null }>;
            target: { ref: string; sha: string };
        };
        expect(json.keys.update_strategy?.value).toBe('merge');
        expect(json.keys.update_strategy?.candidate?.value).toBe('rebase');
        expect(json.keys.update_strategy?.read_at).toBe(json.target.sha);
    });

    it('exits non-zero when the carrier in force does not parse', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  update_strategy: rebase\nx: [\n' });
        const r = showConvention(['--base', 'origin/main'], f.work, noPr(f.work));
        expect(r.code).toBe(1);
        expect(r.out.join('\n')).not.toContain('git.update_strategy = merge');
    });
});

describe('the class-C fence', () => {
    it('classifies the carrier like the project settings files', () => {
        expect(classify_target(CARRIER_PATH)).toBe('class-c');
        expect(classify_target(`some/repo/${CARRIER_PATH}`)).toBe('class-c');
    });
});
