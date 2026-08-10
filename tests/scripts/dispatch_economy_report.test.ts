import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    buildReport,
    computeLegs,
    median,
    readAuditOrchestrations,
} from '../../src/scripts/dispatch_economy_report.js';
import { scanTranscripts } from '../../src/scripts/_lib/cc_transcript.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-economy-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** One transcript assistant record in the host JSONL shape cc_transcript parses. */
function rec(opts: {
    id: string;
    reqId: string;
    agentId?: string;
    ts: string;
    input?: number;
    read?: number;
    write?: number;
}): string {
    return JSON.stringify({
        type: 'assistant',
        timestamp: opts.ts,
        requestId: opts.reqId,
        ...(opts.agentId !== undefined ? { agentId: opts.agentId } : {}),
        message: {
            id: opts.id,
            model: 'claude-sonnet-4-5',
            usage: {
                input_tokens: opts.input ?? 0,
                cache_read_input_tokens: opts.read ?? 0,
                cache_creation_input_tokens: opts.write ?? 0,
                output_tokens: 10,
            },
        },
    });
}

function writeTranscripts(): string {
    const root = path.join(tmp, 'projects');
    const proj = path.join(root, 'proj-a');
    fs.mkdirSync(proj, { recursive: true });
    const lines = [
        // main-session record — must not form a leg
        rec({ id: 'm1', reqId: 'r0', ts: '2026-08-10T10:00:00Z', read: 500000 }),
        // leg A: init 100k (write), then 20k + 20k work → ratio 2.5
        rec({ id: 'a1', reqId: 'r1', agentId: 'leg-a', ts: '2026-08-10T10:01:00Z', write: 100000 }),
        rec({ id: 'a2', reqId: 'r2', agentId: 'leg-a', ts: '2026-08-10T10:02:00Z', read: 20000 }),
        rec({ id: 'a3', reqId: 'r3', agentId: 'leg-a', ts: '2026-08-10T10:03:00Z', read: 20000 }),
        // replay of a2 — same message.id+requestId, must dedupe away
        rec({ id: 'a2', reqId: 'r2', agentId: 'leg-a', ts: '2026-08-10T10:02:30Z', read: 20000 }),
        // leg B: init 50k, then 50k → ratio 1.0
        rec({ id: 'b1', reqId: 'r4', agentId: 'leg-b', ts: '2026-08-10T10:04:00Z', write: 50000 }),
        rec({ id: 'b2', reqId: 'r5', agentId: 'leg-b', ts: '2026-08-10T10:05:00Z', read: 50000 }),
        // leg C: single call — floor-only, ratio null
        rec({ id: 'c1', reqId: 'r6', agentId: 'leg-c', ts: '2026-08-10T10:06:00Z', write: 80000 }),
    ];
    fs.writeFileSync(path.join(proj, 'session.jsonl'), lines.join('\n') + '\n');
    return root;
}

function writeAudit(): string {
    const dir = path.join(tmp, 'audit');
    fs.mkdirSync(dir, { recursive: true });
    const lines = [
        JSON.stringify({ schema_version: 1, orchestration: { rules_carried: 30, rules_used: 3 } }),
        JSON.stringify({ schema_version: 1, orchestration: { rules_carried: 10, rules_used: 8 } }),
        JSON.stringify({
            schema_version: 1,
            orchestration: {
                agent_combo: ['code-reviewer'],
                floor_provenance: 'measured',
                init_tokens: 60000,
                work_tokens: 12000,
            },
        }),
        // reviewer line WITHOUT measured provenance — must not count
        JSON.stringify({
            schema_version: 1,
            orchestration: { agent_combo: ['judge-synthesis'], init_tokens: 999999, work_tokens: 1 },
        }),
        'not json — skipped',
    ];
    fs.writeFileSync(path.join(dir, '2026-08.jsonl'), lines.join('\n') + '\n');
    return dir;
}

describe('median', () => {
    it('handles empty, odd, and even inputs', () => {
        expect(median([])).toBeNull();
        expect(median([3, 1, 2])).toBe(2);
        expect(median([1, 2, 3, 4])).toBe(2.5);
    });
});

describe('computeLegs', () => {
    it('groups subagent records per agentId, splits init vs work, marks single-call legs', () => {
        const root = writeTranscripts();
        const scan = scanTranscripts({ root });
        const legs = computeLegs(scan.records);
        expect(legs).toHaveLength(3);
        const a = legs.find((l) => l.agentId === 'leg-a')!;
        expect(a.calls).toBe(3); // replay deduped away
        expect(a.init_tokens).toBe(100000);
        expect(a.work_tokens).toBe(40000);
        // COST-shaped ratio: init 100k write ×1.25 = 125k units; work 2×20k read ×0.1 = 4k units
        expect(a.ratio).toBeCloseTo(31.25);
        const b = legs.find((l) => l.agentId === 'leg-b')!;
        expect(b.ratio).toBeCloseTo(12.5); // 62.5k write-units / 5k read-units
        const c = legs.find((l) => l.agentId === 'leg-c')!;
        expect(c.work_tokens).toBe(0);
        expect(c.ratio).toBeNull();
    });
});

describe('readAuditOrchestrations', () => {
    it('reads orchestration objects, skipping non-JSON lines and missing dirs', () => {
        expect(readAuditOrchestrations(path.join(tmp, 'nope'))).toEqual([]);
        const dir = writeAudit();
        expect(readAuditOrchestrations(dir)).toHaveLength(4);
    });
});

describe('buildReport', () => {
    it('computes registered metrics against the committed thresholds', () => {
        const root = writeTranscripts();
        const auditDir = writeAudit();
        const report = buildReport({ root, auditDir, maxAgeDays: 3650, now: new Date('2026-08-11T00:00:00Z') });

        expect(report.schema).toBe('dispatch-economy-report/v1');
        const worker = report.dispatch_floor.roles.find((r) => r.role === 'worker')!;
        expect(worker.legs).toBe(3);
        expect(worker.single_call_legs).toBe(1);
        expect(worker.median_init_tokens).toBe(80000); // [100k, 50k, 80k] → 80k
        expect(worker.median_ratio_finite).toBeCloseTo(21.875); // [31.25, 12.5]
        // 21.875 > 1.0 → the single-run projection-mandatory signal fires
        expect(report.dispatch_floor.projection_mandatory_signal).toBe(true);

        const reviewer = report.dispatch_floor.roles.find((r) => r.role === 'reviewer')!;
        expect(reviewer.legs).toBe(1); // only the measured-provenance line counts
        expect(reviewer.median_init_tokens).toBe(60000);
        expect(reviewer.median_ratio_finite).toBeCloseTo(5.0);

        // quotas: [0.1, 0.8] → median 0.45 → not below the 0.2 low-quota bar
        expect(report.rules_efficiency.envelopes_with_pair).toBe(2);
        expect(report.rules_efficiency.median_quota).toBeCloseTo(0.45);
        expect(report.rules_efficiency.low_quota_signal).toBe(false);
    });

    it('reports null signals honestly when no data exists', () => {
        const root = path.join(tmp, 'empty-projects');
        fs.mkdirSync(root, { recursive: true });
        const report = buildReport({ root, auditDir: path.join(tmp, 'no-audit'), maxAgeDays: 14 });
        expect(report.dispatch_floor.projection_mandatory_signal).toBeNull();
        expect(report.rules_efficiency.median_quota).toBeNull();
        expect(report.rules_efficiency.low_quota_signal).toBeNull();
    });
});
