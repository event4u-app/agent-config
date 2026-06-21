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
 *   4. bad-verdict halt    → recipe applies the real fix, re-runs vitest
 *      (success), updates state.tests
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

    // The only no-directive halt in this recipe is the bad-verdict surface.
    // Apply the real fix, re-run vitest.
    const onNoDirective: RecipeStep = (state: Dict, record: CycleRecord) => {
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

    return {
        'create-plan': onCreatePlan,
        'apply-plan': onApplyPlan,
        'run-tests': onRunTests,
        'review-changes': onReviewChanges,
        _no_directive: onNoDirective,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
