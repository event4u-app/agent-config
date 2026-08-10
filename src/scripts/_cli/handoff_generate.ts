/**
 * Handoff generator (road-to-agent-handoff-resume Phase 2). Takes a session
 * picked by `handoff_sessions.ts`, reads its FULL transcript, and emits the
 * handoff document with the exact section set from
 * `src/domains/meta/agent-handoff/command.md` step 2 — deterministically:
 * no LLM call, reproducible, privacy-floored per line.
 *
 *   - User messages are preserved VERBATIM (the template's load-bearing
 *     rule). A prompt containing any line the low-impact redactor refuses
 *     is withheld whole (drop, never rewrite) and counted in the
 *     `[N line(s) withheld by privacy floor]` marker.
 *   - Assistant/tool content is extracted with the hot-context heuristics:
 *     last intents, tool-result changes, failure-pattern regex for errors.
 *   - Output lands atomically in `agents/runtime/state/handoff-context.md`
 *     with `Generated:` / `Source-Session:` / `Branch:` parse anchors for
 *     the session_start hook, hard-capped at ~1200 words (priority-trim
 *     like `build_hot_context`).
 *   - `--llm` polish is a seam only in v1: requesting it raises a clear
 *     "not implemented" error. No spend without the flag, and none with it.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { redact_low_impact_entry } from '../ai_council/redact_low_impact_entry.js';
import { read_entries } from '../chat_history.js';
import { HANDOFF_CONTEXT_REL } from '../handoff_context_hook.js';
import type { HandoffSession } from './handoff_sessions.js';

export const WORD_CAP = 1200;

const SNIPPET_CHARS = 200;
const DONE_SNIPPET_CHARS = 400;
const MAX_ERRORS = 5;
/**
 * Per-error cap. Above `SNIPPET_CHARS` because an error string is kept
 * verbatim so it stays greppable — but deliberately not far above.
 *
 * The section competes for a fixed word cap whose trim pops the NEWEST entry
 * first, and the newest failure is the one a successor needs. Enlarging each
 * entry therefore makes that pre-existing trim order bite more often. 400 is
 * twice the old truncation — enough to carry a real error line whole — while
 * keeping the five-entry section within roughly a sixth of the cap. The
 * pop()-newest ordering is pre-existing and is not this change's to alter;
 * this bound is what keeps the change from amplifying it.
 */
const MAX_ERROR_CHARS = 400;
const MAX_DECISIONS = 5;
const MAX_FILES = 15;

const FAILURE_RE = /\b(fail(ing|ed|ure)?|error|exit[= ][1-9]|red\b|broken)\b/i;
const DECISION_RE = /\b(decided|decision|chose|choosing|locked|we'll use|we will use)\b/i;
const FILE_PATH_RE = /(?:src|tests|docs|agents|scripts|config)\/[\w./-]+\.\w{1,8}/g;
const ROADMAP_RE = /agents\/roadmaps\/[\w.-]+\.md/g;

export class LlmPolishNotImplementedError extends Error {
    constructor() {
        super(
            '--llm polish is a v1 seam and not implemented yet — ' +
                'the deterministic handoff (default) is the supported path.',
        );
    }
}

// ---------------------------------------------------------------------
// unified transcript model
// ---------------------------------------------------------------------

export interface TranscriptTurn {
    kind: 'user' | 'assistant' | 'tool';
    text: string;
    ts: string | null;
    tool?: string;
}

export interface TranscriptData {
    turns: TranscriptTurn[];
    branch: string | null;
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
        // fail-open
    }
    return null;
}

function _from_chat_history(sessionId: string, chatHistoryPath: string | null): TranscriptData {
    let entries: Array<Record<string, unknown>>;
    try {
        entries = read_entries({ session: sessionId, path: chatHistoryPath, last: null });
    } catch {
        entries = [];
    }
    const turns: TranscriptTurn[] = [];
    for (const e of entries) {
        const text = typeof e.text === 'string' ? e.text : '';
        if (!text) continue;
        const t = String(e.t ?? '');
        const kind: TranscriptTurn['kind'] = t === 'user' ? 'user' : t === 'tool' ? 'tool' : 'assistant';
        turns.push({
            kind,
            text,
            ts: typeof e.ts === 'string' ? e.ts : null,
            ...(typeof e.tool === 'string' && e.tool ? { tool: e.tool } : {}),
        });
    }
    return { turns, branch: null };
}

