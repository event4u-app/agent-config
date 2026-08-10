/**
 * Session enumeration for `agent-config handoff` (road-to-agent-handoff-
 * resume Phase 1). Pure library — no CLI entry, no prompts, no writes.
 *
 * Sources, merged newest-first into one list:
 *   - `chat-history`     — the cross-host JSONL log (primary; works for
 *     every hook-capable host). Reuses `chat_history.list_sessions()`.
 *   - `claude-transcript` — native Claude Code transcripts under
 *     `~/.claude/projects/<slug>/*.jsonl` (fallback for sessions the log
 *     missed; slug = cwd with `/` and `.` mapped to `-`).
 *   - `codex-session`    — `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
 *     (Codex's ONLY source — a bundle host without hooks never writes
 *     chat-history). Format verified 2026-08-04 against the live store:
 *     line 0 is `{type:'session_meta', payload:{id, timestamp, cwd,
 *     git:{branch}}}`; user prompts arrive as `event_msg` records with
 *     `payload:{type:'user_message', message}` (fixture:
 *     tests/scripts/fixtures/handoff/codex-session.jsonl).
 *
 * De-dup: native-store sessions whose platform id maps (via
 * `derive_session_tag`) to a chat-history bucket are dropped — the
 * chat-history entry wins.
 *
 * Two exclusions then apply to the merged list (road-to-cost-parity-3
 * Phase 1): the ISSUING session, by exact id and never heuristically, and
 * every candidate holding nothing worth resuming (`is_substantive`). Both
 * fail OPEN — an unknown lists.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { derive_session_tag, list_sessions, read_entries } from '../chat_history.js';
import { eolSessionKey, readEolCounters, type StoredEolCounters } from '../_lib/session_eol.js';

export const DEFAULT_CAP = 15;
/**
 * Per-source over-fetch factor. The exclusions run after the per-source cap,
 * so fetching exactly `cap` lets a filtered candidate consume a slot no
 * eligible session can reclaim. 3× is a backfill margin, not a measurement:
 * on the observed store 10 of 217 sessions are filtered (~5%), so 3× covers
 * that comfortably while keeping the per-file scan bounded.
 */
const FETCH_OVERSHOOT = 3;
const SUMMARY_SNIPPET_CHARS = 120;

/**
 * Committed substantive-content floor, in parsed transcript tokens (billable
 * input of the last main-chain assistant record, per `cc_transcript.ts`) — the
 * OR-arm for a session that produced real discussion without ever calling a
 * tool.
 *
 * Derivation (`agents/evidence/analysis/handoff-substantive-threshold.md`,
 * 217 sessions of the local Claude store, 2026-08-10): 206 of the 207 sessions
 * carrying an assistant record also carry a `tool_use` block, so this arm
 * serves the ~0.5 % tail and the hosts whose transcripts log no tool blocks at
 * all. 10 000 sits **25× below** the p10 of real working sessions (254 939),
 * so it cannot hide one, and above a single trivial exchange. Changing it is a
 * PR citing evidence, never a drive-by edit.
 */
export const SUBSTANTIVE_TOKEN_FLOOR = 10_000;

export type HandoffSource = 'chat-history' | 'claude-transcript' | 'codex-session';

export interface HandoffSession {
    id: string;
    source: HandoffSource;
    startedAt: string | null;
    endedAt: string | null;
    branch?: string;
    entryCount: number;
    summary: string;
    /** Absolute transcript path — set for the native-store sources. */
    transcriptPath?: string;
}

