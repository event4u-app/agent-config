/**
 * spend_gate — the ceilings, the breach decision, and the event a breach raises.
 *
 * Extracted from `orchestrator.ts` unchanged, and the ordering is the point
 * (`gate-violation-baselines.json` § check_source_size_budget: "extract, then
 * measure"): the orchestrator sits far over the 1,500-line source ceiling, so
 * a change that grows it has to hand a cohesive unit out rather than pin a
 * higher number — the gate's own text calls raising the baseline a defect.
 *
 * The unit is cohesive on its own terms, not merely convenient: `CostBudget`
 * states the ceilings, `_breach` decides whether one is crossed, `OverrunEvent`
 * is what a crossing hands to the operator, and `_total_usd` is the arithmetic
 * all three share. Nothing here calls a provider or knows what a round is.
 *
 * Re-exported from `orchestrator.ts`, so no caller changes.
 */

import type { CostEstimate } from './pricing.js';
import type { ExternalAIClient } from './clients.js';
import { would_exceed as _would_exceed_daily } from './budget_guard.js';

export class CostBudget {
    max_input_tokens: number;
    max_output_tokens: number;
    max_calls: number;
    max_total_usd: number; // 0 = USD ceiling disabled (token caps still apply)
    daily_limit_usd: number; // 0 = rolling 24h cap disabled (D3)

    constructor(
        args: {
            max_input_tokens?: number;
            max_output_tokens?: number;
            max_calls?: number;
            max_total_usd?: number;
            daily_limit_usd?: number;
        } = {},
    ) {
        this.max_input_tokens = args.max_input_tokens ?? 50_000;
        this.max_output_tokens = args.max_output_tokens ?? 20_000;
        this.max_calls = args.max_calls ?? 10;
        this.max_total_usd = args.max_total_usd ?? 0.0;
        this.daily_limit_usd = args.daily_limit_usd ?? 0.0;
    }
}


/** Passed to `on_overrun` when projected spend exceeds the budget. */
export class OverrunEvent {
    member_index: number;
    member: ExternalAIClient;
    next_estimate: CostEstimate; // this member's projected cost
    spent_input_tokens: number; // already-billed totals BEFORE this member
    spent_output_tokens: number;
    spent_usd: number;
    projected_total_usd: number; // spent_usd + next_estimate.total_usd
    daily_spent_usd: number; // rolling 24h spend BEFORE this member (D3)
    daily_limit_usd: number; // the configured daily cap (0 = disabled)
    breach_kind: string; // "session" | "daily" | "tokens"

    constructor(args: {
        member_index: number;
        member: ExternalAIClient;
        next_estimate: CostEstimate;
        spent_input_tokens: number;
        spent_output_tokens: number;
        spent_usd: number;
        projected_total_usd: number;
        daily_spent_usd?: number;
        daily_limit_usd?: number;
        breach_kind?: string;
    }) {
        this.member_index = args.member_index;
        this.member = args.member;
        this.next_estimate = args.next_estimate;
        this.spent_input_tokens = args.spent_input_tokens;
        this.spent_output_tokens = args.spent_output_tokens;
        this.spent_usd = args.spent_usd;
        this.projected_total_usd = args.projected_total_usd;
        this.daily_spent_usd = args.daily_spent_usd ?? 0.0;
        this.daily_limit_usd = args.daily_limit_usd ?? 0.0;
        this.breach_kind = args.breach_kind ?? 'session';
    }
}


/** Mirror the Python `CostEstimate.total_usd` property. */
export function _total_usd(e: CostEstimate): number {
    return e.input_usd + e.output_usd;
}

export type BreachKind = 'tokens' | 'daily' | 'session' | null;

/**
 * The projected-spend verdict. One implementation because the round head and
 * the fallback's metered retry must gate on the SAME rules — two copies of
 * four comparisons is how they drift.
 */
export function _breach(
    est: CostEstimate | null,
    spent: Spent,
    budget: CostBudget,
): BreachKind {
    const usd = est ? _total_usd(est) : 0.0;
    if (
        spent.input + (est ? est.input_tokens : 0) > budget.max_input_tokens ||
        spent.output + (est ? est.output_tokens : 0) > budget.max_output_tokens
    ) {
        return 'tokens';
    }
    if (budget.daily_limit_usd > 0 && _would_exceed_daily(budget.daily_limit_usd, usd)) {
        return 'daily';
    }
    if (budget.max_total_usd > 0 && spent.usd + usd > budget.max_total_usd) return 'session';
    return null;
}


export interface Spent {
    input: number;
    output: number;
    usd: number;
}

