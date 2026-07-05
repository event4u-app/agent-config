/**
 * Tests for A4 (`mine_missing_guardrails`) + A5 (`cluster_near_miss_patterns`) —
 * the learning-loop analysis over audit-log-v1. Both are read-only; these
 * fixtures inject a tmp audit dir so no real audit log is touched.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadRecords, mineCandidates } from '../../src/scripts/mine_missing_guardrails.js';
import { clusterNearMisses } from '../../src/scripts/cluster_near_miss_patterns.js';

const _tmp: string[] = [];
afterEach(() => {
    for (const d of _tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function _auditDir(lines: Record<string, unknown>[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'll-'));
    _tmp.push(dir);
    const body = lines.map((l) => JSON.stringify({ schema_version: 1, type: 'phase', ...l })).join('\n') + '\n';
    fs.writeFileSync(path.join(dir, '2026-07.jsonl'), body, 'utf-8');
    return dir;
}

describe('A4 — mine_missing_guardrails', () => {
    it('empty / missing audit dir → no records, no candidates', () => {
        expect(loadRecords(path.join(os.tmpdir(), 'does-not-exist-xyz'))).toEqual([]);
        expect(mineCandidates([], 2)).toEqual([]);
    });

    it('surfaces a rule absent in failures but present in successes', () => {
        const dir = _auditDir([
            { work_id: 'A', phase: 'verify', outcome: 'success', rules_applied: ['verify-before-complete'] },
            { work_id: 'B', phase: 'verify', outcome: 'success', rules_applied: ['verify-before-complete'] },
            { work_id: 'C', phase: 'verify', outcome: 'error', rules_applied: [] },
            { work_id: 'D', phase: 'verify', outcome: 'blocked', rules_applied: [] },
        ]);
        const c = mineCandidates(loadRecords(dir), 2);
        expect(c.length).toBe(1);
        expect(c[0]!.rule).toBe('verify-before-complete');
        expect(c[0]!.phase).toBe('verify');
        expect(c[0]!.failure_without_rule).toBe(2);
        expect(c[0]!.success_with_rule).toBe(2);
        expect(c[0]!.failure_work_ids).toEqual(['C', 'D']);
    });

    it('respects min-count and the ≥2-distinct-work-id floor', () => {
        const recs = loadRecords(
            _auditDir([
                { work_id: 'A', phase: 'verify', outcome: 'success', rules_applied: ['r'] },
                { work_id: 'C', phase: 'verify', outcome: 'error', rules_applied: [] },
            ]),
        );
        // only 1 failing run → below the ≥2 floor → no candidate
        expect(mineCandidates(recs, 2)).toEqual([]);
    });

    it('does not flag a rule that is absent only in successes (no failure signal)', () => {
        const c = mineCandidates(
            loadRecords(
                _auditDir([
                    { work_id: 'A', phase: 'plan', outcome: 'success', rules_applied: ['x'] },
                    { work_id: 'B', phase: 'plan', outcome: 'success', rules_applied: [] },
                    { work_id: 'C', phase: 'plan', outcome: 'success', rules_applied: [] },
                ]),
            ),
            2,
        );
        expect(c).toEqual([]);
    });
});

describe('A5 — cluster_near_miss_patterns', () => {
    it('empty → no clusters', () => {
        expect(clusterNearMisses([], 0.6)).toEqual([]);
    });

    it('clusters two high-overlap-but-not-identical rule-sets in the same (phase,outcome)', () => {
        const recs = loadRecords(
            _auditDir([
                { work_id: 'A', phase: 'implement', outcome: 'success', rules_applied: ['a', 'b', 'c'] },
                { work_id: 'B', phase: 'implement', outcome: 'success', rules_applied: ['a', 'b', 'c', 'd'] },
            ]),
        );
        const cl = clusterNearMisses(recs, 0.6); // jaccard(abc, abcd) = 3/4 = 0.75
        expect(cl.length).toBe(1);
        expect(cl[0]!.phase).toBe('implement');
        expect(cl[0]!.differing_rules).toEqual(['d']);
        expect(cl[0]!.rule_sets.length).toBe(2);
    });

    it('does not cluster identical rule-sets (jaccard 1)', () => {
        const recs = loadRecords(
            _auditDir([
                { work_id: 'A', phase: 'implement', outcome: 'success', rules_applied: ['a', 'b'] },
                { work_id: 'B', phase: 'implement', outcome: 'success', rules_applied: ['a', 'b'] },
            ]),
        );
        expect(clusterNearMisses(recs, 0.6)).toEqual([]);
    });

    it('does not cluster below the jaccard threshold', () => {
        const recs = loadRecords(
            _auditDir([
                { work_id: 'A', phase: 'implement', outcome: 'success', rules_applied: ['a', 'b', 'c'] },
                { work_id: 'B', phase: 'implement', outcome: 'success', rules_applied: ['x', 'y', 'z'] },
            ]),
        );
        expect(clusterNearMisses(recs, 0.6)).toEqual([]); // jaccard 0
    });

    it('does not cross (phase,outcome) boundaries', () => {
        const recs = loadRecords(
            _auditDir([
                { work_id: 'A', phase: 'implement', outcome: 'success', rules_applied: ['a', 'b', 'c'] },
                { work_id: 'B', phase: 'verify', outcome: 'success', rules_applied: ['a', 'b', 'c', 'd'] },
            ]),
        );
        expect(clusterNearMisses(recs, 0.6)).toEqual([]); // different phases
    });
});
