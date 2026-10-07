/**
 * Real repositories for the git-convention carrier tests: a bare remote, a seed
 * clone that advances `main`, and a working clone on a feature branch.
 *
 * Not a test file — the name carries no `.test` so the runner never collects it.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { vi } from 'vitest';

import { main as syncMain } from '../../src/scripts/sync_pr_branch.js';

export class TmpDirs {
    private readonly made: string[] = [];

    make(prefix = 'git-convention-carrier-'): string {
        const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
        this.made.push(dir);
        return dir;
    }

    cleanup(): void {
        for (const dir of this.made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    }
}

export const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

export function write(dir: string, rel: string, body: string): string {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    return p;
}

export interface Fixture {
    remote: string;
    seed: string;
    work: string;
}

/** A remote with one commit on `main`, and `work` cloned from it on `feature`. */
export function fixture(tmp: TmpDirs, seedFiles: Record<string, string> = {}): Fixture {
    const root = tmp.make();
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', remote);
    const seed = path.join(root, 'seed');
    git(root, 'clone', '-q', remote, seed);
    write(seed, 'a.txt', 'a\n');
    write(seed, '.gitignore', '.agent-settings.yml\nagents/settings/.agent-settings.local.yml\n');
    for (const [rel, body] of Object.entries(seedFiles)) write(seed, rel, body);
    git(seed, 'add', '-A');
    git(seed, 'commit', '-q', '-m', 'seed');
    git(seed, 'push', '-q', 'origin', 'HEAD:main');
    const work = path.join(root, 'work');
    git(root, 'clone', '-q', remote, work);
    git(work, 'switch', '-q', '-c', 'feature');
    return { remote, seed, work };
}

/** Advance `main` on the remote by one commit, optionally carrying files. */
export function advanceMain(f: Fixture, files: Record<string, string> = { 'b.txt': 'b\n' }): string {
    for (const [rel, body] of Object.entries(files)) write(f.seed, rel, body);
    git(f.seed, 'add', '-A');
    git(f.seed, 'commit', '-q', '-m', 'advance');
    git(f.seed, 'push', '-q', 'origin', 'HEAD:main');
    return git(f.seed, 'rev-parse', 'HEAD').trim();
}

export function commitIn(dir: string, rel: string, body: string): void {
    write(dir, rel, body);
    git(dir, 'add', '--', rel);
    git(dir, 'commit', '-q', '-m', `add ${rel}`);
}

export interface SyncRun {
    code: number;
    out: string;
    before: string;
    after: string;
    parents: number;
}

export function runSync(repo: string, base = 'origin/main'): SyncRun {
    const before = git(repo, 'rev-parse', 'HEAD').trim();
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    let code: number;
    let out: string;
    try {
        code = syncMain(['--repo', repo, '--base', base]);
        out = spy.mock.calls.map((c) => String(c[0])).join('');
    } finally {
        spy.mockRestore();
    }
    const after = git(repo, 'rev-parse', 'HEAD').trim();
    const parents = git(repo, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ').length - 1;
    return { code, out, before, after, parents };
}

/**
 * Point every user-global read at an empty directory for the duration of a test.
 *
 * That includes the developer's global git config: the code under test spawns
 * its own `git merge`, which the `-c` flags in `git()` above never reach. On a
 * runner whose hostname git cannot derive an email from, that merge fails for
 * want of an identity; on a laptop it inherits commit signing instead.
 */
export function isolateUserGlobal(tmp: TmpDirs): () => void {
    const home = tmp.make('git-convention-home-');
    const gitconfig = write(home, '.gitconfig', '[user]\n\tname = t\n\temail = t@example.com\n[commit]\n\tgpgsign = false\n');
    const saved = {
        EVENT4U_CONFIG_HOME: process.env['EVENT4U_CONFIG_HOME'],
        GIT_CONFIG_GLOBAL: process.env['GIT_CONFIG_GLOBAL'],
    };
    process.env['EVENT4U_CONFIG_HOME'] = home;
    process.env['GIT_CONFIG_GLOBAL'] = gitconfig;
    return () => {
        for (const [key, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    };
}
