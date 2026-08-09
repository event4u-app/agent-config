/**
 * Per-worker token stop-loss (L0b — road-to-lean-agent-init Phase 2).
 *
 * Pure, no-I/O. A dispatched worker carries a hard `max_tokens_per_worker`
 * budget keyed by its resolved tier; on hit it returns a STRUCTURED PARTIAL
 * RESULT + escalation flag to the orchestrator instead of continuing to
 * explore. Live evidence (2026-07-28): four lookup-class workers burned
 * 280–327k tokens each — a worker overrunning its budget 20× is a dispatch
 * error on the wrong rung, not diligence.
 *
 * Composes with — replaces nothing:
 * - the N=3 validation-loop budget (`autonomous-execution`),
 * - the ADR-109 / `subagent-response-contract` body + 4-status envelope
 *   (`subagent-steering`): the partial result rides as the body of a
 *   `BLOCKED` envelope with `budget_hit: true` as the escalation flag.
 */

import type { Tier } from './subagent_routing.js';

/**
 * Start values — refined from Phase-3 telemetry (`budget_hit` rate in the
 * audit stream), never final. `lite` is the roadmap-pinned lookup-class
 * start value (~15k); `medium`/`high` are conservative seeds an order of
 * magnitude below the observed 280–327k runaway runs.
 */
export const MAX_TOKENS_PER_WORKER: Readonly<Record<Exclude<Tier, 'inherit'>, number>> = {
    lite: 15_000,
    medium: 60_000,
    high: 150_000,
};

/** Resolve the budget for a worker's tier; `inherit` uses the session tier's budget. */
export function budgetForTier(tier: Tier, sessionTier: Exclude<Tier, 'inherit'> = 'high'): number {
    const effective = tier === 'inherit' ? sessionTier : tier;
    return MAX_TOKENS_PER_WORKER[effective];
}

/**
 * Fraction of the stop-loss budget at which a worker emits its CHECKPOINT
 * capsule (road-to-worker-generation-recycling, Phase 1).
 *
 * The headroom IS the mechanism: a worker at 100 % of its budget cannot
 * summarise itself, so the watermark sits below the kill line rather than on
 * it. A start value, not a tuned one — Phase 1 measures it in shadow against a
 * second trigger arm before anything acts on it, and `blocker:
 * capsule-quality-near-budget` exists because a bad watermark and a bad
 * mechanism look identical from one sample.
 */
export const CAPSULE_WATERMARK_FRACTION = 0.8;

/** Token count at which a worker of this tier emits its capsule. */
export function watermarkForTier(tier: Tier, sessionTier: Exclude<Tier, 'inherit'> = 'high'): number {
    return Math.floor(budgetForTier(tier, sessionTier) * CAPSULE_WATERMARK_FRACTION);
}

/** Where the orchestrator should send the task after a budget hit. */
export type NextRung = 'primitive' | 'higher-tier-subagent' | 'in-session';

/**
 * The structured partial result a budget-hit worker returns. Body of a
 * `BLOCKED` envelope; `budget_hit: true` IS the escalation flag. Refs, not
 * bodies — same privacy floor as the spawn/response contracts.
 */
export interface WorkerPartialResult {
    budget_hit: true;
    /** What was found so far — ref tokens (`file:line`, ids, paths), never bodies. */
    found: string[];
    /** What remains unexplored, one plain sentence. */
    remaining: string;
    /** Suggested next rung for the remainder. */
    suggested_next_rung: NextRung;
}

const NEXT_RUNGS: ReadonlySet<string> = new Set<NextRung>(['primitive', 'higher-tier-subagent', 'in-session']);

/** Ref-like guard — mirrors the spawn contract's refs-not-bodies invariant. */
function isRefLike(s: unknown): s is string {
    return typeof s === 'string' && s.length > 0 && s.length <= 200 && !s.includes('\n');
}

export interface BudgetEvaluation {
    budget_hit: boolean;
    consumed: number;
    budget: number;
    /** Token count at which the CHECKPOINT capsule is due (below the kill line). */
    watermark: number;
    /** Consumption reached the watermark but not yet the stop-loss. */
    watermark_hit: boolean;
    reason: string;
}

/**
 * Evaluate consumption against the worker's budget.
 *
 * Two lines, not one: the **watermark** (emit a capsule, still working) and the
 * **stop-loss** (return a partial result, stop). A budget hit implies the
 * watermark was passed, so `watermark_hit` marks the band BETWEEN them — the
 * only window in which a capsule can still be written.
 */
export function evaluateWorkerBudget(consumed: number, budget: number): BudgetEvaluation {
    const hit = consumed >= budget;
    const watermark = Math.floor(budget * CAPSULE_WATERMARK_FRACTION);
    const watermarkHit = !hit && consumed >= watermark;
    return {
        budget_hit: hit,
        consumed,
        budget,
        watermark,
        watermark_hit: watermarkHit,
        reason: hit
            ? `budget hit (${consumed} >= ${budget}) — return partial result + escalation flag, stop exploring`
            : watermarkHit
              ? `watermark reached (${consumed} >= ${watermark}) — emit a CHECKPOINT capsule while there is headroom to write one`
              : `within budget (${consumed} < ${budget})`,
    };
}

/**
 * Validate a partial-result body. Returns the list of violations (empty =
 * valid). The orchestrator never adopts an invalid partial return — it
 * re-dispatches or resolves in-session per the synthesis duties.
 */
export function validateWorkerPartialResult(input: unknown): string[] {
    const errors: string[] = [];
    if (typeof input !== 'object' || input === null) return ['not an object'];
    const r = input as Record<string, unknown>;

    if (r['budget_hit'] !== true) errors.push('budget_hit must be literally true (the escalation flag)');
    if (!Array.isArray(r['found'])) {
        errors.push('found must be an array of ref tokens');
    } else {
        const bodyLike = (r['found'] as unknown[]).filter((x) => !isRefLike(x));
        if (bodyLike.length > 0) errors.push(`found carries ${bodyLike.length} non-ref entr${bodyLike.length === 1 ? 'y' : 'ies'} (refs only, no bodies)`);
    }
    if (typeof r['remaining'] !== 'string' || (r['remaining'] as string).length === 0) {
        errors.push('remaining must be a non-empty sentence');
    }
    if (typeof r['suggested_next_rung'] !== 'string' || !NEXT_RUNGS.has(r['suggested_next_rung'] as string)) {
        errors.push(`suggested_next_rung must be one of ${[...NEXT_RUNGS].join(' | ')}`);
    }
    return errors;
}
