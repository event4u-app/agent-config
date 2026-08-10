import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { askOnce } from '../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { classifyLadder, detectBoundedQuestion } from '../../src/scripts/_lib/judgment_ladder.js';
import { buildNudgeLine, classifyPrompt } from '../../src/scripts/hooks/delegation_nudge_hook.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-transport-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function fakeClient(opts: { provider?: string; text?: string; error?: string | null; throws?: boolean }): ExternalAIClient {
    return {
        provider: opts.provider ?? 'anthropic',
        ask(_system: string, _user: string): CouncilResponse {
            if (opts.throws) throw new Error('transport exploded');
            return new CouncilResponse({
                provider: opts.provider ?? 'anthropic',
                model: 'test-model',
                text: opts.text ?? 'the answer',
                input_tokens: 120,
                output_tokens: 30,
                latency_ms: 250,
                error: opts.error ?? null,
            });
        },
    } as unknown as ExternalAIClient;
}

function auditLines(dir: string): Array<Record<string, unknown>> {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')) : [];
    const out: Array<Record<string, unknown>> = [];
    for (const f of files) {
        for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
            if (line.trim()) out.push(JSON.parse(line) as Record<string, unknown>);
        }
    }
    return out;
}

describe('askOnce — one completion, hard caps, honest ∅', () => {
    it('returns the answer and records ONE route_taken=ask line with spawn_count 0', async () => {
        const dir = path.join(tmp, 'audit');
        const result = await askOnce('is the sky blue?', {
            members: [fakeClient({})],
            auditDir: dir,
            now: () => new Date('2026-08-10T12:00:00Z'),
            id: () => 'ask-test-1',
        });
        expect(result).not.toBeNull();
        expect(result!.answer).toBe('the answer');
        expect(result!.member).toBe('anthropic');

        const lines = auditLines(dir);
        expect(lines).toHaveLength(1);
        const o = lines[0]!['orchestration'] as Record<string, unknown>;
        expect(o['route_taken']).toBe('ask');
        expect(o['spawn_count']).toBe(0);
        expect(o['dispatch_tokens']).toBe(150);
        expect(o['origin']).toBe('dispatch-economy-2026');
    });

    it('returns null on provider error / empty text / thrown transport — never retries', async () => {
        expect(await askOnce('is it?', { members: [fakeClient({ error: 'boom' })], auditDir: null })).toBeNull();
        expect(await askOnce('is it?', { members: [fakeClient({ text: '' })], auditDir: null })).toBeNull();
        expect(await askOnce('is it?', { members: [fakeClient({ throws: true })], auditDir: null })).toBeNull();
    });

    it('returns null (∅) when no member resolves, and records the blocked ask', async () => {
        const dir = path.join(tmp, 'audit2');
        const result = await askOnce('is it?', { members: [], auditDir: dir });
        expect(result).toBeNull();
        const lines = auditLines(dir);
        expect(lines).toHaveLength(1);
        const o = lines[0]!['orchestration'] as Record<string, unknown>;
        expect(o['route_taken']).toBe('ask');
        expect(o['outcome']).toBe('BLOCKED');
    });

    it('honours --member selection and empty prompts', async () => {
        const a = fakeClient({ provider: 'anthropic', text: 'A' });
        const b = fakeClient({ provider: 'openai', text: 'B' });
        const result = await askOnce('which one?', { members: [a, b], member: 'openai', auditDir: null });
        expect(result!.answer).toBe('B');
        expect(await askOnce('   ', { members: [a], auditDir: null })).toBeNull();
    });
});

describe('detectBoundedQuestion — conservative rung-0.5 signal', () => {
    it('matches self-contained interrogatives and classify instructions', () => {
        expect(detectBoundedQuestion('is exponential backoff with jitter the right retry default?').matched).toBe(true);
        expect(detectBoundedQuestion('does GDPR Art. 33 set a 72h notification window?').matched).toBe(true);
        expect(detectBoundedQuestion('classify this error message: ETIMEDOUT on remote host').matched).toBe(true);
    });

    it('refuses tool-requiring objects, imperatives, multi-line briefs, unbounded prompts, non-questions', () => {
        expect(detectBoundedQuestion('does the schema allow null tenant ids?').matched).toBe(false); // "the schema" needs tools
        expect(detectBoundedQuestion('is the retry loop in src/fetch_users.ts bounded?').matched).toBe(false); // path
        expect(detectBoundedQuestion('fix the retry loop').matched).toBe(false);
        expect(detectBoundedQuestion('is it broken?\nalso refactor everything').matched).toBe(false);
        expect(detectBoundedQuestion('what should I do about ' + 'x'.repeat(300) + '?').matched).toBe(false);
        expect(detectBoundedQuestion('the sky is blue').matched).toBe(false);
        expect(detectBoundedQuestion('can you implement the parser?').matched).toBe(false);
    });
});

describe('ladder rung 0.5 + nudge line (4.2/4.3)', () => {
    const activation = { halted: false, subagent_spawn: true };
    const signals = {
        size_estimate: 0,
        parallelizable: null,
        ordered_plan: false,
        slice_count: null,
    } as never;

    it('a self-contained bounded question resolves rung 0.5 / verdict ask (below the floor)', () => {
        const r = classifyLadder({
            taskText: 'is exponential backoff with jitter the right retry default?',
            signals,
            activation,
            agentTeams: false,
        });
        expect(r.rung).toBe(0.5);
        expect(r.verdict).toBe('ask');
    });

    it('a question naming a repo object keeps the old in-session/user-ask verdict (tools needed)', () => {
        const r = classifyLadder({
            taskText: 'is the tenant check applied on the export route?',
            signals,
            activation,
            agentTeams: false,
        });
        expect(r.rung).not.toBe(0.5);
    });

    it('halt and recursive guard still win over rung 0.5', () => {
        const halted = classifyLadder({
            taskText: 'is water wet at room temperature?',
            signals,
            activation: { halted: true, subagent_spawn: true },
            agentTeams: false,
        });
        expect(halted.verdict).toBe('in-session');

        const worker = classifyLadder({
            taskText: 'is water wet at room temperature?',
            signals,
            activation,
            agentTeams: false,
            insideSubagentSession: true,
        });
        expect(worker.verdict).toBe('in-session');
    });

    it('buildNudgeLine cites the ask path for rung 0.5 — never a spawn recommendation', () => {
        const line = buildNudgeLine(
            0.5,
            { delegable: false, action: 'ask', mode: null, reason: 'bounded-question' },
            1,
            'lite',
        );
        expect(line).toContain('rung-0.5: ask, est. <1k tokens');
        expect(line).toContain('ask_transport');
        expect(line).not.toContain('dispatch single-slice');
    });

    it('classifyPrompt stays SILENT on a question prompt — the agent answers in-session', () => {
        expect(classifyPrompt('is exponential backoff the right retry default?', process.cwd(), 'claude')).toBeNull();
        expect(classifyPrompt('does the envelope validator reject prose summaries?', process.cwd(), 'claude')).toBeNull();
    });
});
