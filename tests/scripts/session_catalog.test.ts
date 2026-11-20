/**
 * Machine-wide session catalog — the persistence, enrichment and publication
 * contract external readers (the CLI, agent-switch) depend on.
 */

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    ACTIVE_WINDOW_SECONDS,
    RETENTION_DAYS,
    build_index,
    build_resume,
    catalog_dir,
    catalog_update,
    derive_status,
    index_json_path,
    index_md_path,
    publish_index,
    read_entry,
    repo_label,
    resume_line,
    strip_userinfo,
    surface_from_entrypoint,
} from '../../src/scripts/_lib/session_catalog.js';
import { cmd_catalog } from '../../src/scripts/sessions_catalog_cli.js';

let tmp: string;
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

function line(o: unknown): string {
    return `${JSON.stringify(o)}\n`;
}

function assistant(id: string, usage: Record<string, number>, extra: Record<string, unknown> = {}, content: unknown[] = []): string {
    return line({
        type: 'assistant',
        cwd: repo,
        gitBranch: 'main',
        entrypoint: 'cli',
        version: '2.1.0',
        message: { id, model: 'claude-opus-5-5', usage, content },
        ...extra,
    });
}

const USAGE = { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 100, output_tokens: 50 };

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-')));
    env = {
        AGENT_CONFIG_SESSION_CATALOG_HOME: path.join(tmp, 'home'),
        CLAUDE_CONFIG_DIR: path.join(tmp, 'profiles', 'claude', 'work', 'config'),
    };
    repo = make_repo('app', 'main', 'https://user:s3cret@github.com/acme/app.git');
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('catalog_update', () => {
    it('keeps the session after session_end, marked ended, instead of deleting it', () => {
        const base = { session_id: 's1', platform: 'claude', cwd: repo };
        catalog_update({ ...base, event: 'session_start' }, env);
        catalog_update({ ...base, event: 'session_end' }, env);
        const e = read_entry(catalog_dir(env), 's1');
        expect(e).not.toBeNull();
        expect(e!.ended_at).not.toBeNull();
        expect(derive_status(e!)).toBe('ended');
        // A later event (resume under the same id) reopens it.
        catalog_update({ ...base, event: 'user_prompt_submit' }, env);
        expect(read_entry(catalog_dir(env), 's1')!.ended_at).toBeNull();
    });

    it('records start path, repo, remote without credentials, branch and resume command', () => {
        catalog_update({ session_id: 's2', platform: 'claude', event: 'session_start', cwd: path.join(repo, 'src') }, env);
        const e = read_entry(catalog_dir(env), 's2')!;
        expect(e.start_cwd).toBe(path.join(repo, 'src'));
        expect(e.provider).toBe('anthropic');
        expect(e.repos).toHaveLength(1);
        expect(e.repos[0]!.root).toBe(repo);
        expect(e.repos[0]!.name).toBe('app');
        expect(e.repos[0]!.remote).toBe('https://github.com/acme/app.git');
        expect(e.repos[0]!.branches).toEqual(['main']);
        expect(e.resume).toEqual({
            cwd: path.join(repo, 'src'),
            command: 'claude --resume s2',
            env: { CLAUDE_CONFIG_DIR: env['CLAUDE_CONFIG_DIR'] },
        });
    });

    it('collects every branch a checkout was on, oldest first', () => {
        const base = { session_id: 's3', platform: 'claude', cwd: repo };
        catalog_update({ ...base, event: 'session_start' }, env);
        git(repo, 'checkout', '-q', '-b', 'feat/x');
        catalog_update({ ...base, event: 'stop' }, env);
        const e = read_entry(catalog_dir(env), 's3')!;
        expect(e.repos[0]!.branches).toEqual(['main', 'feat/x']);
        expect(e.repos[0]!.last_branch).toBe('feat/x');
    });

    it('ingests the transcript incrementally and de-duplicates usage by message id', () => {
        const t = path.join(tmp, 't.jsonl');
        fs.writeFileSync(
            t,
            line({ type: 'ai-title', aiTitle: 'Fix login' }) +
                assistant('m1', USAGE) +
                assistant('m1', USAGE), // second content block of the same message
        );
        const ev = { session_id: 's4', platform: 'claude', transcript_path: t };
        catalog_update({ ...ev, event: 'session_start' }, env);
        let e = read_entry(catalog_dir(env), 's4')!;
        expect(e.usage!.assistant_messages).toBe(1);
        expect(e.usage!.total_tokens).toBe(1160);
        expect(e.context_tokens).toBe(1110);
        expect(e.model).toBe('claude-opus-5-5');
        expect(e.title).toBe('Fix login');
        expect(e.surface).toBe('cli');
        expect(e.host_version).toBe('2.1.0');

        // Append a new message plus a PARTIAL line: only the complete one counts.
        fs.appendFileSync(t, assistant('m2', { ...USAGE, cache_read_input_tokens: 5000 }) + '{"type":"assist');
        catalog_update({ ...ev, event: 'stop' }, env);
        e = read_entry(catalog_dir(env), 's4')!;
        expect(e.usage!.assistant_messages).toBe(2);
        expect(e.context_tokens).toBe(5110);

        // Re-running without new bytes changes nothing.
        catalog_update({ ...ev, event: 'stop' }, env);
        expect(read_entry(catalog_dir(env), 's4')!.usage!.assistant_messages).toBe(2);
    });

    it('attributes repos edited through tool calls, including a second repository', () => {
        const other = make_repo('lib', 'develop');
        const t = path.join(tmp, 't.jsonl');
        fs.writeFileSync(
            t,
            assistant('m1', USAGE, {}, [
                { type: 'tool_use', name: 'Edit', input: { file_path: path.join(other, 'src', 'new', 'x.ts') } },
            ]),
        );
        catalog_update({ session_id: 's5', platform: 'claude', event: 'stop', transcript_path: t }, env);
        const e = read_entry(catalog_dir(env), 's5')!;
        const names = e.repos.map((r) => `${r.name}@${r.last_branch}`).sort();
        expect(names).toEqual(['app@main', 'lib@develop']);
    });

    it('takes the start path from the transcript and labels a linked worktree with its own branch', () => {
        const wt = path.join(tmp, 'wt');
        git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
        git(repo, 'worktree', 'add', '-q', '-b', 'feat/wt', wt);
        const t = path.join(tmp, 't.jsonl');
        // The host keeps reporting the start branch after the move — must be ignored.
        fs.writeFileSync(t, assistant('m1', USAGE) + assistant('m2', USAGE, { cwd: fs.realpathSync(wt), gitBranch: 'main' }));
        const e = catalog_update(
            { session_id: 'sw', platform: 'claude', event: 'session_start', cwd: fs.realpathSync(wt), transcript_path: t },
            env,
        )!;
        expect(e.start_cwd).toBe(repo);
        expect(e.resume!.cwd).toBe(repo);
        const wt_repo = e.repos.find((r) => r.linked_worktree)!;
        expect(wt_repo.last_branch).toBe('feat/wt');
        expect(repo_label(wt_repo)).toBe('app [wt]@feat/wt');
    });

    it('starts over when the transcript shrinks instead of keeping stale totals', () => {
        const t = path.join(tmp, 't.jsonl');
        fs.writeFileSync(t, assistant('m1', USAGE) + assistant('m2', USAGE));
        const ev = { session_id: 's6', platform: 'claude', transcript_path: t };
        catalog_update({ ...ev, event: 'stop' }, env);
        fs.writeFileSync(t, assistant('m9', USAGE));
        catalog_update({ ...ev, event: 'stop' }, env);
        expect(read_entry(catalog_dir(env), 's6')!.usage!.assistant_messages).toBe(1);
    });

    it('fails open on an unreadable transcript and a host without resume support', () => {
        const e = catalog_update(
            { session_id: 's7', platform: 'cursor', event: 'session_start', transcript_path: path.join(tmp, 'missing.jsonl') },
            env,
        );
        expect(e).not.toBeNull();
        expect(e!.usage).toBeNull();
        expect(e!.resume).toBeNull();
        expect(e!.provider).toBe('cursor');
    });

    it('skips the update while another process of the same session holds its lock', () => {
        fs.mkdirSync(path.join(catalog_dir(env), '.s8.lock'), { recursive: true });
        expect(catalog_update({ session_id: 's8', platform: 'claude', event: 'stop' }, env)).toBeNull();
        expect(read_entry(catalog_dir(env), 's8')).toBeNull();
    });

    it('never stores prompt text', () => {
        const t = path.join(tmp, 't.jsonl');
        fs.writeFileSync(t, line({ type: 'user', message: { role: 'user', content: 'my password is hunter22' } }) + assistant('m1', USAGE));
        catalog_update({ session_id: 's9', platform: 'claude', event: 'stop', transcript_path: t }, env);
        const raw = fs.readFileSync(path.join(catalog_dir(env), 's9.json'), 'utf-8');
        expect(raw).not.toContain('hunter22');
    });
});

