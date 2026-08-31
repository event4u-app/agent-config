/**
 * The pathology archive — best-known intervention per `WHERE x WHY` failure
 * cell, over closed vocabularies, backed by append-only attempt history.
 *
 * `road-to-governed-harness-evolution` step 4.4. A pure Pareto frontier orders
 * candidates by their metric vectors and throws away the reason each candidate
 * exists, so two candidates that fail for completely different reasons compete
 * as if they were interchangeable. This module keeps the reason.
 *
 * ## What this is NOT
 *
 * It is not a second verdict beside `_lib/paired_verdict.ts`. Nothing here
 * decides whether a candidate is better; the archive records WHY attempts
 * failed and which intervention is currently RETAINED per cell. Promotion stays
 * with `_lib/evaluation_vector.ts`'s `promotionVerdict`, which this module never
 * calls and never reimplements.
 *
 * ## "Best" is a retained representative, not a quality claim
 *
 * The AI council of 2026-08-31 was explicit that "archive the best intervention
 * per cell" names no operation until ranking, tie-break and replacement are all
 * total. Two of the three candidate rules it enumerated need evidence systems
 * that do not exist — lowest edit distance to a human gold standard (there is no
 * gold standard) and highest measured failure-class coverage (there is no
 * coverage metric). The third, recency, is trivially deterministic and is what
 * ships. So the retained entry is a REPRESENTATIVE selected by recency, and this
 * module says so in its type names rather than calling it "best" and implying a
 * measurement nobody took.
 *
 * Because recency says nothing about quality, the attempt history is append-only
 * and every ranking decision is stamped with `ranking_rule_version`. When a real
 * quality metric arrives, representatives are RECOMPUTED from history rather
 * than lost.
 *
 * ## Ordering is by sequence, never by timestamp
 *
 * `attempt_sequence` is assigned by the ingester, monotonically. Timestamps come
 * from producer clocks: they collide, they arrive out of order, and they make a
 * replacement rule that is not total. `observed_at` is retained for reporting
 * and is never consulted for ordering.
 */

import { LADDER_RUNGS, type LadderRung } from './activation_ladder.js';

/** `WHERE` — reused from the activation ladder, never re-invented. */
export const PATHOLOGY_WHERE = LADDER_RUNGS;
export type PathologyWhere = LadderRung;

/**
 * `WHY` — the closed failure-REASON vocabulary.
 *
 * Closed means: a versioned enum, exactly one value per attempt, and an addition
 * requires a `classification_rule_version` bump plus migration. Free-form
 * explanation belongs in `reason_detail` and never in this axis.
 *
 * The order IS the precedence order. When several reasons could apply, the
 * earliest applicable value wins, so classification is deterministic rather than
 * dependent on evaluation order. `reason_unknown` applies only when none of the
 * first seven can be established — it is a real state, not a default.
 *
 * These are REASONS, deliberately not places. An earlier draft of this
 * vocabulary used names like `projection_failed` and `delivery_failed`, which
 * restate `WHERE` and collapse the very distinction the two axes exist to draw.
 */
export const PATHOLOGY_WHY = [
    'precondition_unsatisfied',
    'policy_blocked',
    'dependency_unavailable',
    'execution_failed',
    'output_contract_violated',
    'evidence_missing',
    'human_rejected',
    'reason_unknown',
] as const;
export type PathologyWhy = (typeof PATHOLOGY_WHY)[number];

/** Bumped when the cell/query shape changes. */
export const ARCHIVE_SCHEMA_VERSION = 1;
/** Bumped when `PATHOLOGY_WHY` or its precedence changes. */
export const CLASSIFICATION_RULE_VERSION = 1;
/** Bumped when the ranking/tie-break/replacement rule changes. */
export const RANKING_RULE_VERSION = 1;

