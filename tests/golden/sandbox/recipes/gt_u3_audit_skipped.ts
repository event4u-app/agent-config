/**
 * GT-U3 — audit-skipped rejection: gate refuses to advance on a structurally
 * invalid audit envelope (TS twin of gt_u3_audit_skipped.py).
 *
 * The recipe writes a plausible-looking but invalid `ui_audit` (audit_path set,
 * no components_found / components / greenfield). `_is_populated` validates
 * shape, so the engine re-emits `existing-ui-audit` every cycle until the cap
 * trips (`cycle_cap_reached`, exit 1). Only `existing-ui-audit` is wired.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U3',
    prompt_relpath: 'prompts/gt-u3-audit-skipped.txt',
    persona: null,
    cycle_cap: 3,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = { audit_path: 'high_confidence', skipped_by_user: true };
        record.recipe_notes.push(
            'ui_audit set with audit_path but no components_found / components / greenfield — gate must re-halt',
        );
        return state;
    };

    return { 'existing-ui-audit': onAudit };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
