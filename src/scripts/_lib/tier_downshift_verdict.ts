/**
 * Verdict for the two pre-registered tier-downshift claims
 * (`tier-downshift-quality-held`, `tier-downshift-limit-relief` in
 * `docs/CLAIMS.md`) over a paired run: every slice once on `lite`, once on the
 * inherited tier, both verified by the same deterministic check.
 *
 * Pure: the bars are constants here, the rows come from the caller, and an
 * underpowered run backs nothing in either direction. A price row that
 * `price_freshness` refuses prices nothing, which leaves the cost verdict
 * underpowered rather than read at a stale rate.
 */
import { type PriceRow, selectPrice } from './price_freshness.js';

/** Quality bar: the lite arm's fail-or-escalate rate may exceed inherit's by at most this. */
export const QUALITY_MARGIN_PP = 5;
/** The escalation kill of `ask_economy` in `src/config/dispatch-economy-metrics.json`. */
export const ESCALATION_KILL = 0.3;
/** Pair cap of the paired run (decision A2). */
export const PAIR_CAP = 60;
/** Below this many complete pairs no rate is read at all. */
export const MIN_PAIRS = 30;
/**
 * One-sided error of every bound read here. 0.05 is the level the
 * pre-registered verdict already used: the rule of three it replaces is the
 * one-sided 95 % bound for zero events.
 */
export const BOUND_ALPHA = 0.05;

export type Arm = 'lite' | 'inherit';

/** Token usage of one leg, as the host reports it. */
export interface LegUsage {
    input: number;
    cache_read: number;
    cache_write: number;
    output: number;
}

export interface LegResult {
    slice_id: string;
    arm: Arm;
    /** The deterministic check passed. */
    verified: boolean;
    /** The leg could not finish and the head re-ran it one tier up. */
    escalated: boolean;
    served_model: string;
    usage: LegUsage;
    /** Usage of the head's re-run one tier up, charged to this leg's arm. */
    rerun?: { served_model: string; usage: LegUsage; verified: boolean };
    /** Other model usage the leg caused (an advisor it consulted), charged to this leg's arm. */
    extra?: { served_model: string; usage: LegUsage }[];
}

export interface ArmSummary {
    slices: number;
    failed_or_escalated: number;
    escalated: number;
    verified: number;
    cost_usd: number;
    cost_per_verified_usd: number | null;
}

export type QualityVerdict = 'held' | 'breached' | 'underpowered';
export type CostVerdict = 'relief' | 'no-relief' | 'underpowered';

export interface TierDownshiftVerdict {
    pairs: number;
    lite: ArmSummary;
    inherit: ArmSummary;
    /** lite minus inherit fail-or-escalate rate, in percentage points. */
    diff_pp: number | null;
    /**
     * One-sided upper bound of the paired difference, in percentage points: the
     * exact (Clopper–Pearson) bound on the rate of pairs only lite failed. The
     * pairs only inherit failed can only lower the true difference, so leaving
     * them out keeps the bound conservative and monotone in lite's failures.
     */
    upper_bound_pp: number | null;
    /** One-sided lower bound of the paired difference, in percentage points. */
    lower_bound_pp: number | null;
    escalation_rate_lite: number | null;
    quality: QualityVerdict;
    cost: CostVerdict;
    /** Both claims backed: the kind may take lite as its default dispatch. */
    flip: boolean;
    notes: string[];
}

/** P(X <= k) for X ~ Binomial(n, p), summed in log space so large n stays finite. */
function binomCdf(k: number, n: number, p: number): number {
    if (k < 0) return 0;
    if (k >= n) return 1;
    if (p <= 0) return 1;
    if (p >= 1) return 0;
    let logC = 0;
    let sum = 0;
    for (let i = 0; i <= k; i++) {
        if (i > 0) logC += Math.log(n - i + 1) - Math.log(i);
        sum += Math.exp(logC + i * Math.log(p) + (n - i) * Math.log1p(-p));
    }
    return Math.min(sum, 1);
}

