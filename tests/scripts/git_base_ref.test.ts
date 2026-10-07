/**
 * One `--base` spelling across `sync_pr_branch` (via `resolveTarget`) and
 * `check_branch_freshness`.
 */
import { describe, expect, it } from 'vitest';

import { parseBaseRef, splitResolvedRef } from '../../src/scripts/_lib/git_base_ref.js';
import { makeTargetDeps, resolveTarget, type GitRunner, type TargetDeps } from '../../src/scripts/_lib/git_convention_carrier.js';

const stubDeps = (remotes: readonly string[]): TargetDeps => ({
    defaultBranch: () => 'origin/main',
    remoteSha: () => null,
    remotes: () => remotes,
});

describe('resolveTarget keeps a base that already names where it lives', () => {
    const deps = stubDeps(['origin', 'upstream']);
    const cases: [string, string][] = [
        ['main', 'origin/main'],
        ['origin/main', 'origin/main'],
        ['release/1.x', 'origin/release/1.x'],
        ['upstream/main', 'upstream/main'],
        ['refs/heads/main', 'refs/remotes/origin/main'],
    ];
    for (const [given, ref] of cases) {
        it(`${given} → ${ref}`, () => {
            expect(resolveTarget(deps, given)?.ref).toBe(ref);
        });
    }

    it('never produces origin/origin/<x>', () => {
        expect(resolveTarget(deps, 'origin/main')?.ref).not.toContain('origin/origin/');
    });
});

describe('the server is asked on the remote the base names', () => {
    function asked(ref: string): string[][] {
        const calls: string[][] = [];
        const run: GitRunner = (_cmd, args) => {
            calls.push([...args]);
            if (args[0] === 'remote') return { ok: true, out: 'origin\nupstream\n', err: '', timedOut: false };
            return { ok: true, out: '', err: '', timedOut: false };
        };
        makeTargetDeps('/nowhere', run).remoteSha(ref);
        return calls.filter((c) => c[0] === 'ls-remote');
    }

    it('upstream/main asks upstream for refs/heads/main', () => {
        expect(asked('upstream/main')).toEqual([['ls-remote', 'upstream', 'refs/heads/main']]);
    });
    it('refs/heads/main asks origin for refs/heads/main', () => {
        expect(asked('refs/heads/main')).toEqual([['ls-remote', 'origin', 'refs/heads/main']]);
    });
    it('origin/release/1.x asks origin for refs/heads/release/1.x', () => {
        expect(asked('origin/release/1.x')).toEqual([['ls-remote', 'origin', 'refs/heads/release/1.x']]);
    });
    it('makeTargetDeps lists the configured remotes', () => {
        const run: GitRunner = () => ({ ok: true, out: 'origin\nupstream\n', err: '', timedOut: false });
        expect(makeTargetDeps('/nowhere', run).remotes?.()).toEqual(['origin', 'upstream']);
    });
});

describe('parseBaseRef', () => {
    it('reads an unknown first segment as part of the branch name', () => {
        expect(parseBaseRef('feature/x', ['origin'])).toEqual({ remote: 'origin', branch: 'feature/x', ref: 'origin/feature/x' });
    });
    it('an empty value is no base', () => {
        expect(parseBaseRef('  ')).toBeNull();
    });
    it('splits a remote-tracking full ref', () => {
        expect(splitResolvedRef('refs/remotes/upstream/main')).toEqual({ remote: 'upstream', branch: 'main', ref: 'refs/remotes/upstream/main' });
    });
});
