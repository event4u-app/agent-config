/**
 * handoff_sessions — session enumeration layer (road-to-agent-handoff-
 * resume Phase 1). Fixture-driven: all three sources faked in a tmpdir;
 * the committed codex fixture records the verified on-disk shape.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { derive_session_tag } from '../../src/scripts/chat_history.js';
import {
    DEFAULT_CAP,
    encode_project_path,
    is_substantive,
    list_handoff_sessions,
    SUBSTANTIVE_TOKEN_FLOOR,
} from '../../src/scripts/_cli/handoff_sessions.js';
import {
    eolSessionKey,
    eolStateFile,
    type StoredEolCounters,
} from '../../src/scripts/_lib/session_eol.js';

const FIXTURE_DIR = path.resolve(fileURLToPath(import.meta.url), '..', 'fixtures', 'handoff');

let tmp: string;
let repoDir: string;
let histFile: string;
let claudeRoot: string;
let codexRoot: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-sessions-'));
    repoDir = path.join(tmp, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
    histFile = path.join(tmp, 'chat-history.jsonl');
    claudeRoot = path.join(tmp, 'claude-projects');
    codexRoot = path.join(tmp, 'codex-sessions');
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function baseOpts(): {
    cwd: string;
    chatHistoryPath: string;
    claudeProjectsRoot: string;
    codexSessionsRoot: string;
} {
    return {
        cwd: repoDir,
        chatHistoryPath: histFile,
        claudeProjectsRoot: claudeRoot,
        codexSessionsRoot: codexRoot,
    };
}

function writeChatHistory(sessions: Array<{ s: string; prompts: string[]; ts: string[] }>): void {
    const lines = [JSON.stringify({ t: 'header', v: 4, started: '2026-08-01T00:00:00+00:00', freq: 'per_turn' })];
    for (const sess of sessions) {
        sess.prompts.forEach((text, i) => {
            lines.push(JSON.stringify({ t: 'user', text, agent: 'claude', ts: sess.ts[i] ?? sess.ts[0], s: sess.s }));
        });
    }
    fs.writeFileSync(histFile, lines.join('\n') + '\n', 'utf-8');
}

function writeClaudeTranscript(sessionId: string, prompts: string[], branch = 'feat/x'): void {
    const dir = path.join(claudeRoot, encode_project_path(repoDir));
    fs.mkdirSync(dir, { recursive: true });
    const lines = prompts.map((text, i) =>
        JSON.stringify({
            type: 'user',
            isSidechain: false,
            gitBranch: branch,
            sessionId,
            timestamp: `2026-08-02T10:0${i}:00.000Z`,
            message: { role: 'user', content: text },
        }),
    );
    lines.push(
        JSON.stringify({
            type: 'assistant',
            timestamp: '2026-08-02T10:09:00.000Z',
            message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
        }),
    );
    fs.writeFileSync(path.join(dir, `${sessionId}.jsonl`), lines.join('\n') + '\n', 'utf-8');
}

function writeCodexSession(
    id: string,
    cwd: string,
    stamp: string,
    file: string,
    prompts: string[] = ['Fix the failing parser test'],
): void {
    const dir = path.dirname(path.join(codexRoot, file));
    fs.mkdirSync(dir, { recursive: true });
    const lines = [
        JSON.stringify({
            timestamp: stamp,
            type: 'session_meta',
            payload: { id, timestamp: stamp, cwd, git: { branch: 'feat/codex-branch' } },
        }),
        ...prompts.map((message, i) =>
            JSON.stringify({
                timestamp: `2026-08-01T10:0${i + 1}:00.000Z`,
                type: 'event_msg',
                payload: { type: 'user_message', message },
            }),
        ),
    ];
    fs.writeFileSync(path.join(codexRoot, file), lines.join('\n') + '\n', 'utf-8');
}

describe('list_handoff_sessions', () => {
    it('returns [] when every source is empty or absent', () => {
        expect(list_handoff_sessions(baseOpts())).toEqual([]);
    });

    it('lists chat-history sessions newest-first with summaries', () => {
        writeChatHistory([
            { s: 'aaaa000000000001', prompts: ['older task'], ts: ['2026-08-01T08:00:00+00:00'] },
            {
                s: 'bbbb000000000002',
                prompts: ['newer task', 'follow-up ask'],
                ts: ['2026-08-02T08:00:00+00:00', '2026-08-02T09:00:00+00:00'],
            },
        ]);
        const sessions = list_handoff_sessions(baseOpts());
        expect(sessions).toHaveLength(2);
        expect(sessions[0]?.id).toBe('bbbb000000000002');
        expect(sessions[0]?.source).toBe('chat-history');
        expect(sessions[0]?.entryCount).toBe(2);
        expect(sessions[0]?.summary).toContain('newer task');
        expect(sessions[1]?.id).toBe('aaaa000000000001');
    });

    it('parses the committed codex fixture shape (session_meta + user_message)', () => {
        const dest = path.join(codexRoot, '2026', '08', '01', 'rollout-fixture.jsonl');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(FIXTURE_DIR, 'codex-session.jsonl'), dest);
        const sessions = list_handoff_sessions({ ...baseOpts(), cwd: '/tmp/fixture-repo' });
        expect(sessions).toHaveLength(1);
        const s = sessions[0];
        expect(s?.source).toBe('codex-session');
        expect(s?.id).toBe('019f7fd4-0000-0000-0000-000000000001');
        expect(s?.branch).toBe('feat/fixture-branch');
        expect(s?.entryCount).toBe(6);
        expect(s?.summary).toContain('Fix the failing parser test');
        expect(s?.summary).toContain('→');
        expect(s?.summary).toContain('update the changelog');
    });

    it('filters codex sessions to the current repo cwd', () => {
        writeCodexSession('cx-match', repoDir, '2026-08-01T10:00:00.000Z', '2026/08/01/rollout-a.jsonl');
        writeCodexSession('cx-other', '/somewhere/else', '2026-08-01T11:00:00.000Z', '2026/08/01/rollout-b.jsonl');
        const sessions = list_handoff_sessions(baseOpts());
        expect(sessions).toHaveLength(1);
        expect(sessions[0]?.id).toBe('cx-match');
    });

    it('lists claude transcripts with branch and prompt summary', () => {
        writeClaudeTranscript('11111111-2222-3333-4444-555555555555', ['do the thing', 'now verify it']);
        const sessions = list_handoff_sessions(baseOpts());
        expect(sessions).toHaveLength(1);
        const s = sessions[0];
        expect(s?.source).toBe('claude-transcript');
        expect(s?.branch).toBe('feat/x');
        expect(s?.summary).toBe('do the thing → now verify it');
        expect(s?.transcriptPath).toContain('.jsonl');
    });

    it('de-dups a native session already covered by chat-history', () => {
        const codexId = '019f0000-aaaa-bbbb-cccc-000000000042';
        const tag = derive_session_tag(codexId);
        writeChatHistory([
            { s: tag, prompts: ['same session, logged by hook'], ts: ['2026-08-01T10:00:00+00:00'] },
        ]);
        writeCodexSession(codexId, repoDir, '2026-08-01T10:00:00.000Z', '2026/08/01/rollout-dup.jsonl');
        const sessions = list_handoff_sessions(baseOpts());
        expect(sessions).toHaveLength(1);
        expect(sessions[0]?.source).toBe('chat-history');
        expect(sessions[0]?.id).toBe(tag);
    });

    it('caps the merged list', () => {
        const many = Array.from({ length: DEFAULT_CAP + 5 }, (_, i) => ({
            s: `session${String(i).padStart(10, '0')}`,
            prompts: [`task ${i}`],
            ts: [`2026-08-01T${String(10 + (i % 12)).padStart(2, '0')}:00:00+00:00`],
        }));
        writeChatHistory(many);
        const sessions = list_handoff_sessions(baseOpts());
        expect(sessions).toHaveLength(DEFAULT_CAP);
        expect(list_handoff_sessions({ ...baseOpts(), cap: 3 })).toHaveLength(3);
    });

    it('filters system-notification noise out of chat-history summaries', () => {
        writeChatHistory([
            {
                s: 'cccc000000000003',
                prompts: ['fix the login bug', '<task-notification>agent finished</task-notification>'],
                ts: ['2026-08-02T08:00:00+00:00', '2026-08-02T09:00:00+00:00'],
            },
        ]);
        const sessions = list_handoff_sessions(baseOpts());
        expect(sessions).toHaveLength(1);
        expect(sessions[0]?.summary).toBe('fix the login bug');
        expect(sessions[0]?.summary).not.toContain('task-notification');
    });

    it('skips sidechain records and meta blocks when summarizing claude transcripts', () => {
        const dir = path.join(claudeRoot, encode_project_path(repoDir));
        fs.mkdirSync(dir, { recursive: true });
        const lines = [
            JSON.stringify({
                type: 'user',
                isSidechain: true,
                timestamp: '2026-08-02T10:00:00.000Z',
                message: { role: 'user', content: 'subagent prompt — must not appear' },
            }),
            JSON.stringify({
                type: 'user',
                isSidechain: false,
                timestamp: '2026-08-02T10:01:00.000Z',
                message: { role: 'user', content: '<local-command-caveat>meta</local-command-caveat>' },
            }),
            JSON.stringify({
                type: 'user',
                isSidechain: false,
                gitBranch: 'main',
                timestamp: '2026-08-02T10:02:00.000Z',
                message: { role: 'user', content: 'the real prompt' },
            }),
        ];
        fs.writeFileSync(path.join(dir, 'abc.jsonl'), lines.join('\n') + '\n', 'utf-8');
        const sessions = list_handoff_sessions(baseOpts());
        expect(sessions).toHaveLength(1);
        expect(sessions[0]?.summary).toBe('the real prompt');
    });
});

// ---------------------------------------------------------------------
// Phase 1 — the enumeration fix: the issuing session and every session
// holding nothing worth resuming are excluded, and every unknown LISTS.
// ---------------------------------------------------------------------

/** Write the counts-only session-eol state the enumeration reads. */
function writeEolState(rawSessionId: string, counters: Record<string, unknown>): void {
    const file = eolStateFile(repoDir, eolSessionKey(rawSessionId));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
        file,
        JSON.stringify({ schema_version: 1, counters, advisory_fired_at: null }),
        'utf-8',
    );
}