export interface ListOptions {
    /** Repo root the sessions must belong to. Default: process.cwd(). */
    cwd?: string;
    /** Chat-history JSONL override (else AGENT_CHAT_HISTORY_FILE / default). */
    chatHistoryPath?: string | null;
    /** Claude Code projects root. Default: ~/.claude/projects. */
    claudeProjectsRoot?: string;
    /** Codex sessions root. Default: ~/.codex/sessions. */
    codexSessionsRoot?: string;
    /** Max sessions per source AND in the merged result. Default 15. */
    cap?: number;
    /**
     * The ISSUING session's id — excluded from the result unconditionally.
     *
     * Default: `AGENT_SESSION_ID` (this package's own envelope convention),
     * else `CLAUDE_CODE_SESSION_ID`. The second name is **measured, not
     * guessed**: a live Claude Code session (host 2026-08-10) exports
     * `CLAUDE_CODE_SESSION_ID` into every Bash tool call and its value is the
     * session uuid that also names the transcript file — a plausible-looking
     * `CLAUDE_SESSION_ID` is not exported and would leave this filter inert.
     *
     * Pass `null` to disable (a caller that genuinely is not a session).
     */
    selfSessionId?: string | null;
    /** Workspace root holding `agents/runtime/state/session-eol/`. Default: `cwd`. */
    workspaceRoot?: string;
}

/** Mirrors the Claude Code project-dir naming: `/` and `.` → `-`. */
export function encode_project_path(cwd: string): string {
    return cwd.replace(/[/.]/g, '-');
}

function _snippet(text: string, max: number = SUMMARY_SNIPPET_CHARS): string {
    const oneLine = text.replace(/\s+/g, ' ').trim();
    return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 1) + '…';
}

/** first-prompt → last-prompt summary (Step 3 contract). */
function _summarize(first: string | null, last: string | null): string {
    const a = first ? _snippet(first) : '';
    const b = last ? _snippet(last) : '';
    if (a && b && a !== b) return `${a} → ${b}`;
    return a || b || '(no user prompts)';
}

function _read_lines(file: string): string[] {
    try {
        return fs.readFileSync(file, 'utf-8').split('\n');
    } catch {
        return [];
    }
}

function _parse_json(line: string): Record<string, unknown> | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // fail-open — skip malformed lines
    }
    return null;
}

// ---------------------------------------------------------------------
// chat-history (primary)
// ---------------------------------------------------------------------

const CHAT_HISTORY_REL = path.join('agents', 'runtime', '.agent-chat-history');

/** Explicit option > AGENT_CHAT_HISTORY_FILE env > repo-root-relative default. */
function _chat_history_path(opts: ListOptions): string {
    if (opts.chatHistoryPath) return opts.chatHistoryPath;
    return (
        process.env.AGENT_CHAT_HISTORY_FILE ||
        path.join(opts.cwd ?? process.cwd(), CHAT_HISTORY_REL)
    );
}

/**
 * Real-prompt summaries per session: hosts log system/task notifications as
 * `t:'user'` entries, so the raw bucket summary can read like
 * `<task-notification>…` — filtered here (council review 2026-08-04,
 * claude-sonnet-4-5 + gpt-4o: picker noise is a UX defect; the log itself
 * stays unfiltered).
 */
function _chat_history_summaries(histPath: string): Map<string, { first: string | null; last: string | null }> {
    const bySession = new Map<string, { first: string | null; last: string | null }>();
    let entries: Array<Record<string, unknown>>;
    try {
        entries = read_entries({ path: histPath, last: null });
    } catch {
        return bySession;
    }
    for (const e of entries) {
        if (e.t !== 'user' || typeof e.text !== 'string') continue;
        const text = e.text.trim();
        if (!text || text.startsWith('<') || text.startsWith('Caveat:')) continue;
        const sid = String(e.s ?? '<legacy>');
        const slot = bySession.get(sid) ?? { first: null, last: null };
        if (!slot.first) slot.first = text;
        slot.last = text;
        bySession.set(sid, slot);
    }
    return bySession;
}

function _chat_history_sessions(opts: ListOptions): HandoffSession[] {
    const histPath = _chat_history_path(opts);
    let buckets: Array<Record<string, unknown>>;
    try {
        buckets = list_sessions({ path: histPath, summary: true });
    } catch {
        return [];
    }
    const summaries = _chat_history_summaries(histPath);
    return buckets
        .filter((b) => Number(b.count ?? 0) > 0)
        .map((b) => {
            const id = String(b.id ?? '');
            const prompts = summaries.get(id);
            const summary = prompts
                ? _summarize(prompts.first, prompts.last)
                : '(no user prompts)';
            return {
                id,
                source: 'chat-history' as const,
                startedAt: b.first_ts ? String(b.first_ts) : null,
                endedAt: b.last_ts ? String(b.last_ts) : null,
                entryCount: Number(b.count ?? 0),
                summary,
            };
        });
}

