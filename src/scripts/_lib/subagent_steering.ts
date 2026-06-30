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

/** Raw orchestration entry parsed from an audit-log-v1 JSONL line. */
export interface OrchEntry {
    task_size_estimate: number;
    spawn_count: number;
    token_delta: number;
    outcome: string;
    verify_mode: string;
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
export function readOrchestrationMetrics(
    lines: string[],
): GuardrailMetrics {
    const entries: OrchEntry[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            if (parsed['input_kind'] !== 'orchestration') continue;
            const orch = parsed['orchestration'] as Record<string, unknown> | undefined;
            if (!orch) continue;
            entries.push({
                task_size_estimate: Number(orch['task_size_estimate'] ?? 0),
                spawn_count: Number(orch['spawn_count'] ?? 0),
                token_delta: Number(orch['token_delta'] ?? 0),
                outcome: String(orch['outcome'] ?? ''),
                verify_mode: String(orch['verify_mode'] ?? ''),
            });
        } catch {
            // skip malformed lines
        }
    }

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