describe('review fixes', () => {
    it('lets session_end wait for a heartbeat that still holds the lock', () => {
        const lock = path.join(catalog_dir(env), '.se.lock');
        fs.mkdirSync(catalog_dir(env), { recursive: true });
        const child = spawn(process.execPath, [
            '-e',
            `require('fs').mkdirSync(${JSON.stringify(lock)});setTimeout(()=>require('fs').rmSync(${JSON.stringify(lock)},{recursive:true}),400)`,
        ]);
        const deadline = Date.now() + 5000;
        while (!fs.existsSync(lock) && Date.now() < deadline) execFileSync('sleep', ['0.05']);
        expect(catalog_update({ session_id: 'se', platform: 'claude', event: 'stop' }, env)).toBeNull();
        const e = catalog_update({ session_id: 'se', platform: 'claude', event: 'session_end' }, env);
        child.kill();
        expect(e?.ended_at).not.toBeNull();
    });

    it('does not count a checkout the session only read', () => {
        const other = make_repo('dotfiles', 'main');
        const t = path.join(tmp, 't.jsonl');
        fs.writeFileSync(t, assistant('m1', USAGE, {}, [{ type: 'tool_use', name: 'Read', input: { file_path: path.join(other, 'src') } }]));
        const e = catalog_update({ session_id: 'rd', platform: 'claude', event: 'stop', transcript_path: t }, env)!;
        expect(e.repos.map((r) => r.name)).toEqual(['app']);
    });

    it('refuses a transcript that is a symlink or not .jsonl', () => {
        const real = path.join(tmp, 'real.jsonl');
        fs.writeFileSync(real, assistant('m1', USAGE));
        const link = path.join(tmp, 'link.jsonl');
        fs.symlinkSync(real, link);
        const txt = path.join(tmp, 't.txt');
        fs.copyFileSync(real, txt);
        for (const [id, p] of [['ln', link], ['tx', txt]] as const) {
            const e = catalog_update({ session_id: id, platform: 'claude', event: 'stop', transcript_path: p }, env)!;
            expect(e.usage).toBeNull();
            expect(e.transcript_path).toBeNull();
        }
    });

    it('resets the cursor when the transcript path changes', () => {
        const a = path.join(tmp, 'a.jsonl');
        const b = path.join(tmp, 'b.jsonl');
        fs.writeFileSync(a, assistant('m1', USAGE) + assistant('m2', USAGE));
        fs.writeFileSync(b, assistant('n1', USAGE) + assistant('n2', USAGE) + assistant('n3', USAGE));
        catalog_update({ session_id: 'pc', platform: 'claude', event: 'stop', transcript_path: a }, env);
        const e = catalog_update({ session_id: 'pc', platform: 'claude', event: 'stop', transcript_path: b }, env)!;
        expect(e.usage!.assistant_messages).toBe(3);
    });

    it('is written by the session-register hook on start and kept, ended, after session_end', () => {
        const hook = path.resolve('src/scripts/session_register_hook.ts');
        const t = path.join(tmp, 'h.jsonl');
        fs.writeFileSync(t, line({ type: 'ai-title', aiTitle: 'Hook run' }) + assistant('m1', USAGE));
        const run = (event: string) =>
            execFileSync(path.resolve('node_modules/.bin/tsx'), [hook], {
                input: JSON.stringify({
                    event,
                    platform: 'claude',
                    session_id: 'hk',
                    workspace_root: repo,
                    surface: 'unknown',
                    payload: { cwd: repo, transcript_path: t },
                }),
                env: { ...process.env, ...env, EVENT4U_CONFIG_HOME: path.join(tmp, 'cfg') },
                cwd: repo,
            });
        run('session_start');
        expect(read_entry(catalog_dir(env), 'hk')!.title).toBe('Hook run');
        run('session_end');
        const e = read_entry(catalog_dir(env), 'hk')!;
        expect(e.ended_at).not.toBeNull();
        expect(e.usage!.assistant_messages).toBe(1);
        expect(JSON.parse(fs.readFileSync(index_json_path(env), 'utf-8')).sessions[0].status).toBe('ended');
    });
});

