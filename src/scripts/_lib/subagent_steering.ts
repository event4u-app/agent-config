/**
 * Subagent steering & guardrails (Phase 5).
 *
 * Pure helpers (isLayerDisabled, budgetHalt, breachedGuardrails) + one
 * I/O reader (readOrchestrationMetrics) that aggregates telemetry from
 * the audit-log-v1 JSONL to feed into breachedGuardrails. Contract:
 * `src/agent-src/contexts/execution/subagent-steering.md`.
 *
 * Automatic cohort-level disable is OUT OF SCOPE — a config package runs no
 * daemon. Breaches are surfaced for the maintainer/user to act on; the only
 * automatic stop is the per-target N=3 budget.
 */

/** Max consecutive failed attempts on one validation target before halting. */
export const MAX_ATTEMPTS_PER_TARGET = 3;

/** Rollback guardrail thresholds (council-defined). */
export const GUARDRAILS = {
    /** Token spend vs single-agent baseline. */
    token_blowup_ratio: 2,
    /** Subagent spawn-failure rate. */
    spawn_failure_rate: 0.1,
    /** Fraction of dispatches that completed without a required verification. */
    verify_skip_rate: 0.01,
    /** Fraction of users manually disabling the layer. */
    user_override_rate: 0.3,
} as const;

/**
 * Always-on orchestration (road-to-always-on-orchestration Phase 1) removed
 * the `enabled`/`auto` settings this state used to carry — the only
 * surviving switch is the audited incident halt.
 */
export interface LayerState {
    /** `emergency.orchestration_halt`. */
    halted: boolean;
}

/** The kill-switch: layer is disabled only during an active emergency halt. */
export function isLayerDisabled(state: LayerState): boolean {
    return state.halted;
}

/** N=3 per-target budget: halt once consecutive failed attempts reach the cap. */
export function budgetHalt(consecutiveFailures: number): boolean {
    return consecutiveFailures >= MAX_ATTEMPTS_PER_TARGET;
}

/**
 * Failure-type stop (road-to-flow-learnings Phase 2) — an APPLICATION of the
 * N=3 budget at subagent-type granularity, never a new mechanism: two
 * consecutive verification-failed returns from the same subagent type plus
 * the escalation step exhaust the three-attempt budget. When this fires the
 * orchestrator stops dispatching that type for the session, surfaces both
 * failures to the human, and runs the remaining slices in-session. There is
 * still NO automatic cohort-disable — the Iron Law above stands unchanged.
 */
export const MAX_CONSECUTIVE_TYPE_FAILURES = MAX_ATTEMPTS_PER_TARGET - 1;

/** True when a subagent type has exhausted its in-session dispatch budget. */
export function typeStop(consecutiveVerificationFailures: number): boolean {
    return consecutiveVerificationFailures >= MAX_CONSECUTIVE_TYPE_FAILURES;
}

/** Decision returned by {@link sliceDispatchAllowed}. */
export interface SliceDispatchDecision {
    readonly allowed: boolean;
    readonly reason: string;
}

/**
 * Ordered-slice dependency gate (road-to-flow-learnings Phase 2) — makes the
 * `do-in-steps` contract deterministic: a slice that declares a parent MUST
 * NOT dispatch before the parent's return has been verified by the
 * orchestrator. Slices without a declared parent (roots / independent
 * slices) always pass this gate.
 */
export function sliceDispatchAllowed(
    declaredParent: string | null,
    verifiedReturns: ReadonlySet<string>,
): SliceDispatchDecision {
    if (declaredParent === null || declaredParent.length === 0) {
        return { allowed: true, reason: 'no declared parent — root or independent slice' };
    }
    if (verifiedReturns.has(declaredParent)) {
        return { allowed: true, reason: `parent '${declaredParent}' has a verified return` };
    }
    return {
        allowed: false,
        reason:
            `parent '${declaredParent}' has no verified return in session state — ` +
            'verify (or revise) the parent before dispatching this slice',
    };
}

export interface GuardrailMetrics {
    /** Observed token spend / single-agent baseline (e.g. 2.4 = 2.4x). */
    token_ratio: number;
    spawn_failure_rate: number;
    verify_skip_rate: number;
    user_override_rate: number;
}

