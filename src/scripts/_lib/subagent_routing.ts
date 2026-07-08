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

/**
 * Where a resolved tier came from (road-to-cost-aware-model-routing Phase 0):
 * - 'static'   — declared by frontmatter / category pin,
 * - 'inferred' — produced by the deterministic per-slice tier inference,
 * - 'inherit'  — session tier; no downshift decision was made.
 * Mirrors the `tier_source` telemetry field in
 * `src/agent-src/contexts/execution/orchestration-telemetry.md`.
 */
export type TierSource = 'static' | 'inferred' | 'inherit';

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
    /**
     * How `task_tier` was produced: 'static' (frontmatter/category pin) or
     * 'inferred' (deterministic per-slice inference). Optional — absent
     * defaults to 'static'. Ignored when the slice runs on the session tier.
     */
    task_tier_origin?: Exclude<TierSource, 'inherit'>;
}

export interface RoutingDecision {
    /** Resolved tier the sub-task runs on. */
    tier: Tier;
    /** Model alias, or '' meaning "use the tier's runtime default" (no vendor name baked in). */
    model: string;
    /** Whether a separate quota pool is used (bonus) or the shared one. */
    quota_pool: QuotaPool;
    /** Telemetry value for `tier_source`: 'inherit' when no downshift decision applied. */
    tier_source: TierSource;
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

    // Telemetry provenance: only a real downshift decision carries its origin;
    // session-tier runs (inherit task, downshift off, or tier == session) are 'inherit'.
    const applied = inp.downshift && inp.task_tier !== 'inherit';
    const tier_source: TierSource = applied ? (inp.task_tier_origin ?? 'static') : 'inherit';

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
        tier_source,
        reason: reasonParts.join(' · '),
    };
}
