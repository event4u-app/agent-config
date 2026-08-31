/**
 * The deterministic evaluation cascade — cheap to expensive, abort on the first
 * hard failure.
 *
 * `road-to-governed-harness-evolution` step 4.1, built to the AI council's
 * **Option B** of 2026-08-31 and NOT to Option A. The distinction is the whole
 * design of this file, so it is recorded here rather than only in the roadmap.
 *
 * ## Why this is a PREFIX and not the twelve-stage cascade
 *
 * Step 4.1 names a twelve-stage form whose stages include activation/delivery
 * and adherence. Those stages classify a candidate by observing how the harness
 * BEHAVED, and Phase 1's step 1.1 fixes what that classification rests on: *"a
 * deliberately failing trigger eval is classifiable as content vs activation vs
 * adherence **from the recorded receipt alone**"*. There is no receipt producer.
 * Until there is, a stage that assigned `activation` from a deterministic proxy
 * would be manufacturing evidence — a holdout leak is not an observation that
 * activation failed, and an `underpowered` result asserts insufficient evidence
 * rather than a cause.
 *
 * So this module implements exactly the stages whose evidence the process
 * produces ITSELF and can stand behind:
 *
 * | # | Stage | Cost | Family on failure |
 * |---|---|---|---|
 * | 1 | schema validity        | zero model calls | `content` |
 * | 2 | path ownership *(unreachable today — see the stage)* | zero model calls | `content` |
 * | 3 | holdout disclosure     | zero model calls | `unknown` |
 * | 4 | budget                 | zero model calls | `unknown` |
 * | 5 | near-duplicate screen  | zero model calls | `content` |
 * | 6 | metric vector + verdict| zero model calls | `unknown` |
 *
 * **Every stage here is free.** That is not an accident of the current stage
 * set — it is why these six are the ones that can ship without receipts, and it
 * makes the step's "a candidate failing the cheapest stage consumes no model
 * call" trivially true rather than merely asserted.
 *
 * **No stage is SOFT.** A condition whose failure does not block is a
 * diagnostic, not a cascade gate — so every stage here either passes or aborts
 * the cascade, and there is no third "warn" outcome a caller could ignore.
 *
 * ## The families, and the one this prefix may NOT assign
 *
 * `content | activation | adherence | unknown` are Phase 1's, and no fifth is
 * invented. This prefix assigns `content` and `unknown` only. It NEVER assigns
 * `activation` or `adherence`, because those are the receipt-bearing families
 * and nothing here has a receipt. `unknown` is the honest family for a stage
 * that establishes a candidate is unusable without establishing why in
 * behavioural terms — it is a real classification, not a fallback.
 */

import {
    assertMutationPathsOwned,
    parseCandidateRecord,
    PathOwnershipError,
    CandidateSchemaError,
    type CandidateRecord,
} from './candidate_record.js';
import {
    assertWithinBudget,
    BudgetExceededError,
    diversityCollapsed,
    type RunBudget,
    type RunPlan,
} from './harness_evolution_guards.js';
import {
    buildVector,
    promotionVerdict,
    type MetricRow,
    type MetricVector,
    type PromotionVerdict,
} from './evaluation_vector.js';

/** Phase 1's families. No fifth is invented here. */
export const FAILURE_FAMILIES = ['content', 'activation', 'adherence', 'unknown'] as const;
export type FailureFamily = (typeof FAILURE_FAMILIES)[number];

/**
 * The families this prefix is permitted to assign.
 *
 * `activation` and `adherence` are deliberately absent: assigning either from a
 * deterministic proxy is the evidence-manufacturing the council refused.
 */
export const PREFIX_ASSIGNABLE_FAMILIES: readonly FailureFamily[] = ['content', 'unknown'];

export const CASCADE_STAGES = [
    'schema-validity',
    'path-ownership',
    'holdout-disclosure',
    'budget',
    'near-duplicate',
    'metric-verdict',
] as const;
export type CascadeStage = (typeof CASCADE_STAGES)[number];

