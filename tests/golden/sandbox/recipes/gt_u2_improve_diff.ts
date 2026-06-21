/**
 * GT-U2 — UI improve via diff: diff input → full UI track (TS twin of
 * gt_u2_improve_diff.py). Same six-step UI chain as GT-U1 but entered via a
 * unified diff (input.kind="diff" → intent="ui-improve" → directive_set="ui").
 * Pure-data recipe.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U2',
    diff_relpath: 'diffs/gt-u2-improve-diff.diff',
    persona: null,
    cycle_cap: 8,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = {
            components_found: [
                {
                    path: 'resources/views/components/forms/text-input.blade.php',
                    name: 'forms.text-input',
                    kind: 'form-primitive',
                    similarity: 0.78,
                },
            ],
            design_tokens: { spacing: ['sm', 'md', 'lg'], color: ['primary', 'muted', 'danger'] },
            audit_path: 'high_confidence',
            candidate_pick: 'forms.text-input',
        };
        record.recipe_notes.push('ui_audit populated: 1 component, audit_path=high_confidence');
        return state;
    };

    const onDesign: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_design'] = {
            layout: 'single-column form, max-w-md, centered',
            components: [{ name: 'ContactForm', primitives: ['forms.text-input', 'button'] }],
            states: {
                empty: 'Initial render: name field empty, submit enabled',
                loading: 'Submit pressed: button shows spinner, field disabled',
                error: 'Validation error: field-level message under input',
                success: 'Form replaced by confirmation card',
                disabled: 'Field disabled while loading state is active',
            },
            microcopy: {
                title: 'Contact us',
                fields: { name: 'Your name' },
                buttons: { submit: 'Send' },
                errors: { name_required: 'Please enter your name.' },
                success: 'Thanks — we will be in touch within one business day.',
            },
            a11y: {
                labels: 'name field has visible label tied via for/id',
                focus: 'first invalid field receives focus on submit error',
                aria_live: 'success card is announced via aria-live=polite',
            },
            reused_from_audit: ['forms.text-input'],
        };
        record.recipe_notes.push('ui_design brief written; microcopy final');
        return state;
    };

    const onNoDirective: RecipeStep = (state: Dict, record: CycleRecord) => {
        let design = state['ui_design'];
        if (typeof design !== 'object' || design === null || Array.isArray(design)) {
            design = {};
            state['ui_design'] = design;
        }
        (design as Dict)['design_confirmed'] = true;
        record.recipe_notes.push('design_confirmed=True (user picked option 1)');
        return state;
    };

    const onApply: RecipeStep = (state: Dict, record: CycleRecord) => {
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['ui_apply'] = {
            summary: 'Contact form refined with locked microcopy and a11y label',
            rendered: { 'resources/views/contact.blade.php': 'Contact us — Your name (labeled), Send.' },
            files: ['resources/views/contact.blade.php'],
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
        'ui-design-brief': onDesign,
        _no_directive: onNoDirective,
        'ui-apply-plain': onApply,
        'ui-design-review-plain': onReview,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
