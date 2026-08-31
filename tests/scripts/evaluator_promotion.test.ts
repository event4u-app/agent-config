/**
 * Tests for evaluator promotion
 * (`src/scripts/_lib/evaluator_promotion.ts`,
 * road-to-governed-harness-evolution step 4.7).
 *
 * The step's verify clause has two conjuncts and both are refusals, so both are
 * asserted as observable failures: a plant the control arm also satisfies must
 * be reported as a discrimination deficit rather than counted as a win, and an
 * evaluator change with no cross-grade must be REFUSED. The accepting case
 * exists so a procedure that started refusing everything would not pass either.
 */
import { describe, expect, it } from 'vitest';

import { discriminationDeficit } from '../../src/scripts/_lib/eval_publication.js';
import {
    assertEvaluatorPromotable,
    EvaluatorPromotionRefused,
    reportPlants,
    type CrossGrade,
    type EvaluatorChange,
    type PlantOutcome,
} from '../../src/scripts/_lib/evaluator_promotion.js';

const FROZEN = { id: 'frozen-set-2026-08-31', candidate_ids: ['c1', 'c2', 'c3'] };

/** The one plant only the treatment recovers — the measurement. */
const DISCRIMINATING: PlantOutcome = {
    item: { id: 'p1', requires_artifact_behaviour: true },
    treatment_satisfied: true,
    control_satisfied: false,
};
/** A plant both arms satisfy — a deficit, whatever the treatment scored. */
const SHARED: PlantOutcome = {
    item: { id: 'p2', requires_artifact_behaviour: false },
    treatment_satisfied: true,
    control_satisfied: true,
};
const GOOD_PLANTS: PlantOutcome[] = [DISCRIMINATING, SHARED];

function crossGrade(over: Partial<CrossGrade> = {}): CrossGrade {
    return {
        from_evaluator: 'eval-v1',
        to_evaluator: 'eval-v2',
        frozen_set_id: FROZEN.id,
        graded_by_from: [...FROZEN.candidate_ids],
        graded_by_to: [...FROZEN.candidate_ids],
        order_swapped: true,
        assertions: [{ id: 'a1', treatment_passes: 9, control_passes: 2, trials: 10 }],
        ...over,
    };
}

function change(over: Partial<EvaluatorChange> = {}): EvaluatorChange {
    return {
        from: 'eval-v1',
        to: 'eval-v2',
        frozen_set: FROZEN,
        cross_grade: crossGrade(),
        // Only the discriminating plant — the shared one is exercised below.
        plants: [DISCRIMINATING],
        ...over,
    };
}

describe('4.7 — a plant the control also satisfies is a deficit, never a win', () => {
    it('moves the shared plant out of `wins` and into `discrimination_deficits`', () => {
        const report = reportPlants(GOOD_PLANTS);
        expect(report.wins).toEqual(['p1']);
        expect(report.discrimination_deficits.map((d) => d.id)).toEqual(['p2']);
        expect(report.discrimination_deficits[0]?.reason).toContain('control arm also satisfied');
    });

    it('a plant the treatment satisfied is STILL not a win when the control did too', () => {
        const shared: PlantOutcome = {
            item: { id: 'shared', requires_artifact_behaviour: true },
            treatment_satisfied: true,
            control_satisfied: true,
        };
        const report = reportPlants([shared]);
        expect(report.wins).toEqual([]);
        expect(report.discrimination_deficits.map((d) => d.id)).toEqual(['shared']);
    });

    it('strips the DECLARED flag before the set-level check, so intent cannot rescue the set', () => {
        const shared: PlantOutcome = {
            item: { id: 'shared', requires_artifact_behaviour: true },
            treatment_satisfied: true,
            control_satisfied: true,
        };
        // The declared set passes `eval_publication`'s pre-run check ...
        expect(discriminationDeficit([shared.item])).toBeNull();
        // ... and the OBSERVED set does not.
        expect(reportPlants([shared]).set_deficit).toContain('control arm can score identically');
    });

    it('reuses `eval_publication.discriminationDeficit` rather than reimplementing it', () => {
        expect(reportPlants([]).set_deficit).toBe(discriminationDeficit([]));
    });
});

describe('4.7 — an evaluator change with no cross-grade is refused', () => {
    it('REFUSES a null cross-grade and names why', () => {
        expect(() => assertEvaluatorPromotable(change({ cross_grade: null }))).toThrow(
            EvaluatorPromotionRefused,
        );
        try {
            assertEvaluatorPromotable(change({ cross_grade: null }));
        } catch (e) {
            expect((e as EvaluatorPromotionRefused).reasons.join(' ')).toContain('no cross-grade');
        }
    });

    it('REFUSES a cross-grade over some other frozen set', () => {
        const c = change({ cross_grade: crossGrade({ frozen_set_id: 'some-other-set' }) });
        expect(() => assertEvaluatorPromotable(c)).toThrow(/frozen set/);
    });

    it('REFUSES when either evaluator skipped part of the frozen set', () => {
        expect(() =>
            assertEvaluatorPromotable(change({ cross_grade: crossGrade({ graded_by_to: ['c1'] }) })),
        ).toThrow(/did not grade: c2, c3/);
        expect(() =>
            assertEvaluatorPromotable(change({ cross_grade: crossGrade({ graded_by_from: [] }) })),
        ).toThrow(/eval-v1' did not grade/);
    });

    it('REFUSES a cross-grade between the wrong pair of evaluators', () => {
        const c = change({ cross_grade: crossGrade({ to_evaluator: 'eval-v9' }) });
        expect(() => assertEvaluatorPromotable(c)).toThrow(/not between/);
    });

    it('REFUSES an unswapped cross-grade — position bias stays unexcluded', () => {
        const c = change({ cross_grade: crossGrade({ order_swapped: false }) });
        expect(() => assertEvaluatorPromotable(c)).toThrow(/order-swap/);
    });

    it('REFUSES an always-pass assertion via `judge_hygiene`', () => {
        const c = change({
            cross_grade: crossGrade({
                assertions: [{ id: 'inflation', treatment_passes: 10, control_passes: 10, trials: 10 }],
            }),
        });
        expect(() => assertEvaluatorPromotable(c)).toThrow(/narrow nothing/);
    });

    it('REFUSES an evaluator change carrying no plants at all', () => {
        expect(() => assertEvaluatorPromotable(change({ plants: [] }))).toThrow(
            /requires discrimination plants/,
        );
    });

    it('REFUSES when the plants cannot discriminate', () => {
        const c = change({
            plants: [
                {
                    item: { id: 'weak', requires_artifact_behaviour: false },
                    treatment_satisfied: true,
                    control_satisfied: false,
                },
            ],
        });
        expect(() => assertEvaluatorPromotable(c)).toThrow(/cannot discriminate/);
    });

    it('REFUSES when a plant was also satisfied by the control arm', () => {
        const c = change({ plants: GOOD_PLANTS });
        expect(() => assertEvaluatorPromotable(c)).toThrow(/also satisfied by the control arm/);
    });

    it('ACCEPTS a complete cross-grade — the gate is not refusing everything', () => {
        expect(() => assertEvaluatorPromotable(change())).not.toThrow();
    });

    it('has no option that relaxes the refusal', () => {
        // A one-argument signature is the mechanical half: there is no flag to
        // pass, so bypassing the gate means deleting the call.
        expect(assertEvaluatorPromotable).toHaveLength(1);
    });
});
