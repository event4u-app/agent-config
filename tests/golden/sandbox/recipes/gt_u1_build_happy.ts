/**
 * GT-U1 — UI build happy path: full audit→design→apply→review chain (TS twin
 * of gt_u1_build_happy.py). Pure-data recipe — writes state envelopes
 * (ui_audit / ui_design / ui_apply / ui_review); no toy-repo file ops.
 *
 * Six cycles: existing-ui-audit → ui-design-brief → _no_directive (design
 * confirm) → ui-apply-plain → ui-design-review-plain (clean) → report exit 0.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U1',
    prompt_relpath: 'prompts/gt-u1-build-happy.txt',
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
                    similarity: 0.82,
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
                empty: 'Initial render: all fields empty, submit disabled',
                loading: 'Submit pressed: button shows spinner, fields disabled',
                error: 'Validation or server error: field-level messages',
                success: 'Form replaced by confirmation card',
                disabled: 'Fields disabled while loading state is active',
            },
            microcopy: {
                title: 'Contact us',
                fields: { name: 'Your name', email: 'Your email address', message: 'How can we help?' },
                buttons: { submit: 'Send message' },
                errors: {
                    name_required: 'Please enter your name.',
                    email_invalid: 'Enter a valid email address.',
                    message_required: 'Please enter a message.',
                },
                success: 'Thanks — we will be in touch within one business day.',
            },
            a11y: {
                labels: 'every field has a visible label tied via for/id',
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
            summary: 'Contact form scaffolded with locked microcopy',
            rendered: {
                'resources/views/contact.blade.php':
                    'Contact us — Your name, Your email address, How can we help? Send message.',
                'app/Http/Controllers/ContactController.php':
                    'store: validate name/email/message, dispatch mail, return success view.',
            },
            files: [
                'resources/views/contact.blade.php',
                'app/Http/Controllers/ContactController.php',
            ],
        };
        record.recipe_notes.push('ui_apply envelope written: 2 files');
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
