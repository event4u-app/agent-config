/**
 * Evaluator promotion — a new evaluator earns its seat by cross-grading, or it
 * does not get one.
 *
 * `road-to-governed-harness-evolution` Phase 4, step 4.7.
 *
 * > *Reuse the discrimination and hygiene machinery. `eval_publication`'s
 * > `PlantedItem` for plants, `judge_hygiene` for order-swap. Add the
 * > evaluator-promotion procedure the master omitted: an old and a new
 * > evaluator must cross-grade frozen candidate sets, and evaluator promotion
 * > itself requires discrimination plants.*
 * > verify: **a planted candidate the control arm also satisfies is reported as
 * > a discrimination deficit, not as a win; an evaluator change with no
 * > cross-grade is refused.**
 *
 * ## Reuse, not reimplementation
 *
 * Risk 1 on this roadmap is a parallel rebuild of machinery that already
 * exists, committed four times by the source proposals. So nothing here scores
 * a plant, classifies an assertion, or decides a paired verdict:
 * {@link reportPlants} delegates to `eval_publication.discriminationDeficit`
 * and {@link assertEvaluatorPromotable} delegates to
 * `judge_hygiene.auditAssertions`. What this module adds is the one thing
 * neither has: the REFUSAL that turns an evaluator swap into a gated event.
 *
 * ## Why a satisfied plant can be a deficit rather than a win
 *
 * A plant exists to be recoverable only via the behaviour under test. If the
 * control arm also satisfies it, then the item measured general competence and
 * the treatment's success over it is not evidence about the treatment — the two
 * arms scored the same for different-looking reasons. Counting it as a win is
 * the exact inflation `eval_publication`'s header describes, so
 * {@link reportPlants} moves it into `discrimination_deficits` and, critically,
 * strips its `requires_artifact_behaviour` flag before handing the set to
 * `discriminationDeficit` — otherwise a fixture set whose every discriminating
 * plant turned out to be non-discriminating in practice would still pass the
 * pre-run check on its declared intent.
 *
 * ## Order-swap is carried as a declared property, and refused when absent
 *
 * `judge_hygiene`'s header records that blinding and the order-swap are already
 * met upstream by `check_quality_regression.evaluatePair`, which judges every
 * pair in both orders and resolves a flip to `inconsistent`. This module does
 * not re-implement that; it requires the cross-grade to DECLARE that it ran
 * that way ({@link CrossGrade.order_swapped}) and refuses the promotion when it
 * did not. That is an honest boundary: the property is asserted by the caller
 * and checked here, not observed here.
 */
import { discriminationDeficit, type PlantedItem } from './eval_publication.js';
import { auditAssertions, type AssertionObservation } from './judge_hygiene.js';

/** One plant, and what each arm actually did with it. */
export interface PlantOutcome {
    item: PlantedItem;
    treatment_satisfied: boolean;
    control_satisfied: boolean;
}

export interface DiscriminationDeficitFinding {
    id: string;
    reason: string;
}

export interface PlantReport {
    /** Plants the treatment satisfied and the control did not. The measurement. */
    wins: readonly string[];
    /** Plants the control also satisfied. Never wins, whatever the treatment did. */
    discrimination_deficits: readonly DiscriminationDeficitFinding[];
    /**
     * The set-level verdict from `eval_publication.discriminationDeficit`, run
     * over the EFFECTIVE set (observed, not declared). Non-null means the set
     * cannot adjudicate at all.
     */
    set_deficit: string | null;
}

/** Classify every plant outcome. See the header for why a shared satisfaction is a deficit. */
export function reportPlants(outcomes: readonly PlantOutcome[]): PlantReport {
    const wins: string[] = [];
    const deficits: DiscriminationDeficitFinding[] = [];
    const effective: PlantedItem[] = [];

    for (const o of outcomes) {
        if (o.control_satisfied) {
            deficits.push({
                id: o.item.id,
                reason:
                    `the control arm also satisfied '${o.item.id}', so it measures general ` +
                    'competence rather than the behaviour under test — a discrimination deficit, not a win',
            });
            effective.push({ id: o.item.id, requires_artifact_behaviour: false });
            continue;
        }
        effective.push({ id: o.item.id, requires_artifact_behaviour: o.item.requires_artifact_behaviour });
        if (o.treatment_satisfied && o.item.requires_artifact_behaviour) {
            wins.push(o.item.id);
        }
    }

    return {
        wins,
        discrimination_deficits: deficits,
        set_deficit: discriminationDeficit(effective),
    };
}

