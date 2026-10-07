/**
 * `.git-convention.yaml` is read by nothing; a team that named its carrier so
 * saw the warning from `show` only, while `subject` and `sync` silently applied
 * the defaults the file was written to replace.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runGitConvention } from '../../../src/scripts/_cli/cmd_git_convention.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;
beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-yaml-home-'));
    made.push(home);
    process.env.EVENT4U_CONFIG_HOME = home;
});
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
    else process.env.EVENT4U_CONFIG_HOME = prevHome;
});

const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function repo(): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-yaml-')));
    made.push(root);
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', remote);
    const dir = path.join(root, 'work');
    git(root, 'init', '-q', '-b', 'main', dir);
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'seed');
    git(dir, 'remote', 'add', 'origin', remote);
    git(dir, 'push', '-q', '-u', 'origin', 'main');
    git(dir, 'switch', '-q', '-c', 'feature');
    fs.writeFileSync(path.join(dir, '.git-convention.yaml'), 'git:\n  commit_format: ticket-conventional\n');
    return dir;
}

describe('a carrier named .git-convention.yaml', () => {
    it('is named by show', () => {
        expect(runGitConvention(['show'], repo()).out.join('\n')).toContain('.git-convention.yaml is ignored');
    });

    it('is named by subject', () => {
        const r = runGitConvention(['subject'], repo(), 'feat: x\n');
        expect(r.out.join('\n')).toContain('.git-convention.yaml is ignored');
    });

    it('is named by sync', () => {
        const dir = repo();
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        try {
            runGitConvention(['sync', '--dry-run'], dir);
            expect(spy.mock.calls.map((c) => String(c[0])).join('')).toContain('.git-convention.yaml is ignored');
        } finally {
            spy.mockRestore();
        }
    });
});
