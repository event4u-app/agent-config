/**
 * "No open pull request" and "the forge could not be asked" are different
 * answers. Only the first may fall through to the default branch; the second
 * makes the target `unresolvable`, and `sync_pr_branch` maps that through the
 * existing strategy-gate rules (offline with no developer value but `merge` →
 * `unverified`, otherwise a refusal).
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    makeTargetDeps,
    readCommittedConvention,
    type GitRunResult,
    type GitRunner,
    type TargetDeps,
} from '../../src/scripts/_lib/git_convention_carrier.js';
import { main, type BaseDeps } from '../../src/scripts/sync_pr_branch.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;

beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-base-unasked-home-'));
    made.push(home);
    process.env.EVENT4U_CONFIG_HOME = home;
});

afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
    else process.env.EVENT4U_CONFIG_HOME = prevHome;
});

const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

function result(over: Partial<GitRunResult>): GitRunResult {
    return { ok: false, out: '', err: '', timedOut: false, ...over };
}

/** Answers every `gh` call with `gh`, and refuses every other command. */
function ghRunner(gh: GitRunResult): GitRunner {
    return (cmd) => (cmd === 'gh' ? gh : result({ ok: false, err: 'not under test' }));
}

const prBase = (gh: GitRunResult): ReturnType<TargetDeps['prBase']> => makeTargetDeps('/nowhere', ghRunner(gh)).prBase('feat/x');

describe('prBase — an answer versus no answer', () => {
    it('reads the base of the open pull request', () => {
        expect(prBase(result({ ok: true, out: '[{"baseRefName":"release/1.x"}]' }))).toBe('release/1.x');
    });

    it('reads "no open pull request" as null', () => {
        expect(prBase(result({ ok: true, out: '[]' }))).toBeNull();
    });

    it.each([
        ['gh is not installed', result({ missing: true }), /not installed/],
        ['gh is not authenticated', result({ err: 'To get started with GitHub CLI, please run:  gh auth login' }), /could not answer/],
        ['the network failed', result({ err: 'error connecting to api.github.com' }), /could not answer/],
        ['gh timed out', result({ timedOut: true }), /did not answer within/],
        ['gh printed something that is not JSON', result({ ok: true, out: 'oops' }), /not JSON/],
        ['gh answered without a base', result({ ok: true, out: '[{}]' }), /without a baseRefName/],
    ])('reads "%s" as could-not-ask, never as no pull request', (_name, gh, reason) => {
        const got = prBase(gh);
        expect(got).not.toBeNull();
        expect(typeof got).toBe('object');
        expect((got as { unknown: string }).unknown).toMatch(reason);
    });
});

describe('readCommittedConvention — a forge that could not be asked', () => {
    it('reads update_strategy as unresolvable with the reason, never at the default branch', () => {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pr-base-unasked-')));
        made.push(dir);
        git(dir, 'init', '-q', '-b', 'feat/x');
        git(dir, 'commit', '-q', '--allow-empty', '-m', 'seed');
        const defaultAsked = vi.fn((): string | null => 'origin/main');
        const deps: TargetDeps = {
            currentBranch: () => 'feat/x',
            prBase: () => ({ unknown: 'the gh CLI is not installed' }),
            defaultBranch: defaultAsked,
            remoteSha: () => 'a'.repeat(40),
        };
        const read = readCommittedConvention(dir, { deps, keys: ['update_strategy'] });
        expect(read.readings.update_strategy).toMatchObject({ state: 'unresolvable' });
        expect(read.readings.update_strategy?.detail).toContain('the gh CLI is not installed');
        expect(read.target).toBeNull();
        expect(defaultAsked).not.toHaveBeenCalled();
    });
});

describe('sync_pr_branch — a forge that could not be asked', () => {
    /** A feature-branch clone; `offline` points origin at a path that does not exist. */
    function checkout(offline: boolean, settings: string | null): string {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pr-base-unasked-sync-')));
        made.push(root);
        const remote = path.join(root, 'remote.git');
        git(root, 'init', '-q', '--bare', '-b', 'main', remote);
        const work = path.join(root, 'work');
        git(root, 'clone', '-q', remote, work);
        git(work, 'commit', '-q', '--allow-empty', '-m', 'seed');
        git(work, 'push', '-q', 'origin', 'HEAD:main');
        git(work, 'switch', '-q', '-c', 'feat/x');
        if (settings !== null) fs.writeFileSync(path.join(work, '.agent-settings.yml'), settings);
        if (offline) git(work, 'remote', 'set-url', 'origin', path.join(root, 'gone.git'));
        return work;
    }

    const deps = (): BaseDeps => ({
        currentBranch: () => 'feat/x',
        prBase: () => ({ unknown: 'gh could not answer — not authenticated' }),
        defaultBranch: () => 'origin/main',
        remoteSha: () => null,
        readAtSha: () => null,
    });

    function run(repo: string): { code: number; out: string } {
        const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            const code = main(['--repo', repo], deps());
            return { code, out: out.mock.calls.map((c) => String(c[0])).join('') };
        } finally {
            out.mockRestore();
            err.mockRestore();
        }
    }

    it('offline with nothing declared is the unverified warning, nothing merged', () => {
        const r = run(checkout(true, null));
        expect(r.code).toBe(0);
        expect(r.out).toContain('⚠️  sync_pr_branch: unverified');
    });

    it('offline with a developer rebase is a refusal', () => {
        const r = run(checkout(true, 'git:\n  update_strategy: rebase\n'));
        expect(r.code).toBe(4);
        expect(r.out).toContain('refused');
    });

    it('online, the base is unresolvable with the reason, never the default branch', () => {
        const r = run(checkout(false, null));
        expect(r.code).toBe(1);
        expect(r.out).toContain('base could not be resolved');
        expect(r.out).toContain('not authenticated');
    });
});
