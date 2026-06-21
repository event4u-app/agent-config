/**
 * GT-1 — happy path: add `multiply` to the toy calculator (TS twin of the
 * retired gt1_happy.py; the injected source/test are now TypeScript).
 *
 * Five cycles total:
 *   1. create-plan halt   → recipe sets state.plan
 *   2. apply-plan halt    → recipe writes source + test, sets state.changes
 *   3. run-tests halt     → recipe runs vitest, sets state.tests (success)
 *   4. review-changes halt→ recipe sets state.verify (success)
 *   5. report runs        → engine exits 0 with the delivery report
 */
import type { RecipeModule } from './index.js';
import * as h from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-1',
    ticket_relpath: 'tickets/gt-1-happy.json',
    persona: null,
    cycle_cap: 6,
};

const MULTIPLY_SRC = `

export function multiply(a: number, b: number): number {
    return a * b;
}
`;

const MULTIPLY_TEST = `

import { multiply } from '../src/calculator.js';

it('multiply returns product', () => {
    expect(multiply(3, 4)).toBe(12);
    expect(multiply(0, 5)).toBe(0);
    expect(multiply(-2, 3)).toBe(-6);
});
`;

export function buildRecipe(workspace: string): Record<string, RecipeStep> {
    const onCreatePlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['plan'] = h.standard_plan(
            'Add multiply(a, b)',
            'Append multiply(a: number, b: number): number to src/calculator.ts',
            'Append a multiply test to tests/calculator.test.ts',
            'Run vitest to confirm the new test passes',
        );
        record.recipe_notes.push('plan recorded with 3 steps');
        return state;
    };

    const onApplyPlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.append_to_file(workspace, 'src/calculator.ts', MULTIPLY_SRC);
        h.append_to_file(workspace, 'tests/calculator.test.ts', MULTIPLY_TEST);
        state['changes'] = h.base_changes('src/calculator.ts', 'tests/calculator.test.ts');
        record.recipe_notes.push('appended multiply + multiply test');
        return state;
    };

    const onRunTests: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['tests'] = h.run_vitest(workspace);
        record.recipe_notes.push(`vitest verdict=${(state['tests'] as Dict)['verdict'] as string}`);
        return state;
    };

    const onReviewChanges: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['verify'] = h.simulated_review_verdict();
        record.recipe_notes.push('review-changes simulated success');
        return state;
    };

    return {
        'create-plan': onCreatePlan,
        'apply-plan': onApplyPlan,
        'run-tests': onRunTests,
        'review-changes': onReviewChanges,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
