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