function _cc_text_from_content(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((block) => {
                if (block && typeof block === 'object' && !Array.isArray(block)) {
                    const b = block as Record<string, unknown>;
                    if (b.type === 'text' && typeof b.text === 'string') return b.text;
                }
                return '';
            })
            .filter((t) => t)
            .join('\n');
    }
    return '';
}

function _from_claude_transcript(file: string): TranscriptData {
    const turns: TranscriptTurn[] = [];
    let branch: string | null = null;
    for (const line of _read_lines(file)) {
        const rec = _parse_json(line);
        if (!rec || rec.isSidechain === true) continue;
        if (!branch && typeof rec.gitBranch === 'string' && rec.gitBranch) branch = rec.gitBranch;
        const ts = typeof rec.timestamp === 'string' ? rec.timestamp : null;
        const msg =
            rec.message && typeof rec.message === 'object' && !Array.isArray(rec.message)
                ? (rec.message as Record<string, unknown>)
                : null;
        if (!msg) continue;
        if (rec.type === 'user') {
            // real prompts have string content; tool_results arrive as lists
            if (typeof msg.content === 'string') {
                const text = msg.content.trim();
                if (text && !text.startsWith('<') && !text.startsWith('Caveat:')) {
                    turns.push({ kind: 'user', text, ts });
                }
            } else {
                const text = _cc_text_from_content(msg.content).trim();
                if (text) turns.push({ kind: 'tool', text, ts });
            }
        } else if (rec.type === 'assistant') {
            const text = _cc_text_from_content(msg.content).trim();
            if (text) turns.push({ kind: 'assistant', text, ts });
        }
    }
    return { turns, branch };
}

function _from_codex_session(file: string): TranscriptData {
    const turns: TranscriptTurn[] = [];
    let branch: string | null = null;
    for (const line of _read_lines(file)) {
        const rec = _parse_json(line);
        if (!rec) continue;
        const ts = typeof rec.timestamp === 'string' ? rec.timestamp : null;
        const p =
            rec.payload && typeof rec.payload === 'object' && !Array.isArray(rec.payload)
                ? (rec.payload as Record<string, unknown>)
                : null;
        if (!p) continue;
        if (rec.type === 'session_meta') {
            const git =
                p.git && typeof p.git === 'object' && !Array.isArray(p.git)
                    ? (p.git as Record<string, unknown>)
                    : {};
            if (typeof git.branch === 'string' && git.branch) branch = git.branch;
        } else if (rec.type === 'event_msg' && p.type === 'user_message') {
            const text = typeof p.message === 'string' ? p.message.trim() : '';
            if (text && !text.startsWith('<')) turns.push({ kind: 'user', text, ts });
        } else if (rec.type === 'event_msg' && p.type === 'agent_message') {
            const text = typeof p.message === 'string' ? p.message.trim() : '';
            if (text) turns.push({ kind: 'assistant', text, ts });
        }
    }
    return { turns, branch };
}

export function load_transcript(
    session: Pick<HandoffSession, 'id' | 'source' | 'transcriptPath'>,
    options: { chatHistoryPath?: string | null } = {},
): TranscriptData {
    if (session.source === 'chat-history') {
        return _from_chat_history(session.id, options.chatHistoryPath ?? null);
    }
    if (!session.transcriptPath) return { turns: [], branch: null };
    return session.source === 'claude-transcript'
        ? _from_claude_transcript(session.transcriptPath)
        : _from_codex_session(session.transcriptPath);
}

// ---------------------------------------------------------------------
// deterministic section extraction
// ---------------------------------------------------------------------

function _snippet(text: string, max: number): string {
    const oneLine = text.replace(/\s+/g, ' ').trim();
    return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 1) + '…';
}

