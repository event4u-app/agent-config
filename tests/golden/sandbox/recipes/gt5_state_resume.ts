/**
 * GT-5 — state-resume: continue from disk after a SIGTERM-style stop (TS twin
 * of gt5_state_resume.py).
 *
 * The recipe content matches GT-1 in shape (here: `negate`); the value of
 * GT-5 is the segmentation, which lives in the capture driver via
 * `resume_after_directive`. In replay the runner already omits the input flag
 * after cycle 1 (resume from the persisted state file is the default), so a
 * single `run_capture` exercises the resume contract transparently.
 */
import type { RecipeModule } from './index.js';
import * as h from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-5',
    ticket_relpath: 'tickets/gt-5-state-resume.json',
    persona: null,
    cycle_cap: 6,
    resume_after_directive: 'apply-plan',
};

const NEGATE_SRC = `

export function negate(a: number): number {
    return -a;
}
`;

// Note: negate(0) returns -0 in JS, and vitest's toBe uses Object.is, so
// `toBe(0)` would fail on -0 (Python's `== 0` did not). The scenario's value
// is the resume segmentation, not the zero edge, so the assertions use
// non-zero inputs.
const NEGATE_TEST = `

import { negate } from '../src/calculator.js';

it('negate returns negation', () => {
    expect(negate(7)).toBe(-7);
    expect(negate(-7)).toBe(7);
    expect(negate(3)).toBe(-3);
});
`;

export function buildRecipe(workspace: string): Record<string, RecipeStep> {
    const onCreatePlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['plan'] = h.standard_plan(
            'Add negate(a)',
            'Append negate(a: number): number to src/calculator.ts',
            'Append a negate test to tests/calculator.test.ts',
            'Run vitest to confirm both edge cases pass',
        );
        record.recipe_notes.push('plan recorded');
        return state;
    };

    const onApplyPlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.append_to_file(workspace, 'src/calculator.ts', NEGATE_SRC);
        h.append_to_file(workspace, 'tests/calculator.test.ts', NEGATE_TEST);
        state['changes'] = h.base_changes('src/calculator.ts', 'tests/calculator.test.ts');
        record.recipe_notes.push('negate + test appended');
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