/**
 * Evaluate the rollback guardrails. Returns the list of breached threshold
 * names (empty = all clear). The orchestrator surfaces a non-empty result —
 * it does NOT auto-disable (no daemon); the maintainer/user decides.
 */
export function breachedGuardrails(m: GuardrailMetrics): string[] {
    const breached: string[] = [];
    if (m.token_ratio > GUARDRAILS.token_blowup_ratio) breached.push('token_blowup');
    if (m.spawn_failure_rate > GUARDRAILS.spawn_failure_rate) breached.push('spawn_failure');
    if (m.verify_skip_rate > GUARDRAILS.verify_skip_rate) breached.push('verify_skip');
    if (m.user_override_rate > GUARDRAILS.user_override_rate) breached.push('user_override');
    return breached;
}

/** Raw orchestration entry parsed from an audit-log-v1 JSONL line. */
export interface OrchEntry {
    task_size_estimate: number;
    spawn_count: number;
    token_delta: number;
    outcome: string;
    verify_mode: string;
    /** Routing extension (road-to-cost-aware-model-routing) — null on pre-extension lines. */
    task_class: string | null;
    tier_chosen: string | null;
    tier_source: string | null;
    escalated_from: string | null;
    verify_result_by_tier: Record<string, string> | null;
}

/**
 * Read orchestration telemetry lines from audit-log JSONL and aggregate into
 * GuardrailMetrics. Uses dependency-injected line reader for testability.
 *
 * token_ratio approximation: (task_size_estimate + token_delta) /
 * task_size_estimate (proxy for orchestrated/single-agent ratio; 1.0 when
 * task_size_estimate == 0). Positive token_delta = orchestration cost more.
 *
 * user_override_rate cannot be measured from telemetry alone — returns 0.
 */
