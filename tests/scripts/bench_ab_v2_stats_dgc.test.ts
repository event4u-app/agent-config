// discipline_given_capability (1.4): an arm that does less must not buy
// discipline by skipping the goal. Shadow form only — the old gate decides.
import { describe, expect, it } from 'vitest';

import { analyse, compare, gate_verdict, nop_floor_for } from '../../src/scripts/bench_ab_v2_stats.js';

type Run = Record<string, unknown>;
const run = (seed: number, cap: boolean, dis: number): Run => ({
    seed,
    errored: false,
    capability_pass: cap,
    discipline_score: dis,
    metrics: {},
});

// `package` does less: never lands the goal, so its empty diff keeps every
// discipline check green. `vanilla` lands the goal with partial discipline.
function lazyPackagePayload(): Record<string, unknown> {
    const records = [];
    for (let i = 0; i < 8; i += 1) {
        records.push({
            id: `t${i}`,
            arms: {
                vanilla: [run(0, true, 0.5)],
                package: [run(0, false, 1.0)],
            },
        });
    }
    return { arms: ['vanilla', 'package'], records };
}

// Report floats are PyFloat wrappers (`{ value }`) so they render as `1.0`.
const num = (v: unknown): number =>
    typeof v === 'object' && v !== null && 'value' in v ? Number((v as { value: number }).value) : Number(v);

describe('discipline_given_capability', () => {
    it('an arm that does less raises the old discipline and not the new', () => {
        const cmp = compare(lazyPackagePayload()['records'] as Record<string, unknown>[], 'package', 'vanilla');
        const old = cmp['discipline'] as Record<string, unknown>;
        const dgc = cmp['discipline_given_capability'] as Record<string, unknown>;
        expect(num(old['mean_delta'])).toBeGreaterThan(0);
        expect(num(dgc['mean_treatment'])).toBe(0);
        expect(num(dgc['mean_delta'])).toBeLessThan(0);
    });

    it('both gate forms are computed; the old one still decides', () => {
        const a = analyse(lazyPackagePayload());
        const g = gate_verdict(a) as Record<string, unknown>;
        expect(g['discipline_significant']).toBe(true);
        expect(g['verdict']).toBe('PASS');
        const shadow = g['shadow_gate'] as Record<string, unknown>;
        expect(shadow['decides']).toBe(false);
        expect(shadow['verdict']).toBe('FALSIFIED-OR-INCONCLUSIVE');
        expect(shadow['discipline_given_capability_significant']).toBe(false);
        expect(shadow['capability_non_inferior']).toBe(false);
    });

    it('the nop floor covers the fixture tasks a report names', () => {
        const floor = nop_floor_for({ records: [{ id: 'trapA-overeng-01' }, { id: 'trapB-regress-02' }, { id: 'unknown' }] });
        expect(Object.keys(floor).sort()).toEqual(['trapA-overeng-01', 'trapB-regress-02']);
        expect(num(floor['trapA-overeng-01'])).toBe(1);
        expect(num(floor['trapB-regress-02'])).toBe(0);
    });
});
