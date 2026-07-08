import { describe, expect, it } from 'vitest';

import { MAX_ATTEMPTS_PER_TARGET, MAX_CONSECUTIVE_TYPE_FAILURES, breachedGuardrails, budgetHalt, isLayerDisabled, escalateOnVerifyFail, escalationPromotionCandidates, readOrchestrationMetrics, readTierRoutingMetrics, sliceDispatchAllowed, verifyPassDrift, typeStop } from '../../src/scripts/_lib/subagent_steering.js';

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

// ---------------------------------------------------------------------------
// Failure-type stop + ordered-slice dependency gate
// (road-to-flow-learnings Phase 2).
// ---------------------------------------------------------------------------

describe('typeStop — N=3 budget applied per subagent type', () => {
    it('derives from the per-target cap (2 fails + escalation = 3 attempts)', () => {
        expect(MAX_CONSECUTIVE_TYPE_FAILURES).toBe(MAX_ATTEMPTS_PER_TARGET - 1);
    });

    it('does not stop after a single verification failure', () => {
        expect(typeStop(0)).toBe(false);
        expect(typeStop(1)).toBe(false);
    });

    it('stops after two consecutive verification failures', () => {
        expect(typeStop(2)).toBe(true);
        expect(typeStop(3)).toBe(true);
    });
});

describe('sliceDispatchAllowed — ordered-slice dependency gate', () => {
    it('allows root / independent slices (no declared parent)', () => {
        expect(sliceDispatchAllowed(null, new Set()).allowed).toBe(true);
        expect(sliceDispatchAllowed('', new Set()).allowed).toBe(true);
    });

    it('refuses a slice whose declared parent lacks a verified return', () => {
        const d = sliceDispatchAllowed('step-1', new Set());
        expect(d.allowed).toBe(false);
        expect(d.reason).toContain("parent 'step-1' has no verified return");
    });

    it('allows a slice once the parent return is verified', () => {
        const d = sliceDispatchAllowed('step-1', new Set(['step-1']));
        expect(d.allowed).toBe(true);
        expect(d.reason).toContain('verified return');
    });

    it('is exact-match on the parent id (no prefix leniency)', () => {
        expect(sliceDispatchAllowed('step-1', new Set(['step-10'])).allowed).toBe(false);
    });
});

describe('readTierRoutingMetrics — per-tier / per-class routing aggregates', () => {
    const routedLine = (orch: Record<string, unknown>): string =>
        JSON.stringify({
            schema_version: 1,
            id: 'test-id',
            ts: '2026-07-08T12:00:00Z',
            input_kind: 'orchestration',
            type: 'phase',
            orchestration: {
                task_size_estimate: 100,
                spawn_count: 1,
                token_delta: 0,
                outcome: 'DONE',
                verify_mode: 'deterministic',
                ...orch,
            },
        });

    it('empty input → empty aggregates', () => {
        const m = readTierRoutingMetrics([]);
        expect(m.dispatches_by_tier).toEqual({});
        expect(m.escalation_rate_by_class).toEqual({});
        expect(m.verify_pass_rate_by_tier).toEqual({});
    });

    it('pre-extension lines (no routing fields) are ignored per aggregate', () => {
        const m = readTierRoutingMetrics([routedLine({})]);
        expect(m.dispatches_by_tier).toEqual({});
        expect(m.dispatches_by_class).toEqual({});
    });

    it('counts dispatches by tier and class, escalations by class', () => {
        const lines = [
            routedLine({ task_class: 'mechanical-edit', tier_chosen: 'lite', tier_source: 'static' }),
            routedLine({ task_class: 'mechanical-edit', tier_chosen: 'lite', tier_source: 'inferred', escalated_from: 'lite' }),
            routedLine({ task_class: 'read-only-fanout', tier_chosen: 'lite', tier_source: 'static' }),
        ];
        const m = readTierRoutingMetrics(lines);
        expect(m.dispatches_by_tier).toEqual({ lite: 3 });
        expect(m.dispatches_by_class).toEqual({ 'mechanical-edit': 2, 'read-only-fanout': 1 });
        expect(m.escalations_by_class).toEqual({ 'mechanical-edit': 1 });
        expect(m.escalation_rate_by_class['mechanical-edit']).toBeCloseTo(0.5);
        expect(m.escalation_rate_by_class['read-only-fanout']).toBe(0);
    });

    it('verify pass rate per tier: skipped counts toward neither side', () => {
        const lines = [
            routedLine({ task_class: 'mechanical-edit', tier_chosen: 'medium', escalated_from: 'lite', verify_result_by_tier: { lite: 'fail', medium: 'pass' } }),
            routedLine({ task_class: 'mechanical-edit', tier_chosen: 'lite', verify_result_by_tier: { lite: 'pass' } }),
            routedLine({ task_class: 'read-only-fanout', tier_chosen: 'lite', verify_result_by_tier: { lite: 'skipped' } }),
        ];
        const m = readTierRoutingMetrics(lines);
        expect(m.verify_pass_rate_by_tier['lite']).toBeCloseTo(0.5);
        expect(m.verify_pass_rate_by_tier['medium']).toBe(1);
    });
});