/** The frozen candidate set both evaluators must grade. Frozen means: named and enumerated. */
export interface FrozenCandidateSet {
    id: string;
    candidate_ids: readonly string[];
}

export interface CrossGrade {
    from_evaluator: string;
    to_evaluator: string;
    /** Must equal the change's frozen set id — a cross-grade of some other set proves nothing. */
    frozen_set_id: string;
    /** Candidate ids the OLD evaluator graded. */
    graded_by_from: readonly string[];
    /** Candidate ids the NEW evaluator graded. */
    graded_by_to: readonly string[];
    /**
     * Declared by the caller: every pair was judged in both orders upstream
     * (`check_quality_regression.evaluatePair`). See the header — asserted, not
     * observed here.
     */
    order_swapped: boolean;
    /** Rubric assertions used by the grading, audited via `judge_hygiene`. */
    assertions: readonly AssertionObservation[];
}

export interface EvaluatorChange {
    from: string;
    to: string;
    frozen_set: FrozenCandidateSet;
    /** `null` is the case step 4.7 names: an evaluator change with no cross-grade. */
    cross_grade: CrossGrade | null;
    /** Discrimination plants. Evaluator promotion requires them, per step 4.7. */
    plants: readonly PlantOutcome[];
}

export class EvaluatorPromotionRefused extends Error {
    readonly reasons: readonly string[];
    constructor(reasons: readonly string[]) {
        super(`evaluator promotion refused: ${reasons.join('; ')}`);
        this.name = 'EvaluatorPromotionRefused';
        this.reasons = reasons;
    }
}

function missing(required: readonly string[], graded: readonly string[]): string[] {
    const seen = new Set(graded);
    return required.filter((id) => !seen.has(id));
}

/**
 * Throw {@link EvaluatorPromotionRefused} unless every condition holds.
 *
 * Fail-closed by construction: the function has no permissive path and no
 * option object that could relax one. A caller who wants to promote an
 * evaluator without a cross-grade has to delete this call, which is visible in
 * a diff, rather than pass a flag, which is not.
 */
export function assertEvaluatorPromotable(change: EvaluatorChange): void {
    const reasons: string[] = [];
    const cg = change.cross_grade;

    if (cg === null) {
        reasons.push(
            `no cross-grade between '${change.from}' and '${change.to}' — an evaluator change ` +
                'without one has no evidence that the two agree on anything',
        );
    } else {
        if (cg.frozen_set_id !== change.frozen_set.id) {
            reasons.push(
                `the cross-grade names frozen set '${cg.frozen_set_id}' but the change is over ` +
                    `'${change.frozen_set.id}'`,
            );
        }
        if (cg.from_evaluator !== change.from || cg.to_evaluator !== change.to) {
            reasons.push(
                `the cross-grade is between '${cg.from_evaluator}' and '${cg.to_evaluator}', ` +
                    `not between '${change.from}' and '${change.to}'`,
            );
        }
        const missFrom = missing(change.frozen_set.candidate_ids, cg.graded_by_from);
        const missTo = missing(change.frozen_set.candidate_ids, cg.graded_by_to);
        if (missFrom.length > 0) {
            reasons.push(`'${change.from}' did not grade: ${missFrom.join(', ')}`);
        }
        if (missTo.length > 0) {
            reasons.push(`'${change.to}' did not grade: ${missTo.join(', ')}`);
        }
        if (!cg.order_swapped) {
            reasons.push('the cross-grade did not declare the order-swap, so a position bias is unexcluded');
        }
        const audit = auditAssertions(cg.assertions);
        const alwaysPass = audit.findings.filter((f) => f.verdict === 'non-discriminating-always-pass');
        if (alwaysPass.length > 0) {
            reasons.push(
                `${String(alwaysPass.length)} assertion(s) pass in both arms and narrow nothing: ` +
                    alwaysPass.map((f) => f.id).join(', '),
            );
        }
    }

    if (change.plants.length === 0) {
        reasons.push('evaluator promotion requires discrimination plants and this change carries none');
    } else {
        const report = reportPlants(change.plants);
        if (report.set_deficit !== null) {
            reasons.push(`plants cannot discriminate: ${report.set_deficit}`);
        }
        if (report.discrimination_deficits.length > 0) {
            reasons.push(
                `${String(report.discrimination_deficits.length)} plant(s) were also satisfied by the control arm: ` +
                    report.discrimination_deficits.map((d) => d.id).join(', '),
            );
        }
    }

    if (reasons.length > 0) {
        throw new EvaluatorPromotionRefused(reasons);
    }
}
