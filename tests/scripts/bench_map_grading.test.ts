import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { type MapRunRecord, runOutcome, score_affected, summarise_arm } from '../../src/scripts/_lib/bench_map_metrics.js';

const REPO = path.resolve(__dirname, '../..');
const REPORT = 'internal/bench/reports/map-task-set/2026-10-26T07-12-04Z-map-task-set.json';

const rec = (over: Partial<MapRunRecord>): MapRunRecord => ({
    task_id: 't',
    area: 'delivery',
    arm: 'a',
    seed: 0,
    errored: false,
    success: false,
    broken_dependents: [],
    affected: { declared: 0, section_missing: false, recall: 1, precision: 1, matched: [], missed: [], unmatched_lines: [] },
    tokens: 10,
    usd: 0,
    ...over,
});

describe('grading fixed (5.2, H31)', () => {
    it('gives "errored, check passed" its own outcome', () => {
        expect(runOutcome(false, true)).toBe('success');
        expect(runOutcome(true, true)).toBe('errored-check-passed');
        expect(runOutcome(true, false)).toBe('errored');
        expect(runOutcome(false, false)).toBe('failed');
    });

    it('does not count an errored run whose check passed as a wrong change', () => {
        const s = summarise_arm('a', [rec({ success: true, check_passed: true }), rec({ errored: true, check_passed: true }), rec({ check_passed: false })], 100);
        expect(s.errored_check_passed).toBe(1);
        expect(s.m1_wrong_change_share).toBeCloseTo(1 / 3);
        expect(s.by_area['delivery']).toEqual({ runs: 3, successes: 1, checks_passed: 2 });
    });

    it('matches M2 places on token boundaries, never as a substring', () => {
        const task = { affected: [{ id: 'src/billing.js' }, { id: 'report' }] } as unknown as Parameters<typeof score_affected>[0];
        const s = score_affected(task, ['src/billing.json', 'src/reporter.ts', 'see src/report.js']);
        expect(s.matched).toEqual(['report']);
        expect(s.missed).toEqual(['src/billing.js']);
    });

    it('re-scores a stored report without spending', () => {
        const r = spawnSync(path.join(REPO, 'scripts-run'), ['src/scripts/bench_map_task_set', '--rescore', REPORT], { cwd: REPO, encoding: 'utf-8' });
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/ac-map delivery 2\/4/);
    }, 60_000);
});
