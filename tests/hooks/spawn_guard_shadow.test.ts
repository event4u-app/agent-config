/**
 * spawn-guard-shadow — Phase 3 Step 1, shadow posture.
 *
 * The load-bearing assertion is the negative one: there is no input that makes
 * this concern deny, warn, or emit anything to the model. Everything else it
 * does is measurement, and a measurement that can change the run is not a
 * measurement.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CANDIDATES,
    evaluateCandidates,
    processEnvelope,
} from '../../src/scripts/hooks/spawn_guard_shadow_hook.js';
import { LEDGER_DIR, OPEN_SUBDIR } from '../../src/scripts/hooks/subagent_ledger_hook.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'spawn-guard-shadow-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function plantOpen(ref: string, depth: number): void {
    const dir = path.join(root, LEDGER_DIR, OPEN_SUBDIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, `${ref}.json`),
        JSON.stringify({
            ref,
            agent_type: 'Explore',
            started_at: new Date().toISOString(),
            parent_ref: null,
            depth,
            depth_basis: 'observed',
            session_id: null,
        }),
        'utf8',
    );
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

function toolCall(name: string): Record<string, unknown> {
    return { schema_version: 1, platform: 'claude', event: 'pre_tool_use', payload: { tool_name: name } };
}

describe('spawn-guard-shadow — posture', () => {
    it('never denies: every input returns EXIT_ALLOW', () => {
        // Including the state that a shipped guard would refuse outright.
        for (let i = 0; i < 12; i++) plantOpen(`open${i}`, 6);
        expect(processEnvelope(toolCall('Agent'), root)).toBe(0);
        expect(processEnvelope(toolCall('Task'), root)).toBe(0);
        expect(processEnvelope('garbage', root)).toBe(0);
        expect(processEnvelope({ event: 'pre_tool_use' }, root)).toBe(0);
    });

    it('records posture: shadow on the line itself', () => {
        processEnvelope(toolCall('Agent'), root);
        expect(ledgerLines()[0]!.posture).toBe('shadow');
    });

    it('ignores tools that are not a subagent dispatch', () => {
        processEnvelope(toolCall('Bash'), root);
        processEnvelope(toolCall('Read'), root);
        expect(ledgerLines()).toEqual([]);
    });
});

describe('spawn-guard-shadow — the candidate spread', () => {
    it('evaluates every candidate, not just the pre-registered pair', () => {
        processEnvelope(toolCall('Agent'), root);
        const line = ledgerLines()[0]!;
        const labels = (line.candidates as Array<{ label: string }>).map((c) => c.label);
        expect(labels).toEqual(CANDIDATES.map((c) => c.label));
        // A spread is the point: one candidate yields a verdict, three yield a
        // curve, and the activation policy derives the shipped value from the
        // curve rather than from the roadmap's starting guess.
        expect(labels.length).toBeGreaterThan(1);
    });

    it('separates the two arms so a reader knows which one tripped', () => {
        expect(evaluateCandidates(1, 4)).toEqual([
            { label: 'n2m4', would_deny: true, on: ['concurrent'] },
            { label: 'n3m6', would_deny: false, on: [] },
            { label: 'n4m8', would_deny: false, on: [] },
        ]);
        expect(evaluateCandidates(4, 0)).toEqual([
            { label: 'n2m4', would_deny: true, on: ['depth'] },
            { label: 'n3m6', would_deny: true, on: ['depth'] },
            { label: 'n4m8', would_deny: true, on: ['depth'] },
        ]);
        expect(evaluateCandidates(9, 9)).toEqual([
            { label: 'n2m4', would_deny: true, on: ['depth', 'concurrent'] },
            { label: 'n3m6', would_deny: true, on: ['depth', 'concurrent'] },
            { label: 'n4m8', would_deny: true, on: ['depth', 'concurrent'] },
        ]);
    });

    it('denies nothing on a quiet estate', () => {
        expect(evaluateCandidates(1, 0).every((v) => !v.would_deny)).toBe(true);
    });
});

describe('spawn-guard-shadow — depth estimate honesty', () => {
    it('labels the estimate rather than presenting it as measured', () => {
        plantOpen('a', 2);
        processEnvelope(toolCall('Agent'), root);

        const line = ledgerLines()[0]!;
        // Pre-spawn there is no agent id to resolve a real parent from, so the
        // number is an upper bound. The basis rides with it so nobody derives
        // a percentile from it believing it was observed.
        expect(line.depth_estimate).toBe(3);
        expect(line.depth_estimate_basis).toBe('deepest-open-record-plus-one');
    });

    it('reads an empty estate as depth 1, not 0', () => {
        processEnvelope(toolCall('Agent'), root);
        expect(ledgerLines()[0]!.depth_estimate).toBe(1);
        expect(ledgerLines()[0]!.concurrent_open).toBe(0);
    });
});
