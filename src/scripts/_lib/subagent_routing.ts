/**
 * Subagent routing (Phase 2) — cost/speed downshift + optional quota arbitrage.
 *
 * Pure, no-I/O, VENDOR-NEUTRAL. Resolves which model a delegated sub-task runs
 * on, from the sub-task's declared capability tier, the `subagents.*` settings,
 * and the host-capability manifest. Contract:
 * `src/agent-src/contexts/execution/subagent-routing.md`.
 *
 * Invariants:
 * - The orchestrator stays on the session/high tier (this resolves SUB-tasks).
 * - Downshift off → every sub-task runs on the session tier.
 * - Downshift on → a sub-task runs on the lowest-capable tier it declares.
 * - Quota arbitrage is an OPTIONAL bonus: it only prefers the separate pool
 *   when BOTH the setting and the host manifest allow it. Where unsupported,
 *   routing is identical minus the quota win — never a hard-coded vendor model.
 */

export type Tier = 'lite' | 'medium' | 'high' | 'inherit';
export type QuotaPool = 'separate' | 'shared';

/** Per-tier model alias overrides (empty string = use the tier's runtime default). */
export interface ModelMap {
    lite?: string;
    medium?: string;
    high?: string;
}

export interface RoutingInputs {
    /** The sub-task's declared capability tier. */
    task_tier: Tier;
    /** The orchestrator's session tier (used when downshift is off / tier is inherit). */
    session_tier: Tier;
    downshift: boolean;
    quota_arbitrage: boolean;
    model_map: ModelMap;
    /** From the host-capability manifest. */
    separate_quota_pool: boolean;
}

export interface RoutingDecision {
    /** Resolved tier the sub-task runs on. */
    tier: Tier;
    /** Model alias, or '' meaning "use the tier's runtime default" (no vendor name baked in). */
    model: string;
    /** Whether a separate quota pool is used (bonus) or the shared one. */
    quota_pool: QuotaPool;
    reason: string;
}

/** Resolve a model alias for a tier from the map; '' = tier default sentinel. */
function modelForTier(tier: Tier, map: ModelMap): string {
    if (tier === 'lite') return map.lite ?? '';
    if (tier === 'medium') return map.medium ?? '';
    if (tier === 'high') return map.high ?? '';
    return ''; // inherit → session default
}

/**
 * Resolve routing for one delegated sub-task. Vendor-neutral: returns a tier +
 * an optional model alias (never a hard-coded provider model) + the quota pool.
 */
export function resolveSubagentRouting(inp: RoutingInputs): RoutingDecision {
    // Downshift off, or an `inherit` task → run on the session tier.
    const tier: Tier = !inp.downshift || inp.task_tier === 'inherit' ? inp.session_tier : inp.task_tier;
    const downshifted = inp.downshift && inp.task_tier !== 'inherit' && tier !== inp.session_tier;

    // Quota arbitrage: a bonus, only when BOTH the setting and the host allow it.
    const useSeparate = inp.quota_arbitrage && inp.separate_quota_pool;
    const quota_pool: QuotaPool = useSeparate ? 'separate' : 'shared';

    const reasonParts: string[] = [];
    reasonParts.push(downshifted ? `downshift to ${tier}` : `session tier ${tier}`);
    reasonParts.push(useSeparate ? 'separate quota pool (bonus)' : 'shared quota pool');

    return {
        tier,
        model: modelForTier(tier, inp.model_map),
        quota_pool,
        reason: reasonParts.join(' · '),
    };
}