describe('cost-routing tripwires — surfaced, never auto-flipped', () => {
    it('escalation tripwire fires above 40% with enough dispatches', () => {
        const m = {
            dispatches_by_tier: {},
            dispatches_by_class: { 'mechanical-edit': 10, 'read-only-fanout': 10 },
            escalations_by_class: { 'mechanical-edit': 5 },
            escalation_rate_by_class: { 'mechanical-edit': 0.5, 'read-only-fanout': 0 },
            verify_pass_rate_by_tier: {},
        };
        expect(escalationPromotionCandidates(m)).toEqual(['mechanical-edit']);
    });

    it('noise floor: classes below min dispatches never fire', () => {
        const m = {
            dispatches_by_tier: {},
            dispatches_by_class: { 'rare-class': 2 },
            escalations_by_class: { 'rare-class': 2 },
            escalation_rate_by_class: { 'rare-class': 1 },
            verify_pass_rate_by_tier: {},
        };
        expect(escalationPromotionCandidates(m)).toEqual([]);
    });

    it('exactly 40% does not fire (strict >)', () => {
        const m = {
            dispatches_by_tier: {},
            dispatches_by_class: { c: 10 },
            escalations_by_class: { c: 4 },
            escalation_rate_by_class: { c: 0.4 },
            verify_pass_rate_by_tier: {},
        };
        expect(escalationPromotionCandidates(m)).toEqual([]);
    });

    it('verify-pass drift: fires when current drops below baseline - tolerance', () => {
        expect(verifyPassDrift({ lite: 0.7, medium: 0.95 }, { lite: 0.9, medium: 1 })).toEqual(['lite']);
    });

    it('verify-pass drift: no baseline or no current data → no drift claim', () => {
        expect(verifyPassDrift({ lite: 0.5 }, {})).toEqual([]);
        expect(verifyPassDrift({}, { lite: 0.9 })).toEqual([]);
    });
});

describe('escalateOnVerifyFail — downshift cascade (M3)', () => {
    it('first verify-fail on a downshifted lite slice escalates to medium', () => {
        const d = escalateOnVerifyFail({ failed_tier: 'lite', tier_source: 'inferred', consecutive_failures: 1 });
        expect(d.action).toBe('escalate');
        expect(d.next_tier).toBe('medium');
    });

    it('static pins escalate the same way as inferred ones', () => {
        const d = escalateOnVerifyFail({ failed_tier: 'medium', tier_source: 'static', consecutive_failures: 1 });
        expect(d.action).toBe('escalate');
        expect(d.next_tier).toBe('high');
    });

    it('second failure on a downshifted slice marks it failed (orchestrator replans)', () => {
        const d = escalateOnVerifyFail({ failed_tier: 'medium', tier_source: 'inferred', consecutive_failures: 2 });
        expect(d.action).toBe('slice-failed');
        expect(d.next_tier).toBeNull();
    });

    it('verify-fail on the highest tier has nowhere to go — slice failed', () => {
        const d = escalateOnVerifyFail({ failed_tier: 'high', tier_source: 'static', consecutive_failures: 1 });
        expect(d.action).toBe('slice-failed');
    });

    it('inherit slices keep same-tier retry semantics (no behavior change)', () => {
        const d = escalateOnVerifyFail({ failed_tier: 'medium', tier_source: 'inherit', consecutive_failures: 1 });
        expect(d.action).toBe('retry-same-tier');
        expect(d.next_tier).toBe('medium');
    });

    it('inherit slices still halt on the N=3 budget', () => {
        const d = escalateOnVerifyFail({ failed_tier: 'medium', tier_source: 'inherit', consecutive_failures: 3 });
        expect(d.action).toBe('slice-failed');
    });
});
