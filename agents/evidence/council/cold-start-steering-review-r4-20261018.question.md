<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch
     drain/cold-start-rate-limit-steering-20261018, round 4, committed verbatim
     so the verdict recorded beside it can be checked against what was asked. -->

# Modification review, round 4 — the transient-failure rule split by error class

You are one seat of a modification review. Roadmap
`road-to-a-cold-start-paid-once` step 4.4 splits the subagent transient-failure
retry rule by error class: `rate_limit` causes no same-turn re-dispatch and
parks the slice until a recovery signal; `overloaded`, 5xx and timeout keep a
single downshift; on a subscription a rate limit never downshifts. The rule was
council-decided earlier, so the change is reviewed by the council. The contract
text in `src/agent-src/contexts/execution/subagent-steering.md` is what an
orchestrating model reads; `classifyTransientFailure()` and
`transientFailureAction()` in `src/scripts/_lib/subagent_steering.ts` are its
pure, tested reference and dispatch nothing.

Rounds 1–3 (2026-10-18, the same two seats) refused. The split itself was not
contested; the state machine around it was. Round 3 left four findings and a
precondition:

1. a timeout after a partial response was still retried — discarding the late
   result does not stop the original run, so non-idempotent work can duplicate;
2. "no status and no bytes" was treated as a transport failure without proof;
3. a `Retry-After` longer than the run conflicted with the overloaded branch's
   same-turn re-dispatch;
4. the function did not refuse a slot whose budget was already spent;
5. a retried subagent needs an explicit idempotency or read-only precondition.

What commit `d0864b251` does, in that order:

1. once any response byte arrived, nothing is transient (deadline included);
2. a missing status with no bytes is `server_error` only when a new input
   `connect_failed` says the connection was observed never to open; otherwise
   not transient;
3. a new input `run_remaining_ms`: a valid `Retry-After` longer than it, or with
   it unknown, parks the slot instead of downshifting; the park counter is now
   one per slot of any cause (`parks`, renamed from `rate_limit_parks`), so a
   second park consumes an attempt;
4. a slot with `attempts_consumed` at the N=3 budget returns `refuse`, state
   unchanged;
5. a new input `retry_safe` (the slice is declared read-only or idempotent);
   when false every class returns `escalate`, nothing re-dispatched, state
   unchanged. The order of checks is: spent budget, retry-safety, rate limit,
   unwaitable `Retry-After`, downshift.

The tests for 1–5 were written first and seen red against the round-3 code (8 of
55 failing); 55 pass at the head. The diff against `origin/main`, contract,
module and test (the generated `dist/` copy of the contract is identical and
omitted):

