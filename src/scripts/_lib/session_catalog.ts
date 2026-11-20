/**
 * Machine-wide session catalog — every Claude Code and Codex session found in
 * any profile on this machine, newest activity first, with what is needed to
 * find it again and resume it.
 *
 * Built on demand by `agent-config sessions:catalog`, never by a hook: the
 * hosts already persist every session as a transcript, so the catalog is a
 * read of data that exists rather than a second store kept in sync from
 * lifecycle hooks. Liveness comes from the live session register
 * (`runtime/sessions/`), which the session-register hook already maintains.
 *
 * Cost: transcripts are parsed incrementally from a cache keyed by file
 * identity, most recent first, under a byte budget per call. A transcript the
 * budget did not reach is read only at its head and tail, and its token
 * counts are marked incomplete until a later call catches up.
 *
 * Privacy: no prompt or reply text is stored. The title is the host's own
 * generated (or user-set) title, capped and token-masked; remotes lose their
 * userinfo, query and fragment; the resume env carries only the profile
 * directory variable. Output files are owner-only.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { type SessionProfile, iso_now, ttl_seconds_for } from './session_register.js';
import { DEFAULT_EVENT4U_ROOT_RELATIVE, type EnvMap, event4u_root } from './user_global_paths.js';

export const CATALOG_SCHEMA_VERSION = 1;

/** A session with activity within this window is `active`. */
export const ACTIVE_WINDOW_SECONDS = 15 * 60;

/** Transcripts last written longer ago than this are not listed. */
export const RETENTION_DAYS = 30;

/** Transcript bytes a single call parses in full, newest sessions first. */
export const PARSE_BUDGET_BYTES = 256 * 1024 * 1024;

/** Bytes read from each end of a transcript the budget did not reach. */
const PEEK_BYTES = 256 * 1024;

const RECENT_ID_WINDOW = 256;
const MAX_REPOS = 50;
const MAX_BRANCHES_PER_REPO = 20;
const MAX_MODELS = 10;
const TITLE_MAX = 120;
const READ_CHUNK = 32 * 1024 * 1024;

/** Tools whose file argument means the session changed that checkout (reads do not count). */
const WRITE_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export type CatalogStatus = 'active' | 'idle' | 'inactive';
export type CatalogHost = 'claude' | 'codex';

export interface CatalogRepo {
    root: string;
    name: string;
    remote: string | null;
    linked_worktree: boolean;
    branches: string[];
    last_branch: string | null;
}

export interface CatalogUsage {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
    total_tokens: number;
    assistant_messages: number;
}

export interface CatalogResume {
    cwd: string | null;
    /** Executable and arguments, unquoted. */
    argv: string[];
    /** `argv` shell-quoted. */
    command: string;
    /** Only the profile directory variable. */
    env: Record<string, string>;
}

export interface CatalogSession {
    session_id: string;
    host: CatalogHost;
    provider: string;
    surface: string;
    entrypoint: string | null;
    host_version: string | null;
    profile: SessionProfile | null;
    config_dir: string;
    model: string | null;
    models: string[];
    start_cwd: string | null;
    cwd: string | null;
    started_at: string | null;
    last_activity: string;
    status: CatalogStatus;
    /** True while the live session register holds an unexpired record for it. */
    live: boolean;
    idle_seconds: number;
    title: string | null;
    roadmap_slug: string | null;
    repos: CatalogRepo[];
    usage: CatalogUsage | null;
    /** False while part of the transcript has not been parsed yet. */
    usage_complete: boolean;
    context_tokens: number | null;
    context_window: number | null;
    transcript_path: string;
    resume: CatalogResume | null;
}

