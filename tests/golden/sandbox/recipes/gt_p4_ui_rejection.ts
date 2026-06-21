/**
 * GT-P4 — UI prompt halts at the existing-UI-audit gate (TS twin of
 * gt_p4_ui_rejection.py).
 *
 * A UI-shaped prompt routes to `directive_set="ui"`; `ui.refine` is the
 * mandatory audit gate. With `state.ui_audit` unset, the handler emits
 * `@agent-directive: existing-ui-audit` and halts. The recipe registers no
 * callback for it → the runner stops at `halt_unhandled:existing-ui-audit` on
 * cycle 1, locking the directive-halt bytes. (Later GT-U recipes satisfy the
 * audit end to end.)
 */
import type { RecipeModule } from './index.js';
import type { RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-P4',
    prompt_relpath: 'prompts/gt-p4-ui-rejection.txt',
    persona: null,
    cycle_cap: 1,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    return {};
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