/** Bisection on a monotone function of p; 200 halvings is below double precision. */
function solve(f: (p: number) => number, target: number, decreasing: boolean): number {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        const above = f(mid) > target;
        if (above === decreasing) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/** Exact one-sided upper bound on a binomial rate after `k` events in `n` trials. */
export function clopperPearsonUpper(k: number, n: number, alpha = BOUND_ALPHA): number {
    if (k >= n) return 1;
    return solve((p) => binomCdf(k, n, p), alpha, true);
}

/** Exact one-sided lower bound on a binomial rate after `k` events in `n` trials. */
export function clopperPearsonLower(k: number, n: number, alpha = BOUND_ALPHA): number {
    if (k <= 0) return 0;
    return solve((p) => 1 - binomCdf(k - 1, n, p), alpha, false);
}

interface PriceContext {
    rows: readonly PriceRow[];
    asOf: Date;
}

function legCost(model: string, usage: LegUsage, prices: PriceContext, notes: string[]): number {
    const pick = selectPrice(prices.rows, model, prices.asOf);
    if ('refusal' in pick) {
        const note = `${pick.refusal}; its leg is not priced and the cost verdict is underpowered`;
        if (!notes.includes(note)) notes.push(note);
        return Number.NaN;
    }
    const p = pick.price;
    return (
        (usage.input * p.input + usage.cache_read * p.cache_read + usage.cache_write * p.cache_write + usage.output * p.output) /
        1_000_000
    );
}

function summarise(legs: LegResult[], prices: PriceContext, notes: string[]): ArmSummary {
    let cost = 0;
    let verified = 0;
    let failedOrEscalated = 0;
    let escalated = 0;
    for (const leg of legs) {
        cost += legCost(leg.served_model, leg.usage, prices, notes);
        for (const x of leg.extra ?? []) cost += legCost(x.served_model, x.usage, prices, notes);
        if (leg.escalated) escalated++;
        if (!leg.verified || leg.escalated) failedOrEscalated++;
        if (leg.rerun) {
            cost += legCost(leg.rerun.served_model, leg.rerun.usage, prices, notes);
            if (leg.rerun.verified) verified++;
        } else if (leg.verified) {
            verified++;
        }
    }
    return {
        slices: legs.length,
        failed_or_escalated: failedOrEscalated,
        escalated,
        verified,
        cost_usd: cost,
        cost_per_verified_usd: verified > 0 && Number.isFinite(cost) ? cost / verified : null,
    };
}

/**
 * Read the paired run. A slice counts only when both arms ran it once; extra
 * or one-sided rows are noted and left out rather than guessed at.
 */
export function tierDownshiftVerdict(rows: readonly LegResult[], priceRows: readonly PriceRow[], asOf: Date): TierDownshiftVerdict {
    const notes: string[] = [];
    const prices: PriceContext = { rows: priceRows, asOf };
    const bySlice = new Map<string, Partial<Record<Arm, LegResult>>>();
    for (const r of rows) {
        const entry = bySlice.get(r.slice_id) ?? {};
        if (entry[r.arm]) {
            notes.push(`slice ${r.slice_id} ran twice on ${r.arm}; the second row is ignored`);
            continue;
        }
        entry[r.arm] = r;
        bySlice.set(r.slice_id, entry);
    }
    const pairs: [LegResult, LegResult][] = [];
    for (const [id, e] of bySlice) {
        if (e.lite && e.inherit) pairs.push([e.lite, e.inherit]);
        else notes.push(`slice ${id} has one arm only and is left out`);
    }
    if (pairs.length > PAIR_CAP) notes.push(`${pairs.length} pairs exceed the cap of ${PAIR_CAP}; all are read`);

    const lite = summarise(pairs.map((p) => p[0]), prices, notes);
    const inherit = summarise(pairs.map((p) => p[1]), prices, notes);
    const n = pairs.length;

    let diffPp: number | null = null;
    let upperPp: number | null = null;
    let lowerPp: number | null = null;
    let escalationRate: number | null = null;
    if (n > 0) {
        // Paired difference of the fail-or-escalate indicator: only discordant pairs move it.
        let b = 0;
        let c = 0;
        for (const [l, i] of pairs) {
            const lf = !l.verified || l.escalated;
            const inf = !i.verified || i.escalated;
            if (lf && !inf) b++;
            if (!lf && inf) c++;
        }
        diffPp = ((b - c) / n) * 100;
        upperPp = clopperPearsonUpper(b, n) * 100;
        lowerPp = (clopperPearsonLower(b, n) - clopperPearsonUpper(c, n)) * 100;
        escalationRate = lite.escalated / n;
    }

    let quality: QualityVerdict;
    if (n < MIN_PAIRS || diffPp === null || upperPp === null || lowerPp === null || escalationRate === null) {
        quality = 'underpowered';
        notes.push(`${n} complete pairs, below the floor of ${MIN_PAIRS}`);
    } else if (escalationRate >= ESCALATION_KILL || lowerPp > QUALITY_MARGIN_PP) {
        quality = 'breached';
    } else if (upperPp < QUALITY_MARGIN_PP) {
        quality = 'held';
    } else {
        quality = 'underpowered';
        notes.push(`the upper bound ${upperPp.toFixed(2)} pp is not below the ${QUALITY_MARGIN_PP} pp margin`);
    }

    let cost: CostVerdict;
    if (quality === 'underpowered' || lite.cost_per_verified_usd === null || inherit.cost_per_verified_usd === null) {
        cost = 'underpowered';
    } else {
        cost = lite.cost_per_verified_usd < inherit.cost_per_verified_usd ? 'relief' : 'no-relief';
    }

    return {
        pairs: n,
        lite,
        inherit,
        diff_pp: diffPp,
        upper_bound_pp: upperPp,
        lower_bound_pp: lowerPp,
        escalation_rate_lite: escalationRate,
        quality,
        cost,
        flip: quality === 'held' && cost === 'relief',
        notes,
    };
}

/**
 * A kind already on lite reverts the moment a later window breaches the kill;
 * a kind not on lite moves only on a verdict that backs both claims.
 */
export function kindTierAfter(current: 'lite' | 'inherit', verdict: TierDownshiftVerdict): 'lite' | 'inherit' {
    if (current === 'lite') {
        const breached = verdict.quality === 'breached' || (verdict.escalation_rate_lite ?? 0) >= ESCALATION_KILL;
        return breached ? 'inherit' : 'lite';
    }
    return verdict.flip ? 'lite' : 'inherit';
}
