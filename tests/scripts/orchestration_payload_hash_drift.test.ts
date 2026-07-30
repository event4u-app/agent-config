// Unit tests for the payload-hash × cache-hit drift report CLI
// (road-to-cache-economy Phase 3, steps 6-7). Exercises `buildReport`
// end-to-end against a temp `agents/runtime/state/audit`-shaped directory,
// reusing the real `readAuditLines` reader (not a mock) so the test proves
// the join against real audit-log-v1 JSONL lines, not just the pure
// aggregator already covered by `payload_hash_drift.test.ts`.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildReport, renderText } from '../../src/scripts/orchestration_payload_hash_drift.js';

const _tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    _tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (_tmpDirs.length > 0) {
        const d = _tmpDirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function auditLine(orchestration: Record<string, unknown> | undefined, input_kind = 'orchestration'): string {
    return JSON.stringify({ schema_version: 1, id: 'x', ts: '2026-07-30T00:00:00Z', input_kind, orchestration });
}

describe('orchestration_payload_hash_drift — buildReport (real audit-log-v1 JSONL)', () => {
    it('says so plainly on an empty/nonexistent audit dir — a valid state, not a green pass', () => {
        const dir = path.join(os.tmpdir(), 'no-such-audit-dir-xyz');
        const r = buildReport(dir);
        expect(r.total_lines).toBe(0);
        expect(r.lines_with_data).toBe(0);
        expect(renderText(r)).toContain('CURRENT expected state');
        expect(renderText(r)).not.toMatch(/PASS|✓/);
    });

    it('ignores lines that are not input_kind=orchestration, and lines missing either field', () => {
        const dir = mkTmp('audit-');
        const body = [
            auditLine(undefined, 'phase'), // wrong input_kind
            auditLine({ spawn_count: 1, token_delta: 0 }), // no payload_hash/cache_hit
            auditLine({ payload_hash: 'h1', cache_hit: null }), // cache_hit not measured
        ].join('\n');
        fs.writeFileSync(path.join(dir, '2026-07.jsonl'), body + '\n');

        const r = buildReport(dir);
        expect(r.total_lines).toBe(3);
        expect(r.lines_with_data).toBe(0);
    });

    it('joins payload_hash against cache_hit across real JSONL lines and shows the stable/unstable cohort split', () => {
        const dir = mkTmp('audit-');
        const lines = [
            auditLine({ payload_hash: 'stable-1', cache_hit: false }), // first
            auditLine({ payload_hash: 'stable-1', cache_hit: true }), // repeat, hit
            auditLine({ payload_hash: 'stable-1', cache_hit: true }), // repeat, hit
            auditLine({ payload_hash: 'unique-1', cache_hit: false }),
            auditLine({ payload_hash: 'unique-2', cache_hit: false }),
        ];
        fs.writeFileSync(path.join(dir, '2026-07.jsonl'), lines.join('\n') + '\n');

        const r = buildReport(dir);
        expect(r.lines_with_data).toBe(5);
        expect(r.stable_cohort.n).toBe(2); // 3 occurrences - 1 excluded first
        expect(r.stable_cohort.hit_rate).toBeCloseTo(1, 12);
        expect(r.unstable_cohort.n).toBe(2);
        expect(r.unstable_cohort.hit_rate).toBeCloseTo(0, 12);
        expect(r.drift_visible).toBe(true);

        const text = renderText(r);
        expect(text).toContain('drift_visible (stable hit_rate > unstable hit_rate): YES');
        expect(text).toContain('REFUSAL');
        expect(text).toContain('never wires a measure→adjust step');
    });
});
