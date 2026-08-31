/**
 * Pre-registered guards for the governed harness-evolution programme.
 *
 * `road-to-governed-harness-evolution` Phase 0, steps 0.4, 0.5 and 0.6. All
 * three are PRE-REGISTRATION: the runner they guard does not exist yet (Phases
 * 1-7 are unbuilt), and that is the point — a budget invariant written after
 * the first run is a description of what was spent, and a leakage abort written
 * after the first leak is a post-mortem.
 *
 * The three guards, and the failure each exists to make impossible:
 *
 *   0.4 EVALUATOR TRUST BOUNDARY. The parent design named which fields are
 *       proposer-visible and which are evaluator-private, and stopped at the
 *       naming. A declared boundary that nothing checks is a boundary that
 *       holds until the first convenient exception. {@link discloseToProposer}
 *       refuses a holdout field and records every field it did release.
 *
 *   0.5 BUDGET INVARIANT. Candidate count, trial repetitions and a spend
 *       ceiling, fixed BEFORE the run and aborting rather than truncating. A
 *       truncated run yields `underpowered`, which `paired_verdict` refuses to
 *       call a pass (`_lib/paired_verdict.ts:26`) and which a reader mistakes
 *       for one.
 *
 *   0.6 EPISTEMIC STOP CONDITIONS. A spend cap stops on cost; most of the
 *       reasons to stop are about VALIDITY. Each condition below carries a
 *       detector or is explicitly marked model-carried — never implied to be
 *       checked when it is not.
 *
 * Nothing here spends, fetches, or writes. The guards are pure functions over
 * declared state so a future runner can call them before it does any of those.
 */

/**
 * What a field may be shown to.
 *
 * `holdout` is the load-bearing member: it names a value whose disclosure
 * INVALIDATES the run rather than merely leaking information, which is why
 * {@link discloseToProposer} aborts on it instead of redacting.
 */
export type VisibilityClass =
    /** The proposer may read it. Candidate text, public metric names, the task. */
    | 'proposer-visible'
    /** The evaluator reads it; the proposer never does. Per-trial raw scores. */
    | 'evaluator-private'
    /** Sealed-partition truth. Disclosure invalidates the run, not just the trial. */
    | 'holdout';

/** One observation field and the boundary it sits behind. */
export interface FieldVisibility {
    readonly field: string;
    readonly visibility: VisibilityClass;
}

/** A field released to a proposer, with the class it was released under. */
export interface DisclosureRecord {
    readonly field: string;
    readonly visibility: VisibilityClass;
}

export class HoldoutLeakError extends Error {
    readonly field: string;
    constructor(field: string) {
        super(
            `holdout leakage: field '${field}' is class 'holdout' and reached proposer context. ` +
                'The run is INVALID, not degraded — a proposer that has seen sealed truth cannot ' +
                'be evaluated against it, and no later stage can undo that. Abort, do not redact.',
        );
        this.name = 'HoldoutLeakError';
        this.field = field;
    }
}

/**
 * Release an observation to a proposer, recording every field released.
 *
 * Fails CLOSED on an undeclared field: a field with no `visibility_class` is
 * treated as `holdout`, because the alternative — defaulting to visible —
 * makes forgetting to classify a new field silently equivalent to publishing
 * it. Step 0.4's whole subject is that a declared boundary nothing checks is
 * not a boundary.
 *
 * @throws {HoldoutLeakError} on the first holdout or undeclared field.
 */
export function discloseToProposer(
    observation: Readonly<Record<string, unknown>>,
    schema: readonly FieldVisibility[],
    log: DisclosureRecord[],
): Record<string, unknown> {
    const byField = new Map(schema.map((f) => [f.field, f.visibility]));
    const out: Record<string, unknown> = {};
    for (const field of Object.keys(observation)) {
        const visibility = byField.get(field) ?? 'holdout';
        if (visibility === 'holdout') throw new HoldoutLeakError(field);
        if (visibility !== 'proposer-visible') continue;
        log.push({ field, visibility });
        out[field] = observation[field];
    }
    return out;
}

/** The budget fixed before a run. Every field is a ceiling, never a target. */
export interface RunBudget {
    readonly maxCandidates: number;
    readonly maxTrialsPerCandidate: number;
    /** Spend ceiling in whole cents, so no float ever decides an abort. */
    readonly maxSpendCents: number;
}

/** What a run intends to do, as declared before it starts. */
export interface RunPlan {
    readonly candidates: number;
    readonly trialsPerCandidate: number;
    readonly estimatedSpendCents: number;
}

export class BudgetExceededError extends Error {
    readonly dimension: 'candidates' | 'trials' | 'spend';
    constructor(dimension: 'candidates' | 'trials' | 'spend', planned: number, ceiling: number) {
        super(
            `budget invariant: planned ${dimension} ${String(planned)} exceeds the pre-registered ` +
                `ceiling ${String(ceiling)}. ABORTING BEFORE THE RUN, not truncating it — a ` +
                'truncated run yields `underpowered`, which paired_verdict refuses to call a pass ' +
                'and which a reader mistakes for one.',
        );
        this.name = 'BudgetExceededError';
        this.dimension = dimension;
    }
}

