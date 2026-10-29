import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { load_map_tasks } from '../../src/scripts/_lib/bench_map_metrics.js';
import { coverageOf, coverageSummary } from '../../src/scripts/bench_map_task_set.js';

const REPO = path.resolve(__dirname, '../..');

describe('coverage gate before spend (5.4, K2)', () => {
    it('reads each planted place as covered when the offline graph answer names it', async () => {
        const task = load_map_tasks().find((t) => t.area === 'code')!;
        const c = await coverageOf(task);
        expect(c.task_id).toBe(task.id);
        expect(c.covered.length + c.uncovered.length).toBe(task.affected.length);
        expect(c.covered.length).toBeGreaterThan(0);
    }, 120_000);

    it('summarises covered and uncovered apart', () => {
        const s = coverageSummary([
            { task_id: 'a', covered: ['x', 'y'], uncovered: [] },
            { task_id: 'b', covered: ['x'], uncovered: ['z'] },
        ]);
        expect(s).toEqual({ tasks: 2, covered_tasks: ['a'], uncovered_tasks: ['b'], places: 4, covered_places: 3, covered_share: 0.5 });
    });

    it('`--dry-run --coverage` prints the covered share without a model call', () => {
        const r = spawnSync(path.join(REPO, 'scripts-run'), ['src/scripts/bench_map_task_set', '--dry-run', '--coverage', '--tasks', '2'], { cwd: REPO, encoding: 'utf-8' });
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/covered share \d\.\d+ \(\d+\/2 tasks, \d+\/\d+ places\)/);
    }, 300_000);
});
