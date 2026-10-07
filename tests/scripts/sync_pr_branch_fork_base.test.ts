/**
 * A fork layout: `origin` is the contributor's fork, `upstream` the project the
 * pull request targets. `--base upstream/main` names a branch on a configured
 * remote and must be fetched, counted, read and merged there.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../src/scripts/sync_pr_branch.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
    else process.env.EVENT4U_CONFIG_HOME = prevHome;
});

const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

const commitFile = (cwd: string, file: string, content: string): void => {
    fs.writeFileSync(path.join(cwd, file), content);
    git(cwd, 'add', file);
    git(cwd, 'commit', '-q', '-m', file);
};

function forkLayout(): { work: string; upstreamHead: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-fork-'));
    made.push(root);
    process.env.EVENT4U_CONFIG_HOME = path.join(root, 'home');
    const upstream = path.join(root, 'upstream.git');
    const fork = path.join(root, 'fork.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', upstream);
    git(root, 'init', '-q', '--bare', '-b', 'main', fork);
    const seed = path.join(root, 'seed');
    git(root, 'clone', '-q', upstream, seed);
    commitFile(seed, 'a.txt', 'a\n');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    git(seed, 'push', '-q', fork, 'HEAD:main');
    const work = path.join(root, 'work');
    git(root, 'clone', '-q', fork, work);
    git(work, 'remote', 'add', 'upstream', upstream);
    git(work, 'fetch', '-q', 'upstream');
    git(work, 'switch', '-q', '-c', 'feature');
    commitFile(work, 'f.txt', 'f\n');
    git(work, 'push', '-q', 'origin', 'feature');
    commitFile(seed, 'u.txt', 'upstream moved\n');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    return { work, upstreamHead: git(seed, 'rev-parse', 'HEAD') };
}

const run = (...args: string[]): { code: number; out: string } => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = main(args);
        return { code, out: spy.mock.calls.map((c) => String(c[0])).join('') };
    } finally {
        spy.mockRestore();
    }
};

describe('--base <remote>/<branch> for a configured remote', () => {
    it('merges the upstream branch end to end', () => {
        const { work, upstreamHead } = forkLayout();
        const r = run('--repo', work, '--base', 'upstream/main');
        expect(r.out).not.toContain('cannot');
        expect(r.code).toBe(0);
        expect(git(work, 'merge-base', '--is-ancestor', upstreamHead, 'HEAD')).toBe('');
    });

    it('reports the upstream branch behind in a dry run', () => {
        const { work } = forkLayout();
        const r = run('--repo', work, '--base', 'upstream/main', '--dry-run');
        expect(r.code).toBe(0);
        expect(r.out).toContain('upstream/main (1 behind)');
    });
});
