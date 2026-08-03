/**
 * handoff_generate — deterministic handoff builder (road-to-agent-handoff-
 * resume Phase 2). Covers: section completeness, verbatim preservation,
 * redaction drop + withheld marker, word-cap trim, atomic write, --llm seam.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    build_handoff,
    LlmPolishNotImplementedError,
    load_transcript,
    write_handoff,
} from '../../src/scripts/_cli/handoff_generate.js';

const REQUIRED_SECTIONS = [
    '## User instructions (VERBATIM)',
    '## Done',
    '## Open',
    '## Resume pointer',
    '## Errors + fixes',
    '## Key decisions',
    '## Relevant files',
];

let tmp: string;
let histFile: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-generate-'));
    histFile = path.join(tmp, 'chat-history.jsonl');
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.AGENT_HANDOFF_CONTEXT_FILE;
});

function writeHistory(entries: Array<Record<string, unknown>>): void {
    const lines = [
        JSON.stringify({ t: 'header', v: 4, started: '2026-08-01T00:00:00+00:00', freq: 'per_turn' }),
        ...entries.map((e) => JSON.stringify(e)),
    ];
    fs.writeFileSync(histFile, lines.join('\n') + '\n', 'utf-8');
}

const SESSION = { id: 'aaaa000000000001', source: 'chat-history' as const };

function buildDefault(extra: Array<Record<string, unknown>> = []): string {
    writeHistory([
        {
            t: 'user',
            text: 'Refactor the session picker and keep the API stable',
            ts: '2026-08-01T10:00:00+00:00',
            s: SESSION.id,
        },
        {
            t: 'tool',
            tool: 'vitest',
            text: 'FAIL tests/picker.test.ts — 1 failed',
            ts: '2026-08-01T10:01:00+00:00',
            s: SESSION.id,
        },
        {
            t: 'agent',
            text: 'I decided to keep list_sessions as the source. Fixed src/scripts/_cli/handoff_sessions.ts and the test.',
            ts: '2026-08-01T10:02:00+00:00',
            s: SESSION.id,
        },
        {
            t: 'user',
            text: 'now write the generator',
            ts: '2026-08-01T10:03:00+00:00',
            s: SESSION.id,
        },
        ...extra,
    ]);
    return build_handoff(SESSION, { chatHistoryPath: histFile, cwd: tmp, now: new Date('2026-08-04T00:00:00Z') });
}

describe('build_handoff', () => {
    it('emits every required section plus the parse anchors', () => {
        const text = buildDefault();
        for (const section of REQUIRED_SECTIONS) {
            expect(text).toContain(section);
        }
        expect(text).toMatch(/^Generated: 2026-08-04T00:00:00/m);
        expect(text).toMatch(/^Source-Session: aaaa000000000001$/m);
        expect(text).toMatch(/^Branch: /m);
    });

    it('preserves user instructions verbatim, never summarized', () => {
        const text = buildDefault();
        expect(text).toContain('- Refactor the session picker and keep the API stable');
        expect(text).toContain('- now write the generator');
    });

    it('extracts errors, decisions, and file mentions deterministically', () => {
        const text = buildDefault();
        expect(text).toContain('vitest: FAIL tests/picker.test.ts — 1 failed');
        expect(text).toContain('I decided to keep list_sessions as the source.');
        expect(text).toContain('- src/scripts/_cli/handoff_sessions.ts');
        // determinism: same input → same output
        expect(buildDefault()).toBe(text);
    });

    it('withholds a verbatim prompt that fails the privacy floor and adds the marker', () => {
        const text = buildDefault([
            {
                t: 'user',
                text: 'contact me at real.person@customer-corp.example and continue',
                ts: '2026-08-01T10:04:00+00:00',
                s: SESSION.id,
            },
        ]);
        expect(text).not.toContain('real.person@customer-corp.example');
        expect(text).toMatch(/line\(s\) withheld by privacy floor/);
        // the clean prompts survive verbatim
        expect(text).toContain('- Refactor the session picker and keep the API stable');
    });

    it('drops a failing non-verbatim line without a rewrite', () => {
        const text = buildDefault([
            {
                t: 'tool',
                tool: 'curl',
                text: 'error: sent token to admin@internal-corp.example',
                ts: '2026-08-01T10:05:00+00:00',
                s: SESSION.id,
            },
        ]);
        expect(text).not.toContain('admin@internal-corp.example');
    });

    it('trims to the word cap, dropping low-priority sections first', () => {
        const filler = Array.from({ length: 40 }, (_, i) => ({
            t: 'agent',
            text: `I decided option ${i}: ${'word '.repeat(60)}`,
            ts: `2026-08-01T11:${String(i % 60).padStart(2, '0')}:00+00:00`,
            s: SESSION.id,
        }));
        writeHistory([
            { t: 'user', text: 'the one real instruction', ts: '2026-08-01T10:00:00+00:00', s: SESSION.id },
            ...filler,
        ]);
        const text = build_handoff(SESSION, {
            chatHistoryPath: histFile,
            cwd: tmp,
            wordCap: 150,
        });
        const words = text.split(/\s+/).filter((w) => w.length > 0).length;
        expect(words).toBeLessThanOrEqual(150);
        // the verbatim record survives the trim
        expect(text).toContain('- the one real instruction');
    });

    it('throws the clear v1 seam error when --llm is requested', () => {
        writeHistory([{ t: 'user', text: 'hi', ts: '2026-08-01T10:00:00+00:00', s: SESSION.id }]);
        expect(() =>
            build_handoff(SESSION, { chatHistoryPath: histFile, cwd: tmp, llm: true }),
        ).toThrow(LlmPolishNotImplementedError);
    });
});

describe('load_transcript — native sources', () => {
    it('reads a codex session (user_message / agent_message)', () => {
        const file = path.join(tmp, 'rollout.jsonl');
        fs.writeFileSync(
            file,
            [
                JSON.stringify({
                    timestamp: '2026-08-01T10:00:00.000Z',
                    type: 'session_meta',
                    payload: { id: 'cx1', timestamp: '2026-08-01T10:00:00.000Z', cwd: tmp, git: { branch: 'feat/z' } },
                }),
                JSON.stringify({
                    timestamp: '2026-08-01T10:01:00.000Z',
                    type: 'event_msg',
                    payload: { type: 'user_message', message: 'do the codex thing' },
                }),
                JSON.stringify({
                    timestamp: '2026-08-01T10:02:00.000Z',
                    type: 'event_msg',
                    payload: { type: 'agent_message', message: 'did the codex thing' },
                }),
            ].join('\n') + '\n',
            'utf-8',
        );
        const data = load_transcript({ id: 'cx1', source: 'codex-session', transcriptPath: file });
        expect(data.branch).toBe('feat/z');
        expect(data.turns.map((t) => t.kind)).toEqual(['user', 'assistant']);
        expect(data.turns[0]?.text).toBe('do the codex thing');
    });

    it('reads a claude transcript (string prompts, block assistants, skips sidechains)', () => {
        const file = path.join(tmp, 'cc.jsonl');
        fs.writeFileSync(
            file,
            [
                JSON.stringify({
                    type: 'user',
                    isSidechain: true,
                    timestamp: '2026-08-01T10:00:00.000Z',
                    message: { role: 'user', content: 'subagent noise' },
                }),
                JSON.stringify({
                    type: 'user',
                    isSidechain: false,
                    gitBranch: 'main',
                    timestamp: '2026-08-01T10:01:00.000Z',
                    message: { role: 'user', content: 'real ask' },
                }),
                JSON.stringify({
                    type: 'assistant',
                    timestamp: '2026-08-01T10:02:00.000Z',
                    message: { role: 'assistant', content: [{ type: 'text', text: 'real answer' }] },
                }),
            ].join('\n') + '\n',
            'utf-8',
        );
        const data = load_transcript({ id: 'cc1', source: 'claude-transcript', transcriptPath: file });
        expect(data.branch).toBe('main');
        expect(data.turns.map((t) => t.text)).toEqual(['real ask', 'real answer']);
    });
});

describe('write_handoff', () => {
    it('writes atomically to the env-overridden target', () => {
        const target = path.join(tmp, 'state', 'handoff-context.md');
        process.env.AGENT_HANDOFF_CONTEXT_FILE = target;
        const written = write_handoff('# Handoff\n\nGenerated: 2026-08-04T00:00:00.000Z\n', { cwd: tmp });
        expect(written).toBe(target);
        expect(fs.readFileSync(target, 'utf-8')).toContain('# Handoff');
        // no tmp leftovers
        expect(fs.readdirSync(path.dirname(target)).filter((n) => n.includes('.tmp-'))).toEqual([]);
    });

    it('defaults to agents/runtime/state/handoff-context.md under cwd', () => {
        const written = write_handoff('# Handoff\n', { cwd: tmp });
        expect(written).toBe(path.join(tmp, 'agents', 'runtime', 'state', 'handoff-context.md'));
        expect(fs.existsSync(written)).toBe(true);
    });
});
