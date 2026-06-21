/**
 * GT-U10 — greenfield audit halt → user picks `bare` (TS twin of
 * gt_u10_greenfield_bare.py). Sibling of GT-U9 with the user picking option 2
 * (bare): audit greenfield → decision=bare → design → confirm → apply →
 * review → report. `_no_directive` shared by greenfield + design-confirm.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U10',
    prompt_relpath: 'prompts/gt-u10-greenfield-bare.txt',
    persona: null,
    cycle_cap: 8,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = { greenfield: true, components_found: [], design_tokens: {} };
        record.recipe_notes.push('ui_audit populated: greenfield=True, no components, no decision');
        return state;
    };

    const onNoDirective: RecipeStep = (state: Dict, record: CycleRecord) => {
        const audit = state['ui_audit'];
        if (
            typeof audit === 'object' && audit !== null && !Array.isArray(audit) &&
            (audit as Dict)['greenfield'] === true && !(audit as Dict)['greenfield_decision']
        ) {
            (audit as Dict)['greenfield_decision'] = 'bare';
            record.recipe_notes.push('greenfield_decision=bare (user picked option 2)');
            return state;
        }
        let design = state['ui_design'];
        if (typeof design !== 'object' || design === null || Array.isArray(design)) {
            design = {};
            state['ui_design'] = design;
        }
        (design as Dict)['design_confirmed'] = true;
        record.recipe_notes.push('design_confirmed=True (user picked option 1)');
        return state;
    };

    const onDesign: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_design'] = {
            layout: 'single-column demo page, max-w-3xl, header + body',
            components: [{ name: 'DemoPage', primitives: ['heading', 'paragraph'] }],
            states: {
                empty: 'Initial render with heading and body copy',
                loading: 'n/a — static page',
                error: 'n/a — static page',
                success: 'n/a — static page',
                disabled: 'n/a — static page',
            },
            microcopy: { title: 'Internal showcase demo', body: "Throwaway page for next week's review." },
            a11y: { labels: 'h1 carries the page title', focus: 'default browser focus order', aria_live: 'n/a' },
            reused_from_audit: [],
        };
        record.recipe_notes.push('ui_design brief written for bare demo page');
        return state;
    };

    const onApply: RecipeStep = (state: Dict, record: CycleRecord) => {
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['ui_apply'] = {
            summary: 'Bare demo page scaffolded with Tailwind defaults',
            rendered: {
                'resources/views/demo/showcase.blade.php':
                    "Internal showcase demo. Throwaway page for next week's review.",
            },
            files: ['resources/views/demo/showcase.blade.php'],
        };
        record.recipe_notes.push('ui_apply envelope written: 1 file');
        return state;
    };

    const onReview: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_review'] = { findings: [], review_clean: true };
        record.recipe_notes.push('ui_review clean: 0 findings, review_clean=True');
        return state;
    };

    return {
        'existing-ui-audit': onAudit,
        _no_directive: onNoDirective,
        'ui-design-brief': onDesign,
        'ui-apply-plain': onApply,
        'ui-design-review-plain': onReview,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
