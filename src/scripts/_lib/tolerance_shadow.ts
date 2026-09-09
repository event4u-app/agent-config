/**
 * Shadow records for the value-reconciliation tolerance — the window whose
 * distribution a threshold may later be read off.
 *
 * NO NEW CONCERN. `check_estate_count` reports zero growth allowance on hook
 * concerns, and the roadmap step says so in as many words: extend the existing
 * shadow gate. These records therefore ride `source_first_gate_hook.ts`'s
 * `SHADOW_LOG` — the same JSONL file, the same gitignored local-only path — and
 * are told apart by their own `record` discriminator. Nothing new is registered,
 * nothing new fires, and the concern count is unmoved.
 *
 * NO SELF-REPORTED VERDICT, which is the property the step's verify clause
 * names and the one most easily lost. A record says what the distance WAS and
 * what each candidate threshold WOULD have done with it. It never says whether
 * that was right. A field like `was_correct` would be the mechanism grading its
 * own homework, and a distribution of self-assessments measures the assessor —
 * the same reason `source_first_gate_hook` records `would_warn` per candidate
 * instead of one `warn`.
 *
 * COUNTERFACTUAL, NOT CHOSEN. `CANDIDATE_COLOR_THRESHOLDS` and
 * `CANDIDATE_LENGTH_THRESHOLDS` are evaluation points, not defaults: every
 * record carries the outcome at each, so the window yields a curve rather than
 * a yes/no. That is the council's own instruction — evaluate several candidate
 * thresholds counterfactually, never select one as behaviour — and it is why a
 * spread exists at all. `SHIPPED_TOLERANCE` stays `null` on both axes
 * throughout the window.
 *
 * PRIVACY BY CONSTRUCTION. The record type carries a kind, a metric, numbers,
 * a token NAME, and booleans. It has no field able to hold a file path, a
 * prompt, a selector, or any document content — the same stance
 * `source_first_gate_hook.ts` states for its own record. A token name is a
 * project's own vocabulary and is the one string here; it is what makes a
 * distribution readable per token rather than only in aggregate.
 */
import {
    COLOR_DISTANCE_METRIC,
    LENGTH_DISTANCE_METRIC,
    type ValueKind,
    type ValueRow,
} from './design_tolerance.js';

/**
 * Colour ΔEOK evaluation points. Spread deliberately across two orders of
 * magnitude: the window has to show where the curve bends, and a spread
 * clustered around a guess would only confirm the guess.
 */
export const CANDIDATE_COLOR_THRESHOLDS: readonly number[] = [0.001, 0.005, 0.01, 0.02, 0.05];

/**
 * Length evaluation points, in CSS pixels. `1` is here because it is the one
 * externally observed candidate in the evidence set (Primer's spacing plugin),
 * and it is one point on a curve rather than a preferred value.
 */
export const CANDIDATE_LENGTH_THRESHOLDS: readonly number[] = [0.5, 1, 2, 4];

/** Discriminator on the shared shadow log. */
export const TOLERANCE_SHADOW_RECORD = 'tolerance_shadow' as const;

export interface CounterfactualOutcome {
    threshold: number;
    /** Would this value have been reconciled onto the token at that threshold? */
    would_reconcile: boolean;
}

export interface ToleranceShadowRecord {
    record: typeof TOLERANCE_SHADOW_RECORD;
    kind: ValueKind;
    metric: typeof COLOR_DISTANCE_METRIC | typeof LENGTH_DISTANCE_METRIC;
    /** Distance to the nearest project token, in `metric`. */
    distance: number;
    /** The token's own name. No value, no path, no content. */
    nearest_token: string;
    /** What the mechanism actually did — `false` throughout the shadow window. */
    acted: boolean;
    counterfactual: CounterfactualOutcome[];
}

export function candidatesFor(kind: ValueKind): readonly number[] {
    return kind === 'color' ? CANDIDATE_COLOR_THRESHOLDS : CANDIDATE_LENGTH_THRESHOLDS;
}

/**
 * Build a record from a reconciled value row, or `null` when the row carries
 * nothing to measure.
 *
 * A row with no candidate token is deliberately NOT recorded as a distance of
 * zero or of infinity: it is the absence of a measurement, and a window that
 * silently folded those in would report a distribution over a population that
 * includes non-observations.
 */
export function toleranceShadowRecord(
    kind: ValueKind,
    row: ValueRow,
): ToleranceShadowRecord | null {
    if (row.nearest === null || row.distance === null || row.metric === null) return null;
    const distance = row.distance;
    return {
        record: TOLERANCE_SHADOW_RECORD,
        kind,
        metric: row.metric,
        distance,
        nearest_token: row.nearest.name,
        acted: row.outcome === 'reconciled',
        counterfactual: candidatesFor(kind).map((threshold) => ({
            threshold,
            would_reconcile: distance <= threshold,
        })),
    };
}

/**
 * Pre-registered flip criterion, written BEFORE the window opens — which is the
 * third clause of the step's verify and the one a later reader cannot
 * reconstruct. Prose rather than code on purpose: nothing evaluates it
 * automatically, and a function that returned `true` here would be the
 * mechanism authorising its own promotion.
 */
export const FLIP_CRITERION = `
Shadow -> a shipped tolerance, when ALL of:

  a. >= 200 tolerance_shadow records, or >= 4 weeks of window, whichever comes
     first, with at least 50 records on EACH axis. Colour and length are
     separate distributions and a threshold read off a pooled one is read off
     the wrong population.
  b. The chosen candidate's counterfactual FALSE-RECONCILIATION share -- rows a
     human reviewer marks as "should have been preserved" that the candidate
     would have reconciled -- is at or below 1 %, estimated per axis. The
     reviewer labels are collected OUTSIDE this record type on purpose: a
     record that carried its own correctness label would be the self-report
     this module refuses.
  c. The MISSED-reconciliation share is reported alongside it and is not
     optimised away. A threshold of zero trivially satisfies (b) and is useless;
     both error directions are stated or the criterion is not met.
  d. The distribution is not obviously bimodal. A bimodal curve means the
     tolerance model itself is wrong -- two populations are being measured as
     one -- and the response is to re-cut the model, never to pick a threshold
     between the modes.

Reverse trigger: fewer than 20 records in 8 weeks -> evaluate removing the
mechanism. A reconciliation nobody exercises is prose with a config key.

Never lifted by this criterion: enabling the mechanism BY DEFAULT is a
consumer-facing default flip and stays owner-reserved, recorded in
agents/roadmaps/stubs/road-to-frontend-power-default-flip.md. Meeting a to d
authorises a shipped tolerance VALUE, not a shipped default.
`.trim();
