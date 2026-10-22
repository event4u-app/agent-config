import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as t from '../../src/scripts/ci_time_to_green.js';
import { regressions } from '../../src/scripts/ci_time_to_green.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'ci_time_to_green', 'runs-and-jobs.json');

interface Fixture {
    runs: t.ApiRun[];
    jobs: Record<string, t.ApiJob[]>;
}

function load(): { runs: t.ApiRun[]; jobsByRun: Map<number, t.ApiJob[]> } {
    const f = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as Fixture;
    return {
        runs: f.runs,
        jobsByRun: new Map(Object.entries(f.jobs).map(([k, v]) => [Number(k), v])),
    };
}

const PR2569_SHA = '2302af8a4fd831c4b7000308fdc81142117aafca';
const RED_SHA = 'a'.repeat(40);

describe('ci_time_to_green — per job', () => {
    it('reads queue and execution seconds from the recorded PR #2569 jobs', () => {
        const { runs, jobsByRun } = load();
        const report = t.computeReport(runs, jobsByRun, t.DEFAULT_REQUIRED);
        const byName = new Map(report.jobs.filter((j) => j.run_id === 39644704455).map((j) => [j.job, j]));
        expect(byName.get('Node Tests (macos-latest, shard 1/4)')).toMatchObject({
            os: 'macos',
            queue_s: 1891,
            exec_s: 515,
        });
        expect(byName.get('Node Tests (ubuntu-latest, shard 1/4)')).toMatchObject({
            os: 'ubuntu',
            queue_s: 2,
            exec_s: 319,
        });
        expect(byName.get('Golden Tests (macos-latest)')).toMatchObject({ queue_s: 1192, exec_s: 75 });
    });

    it('takes the OS from runner labels when the job name carries none', () => {
        expect(t.osOf({ name: 'Static Checks (ESLint · typecheck · prepack)', labels: ['ubuntu-latest'] })).toBe(
            'ubuntu',
        );
        expect(t.osOf({ name: 'Build', labels: ['self-hosted'] })).toBe('other');
        expect(t.osOf({ name: 'Smoke (windows-latest)', labels: [] })).toBe('windows');
        expect(t.osOf({ name: 'Node Tests (macos-26, shard 1/4)', labels: ['macos-26'] })).toBe('macos');
        expect(t.osOf({ name: 'Node Tests (ubuntu-26.04, shard 1/4)', labels: ['ubuntu-26.04'] })).toBe('ubuntu');
    });

    it('does not time a skipped or unstarted job', () => {
        const { runs } = load();
        const run = runs[0] as t.ApiRun;
        const base: t.ApiJob = {
            id: 9,
            run_id: run.id,
            name: 'x (ubuntu-latest)',
            status: 'completed',
            conclusion: 'skipped',
            created_at: '2026-10-21T17:00:00Z',
            started_at: '2026-10-21T17:00:00Z',
            completed_at: '2026-10-21T17:00:00Z',
            labels: [],
        };
        expect(t.jobTiming(base, run)).toBeNull();
        expect(t.jobTiming({ ...base, conclusion: null, status: 'queued', started_at: null, completed_at: null }, run)).toBeNull();
    });
});

