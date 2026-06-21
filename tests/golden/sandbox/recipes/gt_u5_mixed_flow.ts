/**
 * GT-U5 — mixed flow orchestration: contract → ui-track → stitch (TS twin of
 * gt_u5_mixed_flow.py). Pure-data recipe with a seeded state.
 *
 * `seedState` pre-populates a v1 state (refine/memory/analyze already
 * successful) so cycle 1 starts at the mixed.contract plan. Five halts:
 * contract-plan → _no_directive (contract confirm) → ui-track →
 * integration-test → review-changes → report exit 0.
 */
import type { RecipeModule } from './index.js';
import { base_changes, mixed_contract, simulated_review_verdict } from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U5',
    prompt_relpath: 'prompts/gt-u5-mixed-flow.txt',
    persona: null,
    cycle_cap: 8,
};

export function seedState(_workspace: string): Dict {
    return {
        version: 1,
        input: {
            kind: 'prompt',
            data: {
                raw:
                    'Add a customer feedback form: POST /api/feedback persists to a `feedbacks` ' +
                    'table, render the form on `/feedback` with a success state.\n',
                reconstructed_ac: [
                    'POST /api/feedback validates payload and persists to feedbacks',
                    'GET /feedback renders a form bound to forms.text-input',
                    'Successful submission swaps the form for a confirmation card',
                ],
                assumptions: [
                    'feedbacks table is new; migration ships with this change',
                    'no admin moderation flow in this iteration',
                ],
                confidence: { band: 'high', score: 0.91 },
                acceptance_criteria: [
                    'POST /api/feedback validates payload and persists to feedbacks',
                    'GET /feedback renders a form bound to forms.text-input',
                    'Successful submission swaps the form for a confirmation card',
                ],
            },
        },
        intent: 'mixed',
        directive_set: 'mixed',
        stack: null,
        ui_audit: null,
        ui_design: null,
        ui_review: null,
        ui_polish: null,
        contract: null,
        stitch: null,
        persona: 'senior-engineer',
        memory: [],
        plan: null,
        changes: [],
        tests: null,
        verify: null,
        outcomes: { refine: 'success', memory: 'success', analyze: 'success' },
        questions: [],
        report: '',
    };
}

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onContractPlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['contract'] = mixed_contract({
            data_model: [
                {
                    entity: 'Feedback',
                    table: 'feedbacks',
                    fields: [
                        { name: 'id', type: 'uuid', primary: true },
                        { name: 'name', type: 'string', required: true },
                        { name: 'email', type: 'email', required: true },
                        { name: 'message', type: 'text', required: true },
                        { name: 'created_at', type: 'datetime' },
                    ],
                },
            ],
            api_surface: [
                {
                    method: 'POST',
                    path: '/api/feedback',
                    request: ['name', 'email', 'message'],
                    response: { '201': 'FeedbackResource', '422': 'ValidationError' },
                },
                { method: 'GET', path: '/feedback', response: { '200': 'feedback.show view' } },
            ],
            confirmed: false,
        });
        record.recipe_notes.push('contract written: 1 entity (Feedback), 2 endpoints; awaiting confirmation');
        return state;
    };

    const onContractConfirm: RecipeStep = (state: Dict, record: CycleRecord) => {
        const contract = (state['contract'] as Dict | undefined) ?? {};
        contract['contract_confirmed'] = true;
        state['contract'] = contract;
        record.recipe_notes.push('contract_confirmed=True (sign-off halt resolved)');
        return state;
    };

    const onUiTrack: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_review'] = { findings: [], review_clean: true };
        state['ui_audit'] = {
            components_found: [
                {
                    path: 'resources/views/components/forms/text-input.blade.php',
                    name: 'forms.text-input',
                    kind: 'form-primitive',
                    similarity: 0.82,
                },
            ],
            design_tokens: { spacing: ['sm', 'md', 'lg'] },
        };
        state['ui_design'] = {
            layout: 'single-column form on /feedback, max-w-md',
            components: [{ name: 'FeedbackForm', primitives: ['forms.text-input', 'button'] }],
            states: {
                empty: 'fields empty, submit disabled until valid',
                loading: 'submit pressed: spinner, fields disabled',
                error: 'field-level validation messages',
                success: 'form replaced by confirmation card',
                disabled: 'fields disabled while loading',
            },
            reused_from_audit: ['forms.text-input'],
            design_confirmed: true,
        };
        state['changes'] = base_changes(
            'app/Http/Controllers/FeedbackController.php',
            'app/Models/Feedback.php',
            'database/migrations/2026_05_01_create_feedbacks_table.php',
            'resources/views/feedback/show.blade.php',
            'routes/web.php',
        );
        record.recipe_notes.push(
            'ui-track returned clean; 5 changes recorded (controller, model, migration, view, route)',
        );
        return state;
    };

    const onIntegrationTest: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['stitch'] = {
            verdict: 'success',
            scenarios: [
                { name: 'happy: submit feedback round-trips to confirmation', outcome: 'passed' },
                { name: 'validation: empty payload returns 422 with field errors', outcome: 'passed' },
            ],
        };
        record.recipe_notes.push('stitch verdict=success across 2 scenarios (happy + validation)');
        return state;
    };

    const onReviewChanges: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['verify'] = simulated_review_verdict();
        record.recipe_notes.push('review-changes simulated success (4 judges, no findings)');
        return state;
    };

    return {
        'contract-plan': onContractPlan,
        _no_directive: onContractConfirm,
        'ui-track': onUiTrack,
        'integration-test': onIntegrationTest,
        'review-changes': onReviewChanges,
    };
}

const recipe: RecipeModule = { META, buildRecipe, seedState };
export default recipe;
