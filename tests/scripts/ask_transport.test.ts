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
        name: opts.provider ?? 'anthropic',
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

describe('subagent model ceiling (Phase 5.2, class C)', () => {
    it('resolves absent to null and a set value verbatim, memoised per cwd', async () => {
        const { _subagentModelCeiling, _resetModelCeilingMemo } = await import(
            '../../src/scripts/ai_council/clients.js'
        );
        _resetModelCeilingMemo();
        // Absent: an empty temp project (no settings file anywhere below) → null.
        const emptyCwd = path.join(tmp, 'empty-project');
        fs.mkdirSync(emptyCwd, { recursive: true });
        expect(_subagentModelCeiling(emptyCwd)).toBeNull();

        // Set value verbatim, and per-cwd memoisation keeps projects apart.
        const setCwd = path.join(tmp, 'capped-project');
        fs.mkdirSync(setCwd, { recursive: true });
        fs.writeFileSync(
            path.join(setCwd, '.agent-settings.yml'),
            'subagents:\n  model_ceiling: "claude-sonnet-4-5"\n',
        );
        expect(_subagentModelCeiling(setCwd)).toBe('claude-sonnet-4-5');
        expect(_subagentModelCeiling(emptyCwd)).toBeNull(); // A's cap never leaks to B
        _resetModelCeilingMemo();
    });
});

describe('envelope size caps (Phase 6.1 — errors, never silent truncation)', () => {
    it('accepts a bounded envelope with artifact_paths and rejects transcript-shaped ones', async () => {
        const { validateResponse, MAX_SUMMARY_CHARS } = await import(
            '../../src/scripts/_lib/subagent_response.js'
        );
        const ok = validateResponse({
            summary: 'did the thing',
            findings: [{ title: 'one finding', evidence_refs: ['src/a.ts:12'] }],
            risks: ['one risk line'],
            confidence: 'high',
            handoff: 'nothing open',
            artifact_paths: ['agents/runtime/artifacts/run-1/result.md'],
        });
        expect(ok.valid).toBe(true);

        const oversized = validateResponse({
            summary: 'x'.repeat(MAX_SUMMARY_CHARS + 1),
            findings: [],
            risks: [],
            confidence: 'high',
            handoff: 'ok',
        });
        expect(oversized.valid).toBe(false);
        expect(oversized.errors.join(' ')).toMatch(/artifact_paths/);

        const badPath = validateResponse({
            summary: 's',
            findings: [],
            risks: [],
            confidence: 'low',
            handoff: 'h',
            artifact_paths: ['multi\nline'],
        });
        expect(badPath.valid).toBe(false);
        expect(badPath.errors.join(' ')).toMatch(/single-line path ref/);

        const tooMany = validateResponse({
            summary: 's',
            findings: [],
            risks: Array.from({ length: 41 }, (_, i) => `risk ${i}`),
            confidence: 'low',
            handoff: 'h',
        });
        expect(tooMany.valid).toBe(false);
        expect(tooMany.errors.join(' ')).toMatch(/not a transcript/);
    });
});

describe('return_channel_chars (Phase 6.3 — hook-carried count)', () => {
    it('rides the orchestration line as a count and validates non-negative', async () => {
        const { buildOrchestrationLine } = await import(
            '../../src/scripts/_lib/orchestration_record.js'
        );
        const ok = buildOrchestrationLine({
            spawn_count: 1,
            token_delta: 0,
            return_channel_chars: 4200,
            ts: '2026-08-10T12:00:00.000Z',
            id: 'rc-1',
        });
        expect(ok.errors).toEqual([]);
        expect(ok.line!.orchestration).toMatchObject({ return_channel_chars: 4200 });
        expect(
            buildOrchestrationLine({
                spawn_count: 1,
                token_delta: 0,
                return_channel_chars: -1,
                ts: '2026-08-10T12:00:00.000Z',
                id: 'rc-2',
            }).errors.join(' '),
        ).toMatch(/return_channel_chars/);
    });

    it('the hook derives it from sync results and leaves async acks null', async () => {
        const { extractDispatchFacts, buildRecordInput } = await import(
            '../../src/scripts/hooks/orchestration_record_hook.js'
        );
        const sync = extractDispatchFacts({
            tool_name: 'Task',
            tool_response: { resolvedModel: 'claude-sonnet-4-5', totalTokens: 900, result: 'abc' },
        } as never);
        expect(sync.returnChannelChars).toBeGreaterThan(0);
        const input = buildRecordInput(sync, '2026-08-10T12:00:00.000Z', 'rc-3');
        expect(input.return_channel_chars).toBe(sync.returnChannelChars);

        const asyncAck = extractDispatchFacts({
            tool_name: 'Task',
            tool_response: { isAsync: true, status: 'async_launched' },
        } as never);
        expect(asyncAck.returnChannelChars).toBeNull();
        expect(buildRecordInput(asyncAck, '2026-08-10T12:00:00.000Z', 'rc-4').return_channel_chars).toBeUndefined();
    });
});

