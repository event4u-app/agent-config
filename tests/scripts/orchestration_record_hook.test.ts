// Tests for src/scripts/hooks/orchestration_record_hook.ts — the deterministic
// PostToolUse orchestration-telemetry capture (road-to-orchestrator-discipline-
// carriers Phase 3 / F6). Imports `run` directly (like
// tests/scripts/hooks/context_hygiene_hook.test.ts) so the written JSONL file
// can be inspected — a subprocess-only test could only see the exit code.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DISPATCH_TOOL_NAMES,
    buildRecordInput,
    extractDispatchFacts,
    extractModelFamily,
    extractToolResult,
    run,
    unwrapPayload,
} from '../../src/scripts/hooks/orchestration_record_hook.js';

const AUDIT_DIR = path.join('agents', 'runtime', 'state', 'audit');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-record-hook-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** Every *.jsonl line currently on disk under the tmp consumer root, parsed. */
function readAuditLines(root: string): Record<string, unknown>[] {
    const dir = path.join(root, AUDIT_DIR);
    if (!fs.existsSync(dir)) return [];
    const lines: Record<string, unknown>[] = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        for (const line of text.split('\n')) {
            if (line.trim()) lines.push(JSON.parse(line) as Record<string, unknown>);
        }
    }
    return lines;
}

function envelope(payload: Record<string, unknown>): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'post_tool_use',
        payload,
    });
}

describe('orchestration_record_hook — dispatch detection', () => {
    it('recognises both observed dispatch tool names', () => {
        expect(DISPATCH_TOOL_NAMES.has('Agent')).toBe(true);
        expect(DISPATCH_TOOL_NAMES.has('Task')).toBe(true);
        expect(DISPATCH_TOOL_NAMES.has('Bash')).toBe(false);
    });

    it('unwraps the dispatcher envelope down to the platform payload', () => {
        const env = { schema_version: 1, platform: 'claude', event: 'post_tool_use', payload: { tool_name: 'Agent' } };
        expect(unwrapPayload(env)).toEqual({ tool_name: 'Agent' });
    });

    it('falls back to the top-level object for a raw/legacy payload', () => {
        expect(unwrapPayload({ tool_name: 'Agent' })).toEqual({ tool_name: 'Agent' });
    });
});

describe('orchestration_record_hook — an Agent dispatch writes exactly one line', () => {
    it('a sync completion writes one orchestration line with real measured values', () => {
        const status = run(
            envelope({
                tool_name: 'Agent',
                tool_input: { subagent_type: 'Explore', description: 'd', prompt: 'p' },
                tool_response: { resolvedModel: 'claude-sonnet-4-5', totalTokens: 1234, totalDurationMs: 5000, totalToolUseCount: 3 },
            }),
            { consumer_root: tmp },
        );
        expect(status).toBe(0);

        const lines = readAuditLines(tmp);
        expect(lines).toHaveLength(1);
        const line = lines[0]!;
        expect(line['schema_version']).toBe(1);
        expect(line['input_kind']).toBe('orchestration');

        const o = line['orchestration'] as Record<string, unknown>;
        expect(o['spawn_count']).toBe(1);
        expect(o['dispatch_tokens']).toBe(1234);
        expect(o['wall_clock_ms']).toBe(5000);
        // The `audit-log-v1` contract's `tiers` field wants a tier NAME
        // ("sonnet"/"opus"), never the full model id — F9 (review).
        expect(o['tiers']).toEqual(['sonnet']);
        expect(o['agent_combo']).toEqual(['Explore']);
        // No baseline exists at this layer — the delta is never fabricated.
        expect(o['token_delta']).toBe(0);
        expect(o['token_delta_provenance']).toBe('estimated');
        expect(o['verify_mode']).toBe('none');
    });

    it('accepts the `Task` tool name too', () => {
        const status = run(
            envelope({ tool_name: 'Task', tool_response: { totalTokens: 10 } }),
            { consumer_root: tmp },
        );
        expect(status).toBe(0);
        expect(readAuditLines(tmp)).toHaveLength(1);
    });

    it('falls back to usage.input_tokens + usage.output_tokens when totalTokens is absent', () => {
        run(
            envelope({ tool_name: 'Agent', tool_response: { usage: { input_tokens: 100, output_tokens: 50 } } }),
            { consumer_root: tmp },
        );
        const [line] = readAuditLines(tmp);
        expect((line!['orchestration'] as Record<string, unknown>)['dispatch_tokens']).toBe(150);
    });

    it('records dispatch_outcome killed on an errored tool call', () => {
        run(envelope({ tool_name: 'Agent', is_error: true, tool_response: { totalTokens: 5 } }), { consumer_root: tmp });
        const [line] = readAuditLines(tmp);
        expect((line!['orchestration'] as Record<string, unknown>)['outcome']).toBe('killed');
    });
});

describe('orchestration_record_hook — an async launch records the fact, never fabricated metrics', () => {
    it('an async ack writes one line with spawn_count 1 and every metric absent', () => {
        const status = run(
            envelope({
                tool_name: 'Agent',
                tool_input: { subagent_type: 'general-purpose' },
                tool_response: { resolvedModel: 'claude-sonnet-4-5', isAsync: true, status: 'async_launched' },
            }),
            { consumer_root: tmp },
        );
        expect(status).toBe(0);

        const lines = readAuditLines(tmp);
        expect(lines).toHaveLength(1);
        const o = lines[0]!['orchestration'] as Record<string, unknown>;
        expect(o['spawn_count']).toBe(1);
        // Async never carries usage — nothing here is fabricated from a guess.
        expect(o['dispatch_tokens']).toBeNull();
        expect(o['wall_clock_ms']).toBe(0); // schema's own "not recorded" default, not a measured zero
        expect(o['tiers']).toEqual([]);
        expect(o['agent_combo']).toEqual(['general-purpose']);
    });

    it('extractDispatchFacts marks an async status string the same as isAsync: true', () => {
        const facts = extractDispatchFacts({ tool_response: { status: 'async_launched' } });
        expect(facts.isAsync).toBe(true);
        expect(facts.totalTokens).toBeNull();
    });
});