/** The cheapest stage. Its failure must cost nothing. */
export const CHEAPEST_STAGE: CascadeStage = 'schema-validity';

const STAGE_FAMILY: Readonly<Record<CascadeStage, FailureFamily>> = {
    'schema-validity': 'content',
    'path-ownership': 'content',
    'holdout-disclosure': 'unknown',
    budget: 'unknown',
    'near-duplicate': 'content',
    'metric-verdict': 'unknown',
};

export function familyForStage(stage: CascadeStage): FailureFamily {
    return STAGE_FAMILY[stage];
}

export interface CascadePass {
    readonly outcome: 'pass';
    readonly candidate_id: string;
    readonly stages_run: readonly CascadeStage[];
    readonly model_calls: 0;
    readonly verdict: PromotionVerdict;
}

export interface CascadeAbort {
    readonly outcome: 'abort';
    readonly candidate_id: string | null;
    /** The FIRST failing stage. The cascade does not continue past it. */
    readonly failed_stage: CascadeStage;
    readonly family: FailureFamily;
    readonly detail: string;
    readonly stages_run: readonly CascadeStage[];
    readonly model_calls: 0;
}

/**
 * Stages 1-5 passed and the verdict stage was NOT REACHED because the run
 * supplied no measurements.
 *
 * This is deliberately a third outcome and not an abort. A run that materialises
 * candidates without measuring them has not failed — materialising is what
 * `evolution_lab run` is for, and turning that into a non-zero exit would change
 * a verb's contract to make a new stage look reachable. Nor is it a pass: there
 * is no verdict, so nothing may read one. Naming the state is what keeps "no
 * metrics" from being silently benign.
 */
export interface CascadeIncomplete {
    readonly outcome: 'incomplete';
    readonly candidate_id: string;
    readonly stages_run: readonly CascadeStage[];
    readonly model_calls: 0;
    readonly not_reached: CascadeStage;
    readonly why: string;
}

export type CascadeResult = CascadePass | CascadeAbort | CascadeIncomplete;

export interface CascadeInput {
    /** The raw, unparsed record. Stage 1 is what turns it into a `CandidateRecord`. */
    readonly raw: unknown;
    readonly plan: RunPlan;
    readonly budget: RunBudget;
    /** Sibling candidate texts, for the near-duplicate screen. */
    readonly peers?: readonly string[];
    /** Metric rows, when the caller has them. Absent means the run measured nothing. */
    readonly rows?: readonly MetricRow[];
    /**
     * An already-built vector, when the caller has one.
     *
     * Takes precedence over `rows`. Step 5.6's run report parses vectors from
     * `--vector` and validates them through `buildVector`, so re-deriving one
     * here from loose rows would give the verdict a second, less-checked path
     * to the same number.
     */
    readonly vector?: MetricVector;
}

function abort(
    stage: CascadeStage,
    detail: string,
    run: CascadeStage[],
    candidate_id: string | null,
): CascadeAbort {
    return {
        outcome: 'abort',
        candidate_id,
        failed_stage: stage,
        family: familyForStage(stage),
        detail,
        stages_run: [...run],
        model_calls: 0,
    };
}

/**
 * Run the deterministic prefix over one candidate.
 *
 * Aborts on the FIRST hard failure — later stages are not attempted, so a
 * candidate that fails stage 1 never reaches stage 6. `model_calls` is a literal
 * `0` on every path rather than a counter, because a counter can be wrong and a
 * literal cannot: there is no code path in this module that could increment one.
 */