function idsFor(selfSessionId: string | null): string[] {
    return list_handoff_sessions({ ...baseOpts(), selfSessionId }).map((s) => s.id);
}

describe('substantive-content + self-session filtering', () => {
    it('filters an empty session — an assistant never answered in it', () => {
        writeClaudeTranscript('empty-0001', ['just opened a chat']);
        writeEolState('empty-0001', {
            schema_version: 1,
            turns: 1,
            assistant_records: 0,
            tool_calls: 0,
            final_context_tokens: 0,
        });
        expect(idsFor(null)).toEqual([]);
    });

    it('filters the ISSUING session even when it is the richest candidate', () => {
        writeClaudeTranscript('self-0001', ['the caller itself']);
        writeEolState('self-0001', {
            schema_version: 1,
            turns: 12,
            assistant_records: 40,
            tool_calls: 30,
            final_context_tokens: 500_000,
        });
        // Present for every other caller — so the exclusion is the only cause.
        expect(idsFor(null)).toEqual(['self-0001']);
        expect(idsFor('self-0001')).toEqual([]);
    });

    it('lists a one-turn session that made a tool call, whatever its size', () => {
        writeClaudeTranscript('tool-0001', ['tiny but real']);
        writeEolState('tool-0001', {
            schema_version: 1,
            turns: 1,
            assistant_records: 1,
            tool_calls: 1,
            final_context_tokens: 500, // far below the floor — the tool arm carries it
        });
        expect(idsFor(null)).toEqual(['tool-0001']);
    });

    it('lists a session whose state is unreadable — fail-open, never data loss', () => {
        writeClaudeTranscript('broken-0001', ['state got corrupted']);
        const file = eolStateFile(repoDir, eolSessionKey('broken-0001'));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '{ not json at all', 'utf-8');
        expect(idsFor(null)).toEqual(['broken-0001']);
    });

    it('lists a tool-call-free session once it clears the committed token floor', () => {
        writeClaudeTranscript('talk-0001', ['discussion only']);
        writeEolState('talk-0001', {
            schema_version: 1,
            turns: 4,
            assistant_records: 4,
            tool_calls: 0,
            final_context_tokens: SUBSTANTIVE_TOKEN_FLOOR,
        });
        expect(idsFor(null)).toEqual(['talk-0001']);
    });

    it('resolves the issuing session from the env the host actually exports', () => {
        // Pins the MEASURED variable names. A rename here silently disables
        // the self-exclusion, which is exactly the defect Phase 1 repairs.
        writeClaudeTranscript('env-0001', ['from the env']);
        const prior = { agent: process.env.AGENT_SESSION_ID, cc: process.env.CLAUDE_CODE_SESSION_ID };
        try {
            delete process.env.AGENT_SESSION_ID;
            process.env.CLAUDE_CODE_SESSION_ID = 'env-0001';
            expect(list_handoff_sessions(baseOpts()).map((s) => s.id)).toEqual([]);
            process.env.AGENT_SESSION_ID = 'env-0001';
            delete process.env.CLAUDE_CODE_SESSION_ID;
            expect(list_handoff_sessions(baseOpts()).map((s) => s.id)).toEqual([]);
        } finally {
            if (prior.agent === undefined) delete process.env.AGENT_SESSION_ID;
            else process.env.AGENT_SESSION_ID = prior.agent;
            if (prior.cc === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
            else process.env.CLAUDE_CODE_SESSION_ID = prior.cc;
        }
    });

    it('reads a state file written before tool_calls existed as unknown, not zero', () => {
        writeClaudeTranscript('legacy-0001', ['written by an older writer']);
        writeEolState('legacy-0001', {
            schema_version: 1,
            turns: 3,
            assistant_records: 3,
            final_context_tokens: 500, // below the floor; only "unknown" can save it
        });
        expect(idsFor(null)).toEqual(['legacy-0001']);
    });
});

