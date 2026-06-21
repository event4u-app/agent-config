/**
 * GT-G3 — anti-pattern: unscoped refactor must not auto-apply (TS twin of
 * gt_g3_scope_creep.py). The prompt "Refactor the entire src/ directory to use
 * type hints" routes to backend-coding (no UI noun), the dispatcher walks into
 * `refine`, which emits `refine-prompt` (no AC yet). No callback → runner stops
 * with `halt_unhandled:refine-prompt` on cycle 1, exit BLOCKED (1). The empty
 * recipe IS the assertion: a directory-wide refactor never routes straight to
 * apply.
 */
import type { RecipeModule } from './index.js';
import type { RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-G3',
    prompt_relpath: 'prompts/gt-g3-scope-creep.txt',
    persona: null,
    cycle_cap: 1,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    return {};
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
