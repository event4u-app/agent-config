/**
 * The rebase sequence in `references/branch-update.md`, run against real bare
 * remotes while a second clone pushes to the published branch.
 *
 * Two measured facts anchor it: for a branch cut from `origin/main` and pushed
 * without `-u`, `@{u}` is the base, so a stop or lease read from it checks the
 * wrong ref; and only the explicit `<ref>:<sha>` lease rejects a collaborator's
 * push — the bare form, after a fetch, overwrites it. Each publish
 * configuration a team actually uses is a separate case, because each resolves
 * the target through a different path.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { collaboratorPushesDuringRebase, PREPARE_BLOCKS, runBlocks, runSequence, sandbox, sequenceBlock, type Sandbox } from '../_lib/rebase_sequence.js';


interface Fixture {
    sb: Sandbox;
    me: string;
    collab: string;
    publishUrl: string;
    env: Record<string, string>;
}

type Layout = 'upstream' | 'pushRemote' | 'pushDefault' | 'fork-pr-head';

const roots: string[] = [];
afterEach(() => {
    for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

function fixture(layout: Layout): Fixture {
    const sb = sandbox();
    roots.push(sb.root);
    const origin = path.join(sb.root, 'upstream', 'project.git');
    const fork = path.join(sb.root, 'alice', 'project.git');
    for (const bare of [origin, fork]) {
        fs.mkdirSync(bare, { recursive: true });
        sb.git(bare, 'init', '-q', '--bare', '-b', 'main');
    }

    const seed = path.join(sb.root, 'seed');
    sb.git(sb.root, 'clone', '-q', origin, seed);
    sb.commit(seed, 'base.txt', 'base\n', 'base');
    sb.git(seed, 'push', '-q', 'origin', 'main');

    const me = path.join(sb.root, 'me');
    sb.git(sb.root, 'clone', '-q', origin, me);
    const publishesToFork = layout !== 'upstream';
    if (publishesToFork) {
        sb.git(me, 'remote', 'add', 'alice', fork);
        sb.git(me, 'push', '-q', 'alice', 'main');
    }
    sb.git(me, 'switch', '-q', '-c', 'feat', 'origin/main');
    sb.commit(me, 'feat.txt', 'feat\n', 'feat');

    const remote = publishesToFork ? 'alice' : 'origin';
    const publishUrl = publishesToFork ? fork : origin;
    const env: Record<string, string> = { BASE: 'main', DESCENDANTS: '' };
    switch (layout) {
        case 'upstream':
            sb.git(me, 'push', '-q', '-u', 'origin', 'feat');
            break;
        case 'pushRemote':
            sb.git(me, 'push', '-q', remote, 'feat');
            sb.git(me, 'config', 'branch.feat.pushRemote', remote);
            sb.git(me, 'config', 'push.default', 'current');
            break;
        case 'pushDefault':
            sb.git(me, 'push', '-q', remote, 'feat');
            sb.git(me, 'config', 'remote.pushDefault', remote);
            sb.git(me, 'config', 'push.default', 'current');
            break;
        case 'fork-pr-head':
            sb.git(me, 'push', '-q', remote, 'feat');
            sb.git(me, 'branch', '--unset-upstream');
            env.PR_HEAD_REPO = 'alice/project';
            env.PR_HEAD_REF = 'feat';
            break;
    }

    // The base advances, so the rebase rewrites something.
    sb.commit(seed, 'base2.txt', 'base2\n', 'base moves');
    sb.git(seed, 'push', '-q', 'origin', 'main');

    const collab = path.join(sb.root, 'collab');
    sb.git(sb.root, 'clone', '-q', '-b', 'feat', publishUrl, collab);
    sb.commit(collab, 'collab.txt', 'collab\n', 'collaborator');

    return { sb, me, collab, publishUrl, env };
}

const published = (f: Fixture): string => f.sb.git(f.me, 'ls-remote', f.publishUrl, 'refs/heads/feat').split('\t')[0] ?? '';
const collabHead = (f: Fixture): string => f.sb.git(f.collab, 'rev-parse', 'HEAD');

describe.each<Layout>(['upstream', 'pushRemote', 'pushDefault', 'fork-pr-head'])('publish target via %s', (layout) => {
    it('publishes the rebased branch when nobody else pushed', () => {
        const f = fixture(layout);
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.stderr).not.toContain('STOP');
        expect(r.status).toBe(0);
        expect(published(f)).toBe(f.sb.git(f.me, 'rev-parse', 'HEAD'));
        expect(f.sb.git(f.me, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD')).toBe('');
    });

    it('rejects the lease when a collaborator pushes between the pin and the push', () => {
        const f = fixture(layout);
        collaboratorPushesDuringRebase(f.sb, f.me, f.collab, f.publishUrl, 'feat');
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('STOP: the lease was rejected');
        expect(published(f)).toBe(collabHead(f));
    });

    it('stops before the rebase when the published ref has commits HEAD lacks', () => {
        const f = fixture(layout);
        f.sb.git(f.collab, 'push', '-q', f.publishUrl, 'HEAD:refs/heads/feat');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('has commits this branch lacks');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(published(f)).toBe(collabHead(f));
    });
});

describe('an unresolved publish target', () => {
    it('refuses to rewrite a branch whose upstream is the base, rather than leasing the base', () => {
        const f = fixture('upstream');
        // Cut from origin/main and pushed without -u: @{u} is the base.
        f.sb.git(f.me, 'branch', '-u', 'origin/main');
        expect(f.sb.git(f.me, 'rev-parse', '--symbolic-full-name', '@{u}')).toBe('refs/remotes/origin/main');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('publish target unresolved');
        expect(r.stderr).toContain('git push -u <remote> feat');
        expect(r.stderr).toContain('then run the sequence again');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
    });

    it('refuses a publish target that is the base itself, as push.default=upstream resolves it', () => {
        const f = fixture('upstream');
        f.sb.git(f.me, 'branch', '-u', 'origin/main');
        f.sb.git(f.me, 'config', 'push.default', 'upstream');
        expect(f.sb.git(f.me, 'rev-parse', '--symbolic-full-name', '@{push}')).toBe('refs/remotes/origin/main');
        // Already on top of the base, so the "has commits this branch lacks" stop cannot catch it.
        f.sb.git(f.me, 'fetch', '-q', 'origin');
        f.sb.git(f.me, 'rebase', '-q', 'origin/main');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const baseBefore = f.sb.git(f.me, 'ls-remote', 'origin', 'refs/heads/main').split('\t')[0];
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('is the base branch');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(f.sb.git(f.me, 'ls-remote', 'origin', 'refs/heads/main').split('\t')[0]).toBe(baseBefore);
    });

    it('refuses the remote default branch even when BASE is not a branch name', () => {
        const f = fixture('upstream');
        f.sb.git(f.me, 'branch', '-u', 'origin/main');
        f.sb.git(f.me, 'config', 'push.default', 'upstream');
        const r = runBlocks(f.sb, f.me, sequenceBlock('resolve'), { BASE: 'not-a-branch-name' });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('is the base branch');
    });

    it('refuses a pull request head that names the base branch', () => {
        const f = fixture('fork-pr-head');
        const r = runSequence(f.sb, f.me, { ...f.env, PR_HEAD_REF: 'main' });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('is the base branch');
    });

    it('stops when @{push} and the pull request head disagree', () => {
        const f = fixture('pushRemote');
        const r = runSequence(f.sb, f.me, { ...f.env, PR_HEAD_REPO: 'upstream/project', PR_HEAD_REF: 'feat' });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('but the pull request head is');
    });
});

describe('control — the lease form is what makes the difference', () => {
    it('a bare --force-with-lease after a fetch overwrites the collaborator push', () => {
        const f = fixture('upstream');
        collaboratorPushesDuringRebase(f.sb, f.me, f.collab, f.publishUrl, 'feat');
        const qualified = 'git push --force-with-lease="refs/heads/$RB:$EXPECTED" "$REMOTE" "HEAD:refs/heads/$RB"';
        const publish = sequenceBlock('publish');
        expect(publish).toContain(qualified);
        const bare = publish.replace(qualified, 'git fetch -q "$REMOTE" && git push --force-with-lease "$REMOTE" "HEAD:refs/heads/$RB"');
        const r = runSequence(f.sb, f.me, f.env, bare);
        expect(r.status).toBe(0);
        expect(published(f)).not.toBe(collabHead(f));
        expect(published(f)).toBe(f.sb.git(f.me, 'rev-parse', 'HEAD'));
    });
});

describe('stops before anything is rewritten', () => {
    it('refuses a topic range that carries a merge commit', () => {
        const f = fixture('upstream');
        // A branch that ran under `merge` before the switch carries one.
        f.sb.git(f.me, 'fetch', '-q', 'origin');
        f.sb.git(f.me, 'merge', '-q', '--no-edit', 'origin/main');
        f.sb.git(f.me, 'push', '-q', 'origin', 'feat');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('carries a merge commit');
        expect(r.stderr).toContain('DROP_BASE_MERGES=1');
        expect(r.stderr).toContain('--rebase-merges');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(published(f)).toBe(before);
    });

    it('drops the base-merge commits only when the user confirmed it this turn, keeping the recovery ref', () => {
        const f = fixture('upstream');
        f.sb.git(f.me, 'fetch', '-q', 'origin');
        f.sb.git(f.me, 'merge', '-q', '--no-edit', 'origin/main');
        f.sb.git(f.me, 'push', '-q', 'origin', 'feat');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runBlocks(f.sb, f.me, PREPARE_BLOCKS.map((b) => sequenceBlock(b)).join('\n'), { ...f.env, DROP_BASE_MERGES: '1' });
        expect(r.stderr).not.toContain('STOP');
        expect(r.status).toBe(0);
        expect(f.sb.git(f.me, 'rev-list', '--merges', 'origin/main..HEAD')).toBe('');
        expect(f.sb.git(f.me, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD')).toBe('');
        expect(f.sb.git(f.me, 'log', '--format=%s', 'origin/main..HEAD')).toBe('feat');
        const kept = f.sb.git(f.me, 'for-each-ref', '--format=%(objectname)', 'refs/agent-config/rewrites/');
        expect(kept).toBe(before);
    });

    it('still refuses a merge commit that is not a base merge, even with DROP_BASE_MERGES=1', () => {
        const f = fixture('upstream');
        f.sb.git(f.me, 'switch', '-q', '-c', 'side', 'feat');
        f.sb.commit(f.me, 'side.txt', 'side\n', 'side work');
        f.sb.git(f.me, 'switch', '-q', 'feat');
        f.sb.git(f.me, 'merge', '-q', '--no-ff', '--no-edit', 'side');
        f.sb.git(f.me, 'push', '-q', 'origin', 'feat');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, { ...f.env, DROP_BASE_MERGES: '1' });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('not a merge of the base');
        expect(r.stderr).toContain('--rebase-merges');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(published(f)).toBe(before);
    });

    it('refuses a topic range carrying a commit another author made, unless the user allowed it this turn', () => {
        const f = fixture('upstream');
        fs.writeFileSync(path.join(f.me, 'theirs.txt'), 'theirs\n');
        f.sb.git(f.me, 'add', 'theirs.txt');
        f.sb.git(f.me, 'commit', '-q', '--author', 'Other <other@example.com>', '-m', 'inherited');
        f.sb.git(f.me, 'push', '-q', 'origin', 'feat');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('commits you did not author');
        expect(r.stderr).toContain('other@example.com');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(published(f)).toBe(before);

        const allowed = runSequence(f.sb, f.me, { ...f.env, ALLOW_FOREIGN: '1' });
        expect(allowed.stderr).not.toContain('STOP');
        expect(allowed.status).toBe(0);
        expect(published(f)).toBe(f.sb.git(f.me, 'rev-parse', 'HEAD'));
    });

    it('refuses a branch other pull requests are built on, naming them', () => {
        const f = fixture('upstream');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, { ...f.env, DESCENDANTS: 'feat-child feat-grandchild' });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('feat-child feat-grandchild');
        expect(r.stderr).toContain('built on this branch');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(published(f)).toBe(before);
    });

    it('stops when the caller did not supply DESCENDANTS at all', () => {
        const f = fixture('upstream');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const { DESCENDANTS: _unset, ...env } = f.env;
        const r = runSequence(f.sb, f.me, env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('DESCENDANTS is required');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
    });

    it('refuses a dirty working tree', () => {
        const f = fixture('upstream');
        fs.writeFileSync(path.join(f.me, 'feat.txt'), 'edited, not committed\n');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('working tree is dirty');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
    });
});

describe('the inputs and the one shell session', () => {
    const rewrites = (f: Fixture): string =>
        f.sb.git(f.me, 'for-each-ref', '--format=%(refname)', 'refs/agent-config/rewrites/');

    it('stops before any rewrite when BASE is unset', () => {
        const f = fixture('upstream');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const { BASE: _unset, ...env } = f.env;
        const r = runSequence(f.sb, f.me, env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('STOP: BASE is required');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(rewrites(f)).toBe('');
        expect(published(f)).toBe(before);
    });

    it.each(['rebase', 'equivalence', 'publish'])('the %s block run in a fresh shell stops before acting', (name) => {
        const f = fixture('upstream');
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runBlocks(f.sb, f.me, sequenceBlock(name), f.env);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/STOP: run (steps 1–3|step 1) in (one|this) shell session/);
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(rewrites(f)).toBe('');
    });

    it('the merge-commit stop fails closed when the topic range cannot be listed', () => {
        const f = fixture('upstream');
        const bin = path.join(f.sb.root, 'bin');
        fs.mkdirSync(bin);
        const real = execFileSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
        fs.writeFileSync(path.join(bin, 'git'), [
            '#!/bin/sh',
            'if [ "$1" = rev-list ] && [ "$2" = --merges ]; then echo "fatal: bad revision" >&2; exit 128; fi',
            `exec '${real}' "$@"`,
            '',
        ].join('\n'));
        fs.chmodSync(path.join(bin, 'git'), 0o755);
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, { ...f.env, PATH: `${bin}:${process.env.PATH ?? ''}` });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('STOP: could not list the topic range');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(rewrites(f)).toBe('');
    });
});

describe('a failed fetch of the published ref', () => {
    it('stops naming the fetch, not a ref with commits this branch lacks', () => {
        const f = fixture('upstream');
        const bin = path.join(f.sb.root, 'bin');
        fs.mkdirSync(bin);
        const real = execFileSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
        fs.writeFileSync(path.join(bin, 'git'), [
            '#!/bin/sh',
            'case "$1 $4" in "fetch refs/heads/"*) echo "fatal: could not read from remote repository" >&2; exit 128;; esac',
            `exec '${real}' "$@"`,
            '',
        ].join('\n'));
        fs.chmodSync(path.join(bin, 'git'), 0o755);
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, { ...f.env, PATH: `${bin}:${process.env.PATH ?? ''}` });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('STOP: could not fetch origin/feat');
        expect(r.stderr).not.toContain('has commits this branch lacks');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
    });
});

describe('a failed read of the published ref', () => {
    it('stops instead of reading the failure as a branch that was never pushed', () => {
        const f = fixture('upstream');
        const bin = path.join(f.sb.root, 'bin');
        fs.mkdirSync(bin);
        const real = execFileSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
        fs.writeFileSync(path.join(bin, 'git'), [
            '#!/bin/sh',
            'case "$1 $3" in "ls-remote refs/heads/"*) echo "fatal: could not read from remote repository" >&2; exit 128;; esac',
            `exec '${real}' "$@"`,
            '',
        ].join('\n'));
        fs.chmodSync(path.join(bin, 'git'), 0o755);
        const before = f.sb.git(f.me, 'rev-parse', 'HEAD');
        const r = runSequence(f.sb, f.me, { ...f.env, PATH: `${bin}:${process.env.PATH ?? ''}` });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain('STOP: could not read origin/feat');
        expect(f.sb.git(f.me, 'rev-parse', 'HEAD')).toBe(before);
        expect(f.sb.git(f.me, 'for-each-ref', '--format=%(refname)', 'refs/agent-config/rewrites/')).toBe('');
    });
});

describe('the recovery ref', () => {
    const rewrites = (f: Fixture): string[] =>
        f.sb.git(f.me, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/agent-config/rewrites/').split('\n').filter(Boolean);

    it('is removed once the published ref reads back as HEAD', () => {
        const f = fixture('upstream');
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).toBe(0);
        expect(rewrites(f)).toEqual([]);
        expect(f.sb.git(f.me, 'tag', '-l')).toBe('');
    });

    it('is kept on a failure, with the one recovery command, and git push --tags does not publish it', () => {
        const f = fixture('upstream');
        const oldHead = f.sb.git(f.me, 'rev-parse', 'HEAD');
        collaboratorPushesDuringRebase(f.sb, f.me, f.collab, f.publishUrl, 'feat');
        const r = runSequence(f.sb, f.me, f.env);
        expect(r.status).not.toBe(0);
        const kept = rewrites(f);
        expect(kept).toHaveLength(1);
        const [ref, sha] = (kept[0] ?? '').split(' ');
        expect(ref).toMatch(/^refs\/agent-config\/rewrites\/[^/]+\/before$/);
        expect(sha).toBe(oldHead);
        expect(r.stderr).toContain(`git reset --keep ${ref}`);
        expect(f.sb.git(f.me, 'tag', '-l')).toBe('');

        f.sb.git(f.me, 'push', '-q', '--tags', 'origin');
        expect(f.sb.git(f.me, 'ls-remote', f.publishUrl)).not.toContain('refs/agent-config/');
    });
});
