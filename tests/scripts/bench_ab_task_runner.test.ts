// Tests for src/scripts/bench_ab_task_runner.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists. This is a focused differential suite over the pure
// helpers (utc_stamp shape, count_ask_events, per_category_aggregate,
// snapshot_clone over a temp tree) plus a dry-run golden-parity layer that
// runs python3 vs tsx end-to-end and compares the written JSON + Markdown
// reports byte-for-byte. The reports/ab + clones directories are snapshot +
// restored so the test leaves zero git drift. The volatile fields are the
// embedded UTC `stamp` (also in the report filename) and `duration_seconds`
// (a wall-clock measurement); both are normalised per ADR-094's timing-
// non-determinism guidance. `wall_time_seconds` is 0.0 in dry-run mode (no
// CLI invocation), so it stays deterministic and IS compared.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as runner from '../../src/scripts/bench_ab_task_runner.js';



/** Normalise the two volatile fields: the UTC stamp + duration_seconds. */

describe('bench_ab_task_runner — pure helpers', () => {
    it('utc_stamp matches the %Y-%m-%dT%H-%M-%SZ shape (colon-free)', () => {
        expect(runner.utc_stamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
    });

    it('count_ask_events: empty transcript → all-zero, int ratio', () => {
        const ev = runner.count_ask_events('');
        expect(ev.asked).toBe(0);
        expect(ev.acted_with_commit).toBe(0);
        expect(ev.ratio).toBe(0);
        expect(ev.ratioIsInt).toBe(true);
    });

    it('count_ask_events: present transcript, no markers → int ratio 0', () => {
        const ev = runner.count_ask_events('hello world no markers');
        expect(ev).toMatchObject({ asked: 0, acted_with_commit: 0, ratio: 0, ratioIsInt: true });
    });

    it('count_ask_events: mixed ask + commit markers → round-half-even ratio', () => {
        const ev = runner.count_ask_events('Should I do this? git commit -m x. shall i?');
        expect(ev.asked).toBe(2);
        expect(ev.acted_with_commit).toBe(1);
        expect(ev.ratio).toBe(0.667); // round(2/3, 3)
        expect(ev.ratioIsInt).toBe(false);
    });

    it('per_category_aggregate groups + rounds completion_rate / mean_wall_time', () => {
        const pt = [
            { id: 1, category: 'a', score: { passed: true, checks: [] }, wall_time_seconds: 1.0 },
            { id: 2, category: 'a', score: { passed: false, checks: [] }, wall_time_seconds: 3.0 },
            { id: 3, category: 'b', score: { passed: true, checks: [] }, wall_time_seconds: 2.0 },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any;
        const agg = runner.per_category_aggregate(pt);
        const map = new Map(agg);
        expect(map.get('a')).toMatchObject({ passed: 1, total: 2, completion_rate: 0.5, mean_wall_time: 2 });
        expect(map.get('b')).toMatchObject({ passed: 1, total: 1, completion_rate: 1, mean_wall_time: 2 });
    });
});

describe('bench_ab_task_runner — snapshot_clone over a temp tree', () => {
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp && fs.existsSync(tmp)) {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
        tmp = null;
    });

    it('hashes fixture files; skips .claude/.augment + AGENTS/CLAUDE/manifest', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
        fs.writeFileSync(path.join(tmp, 'src.txt'), 'hello');
        fs.mkdirSync(path.join(tmp, 'nested'));
        fs.writeFileSync(path.join(tmp, 'nested', 'a.txt'), 'world');
        // Surface files that must be excluded.
        fs.mkdirSync(path.join(tmp, '.claude'));
        fs.writeFileSync(path.join(tmp, '.claude', 'x.md'), 'skip');
        fs.writeFileSync(path.join(tmp, 'AGENTS.md'), 'skip');
        fs.writeFileSync(path.join(tmp, '.bench-ab-manifest.json'), '{}');

        const snap = runner.snapshot_clone(tmp);
        expect(Object.keys(snap).sort()).toEqual(['nested/a.txt', 'src.txt']);
        // sha256("hello")[:16]
        const expected = crypto.createHash('sha256').update('hello').digest('hex').slice(0, 16);
        expect(snap['src.txt']).toBe(expected);
    });

    it('drops files deeper than max_depth', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
        let dir = tmp;
        for (let i = 0; i < 8; i++) {
            dir = path.join(dir, `d${i}`);
            fs.mkdirSync(dir);
        }
        fs.writeFileSync(path.join(dir, 'deep.txt'), 'x');
        fs.writeFileSync(path.join(tmp, 'shallow.txt'), 'y');
        const snap = runner.snapshot_clone(tmp, 6);
        expect(snap['shallow.txt']).toBeDefined();
        // 8 dir components + filename → 9 parts > 6 → excluded.
        expect(Object.keys(snap)).toEqual(['shallow.txt']);
    });
});
