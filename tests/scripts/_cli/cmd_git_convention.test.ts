import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { commitMessageValidator, commitMessageValidators, runGitConvention, showConvention, SUBCOMMANDS } from '../../../src/scripts/_cli/cmd_git_convention.js';
import { REFUSAL_STATES } from '../../../src/scripts/_lib/git_convention.js';
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

    it('names every commit-message validator as also running at commit, never as outranking the convention', () => {
        const dir = repo(null);
        fs.writeFileSync(path.join(dir, 'commitlint.config.js'), 'module.exports = {};\n');
        fs.writeFileSync(path.join(dir, '.git', 'hooks', 'commit-msg'), '#!/bin/sh\n', { mode: 0o755 });
        expect(commitMessageValidator(dir)).toMatchObject({ kind: 'commit-msg hook' });
        expect(commitMessageValidators(dir).map((v) => v.kind)).toEqual(['commit-msg hook', 'commitlint config']);
        const text = runGitConvention(['show'], dir).out.join('\n');
        expect(text).toContain(`commitlint config at ${path.join(dir, 'commitlint.config.js')} — also runs at commit time and may be stricter`);
        expect(text).toContain('commit-msg hook at');
        expect(text).not.toContain('outranks');
    });

    it.each(['.commitlintrc.mjs', '.commitlintrc.ts', '.commitlintrc.cts', '.commitlintrc.mts', 'commitlint.config.cts', 'commitlint.config.mts'])(
        'names %s, a config file commitlint itself loads',
        (name) => {
            const dir = repo(null);
            fs.writeFileSync(path.join(dir, name), 'export default {};\n');
            expect(commitMessageValidator(dir)).toMatchObject({ kind: 'commitlint config', path: path.join(dir, name) });
        },
    );

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

