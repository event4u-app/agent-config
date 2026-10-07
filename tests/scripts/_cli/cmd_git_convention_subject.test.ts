import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runGitConvention, SUBCOMMANDS } from '../../../src/scripts/_cli/cmd_git_convention.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;

beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-subject-home-'));
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

/** A checkout whose HEAD commits `files`; `.agent-settings.yml` stays untracked like a developer file. */
function repo(files: Record<string, string> = {}, settings: string | null = null): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-subject-')));
    made.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
        git(dir, 'add', rel);
    }
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'seed');
    if (settings !== null) fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settings);
    return dir;
}

const subject = (dir: string, input: string, ...args: string[]) => runGitConvention(['subject', ...args], dir, input);

describe('git:convention subject', () => {
    it('validates against the default grammar and exits 0 when every subject passes', () => {
        const r = subject(repo(), 'feat(DEV-1): add x\nfix: y\n');
        expect(r.code).toBe(0);
        expect(r.out.join('\n')).toContain('2 subject(s) valid');
    });

    it('exits 1 listing each failure with the rule it broke', () => {
        const r = subject(repo(), 'feat: ok\nAdd thing\nwip\n');
        expect(r.code).toBe(1);
        const text = r.out.join('\n');
        expect(text).toContain('Add thing');
        expect(text).toContain('wip');
        expect(text).toContain('git.commit_format: ticket-scope');
    });

    it('rejects a ticket inside a compound scope under a committed ticket-conventional declaration', () => {
        const dir = repo({ '.git-convention.yml': 'git:\n  commit_format: ticket-conventional\n' });
        const ok = subject(dir, 'DEV-1 feat(api): add x\n');
        expect(ok.code).toBe(0);
        const bad = subject(dir, 'DEV-1 feat(api,DEV-1): add x\n');
        expect(bad.code).toBe(1);
        expect(bad.out.join('\n')).toContain('inside the scope');
    });

    it('validates an approved measured family from the convention card', () => {
        const dir = repo({
            'agents/memory/curated/conventions/approved/commit-subject.md': '---\ndominant_family: ticket-prefix\n---\n',
        });
        expect(subject(dir, '[DEV-1] Fix thing\n').code).toBe(0);
        const r = subject(dir, 'feat: thing\n');
        expect(r.code).toBe(1);
        expect(r.out.join('\n')).toContain('approved family ticket-prefix');
    });

    it('a developer-file value outranks an approved card only when it is not the template default', () => {
        // settings:sync writes the template default into every project file, so a
        // default value there is indistinguishable from an insert and never a choice.
        const card = { 'agents/memory/curated/conventions/approved/commit-subject.md': '---\ndominant_family: ticket-prefix\n---\n' };
        const asDefault = subject(repo(card, 'git:\n  commit_format: ticket-scope\n'), '[DEV-1] Fix thing\n', '--json');
        expect(JSON.parse(asDefault.out.join('\n')).tier).toContain('approved in');
        const chosen = subject(repo(card, 'git:\n  commit_format: ticket-conventional\n'), 'DEV-1 feat(api): add x\n', '--json');
        expect(JSON.parse(chosen.out.join('\n')).tier).toContain('declared in');
        const committed = subject(repo({ ...card, '.git-convention.yml': 'git:\n  commit_format: ticket-scope\n' }), 'feat: x\n', '--json');
        expect(JSON.parse(committed.out.join('\n')).tier).toContain('declared in');
    });

    it('validates nothing where a commit-msg hook is installed', () => {
        const dir = repo();
        fs.writeFileSync(path.join(dir, '.git', 'hooks', 'commit-msg'), '#!/bin/sh\n', { mode: 0o755 });
        const r = subject(dir, 'anything at all\n');
        expect(r.code).toBe(0);
        expect(r.out.join('\n')).toContain('commit-msg hook');
    });

    it('prints the one command that runs a commitlint config that has no hook', () => {
        const dir = repo({ 'commitlint.config.js': "module.exports = { extends: ['@commitlint/config-conventional'] };\n" });
        const r = subject(dir, 'feat: x\n');
        expect(r.code).toBe(3);
        expect(r.out.join('\n')).toMatch(/commitlint/);
        expect(r.out.filter((l) => l.startsWith('run: '))).toHaveLength(1);
    });

    it('prints both and adopts neither when the validator and the committed declaration disagree', () => {
        const dir = repo({
            'commitlint.config.js': "module.exports = { extends: ['@commitlint/config-conventional'] };\n",
            '.git-convention.yml': 'git:\n  commit_format: ticket-conventional\n',
        });
        const r = subject(dir, 'DEV-1 feat: x\n');
        expect(r.code).toBe(3);
        const text = r.out.join('\n');
        expect(text).toContain('commitlint.config.js');
        expect(text).toContain('ticket-conventional');
        expect(text).toContain('adopts neither');
    });

    it('exits 1 on a commit format it cannot read', () => {
        const r = subject(repo({}, 'git:\n  commit_format: nonsense\n'), 'feat: x\n');
        expect(r.code).toBe(1);
        expect(r.out.concat(r.err).join('\n')).toContain('git-convention-invalid');
    });

    it('refuses an empty stdin as a usage error', () => {
        expect(subject(repo(), '').code).toBe(2);
    });
});

describe('git:convention ticket', () => {
    it('prints the first ticket and every candidate', () => {
        const r = runGitConvention(['ticket', 'feat/DEV-12-OPS-7-x'], repo());
        expect(r.code).toBe(0);
        expect(r.out[0]).toBe('ticket DEV-12');
        expect(r.out.join('\n')).toContain('OPS-7');
    });

    it('yields no ticket for a security branch', () => {
        const r = runGitConvention(['ticket', 'fix/CVE-2026-12345-patch', '--json'], repo());
        expect(JSON.parse(r.out.join('\n'))).toMatchObject({ ticket: null });
    });

    it('takes the keys the caller passes', () => {
        const r = runGitConvention(['ticket', 'feat/ABC-1-DEV-2-x', '--keys', 'DEV'], repo());
        expect(r.out[0]).toBe('ticket DEV-2');
        expect(r.out.join('\n')).toMatch(/ABC-1 +unknown-key/);
    });
});

describe('git:convention branch', () => {
    it('renders from type, ticket and slug through the pattern in force', () => {
        const dir = repo({}, 'git:\n  branch_pattern: "{ticket}-{slug}"\n');
        const r = runGitConvention(['branch', '--type', 'feat', '--ticket', 'DEV-1', '--slug', 'export'], dir);
        expect(r).toMatchObject({ code: 0, out: ['DEV-1-export'] });
    });

    it('prefixes the slug with a ticket the default pattern has no slot for', () => {
        const r = runGitConvention(['branch', '--type', 'feat', '--ticket', 'DEV-1', '--slug', 'export'], repo());
        expect(r.out).toEqual(['feat/DEV-1-export']);
    });

    it('exits 1 on a value it would have to rewrite', () => {
        expect(runGitConvention(['branch', '--type', 'feat', '--slug', 'two words'], repo()).code).toBe(1);
    });
});

describe('one verb', () => {
    it('hangs the subcommands off the existing table', () => {
        expect(Object.keys(SUBCOMMANDS)).toEqual(['show', 'subject', 'ticket', 'branch', 'sync']);
    });
});
