/**
 * Arm ranking metrics (`road-to-runtime-context-floors` step 4.2).
 *
 * `tokens` stays the default and `cost-per-solved` becomes AVAILABLE — not a
 * replacement. The reason it has to exist at all is the same one behind the
 * mandatory cache fields: an arm can reduce token volume and cost more, because
 * rewriting a prefix pays the cache-write rate rather than the cache-read rate.
 * A comparison that can only rank on tokens cannot see that.
 *
 * The reason it must NOT become the default is the sibling risk: a single
 * mandatory score invites tuning the score. Keeping both available, and keeping
 * the cache ratio diagnostic rather than scored, is what stops this from being
 * the Goodhart shape that `road-to-cache-economy`'s falsified C-5 already
 * demonstrated for token count.
 */

export const RANKING_METRICS = ['tokens', 'cost-per-solved'] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];
export const DEFAULT_RANKING_METRIC: RankingMetric = 'tokens';

export interface ArmResult {
    arm: string;
    /** Total tokens consumed by the arm across the run. */
    tokens: number;
    /** Total cost in USD. */
    cost_usd: number;
    /** Tasks the arm actually solved — the denominator of cost-per-solved. */
    solved: number;
}

export interface RankedArm extends ArmResult {
    /** The value ranked on. `null` when the metric is undefined for this arm. */
    score: number | null;
    /** Present only when `score` is null. */
    reason?: string;
}

export function isRankingMetric(v: unknown): v is RankingMetric {
    return typeof v === 'string' && (RANKING_METRICS as readonly string[]).includes(v);
}

function score(arm: ArmResult, metric: RankingMetric): { score: number | null; reason?: string } {
    if (metric === 'tokens') return { score: arm.tokens };
    if (arm.solved === 0) {
        // Not Infinity and not 0: an arm that solved nothing has no
        // cost-per-solved, and ranking it as "infinitely expensive" would be a
        // number nobody measured.
        return { score: null, reason: 'the arm solved nothing, so cost-per-solved is undefined' };
    }
    return { score: arm.cost_usd / arm.solved };
}

/**
 * Rank ascending — lower is better under both metrics. Arms with an undefined
 * score sort last, in input order, and carry their reason.
 */
export function rankArms(arms: readonly ArmResult[], metric: RankingMetric = DEFAULT_RANKING_METRIC): RankedArm[] {
    const scored: RankedArm[] = arms.map((a) => ({ ...a, ...score(a, metric) }));
    const defined = scored.filter((a) => a.score !== null).sort((a, b) => (a.score as number) - (b.score as number) || a.arm.localeCompare(b.arm));
    const undef = scored.filter((a) => a.score === null);
    return [...defined, ...undef];
}
