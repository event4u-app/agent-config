/**
 * GT-4 — advisory persona refusal: plan-only, no edits (TS twin of
 * gt4_persona_refusal.py).
 *
 * The advisory persona policy short-circuits implement / test / verify to
 * SUCCESS without doing work, so the capture exercises only one halt
 * (`create-plan`) before the engine walks straight to the report step.
 *
 * Cycle storyboard:
 *   1. create-plan halt → recipe sets state.plan
 *   2. report runs      → engine exits 0 with a plan-only delivery report
 */
import type { RecipeModule } from './index.js';
import * as h from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-4',
    ticket_relpath: 'tickets/gt-4-persona-refusal.json',
    persona: 'advisory',
    cycle_cap: 3,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onCreatePlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['plan'] = h.standard_plan(
            'Outline modulo(a, b)',
            'Signature: modulo(a: number, b: number): number',
            'Edge cases: throw when b === 0',
            'Test: a modulo test pinning the zero-divisor throw',
        );
        record.recipe_notes.push('advisory plan recorded; no edits will follow');
        return state;
    };

    return { 'create-plan': onCreatePlan };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
