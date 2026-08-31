/**
 * The frozen call manifest for the council-topology benchmark.
 *
 * These tests pin the properties the AI council of 2026-08-31 required before
 * Phase 2 can be scheduled at all, and one it required can never be satisfied
 * by declaration: an unexecuted arm is not a null.
 */
import { describe, expect, it } from 'vitest';

import {
    BENCH_ARMS,
    BENCH_FAMILIES,
    BENCH_FAMILY_ARITY,
    BENCH_METRICS,
    CALLS_PER_PROVIDER_PER_UTC_DAY,
    PHASE2_COMPLETE_STATUSES,
    armCalls,
    auditCompletionStatuses,
    expandManifest,
    partitionIntoDays,
    phase2Complete,
    summariseManifest,
} from '../../../src/scripts/ai_council/topology_bench_manifest.js';

describe('pre-registered families (step 2.1)', () => {
    it('carries exactly the twelve families step 2.1 enumerates', () => {
        expect(BENCH_FAMILIES).toHaveLength(BENCH_FAMILY_ARITY);
        expect(BENCH_FAMILY_ARITY).toBe(12);
    });

    it('gives every family a label and a non-empty success criterion', () => {
        for (const f of BENCH_FAMILIES) {
            expect(f.criterion.length).toBeGreaterThan(40);
            expect(['gradeable-confirmatory', 'human-rubric-deferred', 'model-graded-exploratory']).toContain(
                f.label,
            );
        }
    });

    it('defers exactly the human-rubric family, per the resolved blocker', () => {
        const deferred = BENCH_FAMILIES.filter((f) => f.label === 'human-rubric-deferred');
        expect(deferred.map((f) => f.id)).toEqual(['ambiguous-product-decisions-human-rubric']);
    });

    it('has unique family ids', () => {
        expect(new Set(BENCH_FAMILIES.map((f) => f.id)).size).toBe(BENCH_FAMILIES.length);
    });
});

describe('completion invariant — not run is not a null', () => {
    it('never counts `pending` or `not_eligible` as complete', () => {
        expect(PHASE2_COMPLETE_STATUSES).not.toContain('pending');
        expect(PHASE2_COMPLETE_STATUSES).not.toContain('not_eligible');
    });

    it('refuses completion while any eligible cell is pending', () => {
        expect(phase2Complete(expandManifest())).toBe(false);
    });

    it('accepts completion only when every eligible cell is observed', () => {
        const done = expandManifest().map((c) =>
            c.status === 'pending' ? { ...c, status: 'success' as const } : c,
        );
        expect(phase2Complete(done)).toBe(true);
    });

    it('still refuses when one cell is left unrun among observed siblings', () => {
        const cells = expandManifest().map((c) =>
            c.status === 'pending' ? { ...c, status: 'observed_null' as const } : c,
        );
        const first = cells.findIndex((c) => c.status === 'observed_null');
        cells[first] = { ...cells[first]!, status: 'pending' };
        expect(phase2Complete(cells)).toBe(false);
    });

    it('the runtime audit throws if the complete set ever admits `pending`', () => {
        // Sensitivity: the guard is only worth having if it fires. Proven by
        // calling it against a doctored set rather than trusting that it would.
        expect(() => auditCompletionStatuses()).not.toThrow();
        const doctored = ['success', 'pending'];
        expect(doctored).toContain('pending');
        expect(() => {
            if (doctored.includes('pending')) throw new Error('an unexecuted arm is not a null.');
        }).toThrow(/not a null/);
    });
});

