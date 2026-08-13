/**
 * subagent-ledger — capture behaviour and the privacy floor
 * (road-to-subagent-lifecycle-integrity Phase 1, Steps 2+3).
 *
 * Two things are asserted here and they are not the same kind of claim.
 *
 * The behaviour tests pin what the ledger records: correlation across the two
 * separate hook invocations that bracket one dispatch, depth resolved from the
 * open-record set rather than asserted, and the three-way envelope verdict
 * whose middle value (`fail`) is the whole reason the measurement exists — a
 * baseline that cannot separate "no envelope returned" from "a malformed one
 * returned" cannot tell two different defects apart.
 *
 * The privacy test pins something the file's prose alone cannot: that no
 * host `agent_id` and no line of the subagent's final message reaches disk.
 * It plants the hostile values in the FIELDS under test and then greps every
 * byte the hook wrote — a negative test that passes because the value is
 * absent from the output, not because the assertion was never reachable.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    classifyEnvelope,
    LEDGER_DIR,
    OPEN_SUBDIR,
    processEnvelope,
    readOpenRecords,
    refFor,
    resolveDepth,
    type OpenRecord,
} from '../../src/scripts/hooks/subagent_ledger_hook.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-ledger-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

/** Every byte the hook wrote under the ledger root, concatenated. */
function allWrittenBytes(): string {
    const dir = path.join(root, LEDGER_DIR);
    if (!fs.existsSync(dir)) return '';
    const parts: string[] = [];
    const walk = (d: string): void => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, entry.name);
            if (entry.isDirectory()) walk(p);
            else parts.push(fs.readFileSync(p, 'utf8'));
        }
    };
    walk(dir);
    return parts.join('\n');
}

function ledgerLines(): Array<Record<string, unknown>> {
    const dir = path.join(root, LEDGER_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: Array<Record<string, unknown>> = [];
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.jsonl')) continue;
        for (const line of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
            if (line.trim()) out.push(JSON.parse(line) as Record<string, unknown>);
        }
    }
    return out;
}

function envelope(event: string, payload: Record<string, unknown>): Record<string, unknown> {
    return { schema_version: 1, platform: 'claude', event, payload };
}

describe('subagent-ledger — event filtering', () => {
    it('writes nothing for an event outside the subagent pair', () => {
        processEnvelope(envelope('post_tool_use', { tool_name: 'Agent' }), root);
        expect(fs.existsSync(path.join(root, LEDGER_DIR))).toBe(false);
    });

    it('writes nothing when the payload carries no agent id to correlate on', () => {
        processEnvelope(envelope('subagent_start', { agent_type: 'Explore' }), root);
        expect(ledgerLines()).toEqual([]);
    });

    it('never returns a non-zero exit, even on a malformed envelope', () => {
        expect(processEnvelope('not an object', root)).toBe(0);
        expect(processEnvelope(envelope('subagent_stop', {}), root)).toBe(0);
    });
});

describe('subagent-ledger — start/stop correlation', () => {
    it('opens a record on start and closes it on stop', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'agent-abc', agent_type: 'Explore' }), root);

        const open = readOpenRecords(root);
        expect(open.size).toBe(1);
        expect([...open.values()][0]?.agent_type).toBe('Explore');

        processEnvelope(
            envelope('subagent_stop', {
                agent_id: 'agent-abc',
                last_assistant_message: '{"summary":"s","handoff":"h","confidence":"high","findings":[],"risks":[]}',
            }),
            root,
        );

        expect(readOpenRecords(root).size).toBe(0);
        expect(fs.existsSync(path.join(root, LEDGER_DIR, OPEN_SUBDIR, `${refFor('agent-abc')}.json`))).toBe(false);

        const lines = ledgerLines();
        expect(lines.map((l) => l.event)).toEqual(['subagent_start', 'subagent_stop']);
        const stop = lines[1]!;
        expect(stop.start_seen).toBe(true);
        expect(typeof stop.duration_ms).toBe('number');
        expect(stop.envelope_parse).toBe('ok');
    });

    it('records a stop whose start was never seen as start_seen:false, not duration 0', () => {
        processEnvelope(envelope('subagent_stop', { agent_id: 'orphan', agent_type: 'Explore' }), root);

        const stop = ledgerLines()[0]!;
        expect(stop.start_seen).toBe(false);
        // `null`, never 0 — a fabricated zero would read as an instant dispatch
        // and silently pollute the duration distribution the baseline reports.
        expect(stop.duration_ms).toBeNull();
        expect(stop.agent_type).toBe('Explore');
    });

    it('counts concurrent open dispatches, including the one being opened', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'a' }), root);
        processEnvelope(envelope('subagent_start', { agent_id: 'b' }), root);
        processEnvelope(envelope('subagent_start', { agent_id: 'c' }), root);

        expect(ledgerLines().map((l) => l.concurrent_open)).toEqual([1, 2, 3]);
    });
});

