import { describe, expect, it } from 'vitest';

import { MAX_ATTEMPTS_PER_TARGET, breachedGuardrails, budgetHalt, isLayerDisabled, readOrchestrationMetrics } from '../../src/scripts/_lib/subagent_steering.js';

describe('isLayerDisabled — kill-switch', () => {
    it('master switch off → disabled', () => {
        expect(isLayerDisabled({ enabled: false, auto: 'on' })).toBe(true);
    });
    it('auto off → disabled', () => {
        expect(isLayerDisabled({ enabled: true, auto: 'off' })).toBe(true);
    });
    it('enabled + auto on/ask → active', () => {
        expect(isLayerDisabled({ enabled: true, auto: 'on' })).toBe(false);
        expect(isLayerDisabled({ enabled: true, auto: 'ask' })).toBe(false);
    });
});

describe('budgetHalt — N=3 per target', () => {
    it('halts at the cap, not before', () => {
        expect(budgetHalt(MAX_ATTEMPTS_PER_TARGET - 1)).toBe(false);
        expect(budgetHalt(MAX_ATTEMPTS_PER_TARGET)).toBe(true);
        expect(budgetHalt(MAX_ATTEMPTS_PER_TARGET + 1)).toBe(true);
    });
});

describe('breachedGuardrails — surfaced, not auto-disable', () => {
    it('all within bounds → no breach', () => {
        expect(
            breachedGuardrails({ token_ratio: 1.5, spawn_failure_rate: 0.05, verify_skip_rate: 0.0, user_override_rate: 0.1 }),
        ).toEqual([]);
    });

    it('token blowup over 2x → breach', () => {
        expect(breachedGuardrails({ token_ratio: 2.5, spawn_failure_rate: 0, verify_skip_rate: 0, user_override_rate: 0 })).toContain('token_blowup');
    });

    it('verify skip over 1% → breach (safety)', () => {
        expect(breachedGuardrails({ token_ratio: 1, spawn_failure_rate: 0, verify_skip_rate: 0.02, user_override_rate: 0 })).toContain('verify_skip');
    });

    it('multiple breaches reported together', () => {
        const b = breachedGuardrails({ token_ratio: 3, spawn_failure_rate: 0.2, verify_skip_rate: 0.05, user_override_rate: 0.5 });
        expect(b).toEqual(expect.arrayContaining(['token_blowup', 'spawn_failure', 'verify_skip', 'user_override']));
    });
});

describe('readOrchestrationMetrics — aggregate from JSONL lines', () => {
    const makeOrchLine = (overrides: Record<string, unknown> = {}): string =>
        JSON.stringify({
            schema_version: 1,
            id: 'test-id',
            ts: '2026-06-30T12:00:00Z',
            input_kind: 'orchestration',
            type: 'phase',
            orchestration: {
                task_size_estimate: 100,
                spawn_count: 2,
                token_delta: 50,
                outcome: 'DONE',
                verify_mode: 'deterministic',
                ...overrides,
            },
        });

    it('empty lines → safe defaults', () => {
        const m = readOrchestrationMetrics([]);
        expect(m.token_ratio).toBe(1);
        expect(m.spawn_failure_rate).toBe(0);
        expect(m.verify_skip_rate).toBe(0);
    });

    it('non-orchestration lines are ignored', () => {
        const nonOrch = JSON.stringify({ schema_version: 1, input_kind: 'ticket' });
        const m = readOrchestrationMetrics([nonOrch]);
        expect(m.token_ratio).toBe(1); // default
    });

    it('computes token_ratio as (estimate + delta) / estimate', () => {
        // estimate=100, delta=50 → ratio = 150/100 = 1.5
        const m = readOrchestrationMetrics([makeOrchLine({ task_size_estimate: 100, token_delta: 50 })]);
        expect(m.token_ratio).toBeCloseTo(1.5);
    });

    it('token blowup (delta > estimate) → ratio > 2 → guardrail fires', () => {
        // estimate=100, delta=250 → ratio = 350/100 = 3.5 → token_blowup
        const m = readOrchestrationMetrics([makeOrchLine({ task_size_estimate: 100, token_delta: 250 })]);
        expect(breachedGuardrails(m)).toContain('token_blowup');
    });

    it('negative token_delta (saved) → ratio < 1 → no breach', () => {
        // estimate=100, delta=-40 → ratio = 60/100 = 0.6
        const m = readOrchestrationMetrics([makeOrchLine({ task_size_estimate: 100, token_delta: -40 })]);
        expect(m.token_ratio).toBeCloseTo(0.6);
        expect(breachedGuardrails(m)).not.toContain('token_blowup');
    });

    it('BLOCKED outcome increments spawn_failure_rate', () => {
        const m = readOrchestrationMetrics([
            makeOrchLine({ outcome: 'DONE' }),
            makeOrchLine({ outcome: 'BLOCKED' }),
        ]);
        expect(m.spawn_failure_rate).toBeCloseTo(0.5);
    });

    it('verify_mode none increments verify_skip_rate', () => {
        const m = readOrchestrationMetrics([makeOrchLine({ verify_mode: 'none' })]);
        expect(m.verify_skip_rate).toBe(1);
        expect(breachedGuardrails(m)).toContain('verify_skip');
    });

    it('malformed lines are silently skipped', () => {
        const m = readOrchestrationMetrics(['not-json', makeOrchLine()]);
        expect(m.token_ratio).toBeCloseTo(1.5); // only the valid line counted
    });
});