describe('git:convention show beside a carrier under the wrong name', () => {
    it('warns that .git-convention.yaml is ignored and names .git-convention.yml', () => {
        const dir = repo(null);
        fs.writeFileSync(path.join(dir, '.git-convention.yaml'), 'git:\n  update_strategy: rebase\n');
        const r = runGitConvention(['show'], dir);
        expect(r.code).toBe(0);
        const text = [...r.out, ...r.err].join('\n');
        expect(text).toContain('.git-convention.yaml is ignored');
        expect(text).toContain('rename it to .git-convention.yml');
        const json = JSON.parse(runGitConvention(['show', '--json'], dir).out.join('\n')) as { warnings?: string[] };
        expect(json.warnings?.join('\n')).toContain('.git-convention.yaml is ignored');
    });

    it('prints no such warning when only the correct file exists', () => {
        const dir = repo(null);
        fs.writeFileSync(path.join(dir, '.git-convention.yml'), 'git:\n  update_strategy: rebase\n');
        const r = runGitConvention(['show'], dir);
        expect([...r.out, ...r.err].join('\n')).not.toContain('is ignored');
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

describe('git:convention show --key', () => {
    it('judges only the requested keys, so a broken branch_pattern does not stop an update_strategy read', () => {
        const dir = repo('git:\n  update_strategy: rebase\n  branch_pattern: "{nope}"\n');
        expect(runGitConvention(['show'], dir).code).toBe(1);
        const r = runGitConvention(['show', '--key', 'update_strategy', '--base', 'origin/main'], dir);
        expect(r.code).toBe(0);
        const text = r.out.join('\n');
        expect(text).toContain('git.update_strategy = rebase');
        expect(text).not.toContain('git.branch_pattern');
        expect(runGitConvention(['show', '--key', 'branch_pattern'], dir).code).toBe(1);
    });

    it('is repeatable, and the JSON carries exactly the requested keys', () => {
        const dir = repo(null);
        const r = runGitConvention(['show', '--json', '--key', 'commit_format', '--key', 'update_strategy'], dir);
        expect(r.code).toBe(0);
        expect(Object.keys(JSON.parse(r.out.join('\n')).keys as object)).toEqual(['commit_format', 'update_strategy']);
    });

    it('refuses a key that is not one of the three', () => {
        const r = runGitConvention(['show', '--key', 'nope'], repo(null));
        expect(r.code).toBe(2);
        expect(r.err.join('\n')).toContain('unknown key: nope');
    });
});

describe('git:convention show exits non-zero on every state sync refuses', () => {
    it('on a value only the user-global file sets (discarded)', () => {
        const home = process.env.EVENT4U_CONFIG_HOME as string;
        fs.mkdirSync(path.join(home, 'settings'), { recursive: true });
        fs.writeFileSync(path.join(home, 'settings', '.agent-settings.yml'), 'git:\n  update_strategy: rebase\n');
        const dir = repo(null);
        const r = runGitConvention(['show', '--json'], dir);
        expect(JSON.parse(r.out.join('\n')).keys.update_strategy.state).toBe('discarded');
        expect(r.code).toBe(1);
    });

    it('on a target commit that cannot be resolved (unresolvable)', () => {
        const dir = repo(null);
        const deps = { defaultBranch: () => null, remoteSha: () => null };
        const r = showConvention(['--json'], dir, deps);
        expect(JSON.parse(r.out.join('\n')).keys.update_strategy.state).toBe('unresolvable');
        expect(r.code).toBe(1);
    });

    it('a candidate in a refusal state is a warning, exit 0, while the value in force is readable', () => {
        const dir = repo('git:\n  update_strategy: rebase\n');
        fs.writeFileSync(path.join(dir, '.git-convention.yml'), 'git:\n  update_strategy: merge\nx: [\n');
        const r = runGitConvention(['show'], dir);
        expect(r.code).toBe(0);
        const text = r.out.join('\n');
        expect(text).toContain('git.update_strategy = rebase');
        expect(text).toMatch(/candidate only, not in force: git-convention-malformed/);
        const j = runGitConvention(['show', '--json'], dir);
        expect(j.code).toBe(0);
        const parsed = JSON.parse(j.out.join('\n')) as { ok: boolean; keys: Record<string, { candidate: { state: string } | null }> };
        expect(parsed.ok).toBe(true);
        expect(parsed.keys.update_strategy?.candidate?.state).toBe('malformed');
    });

    it('the /pr:merge prose lists exactly the states the code refuses', () => {
        const text = fs.readFileSync(path.join(PACKAGE_ROOT, 'src', 'domains', 'git', 'pr', 'merge', 'command.md'), 'utf8');
        const sentence = /A `git\.update_strategy` whose state is ([^\n]+(?:\n[^\n]+)?) is\s+not a strategy/.exec(text)?.[1] ?? '';
        const listed = [...sentence.matchAll(/`([a-z]+)`/g)].map((m) => m[1]).sort();
        expect(listed).toEqual([...REFUSAL_STATES].sort());
    });

    it('the /pr:merge gate reads the strategy against the same target the sync acts on', () => {
        const text = fs.readFileSync(path.join(PACKAGE_ROOT, 'src', 'domains', 'git', 'pr', 'merge', 'command.md'), 'utf8');
        const block = /## 2\. Sync with the base[\s\S]*?```bash\n([\s\S]*?)```/.exec(text)?.[1] ?? '';
        const lines = block.split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter((l) => l !== '');
        const checkout = lines.indexOf('gh pr checkout <N>');
        const show = lines.indexOf('agent-config git:convention show --key update_strategy --base origin/<base>');
        expect(checkout).toBeGreaterThanOrEqual(0);
        expect(show).toBeGreaterThan(checkout);
        expect(lines).toContain('agent-config git:convention sync --base origin/<base>');
    });
});

describe('the documented `show` exit-1 set', () => {
    const repoRoot = PACKAGE_ROOT;
    const listed = (text: string, marker: RegExp): string[] => {
        const m = marker.exec(text.replace(/\s+/g, ' '));
        expect(m, String(marker)).not.toBeNull();
        return [...(m?.[1] ?? '').matchAll(/[a-z]+/g)].map((w) => w[0]).filter((w) => w !== 'or');
    };

    it('the CLI help names every refusal state of the value in force, and a candidate as a warning', () => {
        const help = fs.readFileSync(path.join(repoRoot, 'src/scripts/_dispatch.bash'), 'utf-8');
        expect(listed(help, /Exit 1 when a key in force is ([a-z, ]+?);/)).toEqual([...REFUSAL_STATES]);
        expect(help.replace(/\s+/g, ' ')).toContain('a candidate in one of these states is a warning, exit 0');
    });

    it('the branch-update reference names every refusal state', () => {
        const ref = fs.readFileSync(path.join(repoRoot, 'src/skills/git-workflow/references/branch-update.md'), 'utf-8');
        expect(listed(ref, /exits 1 when the value in force is ([`a-z, ]+?) —/)).toEqual([...REFUSAL_STATES]);
    });
});