function _word_count(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Privacy floor for NON-verbatim items: drop refused lines, count them. */
function _redact_items(items: string[]): { kept: string[]; dropped: number } {
    const kept: string[] = [];
    let dropped = 0;
    for (const item of items) {
        try {
            if (redact_low_impact_entry(item).ok) kept.push(item);
            else dropped += 1;
        } catch {
            dropped += 1; // fail-closed per line
        }
    }
    return { kept, dropped };
}

/**
 * Verbatim items: a prompt is included ONLY when every one of its lines
 * passes the redactor — otherwise it is withheld whole and its failing
 * lines are counted (drop, never rewrite).
 */
function _redact_verbatim(prompts: string[]): { kept: string[]; withheldLines: number } {
    const kept: string[] = [];
    let withheldLines = 0;
    for (const prompt of prompts) {
        const lines = prompt.split('\n');
        let failing = 0;
        for (const line of lines) {
            try {
                if (!redact_low_impact_entry(line).ok) failing += 1;
            } catch {
                failing += 1;
            }
        }
        if (failing === 0) kept.push(prompt);
        else withheldLines += failing;
    }
    return { kept, withheldLines };
}

function _current_head(root: string): string | null {
    try {
        const proc = spawnSync('git', ['log', '--oneline', '-1'], {
            cwd: root,
            encoding: 'utf-8',
            timeout: 5000,
            env: hardenedSpawnEnv(),
        });
        if (proc.status === 0) return (proc.stdout || '').trim() || null;
    } catch {
        // fall through
    }
    return null;
}

function _current_branch(root: string): string {
    try {
        const proc = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: root,
            encoding: 'utf-8',
            timeout: 5000,
            env: hardenedSpawnEnv(),
        });
        if (proc.status === 0) return (proc.stdout || '').trim() || 'unknown';
    } catch {
        // fall through
    }
    return 'unknown';
}

export interface BuildOptions {
    cwd?: string;
    chatHistoryPath?: string | null;
    now?: Date;
    wordCap?: number;
    /** v1 seam — requesting it throws LlmPolishNotImplementedError. */
    llm?: boolean;
}

