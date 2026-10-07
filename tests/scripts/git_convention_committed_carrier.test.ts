/**
 * The committed `.git-convention.yml` (ADR-283) as behaviour, one authority row
 * of the ADR at a time.
 *
 * `update_strategy` is read at the commit the branch is judged against, so a
 * worktree, a fresh clone and CI agree, and a pull request cannot change the
 * strategy its own update is judged by. `commit_format` and `branch_pattern`
 * are read at `HEAD`, at the repository root, over every developer layer.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runGitConvention, showConvention } from '../../src/scripts/_cli/cmd_git_convention.js';
import { CARRIER_PATH, makeTargetDeps, parseExactHeadSha, readCommittedConvention, runGit, type GitRunner, type TargetDeps } from '../../src/scripts/_lib/git_convention_carrier.js';
import { classify_target } from '../../src/scripts/hooks/block_config_weakening.js';
import { main as syncMain, makeGitDeps } from '../../src/scripts/sync_pr_branch.js';

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

    it('a carrier whose git: is not a map is invalid, not malformed (ADR-283 authority table)', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git: rebase\n' });
        advanceMain(f);
        const r = runSync(f.work);
        expect(r.code).toBe(4);
        expect(r.out).toContain('git-convention-invalid');
        expect(r.out).not.toContain('git-convention-malformed');
    });

    it('a target the server does not know is exit 1, the base could not be resolved, never merge', () => {
        const f = fixture(tmp);
        advanceMain(f);
        const r = runSync(f.work, 'origin/no-such-branch');
        expect(r.code).toBe(1);
        expect(r.out).toContain('base could not be resolved');
        expect(r.out).not.toContain('git-convention-unresolvable');
        expect(r.after).toBe(r.before);
    });

    it('no --base and no default branch is exit 1, the base could not be resolved', () => {
        const f = fixture(tmp);
        const deps = { ...makeGitDeps(f.work), defaultBranch: () => null };
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        let code: number;
        let out: string;
        try {
            code = syncMain(['--repo', f.work], deps);
            out = spy.mock.calls.map((c) => String(c[0])).join('');
        } finally {
            spy.mockRestore();
        }
        expect(code).toBe(1);
        expect(out).toContain('base could not be resolved');
        expect(out).not.toContain('git-convention-unresolvable');
    });

    it('a target the server names whose commit cannot be fetched is unverified, exit 0, nothing merged', () => {
        const f = fixture(tmp);
        const deps = { ...makeGitDeps(f.work), remoteSha: () => 'f'.repeat(40) };
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        let code: number;
        let out: string;
        try {
            code = syncMain(['--repo', f.work, '--base', 'origin/main'], deps);
            out = spy.mock.calls.map((c) => String(c[0])).join('');
        } finally {
            spy.mockRestore();
        }
        expect(code).toBe(0);
        expect(out).toContain('unverified');
        expect(out).not.toContain('base could not be resolved');
    });

    it.each([
        ['nothing declared', null],
        ['a developer rebase', REBASE],
    ])('origin unreachable at the ref lookup with %s is exit 1, nothing merged', (_name, local) => {
        const f = fixture(tmp);
        advanceMain(f);
        if (local !== null) write(f.work, 'agents/settings/.agent-settings.local.yml', local);
        git(f.work, 'remote', 'set-url', 'origin', path.join(path.dirname(f.work), 'unreachable.git'));
        const r = runSync(f.work);
        expect(r.code).toBe(1);
        expect(r.out).toContain('base could not be resolved');
        expect(r.after).toBe(r.before);
    });

    it('without --base the default branch is the target; with one, that base is', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: MERGE });
        git(f.seed, 'switch', '-q', '-c', 'release');
        commitIn(f.seed, CARRIER_PATH, REBASE);
        git(f.seed, 'push', '-q', 'origin', 'release');

        const viaDefault = readCommittedConvention(f.work, { deps: makeTargetDeps(f.work), keys: ['update_strategy'] });
        expect(viaDefault.target).toMatchObject({ ref: 'origin/main', reason: 'repository-default-branch' });
        expect(viaDefault.readings.update_strategy?.value).toBe('merge');

        const viaPr = readCommittedConvention(f.work, { override: 'origin/release', deps: makeTargetDeps(f.work), keys: ['update_strategy'] });
        expect(viaPr.target).toMatchObject({ ref: 'origin/release', reason: 'explicit-base-override' });
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
        const read = readCommittedConvention(f.work, { deps: makeTargetDeps(f.work), keys: ['update_strategy'] });
        expect(read.readAt.update_strategy).toBe(mainSha);
        expect(read.readings.update_strategy?.value).toBe('merge');
    });

    it('no --base and no default branch is unresolvable', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: REBASE });
        const deps: TargetDeps = { ...makeTargetDeps(f.work), defaultBranch: () => null };
        const read = readCommittedConvention(f.work, { deps, keys: ['update_strategy'] });
        expect(read.readings.update_strategy).toMatchObject({ state: 'unresolvable', reason: 'git-convention-unresolvable', value: null });
    });
});

describe('a SHA-256 repository', () => {
    it('parses a 64-hex SHA as exactly as a 40-hex one', () => {
        const sha256 = 'a'.repeat(64);
        expect(parseExactHeadSha(`${sha256}\trefs/heads/main\n`, 'main')).toBe(sha256);
        expect(parseExactHeadSha(`${'b'.repeat(40)}\trefs/heads/main\n`, 'main')).toBe('b'.repeat(40));
        expect(parseExactHeadSha(`${'c'.repeat(50)}\trefs/heads/main\n`, 'main')).toBeNull();
    });

    it('resolves the target and reads the carrier at it', () => {
        const root = tmp.make();
        const remote = path.join(root, 'remote.git');
        git(root, 'init', '-q', '--bare', '--object-format=sha256', '-b', 'main', remote);
        const work = path.join(root, 'work');
        git(root, 'init', '-q', '--object-format=sha256', '-b', 'main', work);
        git(work, 'remote', 'add', 'origin', remote);
        commitIn(work, CARRIER_PATH, REBASE);
        git(work, 'push', '-q', 'origin', 'HEAD:main');
        const head = git(work, 'rev-parse', 'HEAD').trim();
        expect(head).toHaveLength(64);
        const read = readCommittedConvention(work, { override: 'origin/main', deps: makeTargetDeps(work), keys: ['update_strategy'] });
        expect(read.readAt.update_strategy).toBe(head);
        expect(read.readings.update_strategy).toMatchObject({ value: 'rebase', state: 'valid' });
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

    it('a carrier at HEAD that cannot be read is unresolvable, never the developer value', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  commit_format: ticket-conventional\n' });
        const failTree: GitRunner = (cmd, args, cwd, timeoutMs) =>
            args[0] === 'ls-tree' ? { ok: false, out: '', err: 'fatal: not a tree object', timedOut: false } : runGit(cmd, args, cwd, timeoutMs);
        const read = readCommittedConvention(f.work, { keys: ['commit_format', 'branch_pattern'], run: failTree });
        expect(read.readings.commit_format).toMatchObject({ state: 'unresolvable', value: null });
        expect(read.readings.branch_pattern).toMatchObject({ state: 'unresolvable', value: null });
    });

    it('a working-tree carrier that cannot be read is a malformed candidate, as the developer files are', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  commit_format: ticket-scope\n' });
        const file = path.join(f.work, CARRIER_PATH);
        fs.chmodSync(file, 0o000);
        try {
            const read = readCommittedConvention(f.work, { keys: ['commit_format'] });
            expect(read.readings.commit_format?.value).toBe('ticket-scope');
            expect(read.candidates.commit_format).toMatchObject({ state: 'malformed', source: file });
        } finally {
            fs.chmodSync(file, 0o644);
        }
    });
});

describe('git:convention show', () => {
    it('names the value in force, the commit it was read at, and the branch-local candidate', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: MERGE });
        commitIn(f.work, CARRIER_PATH, REBASE);
        const r = showConvention(['--base', 'origin/main'], f.work, makeTargetDeps(f.work));
        expect(r.code).toBe(0);
        const text = r.out.join('\n');
        expect(text).toContain('git.update_strategy = merge');
        expect(text).toMatch(/read at +[0-9a-f]{12} — origin\/main/);
        expect(text).toMatch(/candidate rebase \(valid\) from .*\.git-convention\.yml — this checkout's value; the value above is in force/);

        const json = JSON.parse(showConvention(['--json', '--base', 'origin/main'], f.work, makeTargetDeps(f.work)).out.join('\n')) as {
            keys: Record<string, { value: string; read_at: string; candidate: { value: string } | null }>;
            target: { ref: string; sha: string };
        };
        expect(json.keys.update_strategy?.value).toBe('merge');
        expect(json.keys.update_strategy?.candidate?.value).toBe('rebase');
        expect(json.keys.update_strategy?.read_at).toBe(json.target.sha);
    });

    it('exits non-zero when the carrier in force does not parse', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: 'git:\n  update_strategy: rebase\nx: [\n' });
        const r = showConvention(['--base', 'origin/main'], f.work, makeTargetDeps(f.work));
        expect(r.code).toBe(1);
        expect(r.out.join('\n')).not.toContain('git.update_strategy = merge');
    });
});

describe('one run resolves its target once', () => {
    it('the strategy and the sync are judged against the same answer, asked for once', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: REBASE });
        advanceMain(f);
        const calls: string[] = [];
        const real = makeGitDeps(f.work);
        const deps = {
            ...real,
            defaultBranch: (): string | null => {
                calls.push('defaultBranch');
                return real.defaultBranch();
            },
            remoteSha: (ref: string): string | null => {
                calls.push(`remoteSha ${ref}`);
                return real.remoteSha(ref);
            },
        };
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        let code: number;
        try {
            code = syncMain(['--repo', f.work], deps);
        } finally {
            spy.mockRestore();
        }
        expect(code).toBe(3);
        expect(calls.filter((c) => c === 'remoteSha origin/main')).toHaveLength(1);
        expect(calls.filter((c) => c === 'defaultBranch').length).toBeLessThanOrEqual(1);
    });
});

describe('git:convention sync — the branch update an installed command can reach', () => {
    const sync = (cwd: string, ...args: string[]): { code: number; out: string } => {
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        try {
            const r = runGitConvention(['sync', '--base', 'origin/main', ...args], cwd);
            return { code: r.code, out: spy.mock.calls.map((c) => String(c[0])).join('') };
        } finally {
            spy.mockRestore();
        }
    };

    it('runs the sync in the directory it was called from and passes its exit codes through', () => {
        const f = fixture(tmp, { [CARRIER_PATH]: REBASE });
        expect(sync(f.work).code).toBe(0);
        advanceMain(f);
        const before = git(f.work, 'rev-parse', 'HEAD');
        const behind = sync(f.work);
        expect(behind.code).toBe(3);
        expect(behind.out).toContain('git.update_strategy is `rebase`');
        expect(git(f.work, 'rev-parse', 'HEAD')).toBe(before);
    });

    it('merges under the default strategy and refuses an unreadable one with exit 4', () => {
        const merge = fixture(tmp);
        commitIn(merge.work, 'f.txt', 'f\n');
        advanceMain(merge);
        expect(sync(merge.work).code).toBe(0);
        expect(git(merge.work, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ')).toHaveLength(3);

        const broken = fixture(tmp, { [CARRIER_PATH]: 'git:\n  update_strategy: rebsae\n' });
        expect(sync(broken.work).code).toBe(4);
    });

    it('lists sync in its usage', () => {
        expect(runGitConvention(['--help'], process.cwd()).out.join('\n')).toContain('git:convention sync');
    });
});

describe('the class-C fence', () => {
    it('classifies the carrier like the project settings files', () => {
        expect(classify_target(CARRIER_PATH)).toBe('class-c');
        expect(classify_target(`some/repo/${CARRIER_PATH}`)).toBe('class-c');
    });
});
