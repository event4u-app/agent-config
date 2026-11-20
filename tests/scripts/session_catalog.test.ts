/**
 * Machine-wide session catalog — discovery across profiles, transcript
 * parsing for both hosts, incremental caching under a budget, liveness from
 * the live register, and the safety properties of reading host data.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    RETENTION_DAYS,
    build_index,
    build_resume,
    catalog_root,
    clean_title,
    discover_sources,
    index_json_path,
    index_md_path,
    md_code,
    publish_index,
    resume_line,
    strip_userinfo,
    surface_from_entrypoint,
} from '../../src/scripts/_lib/session_catalog.js';
import { cmd_catalog } from '../../src/scripts/sessions_catalog_cli.js';

let tmp: string;
let home: string;
let env: NodeJS.ProcessEnv;
let repo: string;

function git(cwd: string, ...args: string[]): void {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function make_repo(name: string, branch: string, remote: string | null = null): string {
    const dir = path.join(tmp, name);
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    git(dir, 'init', '-q', '-b', branch);
    if (remote !== null) git(dir, 'remote', 'add', 'origin', remote);
    return fs.realpathSync(dir);
}

const line = (o: unknown): string => `${JSON.stringify(o)}\n`;

const USAGE = { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 100, output_tokens: 50 };

function assistant(id: string, extra: Record<string, unknown> = {}, content: unknown[] = []): string {
    return line({
        type: 'assistant',
        cwd: repo,
        gitBranch: 'main',
        entrypoint: 'cli',
        version: '2.1.0',
        timestamp: '2026-11-20T09:00:00.000Z',
        message: { id, model: 'claude-opus-5-5', usage: USAGE, content },
        ...extra,
    });
}

/** A Claude transcript under an agent-switch profile, as the host lays it out. */
function claude_transcript(id: string, body: string, profile = 'work'): string {
    const dir = path.join(home, '.agent-switch', 'claude', profile, 'config', 'projects', '-proj');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${id}.jsonl`);
    fs.writeFileSync(file, body);
    return file;
}

function codex_transcript(id: string, body: string): string {
    const dir = path.join(home, '.codex', 'sessions', '2026', '11', '20');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `rollout-2026-11-20T10-00-00-${id}.jsonl`);
    fs.writeFileSync(file, body);
    return file;
}

function find(id: string, opts: Parameters<typeof build_index>[0] = {}) {
    return build_index({ env, home, ...opts }).sessions.find((s) => s.session_id === id);
}

const ID1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const ID2 = 'bbbbbbbb-2222-4222-8222-222222222222';
const CX = '01a1f916-e4ca-75d2-bb4a-1b897cca31db';

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-')));
    home = path.join(tmp, 'home');
    fs.mkdirSync(home);
    env = { AGENT_CONFIG_SESSION_CATALOG_HOME: path.join(tmp, 'out') };
    // A fake credential URL, assembled so no scanner reads the source as a leaked secret.
    repo = make_repo('app', 'main', ['https://', 'user', ':', 'fake', '@github.com/acme/app.git'].join(''));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('discovery', () => {
    it('finds agent-switch profiles of both hosts and the default dirs, once each', () => {
        for (const p of ['claude/work/config', 'claude/home/config', 'codex/one/config']) {
            fs.mkdirSync(path.join(home, '.agent-switch', p), { recursive: true });
        }
        fs.mkdirSync(path.join(home, '.claude'));
        fs.mkdirSync(path.join(home, '.codex'));
        const extra = path.join(home, '.agent-switch', 'claude', 'work', 'config');
        const labels = discover_sources({ CLAUDE_CONFIG_DIR: extra }, home).map((s) => `${s.host}:${s.profile?.name}`);
        expect(labels).toEqual(['claude:home', 'claude:work', 'codex:one', 'claude:default', 'codex:default']);
    });

    it('writes to the machine root, not a per-profile config home', () => {
        expect(catalog_root({ EVENT4U_CONFIG_HOME: '/somewhere/else' }, home)).toBe(path.join(home, '.event4u', 'agent-config'));
    });

    it('skips transcripts older than the retention window, symlinks and non-files', () => {
        const old = claude_transcript(ID1, assistant('m1'));
        const past = new Date(Date.now() - (RETENTION_DAYS + 1) * 86_400_000);
        fs.utimesSync(old, past, past);
        const dir = path.dirname(old);
        fs.symlinkSync(old, path.join(dir, `${ID2}.jsonl`));
        execFileSync('mkfifo', [path.join(dir, 'cccccccc-3333-4333-8333-333333333333.jsonl')]);
        expect(build_index({ env, home }).sessions).toHaveLength(0);
    });
});

describe('Claude transcripts', () => {
    it('collects model, title, surface, start path, context and de-duplicated usage', () => {
        claude_transcript(
            ID1,
            line({ type: 'ai-title', aiTitle: 'Fix login' }) + assistant('m1') + assistant('m1') + assistant('m2', { cwd: path.join(repo, 'src') }),
        );
        const s = find(ID1)!;
        expect(s.host).toBe('claude');
        expect(s.provider).toBe('anthropic');
        expect(s.profile).toEqual({ provider: 'claude', name: 'work', via: 'agent-switch' });
        expect(s.surface).toBe('cli');
        expect(s.model).toBe('claude-opus-5-5');
        expect(s.title).toBe('Fix login');
        expect(s.start_cwd).toBe(repo);
        expect(s.cwd).toBe(path.join(repo, 'src'));
        expect(s.usage!.assistant_messages).toBe(2);
        expect(s.usage!.total_tokens).toBe(2320);
        expect(s.usage_complete).toBe(true);
        expect(s.context_tokens).toBe(1110);
        expect(s.repos).toHaveLength(1);
        expect(s.repos[0]!.name).toBe('app');
        expect(s.repos[0]!.remote).toBe('https://github.com/acme/app.git');
        expect(s.repos[0]!.branches).toEqual(['main']);
    });

    it('prefers a user-set title and masks token-shaped runs', () => {
        claude_transcript(
            ID1,
            line({ type: 'custom-title', customTitle: 'Rotate sk-ant-abcdef1234567890XYZ' }) + line({ type: 'ai-title', aiTitle: 'other' }) + assistant('m1'),
        );
        expect(find(ID1)!.title).toBe('Rotate [redacted]');
    });

    it('attributes repos written through edit tools, not ones only read', () => {
        const lib = make_repo('lib', 'develop');
        const dots = make_repo('dots', 'main');
        claude_transcript(
            ID1,
            assistant('m1', {}, [
                { type: 'tool_use', name: 'Edit', input: { file_path: path.join(lib, 'src', 'new', 'x.ts') } },
                { type: 'tool_use', name: 'Read', input: { file_path: path.join(dots, 'src', 'rc') } },
            ]),
        );
        expect(find(ID1)!.repos.map((r) => `${r.name}@${r.last_branch}`).sort()).toEqual(['app@main', 'lib@develop']);
    });

    it('labels a linked worktree with its own branch and ignores the host branch reported there', () => {
        git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
        const wt = path.join(tmp, 'wt');
        git(repo, 'worktree', 'add', '-q', '-b', 'feat/wt', wt);
        claude_transcript(ID1, assistant('m1') + assistant('m2', { cwd: fs.realpathSync(wt), gitBranch: 'main' }));
        const s = find(ID1)!;
        const w = s.repos.find((r) => r.linked_worktree)!;
        expect(w.branches).toEqual(['feat/wt']);
        expect(w.name).toBe('app');
        expect(s.resume!.cwd).toBe(repo);
    });

    it('counts appended lines once across calls and restarts for a replaced file', () => {
        const file = claude_transcript(ID1, assistant('m1'));
        expect(find(ID1)!.usage!.assistant_messages).toBe(1);
        fs.appendFileSync(file, assistant('m2') + '{"type":"assist');
        expect(find(ID1)!.usage!.assistant_messages).toBe(2);
        fs.rmSync(file);
        fs.writeFileSync(file, assistant('n1') + assistant('n2') + assistant('n3'));
        expect(find(ID1)!.usage!.assistant_messages).toBe(3);
    });

    it('marks usage incomplete under a small budget, keeps metadata, and catches up later', () => {
        const body = line({ type: 'ai-title', aiTitle: 'Big one' }) + Array.from({ length: 50 }, (_, i) => assistant(`m${i}`)).join('');
        claude_transcript(ID1, body);
        const first = find(ID1, { budget_bytes: 1 })!;
        expect(first.usage_complete).toBe(false);
        expect(first.title).toBe('Big one');
        expect(first.model).toBe('claude-opus-5-5');
        const later = find(ID1)!;
        expect(later.usage_complete).toBe(true);
        expect(later.usage!.assistant_messages).toBe(50);
    });
});

describe('Codex transcripts', () => {
    it('reads session meta, model, cumulative usage and the context window', () => {
        codex_transcript(
            CX,
            line({ type: 'session_meta', payload: { id: CX, cwd: repo, cli_version: '0.167.0', originator: 'codex_exec', timestamp: '2026-11-20T09:00:00Z' } }) +
                line({ type: 'turn_context', payload: { cwd: repo, model: 'gpt-6.2-sol' } }) +
                line({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 10, total_tokens: 110 }, last_token_usage: { input_tokens: 90 }, model_context_window: 475000 } } }) +
                line({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 300, cached_input_tokens: 100, output_tokens: 30, total_tokens: 330 }, last_token_usage: { input_tokens: 200 }, model_context_window: 475000 } } }),
        );
        const s = find(CX)!;
        expect(s.host).toBe('codex');
        expect(s.provider).toBe('openai');
        expect(s.surface).toBe('headless');
        expect(s.model).toBe('gpt-6.2-sol');
        expect(s.usage!.total_tokens).toBe(330);
        expect(s.usage!.cache_read_input_tokens).toBe(100);
        expect(s.context_tokens).toBe(200);
        expect(s.context_window).toBe(475000);
        expect(s.resume!.command).toBe(`codex resume ${CX}`);
        expect(s.resume!.env).toEqual({});
    });
});

describe('liveness and resume', () => {
    it('marks a session live from the register and keeps an idle live one apart from inactive ones', () => {
        const file = claude_transcript(ID1, assistant('m1'));
        claude_transcript(ID2, assistant('m1'));
        const hours_ago = new Date(Date.now() - 2 * 3600 * 1000);
        for (const id of [ID1, ID2]) fs.utimesSync(file.replace(ID1, id), hours_ago, hours_ago);
        const reg = path.join(tmp, 'out', 'runtime', 'sessions');
        fs.mkdirSync(reg, { recursive: true });
        fs.writeFileSync(
            path.join(reg, `${ID1}.json`),
            JSON.stringify({ session_id: ID1, platform: 'claude', last_seen: hours_ago.toISOString(), roadmap_slug: 'road-to-x' }),
        );
        const a = find(ID1)!;
        const b = find(ID2)!;
        expect([a.status, a.live, a.roadmap_slug]).toEqual(['idle', true, 'road-to-x']);
        expect([b.status, b.live]).toEqual(['inactive', false]);
    });

    it('puts the profile dir into the resume env only when it is not the default', () => {
        claude_transcript(ID1, assistant('m1'));
        const s = find(ID1)!;
        expect(s.resume!.argv).toEqual(['claude', '--resume', ID1]);
        expect(s.resume!.env).toEqual({ CLAUDE_CONFIG_DIR: fs.realpathSync(path.join(home, '.agent-switch', 'claude', 'work', 'config')) });
        expect(build_resume('claude', 'x;rm -rf ~ ', null, '/a', '/a')).toBeNull();
        expect(resume_line({ resume: build_resume('codex', 'abc-12345678', '/tmp/my repo', '/p', '/d') })).toBe(
            `cd '/tmp/my repo' && CODEX_HOME=/p codex resume abc-12345678`,
        );
    });
});

describe('reading host-supplied paths safely', () => {
    it('follows a .git pointer only into a real linked-worktree entry', () => {
        const fake = path.join(tmp, 'fake');
        fs.mkdirSync(fake);
        const target = path.join(tmp, 'notgit', 'worktrees', 'x');
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(target, 'HEAD'), 'ref: refs/heads/leaked\n');
        fs.writeFileSync(path.join(target, 'gitdir'), `${path.join(fs.realpathSync(fake), '.git')}\n`);
        fs.writeFileSync(path.join(fake, '.git'), `gitdir: ${target}\n`);
        claude_transcript(ID1, assistant('m1', { cwd: fake, gitBranch: undefined }));
        const r = find(ID1)!.repos[0]!;
        expect(r.branches).toEqual([]);
        expect(r.last_branch).toBeNull();
    });

    it('does not block on a FIFO where git metadata should be', () => {
        fs.rmSync(path.join(repo, '.git', 'config'));
        execFileSync('mkfifo', [path.join(repo, '.git', 'config')]);
        claude_transcript(ID1, assistant('m1'));
        const r = find(ID1)!.repos[0]!;
        expect(r.remote).toBeNull();
        expect(r.last_branch).toBe('main');
    });

    it('never stores prompt text', () => {
        claude_transcript(ID1, line({ type: 'user', cwd: repo, message: { role: 'user', content: 'my password is hunter22' } }) + assistant('m1'));
        publish_index({ env, home });
        expect(fs.readFileSync(index_json_path(env, home), 'utf-8')).not.toContain('hunter22');
        expect(fs.readFileSync(index_md_path(env, home), 'utf-8')).not.toContain('hunter22');
    });
});

describe('output', () => {
    it('writes both files owner-only, newest first, with escaped Markdown', () => {
        claude_transcript(ID1, line({ type: 'ai-title', aiTitle: '# x | `y` [z](u)' }) + assistant('m1'));
        const f2 = claude_transcript(ID2, assistant('m1'));
        const earlier = new Date(Date.now() - 3600 * 1000);
        fs.utimesSync(f2, earlier, earlier);
        const index = publish_index({ env, home });
        expect(index.sessions.map((s) => s.session_id)).toEqual([ID1, ID2]);
        const md = fs.readFileSync(index_md_path(env, home), 'utf-8');
        expect(md).toContain('\\# x \\| \\`y\\` \\[z\\]\\(u\\)');
        expect(md).not.toContain('\n# x');
        expect(fs.statSync(index_json_path(env, home)).mode & 0o077).toBe(0);
        expect(fs.statSync(index_md_path(env, home)).mode & 0o077).toBe(0);
    });

    it('keeps inner spacing in code spans so a copied resume path stays exact', () => {
        expect(md_code("cd '/tmp/a  b'")).toBe("` cd '/tmp/a  b' `");
    });

    it('prints JSON filtered by status through the CLI and refreshes the files', () => {
        claude_transcript(ID1, assistant('m1'));
        let out = '';
        const write = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((chunk: string) => {
            out += chunk;
            return true;
        }) as typeof process.stdout.write;
        try {
            expect(cmd_catalog(['--json', '--status', 'active'], env, home)).toBe(0);
        } finally {
            process.stdout.write = write;
        }
        expect(JSON.parse(out).sessions.map((s: { session_id: string }) => s.session_id)).toEqual([ID1]);
        expect(fs.existsSync(index_json_path(env, home))).toBe(true);
    });

    it('maps entrypoints to surfaces and strips URL credentials', () => {
        expect(surface_from_entrypoint('claude-desktop')).toBe('desktop');
        expect(surface_from_entrypoint('claude-vscode')).toBe('ide');
        expect(surface_from_entrypoint('codex_exec')).toBe('headless');
        expect(strip_userinfo('https://tok@host/a.git?token=abc#f')).toBe('https://host/a.git');
        expect(clean_title('x'.repeat(300)).length).toBe(120);
    });
});
