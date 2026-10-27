import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    MAX_WEEKLY_QUERIES,
    QUERIES_PER_SUITE,
    ROTATION_CYCLE_WEEKS,
    cost_line,
    list_trigger_suites,
    pick_rotation,
    rotation_plan,
    run_eval_async,
    run_rotation,
    trigger_rates,
    week_index,
} from '../../src/scripts/trigger_eval_rotation.js';
import { Query } from '../../src/scripts/skill_trigger_eval.js';
import { DEFAULT_FLOOR, DOMAIN_FLOORS, floor_for } from '../../src/scripts/_lib/trigger_eval_floors.js';

describe('pick_rotation — deterministic weekly selection by suite identity', () => {
    const suites = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    it('is deterministic for a given (week, cycle)', () => {
        expect(pick_rotation(suites, 42, 3)).toEqual(pick_rotation(suites, 42, 3));
    });

    it('repeats on the cycle, so a suite is due every cycleWeeks', () => {
        const cycle = 3;
        for (let w = 0; w < cycle * 4; w += 1) {
            expect(pick_rotation(suites, w, cycle)).toEqual(pick_rotation(suites, w + cycle, cycle));
        }
    });

    it('covers every suite within one cycle, and each exactly once', () => {
        const cycle = 3;
        const seen: string[] = [];
        for (let w = 0; w < cycle; w += 1) seen.push(...pick_rotation(suites, w, cycle));
        expect(seen.slice().sort()).toEqual(suites.slice().sort());
    });

    it('a new suite does not move any existing suite — the property the positional scheme lacked', () => {
        const cycle = 4;
        const before = Array.from({ length: cycle }, (_, w) => pick_rotation(suites, w, cycle));
        const grown = [...suites, 'h'];
        const after = Array.from({ length: cycle }, (_, w) =>
            pick_rotation(grown, w, cycle).filter((s) => s !== 'h'),
        );
        expect(after).toEqual(before);
    });

    it('handles degenerate inputs', () => {
        expect(pick_rotation([], 5, 3)).toEqual([]);
        expect(pick_rotation(suites, 5, 0)).toEqual([]);
        // A negative week indexes the same slot as its positive congruent.
        expect(pick_rotation(suites, -3, 4)).toEqual(pick_rotation(suites, 1, 4));
    });
});

