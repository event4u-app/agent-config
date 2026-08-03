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
    list_handoff_sessions,
} from '../../src/scripts/_cli/handoff_sessions.js';

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
