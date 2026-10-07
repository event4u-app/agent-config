/**
 * A commitlint config is the repository's own validator for subjects, so the
 * convention is established by it: `show` and `subject` do not ask for a
 * measurement, and `measure` says the config governs.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NO_CONVENTION, runGitConvention } from '../../../src/scripts/_cli/cmd_git_convention.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;

beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-commitlint-home-'));
    made.push(home);
    process.env.EVENT4U_CONFIG_HOME = home;
});

afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
    else process.env.EVENT4U_CONFIG_HOME = prevHome;
});

function repo(withConfig: boolean): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-commitlint-')));
    made.push(dir);
    const git = (...args: string[]): string => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    for (let i = 0; i < 5; i++) git('commit', '-q', '--allow-empty', '-m', `feat: change ${i}`);
    git('update-ref', 'refs/remotes/origin/main', git('rev-parse', 'HEAD').trim());
    git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
    if (withConfig) fs.writeFileSync(path.join(dir, '.commitlintrc.json'), '{ "extends": ["@commitlint/config-conventional"] }\n');
    return dir;
}

describe('a repository with a commitlint config', () => {
    it('show treats the convention as established by the validator', () => {
        const r = runGitConvention(['show', '--key', 'commit_format'], repo(true));
        expect(r.out.join('\n')).not.toContain(NO_CONVENTION);
        const json = JSON.parse(runGitConvention(['show', '--json', '--key', 'commit_format'], repo(true)).out.join('\n')) as { convention_established: boolean };
        expect(json.convention_established).toBe(true);
    });

    it('subject prints no measure prompt', () => {
        const r = runGitConvention(['subject'], repo(true), 'feat: x\n');
        expect(r.code).toBe(0);
        expect(r.out.join('\n')).not.toContain(NO_CONVENTION);
    });

    it('measure says the commitlint config governs', () => {
        const text = runGitConvention(['measure'], repo(true)).out.join('\n');
        expect(text).toMatch(/commitlint config at .*\.commitlintrc\.json governs/);
    });

    it('control: without one, show still asks for a measurement', () => {
        expect(runGitConvention(['show', '--key', 'commit_format'], repo(false)).out.join('\n')).toContain(NO_CONVENTION);
    });
});