describe('rotation_plan — the weekly bill, readable without a run', () => {
    it('reports the busiest week of the cycle, not the average', () => {
        const suites = Array.from({ length: 40 }, (_, i) => `s${i}`);
        const plan = rotation_plan(suites, ROTATION_CYCLE_WEEKS);
        const perWeek = Array.from(
            { length: ROTATION_CYCLE_WEEKS },
            (_, w) => pick_rotation(suites, w, ROTATION_CYCLE_WEEKS).length,
        );
        expect(plan.peakSuitesPerWeek).toBe(Math.max(...perWeek));
        expect(plan.peakWeeklyQueries).toBe(plan.peakSuitesPerWeek * QUERIES_PER_SUITE);
        expect(perWeek.reduce((a, b) => a + b, 0)).toBe(suites.length);
    });

    it('states the worst-case staleness the cycle promises', () => {
        expect(rotation_plan(['a'], 12).worstCaseStalenessDays).toBe(84);
        expect(rotation_plan(['a'], 12).worstCaseStalenessDays).toBeLessThan(90);
    });

    it('the live suite list stays under the stated weekly ceiling', () => {
        const plan = rotation_plan(list_trigger_suites());
        expect(plan.total).toBeGreaterThan(0);
        expect(plan.peakWeeklyQueries).toBeLessThanOrEqual(MAX_WEEKLY_QUERIES);
        expect(plan.withinCeiling).toBe(true);
    });

    it('flags a list that would breach the ceiling instead of billing it silently', () => {
        const big = Array.from({ length: 1000 }, (_, i) => `s${i}`);
        expect(rotation_plan(big).withinCeiling).toBe(false);
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
    it('runs a slot end-to-end, writes result JSONs, and never fails on floors', async () => {
        const outDir = join(tmpdir(), `rotation-test-${process.pid}`);
        // A long cycle keeps the dry run small; the slot it selects is whatever
        // the suites' own hashes put in week 3, which is the point of the scheme.
        const summary = await run_rotation({ dryRun: true, week: 3, cycleWeeks: 64, outDir });

        expect(summary.dry_run).toBe(true);
        expect(summary.cycle_weeks).toBe(64);
        expect(summary.outcomes.length).toBe(pick_rotation(list_trigger_suites(), 3, 64).length);
        expect(summary.outcomes.length).toBeGreaterThan(0);
        expect(summary.total_suites).toBe(list_trigger_suites().length);
        for (const o of summary.outcomes) {
            expect(o.resultPath).toContain(outDir);
            expect(o.minRecall).toBeGreaterThan(0);
        }
        // Both triggers.json shapes must load: the picked suites vary, but the
        // run must not throw on the split should_trigger/should_not_trigger shape.
        const wider = await run_rotation({ dryRun: true, week: 0, cycleWeeks: 8, outDir });
        expect(wider.outcomes.length).toBe(pick_rotation(list_trigger_suites(), 0, 8).length);
        expect(wider.outcomes.length).toBeGreaterThan(summary.outcomes.length);
    });
});

// road-to-free-hands-a-paid-head-checks 0.1: from 2026-10-05 every scheduled
// suite scored precision 0 / recall 0 with zero tokens — the router answered
// no call at all, and that read as a routing regression.
describe('run_rotation — a suite with no answered call is not a score', () => {
    it('marks a live suite whose router never answered as unanswered', async () => {
        const outDir = join(tmpdir(), `rot-unanswered-${process.pid}-${Date.now()}`);
        const silent = { name: 'silent', route: () => [[], 0, 0] as [string[], number, number] };
        const summary = await run_rotation({ week: 3, cycleWeeks: 64, outDir, router: silent as never });
        expect(summary.outcomes.length).toBeGreaterThan(0);
        for (const o of summary.outcomes) {
            expect(o.answered).toBe(false);
            expect(o.passed).toBe(false);
        }
    });
});

// road-to-routing-assurance-live-floors 6.1 and 6.3: firing is stochastic, so a
// case is repeated and reported as a RATE; repetition multiplies the bill, so
// the plan and the run report carry the product.
describe('repetition — a rate, not a boolean (6.1)', () => {
    it('a single case run twice reports a rate', async () => {
        let call = 0;
        const flaky = {
            name: 'flaky',
            route: (): [string[], number, number] => {
                call += 1;
                return [call % 2 === 1 ? ['alpha'] : [], 10, 2];
            },
        };
        const result = await run_eval_async('alpha', [Query('use alpha', true)], flaky, [], 'm', 2);
        expect(result.queries).toHaveLength(2);
        const [rate] = trigger_rates(result);
        expect(rate).toEqual({ q: 'use alpha', expected: true, runs: 2, fired: 1, rate: 0.5 });
        expect(typeof rate?.rate).toBe('number');
        // Recall over the repeated runs IS the rate, not "fired at least once".
        expect(result.metrics.recall).toBe(0.5);
    });

    it('defaults to one run, the behaviour before repetition existed', async () => {
        const once = { name: 'once', route: (): [string[], number, number] => [['alpha'], 1, 1] };
        const result = await run_eval_async('alpha', [Query('use alpha', true)], once, [], 'm');
        expect(result.queries).toHaveLength(1);
    });

    it('refuses a repetition count below one', async () => {
        const once = { name: 'once', route: (): [string[], number, number] => [['alpha'], 1, 1] };
        await expect(run_eval_async('alpha', [Query('q', true)], once, [], 'm', 0)).rejects.toThrow(/repetitions/);
    });
});

describe('repetition — the bill carries the product (6.3)', () => {
    it('rotation_plan multiplies the peak by the repetition factor', () => {
        const suites = Array.from({ length: 40 }, (_, i) => `s${i}`);
        const one = rotation_plan(suites, ROTATION_CYCLE_WEEKS);
        const three = rotation_plan(suites, ROTATION_CYCLE_WEEKS, 3);
        expect(three.peakWeeklyQueries).toBe(one.peakWeeklyQueries * 3);
    });

    it('the run report carries a cost line naming queries, repetitions and the ceiling', async () => {
        const outDir = join(tmpdir(), `rot-reps-${process.pid}-${Date.now()}`);
        const summary = await run_rotation({ dryRun: true, week: 3, cycleWeeks: 64, outDir, repetitions: 2 });
        expect(summary.repetitions).toBe(2);
        const single = await run_rotation({ dryRun: true, week: 3, cycleWeeks: 64, outDir });
        expect(summary.queries_issued).toBe(single.queries_issued * 2);
        const line = cost_line(summary);
        expect(line).toContain(`${String(summary.queries_issued)} provider queries`);
        expect(line).toContain('× 2 repetitions');
        expect(line).toContain(`weekly ceiling ${String(MAX_WEEKLY_QUERIES)}`);
        expect(line).toMatch(/projected weekly peak \d+/);
        expect(line).toMatch(/estimate ~\$[0-9.]+/);
        expect(line).toContain('first lever: --repetitions');
        for (const o of summary.outcomes) expect(o.rates.every((r) => r.runs === 2)).toBe(true);
    });
});

// OQ-23 (c): repetition stays opt-in, and a run whose projected weekly peak
// exceeds the ceiling is refused unless explicitly overridden, with the
// override recorded.
describe('the weekly ceiling guard (6.1)', () => {
    // A live run with an injected router: the guard is exercised, nothing is paid.
    const live = { name: 'stub', route: (): [string[], number, number] => [[], 1, 1] };
    it('refuses a run projected over MAX_WEEKLY_QUERIES', async () => {
        const outDir = join(tmpdir(), `rot-guard-${process.pid}-${Date.now()}`);
        const projected = rotation_plan(list_trigger_suites(), ROTATION_CYCLE_WEEKS, 3).peakWeeklyQueries;
        expect(projected).toBeGreaterThan(MAX_WEEKLY_QUERIES);
        await expect(run_rotation({ week: 3, outDir, repetitions: 3, router: live })).rejects.toThrow(
            /projected weekly peak .* exceeds .*ceiling/i,
        );
    });

    it('runs over the ceiling only with a recorded override reason', async () => {
        const outDir = join(tmpdir(), `rot-guard-ok-${process.pid}-${Date.now()}`);
        const summary = await run_rotation({
            week: 3,
            outDir,
            repetitions: 3,
            router: live,
            ceilingOverride: 'measured once for the variance study',
        });
        expect(summary.ceiling_override).toMatchObject({ reason: 'measured once for the variance study' });
        expect(summary.projected_weekly_peak).toBeGreaterThan(MAX_WEEKLY_QUERIES);
    });

    it('an empty override reason is not an override', async () => {
        const outDir = join(tmpdir(), `rot-guard-empty-${process.pid}-${Date.now()}`);
        await expect(
            run_rotation({ week: 3, outDir, repetitions: 3, router: live, ceilingOverride: '  ' }),
        ).rejects.toThrow(/ceiling/i);
    });

    it('the default of one repetition stays within the ceiling and records no override', async () => {
        const outDir = join(tmpdir(), `rot-guard-one-${process.pid}-${Date.now()}`);
        const summary = await run_rotation({ week: 3, outDir, router: live });
        expect(summary.projected_weekly_peak).toBeLessThanOrEqual(MAX_WEEKLY_QUERIES);
        expect(summary.ceiling_override).toBeNull();
    });
});
