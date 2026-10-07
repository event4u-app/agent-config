import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { commitMessageValidator, runGitConvention, SUBCOMMANDS } from '../../../src/scripts/_cli/cmd_git_convention.js';
import { runSettingsGet, PACKAGE_ROOT } from '../../../src/scripts/_cli/cmd_settings_get.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;

beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-home-'));
    made.push(home);
    process.env.EVENT4U_CONFIG_HOME = home;
});

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
    });

/** A checkout with an `origin`, so `update_strategy` has a target commit to be read at. */
function repo(settings: string | null): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-cli-')));
    made.push(root);
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', remote);
    const dir = path.join(root, 'work');
    git(root, 'init', '-q', '-b', 'main', dir);
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'seed');
    git(dir, 'remote', 'add', 'origin', remote);
    git(dir, 'push', '-q', '-u', 'origin', 'main');
    if (settings !== null) fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settings);
    return dir;
}

describe('git:convention show', () => {
    it('prints the three keys with value, source and state', () => {
        const dir = repo('git:\n  update_strategy: rebase\n');
        const r = runGitConvention(['show'], dir);
        expect(r.code).toBe(0);
        const text = r.out.join('\n');
        expect(text).toContain('git.update_strategy = rebase');
        expect(text).toContain(path.join(dir, '.agent-settings.yml'));
        expect(text).toMatch(/git\.commit_format = ticket-scope[\s\S]*state +absent/);
        expect(text).toContain('git.branch_pattern = {type}/{slug}');
    });

    it('emits JSON with one entry per key', () => {
        const dir = repo('git:\n  commit_format: ticket-scope\n');
        const r = runGitConvention(['show', '--json'], dir);
        expect(r.code).toBe(0);
        const parsed = JSON.parse(r.out.join('\n')) as {
            ok: boolean;
            keys: Record<string, { value: string | null; state: string; source: string | null }>;
            commit_message_validator: unknown;
        };
        expect(parsed.ok).toBe(true);
        expect(Object.keys(parsed.keys)).toEqual(['commit_format', 'branch_pattern', 'update_strategy']);
        expect(parsed.keys.commit_format).toMatchObject({ value: 'ticket-scope', state: 'valid' });
        expect(parsed.commit_message_validator).toBeNull();
    });

    it('exits non-zero on a malformed file and never prints merge for it', () => {
        const dir = repo('git:\n  update_strategy: rebase\nx: [\n');
        const r = runGitConvention(['show'], dir);
        expect(r.code).toBe(1);
        const text = r.out.join('\n');
        expect(text).toContain('git-convention-malformed');
        expect(text).not.toContain('git.update_strategy = merge');
    });

    it('exits non-zero on an invalid value, in JSON too', () => {
        const dir = repo('git:\n  update_strategy: rebsae\n');
        expect(runGitConvention(['show'], dir).code).toBe(1);
        const r = runGitConvention(['show', '--json'], dir);
        expect(r.code).toBe(1);
        expect(JSON.parse(r.out.join('\n')).keys.update_strategy.state).toBe('invalid');
    });

    it('names a commit-message validator that outranks git.commit_format', () => {
        const dir = repo(null);
        fs.writeFileSync(path.join(dir, 'commitlint.config.js'), 'module.exports = {};\n');
        expect(commitMessageValidator(dir)).toMatchObject({ path: path.join(dir, 'commitlint.config.js') });
        expect(runGitConvention(['show'], dir).out.join('\n')).toContain('outranks git.commit_format');
    });

    it('sees an executable commit-msg hook and ignores the shipped sample', () => {
        const dir = repo(null);
        const hooks = path.join(dir, '.git', 'hooks');
        fs.writeFileSync(path.join(hooks, 'commit-msg.sample'), '#!/bin/sh\n', { mode: 0o755 });
        expect(commitMessageValidator(dir)).toBeNull();
        fs.writeFileSync(path.join(hooks, 'commit-msg'), '#!/bin/sh\n', { mode: 0o755 });
        expect(commitMessageValidator(dir)).toMatchObject({ kind: 'commit-msg hook' });
    });

    it('counts .husky/commit-msg only when core.hooksPath points git at .husky', () => {
        const dir = repo(null);
        fs.mkdirSync(path.join(dir, '.husky'));
        fs.writeFileSync(path.join(dir, '.husky', 'commit-msg'), '#!/bin/sh\n', { mode: 0o755 });
        expect(commitMessageValidator(dir)).toBeNull();
        git(dir, 'config', 'core.hooksPath', '.husky');
        expect(commitMessageValidator(dir)).toMatchObject({ kind: 'commit-msg hook', path: path.join(dir, '.husky', 'commit-msg') });
    });

    it('routes subcommands through one table and refuses an unknown one', () => {
        expect(Object.keys(SUBCOMMANDS)).toContain('show');
        const dir = repo(null);
        expect(runGitConvention(['nope'], dir).code).toBe(2);
        expect(runGitConvention([], dir).code).toBe(2);
    });
});

describe('settings:get beside it', () => {
    it('keeps exit 0 and gains one warning line when a layer does not parse', () => {
        const dir = repo('git:\n  update_strategy: rebase\nx: [\n');
        const r = runSettingsGet({ key: 'git.update_strategy', cwd: dir, packageRoot: PACKAGE_ROOT, json: false });
        expect(r.code).toBe(0);
        const warnings = r.err.filter((l) => l.includes('does not parse'));
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain(path.join(dir, '.agent-settings.yml'));
    });

    it('prints no warning when every layer parses', () => {
        const dir = repo('git:\n  update_strategy: rebase\n');
        const r = runSettingsGet({ key: 'git.update_strategy', cwd: dir, packageRoot: PACKAGE_ROOT, json: false });
        expect(r.err.filter((l) => l.includes('does not parse'))).toHaveLength(0);
    });
});

describe('git:convention subject beside a commit-msg hook', () => {
    function withHook(): string {
        const dir = repo(null);
        // A hook that validates nothing, as a Change-Id or trailer hook does.
        fs.writeFileSync(path.join(dir, '.git', 'hooks', 'commit-msg'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        return dir;
    }

    it('still validates against the convention and fails a bad subject', () => {
        const r = runGitConvention(['subject'], withHook(), 'not a conventional subject\n');
        expect(r.code).toBe(1);
    });

    it('passes a valid subject and notes that the hook also runs at commit', () => {
        const dir = withHook();
        const r = runGitConvention(['subject'], dir, 'feat: add a thing\n');
        expect(r.code, r.out.join('\n')).toBe(0);
        expect(r.out.join('\n')).toContain(`the commit-msg hook at ${path.join(dir, '.git', 'hooks', 'commit-msg')} also runs at commit`);
    });
});
