import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    list_trigger_suites,
    pick_rotation,
    run_rotation,
    week_index,
} from '../../src/scripts/trigger_eval_rotation.js';
import { DEFAULT_FLOOR, DOMAIN_FLOORS, floor_for } from '../../src/scripts/_lib/trigger_eval_floors.js';

describe('pick_rotation — deterministic weekly selection', () => {
    const suites = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    it('is deterministic for a given (week, batch)', () => {
        expect(pick_rotation(suites, 42, 3)).toEqual(pick_rotation(suites, 42, 3));
    });

    it('advances by batch each week and wraps around', () => {
        expect(pick_rotation(suites, 0, 3)).toEqual(['a', 'b', 'c']);
        expect(pick_rotation(suites, 1, 3)).toEqual(['d', 'e', 'f']);
        expect(pick_rotation(suites, 2, 3)).toEqual(['g', 'a', 'b']); // wrap
    });

    it('covers every suite within ceil(total/batch) consecutive weeks', () => {
        const batch = 3;
        const weeks = Math.ceil(suites.length / batch);
        const seen = new Set<string>();
        for (let w = 0; w < weeks; w += 1) {
            for (const s of pick_rotation(suites, w, batch)) seen.add(s);
        }
        expect(seen.size).toBe(suites.length);
    });

    it('handles degenerate inputs', () => {
        expect(pick_rotation([], 5, 3)).toEqual([]);
        expect(pick_rotation(suites, 5, 0)).toEqual([]);
        expect(pick_rotation(suites, -3, 2)).toHaveLength(2); // negative week still valid
        expect(new Set(pick_rotation(suites, 1, 99)).size).toBe(suites.length); // batch > total → each suite once
    });
});

describe('week_index — monotonic UTC week key', () => {
    it('increments by exactly 1 across a 7-day step', () => {
        const d1 = new Date(Date.UTC(2026, 6, 6)); // Mon 2026-07-06
        const d2 = new Date(Date.UTC(2026, 6, 13));
        expect(week_index(d2)).toBe(week_index(d1) + 1);
    });

    it('is stable within the same UTC day', () => {
        const a = new Date(Date.UTC(2026, 6, 10, 0, 1));
        const b = new Date(Date.UTC(2026, 6, 10, 23, 59));
        expect(week_index(a)).toBe(week_index(b));
    });
});

describe('floor_for — shared domain floors', () => {
    it('returns the domain entry when present and the default otherwise', () => {
        expect(floor_for('iconography')).toEqual(DOMAIN_FLOORS['iconography']);
        expect(floor_for('some-unlisted-skill')).toEqual(DEFAULT_FLOOR);
        expect(floor_for(null)).toEqual(DEFAULT_FLOOR);
    });
});

describe('run_rotation — dry-run plumbing (MockRouter, no keys, no spend)', () => {
    it('runs a batch end-to-end, writes result JSONs, and never fails on floors', async () => {
        const outDir = join(tmpdir(), `rotation-test-${process.pid}`);
        const summary = await run_rotation({ dryRun: true, week: 3, batch: 2, outDir });

        expect(summary.dry_run).toBe(true);
        expect(summary.outcomes).toHaveLength(2);
        expect(summary.total_suites).toBe(list_trigger_suites().length);
        for (const o of summary.outcomes) {
            expect(o.resultPath).toContain(outDir);
            expect(o.minRecall).toBeGreaterThan(0);
        }
        // Both triggers.json shapes must load: the picked suites vary, but the
        // run must not throw on the split should_trigger/should_not_trigger shape.
        const wideBatch = await run_rotation({ dryRun: true, week: 0, batch: 10, outDir });
        expect(wideBatch.outcomes.length).toBe(10);
    });
});
