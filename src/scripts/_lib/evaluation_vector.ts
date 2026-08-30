/**
 * The evaluation gate's record type: a metric VECTOR, never a weighted total.
 *
 * `road-to-governed-harness-evolution` Phase 4, steps 4.2 and 4.3.
 *
 * > *4.2 Report a metric vector, never a weighted total. Include an
 * > `artifact-count delta` row — that is where the sprawl concern belongs,
 * > inside the gate where it can prevent something.*
 * > verify: **no code path computes a single scalar score.**
 *
 * > *4.3 Make the verdict hierarchy explicit. `paired_verdict` per metric
 * > decides; `underpowered` is not a pass; a Pareto frontier may only order
 * > candidates that are already non-dominated and never promotes.*
 * > verify: **a fixture where the frontier prefers a candidate whose
 * > `paired_verdict` is `underpowered` produces no promotion.**
 *
 * ## Why a scalar is the defect and not merely a simplification
 *
 * A weighted total is a claim that the metrics are commensurable and that the
 * author knew the exchange rate. Neither is established here. Worse, the
 * collapse is lossy in exactly the direction that matters: a candidate that
 * regresses one metric and wins three can outscore one that wins all four, and
 * the report shows one number where the disagreement was. The vector keeps the
 * disagreement visible and forces {@link promotionVerdict} to state which row
 * refused.
 *
 * So the shape carries the guarantee rather than a comment asking for it:
 * {@link MetricVector} has no total field, no weight field, and nothing in this
 * module takes a vector and returns a number.
 * `tests/scripts/evaluation_vector.test.ts` scans every file in `src/scripts`
 * that mentions `MetricVector` for that construct set, in both polarities.
 *
 * ## The artifact-count row is inside the gate, not beside it
 *
 * Sprawl reported next to a gate is a note; sprawl reported inside it can
 * refuse. {@link buildVector} REFUSES a vector that omits the
 * {@link ARTIFACT_COUNT_METRIC} row, so a candidate cannot reach
 * {@link promotionVerdict} without its artifact delta having been measured, and
 * {@link promotionVerdict} blocks on a delta above its ceiling.
 *
 * The default ceiling is **0** — a candidate may not grow the artifact count
 * unless the caller says so. That is a conservative default rather than a
 * measured one, and it is stated as such: a curator `ADD` is a legitimate
 * positive delta, and the caller that knows it is an `ADD` passes the ceiling
 * it means.
 *
 * ## Two row kinds, because two things are being measured
 *
 * A paired row carries a {@link PairedVerdict} — direction decided by the exact
 * sign test, with `underpowered` deliberately not a kind of pass. A counted row
 * carries an integer delta read off the candidate, with no trials behind it.
 * Forcing the artifact delta through a paired verdict would invent trials that
 * do not exist; giving a metric row a bare number would let a caller put an
 * outcome there without evidence. Both shapes exist so neither lie is available.
 */
import type { PairedVerdict, PairedVerdictKind } from './paired_verdict.js';

/** Which direction is better for a row. Read by {@link dominates}. */
export type MetricDirection = 'higher-better' | 'lower-better';

/** The counted row every vector must carry. Step 4.2 names it. */
export const ARTIFACT_COUNT_METRIC = 'artifact-count-delta';

export interface PairedRow {
    kind: 'paired';
    metric: string;
    direction: MetricDirection;
    verdict: PairedVerdict;
}

export interface CountedRow {
    kind: 'counted';
    metric: string;
    direction: MetricDirection;
    /** Signed delta against the baseline. No trials, no verdict, no inference. */
    delta: number;
}

export type MetricRow = PairedRow | CountedRow;

/**
 * The evaluation record for one candidate.
 *
 * Deliberately absent: any field that would hold a summary number. Adding one
 * is the failure this type exists to prevent, and the scanner test names it.
 */
export interface MetricVector {
    candidate_id: string;
    rows: readonly MetricRow[];
}

export class VectorShapeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VectorShapeError';
    }
}

/**
 * Build a vector, refusing the three shapes that would make the gate lie:
 * no rows at all, a duplicate metric name, or a missing artifact-count row.
 */
export function buildVector(candidate_id: string, rows: readonly MetricRow[]): MetricVector {
    if (rows.length === 0) {
        throw new VectorShapeError(`${candidate_id}: a vector with no rows measures nothing`);
    }
    const seen = new Set<string>();
    for (const r of rows) {
        if (seen.has(r.metric)) {
            throw new VectorShapeError(`${candidate_id}: duplicate metric row '${r.metric}'`);
        }
        seen.add(r.metric);
    }
    if (!seen.has(ARTIFACT_COUNT_METRIC)) {
        throw new VectorShapeError(
            `${candidate_id}: missing the '${ARTIFACT_COUNT_METRIC}' row — the sprawl ` +
                'measurement belongs inside the gate, so a vector without it cannot be evaluated',
        );
    }
    return { candidate_id, rows: [...rows] };
}

/** The artifact-count row, or `null` on a vector that never went through {@link buildVector}. */
export function artifactCountRow(v: MetricVector): CountedRow | null {
    for (const r of v.rows) {
        if (r.metric === ARTIFACT_COUNT_METRIC && r.kind === 'counted') {
            return r;
        }
    }
    return null;
}

/**
 * Row-level ordering: `-1` when `a` is worse, `1` when better, `0` when the two
 * carry no ordering against each other.
 *
 * A paired row orders by VERDICT KIND, never by magnitude — `magnitude_mean`
 * exists for triage and decides nothing (`paired_verdict.ts` header). An
 * `underpowered` row is incomparable with everything including itself: it is
 * not a worse pass, it is an absence of evidence, so it can neither win a row
 * nor lose one.
 */
