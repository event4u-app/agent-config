/**
 * The behind remedy is chosen from what is already local — never by a fetch.
 *
 * Choosing the remedy text read `git.update_strategy` at the remote commit the
 * gate had just measured; that commit is new by definition on a behind branch,
 * so the read fetched it, for up to 60 s, inside a pre-push gate budgeted at
 * 25 s — for advice text. It now reads the measured commit only if it is
 * already present, else the cached remote-tracking commit, else prints the
 * generic branch-update pointer.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { behindRemedy, main, type ForgeAnswer } from '../../src/scripts/check_branch_freshness.js';

const noPr = (): ForgeAnswer => ({ kind: 'none' });

let dir: string;
let cwd: string;

function git(args: string[], at: string): string {
    return execFileSync('git', args, { cwd: at, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function commit(at: string, file: string, body: string): void {
    fs.writeFileSync(path.join(at, file), body);
    git(['add', '-A'], at);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', `add ${file}`], at);
}

function hasObject(sha: string, at: string): boolean {
    try {
        git(['cat-file', '-e', `${sha}^{commit}`], at);
        return true;
    } catch {
        return false;
    }
}

beforeEach(() => {
    cwd = process.cwd();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshness-local-remedy-'));
    const origin = path.join(dir, 'origin.git');
    const work = path.join(dir, 'work');
    git(['init', '-q', '--bare', '-b', 'main', origin], dir);
    git(['init', '-q', '-b', 'main', work], dir);
    git(['remote', 'add', 'origin', origin], work);
    commit(work, 'a.txt', 'one');
    git(['push', '-q', '-u', 'origin', 'main'], work);
    git(['checkout', '-q', '-b', 'feat/x'], work);
    commit(work, 'b.txt', 'two');
    process.chdir(work);
    delete process.env['CI'];
    delete process.env['GITHUB_ACTIONS'];
});

afterEach(() => {
    process.chdir(cwd);
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('the behind remedy never fetches', () => {
    it('leaves the unfetched remote commit unfetched and prints the generic pointer', () => {
        const other = path.join(dir, 'other');
        git(['clone', '-q', path.join(dir, 'origin.git'), other], dir);
        fs.writeFileSync(path.join(other, '.git-convention.yml'), 'git:\n  update_strategy: merge\n');
        commit(other, 'c.txt', 'three');
        git(['push', '-q'], other);
        const remote = git(['rev-parse', 'HEAD'], other);
        // The cached tracking ref is gone too, so nothing local can answer.
        git(['update-ref', '-d', 'refs/remotes/origin/main'], process.cwd());
        expect(hasObject(remote, process.cwd())).toBe(false);

        const said: string[] = [];
        vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
            said.push(a.map(String).join(' '));
        });
        expect(main(['--quiet'], noPr)).toBe(1);

        expect(hasObject(remote, process.cwd())).toBe(false);
        const text = said.join('\n');
        expect(text).toContain('references/branch-update.md');
        expect(text).not.toContain('git merge');
    });

    it('reads the strategy at the cached remote-tracking commit when the measured one is not local', () => {
        const other = path.join(dir, 'other');
        git(['clone', '-q', path.join(dir, 'origin.git'), other], dir);
        fs.writeFileSync(path.join(other, '.git-convention.yml'), 'git:\n  update_strategy: rebase\n');
        commit(other, 'conv.txt', 'x');
        git(['push', '-q'], other);
        git(['fetch', '-q', 'origin'], process.cwd());
        commit(other, 'c.txt', 'three');
        git(['push', '-q'], other);
        const remote = git(['rev-parse', 'HEAD'], other);

        const said: string[] = [];
        vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
            said.push(a.map(String).join(' '));
        });
        expect(main(['--quiet'], noPr)).toBe(1);

        expect(hasObject(remote, process.cwd())).toBe(false);
        expect(said.join('\n')).toContain('git.update_strategy is `rebase`');
    });
});

describe('behindRemedy without a reading', () => {
    it('is the generic pointer, never a merge', () => {
        const text = behindRemedy('main', null).join('\n');
        expect(text).toContain('references/branch-update.md');
        expect(text).not.toContain('git merge');
    });
});

describe('the behind remedy prints only commands the checkout can run', () => {
    function behindOutput(carrier?: string): string {
        const other = path.join(dir, 'other');
        git(['clone', '-q', path.join(dir, 'origin.git'), other], dir);
        if (carrier !== undefined) commit(other, '.git-convention.yml', carrier);
        commit(other, 'c.txt', 'three');
        git(['push', '-q'], other);
        git(['fetch', '-q', 'origin'], process.cwd());
        const said: string[] = [];
        vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
            said.push(a.map(String).join(' '));
        });
        expect(main(['--quiet'], noPr)).toBe(1);
        return said.join('\n');
    }

    it('a consumer checkout without the push-ready task gets the merge command, not the task', () => {
        const text = behindOutput();
        expect(text).not.toContain('task push-ready');
        expect(text).toContain('git fetch origin && git merge origin/main');
    });

    it('a checkout whose taskfiles/dev.yml defines push-ready gets the task line', () => {
        fs.mkdirSync(path.join(process.cwd(), 'taskfiles'));
        fs.writeFileSync(path.join(process.cwd(), 'taskfiles', 'dev.yml'), "version: '3'\ntasks:\n  push-ready:\n    cmds: [echo]\n");
        const text = behindOutput();
        expect(text).toMatch(/^ *task push-ready BASE=main(?: |$)/m);
    });

    it('under a rebase strategy the push-ready line is not printed — it would only refuse', () => {
        fs.mkdirSync(path.join(process.cwd(), 'taskfiles'));
        fs.writeFileSync(path.join(process.cwd(), 'taskfiles', 'dev.yml'), "version: '3'\ntasks:\n  push-ready:\n    cmds: [echo]\n");
        const text = behindOutput('git:\n  update_strategy: rebase\n');
        expect(text).toContain('update_strategy is `rebase`');
        expect(text).not.toContain('task push-ready');
    });
});