/**
 * Dominance threshold for the search-collapse guard.
 *
 * STATED POLICY DEFAULT, not a measured optimum — and deliberately a NEW
 * constant rather than a reuse.
 *
 * The step's own verify line carries a bare `0.6`, and the prior council warned
 * that reusing it would be "a semantic change wearing a constant's clothes" IF
 * it already meant textual similarity. Checked against the tree on 2026-08-31:
 * it does not, because no such constant exists. `diversityCollapsed`
 * (`_lib/harness_evolution_guards.ts:215`) is a DISTINCT-COUNT check with
 * `minDistinct = 2` and no ratio at all, and the only near-duplicate constant is
 * `NEAR_DUPLICATE_THRESHOLD = 70` in `_lib/curator_ops.ts:106` — an integer
 * percentage on a different scale. So the collision the objection feared is not
 * present, and the number below is free to be given its own meaning.
 *
 * Revisit-if: a run records a collapse the guard did not catch, or a warm-up
 * period in which the floor below suppressed a real signal.
 */
export const PATHOLOGY_DOMINANCE_THRESHOLD = 0.6;
/** Observation window: the latest N classifiable failed attempts. */
export const PATHOLOGY_WINDOW_SIZE = 50;
/** No verdict below this many classifiable attempts in the window. */
export const PATHOLOGY_MIN_CLASSIFIABLE_ATTEMPTS = 20;

export type ClassificationStatus = 'classified' | 'unclassifiable';
export type ValidationStatus = 'valid' | 'invalid';

/** One append-only attempt observation. Never mutated, never deleted. */
export interface PathologyAttempt {
    readonly attempt_id: string;
    /** Monotonic, ingester-assigned. The ONLY ordering key. */
    readonly attempt_sequence: number;
    readonly candidate_id: string;
    readonly intervention_ref: string;
    readonly where: PathologyWhere;
    readonly why: PathologyWhy;
    readonly reason_detail: string;
    readonly classification_status: ClassificationStatus;
    readonly validation_status: ValidationStatus;
    /** Reporting only. Never consulted for ordering. */
    readonly observed_at: string;
    readonly archive_schema_version: number;
    readonly classification_rule_version: number;
    readonly ranking_rule_version: number;
    readonly cohort_id: string;
    readonly cohort_version: number;
}

/** A versioned cell query result. The guard consumes THIS, never storage internals. */
export interface PathologyCell {
    readonly where: PathologyWhere;
    readonly why: PathologyWhy;
    readonly archive_schema_version: number;
    readonly classification_rule_version: number;
    readonly ranking_rule_version: number;
    readonly cohort_id: string;
    readonly cohort_version: number;
    readonly attempt_count: number;
    readonly classifiable_count: number;
    readonly unclassifiable_count: number;
    readonly first_observed_attempt_sequence: number;
    readonly first_observed_at: string;
    readonly last_observed_attempt_sequence: number;
    readonly last_observed_at: string;
    readonly retained_candidate_id: string | null;
    readonly retained_intervention_ref: string | null;
    readonly retained_attempt_id: string | null;
    readonly retained_attempt_sequence: number | null;
    readonly retained_observed_at: string | null;
    readonly retained_ranking_rule: string;
    readonly retained_ranking_key: string | null;
    readonly retained_validation_status: ValidationStatus | null;
}

/** A versioned window query result. The guard's only legal input. */
export interface PathologyWindowQuery {
    readonly archive_schema_version: number;
    readonly classification_rule_version: number;
    readonly ranking_rule_version: number;
    readonly window_size: number;
    readonly unclassifiable_excluded: number;
    readonly rows: readonly PathologyAttempt[];
}

export interface DominanceOptions {
    readonly threshold?: number;
    readonly windowSize?: number;
    readonly minClassifiable?: number;
}

export const RETAINED_RANKING_RULE = 'recency-v1: attempt_sequence DESC, candidate_id ASC, attempt_id ASC';

export function cellKey(where: PathologyWhere, why: PathologyWhy): string {
    return `${where} ${why}`;
}

export class PathologyArchiveError extends Error {}

/**
 * Is `incoming` a better representative than `retained`?
 *
 * Total by construction: the tuple `(attempt_sequence DESC, candidate_id ASC,
 * attempt_id ASC)` orders any two distinct attempts, and `attempt_id` is unique,
 * so the comparison never falls through to "equal" for two different attempts.
 * A rule whose tie-break is declared but unreachable is not total, which is the
 * defect the council named in the timestamp-ordered alternative.
 */