export interface CatalogIndex {
    schema_version: number;
    generated_at: string;
    active_window_seconds: number;
    retention_days: number;
    counts: Record<CatalogStatus | 'total' | 'live', number>;
    sessions: CatalogSession[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Override for the catalog root; tests and unusual layouts only. */
export const CATALOG_HOME_ENV = 'AGENT_CONFIG_SESSION_CATALOG_HOME';

/**
 * The root deliberately ignores `EVENT4U_CONFIG_HOME`: agent-switch sets that
 * per profile, and a per-profile catalog would defeat the one list across
 * every profile this exists to provide.
 */
export function catalog_root(env: EnvMap = process.env, home: string = os.homedir()): string {
    const override = env[CATALOG_HOME_ENV];
    if (typeof override === 'string' && override.trim() !== '') return path.resolve(override.trim());
    return path.join(home, DEFAULT_EVENT4U_ROOT_RELATIVE);
}

export function index_json_path(env: EnvMap = process.env, home?: string): string {
    return path.join(catalog_root(env, home), 'sessions.json');
}

export function index_md_path(env: EnvMap = process.env, home?: string): string {
    return path.join(catalog_root(env, home), 'SESSIONS.md');
}

function cache_path(env: EnvMap, home?: string): string {
    return path.join(catalog_root(env, home), 'runtime', 'session-catalog-cache.json');
}

/** Where live-register records can be: the machine root and this process's (possibly per-profile) root. */
function live_register_dirs(env: EnvMap, home?: string): string[] {
    const dirs = [path.join(catalog_root(env, home), 'runtime', 'sessions')];
    if (env[CATALOG_HOME_ENV] === undefined) {
        const own = path.join(event4u_root(env), 'runtime', 'sessions');
        if (!dirs.includes(own)) dirs.push(own);
    }
    return dirs;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function ms(stamp: string | null | undefined): number | null {
    if (typeof stamp !== 'string' || stamp === '') return null;
    const v = Date.parse(stamp);
    return Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function num(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

function obj(v: unknown): Record<string, unknown> | null {
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Read a small file without ever blocking: non-blocking open, never through a
 * symlink, the descriptor must be a regular file, and the size is capped.
 * Paths here come from transcript content, so a FIFO or a device must not
 * stall the command.
 */
function read_small(file: string, max = 64 * 1024): string | null {
    let fd: number | null = null;
    try {
        fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0) | (fs.constants.O_NOFOLLOW ?? 0));
        const st = fs.fstatSync(fd);
        if (!st.isFile() || st.size > max) return null;
        const buf = Buffer.alloc(st.size);
        const n = fs.readSync(fd, buf, 0, st.size, 0);
        return buf.subarray(0, n).toString('utf-8');
    } catch {
        return null;
    } finally {
        if (fd !== null) fs.closeSync(fd);
    }
}

/** Remove `user[:pass]@`, the query and the fragment from a URL-shaped remote. */
export function strip_userinfo(url: string): string {
    return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@\s]*@/i, '$1').replace(/[?#].*$/, '');
}

/**
 * Titles are host-generated summaries of the conversation, so they are capped
 * and any token-shaped run (long mixed alphanumerics, known key prefixes) is
 * masked before it is shown.
 */
export function clean_title(t: string): string {
    const masked = t
        .replace(/\b(?:sk|pk|rk|ghp|gho|ghs|ghu|github_pat|xox[abprs]|AKIA|AIza|glpat)[-_A-Za-z0-9]{6,}/g, '[redacted]')
        .replace(/[A-Za-z0-9+/_=-]{20,}/g, (m) => (/[0-9]/.test(m) && /[A-Za-z]/.test(m) ? '[redacted]' : m))
        .replace(/\s+/g, ' ')
        .trim();
    return masked.length > TITLE_MAX ? `${masked.slice(0, TITLE_MAX - 1)}…` : masked;
}

/** Map a host entrypoint / originator to the surface vocabulary. */
export function surface_from_entrypoint(entrypoint: string | null): string {
    const e = (entrypoint ?? '').trim().toLowerCase();
    if (e === '') return 'unknown';
    if (e === 'cli' || e === 'codex_cli_rs') return 'cli';
    if (e.includes('exec') || e.startsWith('sdk')) return 'headless';
    if (e.includes('desktop')) return 'desktop';
    if (e.includes('vscode') || e.includes('jetbrains') || e.includes('ide')) return 'ide';
    if (e.includes('remote') || e.includes('web') || e.includes('cloud')) return 'cloud';
    return e;
}

export const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

function shell_quote(s: string): string {
    return /^[A-Za-z0-9_./:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Resume instruction; null for an id that is not a plain identifier. */
export function build_resume(
    host: CatalogHost,
    session_id: string,
    cwd: string | null,
    config_dir: string,
    default_dir: string,
): CatalogResume | null {
    if (!SESSION_ID_RE.test(session_id)) return null;
    const env: Record<string, string> = {};
    const argv = host === 'claude' ? ['claude', '--resume', session_id] : ['codex', 'resume', session_id];
    if (path.resolve(config_dir) !== path.resolve(default_dir)) {
        env[host === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'] = config_dir;
    }
    return { cwd, argv, command: argv.map(shell_quote).join(' '), env };
}

export function resume_line(r: Pick<CatalogSession, 'resume'>): string | null {
    if (r.resume === null) return null;
    const env = Object.entries(r.resume.env)
        .map(([k, v]) => `${k}=${shell_quote(v)} `)
        .join('');
    const cd = r.resume.cwd === null ? '' : `cd ${shell_quote(r.resume.cwd)} && `;
    return `${cd}${env}${r.resume.command}`;
}

// ---------------------------------------------------------------------------
// Git metadata — read-only, non-blocking, bounded
// ---------------------------------------------------------------------------

/**
 * The checkout's git dir and common dir, following a `.git` pointer file only
 * into the shape git creates for a linked worktree, `<common>/worktrees/<name>`,
 * whose own `gitdir` points back at this checkout and whose common dir is a
 * git directory. Any other pointer is not followed.
 */
function git_dirs(root: string): { git_dir: string; common_dir: string } | null {
    const dot = path.join(root, '.git');
    try {
        const st = fs.lstatSync(dot);
        if (st.isDirectory()) return { git_dir: dot, common_dir: dot };
        if (!st.isFile()) return null;
        const m = (read_small(dot) ?? '').match(/^gitdir:\s*(.+)\s*$/m);
        if (m === null) return null;
        const gd = fs.realpathSync(path.resolve(root, m[1]!.trim()));
        if (path.basename(path.dirname(gd)) !== 'worktrees') return null;
        const back = read_small(path.join(gd, 'gitdir'));
        if (back === null || fs.realpathSync(path.dirname(back.trim())) !== fs.realpathSync(root)) return null;
        const common = path.dirname(path.dirname(gd));
        if (read_small(path.join(common, 'HEAD')) === null || !fs.lstatSync(path.join(common, 'objects')).isDirectory()) return null;
        return { git_dir: gd, common_dir: common };
    } catch {
        return null;
    }
}

function head_branch(git_dir: string): string | null {
    const m = (read_small(path.join(git_dir, 'HEAD')) ?? '').trim().match(/^ref:\s*refs\/heads\/(.+)$/);
    return m === null ? null : m[1]!.trim();
}

function origin_url(common_dir: string): string | null {
    const raw = read_small(path.join(common_dir, 'config'), 4 * 1024 * 1024);
    const m = raw?.match(/\[remote "origin"\][^[]*?\n\s*url\s*=\s*(\S+)/) ?? null;
    return m === null ? null : strip_userinfo(m[1]!.trim());
}

function project_name(remote: string | null, root: string): string {
    if (remote !== null) {
        const tail = remote.replace(/\/+$/, '').split(/[/:]/).pop() ?? '';
        const name = tail.replace(/\.git$/, '');
        if (name !== '') return name;
    }
    return path.basename(root);
}

/** Nearest enclosing checkout root of an existing directory at or above `p`, memoised per call. */
function checkout_root(p: string, cache: Map<string, string | null>): string | null {
    let dir = p;
    for (let i = 0; i < 128; i++) {
        try {
            if (fs.statSync(dir).isDirectory()) break;
        } catch {
            /* not there (any more): walk up */
        }
        const up = path.dirname(dir);
        if (up === dir) return null;
        dir = up;
    }
    const start = dir;
    if (cache.has(start)) return cache.get(start) ?? null;
    let found: string | null = null;
    for (let i = 0; i < 128; i++) {
        if (fs.existsSync(path.join(dir, '.git'))) {
            found = dir;
            break;
        }
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    cache.set(start, found);
    return found;
}

// ---------------------------------------------------------------------------
// Sources — profile directories of each host
// ---------------------------------------------------------------------------

export interface Source {
    host: CatalogHost;
    config_dir: string;
    profile: SessionProfile | null;
    /** The host's default config dir, against which a resume needs no env. */
    default_dir: string;
}

/** Every Claude Code and Codex profile directory this machine has. */
export function discover_sources(env: EnvMap = process.env, home: string = os.homedir()): Source[] {
    const out: Source[] = [];
    const seen = new Set<string>();
    const add = (host: CatalogHost, dir: string, profile: SessionProfile | null): void => {
        let real: string;
        try {
            real = fs.realpathSync(dir);
            if (!fs.statSync(real).isDirectory()) return;
        } catch {
            return;
        }
        if (seen.has(`${host}:${real}`)) return;
        seen.add(`${host}:${real}`);
        out.push({ host, config_dir: real, profile, default_dir: path.join(home, host === 'claude' ? '.claude' : '.codex') });
    };
    const as_root = str(env['AGENT_SWITCH_HOME']) ?? path.join(home, '.agent-switch');
    for (const host of ['claude', 'codex'] as const) {
        for (const name of list_dir(path.join(as_root, host)).sort()) {
            add(host, path.join(as_root, host, name, 'config'), { provider: host, name, via: 'agent-switch' });
        }
    }
    const claude_env = str(env['CLAUDE_CONFIG_DIR']);
    if (claude_env !== null) add('claude', claude_env, { provider: 'claude', name: path.basename(path.resolve(claude_env)), via: 'env' });
    add('claude', path.join(home, '.claude'), { provider: 'claude', name: 'default', via: 'env' });
    const codex_env = str(env['CODEX_HOME']);
    if (codex_env !== null) add('codex', codex_env, { provider: 'codex', name: path.basename(path.resolve(codex_env)), via: 'env' });
    add('codex', path.join(home, '.codex'), { provider: 'codex', name: 'default', via: 'env' });
    return out;
}

export interface TranscriptFile {
    source: Source;
    file: string;
    session_id: string;
    size: number;
    mtime_ms: number;
    ino: number;
    dev: number;
}

function list_dir(dir: string): string[] {
    try {
        return fs.readdirSync(dir);
    } catch {
        return [];
    }
}

const CODEX_FILE_RE = /^rollout-.+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/;

/** Transcripts written within the retention window, newest first. Symlinks and non-files are skipped. */
export function list_transcripts(sources: Source[], now: Date = new Date()): TranscriptFile[] {
    const cutoff = now.getTime() - RETENTION_DAYS * 86_400_000;
    const out: TranscriptFile[] = [];
    const push = (source: Source, file: string, session_id: string): void => {
        let st: fs.Stats;
        try {
            st = fs.lstatSync(file);
        } catch {
            return;
        }
        if (!st.isFile() || st.mtimeMs < cutoff || !SESSION_ID_RE.test(session_id)) return;
        out.push({ source, file, session_id, size: st.size, mtime_ms: st.mtimeMs, ino: st.ino, dev: st.dev });
    };
    for (const source of sources) {
        if (source.host === 'claude') {
            const projects = path.join(source.config_dir, 'projects');
            for (const project of list_dir(projects)) {
                for (const name of list_dir(path.join(projects, project))) {
                    if (name.endsWith('.jsonl')) push(source, path.join(projects, project, name), name.slice(0, -'.jsonl'.length));
                }
            }
            continue;
        }
        const sessions = path.join(source.config_dir, 'sessions');
        for (const y of list_dir(sessions)) {
            for (const m of list_dir(path.join(sessions, y))) {
                for (const d of list_dir(path.join(sessions, y, m))) {
                    const day = path.join(sessions, y, m, d);
                    for (const name of list_dir(day)) {
                        const id = CODEX_FILE_RE.exec(name);
                        if (id !== null) push(source, path.join(day, name), id[1]!);
                    }
                }
            }
        }
    }
    return out.sort((a, b) => b.mtime_ms - a.mtime_ms);
}

// ---------------------------------------------------------------------------
// Parsing — incremental, from a cache keyed by file identity
// ---------------------------------------------------------------------------

/** What a transcript's lines add up to; everything the catalog shows except git state. */
export interface ParsedState {
    offset: number;
    ino: number;
    dev: number;
    recent_ids: string[];
    first_cwd: string | null;
    cwd: string | null;
    started_at: string | null;
    entrypoint: string | null;
    host_version: string | null;
    model: string | null;
    models: string[];
    title: string | null;
    title_custom: boolean;
    usage: CatalogUsage | null;
    context_tokens: number | null;
    context_window: number | null;
    /** Directories the session worked in or wrote to, oldest first. */
    paths: string[];
    /** Branches the host reported while the session was in its start directory. */
    start_branches: string[];
}

function fresh_state(t: TranscriptFile): ParsedState {
    return {
        offset: 0,
        ino: t.ino,
        dev: t.dev,
        recent_ids: [],
        first_cwd: null,
        cwd: null,
        started_at: null,
        entrypoint: null,
        host_version: null,
        model: null,
        models: [],
        title: null,
        title_custom: false,
        usage: null,
        context_tokens: null,
        context_window: null,
        paths: [],
        start_branches: [],
    };
}

function clone_state(st: ParsedState): ParsedState {
    return JSON.parse(JSON.stringify(st)) as ParsedState;
}

function note_path(st: ParsedState, p: string | null): void {
    if (p === null || !path.isAbsolute(p)) return;
    const i = st.paths.indexOf(p);
    if (i >= 0) st.paths.splice(i, 1);
    st.paths.push(p);
    if (st.paths.length > MAX_REPOS * 4) st.paths.shift();
}

function note_model(st: ParsedState, model: string | null): void {
    if (model === null || model.startsWith('<')) return;
    st.model = model;
    if (!st.models.includes(model)) {
        st.models.push(model);
        if (st.models.length > MAX_MODELS) st.models.shift();
    }
}

function note_cwd(st: ParsedState, cwd: string | null): void {
    if (cwd === null) return;
    if (st.first_cwd === null) st.first_cwd = cwd;
    st.cwd = cwd;
    note_path(st, cwd);
}

function empty_usage(): CatalogUsage {
    return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_tokens: 0, assistant_messages: 0 };
}

function apply_claude_line(st: ParsedState, o: Record<string, unknown>, count_usage: boolean): void {
    const type = str(o['type']);
    if (type === 'custom-title') {
        const t = str(o['customTitle']);
        if (t !== null) {
            st.title = clean_title(t);
            st.title_custom = true;
        }
    }
    if (type === 'ai-title' && !st.title_custom) {
        const t = str(o['aiTitle']);
        if (t !== null) st.title = clean_title(t);
    }
    if (type === 'summary' && st.title === null) {
        const t = str(o['summary']);
        if (t !== null) st.title = clean_title(t);
    }
    st.entrypoint = str(o['entrypoint']) ?? st.entrypoint;
    st.host_version = str(o['version']) ?? st.host_version;
    const stamp = str(o['timestamp']);
    if (st.started_at === null && stamp !== null && ms(stamp) !== null) st.started_at = stamp;
    const line_cwd = str(o['cwd']);
    note_cwd(st, line_cwd);
    // The host's branch field is trustworthy only for the start directory: it
    // keeps reporting that branch after the session moves into a worktree.
    const branch = str(o['gitBranch']);
    if (branch !== null && branch !== 'HEAD' && line_cwd !== null && line_cwd === st.first_cwd && !st.start_branches.includes(branch)) {
        st.start_branches.push(branch);
        if (st.start_branches.length > MAX_BRANCHES_PER_REPO) st.start_branches.shift();
    }
    if (type !== 'assistant') return;
    const m = obj(o['message']);
    if (m === null) return;
    note_model(st, str(m['model']));
    const content = m['content'];
    if (Array.isArray(content)) {
        for (const block of content) {
            const b = obj(block);
            if (b === null || b['type'] !== 'tool_use' || !WRITE_TOOLS.has(String(b['name']))) continue;
            const input = obj(b['input']);
            for (const key of ['file_path', 'notebook_path']) {
                const fp = str(input?.[key]);
                if (fp === null) continue;
                const abs = path.isAbsolute(fp) ? fp : line_cwd !== null ? path.resolve(line_cwd, fp) : null;
                if (abs !== null) note_path(st, path.dirname(abs));
            }
        }
    }
    const u = obj(m['usage']);
    if (u === null) return;
    const in_t = num(u['input_tokens']);
    const cache_r = num(u['cache_read_input_tokens']);
    const cache_c = num(u['cache_creation_input_tokens']);
    if (o['isSidechain'] !== true) st.context_tokens = in_t + cache_r + cache_c;
    if (!count_usage) return;
    // A message is written once per content block, each repeating its usage.
    const id = str(m['id']);
    if (id !== null) {
        if (st.recent_ids.includes(id)) return;
        st.recent_ids.push(id);
        if (st.recent_ids.length > RECENT_ID_WINDOW) st.recent_ids.shift();
    }
    const usage = st.usage ?? empty_usage();
    const out_t = num(u['output_tokens']);
    usage.input_tokens += in_t;
    usage.output_tokens += out_t;
    usage.cache_read_input_tokens += cache_r;
    usage.cache_creation_input_tokens += cache_c;
    usage.total_tokens += in_t + out_t + cache_r + cache_c;
    usage.assistant_messages += 1;
    st.usage = usage;
}

function apply_codex_line(st: ParsedState, o: Record<string, unknown>): void {
    const type = str(o['type']);
    const p = obj(o['payload']);
    if (p === null) return;
    if (type === 'session_meta') {
        st.started_at = str(p['timestamp']) ?? st.started_at;
        st.host_version = str(p['cli_version']) ?? st.host_version;
        st.entrypoint = str(p['originator']) ?? str(p['source']) ?? st.entrypoint;
        note_cwd(st, str(p['cwd']));
        const b = str(obj(p['git'])?.['branch']);
        if (b !== null && !st.start_branches.includes(b)) st.start_branches.push(b);
    }
    if (type === 'turn_context') {
        note_model(st, str(p['model']));
        note_cwd(st, str(p['cwd']));
    }
    if (type === 'event_msg' && p['type'] === 'token_count') {
        const info = obj(p['info']);
        const total = obj(info?.['total_token_usage']);
        const last = obj(info?.['last_token_usage']);
        if (total !== null) {
            // Codex reports cumulative totals, so the latest line is the answer.
            const cached = num(total['cached_input_tokens']);
            st.usage = {
                input_tokens: Math.max(0, num(total['input_tokens']) - cached),
                output_tokens: num(total['output_tokens']),
                cache_read_input_tokens: cached,
                cache_creation_input_tokens: num(total['cache_write_input_tokens']),
                total_tokens: num(total['total_tokens']),
                assistant_messages: (st.usage?.assistant_messages ?? 0) + 1,
            };
        }
        if (last !== null && num(last['input_tokens']) > 0) st.context_tokens = num(last['input_tokens']);
        const window = num(info?.['model_context_window']);
        if (window > 0) st.context_window = window;
    }
}

function apply_lines(host: CatalogHost, st: ParsedState, text: string, count_usage: boolean): void {
    for (const line of text.split('\n')) {
        if (line === '' || line[0] !== '{') continue;
        let o: Record<string, unknown> | null;
        try {
            o = obj(JSON.parse(line));
        } catch {
            continue;
        }
        if (o === null) continue;
        if (host === 'claude') apply_claude_line(st, o, count_usage);
        else apply_codex_line(st, o);
    }
}

/** Open without blocking or following a final symlink; the descriptor must be the listed regular file. */
function open_transcript(t: TranscriptFile): number | null {
    let fd: number | null = null;
    try {
        fd = fs.openSync(t.file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0) | (fs.constants.O_NOFOLLOW ?? 0));
        const st = fs.fstatSync(fd);
        if (st.isFile() && st.ino === t.ino && st.dev === t.dev) return fd;
        fs.closeSync(fd);
        return null;
    } catch {
        if (fd !== null) fs.closeSync(fd);
        return null;
    }
}

/**
 * Parse `t` from its cached state forward, consuming at most `budget.bytes`.
 * Only complete lines are consumed; a cached state for another file (new
 * inode) or a shorter file starts over.
 */
export function parse_incremental(t: TranscriptFile, cached: ParsedState | null, budget: { bytes: number }): ParsedState {
    const st = cached !== null && cached.ino === t.ino && cached.dev === t.dev && cached.offset <= t.size ? clone_state(cached) : fresh_state(t);
    if (st.offset >= t.size || budget.bytes <= 0) return st;
    const fd = open_transcript(t);
    if (fd === null) return st;
    try {
        while (st.offset < t.size && budget.bytes > 0) {
            const len = Math.min(t.size - st.offset, budget.bytes, READ_CHUNK);
            const buf = Buffer.alloc(len);
            const n = fs.readSync(fd, buf, 0, len, st.offset);
            budget.bytes -= n;
            if (n === 0) break;
            const nl = buf.lastIndexOf(0x0a, n - 1);
            if (nl < 0) {
                // A single line longer than one read cannot be completed; skip it whole.
                if (n === READ_CHUNK) st.offset += n;
                break;
            }
            apply_lines(t.source.host, st, buf.subarray(0, nl + 1).toString('utf-8'), true);
            st.offset += nl + 1;
        }
    } catch {
        return cached !== null ? clone_state(cached) : fresh_state(t);
    } finally {
        fs.closeSync(fd);
    }
    return st;
}

/** Head and tail of a transcript the budget did not reach: metadata, title, model, context. */
export function peek(t: TranscriptFile, st: ParsedState): ParsedState {
    const out = clone_state(st);
    const fd = open_transcript(t);
    if (fd === null) return out;
    try {
        const read_at = (pos: number, len: number): string => {
            const buf = Buffer.alloc(len);
            const n = fs.readSync(fd, buf, 0, len, pos);
            return buf.subarray(0, n).toString('utf-8');
        };
        if (out.offset === 0) {
            const head = read_at(0, Math.min(PEEK_BYTES, t.size));
            apply_lines(t.source.host, out, head.slice(0, head.lastIndexOf('\n') + 1), false);
        }
        const from = Math.max(out.offset, t.size - PEEK_BYTES);
        if (from < t.size) {
            const tail = read_at(from, t.size - from);
            const start = from === out.offset ? 0 : tail.indexOf('\n') + 1;
            apply_lines(t.source.host, out, tail.slice(start, tail.lastIndexOf('\n') + 1), false);
        }
    } catch {
        /* keep what we have */
    } finally {
        fs.closeSync(fd);
    }
    return out;
}

interface Cache {
    schema_version: number;
    files: Record<string, ParsedState>;
    /** Head/tail reads of transcripts not fully parsed yet, valid while size and inode are unchanged. */
    peeks?: Record<string, { size: number; ino: number; offset: number; state: ParsedState }>;
}

function read_cache(file: string): Cache {
    try {
        const parsed = obj(JSON.parse(read_small(file, 512 * 1024 * 1024) ?? 'null'));
        if (parsed !== null && parsed['schema_version'] === CATALOG_SCHEMA_VERSION && obj(parsed['files']) !== null) {
            return parsed as unknown as Cache;
        }
    } catch {
        /* a broken cache only costs a re-parse */
    }
    return { schema_version: CATALOG_SCHEMA_VERSION, files: {} };
}

/** Atomic replace into an owner-only directory; the temp file is created 0600. */
function write_private(file: string, data: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    write_atomic(file, data);
}

// ---------------------------------------------------------------------------
// Liveness — the live register the session-register hook already keeps
// ---------------------------------------------------------------------------

interface LiveRecord {
    last_seen: number;
    roadmap_slug: string | null;
}

function read_live(dirs: string[], now: Date): Map<string, LiveRecord> {
    const out = new Map<string, LiveRecord>();
    for (const dir of dirs) for (const name of list_dir(dir)) {
        if (!name.endsWith('.json')) continue;
        let o: Record<string, unknown> | null = null;
        try {
            o = obj(JSON.parse(read_small(path.join(dir, name)) ?? 'null'));
        } catch {
            continue;
        }
        const id = str(o?.['session_id']);
        const seen = ms(str(o?.['last_seen']));
        const platform = str(o?.['platform']) ?? 'generic';
        if (id === null || seen === null) continue;
        if ((now.getTime() - seen) / 1000 > ttl_seconds_for(platform)) continue;
        const prev = out.get(id);
        if (prev === undefined || prev.last_seen < seen) out.set(id, { last_seen: seen, roadmap_slug: str(o?.['roadmap_slug']) });
    }
    return out;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export interface BuildOptions {
    env?: EnvMap;
    home?: string;
    now?: Date;
    budget_bytes?: number;
}

function repos_for(st: ParsedState, git_cache: Map<string, string | null>): CatalogRepo[] {
    const roots: string[] = [];
    for (const p of [...st.paths].reverse()) {
        const root = checkout_root(p, git_cache);
        if (root !== null && !roots.includes(root)) roots.push(root);
        if (roots.length >= MAX_REPOS) break;
    }
    const start_root = st.first_cwd === null ? null : checkout_root(st.first_cwd, git_cache);
    return roots.map((root) => {
        const dirs = git_dirs(root);
        const remote = dirs === null ? null : origin_url(dirs.common_dir);
        const current = dirs === null ? null : head_branch(dirs.git_dir);
        const branches = root === start_root ? [...st.start_branches] : [];
        if (current !== null && !branches.includes(current)) branches.push(current);
        let linked = false;
        try {
            linked = fs.lstatSync(path.join(root, '.git')).isFile();
        } catch {
            /* the .git entry is gone */
        }
        return {
            root,
            name: project_name(remote, root),
            remote,
            linked_worktree: linked,
            branches: branches.slice(-MAX_BRANCHES_PER_REPO),
            last_branch: current ?? branches[branches.length - 1] ?? null,
        };
    });
}

/** Build the catalog from every transcript in every profile. */
export function build_index(options: BuildOptions = {}): CatalogIndex {
    const env = options.env ?? process.env;
    const now = options.now ?? new Date();
    const home = options.home ?? os.homedir();
    const cfile = cache_path(env, home);
    const cache = read_cache(cfile);
    const next: Cache = { schema_version: CATALOG_SCHEMA_VERSION, files: {}, peeks: {} };
    const budget = { bytes: options.budget_bytes ?? PARSE_BUDGET_BYTES };
    const live = read_live(live_register_dirs(env, home), now);
    const git_cache = new Map<string, string | null>();
    const sessions: CatalogSession[] = [];

    for (const t of list_transcripts(discover_sources(env, home), now)) {
        const parsed = parse_incremental(t, cache.files[t.file] ?? null, budget);
        next.files[t.file] = parsed;
        const complete = parsed.offset >= t.size;
        let st = parsed;
        if (!complete) {
            const prior = cache.peeks?.[t.file];
            st = prior !== undefined && prior.size === t.size && prior.ino === t.ino && prior.offset === parsed.offset ? prior.state : peek(t, parsed);
            next.peeks![t.file] = { size: t.size, ino: t.ino, offset: parsed.offset, state: st };
        }
        const rec = live.get(t.session_id) ?? null;
        const activity = Math.max(t.mtime_ms, rec?.last_seen ?? 0);
        const idle = Math.max(0, Math.round((now.getTime() - activity) / 1000));
        const status: CatalogStatus = idle <= ACTIVE_WINDOW_SECONDS ? 'active' : rec !== null ? 'idle' : 'inactive';
        const host = t.source.host;
        sessions.push({
            session_id: t.session_id,
            host,
            provider: host === 'claude' ? 'anthropic' : 'openai',
            surface: surface_from_entrypoint(st.entrypoint),
            entrypoint: st.entrypoint,
            host_version: st.host_version,
            profile: t.source.profile,
            config_dir: t.source.config_dir,
            model: st.model,
            models: [...st.models],
            start_cwd: st.first_cwd,
            cwd: st.cwd,
            started_at: st.started_at,
            last_activity: iso_now(new Date(activity)),
            status,
            live: rec !== null,
            idle_seconds: idle,
            title: st.title,
            roadmap_slug: rec?.roadmap_slug ?? null,
            repos: repos_for(st, git_cache),
            usage: st.usage,
            usage_complete: complete || host === 'codex',
            context_tokens: st.context_tokens,
            context_window: st.context_window,
            transcript_path: t.file,
            resume: build_resume(host, t.session_id, st.first_cwd, t.source.config_dir, t.source.default_dir),
        });
    }
    try {
        write_private(cfile, JSON.stringify(next));
    } catch {
        /* the cache is an optimisation */
    }
    const counts: CatalogIndex['counts'] = { active: 0, idle: 0, inactive: 0, live: 0, total: sessions.length };
    for (const s of sessions) {
        counts[s.status] += 1;
        if (s.live) counts.live += 1;
    }
    return {
        schema_version: CATALOG_SCHEMA_VERSION,
        generated_at: iso_now(now),
        active_window_seconds: ACTIVE_WINDOW_SECONDS,
        retention_days: RETENTION_DAYS,
        counts,
        sessions,
    };
}

/** Build and write `sessions.json` + `SESSIONS.md`; the view first, the index last. */
export function publish_index(options: BuildOptions = {}): CatalogIndex {
    const env = options.env ?? process.env;
    const index = build_index(options);
    write_private(index_md_path(env, options.home), render_markdown(index));
    write_private(index_json_path(env, options.home), `${JSON.stringify(index, null, 2)}\n`);
    return index;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function fmt_tokens(n: number | null | undefined): string {
    if (n === null || n === undefined || n <= 0) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
}

export function fmt_age(seconds: number): string {
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
    return `${Math.round(seconds / 86_400)} d`;
}

/** Text that cannot open Markdown structure: inline-syntax characters escaped, one line. */
export function md_text(s: string | null | undefined): string {
    const t = (s ?? '—').replace(/\s+/g, ' ').trim();
    return t === '' ? '—' : t.replace(/[\\`*_[\]{}()<>#+!|~-]/g, (c) => `\\${c}`);
}

/** An inline code span whose fence is longer than any backtick run inside; inner spaces kept. */
export function md_code(s: string | null | undefined): string {
    const t = (s ?? '—').replace(/[\r\n]+/g, ' ');
    const longest = Math.max(0, ...(t.match(/`+/g) ?? []).map((m) => m.length));
    const fence = '`'.repeat(longest + 1);
    return `${fence} ${t} ${fence}`;
}

/** `name@branch`, with the worktree directory named when it is a linked worktree. */
export function repo_label(x: CatalogRepo): string {
    const wt = x.linked_worktree ? ` [${path.basename(x.root)}]` : '';
    return `${x.name}${wt}@${x.last_branch ?? '?'}`;
}

function profile_label(p: SessionProfile | null): string {
    return p === null ? '—' : `${p.provider}/${p.name}`;
}

export function context_label(s: Pick<CatalogSession, 'context_tokens' | 'context_window'>): string {
    if (s.context_tokens === null) return '—';
    return s.context_window === null ? fmt_tokens(s.context_tokens) : `${fmt_tokens(s.context_tokens)}/${fmt_tokens(s.context_window)}`;
}

/** Human view. Never parsed back — `sessions.json` is the machine form. */
export function render_markdown(index: CatalogIndex, detail_rows = 25): string {
    const c = index.counts;
    const lines: string[] = [
        '# Agent sessions',
        '',
        `> Generated ${index.generated_at} by \`agent-config sessions:catalog\` — do not edit; rerun it to refresh.`,
        `> Machine-readable form: \`sessions.json\` (schema v${index.schema_version}). ` +
            `${c.total} sessions · ${c.active} active · ${c.idle} idle · ${c.inactive} inactive · ${c.live} live ` +
            `(transcripts of the last ${index.retention_days} days).`,
        '',
        '| Status | Last activity | Host · surface | Profile | Model | Title | Repos @ branch | Tokens | Context | Session |',
        '|---|---|---|---|---|---|---|---|---|---|',
    ];
    for (const s of index.sessions) {
        const repos = s.repos.slice(0, 3).map(repo_label).join(', ') + (s.repos.length > 3 ? `, +${s.repos.length - 3}` : '');
        const tokens = `${fmt_tokens(s.usage?.total_tokens)}${s.usage_complete ? '' : '+'}`;
        lines.push(
            `| ${s.status}${s.live ? ' (live)' : ''} | ${fmt_age(s.idle_seconds)} | ${md_text(`${s.host} · ${s.surface}`)} | ` +
                `${md_text(profile_label(s.profile))} | ${md_text(s.model)} | ${md_text(s.title)} | ${md_text(repos || '—')} | ` +
                `${md_text(tokens)} | ${md_text(context_label(s))} | ${md_code(s.session_id)} |`,
        );
    }
    lines.push('', '`+` after a token count: the transcript is not fully counted yet; the next run continues.', '', '## Details', '');
    for (const s of index.sessions.slice(0, detail_rows)) {
        lines.push(`### ${md_text(s.title ?? s.session_id)}`, '');
        lines.push(
            `- **Session:** ${md_code(s.session_id)} · ${s.status}${s.live ? ' · live' : ''} · last activity ${md_text(s.last_activity)}` +
                (s.started_at !== null ? ` · started ${md_text(s.started_at)}` : ''),
        );
        lines.push(
            `- **Host:** ${md_text(s.host)}${s.host_version !== null ? ` ${md_text(s.host_version)}` : ''} · surface ${md_text(s.surface)}` +
                ` · provider ${md_text(s.provider)} · profile ${md_text(profile_label(s.profile))}`,
        );
        lines.push(`- **Model:** ${md_text(s.model)}${s.models.length > 1 ? ` (also: ${md_text(s.models.filter((m) => m !== s.model).join(', '))})` : ''}`);
        if (s.usage !== null) {
            lines.push(
                `- **Tokens:** ${fmt_tokens(s.usage.total_tokens)} total${s.usage_complete ? '' : ' so far'} · in ${fmt_tokens(s.usage.input_tokens)} · ` +
                    `out ${fmt_tokens(s.usage.output_tokens)} · cache read ${fmt_tokens(s.usage.cache_read_input_tokens)} · ` +
                    `cache write ${fmt_tokens(s.usage.cache_creation_input_tokens)} · context ${md_text(context_label(s))}`,
            );
        }
        lines.push(`- **Started in:** ${md_code(s.start_cwd)}`);
        if (s.roadmap_slug !== null) lines.push(`- **Roadmap:** ${md_text(s.roadmap_slug)}`);
        for (const repo of s.repos) {
            lines.push(
                `- **Repo** ${md_text(repo_label(repo))}${repo.remote !== null ? ` (${md_code(repo.remote)})` : ''}: ${md_code(repo.root)} — branches ${repo.branches.map((b) => md_code(b)).join(', ') || '—'}`,
            );
        }
        const resume = resume_line(s);
        if (resume !== null) lines.push(`- **Resume:** ${md_code(resume)}`);
        lines.push('');
    }
    if (index.sessions.length > detail_rows) {
        lines.push(`_${index.sessions.length - detail_rows} older sessions: see \`sessions.json\` or \`agent-config sessions:catalog --all\`._`, '');
    }
    return lines.join('\n');
}
