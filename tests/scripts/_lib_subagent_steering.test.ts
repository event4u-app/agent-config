import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOrchestrationLine } from '../../src/scripts/_lib/orchestration_record.js';

import { MAX_ATTEMPTS_PER_TARGET, MAX_CONSECUTIVE_TYPE_FAILURES, breachedGuardrails, budgetHalt, isLayerDisabled, escalateOnVerifyFail, escalationPromotionCandidates, liteEscalationRecords, readOrchestrationMetrics, readTierRoutingMetrics, sliceDispatchAllowed, transientFailureAction, verifyPassDrift, typeStop, classifyTransientFailure, type EscalationTier, type RawTransientFailure, type SlotState, type TransientErrorClass, type WellFormedTransientDecision } from '../../src/scripts/_lib/subagent_steering.js';

describe('isLayerDisabled — kill-switch', () => {
    it('emergency halt on → disabled', () => {
        expect(isLayerDisabled({ halted: true })).toBe(true);
    });
    it('no halt → active', () => {
        expect(isLayerDisabled({ halted: false })).toBe(false);
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

    it('reads lines carrying the lean-init additive fields tolerantly (audit-log-v1 forward-compat)', () => {
        const withLeanInit = makeOrchLine({
            init_tokens: 1200,
            payload_hash: 'a1b2c3d4e5f6',
            lookup_class: 'references',
            route_taken: 'primitive',
            budget_hit: false,
            correctness_match: true,
            cache_hit: true,
            origin: 'lean-init-2026',
        });
        const m = readOrchestrationMetrics([withLeanInit]);
        expect(m.token_ratio).toBeGreaterThan(0);
        expect(m.spawn_failure_rate).toBe(0); // outcome DONE parsed despite extra fields
        expect(m.verify_skip_rate).toBe(0); // verify_mode deterministic parsed despite extra fields
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

// The transient branch split by error class: a rate limit is the one class a
// same-turn retry one tier lower makes worse, since it sends a fresh cold
// start into a limiter that is already saturated.
/** A proxy whose every operation throws, `Array.isArray` included. */
function revoked(): object {
    const r = Proxy.revocable({}, {});
    r.revoke();
    return r.proxy;
}

describe('transientFailureAction — split by error class', () => {
    const tiers = ['lite', 'medium', 'high'] as const;
    const fresh = (tier: EscalationTier): SlotState => ({
        original_tier: tier,
        current_tier: tier,
        downshifts_used: 0,
        parks: 0,
        attempts_consumed: 0,
    });
    const decide = (
        slot: SlotState,
        error_class: TransientErrorClass,
        retry_after_ms: number | null = null,
        over: { retry_safe?: boolean; run_remaining_ms?: number | null } = {},
    ) =>
        transientFailureAction({
            error_class,
            retry_after_ms,
            slot,
            retry_safe: over.retry_safe ?? true,
            run_remaining_ms: over.run_remaining_ms === undefined ? 600_000 : over.run_remaining_ms,
        });
    // A well-formed fixture that comes back malformed is itself a failure.
    const step = (...args: Parameters<typeof decide>): WellFormedTransientDecision => {
        const d = decide(...args);
        if (d.malformed) throw new Error(`well-formed fixture decided as malformed: ${d.reason}`);
        return d;
    };

    it('rate-limit-never-redispatches-same-turn', () => {
        for (const tier of tiers) {
            for (const downshifts_used of [0, 1] as const) {
                const d = step({ ...fresh(tier), downshifts_used }, 'rate_limit');
                expect(d.action).toBe('park');
                expect(d.redispatch_same_turn).toBe(false);
                // Never a smaller model: the post-recovery dispatch keeps the tier.
                expect(d.next_tier).toBe(tier);
                expect(d.rerun_reuse_decision).toBe(true);
                // A park is not a failed attempt, and it is recorded on the slot.
                expect(d.attempt_consumed).toBe(false);
                expect(d.next_state.parks).toBe(1);
            }
        }
    });

    it('a second park on the same slot consumes an attempt instead of parking again', () => {
        const parked = step(fresh('high'), 'rate_limit').next_state;
        const d = step(parked, 'rate_limit');
        expect(d.action).toBe('count-failure');
        expect(d.attempt_consumed).toBe(true);
        expect(d.next_state.attempts_consumed).toBe(1);
        expect(d.redispatch_same_turn).toBe(false);
    });

    it('repeated rate limits reach the N=3 budget instead of looping', () => {
        let slot = step(fresh('high'), 'rate_limit').next_state;
        let last = step(slot, 'rate_limit');
        for (let i = 0; i < 2; i++) {
            slot = last.next_state;
            last = step(slot, 'rate_limit');
        }
        expect(last.next_state.attempts_consumed).toBe(MAX_ATTEMPTS_PER_TARGET);
        expect(last.budget_exhausted).toBe(true);
    });

    it('overloaded then rate-limited: the park keeps the downshifted tier, no second downshift', () => {
        const first = step(fresh('high'), 'overloaded');
        expect(first).toMatchObject({ action: 'downshift', next_tier: 'medium', attempt_consumed: false });
        expect(first.next_state).toMatchObject({ current_tier: 'medium', downshifts_used: 1 });
        const second = step(first.next_state, 'rate_limit');
        expect(second).toMatchObject({ action: 'park', next_tier: 'medium' });
        const third = step(second.next_state, 'timeout');
        expect(third.action).toBe('count-failure');
    });

    it('overloaded, 5xx and timeout keep the single same-turn downshift', () => {
        for (const error_class of ['overloaded', 'server_error', 'timeout'] as const) {
            const d = step(fresh('high'), error_class);
            expect(d.action).toBe('downshift');
            expect(d.redispatch_same_turn).toBe(true);
            expect(d.next_tier).toBe('medium');
            expect(d.rerun_reuse_decision).toBe(false);
        }
    });

    it('after a consumed attempt the next one starts at the original tier with no downshift left', () => {
        const down = step(fresh('high'), 'server_error').next_state;
        const failed = step(down, 'server_error');
        expect(failed).toMatchObject({ action: 'count-failure', next_tier: 'high' });
        expect(failed.next_state).toMatchObject({ current_tier: 'high', downshifts_used: 1, attempts_consumed: 1 });
        expect(step(failed.next_state, 'overloaded').action).toBe('count-failure');
        expect(step(fresh('lite'), 'overloaded')).toMatchObject({ action: 'count-failure', next_tier: 'lite' });
    });

    it('a valid Retry-After delays any re-dispatch, whatever the class', () => {
        expect(step(fresh('high'), 'server_error', 30_000).wait_ms).toBe(30_000);
        expect(step(fresh('high'), 'rate_limit', 60_000).wait_ms).toBe(60_000);
        expect(step(fresh('high'), 'overloaded', Number.NaN).wait_ms).toBeNull();
        expect(step(fresh('high'), 'overloaded', -1).wait_ms).toBeNull();
    });

    it('a timed-out call may still return: its late result is discarded', () => {
        expect(step(fresh('high'), 'timeout').discard_late_result).toBe(true);
        expect(step(fresh('high'), 'server_error').discard_late_result).toBe(false);
    });

    // Round-3 finding: a retried subagent may duplicate work its first run
    // already did. Only a slice declared read-only or idempotent is re-dispatched.
    it('a slice that is not retry-safe is never re-dispatched, whatever the class', () => {
        for (const error_class of ['rate_limit', 'overloaded', 'server_error', 'timeout'] as const) {
            const d = step(fresh('high'), error_class, null, { retry_safe: false });
            expect(d.action).toBe('escalate');
            expect(d.redispatch_same_turn).toBe(false);
            expect(d.attempt_consumed).toBe(false);
            expect(d.next_state).toEqual(fresh('high'));
        }
    });

    // Round-3 finding: a Retry-After the run cannot wait out conflicts with a
    // same-turn re-dispatch.
    it('a Retry-After longer than the run parks instead of downshifting in the same turn', () => {
        for (const error_class of ['overloaded', 'server_error', 'timeout'] as const) {
            const d = step(fresh('high'), error_class, 120_000, { run_remaining_ms: 60_000 });
            expect(d).toMatchObject({ action: 'park', redispatch_same_turn: false, next_tier: 'high', wait_ms: 120_000 });
            expect(d.next_state).toMatchObject({ downshifts_used: 0, parks: 1 });
        }
        // An unknown remaining run cannot be shown to cover the wait.
        expect(step(fresh('high'), 'overloaded', 1_000, { run_remaining_ms: null }).action).toBe('park');
        // A wait that fits keeps the downshift.
        expect(step(fresh('high'), 'overloaded', 1_000, { run_remaining_ms: 60_000 }).action).toBe('downshift');
    });

    // Round-3 finding: the function accepted a slot whose budget was already spent.
    it('an exhausted slot is refused, not decided again', () => {
        const spent: SlotState = { ...fresh('high'), attempts_consumed: MAX_ATTEMPTS_PER_TARGET };
        for (const error_class of ['rate_limit', 'overloaded', 'server_error', 'timeout'] as const) {
            const d = step(spent, error_class);
            expect(d).toMatchObject({ action: 'refuse', redispatch_same_turn: false, attempt_consumed: false, budget_exhausted: true });
            expect(d.next_state).toEqual(spent);
        }
    });

    // Round-4 finding 2: the counters and the time left are caller-supplied and
    // were trusted unchecked. Every malformed input fails closed — escalate,
    // never re-dispatch, never move a counter.
    it('malformed slot counters or time left escalate unretried and move no counter', () => {
        const bad: Array<[string, SlotState, number | null]> = [
            ['downshifts above one', { ...fresh('high'), downshifts_used: 2 as 0 | 1 }, 600_000],
            ['negative parks', { ...fresh('high'), parks: -1 }, 600_000],
            ['fractional parks', { ...fresh('high'), parks: 0.5 }, 600_000],
            ['NaN attempts', { ...fresh('high'), attempts_consumed: Number.NaN }, 600_000],
            ['negative attempts', { ...fresh('high'), attempts_consumed: -1 }, 600_000],
            ['unknown tier', { ...fresh('high'), current_tier: 'giant' as EscalationTier }, 600_000],
            ['current tier above original', { ...fresh('lite'), current_tier: 'high' }, 600_000],
            ['two tiers below with one downshift', { ...fresh('high'), current_tier: 'lite', downshifts_used: 1 }, 600_000],
            ['NaN time left', fresh('high'), Number.NaN],
            ['negative time left', fresh('high'), -1],
            ['infinite time left', fresh('high'), Number.POSITIVE_INFINITY],
            // Round-7 finding: an `in` check admitted inherited property names.
            ['inherited name as current tier', { ...fresh('high'), current_tier: 'toString' as EscalationTier }, 600_000],
            ['inherited name as original tier', { ...fresh('high'), original_tier: 'constructor' as EscalationTier }, 600_000],
            ['__proto__ as tier', { ...fresh('high'), current_tier: '__proto__' as EscalationTier }, 600_000],
            ['hasOwnProperty as tier', { ...fresh('high'), original_tier: 'hasOwnProperty' as EscalationTier, current_tier: 'hasOwnProperty' as EscalationTier }, 600_000],
        ];
        for (const [label, slot, run_remaining_ms] of bad) {
            for (const error_class of ['rate_limit', 'overloaded', 'server_error', 'timeout'] as const) {
                const d = decide(slot, error_class, null, { run_remaining_ms });
                expect(d.action, label).toBe('escalate');
                expect(d.redispatch_same_turn, label).toBe(false);
                expect(d.attempt_consumed, label).toBe(false);
                // Round-6 finding: the malformed decision carries no state it
                // cannot vouch for — `null`, never the input cast to a slot.
                expect(d.malformed, label).toBe(true);
                expect(d.next_state, label).toBeNull();
                expect(d.next_tier, label).toBeNull();
                expect(d.reason, label).toMatch(/malformed/);
            }
        }
    });

    // Round-5 finding: a missing slot reached the escalate helper, which read
    // its fields and threw — the fail-closed path crashed on the very input it
    // existed for. A missing input, a missing field and an unknown class are
    // all refused without a throw.
    it('a missing slot, a missing field or an unknown class escalates without throwing', () => {
        const valid = { error_class: 'overloaded', retry_after_ms: null, slot: fresh('high'), retry_safe: true, run_remaining_ms: 600_000 };
        const { parks: _parks, ...noParks } = fresh('high');
        void _parks;
        const cases: Array<[string, unknown]> = [
            ['null input', null],
            ['undefined input', undefined],
            ['null slot', { ...valid, slot: null }],
            ['undefined slot', { ...valid, slot: undefined }],
            ['slot that is an array', { ...valid, slot: [] }],
            ['slot missing parks', { ...valid, slot: noParks }],
            ['unknown error class', { ...valid, error_class: 'teapot' }],
            ['missing error class', { ...valid, error_class: undefined }],
            ['Retry-After that is not a number', { ...valid, retry_after_ms: '30000' }],
            // Round-8 finding: fields were read through ordinary property access,
            // so inherited values passed and accessors could throw or change.
            ['slot whose fields are inherited', { ...valid, slot: Object.create(fresh('high')) }],
            ['input whose fields are inherited', Object.create(valid)],
            ['slot field behind a getter', { ...valid, slot: Object.defineProperty({ ...fresh('high') }, 'parks', { get: () => 0, enumerable: true }) }],
            ['input field behind a throwing getter', Object.defineProperty({ ...valid }, 'retry_safe', { get: () => { throw new Error('boom'); }, enumerable: true })],
            ['proxy input that throws on every trap', new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error('trap'); }, get: () => { throw new Error('trap'); }, has: () => { throw new Error('trap'); } })],
            ['proxy slot that throws on every trap', { ...valid, slot: new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error('trap'); }, get: () => { throw new Error('trap'); } }) }],
            // Round-9 finding: `Array.isArray` on a revoked proxy throws, and it
            // ran before the `try`.
            ['revoked proxy input', revoked()],
            ['revoked proxy slot', { ...valid, slot: revoked() }],
        ];
        for (const [label, inp] of cases) {
            let d: ReturnType<typeof transientFailureAction> | undefined;
            expect(() => {
                d = transientFailureAction(inp as Parameters<typeof transientFailureAction>[0]);
            }, label).not.toThrow();
            expect(d?.action, label).toBe('escalate');
            expect(d?.redispatch_same_turn, label).toBe(false);
            expect(d?.attempt_consumed, label).toBe(false);
            expect(d?.malformed, label).toBe(true);
            expect(d?.next_state, label).toBeNull();
            expect(d?.reason, label).toMatch(/malformed/);
        }
    });

    // Round-6 finding: a missing `retry_safe` read as an ordinary unsafe slice,
    // while the contract calls a missing field malformed.
    it('a retry_safe that is not a boolean is malformed; false is an unsafe slice', () => {
        for (const retry_safe of ['true', 1, null, undefined] as unknown[]) {
            const d = transientFailureAction({
                error_class: 'overloaded',
                retry_after_ms: null,
                slot: fresh('high'),
                retry_safe: retry_safe as boolean,
                run_remaining_ms: 600_000,
            });
            expect(d.action).toBe('escalate');
            expect(d.redispatch_same_turn).toBe(false);
            expect(d.malformed).toBe(true);
        }
        const unsafe = step(fresh('high'), 'overloaded', null, { retry_safe: false });
        expect(unsafe).toMatchObject({ action: 'escalate', malformed: false });
        expect(unsafe.next_state).toEqual(fresh('high'));
    });

    it('a well-formed decision is never marked malformed', () => {
        for (const error_class of ['rate_limit', 'overloaded', 'server_error', 'timeout'] as const) {
            const d = step(fresh('high'), error_class);
            expect(d.malformed).toBe(false);
            expect(d.next_state).not.toBeNull();
            expect(d.next_tier).not.toBeNull();
        }
    });
});