describe('publish_index', () => {
    it('writes sessions.json and SESSIONS.md newest first, owner-only, with derived status', () => {
        const t0 = new Date('2026-11-20T08:00:00Z');
        const t1 = new Date('2026-11-20T09:55:00Z');
        const now = new Date('2026-11-20T10:00:00Z');
        catalog_update({ session_id: 'old', platform: 'claude', event: 'session_start', cwd: repo, now: t0 }, env);
        catalog_update({ session_id: 'new', platform: 'claude', event: 'session_start', cwd: repo, now: t1 }, env);
        publish_index({ env, now, force: true });

        const index = JSON.parse(fs.readFileSync(index_json_path(env), 'utf-8'));
        expect(index.schema_version).toBe(1);
        expect(index.sessions.map((s: { session_id: string }) => s.session_id)).toEqual(['new', 'old']);
        expect(index.sessions[0].status).toBe('active');
        expect(index.sessions[1].status).toBe('idle');
        expect(index.sessions[0]._ingest).toBeUndefined();
        expect(index.counts).toMatchObject({ total: 2, active: 1, idle: 1 });
        const md = fs.readFileSync(index_md_path(env), 'utf-8');
        expect(md.indexOf('`new`')).toBeLessThan(md.indexOf('`old`'));
        expect(md).toContain('claude --resume new');
        if (process.platform !== 'win32') {
            expect(fs.statSync(index_json_path(env)).mode & 0o077).toBe(0);
        }
    });

    it('prunes records past the retention window', () => {
        const now = new Date('2026-11-20T10:00:00Z');
        const ancient = new Date(now.getTime() - (RETENTION_DAYS + 1) * 86_400_000);
        catalog_update({ session_id: 'ancient', platform: 'claude', event: 'session_start', now: ancient }, env);
        const index = build_index({ env, now });
        expect(index.sessions).toHaveLength(0);
        expect(read_entry(catalog_dir(env), 'ancient')).toBeNull();
    });

    it('defers to the lock holder and leaves the dirty marker for it', () => {
        fs.mkdirSync(path.join(catalog_dir(env), '.publish.lock'), { recursive: true });
        expect(publish_index({ env, force: true })).toBe(true);
        expect(fs.existsSync(index_json_path(env))).toBe(false);
        expect(fs.existsSync(path.join(catalog_dir(env), '.dirty'))).toBe(true);
    });
});

