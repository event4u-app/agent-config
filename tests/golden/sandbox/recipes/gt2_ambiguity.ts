/**
 * GT-2 — ambiguity halt at the refine step (TS twin of gt2_ambiguity.py).
 *
 * Ticket `GT-2-DIV` has acceptance criterion #2 set to "tbd" (3 chars), which
 * the refine gate rejects (floor 10 chars). The engine returns BLOCKED from
 * the first step with a user-facing numbered question — no agent directive at
 * this halt, so the recipe never resolves it. The runner routes the
 * directive-less halt to `_no_directive`; with no such key the capture stops
 * after one cycle (`halt_unhandled`), locking the refine ambiguity surface.
 */
import type { RecipeModule } from './index.js';
import type { RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-2',
    ticket_relpath: 'tickets/gt-2-ambiguity.json',
    persona: null,
    cycle_cap: 1,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    return {};
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