describe('classifyTransientFailure — precedence', () => {
    const raw = (over: Partial<RawTransientFailure>): RawTransientFailure => ({
        http_status: null,
        error_type: null,
        client_deadline: false,
        response_started: false,
        connect_failed: false,
        ...over,
    });

    it('429 or a rate-limit type is rate_limit, ahead of everything else', () => {
        expect(classifyTransientFailure(raw({ http_status: 429 }))).toBe('rate_limit');
        expect(classifyTransientFailure(raw({ http_status: 503, error_type: 'rate_limit_error' }))).toBe('rate_limit');
    });

    it('529 or an overloaded type is overloaded; any other 5xx is server_error', () => {
        expect(classifyTransientFailure(raw({ http_status: 529 }))).toBe('overloaded');
        expect(classifyTransientFailure(raw({ http_status: 503, error_type: 'overloaded_error' }))).toBe('overloaded');
        expect(classifyTransientFailure(raw({ http_status: 503 }))).toBe('server_error');
        expect(classifyTransientFailure(raw({ http_status: 500 }))).toBe('server_error');
    });

    it('a client deadline before any byte is timeout; a connection that never opened is server_error', () => {
        expect(classifyTransientFailure(raw({ client_deadline: true }))).toBe('timeout');
        expect(classifyTransientFailure(raw({ connect_failed: true }))).toBe('server_error');
    });

    // Round-3 findings: a timeout after a partial response may already have run,
    // and an absent status with no bytes proves no transport failure.
    it('a timeout after a partial response is not transient', () => {
        expect(classifyTransientFailure(raw({ client_deadline: true, response_started: true }))).toBeNull();
    });

    it('no status, no bytes and no observed connect failure is not transient', () => {
        expect(classifyTransientFailure(raw({}))).toBeNull();
    });

    it('a failure after a partial response, or a non-5xx status, is not transient', () => {
        expect(classifyTransientFailure(raw({ response_started: true }))).toBeNull();
        expect(classifyTransientFailure(raw({ http_status: 400 }))).toBeNull();
        expect(classifyTransientFailure(raw({ http_status: 200, response_started: true }))).toBeNull();
        expect(classifyTransientFailure(raw({ connect_failed: true, response_started: true }))).toBeNull();
    });

    // Round-4 finding 1: the status branches ran before `response_started`, so a
    // 5xx — or a rate-limit or overload error event — arriving mid-stream was
    // still transient, contradicting "once any response byte arrived nothing
    // below applies".
    it('any status or error type after a partial response is not transient', () => {
        for (const over of [
            { http_status: 500 },
            { http_status: 503 },
            { http_status: 529 },
            { http_status: 429 },
            { error_type: 'rate_limit_error' },
            { error_type: 'overloaded_error' },
        ] as Array<Partial<RawTransientFailure>>) {
            expect(classifyTransientFailure(raw({ ...over, response_started: true })), JSON.stringify(over)).toBeNull();
        }
    });

    // Round-6 finding: the classifier read its fields unchecked, so an untyped
    // caller could make it throw or read a string status as a rate limit.
    it('a malformed raw failure is not transient and never throws', () => {
        const cases: unknown[] = [
            null,
            undefined,
            'HTTP 429',
            [],
            { ...raw({}), http_status: '429' },
            { ...raw({}), http_status: 429.5 },
            { ...raw({}), error_type: 7 },
            { ...raw({}), http_status: 503, response_started: undefined },
            { ...raw({}), client_deadline: 'yes' },
            { ...raw({}), connect_failed: 1 },
            { http_status: 429 },
            Object.create(raw({ http_status: 429 })),
            Object.defineProperty(raw({}), 'http_status', { get: () => 429, enumerable: true }),
            Object.defineProperty(raw({}), 'response_started', { get: () => { throw new Error('boom'); }, enumerable: true }),
            new Proxy(raw({ http_status: 429 }), { getOwnPropertyDescriptor: () => { throw new Error('trap'); }, get: () => { throw new Error('trap'); } }),
            revoked(),
        ];
        // Labelled by index: a fixture with a throwing getter cannot be stringified.
        cases.forEach((f, idx) => {
            let c: ReturnType<typeof classifyTransientFailure> | 'unset' = 'unset';
            expect(() => {
                c = classifyTransientFailure(f as RawTransientFailure);
            }, `case ${idx}`).not.toThrow();
            expect(c, `case ${idx}`).toBeNull();
        });
    });
});