// ---------------------------------------------------------------------
// claude-transcript (native fallback)
// ---------------------------------------------------------------------

interface TranscriptScan {
    entryCount: number;
    firstTs: string | null;
    lastTs: string | null;
    branch: string | null;
    firstPrompt: string | null;
    lastPrompt: string | null;
}

/** A real prompt has string content; tool_results arrive as block lists. */
function _cc_prompt_text(rec: Record<string, unknown>): string | null {
    if (rec.type !== 'user' || rec.isSidechain === true) return null;
    const msg = rec.message;
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
    const content = (msg as Record<string, unknown>).content;
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    // skip host-injected meta blocks (caveats, command wrappers)
    if (!trimmed || trimmed.startsWith('<') || trimmed.startsWith('Caveat:')) return null;
    return trimmed;
}

function _scan_claude_transcript(file: string): TranscriptScan {
    const scan: TranscriptScan = {
        entryCount: 0,
        firstTs: null,
        lastTs: null,
        branch: null,
        firstPrompt: null,
        lastPrompt: null,
    };
    for (const line of _read_lines(file)) {
        const rec = _parse_json(line);
        if (!rec) continue;
        scan.entryCount += 1;
        const ts = typeof rec.timestamp === 'string' ? rec.timestamp : null;
        if (ts) {
            if (!scan.firstTs) scan.firstTs = ts;
            scan.lastTs = ts;
        }
        if (!scan.branch && typeof rec.gitBranch === 'string' && rec.gitBranch) {
            scan.branch = rec.gitBranch;
        }
        const prompt = _cc_prompt_text(rec);
        if (prompt) {
            if (!scan.firstPrompt) scan.firstPrompt = prompt;
            scan.lastPrompt = prompt;
        }
    }
    return scan;
}

function _claude_transcript_sessions(opts: ListOptions, cap: number): HandoffSession[] {
    const root = opts.claudeProjectsRoot ?? path.join(os.homedir(), '.claude', 'projects');
    const cwd = opts.cwd ?? process.cwd();
    const projectDir = path.join(root, encode_project_path(cwd));
    let names: string[];
    try {
        names = fs.readdirSync(projectDir).filter((n) => n.endsWith('.jsonl'));
    } catch {
        return [];
    }
    const files = names
        .map((n) => {
            const full = path.join(projectDir, n);
            try {
                return { full, id: path.basename(n, '.jsonl'), mtime: fs.statSync(full).mtimeMs };
            } catch {
                return null;
            }
        })
        .filter((f): f is { full: string; id: string; mtime: number } => f !== null)
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, cap);

    const sessions: HandoffSession[] = [];
    for (const f of files) {
        const scan = _scan_claude_transcript(f.full);
        if (scan.entryCount === 0) continue;
        sessions.push({
            id: f.id,
            source: 'claude-transcript',
            startedAt: scan.firstTs,
            endedAt: scan.lastTs,
            ...(scan.branch ? { branch: scan.branch } : {}),
            entryCount: scan.entryCount,
            summary: _summarize(scan.firstPrompt, scan.lastPrompt),
            transcriptPath: f.full,
        });
    }
    return sessions;
}

// ---------------------------------------------------------------------
// codex-session (native adapter — Codex's only source)
// ---------------------------------------------------------------------

interface CodexMeta {
    id: string;
    timestamp: string | null;
    cwd: string;
    branch: string | null;
}

