/**
 * GT-3 — test-failure recovery: fix the buggy `power` stub (TS twin of
 * gt3_recovery.py; injected code is now TypeScript).
 *
 * Cycle storyboard:
 *   1. create-plan halt   → recipe sets state.plan
 *   2. apply-plan halt     → first fix (handles negative base + odd exponent,
 *      trips on even exponents); state.changes recorded
 *   3. run-tests halt      → vitest runs; the negative-base test asserts odd
 *      AND even exponents → failed verdict captured
 *   4. bad-verdict halt    → now an `@agent-directive: fix-failing-checks`
 *      delegation (self-fix attempt 1 of 3) rather than a user question;
 *      recipe applies the real fix, re-runs vitest (success), updates
 *      state.tests
 *   5. review-changes halt → recipe sets state.verify
 *   6. report runs         → engine exits 0
 */
import type { RecipeModule } from './index.js';
import * as h from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-3',
    ticket_relpath: 'tickets/gt-3-recovery.json',
    persona: null,
    cycle_cap: 8,
};

const BUGGY_STUB = '    return Math.abs(a) ** b;';

const FIRST_ATTEMPT = `    if (a < 0) {
        return -(Math.abs(a) ** b);
    }
    return a ** b;`;

const REAL_FIX = `    if (a < 0 && b % 2 === 1) {
        return -(Math.abs(a) ** b);
    }
    return Math.abs(a) ** b;`;

const NEGATIVE_TEST = `

import { power } from '../src/calculator.js';

it('power negative base', () => {
    expect(power(-2, 3)).toBe(-8);
    expect(power(-2, 4)).toBe(16);
});
`;

export function buildRecipe(workspace: string): Record<string, RecipeStep> {
    const onCreatePlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['plan'] = h.standard_plan(
            'Fix power() for negative bases',
            'Replace the Math.abs(a) ** b stub with sign-aware logic',
            'Add a negative-base power test covering odd + even exponents',
            'Re-run vitest to confirm both assertions pass',
        );
        record.recipe_notes.push('plan recorded');
        return state;
    };

    const onApplyPlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.replace_in_file(workspace, 'src/calculator.ts', BUGGY_STUB, FIRST_ATTEMPT);
        h.append_to_file(workspace, 'tests/calculator.test.ts', NEGATIVE_TEST);
        state['changes'] = h.base_changes('src/calculator.ts', 'tests/calculator.test.ts');
        record.recipe_notes.push('first-attempt fix applied');
        return state;
    };

    const onRunTests: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['tests'] = h.run_vitest(workspace);
        record.recipe_notes.push(`vitest verdict=${(state['tests'] as Dict)['verdict'] as string}`);
        return state;
    };

    // The bad-verdict surface. It used to be the recipe's only no-directive
    // halt — a user question block — and the bounded self-fix loop turned it
    // into an `@agent-directive: fix-failing-checks` delegation. Both keys are
    // registered: the directive is what the engine emits now, and
    // `_no_directive` stays so this recipe still describes the pre-loop shape
    // if the surface is ever routed back.
    const onBadVerdict: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.replace_in_file(workspace, 'src/calculator.ts', FIRST_ATTEMPT, REAL_FIX);
        state['tests'] = h.run_vitest(workspace);
        record.recipe_notes.push(
            `real fix applied; re-run verdict=${(state['tests'] as Dict)['verdict'] as string}`,
        );
        return state;
    };

    const onReviewChanges: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['verify'] = h.simulated_review_verdict();
        record.recipe_notes.push('review-changes simulated success');
        return state;
    };

    // The implement gate refuses production work without an observed
    // failing test for the behaviour; the recipe records one, as a
    // compliant agent would after running the new test red.
    const onObserveRed: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['tests'] = {
            ...((state['tests'] as Dict | null) ?? {}),
            red: { behaviour: 'the changed behaviour under test', failure_class: 'missing_target' },
        };
        record.recipe_notes.push('observed RED for the next behaviour');
        return state;
    };

    return {
        'create-plan': onCreatePlan,
        'observe-red': onObserveRed,
        'apply-plan': onApplyPlan,
        'run-tests': onRunTests,
        'review-changes': onReviewChanges,
        'fix-failing-checks': onBadVerdict,
        _no_directive: onBadVerdict,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
