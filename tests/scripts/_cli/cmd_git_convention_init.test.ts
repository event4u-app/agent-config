/**
 * `git:convention init` — the one way an agent creates `.git-convention.yml`
 * (owner decision 2026-10-07): after the user's explicit yes, once, never over
 * an existing file, never `update_strategy`, and never committed by the verb.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runGitConvention } from '../../../src/scripts/_cli/cmd_git_convention.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;
beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-init-home-'));
    made.push(home);
    process.env.EVENT4U_CONFIG_HOME = home;
});
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
    else process.env.EVENT4U_CONFIG_HOME = prevHome;
});

const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A repository whose history measures as `conventional`, with eleven `{type}/{slug}` branches. */
function repo(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-init-')));
    made.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    for (let i = 0; i < 40; i++) git(dir, '-c', `user.name=dev${i % 3}`, '-c', `user.email=dev${i % 3}@example.com`, 'commit', '-q', '--allow-empty', '-m', `feat: change ${i}`);
    const sha = git(dir, 'rev-parse', 'HEAD').trim();
    git(dir, 'update-ref', 'refs/remotes/origin/main', sha);
    git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
    for (let i = 0; i < 11; i++) git(dir, 'update-ref', `refs/remotes/origin/feat/thing-${i}`, sha);
    return dir;
}

const carrier = (dir: string): string => path.join(dir, '.git-convention.yml');

describe('git:convention init', () => {
    it('creates the carrier with exactly the given keys and says it is not committed', () => {
        const dir = repo();
        const r = runGitConvention(['init', '--yes', '--commit-format', 'ticket-conventional', '--branch-pattern', '{type}/{ticket}-{slug}'], dir);
        expect(r.code).toBe(0);
        const data = parseYaml(fs.readFileSync(carrier(dir), 'utf8')) as { git: Record<string, string> };
        expect(data).toEqual({ git: { commit_format: 'ticket-conventional', branch_pattern: '{type}/{ticket}-{slug}' } });
        const text = r.out.join('\n');
        expect(text).toContain('commit_format: ticket-conventional');
        expect(text).toMatch(/NOT committed/);
        expect(git(dir, 'status', '--porcelain')).toContain('?? .git-convention.yml');
    });

    it('defaults to what measure proposes', () => {
        const dir = repo();
        const r = runGitConvention(['init', '--yes'], dir);
        expect(r.code).toBe(0);
        const data = parseYaml(fs.readFileSync(carrier(dir), 'utf8')) as { git: Record<string, string> };
        expect(data).toEqual({ git: { commit_format: 'ticket-scope', branch_pattern: '{type}/{slug}' } });
    });

    it.each(['.git-convention.yml', '.git-convention.yaml'])('refuses and changes nothing when %s exists', (name) => {
        const dir = repo();
        fs.writeFileSync(path.join(dir, name), 'git:\n  commit_format: ticket-scope\n');
        const r = runGitConvention(['init', '--yes', '--commit-format', 'ticket-conventional'], dir);
        expect(r.code).toBe(1);
        expect(fs.readFileSync(path.join(dir, name), 'utf8')).toBe('git:\n  commit_format: ticket-scope\n');
        if (name !== '.git-convention.yml') expect(fs.existsSync(carrier(dir))).toBe(false);
    });

    it('refuses without --yes and writes nothing', () => {
        const dir = repo();
        const r = runGitConvention(['init', '--commit-format', 'ticket-scope'], dir);
        expect(r.code).toBe(1);
        expect(r.err.join('\n')).toContain('--yes');
        expect(fs.existsSync(carrier(dir))).toBe(false);
    });

    it('refuses an invalid pattern and writes nothing', () => {
        const dir = repo();
        const r = runGitConvention(['init', '--yes', '--branch-pattern', '{type}/no slug'], dir);
        expect(r.code).toBe(1);
        expect(fs.existsSync(carrier(dir))).toBe(false);
    });

    it('never writes update_strategy, and has no flag for it', () => {
        const dir = repo();
        expect(runGitConvention(['init', '--yes', '--update-strategy', 'rebase'], dir).code).toBe(2);
        expect(fs.existsSync(carrier(dir))).toBe(false);
        runGitConvention(['init', '--yes'], dir);
        expect(fs.readFileSync(carrier(dir), 'utf8')).not.toContain('update_strategy');
    });
});