describe('is_substantive', () => {
    const base = { schema_version: 1 as const, scanned_bytes: 0, turns: 1, compactions: [], compact_summaries: 0, bad_lines: 0, final_context_at: null };

    it('lists on absent state', () => {
        expect(is_substantive(null)).toBe(true);
    });

    it('requires at least one assistant record', () => {
        expect(
            is_substantive({ ...base, assistant_records: 0, tool_calls: 9, final_context_tokens: 999_999 }),
        ).toBe(false);
    });

    it('reads a NULL tool_calls as unknown, not as a counted zero (R2 finding 2)', () => {
        // JSON.stringify writes NaN as null, so a migrated legacy state file
        // arrives with `tool_calls: null` — which is not `undefined`, and used
        // to bypass the unknown-guard and hide a real prior session.
        expect(
            is_substantive({
                ...base,
                assistant_records: 3,
                tool_calls: null as unknown as number,
                final_context_tokens: 500,
            }),
        ).toBe(true);
    });

    it('lists a half-written state file — fail-open on mis-shaped, not just unparseable (R2 finding 3)', () => {
        // `{"counters":{}}` parses, so it never reaches the null path; every
        // counter is missing and must read as unknown rather than as zero.
        expect(is_substantive({} as unknown as StoredEolCounters)).toBe(true);
    });

    it('filters an answered session that neither called a tool nor reached the floor', () => {
        expect(
            is_substantive({
                ...base,
                assistant_records: 2,
                tool_calls: 0,
                final_context_tokens: SUBSTANTIVE_TOKEN_FLOOR - 1,
            }),
        ).toBe(false);
    });
});