describe('subagent-ledger — depth (Step 3)', () => {
    it('records a start with no parent field as depth 1, basis assumed-root', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'root-agent' }), root);

        const start = ledgerLines()[0]!;
        expect(start.depth).toBe(1);
        // The distinction that matters: the payload said nothing, so the
        // record says "assumed", never "measured root".
        expect(start.depth_basis).toBe('assumed-root');
        expect(start.parent_ref).toBeNull();
    });

    it('resolves a nested spawn against the open parent record', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'parent' }), root);
        processEnvelope(envelope('subagent_start', { agent_id: 'child', parent_agent_id: 'parent' }), root);

        const child = ledgerLines()[1]!;
        expect(child.depth).toBe(2);
        expect(child.depth_basis).toBe('observed');
        expect(child.parent_ref).toBe(refFor('parent'));
    });

    it('treats a session-level agent id distinct from the starter as the parent', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'p2' }), root);
        processEnvelope(
            envelope('subagent_start', { agent_id: 'c2', session: { agent_id: 'p2' } }),
            root,
        );

        expect(ledgerLines()[1]!.parent_ref).toBe(refFor('p2'));
    });

    it('still counts nesting when the named parent has already closed', () => {
        // The payload asserted a parent, so the FACT of nesting is known even
        // though the ancestor chain is not — depth 2, basis observed.
        const open = new Map<string, OpenRecord>();
        expect(resolveDepth('missing-ref', open)).toEqual({ depth: 2, depth_basis: 'observed' });
    });
});

describe('subagent-ledger — envelope classification', () => {
    const valid = { summary: 's', handoff: 'h', confidence: 'high', findings: [], risks: [] };

    it('reports ok for a valid bare envelope', () => {
        expect(classifyEnvelope(JSON.stringify(valid))).toEqual({ verdict: 'ok', error_count: 0 });
    });

    it('reports ok for a valid envelope inside a fenced json block', () => {
        expect(classifyEnvelope(`here you go:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\`\n`).verdict).toBe('ok');
    });

    it('reports fail — with an error COUNT, not the messages — for a malformed envelope', () => {
        const verdict = classifyEnvelope('{"summary":"s"}');
        expect(verdict.verdict).toBe('fail');
        expect(verdict.error_count).toBeGreaterThan(0);
    });

    it('separates absent from fail', () => {
        expect(classifyEnvelope(null).verdict).toBe('absent');
        expect(classifyEnvelope('   ').verdict).toBe('absent');
        expect(classifyEnvelope('I finished the task, no structured output.').verdict).toBe('absent');
    });
});

describe('subagent-ledger — privacy by construction', () => {
    // High-entropy, unique, and planted in the exact fields the hook reads —
    // so a hit in the written bytes can only have come through the code path
    // under test.
    const HOST_ID = 'ag_7f3c9d2b41e85a6079bc4d1f2e3a5b8c';
    const SECRET_PROSE = 'ZZQX-do-not-persist-this-sentence-9182';

    it('writes no host agent id and no line of the final message to disk', () => {
        processEnvelope(envelope('subagent_start', { agent_id: HOST_ID, agent_type: 'general-purpose' }), root);
        processEnvelope(
            envelope('subagent_stop', {
                agent_id: HOST_ID,
                last_assistant_message: `${SECRET_PROSE} {"summary":"${SECRET_PROSE}","handoff":"h"}`,
            }),
            root,
        );

        const written = allWrittenBytes();
        // The test is only meaningful if the hook wrote something at all.
        expect(written.length).toBeGreaterThan(0);
        expect(written).not.toContain(HOST_ID);
        expect(written).not.toContain(SECRET_PROSE);
        // …and the correlation key that replaced the id IS there, so the
        // absence above is redaction rather than the hook silently doing nothing.
        expect(written).toContain(refFor(HOST_ID));
    });

    it('derives a stable ref across the two separate invocations', () => {
        // Start and stop run in different processes; an unstable (e.g. salted
        // per-run) key would break the only thing the ref exists for.
        expect(refFor(HOST_ID)).toBe(refFor(HOST_ID));
        expect(refFor(HOST_ID)).toHaveLength(12);
        expect(refFor(HOST_ID)).not.toBe(refFor(`${HOST_ID}x`));
    });
});
