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
    clean_title,
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

/** A transcript path bound to `id` inside the test profile, as hosts lay them out. */
function tr(id: string, suffix = ''): string {
    const dir = path.join(env['CLAUDE_CONFIG_DIR']!, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${id}${suffix}.jsonl`);
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
        const base = { session_id: 'sess-s1-0001', platform: 'claude', cwd: repo };
        catalog_update({ ...base, event: 'session_start' }, env);
        catalog_update({ ...base, event: 'session_end' }, env);
        const e = read_entry(catalog_dir(env), 'sess-s1-0001');
        expect(e).not.toBeNull();
        expect(e!.ended_at).not.toBeNull();
        expect(derive_status(e!)).toBe('ended');
        // A later event (resume under the same id) reopens it.
        catalog_update({ ...base, event: 'user_prompt_submit' }, env);
        expect(read_entry(catalog_dir(env), 'sess-s1-0001')!.ended_at).toBeNull();
    });

    it('records start path, repo, remote without credentials, branch and resume command', () => {
        catalog_update({ session_id: 'sess-s2-0001', platform: 'claude', event: 'session_start', cwd: path.join(repo, 'src') }, env);
        const e = read_entry(catalog_dir(env), 'sess-s2-0001')!;
        expect(e.start_cwd).toBe(path.join(repo, 'src'));
        expect(e.provider).toBe('anthropic');
        expect(e.repos).toHaveLength(1);
        expect(e.repos[0]!.root).toBe(repo);
        expect(e.repos[0]!.name).toBe('app');
        expect(e.repos[0]!.remote).toBe('https://github.com/acme/app.git');
        expect(e.repos[0]!.branches).toEqual(['main']);
        expect(e.resume).toEqual({
            cwd: path.join(repo, 'src'),
            argv: ['claude', '--resume', 'sess-s2-0001'],
            command: 'claude --resume sess-s2-0001',
            env: { CLAUDE_CONFIG_DIR: env['CLAUDE_CONFIG_DIR'] },
        });
    });

    it('collects every branch a checkout was on, oldest first', () => {
        const base = { session_id: 'sess-s3-0001', platform: 'claude', cwd: repo };
        catalog_update({ ...base, event: 'session_start' }, env);
        git(repo, 'checkout', '-q', '-b', 'feat/x');
        catalog_update({ ...base, event: 'stop' }, env);
        const e = read_entry(catalog_dir(env), 'sess-s3-0001')!;
        expect(e.repos[0]!.branches).toEqual(['main', 'feat/x']);
        expect(e.repos[0]!.last_branch).toBe('feat/x');
    });

    it('ingests the transcript incrementally and de-duplicates usage by message id', () => {
        const t = tr('sess-s4-0001');
        fs.writeFileSync(
            t,
            line({ type: 'ai-title', aiTitle: 'Fix login' }) +
                assistant('m1', USAGE) +
                assistant('m1', USAGE), // second content block of the same message
        );
        const ev = { session_id: 'sess-s4-0001', platform: 'claude', transcript_path: t };
        catalog_update({ ...ev, event: 'session_start' }, env);
        let e = read_entry(catalog_dir(env), 'sess-s4-0001')!;
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
        e = read_entry(catalog_dir(env), 'sess-s4-0001')!;
        expect(e.usage!.assistant_messages).toBe(2);
        expect(e.context_tokens).toBe(5110);

        // Re-running without new bytes changes nothing.
        catalog_update({ ...ev, event: 'stop' }, env);
        expect(read_entry(catalog_dir(env), 'sess-s4-0001')!.usage!.assistant_messages).toBe(2);
    });

    it('attributes repos edited through tool calls, including a second repository', () => {
        const other = make_repo('lib', 'develop');
        const t = tr('sess-s5-0001');
        fs.writeFileSync(
            t,
            assistant('m1', USAGE, {}, [
                { type: 'tool_use', name: 'Edit', input: { file_path: path.join(other, 'src', 'sess-new-0001', 'x.ts') } },
            ]),
        );
        catalog_update({ session_id: 'sess-s5-0001', platform: 'claude', event: 'stop', transcript_path: t }, env);
        const e = read_entry(catalog_dir(env), 'sess-s5-0001')!;
        const names = e.repos.map((r) => `${r.name}@${r.last_branch}`).sort();
        expect(names).toEqual(['app@main', 'lib@develop']);
    });

    it('takes the start path from the transcript and labels a linked worktree with its own branch', () => {
        const wt = path.join(tmp, 'wt');
        git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
        git(repo, 'worktree', 'add', '-q', '-b', 'feat/wt', wt);
        const t = tr('sess-sw-0001');
        // The host keeps reporting the start branch after the move — must be ignored.
        fs.writeFileSync(t, assistant('m1', USAGE) + assistant('m2', USAGE, { cwd: fs.realpathSync(wt), gitBranch: 'main' }));
        const e = catalog_update(
            { session_id: 'sess-sw-0001', platform: 'claude', event: 'session_start', cwd: fs.realpathSync(wt), transcript_path: t },
            env,
        )!;
        expect(e.start_cwd).toBe(repo);
        expect(e.resume!.cwd).toBe(repo);
        const wt_repo = e.repos.find((r) => r.linked_worktree)!;
        expect(wt_repo.last_branch).toBe('feat/wt');
        expect(repo_label(wt_repo)).toBe('app [wt]@feat/wt');
    });

    it('starts over when the transcript shrinks instead of keeping stale totals', () => {
        const t = tr('sess-s6-0001');
        fs.writeFileSync(t, assistant('m1', USAGE) + assistant('m2', USAGE));
        const ev = { session_id: 'sess-s6-0001', platform: 'claude', transcript_path: t };
        catalog_update({ ...ev, event: 'stop' }, env);
        fs.writeFileSync(t, assistant('m9', USAGE));
        catalog_update({ ...ev, event: 'stop' }, env);
        expect(read_entry(catalog_dir(env), 'sess-s6-0001')!.usage!.assistant_messages).toBe(1);
    });

    it('fails open on an unreadable transcript and a host without resume support', () => {
        const e = catalog_update(
            { session_id: 'sess-s7-0001', platform: 'cursor', event: 'session_start', transcript_path: path.join(tmp, 'missing.jsonl') },
            env,
        );
        expect(e).not.toBeNull();
        expect(e!.usage).toBeNull();
        expect(e!.resume).toBeNull();
        expect(e!.provider).toBe('cursor');
    });

    it('never stores prompt text', () => {
        const t = tr('sess-s9-0001');
        fs.writeFileSync(t, line({ type: 'user', message: { role: 'user', content: 'my password is hunter22' } }) + assistant('m1', USAGE));
        catalog_update({ session_id: 'sess-s9-0001', platform: 'claude', event: 'stop', transcript_path: t }, env);
        const raw = fs.readFileSync(path.join(catalog_dir(env), 'claude--sess-s9-0001.v1.json'), 'utf-8');
        expect(raw).not.toContain('hunter22');
    });
});

describe('review fixes', () => {
    it('does not count a checkout the session only read', () => {
        const other = make_repo('dotfiles', 'main');
        const t = tr('sess-rd-0001');
        fs.writeFileSync(t, assistant('m1', USAGE, {}, [{ type: 'tool_use', name: 'Read', input: { file_path: path.join(other, 'src') } }]));
        const e = catalog_update({ session_id: 'sess-rd-0001', platform: 'claude', event: 'stop', transcript_path: t }, env)!;
        expect(e.repos.map((r) => r.name)).toEqual(['app']);
    });

    it('refuses a transcript that is a symlink, not .jsonl, another session\'s, or outside the profile', () => {
        const real = tr('sess-ln-0001', '-real');
        fs.writeFileSync(real, assistant('m1', USAGE));
        const link = tr('sess-ln-0001');
        fs.symlinkSync(real, link);
        const txt = real.replace(/\.jsonl$/, '.txt');
        fs.copyFileSync(real, txt);
        const foreign = tr('sess-zz-9999');
        fs.copyFileSync(real, foreign);
        const outside = path.join(tmp, 'sess-ot-0001.jsonl');
        fs.copyFileSync(real, outside);
        for (const [id, p] of [
            ['sess-ln-0001', link],
            ['sess-tx-0001', txt],
            ['sess-fx-0001', foreign],
            ['sess-ot-0001', outside],
        ] as const) {
            const e = catalog_update({ session_id: id, platform: 'claude', event: 'stop', transcript_path: p }, env)!;
            expect(e.usage).toBeNull();
            expect(e.transcript_path).toBeNull();
        }
    });

    it('refuses a transcript reached through a symlinked parent that leaves the profile', () => {
        const outside = path.join(tmp, 'elsewhere');
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, 'sess-sp-0001.jsonl'), assistant('m1', USAGE));
        const inside = path.join(env['CLAUDE_CONFIG_DIR']!, 'projects', 'linked');
        fs.mkdirSync(path.dirname(inside), { recursive: true });
        fs.symlinkSync(outside, inside);
        const e = catalog_update(
            { session_id: 'sess-sp-0001', platform: 'claude', event: 'stop', transcript_path: path.join(inside, 'sess-sp-0001.jsonl') },
            env,
        )!;
        expect(e.usage).toBeNull();
    });

    it('refuses a transcript whose name only contains the id, and a host profile it cannot resolve', () => {
        const t = tr('xsess-nm-0001');
        fs.writeFileSync(t, assistant('m1', USAGE));
        expect(catalog_update({ session_id: 'sess-nm-0001', platform: 'claude', event: 'stop', transcript_path: t }, env)!.usage).toBeNull();
        const { CLAUDE_CONFIG_DIR: _drop, ...noProfile } = env;
        void _drop;
        const t2 = tr('sess-np-0001');
        fs.writeFileSync(t2, assistant('m1', USAGE));
        expect(catalog_update({ session_id: 'sess-np-0001', platform: 'claude', event: 'stop', transcript_path: t2 }, noProfile)!.usage).toBeNull();
    });

    it('never double-counts when several hook processes of one session race', () => {
        const t = tr('sess-rc-0001');
        fs.writeFileSync(t, assistant('m1', USAGE) + assistant('m2', USAGE) + assistant('m3', USAGE));
        const lib = path.resolve('src/scripts/_lib/session_catalog.ts');
        const script = `import { catalog_update } from ${JSON.stringify(lib)};
            catalog_update({ session_id: 'sess-rc-0001', platform: 'claude', event: 'stop', transcript_path: ${JSON.stringify(t)} });`;
        const runner = path.join(tmp, 'race.mts');
        fs.writeFileSync(runner, script);
        const tsx = path.resolve('node_modules/.bin/tsx');
        const procs = Array.from({ length: 6 }, () => spawn(tsx, [runner], { env: { ...process.env, ...env } }));
        const deadline = Date.now() + 60_000;
        while (procs.some((c) => c.exitCode === null) && Date.now() < deadline) execFileSync('sleep', ['0.1']);
        const e = read_entry(catalog_dir(env), 'sess-rc-0001')!;
        expect(e.usage!.assistant_messages).toBe(3);
        expect(fs.readdirSync(catalog_dir(env)).filter((n) => n.startsWith('claude--sess-rc-0001.')).length).toBe(1);
    }, 120_000);

    it('opens a FIFO named like a transcript without blocking and reads nothing', () => {
        const fifo = tr('sess-ff-0001');
        execFileSync('mkfifo', [fifo]);
        const e = catalog_update({ session_id: 'sess-ff-0001', platform: 'claude', event: 'stop', transcript_path: fifo }, env)!;
        expect(e.usage).toBeNull();
    });

    it('survives a damaged record and escapes Markdown-sensitive text', () => {
        fs.mkdirSync(catalog_dir(env), { recursive: true });
        fs.writeFileSync(
            path.join(catalog_dir(env), 'claude--sess-bad-0001.v1.json'),
            JSON.stringify({ session_id: 'sess-bad-0001', last_seen: new Date().toISOString(), title: '# x | `y` [z](u)' }),
        );
        expect(publish_index({ env, force: true })).toBe(true);
        const md = fs.readFileSync(index_md_path(env), 'utf-8');
        expect(md).toContain('\\# x \\| \\`y\\` \\[z\\]\\(u\\)');
        expect(md).not.toContain('\n# x');
    });

    it('keeps two hosts with the same id apart', () => {
        catalog_update({ session_id: 'sess-dup-0001', platform: 'claude', event: 'stop' }, env);
        catalog_update({ session_id: 'sess-dup-0001', platform: 'codex', event: 'stop' }, env);
        expect(read_entry(catalog_dir(env), 'sess-dup-0001', 'claude')!.host).toBe('claude');
        expect(read_entry(catalog_dir(env), 'sess-dup-0001', 'codex')!.host).toBe('codex');
    });

    it('does not let a late stop reopen an ended session, but a new prompt does', () => {
        const base = { session_id: 'sess-lt-0001', platform: 'claude' };
        catalog_update({ ...base, event: 'session_end' }, env);
        expect(catalog_update({ ...base, event: 'stop' }, env)!.ended_at).not.toBeNull();
        expect(catalog_update({ ...base, event: 'user_prompt_submit' }, env)!.ended_at).toBeNull();
    });

    it('never puts shell syntax from a session id into a resume line', () => {
        expect(catalog_update({ session_id: 'abcdefgh;rm -rf ~', platform: 'claude', event: 'stop' }, env)).toBeNull();
        expect(build_resume({ host: 'claude', session_id: 'abc$(id)xyz', start_cwd: null, config_dir: null } as Parameters<typeof build_resume>[0])).toBeNull();
    });

    it('masks token-shaped runs in titles and strips query credentials from remotes', () => {
        expect(clean_title('Rotate key sk-ant-abcdef1234567890XYZ now')).toBe('Rotate key [redacted] now');
        expect(clean_title('x'.repeat(300)).length).toBe(120);
        expect(strip_userinfo('https://host/a.git?token=abc#frag')).toBe('https://host/a.git');
    });

    it('resets the cursor when the transcript path changes', () => {
        const a = tr('a-sess-pc-0001');
        const b = tr('b-sess-pc-0001');
        fs.writeFileSync(a, assistant('m1', USAGE) + assistant('m2', USAGE));
        fs.writeFileSync(b, assistant('n1', USAGE) + assistant('n2', USAGE) + assistant('n3', USAGE));
        catalog_update({ session_id: 'sess-pc-0001', platform: 'claude', event: 'stop', transcript_path: a }, env);
        const e = catalog_update({ session_id: 'sess-pc-0001', platform: 'claude', event: 'stop', transcript_path: b }, env)!;
        expect(e.usage!.assistant_messages).toBe(3);
    });

    it('is written by the session-register hook on start and kept, ended, after session_end', () => {
        const hook = path.resolve('src/scripts/session_register_hook.ts');
        const t = tr('sess-hk-0001');
        fs.writeFileSync(t, line({ type: 'ai-title', aiTitle: 'Hook run' }) + assistant('m1', USAGE));
        const run = (event: string) =>
            execFileSync(path.resolve('node_modules/.bin/tsx'), [hook], {
                input: JSON.stringify({
                    event,
                    platform: 'claude',
                    session_id: 'sess-hk-0001',
                    workspace_root: repo,
                    surface: 'unknown',
                    payload: { cwd: repo, transcript_path: t },
                }),
                env: { ...process.env, ...env, EVENT4U_CONFIG_HOME: path.join(tmp, 'cfg') },
                cwd: repo,
            });
        run('session_start');
        expect(read_entry(catalog_dir(env), 'sess-hk-0001')!.title).toBe('Hook run');
        run('session_end');
        const e = read_entry(catalog_dir(env), 'sess-hk-0001')!;
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
        catalog_update({ session_id: 'sess-old-0001', platform: 'claude', event: 'session_start', cwd: repo, now: t0 }, env);
        catalog_update({ session_id: 'sess-new-0001', platform: 'claude', event: 'session_start', cwd: repo, now: t1 }, env);
        publish_index({ env, now, force: true });

        const index = JSON.parse(fs.readFileSync(index_json_path(env), 'utf-8'));
        expect(index.schema_version).toBe(1);
        expect(index.sessions.map((s: { session_id: string }) => s.session_id)).toEqual(['sess-new-0001', 'sess-old-0001']);
        expect(index.sessions[0].status).toBe('active');
        expect(index.sessions[1].status).toBe('idle');
        expect(index.sessions[0]._ingest).toBeUndefined();
        expect(index.counts).toMatchObject({ total: 2, active: 1, idle: 1 });
        const md = fs.readFileSync(index_md_path(env), 'utf-8');
        expect(md.indexOf('sess-new-0001 `')).toBeLessThan(md.indexOf('sess-old-0001 `'));
        expect(md).toContain('claude --resume sess-new-0001');
        if (process.platform !== 'win32') {
            expect(fs.statSync(index_json_path(env)).mode & 0o077).toBe(0);
        }
    });

    it('prunes records past the retention window', () => {
        const now = new Date('2026-11-20T10:00:00Z');
        const ancient = new Date(now.getTime() - (RETENTION_DAYS + 1) * 86_400_000);
        catalog_update({ session_id: 'sess-ancient-0001', platform: 'claude', event: 'session_start', now: ancient }, env);
        const index = build_index({ env, now });
        expect(index.sessions).toHaveLength(0);
        expect(read_entry(catalog_dir(env), 'sess-ancient-0001')).toBeNull();
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
            session_id: 'abc-12345678',
            start_cwd: '/tmp/my repo',
            config_dir: '/p/codex',
        } as Parameters<typeof build_resume>[0]);
        expect(resume_line({ resume: r })).toBe(`cd '/tmp/my repo' && CODEX_HOME=/p/codex codex resume abc-12345678`);
    });
});

describe('sessions:catalog CLI', () => {
    it('prints JSON filtered by status', () => {
        catalog_update({ session_id: 'sess-live-0001', platform: 'claude', event: 'session_start', cwd: repo }, env);
        catalog_update({ session_id: 'sess-done-0001', platform: 'claude', event: 'session_end', cwd: repo }, env);
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
        expect(parsed.sessions.map((s: { session_id: string }) => s.session_id)).toEqual(['sess-done-0001']);
        expect(parsed.counts.total).toBe(2);
    });
});