/**
 * Check a plan against the pre-registered budget, BEFORE anything is spent.
 *
 * The order is deliberate — candidates, then trials, then spend. The first two
 * are free to check and the third is the one an operator argues about; failing
 * on a countable dimension first makes the message actionable without any
 * pricing discussion.
 *
 * @throws {BudgetExceededError} on the first dimension over its ceiling.
 */
export function assertWithinBudget(plan: RunPlan, budget: RunBudget): void {
    if (plan.candidates > budget.maxCandidates) {
        throw new BudgetExceededError('candidates', plan.candidates, budget.maxCandidates);
    }
    if (plan.trialsPerCandidate > budget.maxTrialsPerCandidate) {
        throw new BudgetExceededError('trials', plan.trialsPerCandidate, budget.maxTrialsPerCandidate);
    }
    if (plan.estimatedSpendCents > budget.maxSpendCents) {
        throw new BudgetExceededError('spend', plan.estimatedSpendCents, budget.maxSpendCents);
    }
}

/**
 * A stop condition, and whether anything actually checks it.
 *
 * `detector: null` means MODEL-CARRIED and is written out rather than left to
 * inference. This repository's own records name the coverage-inflation failure
 * — a condition listed as if it were enforced when nothing enforces it — often
 * enough that the honest field is cheaper than the audit that finds it later.
 */
export interface StopCondition {
    readonly id: string;
    readonly why: string;
    /** The exported detector's name, or `null` for model-carried. */
    readonly detector: string | null;
}

/**
 * The four epistemic stop conditions, from the roadmap's step 0.6.
 *
 * Both parent designs carried eight or nine stop conditions; the master
 * compressed them into the budget cap. A spend cap stops on COST, and these
 * stop on VALIDITY — stopping with INDETERMINATE is a valid result, and an
 * honest null is a success when it prevents unnecessary architecture.
 */
export const STOP_CONDITIONS: readonly StopCondition[] = [
    {
        id: 'holdout-underpowered',
        why: 'the sealed partition no longer carries enough discordant trials for the exact sign test to resolve, so every verdict it produces is `underpowered` by construction',
        detector: 'holdoutUnderpowered',
    },
    {
        id: 'evaluator-leakage',
        why: 'a holdout field reached proposer context; the run is invalid rather than degraded, and no later stage can undo it',
        detector: 'discloseToProposer',
    },
    {
        id: 'diversity-collapse',
        why: 'the candidate set has collapsed to semantic duplicates, so the trials measure sampling noise rather than a difference between candidates',
        detector: 'diversityCollapsed',
    },
    {
        id: 'pathology-dominance',
        // The sibling above asks whether THIS run's candidates are distinct.
        // This asks whether the SEARCH has stopped exploring: one WHERE x WHY
        // failure cell dominating the recent window means the proposer keeps
        // rediscovering one pathology, which a distinct-count check cannot see
        // because the candidates are all textually different.
        why: 'one WHERE x WHY pathology cell dominates the recent classifiable window, so the search is rediscovering one failure mode rather than exploring',
        detector: 'dominanceVerdict',
    },
    {
        id: 'cross-component-interference',
        why: 'two components changed in one run and credit cannot be assigned to either',
        // Honest null: deciding whether two changes interfere needs a causal
        // model of the components, and this programme has none. Marked
        // model-carried rather than given a detector that would pattern-match
        // on file paths and report confidence it does not have.
        detector: null,
    },
];

/**
 * Has the candidate set collapsed to semantic duplicates?
 *
 * Deterministic and deliberately crude: normalise, then count DISTINCT
 * candidates. Below `minDistinct` the set is collapsed. No embedding, no model
 * call — a detector that needs a model to decide whether to stop a model run is
 * a detector that can fail in the same way as the thing it watches.
 *
 * Normalisation is case- and whitespace-folding only. Two candidates differing
 * by a synonym read as distinct here, which UNDER-detects; that direction is
 * chosen on purpose, because a false stop discards a valid run while a missed
 * stop is caught by the verdict coming back `no-change`.
 */
export function diversityCollapsed(candidates: readonly string[], minDistinct = 2): boolean {
    const normalised = new Set(candidates.map((c) => c.trim().toLowerCase().replace(/\s+/g, ' ')));
    return normalised.size < minDistinct;
}

/**
 * Is the holdout partition too small for the exact sign test to resolve?
 *
 * Mirrors `paired_verdict`'s own floor rather than restating a number:
 * `MIN_DISCORDANT` there is DERIVED from the exact test at ALPHA, not chosen,
 * so a second hard-coded constant here would be a fork of a derivation.
 */
export function holdoutUnderpowered(discordantTrials: number, minDiscordant: number): boolean {
    return discordantTrials < minDiscordant;
}