function _codex_meta(file: string): CodexMeta | null {
    let firstLine = '';
    try {
        // metadata is always line 0 — never read the whole file here
        const fd = fs.openSync(file, 'r');
        try {
            const buf = Buffer.alloc(8192);
            const n = fs.readSync(fd, buf, 0, buf.length, 0);
            firstLine = buf.toString('utf-8', 0, n).split('\n')[0] ?? '';
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
    const rec = _parse_json(firstLine);
    if (!rec || rec.type !== 'session_meta') return null;
    const payload = rec.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const p = payload as Record<string, unknown>;
    const git =
        p.git && typeof p.git === 'object' && !Array.isArray(p.git)
            ? (p.git as Record<string, unknown>)
            : {};
    return {
        id: String(p.id ?? ''),
        timestamp: typeof p.timestamp === 'string' ? p.timestamp : null,
        cwd: String(p.cwd ?? ''),
        branch: typeof git.branch === 'string' && git.branch ? git.branch : null,
    };
}

function _codex_files(root: string): string[] {
    const out: string[] = [];
    const stack = [root];
    while (stack.length > 0) {
        const dir = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) stack.push(full);
            else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
        }
    }
    // rollout filenames embed the timestamp — lexicographic basename sort
    // is chronological; newest first
    return out.sort((a, b) => (path.basename(a) < path.basename(b) ? 1 : -1));
}

interface CodexScan {
    entryCount: number;
    lastTs: string | null;
    firstPrompt: string | null;
    lastPrompt: string | null;
}

function _codex_prompt_text(rec: Record<string, unknown>): string | null {
    if (rec.type !== 'event_msg') return null;
    const p = rec.payload;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    const payload = p as Record<string, unknown>;
    if (payload.type !== 'user_message') return null;
    const msg = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (!msg || msg.startsWith('<')) return null; // skip injected meta blocks
    return msg;
}

function _scan_codex_session(file: string): CodexScan {
    const scan: CodexScan = { entryCount: 0, lastTs: null, firstPrompt: null, lastPrompt: null };
    for (const line of _read_lines(file)) {
        const rec = _parse_json(line);
        if (!rec) continue;
        scan.entryCount += 1;
        if (typeof rec.timestamp === 'string') scan.lastTs = rec.timestamp;
        const prompt = _codex_prompt_text(rec);
        if (prompt) {
            if (!scan.firstPrompt) scan.firstPrompt = prompt;
            scan.lastPrompt = prompt;
        }
    }
    return scan;
}

function _matches_repo(sessionCwd: string, repoCwd: string): boolean {
    const norm = (p: string): string => path.resolve(p).replace(/\/+$/, '');
    const a = norm(sessionCwd);
    const b = norm(repoCwd);
    return a === b || a.startsWith(b + path.sep);
}

function _codex_sessions(opts: ListOptions, cap: number): HandoffSession[] {
    const root = opts.codexSessionsRoot ?? path.join(os.homedir(), '.codex', 'sessions');
    const cwd = opts.cwd ?? process.cwd();
    const matching: Array<{ file: string; meta: CodexMeta }> = [];
    for (const file of _codex_files(root)) {
        if (matching.length >= cap) break;
        const meta = _codex_meta(file); // line-0 read only — cheap per file
        if (!meta || !meta.id) continue;
        if (!_matches_repo(meta.cwd, cwd)) continue;
        matching.push({ file, meta });
    }
    const sessions: HandoffSession[] = [];
    for (const { file, meta } of matching) {
        const scan = _scan_codex_session(file);
        if (scan.entryCount === 0) continue;
        sessions.push({
            id: meta.id,
            source: 'codex-session',
            startedAt: meta.timestamp,
            endedAt: scan.lastTs ?? meta.timestamp,
            ...(meta.branch ? { branch: meta.branch } : {}),
            entryCount: scan.entryCount,
            summary: _summarize(scan.firstPrompt, scan.lastPrompt),
            transcriptPath: file,
        });
    }
    return sessions;
}

// ---------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------

function _sort_key(s: HandoffSession): string {
    return s.endedAt ?? s.startedAt ?? '';
}

/**
 * Does this session hold anything worth resuming?
 *
 * `≥ 1 assistant turn AND (≥ 1 tool call OR parsed tokens ≥ the committed
 * floor)`, read from the counts-only session-eol state.
 *
 * **Fail-open, deliberately** (Phase 1.2): absent, unreadable or mis-shaped
 * state LISTS the candidate rather than filtering it, and a `tool_calls` key
 * missing from a state file written before that counter existed reads as
 * *unknown*, never as zero. A wrongly listed candidate is noise the user
 * scrolls past; a wrongly hidden one is data loss they cannot even see.
 */
