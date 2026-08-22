/**
 * One structural line per review run — the review surface's only telemetry.
 *
 * Why it exists: before this file the review surface emitted nothing. Nothing
 * recorded how often a review ran, which judges fired, or whether the spec
 * axis ever changed a recommendation — so the value of adding a sixth judge
 * was unmeasurable in either direction, and the cheapest response to a slower
 * default path is to switch the new judge off. A number is the only defence
 * against that, and the honest number includes "it changed nothing".
 *
 * PII-exclusion by CONSTRUCTION, not by scrubbing. `ReviewLine` has no field
 * able to hold free-form content: every member is an enum, a boolean, a
 * non-negative integer, or an ISO timestamp. There is no `payload`, `notes`,
 * `extra`, `prompt`, `diff` or `path` member, and `buildReviewLine` REJECTS an
 * input object carrying one rather than dropping it silently — a scrubber can
 * fail, an absent field cannot. Same principle the artifact-engagement event
 * and `orchestration_record`'s hex-only `payload_hash` apply.
 *
 * Deliberately NOT reused from `_lib/orchestration_record.ts`: that line
 * describes a subagent DISPATCH (tier, route, token deltas, cache hits). A
 * review is not a dispatch, and widening `RecordInput` with review-shaped
 * optionals would make both types describe neither thing precisely.
 */

/** Was the spec axis able to run at all, and on what basis? */
export type SpecAxisReach = 'reachable_with_criteria' | 'reachable_no_criteria' | 'unreachable';

/**
 * Did the spec axis change the recommendation the craft judges would have
 * produced on their own?
 *
 * `null` is NOT "no" — it means the comparison never happened (the axis did
 * not run, so there is no counterfactual). A `false` here would claim a
 * comparison that was never made, which is the mis-attribution this field
 * exists to expose. Same reasoning as `modelDivergent` in
 * `_lib/orchestration_record.ts`.
 */
export type SpecAxisEffect = 'changed' | 'unchanged' | null;

/** The recommendation word the synthesis emitted. */
export type ReviewRecommendation = 'block' | 'revise' | 'proceed';

/** The criteria-source state, mirroring `judge-spec-compliance`'s three states. */
export type CriteriaSource = 'supplied' | 'not_provided' | 'supplied_unparseable';

/** The closed field set. A member not on this list cannot be written. */
export const REVIEW_LINE_FIELDS = [
    'schema',
    'at',
    'judges_declared',
    'judges_ran',
    'spec_axis_reach',
    'criteria_source',
    'criteria_count',
    'spec_missing',
    'spec_partial',
    'recommendation',
    'spec_axis_effect',
] as const;

export type ReviewLineField = (typeof REVIEW_LINE_FIELDS)[number];

/**
 * Field names that must never appear on this line — the free-form shapes a
 * reviewer would reach for first. Checked as an INPUT rejection, so adding one
 * fails loudly at the call site instead of being stripped downstream.
 */
export const FORBIDDEN_FREEFORM_FIELDS = [
    'payload',
    'notes',
    'extra',
    'prompt',
    'diff',
    'path',
    'file',
    'criteria',
    'findings',
    'message',
    'body',
    'content',
    'text',
] as const;

export interface ReviewLine {
    readonly schema: 'review-axis-v1';
    /** ISO-8601 UTC. Caller-supplied so the line is reproducible in a test. */
    readonly at: string;
    readonly judges_declared: number;
    readonly judges_ran: number;
    readonly spec_axis_reach: SpecAxisReach;
    readonly criteria_source: CriteriaSource;
    readonly criteria_count: number;
    readonly spec_missing: number;
    readonly spec_partial: number;
    readonly recommendation: ReviewRecommendation;
    readonly spec_axis_effect: SpecAxisEffect;
}

export interface ReviewLineInput {
    at: string;
    judges_declared: number;
    judges_ran: number;
    spec_axis_reach: SpecAxisReach;
    criteria_source: CriteriaSource;
    criteria_count: number;
    spec_missing: number;
    spec_partial: number;
    recommendation: ReviewRecommendation;
    spec_axis_effect?: SpecAxisEffect;
}

