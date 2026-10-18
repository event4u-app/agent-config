import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendLoop, type LoopRow } from '../../src/scripts/analysis_ledger.js';
import {
    RUN_JSON,
    buildRunJson,
    readRunJson,
    validateRunJson,
    writeRunJson,
    type RunJsonInput,
} from '../../src/scripts/analysis_run_record.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-run-record-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const READ = { source_identity: 'src/a.ts', digest: 'sha256:1', method: 'read', claim: 'supported' as const, tier: 'read' as const };
const CLAIMED = { ...READ, tier: 'claimed' as const };

function ledger(): LoopRow[] {
    let l: LoopRow[] = [];
    l = appendLoop(l, { lens: 'coverage', items: [{ id: 'g1', change: 'added', evidence: [READ] }] });
    l = appendLoop(l, {
        lens: 'adversary',
        items: [
            { id: 'g1', change: 'changed', evidence: [READ] },
            { id: 'g2', change: 'killed', evidence: [READ] },
        ],
    });
    l = appendLoop(l, { lens: 'overbuild-sequencing', items: [{ id: 'g3', change: 'added', evidence: [CLAIMED] }] });
    return l;
}

function input(): RunJsonInput {
    return {
        run_id: 'r1',
        door: 'inbox',
        started_at: '2026-10-18T08:00:00.000Z',
        ended_at: '2026-10-18T09:30:00.000Z',
        final_state: 'validated',
        analysts: [
            { analyst_id: 'sub:1', mode: 'subagent', family: 'anthropic', ledger: ledger(), tokens: 1000 },
            { analyst_id: 'cli:openai', mode: 'cli', family: 'openai', ledger: ledger(), tokens: 2000 },
        ],
        exchange: { rounds: 1, already_fixed: 2, claims_checked: 8 },
        gain: { offered: false, band: 'low', reason: 'plateau' },
        seats: { used: ['anthropic', 'openai'], failed: [] },
        roadmaps_emitted: ['agents/roadmaps/road-to-x.md'],
        recurrence_hits: 1,
        ci_rounds: 0,
        turnaround: { user_requests: 3, blocking_calls: 1 },
    };
}

describe('run.json (step 6.3)', () => {
    it('carries one row per analyst and loop, counting only top-tier changes', () => {
        const doc = buildRunJson(input());
        expect(doc.rows).toHaveLength(6);
        const first = doc.rows.filter((r) => r.analyst_id === 'sub:1');
        expect(first.map((r) => r.loop)).toEqual([1, 2, 3]);
        expect(first[0]).toMatchObject({ lens: 'coverage', top_tier: { added: 1, changed: 0, killed: 0 } });
        expect(first[1]).toMatchObject({ top_tier: { added: 0, changed: 1, killed: 1 } });
        expect(first[2]).toMatchObject({ status: 'no-external-signal', top_tier: { added: 0, changed: 0, killed: 0 } });
        expect(doc.tokens).toBe(3000);
        expect(doc.wall_clock_seconds).toBe(5400);
        expect(doc.exchange.already_fixed_rate).toBe(0.25);
    });

    it('validates its own output and round-trips through the round folder', () => {
        const doc = buildRunJson(input());
        expect(validateRunJson(doc)).toEqual([]);
        const runDir = path.join(root, 'agents/runtime/analysis/r1');
        writeRunJson(runDir, doc);
        expect(fs.existsSync(path.join(runDir, RUN_JSON))).toBe(true);
        expect(readRunJson(runDir)).toEqual(doc);
    });

    it('rejects a document missing a field, an unknown major schema and a row-count mismatch', () => {
        const doc = buildRunJson(input()) as unknown as Record<string, unknown>;
        expect(validateRunJson({ ...doc, seats: undefined })).toContainEqual(expect.stringMatching(/seats/));
        expect(validateRunJson({ ...doc, schema_version: '2.0' })).toContainEqual(expect.stringMatching(/schema_version/));
        const rows = (doc['rows'] as unknown[]).slice(1);
        expect(validateRunJson({ ...doc, rows })).toContainEqual(expect.stringMatching(/rows/));
    });

    it('records a missing turnaround reading as missing, never as zero', () => {
        const doc = buildRunJson({ ...input(), turnaround: null });
        expect(doc.turnaround).toBe('missing');
        expect(validateRunJson(doc)).toEqual([]);
    });
});