// ── served-model truth end-to-end (ledger-truth 1.1/1.2/1.4) ──
//
// The ask route is the first producer that has BOTH ids in hand, so this is
// where the field stops being a definition and becomes a recorded fact.
describe('askOnce — served-model attribution reaches the audit line', () => {
    function servedClient(served: string): ExternalAIClient {
        return {
            name: 'anthropic',
            ask: () =>
                new CouncilResponse({
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-5',
                    model_served: served,
                    text: 'the answer',
                    input_tokens: 10,
                    output_tokens: 5,
                }),
        } as unknown as ExternalAIClient;
    }

    it('carries requested + served + a true divergence when the provider substituted', async () => {
        const dir = path.join(tmp, 'audit-served');
        const result = await askOnce('q?', {
            members: [servedClient('claude-sonnet-4-5-20260101')],
            auditDir: dir,
            now: () => new Date('2026-08-11T12:00:00Z'),
            id: () => 'ask-served-1',
        });
        expect(result!.model).toBe('claude-sonnet-4-5');
        expect(result!.model_served).toBe('claude-sonnet-4-5-20260101');

        const o = auditLines(dir)[0]!['orchestration'] as Record<string, unknown>;
        expect(o['model_requested']).toBe('claude-sonnet-4-5');
        expect(o['model_served']).toBe('claude-sonnet-4-5-20260101');
        expect(o['model_divergent']).toBe(true);
    });

    it('leaves divergence null when the transport reported no served id', async () => {
        const dir = path.join(tmp, 'audit-unreported');
        await askOnce('q?', {
            members: [servedClient('')],
            auditDir: dir,
            now: () => new Date('2026-08-11T12:00:00Z'),
            id: () => 'ask-served-2',
        });
        const o = auditLines(dir)[0]!['orchestration'] as Record<string, unknown>;
        expect(o['model_served']).toBe('');
        expect(o['model_divergent']).toBeNull();
    });

    it('records nulls on the honest-∅ path — no answer served no model', async () => {
        const dir = path.join(tmp, 'audit-null');
        expect(await askOnce('q?', { members: [], auditDir: dir })).toBeNull();
        const o = auditLines(dir)[0]!['orchestration'] as Record<string, unknown>;
        expect(o['model_requested']).toBeNull();
        expect(o['model_divergent']).toBeNull();
    });
});

// ── the sentinel must not become an id (R2 review, finding 6) ─────────
describe('askOnce — the unknown-model sentinel never reaches the audit line', () => {
    it('records model_requested null, so a missing id cannot fabricate a divergence', async () => {
        const noModel = {
            name: 'anthropic',
            ask: () =>
                new CouncilResponse({
                    provider: 'anthropic',
                    model: undefined as unknown as string,
                    model_served: 'claude-sonnet-4-5-20260101',
                    text: 'the answer',
                }),
        } as unknown as ExternalAIClient;

        const dir = path.join(tmp, 'audit-sentinel');
        const result = await askOnce('q?', {
            members: [noModel],
            auditDir: dir,
            now: () => new Date('2026-08-11T12:00:00Z'),
            id: () => 'ask-sentinel',
        });
        // The public result keeps its sentinel — that shape is unchanged.
        expect(result!.model).toBe('unknown');

        const o = auditLines(dir)[0]!['orchestration'] as Record<string, unknown>;
        expect(o['model_requested']).toBeNull();
        // A served id IS present, so a naive comparison would have said `true`.
        expect(o['model_served']).toBe('claude-sonnet-4-5-20260101');
        expect(o['model_divergent']).toBeNull();
    });
});