export function replacesRetained(incoming: PathologyAttempt, retained: PathologyAttempt): boolean {
    if (incoming.attempt_sequence !== retained.attempt_sequence) {
        return incoming.attempt_sequence > retained.attempt_sequence;
    }
    if (incoming.candidate_id !== retained.candidate_id) {
        return incoming.candidate_id < retained.candidate_id;
    }
    return incoming.attempt_id < retained.attempt_id;
}

/** Only a validated, classified attempt may become a representative. */
function eligibleAsRepresentative(a: PathologyAttempt): boolean {
    return a.classification_status === 'classified' && a.validation_status === 'valid';
}

/**
 * Append-only, idempotent attempt store.
 *
 * Re-ingesting an existing `attempt_id` is a no-op: it cannot alter counts and
 * cannot change a representative. Without that, a retry loop silently inflates
 * the very frequency evidence the dominance guard reads.
 */
export class PathologyArchive {
    private readonly byId = new Map<string, PathologyAttempt>();
    private readonly order: PathologyAttempt[] = [];

    /** @returns true when the attempt was new, false when it was a duplicate. */
    ingest(a: PathologyAttempt): boolean {
        if (!PATHOLOGY_WHERE.includes(a.where)) {
            throw new PathologyArchiveError(`unknown WHERE '${a.where}'`);
        }
        if (!PATHOLOGY_WHY.includes(a.why)) {
            throw new PathologyArchiveError(`unknown WHY '${a.why}'`);
        }
        if (this.byId.has(a.attempt_id)) return false;
        this.byId.set(a.attempt_id, a);
        this.order.push(a);
        return true;
    }

    /** Every attempt, in ingest order. Callers must not mutate. */
    attempts(): readonly PathologyAttempt[] {
        return this.order;
    }

    /**
     * The versioned window query the collapse guard consumes.
     *
     * The guard may not read `attempts()` directly: the council required it to
     * consume "a versioned archive query rather than storage internals", so the
     * version/cohort quad travels WITH the rows and a guard cannot silently mix
     * two classification vocabularies. It returns attempts rather than cells
     * because a last-N window is not reconstructible from aggregates — which is
     * the same reason `cells()` alone is not the guard's input.
     */
    dominanceWindow(windowSize: number = PATHOLOGY_WINDOW_SIZE): PathologyWindowQuery {
        const classifiable = this.order
            .filter((a) => a.classification_status === 'classified')
            .sort((a, b) => a.attempt_sequence - b.attempt_sequence);
        const rows = classifiable.slice(-windowSize);
        const head = rows[0] ?? this.order[0];
        return {
            archive_schema_version: head?.archive_schema_version ?? ARCHIVE_SCHEMA_VERSION,
            classification_rule_version: head?.classification_rule_version ?? CLASSIFICATION_RULE_VERSION,
            ranking_rule_version: head?.ranking_rule_version ?? RANKING_RULE_VERSION,
            window_size: windowSize,
            unclassifiable_excluded: this.order.length - classifiable.length,
            rows,
        };
    }

    /** The collapse verdict, read through the versioned query above. */
    collapseVerdict(opts: DominanceOptions = {}): DominanceVerdict {
        return dominanceVerdict(this.dominanceWindow(opts.windowSize ?? PATHOLOGY_WINDOW_SIZE), opts);
    }

