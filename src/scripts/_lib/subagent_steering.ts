/**
 * Subagent steering & guardrails (Phase 5).
 *
 * Pure, no-I/O. The guardrails that keep auto-dispatch from becoming a token
 * sink: the N=3 per-target budget, the kill-switch, and the rollback
 * guardrail-threshold checks. Contract:
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

export interface LayerState {
    enabled: boolean;
    auto: 'off' | 'ask' | 'on';
}

/** The kill-switch: layer is disabled when the master switch is off or auto is off. */
export function isLayerDisabled(state: LayerState): boolean {
    return !state.enabled || state.auto === 'off';
}

/** N=3 per-target budget: halt once consecutive failed attempts reach the cap. */
export function budgetHalt(consecutiveFailures: number): boolean {
    return consecutiveFailures >= MAX_ATTEMPTS_PER_TARGET;
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
