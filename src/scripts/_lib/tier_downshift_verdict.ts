/**
 * Verdict for the two pre-registered tier-downshift claims
 * (`tier-downshift-quality-held`, `tier-downshift-limit-relief` in
 * `docs/CLAIMS.md`) over a paired run: every slice once on `lite`, once on the
 * inherited tier, both verified by the same deterministic check.
 *
 * Pure: the bars are constants here, the rows come from the caller, and an
 * underpowered run backs nothing in either direction.
 */

/** Quality bar: the lite arm's fail-or-escalate rate may exceed inherit's by at most this. */
export const QUALITY_MARGIN_PP = 5;
/** The escalation kill of `ask_economy` in `src/config/dispatch-economy-metrics.json`. */
export const ESCALATION_KILL = 0.3;
/** Pair cap of the paired run (decision A2). */
export const PAIR_CAP = 60;
/** Below this many complete pairs no rate is read at all. */
export const MIN_PAIRS = 30;

export type Arm = 'lite' | 'inherit';

/** Token usage of one leg, as the host reports it. */
export interface LegUsage {
    input: number;
    cache_read: number;
    cache_write: number;
    output: number;
}

/** USD per million tokens for one model family. */
export interface Price {
    input: number;
    output: number;
    cache_write: number;
    cache_read: number;
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
    /** Half-width of the 95 % interval of the paired difference, in percentage points. */
    ci_half_width_pp: number | null;
    escalation_rate_lite: number | null;
    quality: QualityVerdict;
    cost: CostVerdict;
    /** Both claims backed: the kind may take lite as its default dispatch. */
    flip: boolean;
    notes: string[];
}

const FAMILIES = ['haiku', 'sonnet', 'opus', 'fable'] as const;

function priceFor(model: string, prices: Record<string, Price>): Price | null {
    const m = model.toLowerCase();
    const family = FAMILIES.find((f) => m.includes(f));
    return family ? (prices[family] ?? null) : null;
}

function legCost(model: string, usage: LegUsage, prices: Record<string, Price>, notes: string[]): number {
    const p = priceFor(model, prices);
    if (p === null) {
        notes.push(`no price for served model ${model}; its leg is priced at 0 and the cost verdict is underpowered`);
        return Number.NaN;
    }
    return (
        (usage.input * p.input + usage.cache_read * p.cache_read + usage.cache_write * p.cache_write + usage.output * p.output) /
        1_000_000
    );
}

function summarise(legs: LegResult[], prices: Record<string, Price>, notes: string[]): ArmSummary {
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
export function tierDownshiftVerdict(rows: readonly LegResult[], prices: Record<string, Price>): TierDownshiftVerdict {
    const notes: string[] = [];
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
    let halfWidthPp: number | null = null;
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
        const diff = (b - c) / n;
        const variance = (b + c - (b - c) ** 2 / n) / (n * n);
        diffPp = diff * 100;
        halfWidthPp = 1.96 * Math.sqrt(Math.max(variance, 0)) * 100;
        // No discordant pair gives a zero-width interval; the rule of three bounds
        // an unseen disagreement rate at 3/n instead.
        if (b + c === 0) halfWidthPp = (3 / n) * 100;
        escalationRate = lite.escalated / n;
    }

    let quality: QualityVerdict;
    if (n < MIN_PAIRS || diffPp === null || halfWidthPp === null || escalationRate === null) {
        quality = 'underpowered';
        notes.push(`${n} complete pairs, below the floor of ${MIN_PAIRS}`);
    } else if (escalationRate >= ESCALATION_KILL || diffPp - halfWidthPp > QUALITY_MARGIN_PP) {
        quality = 'breached';
    } else if (diffPp + halfWidthPp <= QUALITY_MARGIN_PP) {
        quality = 'held';
    } else {
        quality = 'underpowered';
        notes.push('the interval straddles the 5 pp margin');
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
        ci_half_width_pp: halfWidthPp,
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