// road-to-a-tier-the-dispatch-carries 1.3: a lite leg does not climb by itself.
describe('liteEscalationRecords', () => {
    it('an escalation is one lite record with a named outcome and one medium record', () => {
        const recs = liteEscalationRecords({
            outcome: 'BLOCKED',
            consecutive_failures: 1,
            ts: '2026-10-22T12:00:00.000Z',
            ids: ['lite-1', 'medium-1'],
        });
        expect(recs).toHaveLength(2);
        const [lite, medium] = recs.map((r) => buildOrchestrationLine(r));
        expect(lite!.errors).toEqual([]);
        expect(medium!.errors).toEqual([]);
        const lo = lite!.line!.orchestration as Record<string, unknown>;
        const mo = medium!.line!.orchestration as Record<string, unknown>;
        expect(lo).toMatchObject({ tier_chosen: 'lite', model_requested: 'haiku', outcome: 'BLOCKED', spawn_count: 1 });
        expect(mo).toMatchObject({ tier_chosen: 'medium', model_requested: 'sonnet', escalated: true, escalated_from: 'lite' });
        // The lite leg is one dispatch: it spawned nothing of its own.
        expect(lo['escalated']).not.toBe(true);
    });

    it('a second failure fails the slice instead of climbing again', () => {
        expect(liteEscalationRecords({ outcome: 'BLOCKED', consecutive_failures: 2, ts: 't', ids: ['a', 'b'] })).toHaveLength(1);
    });

    it('package workers hold no dispatch tool, so a lite leg cannot spawn', () => {
        for (const name of ['ac-worker', 'ac-researcher']) {
            const text = fs.readFileSync(path.join(process.cwd(), 'src', 'subagents', `${name}.md`), 'utf8');
            const tools = text.split('\n---')[0]!.match(/^tools:\n((?:  - .*\n)+)/m)?.[1] ?? '';
            expect(tools).not.toMatch(/- (Agent|Task)\b/);
        }
    });
});