describe('helpers', () => {
    it('derives status from age and the host TTL', () => {
        const now = new Date('2026-11-20T10:00:00Z');
        const at = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
        expect(derive_status({ host: 'claude', ended_at: null, last_seen: at(60) }, now)).toBe('active');
        expect(derive_status({ host: 'claude', ended_at: null, last_seen: at(ACTIVE_WINDOW_SECONDS + 60) }, now)).toBe('idle');
        expect(derive_status({ host: 'claude', ended_at: null, last_seen: at(5 * 3600) }, now)).toBe('stale');
    });

    it('maps entrypoints to surfaces and strips userinfo', () => {
        expect(surface_from_entrypoint('claude-desktop', null)).toBe('desktop');
        expect(surface_from_entrypoint('claude-vscode', null)).toBe('ide');
        expect(surface_from_entrypoint(null, 'cloud')).toBe('cloud');
        expect(strip_userinfo('https://tok@github.com/a/b.git')).toBe('https://github.com/a/b.git');
        expect(strip_userinfo('git@github.com:a/b.git')).toBe('git@github.com:a/b.git');
    });

    it('renders a copy-paste resume line with quoting', () => {
        const r = build_resume({
            host: 'codex',
            session_id: 'abc',
            start_cwd: '/tmp/my repo',
            config_dir: '/p/codex',
        } as Parameters<typeof build_resume>[0]);
        expect(resume_line({ resume: r })).toBe(`cd '/tmp/my repo' && CODEX_HOME=/p/codex codex resume abc`);
    });
});

describe('sessions:catalog CLI', () => {
    it('prints JSON filtered by status', () => {
        catalog_update({ session_id: 'live', platform: 'claude', event: 'session_start', cwd: repo }, env);
        catalog_update({ session_id: 'done', platform: 'claude', event: 'session_end', cwd: repo }, env);
        let out = '';
        const write = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((chunk: string) => {
            out += chunk;
            return true;
        }) as typeof process.stdout.write;
        try {
            expect(cmd_catalog(['--json', '--status', 'ended'], env)).toBe(0);
        } finally {
            process.stdout.write = write;
        }
        const parsed = JSON.parse(out);
        expect(parsed.sessions.map((s: { session_id: string }) => s.session_id)).toEqual(['done']);
        expect(parsed.counts.total).toBe(2);
    });
});