```diff
diff --git a/src/agent-src/contexts/execution/subagent-steering.md b/src/agent-src/contexts/execution/subagent-steering.md
index 1fda66bf8..9bd688c68 100644
--- a/src/agent-src/contexts/execution/subagent-steering.md
+++ b/src/agent-src/contexts/execution/subagent-steering.md
@@ -31,14 +31,60 @@ dispatch → monitor → status → escalate / kill
 - `subagents.max_parallel` caps concurrent dispatch. No speculative fan-out:
   a subagent is spawned only for a classified-delegable target, never on spec.
 
-## Transient-failure retry — tier downshift
-
-On a transient subagent failure (HTTP 429, 5xx, or timeout), retry **once** at
-the next-lower model tier (haiku → if already haiku, escalate to the `spawn_failure`
-counter) before counting a failed attempt. Maximum one downshift per subagent
-call. If the downshifted retry also fails, increment the `spawn_failure_rate`
-counter normally. Never downshift twice on the same slot — deterministic cap
-prevents silent drift to the cheapest model on every failure.
+## Transient-failure retry — split by error class
+
+**Only a retry-safe slice is retried.** A slice is re-dispatched after a
+transient failure only when it is declared read-only or idempotent: a subagent's
+first run may have acted before it failed, and discarding its late result does
+not stop it. Any other slice escalates to the orchestrator unretried, whatever
+the class, so the orchestrator can inspect what the first run did. A slot whose
+N=3 budget is already spent is refused, never decided again.
+
+**Classify first, in this order.** HTTP 429, or a provider error typed
+`rate_limit_error`, is `rate_limit`. HTTP 529, or a provider error typed
+`overloaded_error`, is `overloaded`. Any other 5xx is `server_error`. Once any
+response byte arrived nothing below applies: the request may have been acted
+on, so the failure is not transient. Before that, a client-side deadline is
+`timeout`, and a connection observed never to open (DNS failure, connection
+refused) is `server_error`. Anything else — no status and no bytes with no
+observed connect failure, a 4xx, a malformed response, a `BLOCKED` envelope —
+is not transient and escalates as below.
+
+**Counters belong to the slot.** One downshift and one park per slot, across
+every class and every attempt of it.
+
+**A valid `Retry-After` is binding, whatever the class.** No re-dispatch of the
+slot happens before it elapses — not on a quota notice, not on a new user turn.
+A wait the run cannot be shown to cover — longer than the time left, or the time
+left unknown — parks the slot instead of re-dispatching it in the same turn.
+
+**Rate limit — park, never re-dispatch in the same turn, never downshift.** On
+the measured host a same-turn retry is a fresh cold start sent into a limiter
+that is already saturated, and the limiter's scope (model, account or
+organisation) is not known, so a smaller model is no way around it on any
+billing class. The slice parks until a recovery signal: `Retry-After` elapsing
+when the response carried one; otherwise the host's quota-resume notice;
+otherwise the next user turn. Then the warm-worker reuse decision runs again (a
+wait past the cache TTL retires the worker and briefs a successor from its
+capsule) and the slice dispatches **at the same tier, as the same attempt**: a
+park is not a failed attempt. A second park on a slot, of any cause, is not
+taken; it consumes an attempt. If the run ends before a recovery signal
+arrives, the slice is returned as parked — neither failed nor verified.
+
+**Overloaded, 5xx or timeout — one downshift.** Retry **once** at the
+next-lower model tier before consuming an attempt. A slot that already
+downshifted, or sits at the lowest tier, consumes an attempt instead. A timed-out
+call may still complete: its late result is discarded unread, and the retry owns
+the slot — which is why only a retry-safe slice gets one.
+
+A consumed attempt increments `spawn_failure_rate` and spends one of the N=3
+budget; the next attempt dispatches at the slot's **original** tier, with no
+downshift left once one was taken. None is a verification failure — no output
+was accepted — so the verify-fail cascade below never starts from one.
+`classifyTransientFailure()` and `transientFailureAction()` in
+`_lib/subagent_steering.ts` are the tested reference: each failure maps to one
+transition and the slot's next counters. Neither dispatches anything; this text
+is what an orchestrating model reads.
 
 This is the only automatic response to a transient failure; structural or
 semantic errors (e.g. `BLOCKED` status envelope) do not trigger a tier
diff --git a/src/scripts/_lib/subagent_steering.ts b/src/scripts/_lib/subagent_steering.ts
index 5432294a9..305259342 100644
--- a/src/scripts/_lib/subagent_steering.ts
+++ b/src/scripts/_lib/subagent_steering.ts
@@ -389,3 +389,175 @@ export function escalateOnVerifyFail(inp: VerifyFailInputs): VerifyFailDecision
         reason: `verify-fail on ${inp.failed_tier} → re-dispatch one tier up (${above}); consumes the N=3 budget`,
     };
 }
+
+/**
+ * Transient-failure handling, split by error class — the transient-failure
+ * retry rule of the `subagent-steering` contract, as two pure steps: classify
+ * the raw failure, then decide the transition and the slot's next state.
+ *
+ * Neither dispatches anything. The contract text is what a dispatching model
+ * reads; these are its tested reference, and a caller carries `next_state`
+ * forward so a sequence of failures is decided over the same counters.
+ *
+ * Only a slice declared read-only or idempotent is re-dispatched: a subagent's
+ * first run may have acted before it failed, and discarding its late result
+ * does not stop it. Any other slice escalates unretried. A slot whose N=3
+ * budget is already spent is refused. Slot counters persist across every
+ * attempt of the slot. A rate limit is never answered with a smaller model: the
+ * limiter's scope (model, account or organisation) is not known. A park is not
+ * a failed attempt; the dispatch after recovery is the same attempt at the same
+ * tier. A slot parks once — a rate limit, or a `Retry-After` the run cannot be
+ * shown to wait out — and the next park consumes an attempt, so repeated limits
+ * reach the N=3 budget. A consumed attempt is a spawn failure, never a
+ * verification failure. After a consumed attempt the next one starts at the
+ * slot's original tier, with no downshift left once one was taken.
+ */
+export type TransientErrorClass = 'rate_limit' | 'overloaded' | 'server_error' | 'timeout';
+
+export interface RawTransientFailure {
+    http_status: number | null;
+    /** Provider error type, when the response carries one. */
+    error_type: string | null;
+    /** The client deadline fired before the response completed. */
+    client_deadline: boolean;
+    /** Any response bytes arrived before the failure. */
+    response_started: boolean;
+    /** The connection was never established (DNS failure, connection refused). */
+    connect_failed: boolean;
+}
+
+/**
+ * `null` means not transient: the failure escalates to the orchestrator
+ * unretried. Once a response byte arrived the request may have been acted on,
+ * so neither a deadline nor a connect failure is transient after that. A
+ * missing status with no bytes is transient only when the connection was
+ * observed never to open — the absence alone proves nothing.
+ */
+export function classifyTransientFailure(f: RawTransientFailure): TransientErrorClass | null {
+    if (f.http_status === 429 || f.error_type === 'rate_limit_error') return 'rate_limit';
+    if (f.http_status === 529 || f.error_type === 'overloaded_error') return 'overloaded';
+    if (f.http_status !== null && f.http_status >= 500 && f.http_status <= 599) return 'server_error';
+    if (f.response_started) return null;
+    if (f.client_deadline) return 'timeout';
+    if (f.http_status === null && f.connect_failed) return 'server_error';
+    return null;
+}
+
+export interface SlotState {
+    original_tier: EscalationTier;
+    current_tier: EscalationTier;
+    /** The cap is one per slot, across every class and attempt. */
+    downshifts_used: 0 | 1;
+    /** Parks taken, of any cause; one per slot. */
+    parks: number;
+    attempts_consumed: number;
+}
+
+export interface TransientFailureInputs {
+    error_class: TransientErrorClass;
+    /** A valid `Retry-After`, in milliseconds; `null` when absent or unparseable. */
+    retry_after_ms: number | null;
+    slot: SlotState;
+    /** The slice is declared read-only or idempotent, so a re-run cannot duplicate an effect. */
+    retry_safe: boolean;
+    /** Time left in the run; `null` when unknown. */
+    run_remaining_ms: number | null;
+}
+
+export interface TransientFailureDecision {
+    action: 'park' | 'downshift' | 'count-failure' | 'escalate' | 'refuse';
+    redispatch_same_turn: boolean;
+    /** Minimum wait before the next dispatch; binding over any other signal. */
+    wait_ms: number | null;
+    /** Tier of the next dispatch of this slot. */
+    next_tier: EscalationTier;
+    /** Re-run `decideWorkerReuse` before the next dispatch. */
+    rerun_reuse_decision: boolean;
+    /** One N=3 attempt and one `spawn_failure_rate` failure. */
+    attempt_consumed: boolean;
+    /** The N=3 budget is spent; the slice fails and the orchestrator replans. */
+    budget_exhausted: boolean;
+    /** A timed-out call may still return; its output is discarded unread. */
+    discard_late_result: boolean;
+    next_state: SlotState;
+    reason: string;
+}
+
+const TIER_BELOW: Readonly<Record<EscalationTier, EscalationTier | null>> = {
+    lite: null,
+    medium: 'lite',
+    high: 'medium',
+};
+
+export function transientFailureAction(inp: TransientFailureInputs): TransientFailureDecision {
+    const s = inp.slot;
+    const wait_ms = inp.retry_after_ms !== null && Number.isFinite(inp.retry_after_ms) && inp.retry_after_ms >= 0
+        ? inp.retry_after_ms
+        : null;
+    const discard_late_result = inp.error_class === 'timeout';
+    const halt = (action: 'escalate' | 'refuse', reason: string): TransientFailureDecision => ({
+        action,
+        redispatch_same_turn: false,
+        wait_ms,
+        next_tier: s.current_tier,
+        rerun_reuse_decision: false,
+        attempt_consumed: false,
+        budget_exhausted: budgetHalt(s.attempts_consumed),
+        discard_late_result,
+        next_state: s,
+        reason,
+    });
+    const consume = (reason: string): TransientFailureDecision => {
+        const attempts_consumed = s.attempts_consumed + 1;
+        return {
+            action: 'count-failure',
+            redispatch_same_turn: false,
+            wait_ms,
+            next_tier: s.original_tier,
+            rerun_reuse_decision: true,
+            attempt_consumed: true,
+            budget_exhausted: budgetHalt(attempts_consumed),
+            discard_late_result,
+            next_state: { ...s, current_tier: s.original_tier, attempts_consumed },
+            reason,
+        };
+    };
+    const park = (reason: string): TransientFailureDecision => {
+        if (s.parks >= 1) return consume(`${inp.error_class} on a slot that already parked — one attempt consumed, no second park`);
+        return {
+            action: 'park',
+            redispatch_same_turn: false,
+            wait_ms,
+            next_tier: s.current_tier,
+            rerun_reuse_decision: true,
+            attempt_consumed: false,
+            budget_exhausted: false,
+            discard_late_result,
+            next_state: { ...s, parks: s.parks + 1 },
+            reason,
+        };
+    };
+
+    if (budgetHalt(s.attempts_consumed)) return halt('refuse', 'the N=3 budget of this slot is already spent — no further dispatch');
+    if (!inp.retry_safe) return halt('escalate', `${inp.error_class} on a slice not declared read-only or idempotent — escalate unretried`);
+    if (inp.error_class === 'rate_limit') {
+        return park('rate_limit — park until a recovery signal, then re-run the reuse decision at the same tier');
+    }
+    if (wait_ms !== null && (inp.run_remaining_ms === null || wait_ms > inp.run_remaining_ms)) {
+        return park(`${inp.error_class} with a Retry-After the run cannot be shown to wait out — park, no same-turn re-dispatch`);
+    }
+    const below = TIER_BELOW[s.current_tier];
+    if (s.downshifts_used >= 1 || below === null) return consume(`${inp.error_class} with no downshift left — one attempt consumed`);
+    return {
+        action: 'downshift',
+        redispatch_same_turn: true,
+        wait_ms,
+        next_tier: below,
+        rerun_reuse_decision: false,
+        attempt_consumed: false,
+        budget_exhausted: false,
+        discard_late_result,
+        next_state: { ...s, current_tier: below, downshifts_used: 1 },
+        reason: `${inp.error_class} — retry once at ${below}`,
+    };
+}
diff --git a/tests/scripts/_lib_subagent_steering.test.ts b/tests/scripts/_lib_subagent_steering.test.ts
index 15de4208d..80c83f100 100644
--- a/tests/scripts/_lib_subagent_steering.test.ts
+++ b/tests/scripts/_lib_subagent_steering.test.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it } from 'vitest';
 
-import { MAX_ATTEMPTS_PER_TARGET, MAX_CONSECUTIVE_TYPE_FAILURES, breachedGuardrails, budgetHalt, isLayerDisabled, escalateOnVerifyFail, escalationPromotionCandidates, readOrchestrationMetrics, readTierRoutingMetrics, sliceDispatchAllowed, verifyPassDrift, typeStop } from '../../src/scripts/_lib/subagent_steering.js';
+import { MAX_ATTEMPTS_PER_TARGET, MAX_CONSECUTIVE_TYPE_FAILURES, breachedGuardrails, budgetHalt, isLayerDisabled, escalateOnVerifyFail, escalationPromotionCandidates, readOrchestrationMetrics, readTierRoutingMetrics, sliceDispatchAllowed, transientFailureAction, verifyPassDrift, typeStop, classifyTransientFailure, type EscalationTier, type RawTransientFailure, type SlotState, type TransientErrorClass } from '../../src/scripts/_lib/subagent_steering.js';
 
 describe('isLayerDisabled — kill-switch', () => {
     it('emergency halt on → disabled', () => {
@@ -307,3 +307,188 @@ describe('escalateOnVerifyFail — downshift cascade (M3)', () => {
         expect(d.action).toBe('slice-failed');
     });
 });
+
+// The transient branch split by error class: a rate limit is the one class a
+// same-turn retry one tier lower makes worse, since it sends a fresh cold
+// start into a limiter that is already saturated.
+describe('transientFailureAction — split by error class', () => {
+    const tiers = ['lite', 'medium', 'high'] as const;
+    const fresh = (tier: EscalationTier): SlotState => ({
+        original_tier: tier,
+        current_tier: tier,
+        downshifts_used: 0,
+        parks: 0,
+        attempts_consumed: 0,
+    });
+    const step = (
+        slot: SlotState,
+        error_class: TransientErrorClass,
+        retry_after_ms: number | null = null,
+        over: { retry_safe?: boolean; run_remaining_ms?: number | null } = {},
+    ) =>
+        transientFailureAction({
+            error_class,
+            retry_after_ms,
+            slot,
+            retry_safe: over.retry_safe ?? true,
+            run_remaining_ms: over.run_remaining_ms === undefined ? 600_000 : over.run_remaining_ms,
+        });
+
+    it('rate-limit-never-redispatches-same-turn', () => {
+        for (const tier of tiers) {
+            for (const downshifts_used of [0, 1] as const) {
+                const d = step({ ...fresh(tier), downshifts_used }, 'rate_limit');
+                expect(d.action).toBe('park');
+                expect(d.redispatch_same_turn).toBe(false);
+                // Never a smaller model: the post-recovery dispatch keeps the tier.
+                expect(d.next_tier).toBe(tier);
+                expect(d.rerun_reuse_decision).toBe(true);
+                // A park is not a failed attempt, and it is recorded on the slot.
+                expect(d.attempt_consumed).toBe(false);
+                expect(d.next_state.parks).toBe(1);
+            }
+        }
+    });
+
+    it('a second park on the same slot consumes an attempt instead of parking again', () => {
+        const parked = step(fresh('high'), 'rate_limit').next_state;
+        const d = step(parked, 'rate_limit');
+        expect(d.action).toBe('count-failure');
+        expect(d.attempt_consumed).toBe(true);
+        expect(d.next_state.attempts_consumed).toBe(1);
+        expect(d.redispatch_same_turn).toBe(false);
+    });
+
+    it('repeated rate limits reach the N=3 budget instead of looping', () => {
+        let slot = step(fresh('high'), 'rate_limit').next_state;
+        let last = step(slot, 'rate_limit');
+        for (let i = 0; i < 2; i++) {
+            slot = last.next_state;
+            last = step(slot, 'rate_limit');
+        }
+        expect(last.next_state.attempts_consumed).toBe(MAX_ATTEMPTS_PER_TARGET);
+        expect(last.budget_exhausted).toBe(true);
+    });
+
+    it('overloaded then rate-limited: the park keeps the downshifted tier, no second downshift', () => {
+        const first = step(fresh('high'), 'overloaded');
+        expect(first).toMatchObject({ action: 'downshift', next_tier: 'medium', attempt_consumed: false });
+        expect(first.next_state).toMatchObject({ current_tier: 'medium', downshifts_used: 1 });
+        const second = step(first.next_state, 'rate_limit');
+        expect(second).toMatchObject({ action: 'park', next_tier: 'medium' });
+        const third = step(second.next_state, 'timeout');
+        expect(third.action).toBe('count-failure');
+    });
+
+    it('overloaded, 5xx and timeout keep the single same-turn downshift', () => {
+        for (const error_class of ['overloaded', 'server_error', 'timeout'] as const) {
+            const d = step(fresh('high'), error_class);
+            expect(d.action).toBe('downshift');
+            expect(d.redispatch_same_turn).toBe(true);
+            expect(d.next_tier).toBe('medium');
+            expect(d.rerun_reuse_decision).toBe(false);
+        }
+    });
+
+    it('after a consumed attempt the next one starts at the original tier with no downshift left', () => {
+        const down = step(fresh('high'), 'server_error').next_state;
+        const failed = step(down, 'server_error');
+        expect(failed).toMatchObject({ action: 'count-failure', next_tier: 'high' });
+        expect(failed.next_state).toMatchObject({ current_tier: 'high', downshifts_used: 1, attempts_consumed: 1 });
+        expect(step(failed.next_state, 'overloaded').action).toBe('count-failure');
+        expect(step(fresh('lite'), 'overloaded')).toMatchObject({ action: 'count-failure', next_tier: 'lite' });
+    });
+
+    it('a valid Retry-After delays any re-dispatch, whatever the class', () => {
+        expect(step(fresh('high'), 'server_error', 30_000).wait_ms).toBe(30_000);
+        expect(step(fresh('high'), 'rate_limit', 60_000).wait_ms).toBe(60_000);
+        expect(step(fresh('high'), 'overloaded', Number.NaN).wait_ms).toBeNull();
+        expect(step(fresh('high'), 'overloaded', -1).wait_ms).toBeNull();
+    });
+
+    it('a timed-out call may still return: its late result is discarded', () => {
+        expect(step(fresh('high'), 'timeout').discard_late_result).toBe(true);
+        expect(step(fresh('high'), 'server_error').discard_late_result).toBe(false);
+    });
+
+    // Round-3 finding: a retried subagent may duplicate work its first run
+    // already did. Only a slice declared read-only or idempotent is re-dispatched.
+    it('a slice that is not retry-safe is never re-dispatched, whatever the class', () => {
+        for (const error_class of ['rate_limit', 'overloaded', 'server_error', 'timeout'] as const) {
+            const d = step(fresh('high'), error_class, null, { retry_safe: false });
+            expect(d.action).toBe('escalate');
+            expect(d.redispatch_same_turn).toBe(false);
+            expect(d.attempt_consumed).toBe(false);
+            expect(d.next_state).toEqual(fresh('high'));
+        }
+    });
+
+    // Round-3 finding: a Retry-After the run cannot wait out conflicts with a
+    // same-turn re-dispatch.
+    it('a Retry-After longer than the run parks instead of downshifting in the same turn', () => {
+        for (const error_class of ['overloaded', 'server_error', 'timeout'] as const) {
+            const d = step(fresh('high'), error_class, 120_000, { run_remaining_ms: 60_000 });
+            expect(d).toMatchObject({ action: 'park', redispatch_same_turn: false, next_tier: 'high', wait_ms: 120_000 });
+            expect(d.next_state).toMatchObject({ downshifts_used: 0, parks: 1 });
+        }
+        // An unknown remaining run cannot be shown to cover the wait.
+        expect(step(fresh('high'), 'overloaded', 1_000, { run_remaining_ms: null }).action).toBe('park');
+        // A wait that fits keeps the downshift.
+        expect(step(fresh('high'), 'overloaded', 1_000, { run_remaining_ms: 60_000 }).action).toBe('downshift');
+    });
+
+    // Round-3 finding: the function accepted a slot whose budget was already spent.
+    it('an exhausted slot is refused, not decided again', () => {
+        const spent: SlotState = { ...fresh('high'), attempts_consumed: MAX_ATTEMPTS_PER_TARGET };
+        for (const error_class of ['rate_limit', 'overloaded', 'server_error', 'timeout'] as const) {
+            const d = step(spent, error_class);
+            expect(d).toMatchObject({ action: 'refuse', redispatch_same_turn: false, attempt_consumed: false, budget_exhausted: true });
+            expect(d.next_state).toEqual(spent);
+        }
+    });
+});
+
+describe('classifyTransientFailure — precedence', () => {
+    const raw = (over: Partial<RawTransientFailure>): RawTransientFailure => ({
+        http_status: null,
+        error_type: null,
+        client_deadline: false,
+        response_started: false,
+        connect_failed: false,
+        ...over,
+    });
+
+    it('429 or a rate-limit type is rate_limit, ahead of everything else', () => {
+        expect(classifyTransientFailure(raw({ http_status: 429 }))).toBe('rate_limit');
+        expect(classifyTransientFailure(raw({ http_status: 503, error_type: 'rate_limit_error' }))).toBe('rate_limit');
+    });
+
+    it('529 or an overloaded type is overloaded; any other 5xx is server_error', () => {
+        expect(classifyTransientFailure(raw({ http_status: 529 }))).toBe('overloaded');
+        expect(classifyTransientFailure(raw({ http_status: 503, error_type: 'overloaded_error' }))).toBe('overloaded');
+        expect(classifyTransientFailure(raw({ http_status: 503 }))).toBe('server_error');
+        expect(classifyTransientFailure(raw({ http_status: 500 }))).toBe('server_error');
+    });
+
+    it('a client deadline before any byte is timeout; a connection that never opened is server_error', () => {
+        expect(classifyTransientFailure(raw({ client_deadline: true }))).toBe('timeout');
+        expect(classifyTransientFailure(raw({ connect_failed: true }))).toBe('server_error');
+    });
+
+    // Round-3 findings: a timeout after a partial response may already have run,
+    // and an absent status with no bytes proves no transport failure.
+    it('a timeout after a partial response is not transient', () => {
+        expect(classifyTransientFailure(raw({ client_deadline: true, response_started: true }))).toBeNull();
+    });
+
+    it('no status, no bytes and no observed connect failure is not transient', () => {
+        expect(classifyTransientFailure(raw({}))).toBeNull();
+    });
+
+    it('a failure after a partial response, or a non-5xx status, is not transient', () => {
+        expect(classifyTransientFailure(raw({ response_started: true }))).toBeNull();
+        expect(classifyTransientFailure(raw({ http_status: 400 }))).toBeNull();
+        expect(classifyTransientFailure(raw({ http_status: 200, response_started: true }))).toBeNull();
+        expect(classifyTransientFailure(raw({ connect_failed: true, response_started: true }))).toBeNull();
+    });
+});
```

Answer each question below, numbered 1 to 9 in this order, each on its own
numbered top-level line, then close with exactly one stance line in the form
`STANCE: <label> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>` where
<label> is one of `ratified`, `confirmed-non-expanding`, `refused`.

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?
