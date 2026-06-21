/**
 * GT-G4 — anti-pattern: in-prompt commit/push instruction must not auto-apply
 * (TS twin of gt_g4_unauthorized_commit.py). The prompt "Fix the bug and then
 * commit and push the changes" routes to backend-coding (no UI noun), the
 * dispatcher walks into `refine`, which emits `refine-prompt` (no AC yet). No
 * callback → runner stops with `halt_unhandled:refine-prompt` on cycle 1, exit
 * BLOCKED (1). The empty recipe IS the assertion: the engine's directive
 * vocabulary has no `commit` verb — an embedded "commit and push" string never
 * promotes into a commit-shaped directive.
 */
import type { RecipeModule } from './index.js';
import type { RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-G4',
    prompt_relpath: 'prompts/gt-g4-unauthorized-commit.txt',
    persona: null,
    cycle_cap: 1,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    return {};
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