    /**
     * The versioned cell query. Cells are keyed on `WHERE x WHY` AND on the
     * version/cohort quad — attempts recorded under a different classification
     * rule describe a different vocabulary and must not be summed with these.
     */
    cells(): readonly PathologyCell[] {
        const groups = new Map<string, PathologyAttempt[]>();
        for (const a of this.order) {
            const k = [
                a.where,
                a.why,
                a.archive_schema_version,
                a.classification_rule_version,
                a.ranking_rule_version,
                a.cohort_id,
                a.cohort_version,
            ].join(' ');
            const bucket = groups.get(k);
            if (bucket) bucket.push(a);
            else groups.set(k, [a]);
        }

        const out: PathologyCell[] = [];
        for (const bucket of groups.values()) {
            const first = bucket.reduce((m, a) => (a.attempt_sequence < m.attempt_sequence ? a : m));
            const last = bucket.reduce((m, a) => (a.attempt_sequence > m.attempt_sequence ? a : m));
            let rep: PathologyAttempt | null = null;
            for (const a of bucket) {
                if (!eligibleAsRepresentative(a)) continue;
                if (rep === null || replacesRetained(a, rep)) rep = a;
            }
            const head = bucket[0]!;
            out.push({
                where: head.where,
                why: head.why,
                archive_schema_version: head.archive_schema_version,
                classification_rule_version: head.classification_rule_version,
                ranking_rule_version: head.ranking_rule_version,
                cohort_id: head.cohort_id,
                cohort_version: head.cohort_version,
                attempt_count: bucket.length,
                classifiable_count: bucket.filter((a) => a.classification_status === 'classified').length,
                unclassifiable_count: bucket.filter((a) => a.classification_status === 'unclassifiable').length,
                first_observed_attempt_sequence: first.attempt_sequence,
                first_observed_at: first.observed_at,
                last_observed_attempt_sequence: last.attempt_sequence,
                last_observed_at: last.observed_at,
                retained_candidate_id: rep?.candidate_id ?? null,
                retained_intervention_ref: rep?.intervention_ref ?? null,
                retained_attempt_id: rep?.attempt_id ?? null,
                retained_attempt_sequence: rep?.attempt_sequence ?? null,
                retained_observed_at: rep?.observed_at ?? null,
                retained_ranking_rule: RETAINED_RANKING_RULE,
                retained_ranking_key: rep
                    ? `${rep.attempt_sequence}|${rep.candidate_id}|${rep.attempt_id}`
                    : null,
                retained_validation_status: rep?.validation_status ?? null,
            });
        }
        return out.sort((a, b) => (cellKey(a.where, a.why) < cellKey(b.where, b.why) ? -1 : 1));
    }
}

export type DominanceVerdict =
    | { readonly status: 'warming-up'; readonly classifiable_in_window: number; readonly floor: number }
    | {
          readonly status: 'ok' | 'collapsed';
          readonly dominant_share: number;
          readonly dominant_cell: string;
          readonly classifiable_in_window: number;
          readonly window_size: number;
          readonly threshold: number;
      };

/**
 * The search-collapse guard, reading the archive through `cells()`-shaped data.
 *
 * Why a share and not the occupancy the frontier already gives: retaining one
 * winner per cell erases whether attempts were distributed 50/50 or 99.9/0.1 —
 * identical occupancy, radically different evidence of collapse. The denominator
 * is therefore CLASSIFIABLE ATTEMPTS in the window, not distinct cells.
 *
 * `warming-up` is a real state and NOT a pass. A guard that returned "ok" on
 * three observations would be reporting a confidence it does not have; the floor
 * exists so an empty archive cannot look healthy.
 */
export function dominanceVerdict(
    query: PathologyWindowQuery,
    opts: DominanceOptions = {},
): DominanceVerdict {
    const threshold = opts.threshold ?? PATHOLOGY_DOMINANCE_THRESHOLD;
    const windowSize = query.window_size;
    const floor = opts.minClassifiable ?? PATHOLOGY_MIN_CLASSIFIABLE_ATTEMPTS;

    // The query has already excluded unclassifiable rows and applied the
    // window; re-filtering here would let a caller pass raw storage and get a
    // verdict, which is the coupling this signature exists to prevent.
    const window = query.rows;

    if (window.length < floor) {
        return { status: 'warming-up', classifiable_in_window: window.length, floor };
    }

    const counts = new Map<string, number>();
    for (const a of window) {
        const k = cellKey(a.where, a.why);
        counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let dominantCell = '';
    let dominantCount = 0;
    for (const [k, n] of [...counts.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
        if (n > dominantCount) {
            dominantCount = n;
            dominantCell = k;
        }
    }
    const share = dominantCount / window.length;
    return {
        status: share >= threshold ? 'collapsed' : 'ok',
        dominant_share: share,
        dominant_cell: dominantCell.replace(' ', ' x '),
        classifiable_in_window: window.length,
        window_size: windowSize,
        threshold,
    };
}
