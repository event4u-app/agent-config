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

    it('still validates where a commit-msg hook is installed, and names the hook', () => {
        const dir = repo();
        fs.writeFileSync(path.join(dir, '.git', 'hooks', 'commit-msg'), '#!/bin/sh\n', { mode: 0o755 });
        const r = subject(dir, 'anything at all\n');
        expect(r.code).toBe(1);
        expect(r.out.join('\n')).toContain('commit-msg hook');
    });

    it('validates against the convention in force beside a commitlint config, and notes it may be stricter', () => {
        const dir = repo({ 'commitlint.config.js': "module.exports = { extends: ['@commitlint/config-conventional'] };\n" });
        const ok = subject(dir, 'feat: x\n');
        expect(ok.code).toBe(0);
        expect(ok.out.join('\n')).toContain(`note: the commitlint config at ${path.join(dir, 'commitlint.config.js')} also runs at commit time and may be stricter`);
        const bad = subject(dir, 'wip\n');
        expect(bad.code).toBe(1);
        expect(bad.out.join('\n')).toContain('may be stricter');
    });

    it('a committed ticket-conventional beside a conventional commitlint config is validated as declared, never second-guessed', () => {
        const dir = repo({
            '.commitlintrc.json': '{ "extends": ["@commitlint/config-conventional"] }\n',
            '.git-convention.yml': 'git:\n  commit_format: ticket-conventional\n',
        });
        const r = subject(dir, 'DEV-1 feat: x\n', '--json');
        expect(r.code).toBe(0);
        const j = JSON.parse(r.out.join('\n')) as { rule: string; tier: string; notes: string[] };
        expect(j.rule).toContain('ticket-conventional');
        expect(j.tier).toContain('declared in');
        expect(j.notes).toEqual([`note: the commitlint config at ${path.join(dir, '.commitlintrc.json')} also runs at commit time and may be stricter`]);
    });

    it('names both a commit-msg hook and a commitlint config, and the exit stays the convention verdict', () => {
        const dir = repo({
            'package.json': JSON.stringify({ name: 'x', commitlint: { extends: ['@commitlint/config-conventional'] } }),
            '.git-convention.yml': 'git:\n  commit_format: ticket-conventional\n',
        });
        fs.writeFileSync(path.join(dir, '.git', 'hooks', 'commit-msg'), '#!/bin/sh\nnpx commitlint --edit "$1"\n', { mode: 0o755 });
        const r = subject(dir, 'DEV-1 feat: x\n', '--json');
        expect(r.code).toBe(0);
        const notes = (JSON.parse(r.out.join('\n')) as { notes: string[] }).notes;
        expect(notes).toHaveLength(2);
        expect(notes[0]).toContain('commit-msg hook');
        expect(notes[1]).toContain(`commitlint config at ${path.join(dir, 'package.json')}`);
    });

    it('exits 1, never 3, on an approved family it has no grammar for', () => {
        const dir = repo({ 'agents/memory/curated/conventions/approved/commit-subject.md': '---\ndominant_family: no-such-family\n---\n' });
        const r = subject(dir, 'feat: x\n');
        expect(r.code).toBe(1);
        expect(r.out.join('\n')).toContain('no grammar');
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

describe('git:convention subject --json', () => {
    const parsed = (r: { code: number; out: string[] }): { ok: boolean; code: number; lines: string[] } =>
        JSON.parse(r.out.join('\n')) as { ok: boolean; code: number; lines: string[] };

    it.each([
        ['a commitlint config (exit 0, with a note)', () => subject(repo({ '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n' }), 'feat: x\n', '--json'), 0],
        ['an unknown format (exit 1)', () => subject(repo(), 'feat: x\n', '--json', '--format', 'nope'), 1],
        ['an unknown family (exit 1)', () => subject(repo(), 'feat: x\n', '--json', '--family', 'nope'), 1],
        ['an unreadable format (exit 1)', () => subject(repo({}, 'git:\n  commit_format: nonsense\n'), 'feat: x\n', '--json'), 1],
        ['an empty stdin (exit 2)', () => subject(repo(), '', '--json'), 2],
        ['a valid subject (exit 0)', () => subject(repo(), 'feat: x\n', '--json'), 0],
        ['an invalid subject (exit 1)', () => subject(repo(), 'wip\n', '--json'), 1],
    ] as const)('prints JSON with ok, code and lines on %s', (_name, run, code) => {
        const r = run();
        expect(r.code).toBe(code);
        const j = parsed(r);
        expect(j).toMatchObject({ ok: code === 0, code });
        expect(Array.isArray(j.lines)).toBe(true);
        if (code !== 0) expect(j.lines.length).toBeGreaterThan(0);
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
