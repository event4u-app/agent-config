/**
 * GT-U12 — ambiguous audit halt-budget: exactly 2 halts (TS twin of
 * gt_u12_ambiguous.py). Counterpart to GT-U11: seeded `ui_audit` with three
 * close candidates + `confidence.band="medium"` → `_decide_path` returns
 * "ambiguous" and emits the candidate-pick halt; a seeded-but-unconfirmed
 * `ui_design` brief halts on the design summary. `_no_directive` is shared by
 * both halts, discriminated on whether `audit_path` is set yet. 2 halts total.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U12',
    prompt_relpath: 'prompts/gt-u12-ambiguous.txt',
    persona: null,
    cycle_cap: 4,
};

export function seedState(_workspace: string): Dict {
    return {
        version: 1,
        input: {
            kind: 'prompt',
            data: {
                raw: 'Improve the form layout — make it look better and feel more consistent with what we already have.\n',
                reconstructed_ac: [],
                assumptions: [],
                confidence: { band: 'medium', score: 0.55 },
                ui_apply: {
                    summary: 'Form layout improvements applied to the extended primitive',
                    rendered: {
                        'resources/views/components/forms/labeled-input.blade.php':
                            'Polished labeled-input variant — tightened spacing, consistent label weight, focus ring tokenized.',
                    },
                    files: ['resources/views/components/forms/labeled-input.blade.php'],
                },
            },
        },
        intent: 'ui-improve',
        directive_set: 'ui',
        stack: null,
        ui_audit: {
            components_found: [
                {
                    path: 'resources/views/components/forms/labeled-input.blade.php',
                    name: 'forms.labeled-input',
                    kind: 'form-primitive',
                    similarity: 0.62,
                },
                {
                    path: 'resources/views/components/forms/stacked-input.blade.php',
                    name: 'forms.stacked-input',
                    kind: 'form-primitive',
                    similarity: 0.60,
                },
                {
                    path: 'resources/views/components/forms/compact-input.blade.php',
                    name: 'forms.compact-input',
                    kind: 'form-primitive',
                    similarity: 0.58,
                },
            ],
            design_tokens: {
                spacing: ['sm', 'md', 'lg'],
                color: ['primary', 'muted', 'danger'],
            },
        },
        ui_design: {
            layout: 'stacked form fields, max-w-md, label-on-top, consistent vertical rhythm',
            components: [{ name: 'FormLayout', primitives: ['forms.labeled-input', 'button'] }],
            states: {
                empty: 'Initial render: fields empty, submit enabled',
                loading: 'Submit pressed: button shows spinner, fields disabled',
                error: 'Validation error: field-level message under each input',
                success: 'Form replaced by confirmation card',
                disabled: 'Fields disabled while loading state is active',
            },
            microcopy: {
                title: 'Update your details',
                fields: { name: 'Full name', email: 'Email address' },
                buttons: { submit: 'Save changes' },
                errors: {
                    name_required: 'Please enter your name.',
                    email_invalid: 'Enter a valid email address.',
                },
                success: 'Saved — your details are up to date.',
            },
            a11y: {
                labels: 'every field has a visible label tied via for/id',
                focus: 'first invalid field receives focus on submit error',
                aria_live: 'success card is announced via aria-live=polite',
            },
            reused_from_audit: ['forms.labeled-input'],
        },
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
    const onNoDirective: RecipeStep = (state: Dict, record: CycleRecord) => {
        const audit = (state['ui_audit'] ??= {}) as Dict;
        if (!audit['audit_path']) {
            audit['audit_path'] = 'ambiguous';
            audit['candidate_pick'] = 'forms.labeled-input';
            record.recipe_notes.push(
                'audit_path=ambiguous, candidate_pick=forms.labeled-input (user picked option 1 — strongest similarity)',
            );
            return state;
        }
        const design = (state['ui_design'] ??= {}) as Dict;
        design['design_confirmed'] = true;
        record.recipe_notes.push('design_confirmed=True (user signed off on the brief summary)');
        return state;
    };

    return { _no_directive: onNoDirective };
}

const recipe: RecipeModule = { META, buildRecipe, seedState };
export default recipe;