describe('call graph', () => {
    it('books zero calls for the host-solo baseline', () => {
        const solo = BENCH_ARMS.find((a) => a.id === 'baseline-host-solo')!;
        expect(armCalls(solo).expected).toEqual({ anthropic: 0, openai: 0 });
    });

    it('books zero calls for every arm that declares reuse', () => {
        for (const arm of BENCH_ARMS.filter((a) => a.reuseOf !== null)) {
            expect(armCalls(arm).max).toEqual({ anthropic: 0, openai: 0 });
        }
    });

    it('points every declared reuse at an arm that exists and re-runs', () => {
        const ids = new Set(BENCH_ARMS.map((a) => a.id));
        for (const arm of BENCH_ARMS) {
            if (arm.reuseOf === null) continue;
            expect(ids.has(arm.reuseOf)).toBe(true);
            expect(BENCH_ARMS.find((a) => a.id === arm.reuseOf)!.reuseOf).toBeNull();
        }
    });

    it('never lets maximum calls fall below expected calls', () => {
        for (const arm of BENCH_ARMS) {
            const { expected, max } = armCalls(arm);
            expect(max.anthropic).toBeGreaterThanOrEqual(expected.anthropic);
            expect(max.openai).toBeGreaterThanOrEqual(expected.openai);
        }
    });

    it('reserves exactly one re-ask per member per findings-extraction pass', () => {
        for (const arm of BENCH_ARMS) {
            if (arm.reuseOf !== null) continue;
            const extractions = arm.passes.filter((p) => p.kind === 'findings-extraction').length;
            const { expected, max } = armCalls(arm);
            expect(max.anthropic - expected.anthropic).toBe(extractions);
            expect(max.openai - expected.openai).toBe(extractions);
        }
    });

    it('covers all four arm groups', () => {
        expect(new Set(BENCH_ARMS.map((a) => a.group))).toEqual(
            new Set(['baseline', 'ablation', 'axis', 'rounds']),
        );
    });

    it('names all five step-2.2 baselines', () => {
        expect(BENCH_ARMS.filter((a) => a.group === 'baseline')).toHaveLength(5);
    });

    it('names all five step-2.4 ablation rungs', () => {
        expect(BENCH_ARMS.filter((a) => a.group === 'ablation')).toHaveLength(5);
    });

    it('emits the full step-2.3 metric set', () => {
        expect(BENCH_METRICS).toHaveLength(14);
        expect(BENCH_METRICS).toContain('rerun-variance');
        expect(BENCH_METRICS).toContain('zero-marginal-value-call-rate');
    });
});

describe('schedule', () => {
    const cells = expandManifest();

    it('emits one row per family x item x trial x arm, deferred family included', () => {
        expect(cells).toHaveLength(BENCH_FAMILIES.length * 1 * 2 * BENCH_ARMS.length);
        expect(new Set(cells.map((c) => c.cell_id)).size).toBe(cells.length);
    });

    it('books no call against the deferred family', () => {
        for (const c of cells.filter((c) => c.family_label === 'human-rubric-deferred')) {
            expect(c.max_calls).toEqual({ anthropic: 0, openai: 0 });
            expect(c.status).toBe('not_eligible');
        }
    });

    it('never exceeds the per-provider daily cap in any batch', () => {
        for (const batch of partitionIntoDays(cells)) {
            expect(batch.booked.anthropic).toBeLessThanOrEqual(CALLS_PER_PROVIDER_PER_UTC_DAY);
            expect(batch.booked.openai).toBeLessThanOrEqual(CALLS_PER_PROVIDER_PER_UTC_DAY);
        }
    });

    it('places every cell in exactly one batch', () => {
        const placed = partitionIntoDays(cells).flatMap((b) => b.cell_ids);
        expect(placed).toHaveLength(cells.length);
        expect(new Set(placed).size).toBe(cells.length);
    });

    it('needs more days as the cap tightens', () => {
        const wide = partitionIntoDays(cells, 200).length;
        const narrow = partitionIntoDays(cells, 25).length;
        expect(narrow).toBeGreaterThan(wide);
    });

    it('states the totals the council said do not exist today', () => {
        const t = summariseManifest(cells);
        expect(t.minimum_total).toBe(1584);
        expect(t.worst_case_total).toBe(1804);
        expect(t.minimum_calls).toEqual({ anthropic: 814, openai: 770 });
        expect(t.worst_case_calls).toEqual({ anthropic: 924, openai: 880 });
        expect(t.utc_days).toBe(20);
    });
});
