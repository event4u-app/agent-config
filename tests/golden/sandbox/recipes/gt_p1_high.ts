/**
 * GT-P1 — prompt-driven happy path: high confidence, silent proceed (TS twin
 * of gt_p1_high.py; injected code is TypeScript).
 *
 * Six cycles — the prompt-mode equivalent of GT-1: refine-prompt rebound →
 * create-plan → apply-plan (inject modulo + test) → run-tests → review-changes
 * → report. Locks the silent-proceed contract: a high-band prompt neither
 * halts for assumptions confirmation nor surfaces a clarifying question.
 */
import type { RecipeModule } from './index.js';
import * as h from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-P1',
    prompt_relpath: 'prompts/gt-p1-high.txt',
    persona: null,
    cycle_cap: 7,
};

// JS `%` is remainder (sign of dividend); Python `%` is modulo (sign of
// divisor). The AC pins modulo(-2, 3) === 1, so inject a true-modulo body.
const MODULO_SRC = `

export function modulo(a: number, b: number): number {
    return ((a % b) + b) % b;
}
`;

const MODULO_TEST = `

import { modulo } from '../src/calculator.js';

it('modulo returns remainder', () => {
    expect(modulo(7, 3)).toBe(1);
    expect(modulo(10, 4)).toBe(2);
    expect(modulo(-2, 3)).toBe(1);
});
`;

export function buildRecipe(workspace: string): Record<string, RecipeStep> {
    const onRefinePrompt: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.write_prompt_refinement(state, {
            reconstructed_ac: [
                'modulo(a, b) should return the integer remainder, divisor-signed',
                'when called with modulo(7, 3) it must return 1',
                'when called with modulo(-2, 3) it must return 1 (divisor-signed)',
            ],
            assumptions: [
                'function lives in src/calculator.ts next to add/subtract/power',
                'no behaviour change to existing functions',
            ],
        });
        record.recipe_notes.push('refine-prompt rebound: 3 AC + 2 assumptions');
        return state;
    };

    const onCreatePlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['plan'] = h.standard_plan(
            'Add modulo(a, b)',
            'Append modulo(a: number, b: number): number to src/calculator.ts',
            'Append a modulo test to tests/calculator.test.ts',
            'Run vitest to confirm the new test passes',
        );
        record.recipe_notes.push('plan recorded with 3 steps');
        return state;
    };

    const onApplyPlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.append_to_file(workspace, 'src/calculator.ts', MODULO_SRC);
        h.append_to_file(workspace, 'tests/calculator.test.ts', MODULO_TEST);
        state['changes'] = h.base_changes('src/calculator.ts', 'tests/calculator.test.ts');
        record.recipe_notes.push('appended modulo + modulo test');
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
        'refine-prompt': onRefinePrompt,
        'create-plan': onCreatePlan,
        'apply-plan': onApplyPlan,
        'run-tests': onRunTests,
        'review-changes': onReviewChanges,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
