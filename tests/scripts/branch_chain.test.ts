import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { chainOf, recordParent } from '../../src/scripts/_lib/branch_parents.js';
import { chainStatus, chainSync, renderStatus } from '../../src/scripts/branch_chain.js';

const roots: string[] = [];
afterEach(() => {
    for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

const ME = 'me@x.invalid';
const OTHER = 'other@x.invalid';

/** main → p → c, every level recorded; `pAuthor` writes p's commit; main then moves on. */
function chain(opts: { pAuthor: string; conflict?: boolean }): { root: string; git: (...a: string[]) => string; as: (email: string, ...a: string[]) => string } {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'chain-')));
    roots.push(root);
    const run = (email: string, args: string[]): string =>
        execFileSync('git', args, { cwd: root, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: email, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: email, GIT_COMMITTER_EMAIL: email } });
    const git = (...a: string[]): string => run(ME, a);
    const as = (email: string, ...a: string[]): string => run(email, a);
    const w = (rel: string, body: string): void => fs.writeFileSync(path.join(root, rel), body);
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', ME);
    git('config', 'user.name', 'me');
    w('shared.txt', 'one\n');
    w('base.txt', 'base\n');
    git('add', '.');
    git('commit', '-qm', 'init');
    git('checkout', '-qb', 'p');
    w('p.txt', 'p\n');
    if (opts.conflict) w('shared.txt', 'p changed it\n');
    git('add', '.');
    as(opts.pAuthor, 'commit', '-qm', 'p work');
    git('checkout', '-qb', 'c');
    w('c.txt', 'c\n');
    git('add', '.');
    git('commit', '-qm', 'c work');
    git('checkout', '-q', 'main');
    w('shared.txt', 'main changed it\n');
    w('main.txt', 'main\n');
    git('add', '.');
    git('commit', '-qm', 'main moves on');
    git('checkout', '-q', 'c');
    recordParent(root, 'p', 'main');
    recordParent(root, 'c', 'p');
    return { root, git, as };
}

describe('lineage', () => {
    it('walks recorded parents up to the default branch, root first', () => {
        const { root } = chain({ pAuthor: ME });
        expect(chainOf(root, 'c').map((l) => `${l.branch}<${l.parent ?? '-'}:${l.source}`)).toEqual(['main<-:root', 'p<main:recorded', 'c<p:recorded']);
    });

    it('says unknown, with the command, when nothing records a parent', () => {
        const { root, git } = chain({ pAuthor: ME });
        git('config', '--unset', 'branch.c.agentConfigParent');
        expect(renderStatus(chainStatus(root, 'c'))[0]).toMatch(/c — parent unknown — record it: branch_chain parent --set <parent> --branch c/);
    });
});

describe('status, read-only', () => {
    it('names the lagging level and the paths both sides changed', () => {
        const { root, git } = chain({ pAuthor: ME });
        git('checkout', '-q', 'p');
        fs.writeFileSync(path.join(root, 'shared.txt'), 'p too\n');
        git('commit', '-qam', 'p touches shared');
        git('checkout', '-q', 'c');
        const before = git('rev-parse', 'HEAD');
        const s = chainStatus(root, 'c');
        expect(s.map((l) => [l.branch, l.behind])).toEqual([['main', null], ['p', 1], ['c', 1]]);
        expect(s[1]?.overlap).toEqual(['shared.txt']);
        expect(git('rev-parse', 'HEAD')).toBe(before);
    });
});

describe('sync, top-down', () => {
    it('an owned parent is brought current first, then the child; nothing is pushed', () => {
        const { root, git } = chain({ pAuthor: ME });
        const steps = chainSync(root, 'c', { offline: true });
        expect(steps.map((s) => `${s.branch}:${s.action}`)).toEqual(['main:skipped', 'p:merged', 'c:merged']);
        expect(git('merge-base', '--is-ancestor', 'main', 'p')).toBe('');
        expect(git('merge-base', '--is-ancestor', 'p', 'c')).toBe('');
        expect(git('rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('c');
        expect(git('worktree', 'list').trim().split('\n')).toHaveLength(1);
        expect(git('remote').trim()).toBe('');
    });

    it('a parent that is not ours is reported, and main is never merged straight into the child', () => {
        const { root, git } = chain({ pAuthor: OTHER });
        const pBefore = git('rev-parse', 'p');
        const cBefore = git('rev-parse', 'c');
        const steps = chainSync(root, 'c', { offline: true });
        expect(steps.map((s) => `${s.branch}:${s.action}`)).toEqual(['main:skipped', 'p:reported', 'c:reported']);
        expect(steps[1]?.detail).toMatch(/not ours/);
        expect(steps[2]?.detail).toMatch(/waits for p/);
        expect(git('rev-parse', 'p')).toBe(pBefore);
        expect(git('rev-parse', 'c')).toBe(cBefore);
    });

    it('a conflict is aborted and named; nothing changes', () => {
        const { root, git } = chain({ pAuthor: ME, conflict: true });
        const pBefore = git('rev-parse', 'p');
        const steps = chainSync(root, 'c', { offline: true });
        expect(steps[1]).toMatchObject({ branch: 'p', action: 'conflict' });
        expect(steps[1]?.detail).toMatch(/shared\.txt — aborted, nothing changed/);
        expect(steps[2]?.action).toBe('reported');
        expect(git('rev-parse', 'p')).toBe(pBefore);
        expect(git('worktree', 'list').trim().split('\n')).toHaveLength(1);
    });
});

describe('the chain beside the map', () => {
    it('a refresh writes the offline chain status next to the graph', () => {
        const { root } = chain({ pAuthor: ME });
        const out = path.join(root, '.cache', 'g.json');
        execFileSync(path.resolve('node_modules/.bin/tsx'), [path.resolve('src/scripts/code_graph/cli.ts'), 'refresh', '--root', root, '--out', out], { stdio: 'ignore' });
        const status = JSON.parse(fs.readFileSync(path.join(root, '.cache', 'branch-chain.json'), 'utf-8')) as { branch: string; levels: Array<{ branch: string; behind: number | null }> };
        expect(status.branch).toBe('c');
        expect(status.levels.map((l) => [l.branch, l.behind])).toEqual([['main', null], ['p', 1], ['c', 0]]);
    }, 120_000);
});