describe('orchestration_record_hook — non-dispatch tool calls never write anything', () => {
    it('an unrelated tool (Bash) writes no line and creates no audit directory', () => {
        const status = run(
            envelope({ tool_name: 'Bash', tool_input: { command: 'git status' }, tool_response: 'On branch main\n' }),
            { consumer_root: tmp },
        );
        expect(status).toBe(0);
        expect(fs.existsSync(path.join(tmp, AUDIT_DIR))).toBe(false);
    });

    it('a tool call with no tool_name writes nothing', () => {
        run(envelope({ tool_response: { totalTokens: 999 } }), { consumer_root: tmp });
        expect(readAuditLines(tmp)).toHaveLength(0);
    });
});

describe('orchestration_record_hook — malformed input never blocks (exit 0, silent)', () => {
    it('unparseable JSON on stdin', () => {
        expect(run('not json {', { consumer_root: tmp })).toBe(0);
        expect(fs.existsSync(path.join(tmp, AUDIT_DIR))).toBe(false);
    });

    it('empty stdin', () => {
        expect(run('', { consumer_root: tmp })).toBe(0);
    });

    it('a JSON array instead of an object', () => {
        expect(run('[1,2,3]', { consumer_root: tmp })).toBe(0);
    });

    it('an Agent dispatch whose tool_response is a bare string (not an object)', () => {
        const status = run(envelope({ tool_name: 'Agent', tool_response: 'launched' }), { consumer_root: tmp });
        expect(status).toBe(0);
        // Still a real dispatch completion — the fact is recorded, just with
        // every metric absent (extractToolResult returned null for a string).
        expect(readAuditLines(tmp)).toHaveLength(1);
    });

    it('extractToolResult ignores a string value and only accepts a decoded object', () => {
        expect(extractToolResult({ tool_response: 'not an object' })).toBeNull();
        expect(extractToolResult({ tool_response: { a: 1 } })).toEqual({ a: 1 });
    });

    it('a write failure (unwritable consumer_root) degrades to exit 0', () => {
        // A path that cannot be created under (a file, not a directory) makes
        // mkdirSync throw — the hook must swallow it, never crash the tool call.
        const blocker = path.join(tmp, 'blocked-file');
        fs.writeFileSync(blocker, 'x');
        const fakeRoot = path.join(blocker, 'nested'); // parent is a file, not a dir
        expect(run(envelope({ tool_name: 'Agent', tool_response: { totalTokens: 1 } }), { consumer_root: fakeRoot })).toBe(0);
    });
});

describe('buildRecordInput — pure mapping (no I/O)', () => {
    it('produces a valid RecordInput shape for a sync dispatch, reduced to a tier name', () => {
        const input = buildRecordInput(
            { subagentType: 'Explore', resolvedModel: 'claude-sonnet-4-5-20250929', totalTokens: 42, totalDurationMs: 7, isAsync: false, isError: false },
            '2026-08-08T00:00:00.000Z',
            'fixed-id',
        );
        expect(input).toMatchObject({
            spawn_count: 1,
            token_delta: 0,
            token_delta_provenance: 'estimated',
            verify_mode: 'none',
            agent_combo: ['Explore'],
            tiers: ['sonnet'],
            dispatch_tokens: 42,
            wall_clock_ms: 7,
            ts: '2026-08-08T00:00:00.000Z',
            id: 'fixed-id',
        });
    });

    it('omits tiers entirely when the resolved model matches no known family (F9)', () => {
        const input = buildRecordInput(
            { subagentType: 'Explore', resolvedModel: 'some-unrecognised-model-id', totalTokens: 42, totalDurationMs: 7, isAsync: false, isError: false },
            '2026-08-08T00:00:00.000Z',
            'fixed-id',
        );
        expect(input.tiers).toBeUndefined();
    });

    it('never sets tiers/dispatch_tokens/wall_clock_ms on an async dispatch, even if present', () => {
        // Defence-in-depth: even a resolvedModel/totalTokens leaking through on
        // an async ack must not be recorded as if it were the real cost.
        const input = buildRecordInput(
            { subagentType: null, resolvedModel: 'claude-sonnet-4-5', totalTokens: 999, totalDurationMs: 999, isAsync: true, isError: false },
            '2026-08-08T00:00:00.000Z',
            'fixed-id',
        );
        expect(input.tiers).toBeUndefined();
        expect(input.dispatch_tokens).toBeUndefined();
        expect(input.wall_clock_ms).toBeUndefined();
    });
});

describe('extractModelFamily — F9: reduce a full model id to the tiers-contract vocabulary', () => {
    it.each([
        ['claude-sonnet-4-5-20250929', 'sonnet'],
        ['claude-opus-4-1-20250805', 'opus'],
        ['claude-haiku-4-5', 'haiku'],
        ['us.anthropic.claude-opus-4-1-20250805-v1:0', 'opus'],
        ['fable-1', 'fable'],
    ] as const)('%s → %s', (modelId, family) => {
        expect(extractModelFamily(modelId)).toBe(family);
    });

    it('an unrecognised model id resolves to null, never the raw id', () => {
        expect(extractModelFamily('some-unrecognised-model-id')).toBeNull();
    });

    it('is case-insensitive', () => {
        expect(extractModelFamily('CLAUDE-SONNET-4-5')).toBe('sonnet');
    });
});
