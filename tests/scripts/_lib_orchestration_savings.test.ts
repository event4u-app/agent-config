import { describe, expect, it } from 'vitest';

import { aggregateOrchestrationSavings, type AuditLine } from '../../src/scripts/_lib/orchestration_savings.js';

describe('aggregateOrchestrationSavings', () => {
    it('empty input → 0 dispatches with a "no telemetry yet" note', () => {
        const r = aggregateOrchestrationSavings([]);
        expect(r.dispatches).toBe(0);
        expect(r.net_token_delta).toBe(0);
        expect(r.measured_share).toBe(0);
        expect(r.notes.join(' ')).toMatch(/No orchestration telemetry yet/i);
    });

    it('ignores non-orchestration lines and in-session (spawn_count 0) lines', () => {
        const lines: AuditLine[] = [
            { input_kind: 'phase' }, // no orchestration object
            { orchestration: { spawn_count: 0, token_delta: -999 } }, // in-session → not a dispatch
        ];
        const r = aggregateOrchestrationSavings(lines);
        expect(r.dispatches).toBe(0);
        expect(r.net_token_delta).toBe(0);
    });

    it('aggregates net delta, saved/added split, provenance, tier and class buckets', () => {
        const lines: AuditLine[] = [
            {
                orchestration: {
                    spawn_count: 1,
                    token_delta: -8000, // saved
                    token_delta_provenance: 'measured',
                    tier_chosen: 'lite',
                    task_class: 'read-only-fanout',
                },
            },
            {
                orchestration: {
                    spawn_count: 2,
                    token_delta: -2000, // saved
                    token_delta_provenance: 'estimated',
                    tier_chosen: 'lite',
                    task_class: 'mechanical-edit',
                },
            },
            {
                orchestration: {
                    spawn_count: 1,
                    token_delta: 500, // cost MORE than baseline
                    token_delta_provenance: 'measured',
                    tier_chosen: 'medium',
                    task_class: 'review-synthesis',
                },
            },
        ];
        const r = aggregateOrchestrationSavings(lines);

        expect(r.dispatches).toBe(3);
        expect(r.total_spawns).toBe(4);
        expect(r.net_token_delta).toBe(-9500);
        expect(r.tokens_saved).toBe(10000);
        expect(r.tokens_added).toBe(500);

        expect(r.by_provenance.measured.dispatches).toBe(2);
        expect(r.by_provenance.measured.net_token_delta).toBe(-7500);
        expect(r.by_provenance.estimated.dispatches).toBe(1);
        expect(r.by_provenance.estimated.net_token_delta).toBe(-2000);
        expect(r.measured_share).toBeCloseTo(2 / 3);

        expect(r.by_tier.lite).toBe(-10000);
        expect(r.by_tier.medium).toBe(500);
        expect(r.by_task_class['read-only-fanout']).toBe(-8000);

        // Honest caveats present: no-percentage limit + estimated-lossy warning.
        expect(r.notes.join(' ')).toMatch(/not derivable/i);
        expect(r.notes.join(' ')).toMatch(/ESTIMATED/i);
    });

    it('defaults absent fields safely (pre-extension line never throws)', () => {
        const r = aggregateOrchestrationSavings([{ orchestration: { spawn_count: 1 } }]);
        expect(r.dispatches).toBe(1);
        expect(r.net_token_delta).toBe(0);
        expect(r.by_tier.unknown).toBe(0);
        expect(r.by_task_class.unclassified).toBe(0);
        // Absent provenance defaults to estimated per the telemetry contract.
        expect(r.by_provenance.estimated.dispatches).toBe(1);
    });
});
