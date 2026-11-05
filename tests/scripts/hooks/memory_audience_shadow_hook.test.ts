// road-to-a-memory-each-worker-is-handed 2.2 + 2.3 — one record-only concern.
//   2.2  a child (payload carries agent_id) writing under agents/memory/ produces
//        one record; the same write without agent_id produces none. Never denies.
//   2.3  at the orchestrator's Agent call the slice is computed and only its counts
//        are logged; nothing is delivered to the model.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LEDGER_DIR } from '../../../src/scripts/hooks/subagent_ledger_hook.js';
import { processEnvelope } from '../../../src/scripts/hooks/memory_audience_shadow_hook.js';
import { EXIT_ALLOW } from '../../../src/scripts/hooks/exit_codes.js';

let root: string;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mem-audience-'));
    mkdirSync(join(root, 'agents', 'memory'), { recursive: true });
    writeFileSync(join(root, 'agents', 'memory', 'historical-patterns.yml'), 'x'.repeat(400));
    writeFileSync(join(root, 'agents', 'memory', 'product-rules.yml'), 'y'.repeat(800));
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
});

function ledgerLines(): Record<string, unknown>[] {
    const dir = join(root, LEDGER_DIR);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => f.endsWith('.jsonl'))
        .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').filter((l) => l.trim()))
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

function write(agentId: string | null, filePath: string, tool = 'Write'): Record<string, unknown> {
    return {
        event: 'pre_tool_use',
        platform: 'claude',
        payload: {
            hook_event_name: 'PreToolUse',
            tool_name: tool,
            ...(agentId === null ? {} : { agent_id: agentId }),
            tool_input: { file_path: filePath, content: 'a lesson' },
        },
    };
}

function spawn(prompt: string, agentId: string | null = null): Record<string, unknown> {
    return {
        event: 'pre_tool_use',
        platform: 'claude',
        payload: {
            hook_event_name: 'PreToolUse',
            tool_name: 'Agent',
            ...(agentId === null ? {} : { agent_id: agentId }),
            tool_input: { prompt, subagent_type: 'general-purpose' },
        },
    };
}

describe('2.2 — record-only guard on child writes to agents/memory/', () => {
    it('a child Write under agents/memory/ produces exactly one record and allows', () => {
        expect(processEnvelope(write('agent-abc', 'agents/memory/intake/signals-2026-11.jsonl'), root)).toBe(EXIT_ALLOW);
        const lines = ledgerLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ event: 'memory_child_write', tool: 'Write', target: 'intake', posture: 'record-only' });
        // Privacy by construction: no agent id, no path, no content reaches disk.
        const raw = JSON.stringify(lines[0]);
        expect(raw).not.toContain('agent-abc');
        expect(raw).not.toContain('signals-2026-11');
        expect(raw).not.toContain('a lesson');
    });

    it('an absolute path inside the root counts as the same write', () => {
        processEnvelope(write('agent-abc', join(root, 'agents', 'memory', 'product-rules.yml'), 'Edit'), root);
        expect(ledgerLines()).toMatchObject([{ event: 'memory_child_write', tool: 'Edit', target: 'curated' }]);
    });

    it('the same write without agent_id produces no record', () => {
        expect(processEnvelope(write(null, 'agents/memory/intake/signals-2026-11.jsonl'), root)).toBe(EXIT_ALLOW);
        expect(ledgerLines()).toHaveLength(0);
    });

    it('a child write outside agents/memory/ produces no record', () => {
        processEnvelope(write('agent-abc', 'src/agents/memory-notes.ts'), root);
        processEnvelope(write('agent-abc', 'agents/memoryx/a.yml'), root);
        expect(ledgerLines()).toHaveLength(0);
    });
});

describe('2.3 — counts-only slice shadow at the orchestrator spawn', () => {
    it('a prompt naming two curated paths logs ref_count: 2 and emits no context', () => {
        const out = vi.spyOn(process.stdout, 'write');
        const prompt =
            'Fix the checkout bug. See agents/memory/historical-patterns.yml and ' +
            'agents/memory/product-rules.yml, and again agents/memory/product-rules.yml.';
        expect(processEnvelope(spawn(prompt), root)).toBe(EXIT_ALLOW);
        expect(out).not.toHaveBeenCalled();
        const lines = ledgerLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({
            event: 'memory_slice_shadow',
            ref_count: 2,
            dropped: 0,
            est_tokens: 300,
            delivered: false,
            posture: 'shadow',
        });
        expect(JSON.stringify(lines[0])).not.toContain('checkout');
    });

    it('caps the slice at the spawn contract maximum and counts the rest as dropped', () => {
        const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => `agents/memory/${n}.yml`);
        processEnvelope(spawn(`refs: ${names.join(' ')}`), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 5, dropped: 2, est_tokens: 0 });
    });

    it('intake lines are never part of the curated slice', () => {
        processEnvelope(spawn('look at agents/memory/intake/signals-2026-11.jsonl'), root);
        expect(ledgerLines()[0]).toMatchObject({ ref_count: 0, dropped: 0 });
    });

    it("a child's own spawn is not the orchestrator's and is not measured", () => {
        processEnvelope(spawn('agents/memory/product-rules.yml', 'agent-abc'), root);
        expect(ledgerLines()).toHaveLength(0);
    });
});