/**
 * Paired-verdict ordering. `underpowered` is `null` — incomparable in both
 * directions, because an absent measurement is not a worse pass.
 */
const VERDICT_RANK: Record<PairedVerdictKind, number | null> = {
    pass: 2,
    'no-change': 1,
    regression: 0,
    underpowered: null,
};

export function compareRow(a: MetricRow, b: MetricRow): -1 | 0 | 1 {
    if (a.metric !== b.metric) {
        throw new VectorShapeError(`cannot compare '${a.metric}' against '${b.metric}'`);
    }
    if (a.kind === 'counted' && b.kind === 'counted') {
        if (a.delta === b.delta) return 0;
        const aBetter = a.direction === 'higher-better' ? a.delta > b.delta : a.delta < b.delta;
        return aBetter ? 1 : -1;
    }
    if (a.kind === 'paired' && b.kind === 'paired') {
        const ra = VERDICT_RANK[a.verdict.kind];
        const rb = VERDICT_RANK[b.verdict.kind];
        if (ra === null || rb === null) return 0;
        if (ra === rb) return 0;
        return ra > rb ? 1 : -1;
    }
    return 0;
}

/**
 * Pareto domination: `a` dominates `b` when no row is worse and at least one is
 * better. Vectors must carry the same metric names — comparing different metric
 * sets is a shape error, not a tie.
 */
export function dominates(a: MetricVector, b: MetricVector): boolean {
    const bRows = new Map(b.rows.map((r) => [r.metric, r]));
    if (a.rows.length !== b.rows.length) {
        throw new VectorShapeError(
            `${a.candidate_id} and ${b.candidate_id} carry different metric sets`,
        );
    }
    let strictlyBetter = false;
    for (const ar of a.rows) {
        const br = bRows.get(ar.metric);
        if (br === undefined) {
            throw new VectorShapeError(
                `${a.candidate_id} and ${b.candidate_id} carry different metric sets`,
            );
        }
        const c = compareRow(ar, br);
        if (c < 0) return false;
        if (c > 0) strictlyBetter = true;
    }
    return strictlyBetter;
}

/**
 * The non-dominated set, in input order.
 *
 * ORDERING ONLY. This function promotes nothing and is not consulted by
 * {@link promotionVerdict}; step 4.3's verify clause is precisely that a
 * frontier preference cannot become a promotion. Membership here means "no
 * other candidate beat this one on every row", which is a statement about the
 * comparison set and not about whether the evidence concluded.
 */
export function paretoFrontier(vectors: readonly MetricVector[]): MetricVector[] {
    return vectors.filter((v) => !vectors.some((o) => o !== v && dominates(o, v)));
}

export interface PromotionOptions {
    /** Largest artifact-count delta this candidate class may carry. Default 0. */
    artifactDeltaCeiling?: number;
}

export interface PromotionVerdict {
    promote: boolean;
    /** Every row that refused, by metric name. Empty iff `promote` is true. */
    blocking: readonly string[];
    /** One sentence a report can print verbatim. */
    reason: string;
}

/**
 * The ONLY promoter in this module, and the whole hierarchy in one place.
 *
 * Refuses on, in this order: a regression on any paired row; an `underpowered`
 * paired row (not a pass — the remedy is more trials, not a promotion); an
 * artifact-count delta above the ceiling; a vector with no paired row at all;
 * and a vector where every paired row concluded `no-change`. The last is the
 * one worth stating: `no-change` is a real verdict and it says the candidate
 * did not help, so a vector of them is a decided absence of improvement rather
 * than a clean sheet.
 */
export function promotionVerdict(v: MetricVector, opts: PromotionOptions = {}): PromotionVerdict {
    const ceiling = opts.artifactDeltaCeiling ?? 0;
    const blocking: string[] = [];
    const notes: string[] = [];
    let pairedRows = 0;
    let passRows = 0;

    for (const r of v.rows) {
        if (r.kind === 'paired') {
            pairedRows += 1;
            if (r.verdict.kind === 'pass') passRows += 1;
            if (r.verdict.kind === 'regression') {
                blocking.push(r.metric);
                notes.push(`${r.metric} regressed`);
            } else if (r.verdict.kind === 'underpowered') {
                blocking.push(r.metric);
                notes.push(`${r.metric} is underpowered, which is not a pass`);
            }
        } else if (r.metric === ARTIFACT_COUNT_METRIC && r.delta > ceiling) {
            blocking.push(r.metric);
            notes.push(`artifact-count delta ${String(r.delta)} exceeds ceiling ${String(ceiling)}`);
        }
    }

    if (pairedRows === 0) {
        blocking.push('<no-paired-row>');
        notes.push('no paired verdict in the vector, so no metric concluded');
    } else if (passRows === 0 && blocking.length === 0) {
        blocking.push('<no-pass-row>');
        notes.push('every paired row concluded no-change, so nothing improved');
    }

    if (blocking.length > 0) {
        return {
            promote: false,
            blocking,
            reason: `${v.candidate_id} is not promotable: ${notes.join('; ')}`,
        };
    }
    return {
        promote: true,
        blocking: [],
        reason:
            `${v.candidate_id} carries ${String(pairedRows)} paired row(s), ${String(passRows)} of them a pass, ` +
            `none regressed or underpowered, artifact delta within ceiling ${String(ceiling)}`,
    };
}