/** Parse orchestration entries from audit-log-v1 JSONL lines (shared by all aggregators). */
export function parseOrchEntries(lines: string[]): OrchEntry[] {
    const entries: OrchEntry[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            if (parsed['input_kind'] !== 'orchestration') continue;
            const orch = parsed['orchestration'] as Record<string, unknown> | undefined;
            if (!orch) continue;
            const vbt = orch['verify_result_by_tier'];
            entries.push({
                task_size_estimate: Number(orch['task_size_estimate'] ?? 0),
                spawn_count: Number(orch['spawn_count'] ?? 0),
                token_delta: Number(orch['token_delta'] ?? 0),
                outcome: String(orch['outcome'] ?? ''),
                verify_mode: String(orch['verify_mode'] ?? ''),
                task_class: orch['task_class'] == null ? null : String(orch['task_class']),
                tier_chosen: orch['tier_chosen'] == null ? null : String(orch['tier_chosen']),
                tier_source: orch['tier_source'] == null ? null : String(orch['tier_source']),
                escalated_from: orch['escalated_from'] == null ? null : String(orch['escalated_from']),
                verify_result_by_tier:
                    vbt != null && typeof vbt === 'object' && !Array.isArray(vbt)
                        ? Object.fromEntries(Object.entries(vbt as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
                        : null,
            });
        } catch {
            // skip malformed lines
        }
    }
    return entries;
}

export function readOrchestrationMetrics(
    lines: string[],
): GuardrailMetrics {
    const entries = parseOrchEntries(lines);

    if (entries.length === 0) {
        return { token_ratio: 1, spawn_failure_rate: 0, verify_skip_rate: 0, user_override_rate: 0 };
    }

    const token_ratios = entries.map(e =>
        e.task_size_estimate > 0
            ? (e.task_size_estimate + e.token_delta) / e.task_size_estimate
            : 1,
    );
    const token_ratio = token_ratios.reduce((a, b) => a + b, 0) / token_ratios.length;

    const failures = entries.filter(e => e.outcome === 'BLOCKED' || e.outcome === 'killed').length;
    const verify_skips = entries.filter(e => e.verify_mode === 'none').length;

    return {
        token_ratio,
        spawn_failure_rate: failures / entries.length,
        verify_skip_rate: verify_skips / entries.length,
        user_override_rate: 0, // cannot measure from telemetry alone
    };
}

/**
 * Per-tier / per-class routing aggregates (road-to-cost-aware-model-routing
 * Phase 0). Pure aggregation over the routing telemetry fields — feeds the
 * `/cost:report` per-tier view and the Phase-2 tripwires. Pre-extension lines
 * (null routing fields) are ignored per aggregate.
 */
export interface TierRoutingMetrics {
    /** Dispatch count per tier_chosen. */
    dispatches_by_tier: Record<string, number>;
    /** Dispatch count per task_class. */
    dispatches_by_class: Record<string, number>;
    /** Escalation count per task_class (entries with escalated_from set). */
    escalations_by_class: Record<string, number>;
    /** escalations_by_class / dispatches_by_class, per class present in both. */
    escalation_rate_by_class: Record<string, number>;
    /** Per tier: pass / (pass + fail) over verify_result_by_tier attempts. */
    verify_pass_rate_by_tier: Record<string, number>;
}

export function readTierRoutingMetrics(lines: string[]): TierRoutingMetrics {
    const entries = parseOrchEntries(lines);

    const dispatches_by_tier: Record<string, number> = {};
    const dispatches_by_class: Record<string, number> = {};
    const escalations_by_class: Record<string, number> = {};
    const verifyCounts: Record<string, { pass: number; fail: number }> = {};

    for (const e of entries) {
        if (e.tier_chosen !== null) {
            dispatches_by_tier[e.tier_chosen] = (dispatches_by_tier[e.tier_chosen] ?? 0) + 1;
        }
        if (e.task_class !== null) {
            dispatches_by_class[e.task_class] = (dispatches_by_class[e.task_class] ?? 0) + 1;
            if (e.escalated_from !== null) {
                escalations_by_class[e.task_class] = (escalations_by_class[e.task_class] ?? 0) + 1;
            }
        }
        if (e.verify_result_by_tier !== null) {
            for (const [tier, result] of Object.entries(e.verify_result_by_tier)) {
                const c = (verifyCounts[tier] ??= { pass: 0, fail: 0 });
                if (result === 'pass') c.pass += 1;
                else if (result === 'fail') c.fail += 1;
                // 'skipped' counts toward neither pass nor fail.
            }
        }
    }

    const escalation_rate_by_class: Record<string, number> = {};
    for (const [cls, n] of Object.entries(dispatches_by_class)) {
        escalation_rate_by_class[cls] = (escalations_by_class[cls] ?? 0) / n;
    }

    const verify_pass_rate_by_tier: Record<string, number> = {};
    for (const [tier, c] of Object.entries(verifyCounts)) {
        const attempts = c.pass + c.fail;
        if (attempts > 0) verify_pass_rate_by_tier[tier] = c.pass / attempts;
    }

    return {
        dispatches_by_tier,
        dispatches_by_class,
        escalations_by_class,
        escalation_rate_by_class,
        verify_pass_rate_by_tier,
    };
}

/**
 * Cost-routing tripwires (road-to-cost-aware-model-routing Phase 2) —
 * steering policy over the routing telemetry, surfaced never auto-flipped.
 */
export const ROUTING_TRIPWIRES = {
    /**
     * Per-class escalation rate above which the class's static default tier
     * should be promoted: cascading a class that escalates this often costs
     * more than starting on the higher tier.
     */
    escalation_promotion_rate: 0.4,
    /** Verify-pass rate drop (absolute) below the trailing baseline that counts as drift. */
    verify_pass_drift_tolerance: 0.1,
    /** Minimum dispatches per class before the escalation tripwire may fire (noise floor). */
    min_class_dispatches: 5,
} as const;

/**
 * Tripwire (i): classes whose escalation rate exceeds the promotion
 * threshold — their static default tier is wrong; promote it, stop cascading.
 * Classes below the dispatch noise floor never fire.
 */
export function escalationPromotionCandidates(m: TierRoutingMetrics): string[] {
    const candidates: string[] = [];
    for (const [cls, rate] of Object.entries(m.escalation_rate_by_class)) {
        const dispatches = m.dispatches_by_class[cls] ?? 0;
        if (dispatches < ROUTING_TRIPWIRES.min_class_dispatches) continue;
        if (rate > ROUTING_TRIPWIRES.escalation_promotion_rate) candidates.push(cls);
    }
    return candidates.sort();
}

/**
 * Tripwire (ii): tiers whose current verify-pass rate dropped below the
 * trailing baseline by more than the tolerance — verifier or model drift.
 * Tiers absent from either side are skipped (no baseline → no drift claim).
 */
export function verifyPassDrift(
    current: Record<string, number>,
    trailingBaseline: Record<string, number>,
): string[] {
    const drifting: string[] = [];
    for (const [tier, baseline] of Object.entries(trailingBaseline)) {
        const now = current[tier];
        if (now === undefined) continue;
        if (now < baseline - ROUTING_TRIPWIRES.verify_pass_drift_tolerance) drifting.push(tier);
    }
    return drifting.sort();
}

/**
 * Verify-fail escalation (road-to-cost-aware-model-routing Phase 4 / M3).
 *
 * A verification FAILURE on a downshifted return re-dispatches the slice one
 * tier up, consuming the existing N=3 budget — never a new budget. Confined
 * to tier_source static|inferred; inherit slices keep same-tier retry.
 * The trigger is the judge verdict / deterministic verify result — never the
 * subagent's self-reported confidence.
 */
export type EscalationTier = 'lite' | 'medium' | 'high';

export interface VerifyFailInputs {
    /** Tier of the attempt that just failed verification. */
    failed_tier: EscalationTier;
    /** Provenance of the slice's tier (telemetry `tier_source`). */
    tier_source: 'static' | 'inferred' | 'inherit';
    /** Consecutive failed attempts on this slice INCLUDING the one that just failed. */
    consecutive_failures: number;
}

export interface VerifyFailDecision {
    action: 'escalate' | 'retry-same-tier' | 'slice-failed';
    /** Tier for the next attempt; null when the slice is failed. */
    next_tier: EscalationTier | null;
    reason: string;
}

const TIER_ABOVE: Record<EscalationTier, EscalationTier | null> = {
    lite: 'medium',
    medium: 'high',
    high: null,
};

export function escalateOnVerifyFail(inp: VerifyFailInputs): VerifyFailDecision {
    // Outside the downshift path → existing same-tier retry semantics, budget unchanged.
    if (inp.tier_source === 'inherit') {
        if (budgetHalt(inp.consecutive_failures)) {
            return { action: 'slice-failed', next_tier: null, reason: 'N=3 budget exhausted on session tier' };
        }
        return {
            action: 'retry-same-tier',
            next_tier: inp.failed_tier,
            reason: 'inherit slice — no downshift decision, same-tier retry semantics unchanged',
        };
    }

    // Downshifted slice: two failed attempts mark the slice failed — the third
    // "attempt" of the N=3 budget is the orchestrator's replan at session tier.
    if (inp.consecutive_failures >= 2) {
        return {
            action: 'slice-failed',
            next_tier: null,
            reason: 'two failed attempts on a downshifted slice — mark failed, orchestrator replans at session tier',
        };
    }

    const above = TIER_ABOVE[inp.failed_tier];
    if (above === null) {
        return {
            action: 'slice-failed',
            next_tier: null,
            reason: 'verify-fail on the highest tier — no tier above, mark failed and replan',
        };
    }

    return {
        action: 'escalate',
        next_tier: above,
        reason: `verify-fail on ${inp.failed_tier} → re-dispatch one tier up (${above}); consumes the N=3 budget`,
    };
}

/**
 * Transient-failure handling, split by error class — the transient-failure
 * retry rule of the `subagent-steering` contract, as two pure steps: classify
 * the raw failure, then decide the transition and the slot's next state.
 *
 * Neither dispatches anything. The contract text is what a dispatching model
 * reads; these are its tested reference, and a caller carries `next_state`
 * forward so a sequence of failures is decided over the same counters.
 *
 * Only a slice declared read-only or idempotent is re-dispatched: a subagent's
 * first run may have acted before it failed, and discarding its late result
 * does not stop it. Any other slice escalates unretried. A slot whose N=3
 * budget is already spent is refused. Slot counters persist across every
 * attempt of the slot. A rate limit is never answered with a smaller model: the
 * limiter's scope (model, account or organisation) is not known. A park is not
 * a failed attempt; the dispatch after recovery is the same attempt at the same
 * tier. A slot parks once — a rate limit, or a `Retry-After` the run cannot be
 * shown to wait out — and the next park consumes an attempt, so repeated limits
 * reach the N=3 budget. A consumed attempt is a spawn failure, never a
 * verification failure. After a consumed attempt the next one starts at the
 * slot's original tier, with no downshift left once one was taken.
 */
export type TransientErrorClass = 'rate_limit' | 'overloaded' | 'server_error' | 'timeout';

export interface RawTransientFailure {
    http_status: number | null;
    /** Provider error type, when the response carries one. */
    error_type: string | null;
    /** The client deadline fired before the response completed. */
    client_deadline: boolean;
    /**
     * Bytes of the model's response arrived before the failure. An error status
     * line and its error body are not response bytes; an error event inside a
     * stream that had already produced output is.
     */
    response_started: boolean;
    /** The connection was never established (DNS failure, connection refused). */
    connect_failed: boolean;
}

/**
 * `null` means not transient: the failure escalates to the orchestrator
 * unretried. Once a response byte arrived the request may have been acted on,
 * so nothing is transient after that — no status, no error type, no deadline,
 * which is why that check runs first. A missing status with no bytes is
 * transient only when the connection was observed never to open — the absence
 * alone proves nothing.
 */
export function classifyTransientFailure(raw: RawTransientFailure): TransientErrorClass | null {
    const f = rawSnapshot(raw);
    if (f === null) return null;
    if (f.response_started) return null;
    if (f.http_status === 429 || f.error_type === 'rate_limit_error') return 'rate_limit';
    if (f.http_status === 529 || f.error_type === 'overloaded_error') return 'overloaded';
    if (f.http_status !== null && f.http_status >= 500 && f.http_status <= 599) return 'server_error';
    if (f.client_deadline) return 'timeout';
    if (f.http_status === null && f.connect_failed) return 'server_error';
    return null;
}

/**
 * A plain copy of `keys`, each an own DATA property of `v`, or `null`. An
 * inherited value, an accessor, an array or a proxy trap that throws is
 * refused, and the copy is what gets decided over, so nothing read afterwards
 * can change or throw. A caller may be untyped.
 */
function ownData(v: unknown, keys: readonly string[]): Record<string, unknown> | null {
    if (v === null || typeof v !== 'object') return null;
    // Inside the `try`: `Array.isArray` throws on a revoked proxy.
    try {
        if (Array.isArray(v)) return null;
        const out: Record<string, unknown> = {};
        for (const k of keys) {
            const d = Object.getOwnPropertyDescriptor(v, k);
            if (d === undefined || !('value' in d)) return null;
            out[k] = d.value;
        }
        return out;
    } catch {
        return null;
    }
}

const RAW_KEYS = ['http_status', 'error_type', 'client_deadline', 'response_started', 'connect_failed'] as const;

/** The raw failure as own data with its declared types, or `null`. */
function rawSnapshot(f: unknown): RawTransientFailure | null {
    const o = ownData(f, RAW_KEYS);
    if (o === null) return null;
    const status = o['http_status'];
    if (status !== null && !(typeof status === 'number' && Number.isInteger(status))) return null;
    const type = o['error_type'];
    if (type !== null && typeof type !== 'string') return null;
    if (!['client_deadline', 'response_started', 'connect_failed'].every((k) => typeof o[k] === 'boolean')) return null;
    return o as unknown as RawTransientFailure;
}

export interface SlotState {
    original_tier: EscalationTier;
    current_tier: EscalationTier;
    /** The cap is one per slot, across every class and attempt. */
    downshifts_used: 0 | 1;
    /** Parks taken, of any cause; one per slot. */
    parks: number;
    attempts_consumed: number;
}

export interface TransientFailureInputs {
    error_class: TransientErrorClass;
    /** A valid `Retry-After`, in milliseconds; `null` when absent or unparseable. */
    retry_after_ms: number | null;
    slot: SlotState;
    /**
     * The slice is declared read-only or idempotent, so a re-run cannot
     * duplicate an effect. Only the literal `true` counts. Its provenance is the
     * dispatcher's own record from before the dispatch — the slice spec it
     * wrote, or a definition whose tool grant holds no write tool — never the
     * subagent's output, status envelope or self-description.
     */
    retry_safe: boolean;
    /** Time left in the run, from the dispatcher's own clock; `null` when unknown. */
    run_remaining_ms: number | null;
}

const TIER_RANK: Readonly<Record<EscalationTier, number>> = { lite: 0, medium: 1, high: 2 };

/** Own keys only: `in` would admit `toString`, `constructor` and `__proto__`. */
function isEscalationTier(t: unknown): t is EscalationTier {
    return typeof t === 'string' && Object.hasOwn(TIER_RANK, t);
}

function isCount(n: unknown): boolean {
    return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/**
 * Why the caller-supplied slot or clock cannot be decided over, or `null`. The
 * counters are carried by the caller between calls, so this function never
 * assumes they are well-formed: a tier outside the ladder, a downshift that did
 * not lower the tier, or a non-integer count is refused rather than decided.
 */
const ERROR_CLASSES: ReadonlySet<unknown> = new Set<TransientErrorClass>(['rate_limit', 'overloaded', 'server_error', 'timeout']);

const INPUT_KEYS = ['error_class', 'retry_after_ms', 'slot', 'retry_safe', 'run_remaining_ms'] as const;
const SLOT_KEYS = ['original_tier', 'current_tier', 'downshifts_used', 'parks', 'attempts_consumed'] as const;

/**
 * The input as own data, validated, or the name of what is malformed. The
 * returned copy — slot included — is what the decision reads, so the caller's
 * objects are never read twice.
 */
function snapshotInput(inp: unknown): { ok: TransientFailureInputs } | { malformed: string } {
    const i = ownData(inp, INPUT_KEYS);
    if (i === null) return { malformed: 'input' };
    if (!ERROR_CLASSES.has(i['error_class'])) return { malformed: 'error_class' };
    if (i['retry_after_ms'] !== null && typeof i['retry_after_ms'] !== 'number') return { malformed: 'retry_after_ms' };
    if (typeof i['retry_safe'] !== 'boolean') return { malformed: 'retry_safe' };
    const s = ownData(i['slot'], SLOT_KEYS);
    if (s === null) return { malformed: 'slot' };
    const o = s['original_tier'];
    const c = s['current_tier'];
    if (!isEscalationTier(o)) return { malformed: 'original_tier' };
    if (!isEscalationTier(c)) return { malformed: 'current_tier' };
    const used = s['downshifts_used'];
    if (used !== 0 && used !== 1) return { malformed: 'downshifts_used' };
    const drop = TIER_RANK[o] - TIER_RANK[c];
    // After a consumed attempt the slot is back at its original tier with its
    // downshift still spent, so the tier sits at most one downshift below.
    if (drop < 0 || drop > used) return { malformed: 'current_tier against downshifts_used' };
    if (!isCount(s['parks'])) return { malformed: 'parks' };
    if (!isCount(s['attempts_consumed'])) return { malformed: 'attempts_consumed' };
    const r = i['run_remaining_ms'];
    if (r !== null && !(typeof r === 'number' && Number.isFinite(r) && r >= 0)) return { malformed: 'run_remaining_ms' };
    return { ok: { ...(i as unknown as TransientFailureInputs), slot: s as unknown as SlotState } };
}

interface TransientDecisionBase {
    redispatch_same_turn: boolean;
    /** Minimum wait before the next dispatch; binding over any other signal. */
    wait_ms: number | null;
    /** Re-run `decideWorkerReuse` before the next dispatch. */
    rerun_reuse_decision: boolean;
    /** One N=3 attempt and one `spawn_failure_rate` failure. */
    attempt_consumed: boolean;
    /** The N=3 budget is spent; the slice fails and the orchestrator replans. */
    budget_exhausted: boolean;
    /** A timed-out call may still return; its output is discarded unread. */
    discard_late_result: boolean;
    reason: string;
}

/** A decision over a well-formed input: the slot's next tier and counters. */
export interface WellFormedTransientDecision extends TransientDecisionBase {
    malformed: false;
    action: 'park' | 'downshift' | 'count-failure' | 'escalate' | 'refuse';
    /** Tier of the next dispatch of this slot. */
    next_tier: EscalationTier;
    next_state: SlotState;
}

/**
 * The input could not be decided over. It carries no tier and no state: the
 * caller's own slot is the only record, and nothing here vouches for it.
 */
export interface MalformedTransientDecision extends TransientDecisionBase {
    malformed: true;
    action: 'escalate';
    next_tier: null;
    next_state: null;
}

export type TransientFailureDecision = WellFormedTransientDecision | MalformedTransientDecision;

const TIER_BELOW: Readonly<Record<EscalationTier, EscalationTier | null>> = {
    lite: null,
    medium: 'lite',
    high: 'medium',
};

export function transientFailureAction(input: TransientFailureInputs): TransientFailureDecision {
    // Snapshotted and validated before anything reads a field: the escalation
    // below must not throw on the input it exists to refuse.
    const snap = snapshotInput(input);
    if ('malformed' in snap) {
        const malformed = snap.malformed;
        return {
            malformed: true,
            action: 'escalate',
            redispatch_same_turn: false,
            wait_ms: null,
            next_tier: null,
            rerun_reuse_decision: false,
            attempt_consumed: false,
            budget_exhausted: false,
            discard_late_result: false,
            next_state: null,
            reason: `malformed ${malformed} — escalate unretried, no counter moved`,
        };
    }
    const inp = snap.ok;
    const s = inp.slot;
    const wait_ms = inp.retry_after_ms !== null && Number.isFinite(inp.retry_after_ms) && inp.retry_after_ms >= 0
        ? inp.retry_after_ms
        : null;
    const discard_late_result = inp.error_class === 'timeout';
    const halt = (action: 'escalate' | 'refuse', reason: string): WellFormedTransientDecision => ({
        malformed: false,
        action,
        redispatch_same_turn: false,
        wait_ms,
        next_tier: s.current_tier,
        rerun_reuse_decision: false,
        attempt_consumed: false,
        budget_exhausted: budgetHalt(s.attempts_consumed),
        discard_late_result,
        next_state: s,
        reason,
    });
    const consume = (reason: string): WellFormedTransientDecision => {
        const attempts_consumed = s.attempts_consumed + 1;
        return {
            malformed: false,
            action: 'count-failure',
            redispatch_same_turn: false,
            wait_ms,
            next_tier: s.original_tier,
            rerun_reuse_decision: true,
            attempt_consumed: true,
            budget_exhausted: budgetHalt(attempts_consumed),
            discard_late_result,
            next_state: { ...s, current_tier: s.original_tier, attempts_consumed },
            reason,
        };
    };
    const park = (reason: string): WellFormedTransientDecision => {
        if (s.parks >= 1) return consume(`${inp.error_class} on a slot that already parked — one attempt consumed, no second park`);
        return {
            malformed: false,
            action: 'park',
            redispatch_same_turn: false,
            wait_ms,
            next_tier: s.current_tier,
            rerun_reuse_decision: true,
            attempt_consumed: false,
            budget_exhausted: false,
            discard_late_result,
            next_state: { ...s, parks: s.parks + 1 },
            reason,
        };
    };

    if (budgetHalt(s.attempts_consumed)) return halt('refuse', 'the N=3 budget of this slot is already spent — no further dispatch');
    if (inp.retry_safe !== true) return halt('escalate', `${inp.error_class} on a slice not declared read-only or idempotent — escalate unretried`);
    if (inp.error_class === 'rate_limit') {
        return park('rate_limit — park until a recovery signal, then re-run the reuse decision at the same tier');
    }
    if (wait_ms !== null && (inp.run_remaining_ms === null || wait_ms > inp.run_remaining_ms)) {
        return park(`${inp.error_class} with a Retry-After the run cannot be shown to wait out — park, no same-turn re-dispatch`);
    }
    const below = TIER_BELOW[s.current_tier];
    if (s.downshifts_used >= 1 || below === null) return consume(`${inp.error_class} with no downshift left — one attempt consumed`);
    return {
        malformed: false,
        action: 'downshift',
        redispatch_same_turn: true,
        wait_ms,
        next_tier: below,
        rerun_reuse_decision: false,
        attempt_consumed: false,
        budget_exhausted: false,
        discard_late_result,
        next_state: { ...s, current_tier: below, downshifts_used: 1 },
        reason: `${inp.error_class} — retry once at ${below}`,
    };
}
