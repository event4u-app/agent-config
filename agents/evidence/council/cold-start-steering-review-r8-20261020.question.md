<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch
     drain/road-to-a-cold-start-paid-once-20261020, round 8, committed verbatim
     so the verdict recorded beside it can be checked against what was asked. -->

# Modification review, round 8 — the transient-failure rule split by error class

You are one seat of a modification review. Roadmap
`road-to-a-cold-start-paid-once` step 4.4 splits the subagent transient-failure
retry rule by error class: `rate_limit` causes no same-turn re-dispatch and
parks the slice until a recovery signal; `overloaded`, 5xx and timeout keep a
single downshift; on a subscription a rate limit never downshifts. The rule was
council-decided earlier, so the change is reviewed by the council. The contract
text in `src/agent-src/contexts/execution/subagent-steering.md` is what an
orchestrating model reads; `classifyTransientFailure()` and
`transientFailureAction()` in `src/scripts/_lib/subagent_steering.ts` are its
pure, tested reference and dispatch nothing. No other module calls them.

Round 7 (2026-10-20) ran degraded: the anthropic seat did not answer (the
council's local call counter was exhausted; it was reset before this round), so
that round is one seat, not convergence. The openai seat refused on one
blocking finding: the tier check used `o in TIER_RANK`, which admits inherited
property names, so a slot with `current_tier: 'toString'` (or `constructor`,
`__proto__`) passed validation and was decided as a valid state.

What this round changes, on top of the round-6 design (a discriminated
decision union on `malformed`; `retry_safe` must be a boolean; a malformed raw
failure is not transient; malformed input escalates with `next_tier: null` and
`next_state: null`):

1. Tier membership is an own-key check, `Object.hasOwn(TIER_RANK, t)`, behind
   one `isEscalationTier()` guard used for both tiers.
2. Four new malformed cases, written first and seen red (the inherited
   `toString` tier was decided as `park`): `toString` as current tier,
   `constructor` as original tier, `__proto__` as current tier, and
   `hasOwnProperty` as both. 61 tests pass at the head; the scripts type-check
   and the linter pass.

The generated `dist/` copy of the contract is byte-identical to the source; CI
asserts `dist == rewrite(src)` for every projected file. The diff against
`origin/main` for the contract, module and test:

```diff
diff --git a/src/agent-src/contexts/execution/subagent-steering.md b/src/agent-src/contexts/execution/subagent-steering.md
index 1fda66bf8..22b0d1152 100644
--- a/src/agent-src/contexts/execution/subagent-steering.md
+++ b/src/agent-src/contexts/execution/subagent-steering.md
@@ -31,14 +31,69 @@ dispatch → monitor → status → escalate / kill
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
+the class, so the orchestrator can inspect what the first run did. The
+declaration comes from the dispatcher's own record made before the dispatch —
+the slice spec it wrote, or a definition whose tool grant holds no write tool —
+never from the subagent's output, status envelope or self-description. A slot
+whose N=3 budget is already spent is refused, never decided again. Counters and
+the time left are the dispatcher's own state; a malformed input (a missing slot
+or field, an unknown error class, a `retry_safe` that is not a boolean, a tier
+off the ladder, a non-integer count, a negative or infinite time left) escalates
+unretried, moves no counter and carries no next state — the dispatcher's own
+slot stays the only record. A malformed raw failure is not transient.
+
+**Classify first, in this order.** Once any byte of the model's response
+arrived, nothing is transient — whatever the status or error type, an error
+event mid-stream included: the request may have been acted on. An error status
+line and its error body are not response bytes. Otherwise HTTP 429, or a
+provider error typed `rate_limit_error`, is `rate_limit`. HTTP 529, or a
+provider error typed `overloaded_error`, is `overloaded`. Any other 5xx is
+`server_error`. A client-side deadline is `timeout`, and a connection observed
+never to open (DNS failure, connection refused) is `server_error`. Anything else — no status and no bytes with no
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
index 5432294a9..31b1de830 100644
--- a/src/scripts/_lib/subagent_steering.ts
+++ b/src/scripts/_lib/subagent_steering.ts
@@ -389,3 +389,281 @@ export function escalateOnVerifyFail(inp: VerifyFailInputs): VerifyFailDecision
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
+    /**
+     * Bytes of the model's response arrived before the failure. An error status
+     * line and its error body are not response bytes; an error event inside a
+     * stream that had already produced output is.
+     */
+    response_started: boolean;
+    /** The connection was never established (DNS failure, connection refused). */
+    connect_failed: boolean;
+}
+
+/**
+ * `null` means not transient: the failure escalates to the orchestrator
+ * unretried. Once a response byte arrived the request may have been acted on,
+ * so nothing is transient after that — no status, no error type, no deadline,
+ * which is why that check runs first. A missing status with no bytes is
+ * transient only when the connection was observed never to open — the absence
+ * alone proves nothing.
+ */
+export function classifyTransientFailure(f: RawTransientFailure): TransientErrorClass | null {
+    if (!wellFormedRaw(f)) return null;
+    if (f.response_started) return null;
+    if (f.http_status === 429 || f.error_type === 'rate_limit_error') return 'rate_limit';
+    if (f.http_status === 529 || f.error_type === 'overloaded_error') return 'overloaded';
+    if (f.http_status !== null && f.http_status >= 500 && f.http_status <= 599) return 'server_error';
+    if (f.client_deadline) return 'timeout';
+    if (f.http_status === null && f.connect_failed) return 'server_error';
+    return null;
+}
+
+/** Every field present with its declared type; a caller may be untyped. */
+function wellFormedRaw(f: unknown): f is RawTransientFailure {
+    if (f === null || typeof f !== 'object' || Array.isArray(f)) return false;
+    const o = f as Record<string, unknown>;
+    const status = o['http_status'];
+    if (status !== null && !(typeof status === 'number' && Number.isInteger(status))) return false;
+    const type = o['error_type'];
+    if (type !== null && typeof type !== 'string') return false;
+    return ['client_deadline', 'response_started', 'connect_failed'].every((k) => typeof o[k] === 'boolean');
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
+    /**
+     * The slice is declared read-only or idempotent, so a re-run cannot
+     * duplicate an effect. Only the literal `true` counts. Its provenance is the
+     * dispatcher's own record from before the dispatch — the slice spec it
+     * wrote, or a definition whose tool grant holds no write tool — never the
+     * subagent's output, status envelope or self-description.
+     */
+    retry_safe: boolean;
+    /** Time left in the run, from the dispatcher's own clock; `null` when unknown. */
+    run_remaining_ms: number | null;
+}
+
+const TIER_RANK: Readonly<Record<EscalationTier, number>> = { lite: 0, medium: 1, high: 2 };
+
+/** Own keys only: `in` would admit `toString`, `constructor` and `__proto__`. */
+function isEscalationTier(t: unknown): t is EscalationTier {
+    return typeof t === 'string' && Object.hasOwn(TIER_RANK, t);
+}
+
+function isCount(n: unknown): boolean {
+    return typeof n === 'number' && Number.isInteger(n) && n >= 0;
+}
+
+/**
+ * Why the caller-supplied slot or clock cannot be decided over, or `null`. The
+ * counters are carried by the caller between calls, so this function never
+ * assumes they are well-formed: a tier outside the ladder, a downshift that did
+ * not lower the tier, or a non-integer count is refused rather than decided.
+ */
+const ERROR_CLASSES: ReadonlySet<unknown> = new Set<TransientErrorClass>(['rate_limit', 'overloaded', 'server_error', 'timeout']);
+
+function malformedInput(inp: unknown): string | null {
+    if (inp === null || typeof inp !== 'object' || Array.isArray(inp)) return 'input';
+    const i = inp as Partial<TransientFailureInputs>;
+    if (!ERROR_CLASSES.has(i.error_class)) return 'error_class';
+    if (i.retry_after_ms !== null && typeof i.retry_after_ms !== 'number') return 'retry_after_ms';
+    if (typeof i.retry_safe !== 'boolean') return 'retry_safe';
+    const s = i.slot as Partial<SlotState> | null | undefined;
+    if (s === null || typeof s !== 'object' || Array.isArray(s)) return 'slot';
+    const o = s.original_tier;
+    const c = s.current_tier;
+    if (!isEscalationTier(o)) return 'original_tier';
+    if (!isEscalationTier(c)) return 'current_tier';
+    if (s.downshifts_used !== 0 && s.downshifts_used !== 1) return 'downshifts_used';
+    const drop = TIER_RANK[o] - TIER_RANK[c];
+    // After a consumed attempt the slot is back at its original tier with its
+    // downshift still spent, so the tier sits at most one downshift below.
+    if (drop < 0 || drop > s.downshifts_used) return 'current_tier against downshifts_used';
+    if (!isCount(s.parks)) return 'parks';
+    if (!isCount(s.attempts_consumed)) return 'attempts_consumed';
+    const r = i.run_remaining_ms;
+    if (r !== null && !(typeof r === 'number' && Number.isFinite(r) && r >= 0)) return 'run_remaining_ms';
+    return null;
+}
+
+interface TransientDecisionBase {
+    redispatch_same_turn: boolean;
+    /** Minimum wait before the next dispatch; binding over any other signal. */
+    wait_ms: number | null;
+    /** Re-run `decideWorkerReuse` before the next dispatch. */
+    rerun_reuse_decision: boolean;
+    /** One N=3 attempt and one `spawn_failure_rate` failure. */
+    attempt_consumed: boolean;
+    /** The N=3 budget is spent; the slice fails and the orchestrator replans. */
+    budget_exhausted: boolean;
+    /** A timed-out call may still return; its output is discarded unread. */
+    discard_late_result: boolean;
+    reason: string;
+}
+
+/** A decision over a well-formed input: the slot's next tier and counters. */
+export interface WellFormedTransientDecision extends TransientDecisionBase {
+    malformed: false;
+    action: 'park' | 'downshift' | 'count-failure' | 'escalate' | 'refuse';
+    /** Tier of the next dispatch of this slot. */
+    next_tier: EscalationTier;
+    next_state: SlotState;
+}
+
+/**
+ * The input could not be decided over. It carries no tier and no state: the
+ * caller's own slot is the only record, and nothing here vouches for it.
+ */
+export interface MalformedTransientDecision extends TransientDecisionBase {
+    malformed: true;
+    action: 'escalate';
+    next_tier: null;
+    next_state: null;
+}
+
+export type TransientFailureDecision = WellFormedTransientDecision | MalformedTransientDecision;
+
+const TIER_BELOW: Readonly<Record<EscalationTier, EscalationTier | null>> = {
+    lite: null,
+    medium: 'lite',
+    high: 'medium',
+};
+
+export function transientFailureAction(inp: TransientFailureInputs): TransientFailureDecision {
+    // Validated before anything reads a field: the escalation below must not
+    // throw on the input it exists to refuse.
+    const malformed = malformedInput(inp);
+    if (malformed !== null) {
+        return {
+            malformed: true,
+            action: 'escalate',
+            redispatch_same_turn: false,
+            wait_ms: null,
+            next_tier: null,
+            rerun_reuse_decision: false,
+            attempt_consumed: false,
+            budget_exhausted: false,
+            discard_late_result: false,
+            next_state: null,
+            reason: `malformed ${malformed} — escalate unretried, no counter moved`,
+        };
+    }
+    const s = inp.slot;
+    const wait_ms = inp.retry_after_ms !== null && Number.isFinite(inp.retry_after_ms) && inp.retry_after_ms >= 0
+        ? inp.retry_after_ms
+        : null;
+    const discard_late_result = inp.error_class === 'timeout';
+    const halt = (action: 'escalate' | 'refuse', reason: string): WellFormedTransientDecision => ({
+        malformed: false,
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
+    const consume = (reason: string): WellFormedTransientDecision => {
+        const attempts_consumed = s.attempts_consumed + 1;
+        return {
+            malformed: false,
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
+    const park = (reason: string): WellFormedTransientDecision => {
+        if (s.parks >= 1) return consume(`${inp.error_class} on a slot that already parked — one attempt consumed, no second park`);
+        return {
+            malformed: false,
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
+    if (inp.retry_safe !== true) return halt('escalate', `${inp.error_class} on a slice not declared read-only or idempotent — escalate unretried`);
+    if (inp.error_class === 'rate_limit') {
+        return park('rate_limit — park until a recovery signal, then re-run the reuse decision at the same tier');
+    }
+    if (wait_ms !== null && (inp.run_remaining_ms === null || wait_ms > inp.run_remaining_ms)) {
+        return park(`${inp.error_class} with a Retry-After the run cannot be shown to wait out — park, no same-turn re-dispatch`);
+    }
+    const below = TIER_BELOW[s.current_tier];
+    if (s.downshifts_used >= 1 || below === null) return consume(`${inp.error_class} with no downshift left — one attempt consumed`);
+    return {
+        malformed: false,
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
index 15de4208d..756a92df7 100644
--- a/tests/scripts/_lib_subagent_steering.test.ts
+++ b/tests/scripts/_lib_subagent_steering.test.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it } from 'vitest';
 
-import { MAX_ATTEMPTS_PER_TARGET, MAX_CONSECUTIVE_TYPE_FAILURES, breachedGuardrails, budgetHalt, isLayerDisabled, escalateOnVerifyFail, escalationPromotionCandidates, readOrchestrationMetrics, readTierRoutingMetrics, sliceDispatchAllowed, verifyPassDrift, typeStop } from '../../src/scripts/_lib/subagent_steering.js';
+import { MAX_ATTEMPTS_PER_TARGET, MAX_CONSECUTIVE_TYPE_FAILURES, breachedGuardrails, budgetHalt, isLayerDisabled, escalateOnVerifyFail, escalationPromotionCandidates, readOrchestrationMetrics, readTierRoutingMetrics, sliceDispatchAllowed, transientFailureAction, verifyPassDrift, typeStop, classifyTransientFailure, type EscalationTier, type RawTransientFailure, type SlotState, type TransientErrorClass, type WellFormedTransientDecision } from '../../src/scripts/_lib/subagent_steering.js';
 
 describe('isLayerDisabled — kill-switch', () => {
     it('emergency halt on → disabled', () => {
@@ -307,3 +307,336 @@ describe('escalateOnVerifyFail — downshift cascade (M3)', () => {
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
+    const decide = (
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
+    // A well-formed fixture that comes back malformed is itself a failure.
+    const step = (...args: Parameters<typeof decide>): WellFormedTransientDecision => {
+        const d = decide(...args);
+        if (d.malformed) throw new Error(`well-formed fixture decided as malformed: ${d.reason}`);
+        return d;
+    };
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
+
+    // Round-4 finding 2: the counters and the time left are caller-supplied and
+    // were trusted unchecked. Every malformed input fails closed — escalate,
+    // never re-dispatch, never move a counter.
+    it('malformed slot counters or time left escalate unretried and move no counter', () => {
+        const bad: Array<[string, SlotState, number | null]> = [
+            ['downshifts above one', { ...fresh('high'), downshifts_used: 2 as 0 | 1 }, 600_000],
+            ['negative parks', { ...fresh('high'), parks: -1 }, 600_000],
+            ['fractional parks', { ...fresh('high'), parks: 0.5 }, 600_000],
+            ['NaN attempts', { ...fresh('high'), attempts_consumed: Number.NaN }, 600_000],
+            ['negative attempts', { ...fresh('high'), attempts_consumed: -1 }, 600_000],
+            ['unknown tier', { ...fresh('high'), current_tier: 'giant' as EscalationTier }, 600_000],
+            ['current tier above original', { ...fresh('lite'), current_tier: 'high' }, 600_000],
+            ['two tiers below with one downshift', { ...fresh('high'), current_tier: 'lite', downshifts_used: 1 }, 600_000],
+            ['NaN time left', fresh('high'), Number.NaN],
+            ['negative time left', fresh('high'), -1],
+            ['infinite time left', fresh('high'), Number.POSITIVE_INFINITY],
+            // Round-7 finding: an `in` check admitted inherited property names.
+            ['inherited name as current tier', { ...fresh('high'), current_tier: 'toString' as EscalationTier }, 600_000],
+            ['inherited name as original tier', { ...fresh('high'), original_tier: 'constructor' as EscalationTier }, 600_000],
+            ['__proto__ as tier', { ...fresh('high'), current_tier: '__proto__' as EscalationTier }, 600_000],
+            ['hasOwnProperty as tier', { ...fresh('high'), original_tier: 'hasOwnProperty' as EscalationTier, current_tier: 'hasOwnProperty' as EscalationTier }, 600_000],
+        ];
+        for (const [label, slot, run_remaining_ms] of bad) {
+            for (const error_class of ['rate_limit', 'overloaded', 'server_error', 'timeout'] as const) {
+                const d = decide(slot, error_class, null, { run_remaining_ms });
+                expect(d.action, label).toBe('escalate');
+                expect(d.redispatch_same_turn, label).toBe(false);
+                expect(d.attempt_consumed, label).toBe(false);
+                // Round-6 finding: the malformed decision carries no state it
+                // cannot vouch for — `null`, never the input cast to a slot.
+                expect(d.malformed, label).toBe(true);
+                expect(d.next_state, label).toBeNull();
+                expect(d.next_tier, label).toBeNull();
+                expect(d.reason, label).toMatch(/malformed/);
+            }
+        }
+    });
+
+    // Round-5 finding: a missing slot reached the escalate helper, which read
+    // its fields and threw — the fail-closed path crashed on the very input it
+    // existed for. A missing input, a missing field and an unknown class are
+    // all refused without a throw.
+    it('a missing slot, a missing field or an unknown class escalates without throwing', () => {
+        const valid = { error_class: 'overloaded', retry_after_ms: null, slot: fresh('high'), retry_safe: true, run_remaining_ms: 600_000 };
+        const { parks: _parks, ...noParks } = fresh('high');
+        void _parks;
+        const cases: Array<[string, unknown]> = [
+            ['null input', null],
+            ['undefined input', undefined],
+            ['null slot', { ...valid, slot: null }],
+            ['undefined slot', { ...valid, slot: undefined }],
+            ['slot that is an array', { ...valid, slot: [] }],
+            ['slot missing parks', { ...valid, slot: noParks }],
+            ['unknown error class', { ...valid, error_class: 'teapot' }],
+            ['missing error class', { ...valid, error_class: undefined }],
+            ['Retry-After that is not a number', { ...valid, retry_after_ms: '30000' }],
+        ];
+        for (const [label, inp] of cases) {
+            let d: ReturnType<typeof transientFailureAction> | undefined;
+            expect(() => {
+                d = transientFailureAction(inp as Parameters<typeof transientFailureAction>[0]);
+            }, label).not.toThrow();
+            expect(d?.action, label).toBe('escalate');
+            expect(d?.redispatch_same_turn, label).toBe(false);
+            expect(d?.attempt_consumed, label).toBe(false);
+            expect(d?.malformed, label).toBe(true);
+            expect(d?.next_state, label).toBeNull();
+            expect(d?.reason, label).toMatch(/malformed/);
+        }
+    });
+
+    // Round-6 finding: a missing `retry_safe` read as an ordinary unsafe slice,
+    // while the contract calls a missing field malformed.
+    it('a retry_safe that is not a boolean is malformed; false is an unsafe slice', () => {
+        for (const retry_safe of ['true', 1, null, undefined] as unknown[]) {
+            const d = transientFailureAction({
+                error_class: 'overloaded',
+                retry_after_ms: null,
+                slot: fresh('high'),
+                retry_safe: retry_safe as boolean,
+                run_remaining_ms: 600_000,
+            });
+            expect(d.action).toBe('escalate');
+            expect(d.redispatch_same_turn).toBe(false);
+            expect(d.malformed).toBe(true);
+        }
+        const unsafe = step(fresh('high'), 'overloaded', null, { retry_safe: false });
+        expect(unsafe).toMatchObject({ action: 'escalate', malformed: false });
+        expect(unsafe.next_state).toEqual(fresh('high'));
+    });
+
+    it('a well-formed decision is never marked malformed', () => {
+        for (const error_class of ['rate_limit', 'overloaded', 'server_error', 'timeout'] as const) {
+            const d = step(fresh('high'), error_class);
+            expect(d.malformed).toBe(false);
+            expect(d.next_state).not.toBeNull();
+            expect(d.next_tier).not.toBeNull();
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
+
+    // Round-4 finding 1: the status branches ran before `response_started`, so a
+    // 5xx — or a rate-limit or overload error event — arriving mid-stream was
+    // still transient, contradicting "once any response byte arrived nothing
+    // below applies".
+    it('any status or error type after a partial response is not transient', () => {
+        for (const over of [
+            { http_status: 500 },
+            { http_status: 503 },
+            { http_status: 529 },
+            { http_status: 429 },
+            { error_type: 'rate_limit_error' },
+            { error_type: 'overloaded_error' },
+        ] as Array<Partial<RawTransientFailure>>) {
+            expect(classifyTransientFailure(raw({ ...over, response_started: true })), JSON.stringify(over)).toBeNull();
+        }
+    });
+
+    // Round-6 finding: the classifier read its fields unchecked, so an untyped
+    // caller could make it throw or read a string status as a rate limit.
+    it('a malformed raw failure is not transient and never throws', () => {
+        const cases: unknown[] = [
+            null,
+            undefined,
+            'HTTP 429',
+            [],
+            { ...raw({}), http_status: '429' },
+            { ...raw({}), http_status: 429.5 },
+            { ...raw({}), error_type: 7 },
+            { ...raw({}), http_status: 503, response_started: undefined },
+            { ...raw({}), client_deadline: 'yes' },
+            { ...raw({}), connect_failed: 1 },
+            { http_status: 429 },
+        ];
+        for (const f of cases) {
+            let c: ReturnType<typeof classifyTransientFailure> | 'unset' = 'unset';
+            expect(() => {
+                c = classifyTransientFailure(f as RawTransientFailure);
+            }, JSON.stringify(f)).not.toThrow();
+            expect(c, JSON.stringify(f)).toBeNull();
+        }
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
