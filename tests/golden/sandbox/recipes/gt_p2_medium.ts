/**
 * GT-P2 — prompt-driven medium band: assumptions confirmation halt (TS twin
 * of gt_p2_medium.py).
 *
 * The prompt scores `medium` and halts PARTIAL with the assumptions report.
 * Cycles: refine-prompt rebound → medium PARTIAL halt (no directive →
 * `_no_directive` flips `confidence_confirmed`) → create-plan → apply-plan
 * (rewrite the power docstring, no behaviour change) → run-tests → review →
 * report. Locks: medium halts emit the assumptions report once and release on
 * `confidence_confirmed=true` without a re-score.
 */
import type { RecipeModule } from './index.js';
import * as h from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-P2',
    prompt_relpath: 'prompts/gt-p2-medium.txt',
    persona: null,
    cycle_cap: 8,
};

const OLD_DOCSTRING = '/** Buggy stub — see GT-3 recovery recipe for the fix. */';
const NEW_DOCSTRING =
    '/** Return `a` raised to `b`. Uses Math.abs(a) and is sign-incomplete for odd exponents (tracked by GT-3). */';

export function buildRecipe(workspace: string): Record<string, RecipeStep> {
    const onRefinePrompt: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.write_prompt_refinement(state, {
            reconstructed_ac: [
                'should preserve the public signature of power(a, b)',
                'must keep the positive-base power test green after the edit',
            ],
            assumptions: ['touches src/calculator.ts only', 'no behaviour change intended; docstring tightening'],
        });
        record.recipe_notes.push('refine-prompt rebound: 2 AC + 2 assumptions');
        return state;
    };

    // Medium-band assumptions-report halt — release the gate.
    const onNoDirective: RecipeStep = (state: Dict, record: CycleRecord) => {
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['confidence_confirmed'] = true;
        record.recipe_notes.push('medium gate released: confidence_confirmed=true');
        return state;
    };

    const onCreatePlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['plan'] = h.standard_plan(
            'Tighten power() docstring',
            'Replace the placeholder docstring on src/calculator.ts::power',
            'Re-run vitest to confirm the positive-base power test stays green',
        );
        record.recipe_notes.push('plan recorded with 2 steps');
        return state;
    };

    const onApplyPlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.replace_in_file(workspace, 'src/calculator.ts', OLD_DOCSTRING, NEW_DOCSTRING);
        state['changes'] = h.base_changes('src/calculator.ts');
        record.recipe_notes.push('rewrote power() docstring (no behaviour change)');
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
        _no_directive: onNoDirective,
        'create-plan': onCreatePlan,
        'apply-plan': onApplyPlan,
        'run-tests': onRunTests,
        'review-changes': onReviewChanges,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
