import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as oa from '../../src/scripts/ci_os_attribution.js';
import type { ApiJob } from '../../src/scripts/ci_time_to_green.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'ci_os_attribution', 'jobs.json');

function load(): Map<number, ApiJob[]> {
    const f = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as { runs: Record<string, ApiJob[]> };
    return new Map(Object.entries(f.runs).map(([k, v]) => [Number(k), v]));
}

describe('ci_os_attribution — twin pairing', () => {
    it('takes the matrix OS token out of the job name', () => {
        expect(oa.normaliseJobName('Node Tests (macos-latest, shard 3/4)')).toEqual({
            key: 'Node Tests ({os}, shard 3/4)',
            os: 'macos',
        });
        expect(oa.normaliseJobName('Node Tests (ubuntu-latest, shard 3/4)')?.key).toBe('Node Tests ({os}, shard 3/4)');
        expect(oa.normaliseJobName('Smoke (ubuntu-22.04)')).toEqual({ key: 'Smoke ({os})', os: 'ubuntu' });
        expect(oa.normaliseJobName('Node Tests (macos-26, shard 1/4)')).toEqual({
            key: 'Node Tests ({os}, shard 1/4)',
            os: 'macos',
        });
        expect(oa.normaliseJobName('Node Tests (ubuntu-26.04, shard 1/4)')?.key).toBe('Node Tests ({os}, shard 1/4)');
        expect(oa.normaliseJobName('Static Checks (ESLint · typecheck · prepack)')).toBeNull();
    });

    it('does not pair different shards', () => {
        const jobs = load().get(39644704455) as ApiJob[];
        const r = oa.pairRunJobs(39644704455, jobs);
        expect(r.pairs.map((p) => p.key).sort()).toEqual(['Golden Tests ({os})', 'Node Tests ({os}, shard 3/4)']);
        expect(r.pairs.every((p) => p.cell === 'both_pass')).toBe(true);
    });

    it('reports a macOS-only matrix job as untwinned and skips non-matrix jobs', () => {
        const r = oa.pairRunJobs(39644704455, load().get(39644704455) as ApiJob[]);
        expect(r.untwinned.map((u) => u.job)).toEqual(['Collector Lifecycle (macos-latest — the macOS row only)']);
    });

    it('pairs within one run attempt, so a re-run does not hide the first failure', () => {
        const r = oa.pairRunJobs(900, load().get(900) as ApiJob[]);
        const shard3 = r.pairs.filter((p) => p.key === 'Node Tests ({os}, shard 3/4)');
        expect(shard3.map((p) => [p.run_attempt, p.cell]).sort()).toEqual([
            [1, 'mac_fail_ubuntu_pass'],
            [2, 'both_pass'],
        ]);
    });
});

describe('ci_os_attribution — outcome cells', () => {
    it('classifies the four cells and ignores non-decisive sides', () => {
        expect(oa.classifyPair('failure', 'success')).toBe('mac_fail_ubuntu_pass');
        expect(oa.classifyPair('success', 'failure')).toBe('mac_pass_ubuntu_fail');
        expect(oa.classifyPair('failure', 'failure')).toBe('both_fail');
        expect(oa.classifyPair('success', 'success')).toBe('both_pass');
        expect(oa.classifyPair('cancelled', 'success')).toBeNull();
        expect(oa.classifyPair('success', 'skipped')).toBeNull();
        expect(oa.classifyPair(null, 'success')).toBeNull();
    });

    it('counts every cell on the fixture and names the asymmetric pairs', () => {
        const a = oa.attribute(load());
        expect(a.runs_read).toBe(2);
        expect(a.pair_cells).toEqual({
            mac_fail_ubuntu_pass: 1,
            mac_pass_ubuntu_fail: 1,
            both_fail: 1,
            both_pass: 3,
        });
        expect(a.ignored_pairs).toBe(1);
        expect(a.asymmetric.map((p) => [p.run_id, p.cell, p.mac_job])).toEqual(
            expect.arrayContaining([
                [900, 'mac_fail_ubuntu_pass', 'Node Tests (macos-latest, shard 3/4)'],
                [900, 'mac_pass_ubuntu_fail', 'Golden Tests (macos-latest)'],
            ]),
        );
        expect(a.untwinned['Collector Lifecycle ({os} — the macOS row only)']).toEqual({ seen: 2, failed: 1 });
    });

    it('withholds rates below the run floor and prints them above it', () => {
        const a = oa.attribute(load());
        const below = oa.renderMarkdown(a, 500);
        expect(below).toContain('**Below the floor — rates withheld.** 2 runs read, 500 required.');
        expect(below).not.toContain('Share of pairs');
        const above = oa.renderMarkdown(a, 2);
        expect(above).toContain('Share of pairs');
        expect(above).toMatch(/\| mac_fail_ubuntu_pass \| 1 \| 1 \| 16\.7 % \|/);
    });
});
