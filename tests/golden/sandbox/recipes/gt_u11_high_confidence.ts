/**
 * GT-U11 — high-confidence audit halt-budget: exactly 1 halt (TS twin of
 * gt_u11_high_confidence.py). Seeded `ui_audit` (high-confidence shape, no
 * `audit_path` — engine's `_decide_path` records it), rendered `ui_apply`, and
 * clean `ui_review` short-circuit every halt except the `ui-design-brief`
 * directive on cycle 1; the recipe writes the brief *with*
 * `design_confirmed=True` so the sign-off halt is skipped. 1 halt total.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U11',
    prompt_relpath: 'prompts/gt-u11-high-confidence.txt',
    persona: null,
    cycle_cap: 4,
};

export function seedState(_workspace: string): Dict {
    return {
        version: 1,
        input: {
            kind: 'prompt',
            data: {
                raw: 'Add a contact form to the marketing site that matches the existing form primitives.\n',
                reconstructed_ac: [],
                assumptions: [],
                confidence: { band: 'high', score: 0.92 },
                ui_apply: {
                    summary: 'Contact form scaffolded reusing forms.text-input',
                    rendered: {
                        'resources/views/contact.blade.php':
                            'Contact us — Your name, Your email address, How can we help? Send message.',
                    },
                    files: ['resources/views/contact.blade.php'],
                },
            },
        },
        intent: 'ui-build',
        directive_set: 'ui',
        stack: null,
        ui_audit: {
            components_found: [
                {
                    path: 'resources/views/components/forms/text-input.blade.php',
                    name: 'forms.text-input',
                    kind: 'form-primitive',
                    similarity: 0.85,
                },
                {
                    path: 'resources/views/components/forms/textarea.blade.php',
                    name: 'forms.textarea',
                    kind: 'form-primitive',
                    similarity: 0.55,
                },
            ],
            design_tokens: {
                spacing: ['sm', 'md', 'lg'],
                color: ['primary', 'muted', 'danger'],
            },
        },
        ui_design: null,
        ui_review: { findings: [], review_clean: true },
        ui_polish: null,
        contract: null,
        stitch: null,
        persona: 'senior-engineer',
        memory: [],
        plan: null,
        changes: [],
        tests: null,
        verify: null,
        outcomes: {},
        questions: [],
        report: '',
    };
}

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onDesignBrief: RecipeStep = (state: Dict, record: CycleRecord) => {
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
            design_confirmed: true,
        };
        record.recipe_notes.push(
            'ui_design brief written with design_confirmed=True (sign-off halt skipped on the high-confidence path)',
        );
        return state;
    };

    return { 'ui-design-brief': onDesignBrief };
}

const recipe: RecipeModule = { META, buildRecipe, seedState };
export default recipe;