describe('ci_time_to_green — OS × event split', () => {
    it('separates macOS queue from ubuntu queue with nearest-rank percentiles', () => {
        const { runs, jobsByRun } = load();
        const report = t.computeReport(runs, jobsByRun, t.DEFAULT_REQUIRED);
        const mac = report.by_os_event.find((r) => r.os === 'macos' && r.event === 'pull_request');
        const ubuntu = report.by_os_event.find((r) => r.os === 'ubuntu' && r.event === 'pull_request');
        // macOS queues: 561, 1192, 1891 (recorded) + 600 (red SHA, synthetic).
        expect(mac?.queue).toEqual({ n: 4, p50: 600, p90: 1891 });
        // ubuntu queues: 2, 2, 15 (recorded) + 3, 10, 5, 5 (synthetic required jobs).
        expect(ubuntu?.queue).toEqual({ n: 7, p50: 5, p90: 15 });
    });

    it('percentile is nearest-rank and null on an empty sample', () => {
        expect(t.percentile([], 50)).toBeNull();
        expect(t.percentile([10], 90)).toBe(10);
        expect(t.percentile([4, 1, 3, 2], 50)).toBe(2);
        expect(t.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    });
});

describe('ci_time_to_green — required vs all green', () => {
    it('required checks can be green long before every job is', () => {
        const { runs, jobsByRun } = load();
        const report = t.computeReport(runs, jobsByRun, t.DEFAULT_REQUIRED);
        const pr = report.shas.find((s) => s.head_sha === PR2569_SHA);
        expect(pr).toMatchObject({
            all_state: 'green',
            required_state: 'green',
            // first run created 17:32:28 → last macOS shard completed 18:12:36
            time_to_all_green_s: 2408,
            // → Sync + Generate Tools Consistency completed 17:44:09
            time_to_required_green_s: 701,
        });
    });

    it('a red non-required job blanks all-green but not required-green', () => {
        const { runs, jobsByRun } = load();
        const report = t.computeReport(runs, jobsByRun, t.DEFAULT_REQUIRED);
        const red = report.shas.find((s) => s.head_sha === RED_SHA);
        expect(red).toMatchObject({
            all_state: 'red',
            time_to_all_green_s: null,
            required_state: 'green',
            time_to_required_green_s: 600,
        });
        const ev = report.by_event.find((e) => e.event === 'pull_request');
        expect(ev?.all_green).toEqual({ n: 1, p50: 2408, p90: 2408 });
        expect(ev?.required_green).toEqual({ n: 2, p50: 600, p90: 701 });
    });

    it('a required check that never ran is missing, not green', () => {
        const { runs, jobsByRun } = load();
        const report = t.computeReport(runs, jobsByRun, ['Release Validation']);
        const pr = report.shas.find((s) => s.head_sha === PR2569_SHA);
        expect(pr).toMatchObject({
            required_state: 'missing',
            time_to_required_green_s: null,
            missing_required: ['Release Validation'],
        });
    });

    it('an unfinished run makes the SHA pending', () => {
        const { runs, jobsByRun } = load();
        const patched = runs.map((r) => (r.id === 39644704455 ? { ...r, status: 'in_progress', conclusion: null } : r));
        const pr = t.computeReport(patched, jobsByRun, t.DEFAULT_REQUIRED).shas.find((s) => s.head_sha === PR2569_SHA);
        expect(pr?.all_state).toBe('pending');
        expect(pr?.time_to_all_green_s).toBeNull();
    });

    it('a run span starts at the run, not at the first SHA run', () => {
        const { runs, jobsByRun } = load();
        const span = t.computeReport(runs, jobsByRun, t.DEFAULT_REQUIRED).runs.find((r) => r.id === 39644704455);
        expect(span?.span_s).toBe(2407);
    });
});

describe('ci_time_to_green — rendering and windows', () => {
    it('markdown names truncation instead of presenting a partial sample as complete', () => {
        const { runs, jobsByRun } = load();
        const report = t.computeReport(runs, jobsByRun, t.DEFAULT_REQUIRED);
        const md = t.renderMarkdown(
            report,
            { window: 'w', workflow: 'all', runs_listed: 6, runs_with_jobs: 6, truncated: true, reason: 'rate floor' },
            t.DEFAULT_REQUIRED,
        );
        expect(md).toContain('**Sample truncated:** rate floor');
        expect(md).toMatch(/\| macos \| pull_request \| 4 \| 10m00s \| 31m31s \|/);
    });

    it('slices a window below the 1000-result listing cap without gaps', () => {
        const from = new Date('2026-10-14T00:00:00Z');
        const to = new Date('2026-10-15T00:00:00Z');
        expect(t.sliceWindow(from, to, 6)).toEqual([
            ['2026-10-14T00:00:00Z', '2026-10-14T05:59:59Z'],
            ['2026-10-14T06:00:00Z', '2026-10-14T11:59:59Z'],
            ['2026-10-14T12:00:00Z', '2026-10-14T17:59:59Z'],
            ['2026-10-14T18:00:00Z', '2026-10-14T23:59:59Z'],
        ]);
    });

    it('formats seconds compactly', () => {
        expect(t.fmtS(null)).toBe('—');
        expect(t.fmtS(42)).toBe('42s');
        expect(t.fmtS(1891)).toBe('31m31s');
    });
});

describe('regressions — the weekly warning compares like rows only', () => {
    const row = (os: 'macos' | 'ubuntu', p50: number, p90: number) => ({
        os,
        event: 'pull_request',
        queue: { n: 100, p50, p90 },
        exec: { n: 100, p50: 60, p90: 90 },
    });
    const base = { by_os_event: [row('macos', 300, 1500), row('ubuntu', 30, 200)], by_event: [] };

    it('warns when a percentile grew by more than the threshold', () => {
        const cur = { by_os_event: [row('macos', 400, 1500), row('ubuntu', 30, 200)], by_event: [] };
        const w = regressions(base, cur, 0.25);
        expect(w).toHaveLength(1);
        expect(w[0]).toMatch(/macos pull_request queue p50: 300 s -> 400 s/);
    });

    it('stays quiet at or below the threshold and on improvements', () => {
        const cur = { by_os_event: [row('macos', 375, 1000), row('ubuntu', 20, 250)], by_event: [] };
        expect(regressions(base, cur, 0.25)).toEqual([]);
    });

    it('ignores a row the baseline does not have', () => {
        const cur = { by_os_event: [{ ...row('macos', 9999, 9999), event: 'merge_group' }], by_event: [] };
        expect(regressions(base, cur, 0.25)).toEqual([]);
    });
});