export function build_handoff(
    session: Pick<HandoffSession, 'id' | 'source' | 'transcriptPath' | 'branch'>,
    options: BuildOptions = {},
): string {
    if (options.llm) throw new LlmPolishNotImplementedError();

    const root = options.cwd ?? process.cwd();
    const now = options.now ?? new Date();
    const wordCap = options.wordCap ?? WORD_CAP;
    const transcript = load_transcript(session, { chatHistoryPath: options.chatHistoryPath ?? null });

    const users = transcript.turns.filter((t) => t.kind === 'user');
    const assistants = transcript.turns.filter((t) => t.kind === 'assistant');
    const toolish = transcript.turns.filter((t) => t.kind !== 'user');

    // User instructions — verbatim or withheld, never rewritten.
    const verbatim = _redact_verbatim(users.map((t) => t.text));

    // Done — the session's final assistant text.
    const lastAssistant = assistants[assistants.length - 1]?.text ?? '';
    const done = _redact_items(lastAssistant ? [_snippet(lastAssistant, DONE_SNIPPET_CHARS)] : []);

    // Open + Resume pointer — the last user ask is what was in flight.
    const lastUser = users[users.length - 1]?.text ?? '';
    const open = _redact_items(lastUser ? [`in-flight ask: ${_snippet(lastUser, SNIPPET_CHARS)}`] : []);
    const resume = _redact_items(
        lastUser ? [`continue from the last user ask: ${_snippet(lastUser, SNIPPET_CHARS)}`] : [],
    );

    // Errors + fixes — failure-pattern turns, oldest→newest, last 5.
    //
    // Precision rule (Phase 3.1): the error string is carried VERBATIM. It
    // used to be `_snippet`-ed like every other section, which truncates
    // mid-string — and a truncated error cannot be grepped, matched against a
    // tracker, or recognised when it recurs, which is the only reason to
    // carry it at all. So the FAILURE-matching line is taken whole (capped
    // only against an absurd single line) instead of the turn being cut at an
    // arbitrary offset.
    const errors = _redact_items(
        toolish
            .filter((t) => FAILURE_RE.test(t.text))
            .slice(-MAX_ERRORS)
            .map((t) => {
                const line = t.text.split('\n').find((l) => FAILURE_RE.test(l))?.trim() ?? t.text.trim();
                const prefix = t.tool ? `${t.tool}: ` : '';
                return `${prefix}${line}`.slice(0, MAX_ERROR_CHARS);
            }),
    );

    // Key decisions — decision-pattern assistant turns, last 5.
    const decisions = _redact_items(
        assistants
            .filter((t) => DECISION_RE.test(t.text))
            .slice(-MAX_DECISIONS)
            .map((t) => _snippet(t.text, SNIPPET_CHARS)),
    );

    // Relevant files — path mentions across the whole transcript, deduped.
    const fileSet = new Set<string>();
    for (const t of transcript.turns) {
        for (const m of t.text.match(FILE_PATH_RE) ?? []) fileSet.add(m);
    }
    const files = _redact_items([...fileSet].slice(-MAX_FILES));

    // Roadmap — last roadmap-path mention, when present.
    let roadmap: string | null = null;
    for (const t of transcript.turns) {
        for (const m of t.text.match(ROADMAP_RE) ?? []) roadmap = m;
    }

    const branch = session.branch ?? transcript.branch ?? 'unknown';
    const droppedTotal =
        done.dropped + open.dropped + resume.dropped + errors.dropped + decisions.dropped + files.dropped;

    const sections: Array<{ title: string; items: string[]; verbatim?: boolean }> = [
        { title: 'User instructions (VERBATIM)', items: verbatim.kept, verbatim: true },
        { title: 'Done', items: done.kept },
        { title: 'Open', items: open.kept },
        { title: 'Resume pointer', items: resume.kept },
        { title: 'Errors + fixes', items: errors.kept },
        { title: 'Key decisions', items: decisions.kept },
        { title: 'Relevant files', items: files.kept },
    ];
    // trim lowest-priority first; the verbatim record survives longest
    const trimOrder = [
        'Relevant files',
        'Key decisions',
        'Errors + fixes',
        'Done',
        'Open',
        'Resume pointer',
        'User instructions (VERBATIM)',
    ];

    const head = branch !== 'unknown' && branch === _current_branch(root) ? _current_head(root) : null;

    const render = (): string => {
        const lines: string[] = [
            '# Handoff',
            '',
            `Generated: ${now.toISOString()}`,
            `Source-Session: ${session.id}`,
            `Branch: ${branch}`,
        ];
        if (head) lines.push(`Last commit: ${head}`);
        if (roadmap) lines.push(`Roadmap: ${roadmap}`);
        if (verbatim.withheldLines > 0 || droppedTotal > 0) {
            lines.push(
                `Privacy floor: [${verbatim.withheldLines + droppedTotal} line(s) withheld by privacy floor]`,
            );
        }
        for (const s of sections) {
            lines.push('', `## ${s.title}`, '');
            if (s.title === 'Resume pointer') {
                // Precision rules (Phase 3.1), rendered where the successor
                // reads them rather than filed in a doc nobody opens.
                lines.push(
                    '> Precision contract: identify code by signature or `path:line`, never by',
                    '> description; quote error strings verbatim; give every resume step its',
                    '> expected outcome, so "done" is checkable rather than felt.',
                    '',
                );
            }
            if (s.items.length === 0) {
                if (s.verbatim && verbatim.withheldLines > 0) {
                    lines.push(`- [${verbatim.withheldLines} line(s) withheld by privacy floor]`);
                } else {
                    lines.push('- (none extracted)');
                }
                continue;
            }
            for (const item of s.items) {
                if (s.verbatim) {
                    // verbatim: keep internal newlines, indent continuations
                    const [first, ...rest] = item.split('\n');
                    lines.push(`- ${first ?? ''}`);
                    for (const cont of rest) lines.push(`  ${cont}`);
                } else {
                    lines.push(`- ${item}`);
                }
            }
        }
        lines.push('');
        return lines.join('\n');
    };

    let text = render();
    for (const title of trimOrder) {
        if (_word_count(text) <= wordCap) break;
        const section = sections.find((s) => s.title === title);
        if (!section) continue;
        while (section.items.length > 0 && _word_count(text) > wordCap) {
            // verbatim: drop the OLDEST prompt first (shift), keep the latest asks
            if (section.verbatim) section.items.shift();
            else section.items.pop();
            text = render();
        }
    }
    return text;
}

// ---------------------------------------------------------------------
// atomic write
// ---------------------------------------------------------------------

export function handoff_target_path(root: string): string {
    return process.env.AGENT_HANDOFF_CONTEXT_FILE || path.join(root, HANDOFF_CONTEXT_REL);
}

export function write_handoff(text: string, options: { cwd?: string } = {}): string {
    const root = options.cwd ?? process.cwd();
    const target = handoff_target_path(root);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, text, { encoding: 'utf-8' });
    fs.renameSync(tmp, target);
    return target;
}
