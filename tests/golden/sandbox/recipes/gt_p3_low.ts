/**
 * GT-P3 — prompt-driven low band: one targeted clarifying question (TS twin
 * of gt_p3_low.py).
 *
 * The prompt is too thin to plan against → low band. Cycles: refine-prompt
 * rebound → low BLOCKED halt. The recipe deliberately registers no
 * `_no_directive` step, so the runner stops at `halt_unhandled:_no_directive`
 * (same pattern as GT-2), locking the low-band single-question surface.
 */
import type { RecipeModule } from './index.js';
import * as h from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-P3',
    prompt_relpath: 'prompts/gt-p3-low.txt',
    persona: null,
    cycle_cap: 3,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onRefinePrompt: RecipeStep = (state: Dict, record: CycleRecord) => {
        h.write_prompt_refinement(state, {
            reconstructed_ac: ['needs a clarifying answer about which table is meant'],
            assumptions: [],
        });
        record.recipe_notes.push('refine-prompt rebound: 1 AC + 0 assumptions (deliberately thin)');
        return state;
    };

    return { 'refine-prompt': onRefinePrompt };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