export function runCascade(input: CascadeInput): CascadeResult {
    const run: CascadeStage[] = [];

    // Stage 1 — schema validity. The cheapest, and the one whose failure must
    // cost nothing: it runs before any other stage touches the record.
    run.push('schema-validity');
    let record: CandidateRecord;
    try {
        record = parseCandidateRecord(input.raw);
    } catch (e) {
        // ATTRIBUTION, not just error handling. `parseMutations` already calls
        // `assertMutationPathsOwned` (`_lib/candidate_record.ts:434`), so an
        // unowned path throws from INSIDE the parse. Catching everything here
        // as a schema failure would file a path-ownership violation under the
        // wrong stage and the wrong evidence — the failing stage is what Phase
        // 1's classification reads, so getting it wrong is not cosmetic.
        if (e instanceof PathOwnershipError) {
            run.push('path-ownership');
            return abort('path-ownership', e.message, run, null);
        }
        const why = e instanceof CandidateSchemaError ? e.message : String(e);
        return abort('schema-validity', why, run, null);
    }

    // Stage 2 — path ownership, re-checked.
    //
    // HONEST LABEL: this branch is UNREACHABLE through this function's public
    // API today, and therefore untested. `runCascade` only ever accepts `raw`
    // and parses it, and `parseMutations` already calls
    // `assertMutationPathsOwned` (`_lib/candidate_record.ts:434`), so every
    // unowned path throws inside stage 1 and is attributed above. Measured
    // 2026-08-31 by neutralising the abort below: 15/15 stayed green.
    //
    // It is kept rather than deleted because it is free and it fails closed if
    // the parser ever stops enforcing ownership — but "defense in depth" is a
    // claim, and this one has no test behind it, so it is written down as an
    // unproven guard instead of counted as a proven one. Deleting it is a
    // legitimate future call; silently trusting it is not.
    run.push('path-ownership');
    try {
        assertMutationPathsOwned(record.mutations);
    } catch (e) {
        const why = e instanceof PathOwnershipError ? e.message : String(e);
        return abort('path-ownership', why, run, record.id);
    }

    // Stage 3 — holdout disclosure. The guard that REFUSES disclosure to a
    // proposer already exists and exits non-zero at its own call sites; what
    // this stage adds is that a record carrying a holdout reference never
    // reaches the verdict stage.
    run.push('holdout-disclosure');
    const leaked = record.mutations.find((m) => m.path.includes('holdout'));
    if (leaked !== undefined) {
        return abort('holdout-disclosure', `mutation path names a holdout: ${leaked.path}`, run, record.id);
    }

    // Stage 4 — budget. Before any expensive stage, and before any spend.
    run.push('budget');
    try {
        assertWithinBudget(input.plan, input.budget);
    } catch (e) {
        const why = e instanceof BudgetExceededError ? e.message : String(e);
        return abort('budget', why, run, record.id);
    }

    // Stage 5 — near-duplicate screen. Deterministic, zero model calls, and it
    // runs BEFORE the verdict so a paraphrase never consumes a measurement.
    run.push('near-duplicate');
    const peers = input.peers ?? [];
    if (peers.length > 0 && diversityCollapsed([record.id, ...peers])) {
        return abort('near-duplicate', 'candidate set collapsed to duplicates', run, record.id);
    }

    // Stage 6 — metric vector and the promotion verdict. This is the ONLY
    // promoter consulted, and it is `_lib/evaluation_vector.ts`'s, never a
    // second verdict computed here.
    if (input.vector === undefined && (input.rows === undefined || input.rows.length === 0)) {
        return {
            outcome: 'incomplete',
            candidate_id: record.id,
            stages_run: [...run],
            model_calls: 0,
            not_reached: 'metric-verdict',
            why: 'no metric rows: the run measured nothing, so no verdict exists',
        };
    }
    run.push('metric-verdict');
    let vector: MetricVector;
    if (input.vector !== undefined) {
        if (input.vector.candidate_id !== record.id) {
            return abort(
                'metric-verdict',
                `vector names candidate '${input.vector.candidate_id}', not '${record.id}'`,
                run,
                record.id,
            );
        }
        vector = input.vector;
    } else {
        try {
            vector = buildVector(record.id, input.rows as readonly MetricRow[]);
        } catch (e) {
            return abort('metric-verdict', String((e as Error).message), run, record.id);
        }
    }
    const verdict = promotionVerdict(vector);

    return {
        outcome: 'pass',
        candidate_id: record.id,
        stages_run: [...run],
        model_calls: 0,
        verdict,
    };
}