export function is_substantive(counters: StoredEolCounters | null): boolean {
    if (counters === null) return true;
    // Every "unknown" below is a NUMBER test, not an `=== undefined` test.
    // Absent, null and NaN are all unknown, and each one reaches this code by
    // a real path: a state file written before the counter existed is absent,
    // `JSON.stringify` turns NaN into null on the way to disk, and a
    // half-written file yields a parseable object with missing keys. Reading
    // any of them as "counted zero" hides a session that did real work.
    if (!Number.isFinite(counters.assistant_records)) return true;
    if ((counters.assistant_records as number) < 1) return false;
    if (!Number.isFinite(counters.tool_calls)) return true;
    if ((counters.tool_calls as number) >= 1) return true;
    if (!Number.isFinite(counters.final_context_tokens)) return true;
    return (counters.final_context_tokens as number) >= SUBSTANTIVE_TOKEN_FLOOR;
}

function _derive_tag(id: string): string | null {
    try {
        return derive_session_tag(id);
    } catch {
        return null;
    }
}

/**
 * The state file is keyed on the RAW session id (or transcript path) the hook
 * saw. A chat-history bucket carries only the derived tag, so the native scan
 * — which holds both — supplies the raw identity for those buckets.
 */
function _counters_for(
    session: HandoffSession,
    byTag: Map<string, HandoffSession>,
    workspaceRoot: string,
): StoredEolCounters | null {
    const native = session.source === 'chat-history' ? byTag.get(session.id) : session;
    const candidates = [
        ...(session.source === 'chat-history' ? [] : [session.id]),
        native?.id,
        native?.transcriptPath,
    ];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const counters = readEolCounters(workspaceRoot, eolSessionKey(candidate));
        if (counters !== null) return counters;
    }
    return null;
}

/**
 * Unified newest-first session list. Native-store sessions whose platform
 * id maps to an existing chat-history bucket are dropped (chat-history is
 * the primary source).
 *
 * Two exclusions apply to the merged list: the ISSUING session, by exact id
 * (never heuristically — a heuristic here hides a session the user wanted),
 * and every candidate `is_substantive` rejects.
 */
export function list_handoff_sessions(opts: ListOptions = {}): HandoffSession[] {
    const cap = opts.cap ?? DEFAULT_CAP;
    const workspaceRoot = opts.workspaceRoot ?? opts.cwd ?? process.cwd();
    const selfId =
        opts.selfSessionId === null
            ? null
            : (opts.selfSessionId ??
              process.env.AGENT_SESSION_ID ??
              process.env.CLAUDE_CODE_SESSION_ID ??
              null);
    const selfTag = selfId ? _derive_tag(selfId) : null;

    const primary = _chat_history_sessions(opts);
    const knownTags = new Set(primary.map((s) => s.id));

    // Over-fetch per source, because the two filters below run AFTER it and
    // the issuing session is by construction among the newest — with a
    // per-source cap of exactly `cap`, the caller always burns a slot and
    // every filtered empty session burns another, so a substantive session
    // just outside the window is silently dropped instead of backfilled.
    // That is the hidden-session direction Phase 1.2 calls data loss.
    const fetchCap = cap * FETCH_OVERSHOOT;
    const nativeAll = [
        ..._claude_transcript_sessions(opts, fetchCap),
        ..._codex_sessions(opts, fetchCap),
    ];
    const byTag = new Map<string, HandoffSession>();
    for (const s of nativeAll) {
        const tag = _derive_tag(s.id);
        if (tag) byTag.set(tag, s);
    }
    const native = nativeAll.filter((s) => {
        const tag = _derive_tag(s.id);
        return tag === null || !knownTags.has(tag);
    });

    return [...primary, ...native]
        .filter((s) => s.id !== selfId && (selfTag === null || s.id !== selfTag))
        .filter((s) => is_substantive(_counters_for(s, byTag, workspaceRoot)))
        .sort((a, b) => (_sort_key(a) < _sort_key(b) ? 1 : _sort_key(a) > _sort_key(b) ? -1 : 0))
        .slice(0, cap);
}