export interface BuiltReviewLine {
    line: ReviewLine | null;
    errors: string[];
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
const REACH: readonly SpecAxisReach[] = ['reachable_with_criteria', 'reachable_no_criteria', 'unreachable'];
const SOURCE: readonly CriteriaSource[] = ['supplied', 'not_provided', 'supplied_unparseable'];
const RECO: readonly ReviewRecommendation[] = ['block', 'revise', 'proceed'];

function isCount(n: unknown): n is number {
    return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/**
 * Build + validate one `review-axis-v1` line.
 *
 * Returns `{line, errors}`; when `errors` is non-empty, `line` is null and the
 * caller must NOT write. Never throws, never partially writes, never silently
 * repairs an invalid input — the same contract as `buildOrchestrationLine`.
 */
export function buildReviewLine(input: ReviewLineInput): BuiltReviewLine {
    const errors: string[] = [];
    const raw = input as unknown as Record<string, unknown>;

    for (const banned of FORBIDDEN_FREEFORM_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(raw, banned)) {
            errors.push(
                `'${banned}' is a free-form field and review-axis-v1 carries none — ` +
                    'privacy here is a property of the schema shape, not of a scrubbing pass',
            );
        }
    }

    if (typeof input.at !== 'string' || !ISO_RE.test(input.at)) {
        errors.push('at must be an ISO-8601 UTC timestamp (…Z)');
    }
    for (const k of ['judges_declared', 'judges_ran', 'criteria_count', 'spec_missing', 'spec_partial'] as const) {
        if (!isCount(input[k])) errors.push(`${k} must be a non-negative integer`);
    }
    if (isCount(input.judges_ran) && isCount(input.judges_declared) && input.judges_ran > input.judges_declared) {
        errors.push('judges_ran cannot exceed judges_declared');
    }
    if (!REACH.includes(input.spec_axis_reach)) errors.push(`spec_axis_reach must be one of ${REACH.join(' | ')}`);
    if (!SOURCE.includes(input.criteria_source)) errors.push(`criteria_source must be one of ${SOURCE.join(' | ')}`);
    if (!RECO.includes(input.recommendation)) errors.push(`recommendation must be one of ${RECO.join(' | ')}`);

    const effect = input.spec_axis_effect ?? null;
    if (effect !== null && effect !== 'changed' && effect !== 'unchanged') {
        errors.push('spec_axis_effect must be changed | unchanged | null');
    }
    // A counterfactual that never ran is `null`, never `unchanged`.
    if (input.spec_axis_reach === 'unreachable' && effect !== null) {
        errors.push('spec_axis_effect must be null when the axis was unreachable — there was no comparison to report');
    }
    // The two honest pairings of reach and source.
    if (input.spec_axis_reach === 'reachable_with_criteria' && input.criteria_source !== 'supplied') {
        errors.push('reachable_with_criteria requires criteria_source=supplied');
    }
    if (input.spec_axis_reach === 'reachable_no_criteria' && input.criteria_source === 'supplied') {
        errors.push('reachable_no_criteria contradicts criteria_source=supplied');
    }
    if (input.criteria_source !== 'supplied' && isCount(input.criteria_count) && input.criteria_count > 0) {
        errors.push('criteria_count must be 0 unless criteria were supplied');
    }

    if (errors.length > 0) return { line: null, errors };

    return {
        line: {
            schema: 'review-axis-v1',
            at: input.at,
            judges_declared: input.judges_declared,
            judges_ran: input.judges_ran,
            spec_axis_reach: input.spec_axis_reach,
            criteria_source: input.criteria_source,
            criteria_count: input.criteria_count,
            spec_missing: input.spec_missing,
            spec_partial: input.spec_partial,
            recommendation: input.recommendation,
            spec_axis_effect: effect,
        },
        errors: [],
    };
}
