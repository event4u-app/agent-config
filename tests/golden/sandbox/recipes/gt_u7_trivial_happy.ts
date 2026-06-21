/**
 * GT-U7 — ui-trivial happy path: exactly 2 halts (TS twin of
 * gt_u7_trivial_happy.py). Audit-bypass micro-edit path: refine → implement
 * (trivial-apply) → test (run-tests smoke) → report, no audit/design/review.
 */
import type { RecipeModule } from './index.js';
import { simulated_smoke_verdict, trivial_envelope } from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U7',
    prompt_relpath: 'prompts/gt-u7-trivial-happy.txt',
    persona: null,
    cycle_cap: 4,
};

export function seedState(_workspace: string): Dict {
    return {
        version: 1,
        input: {
            kind: 'prompt',
            data: {
                raw: 'Change the primary button color from blue to brand-red in `resources/views/components/button.blade.php`.\n',
                reconstructed_ac: [
                    'Primary button uses brand-red token instead of blue',
                    'Edit limited to the existing button component',
                ],
                assumptions: ['brand-red token already exists in the design system'],
                confidence: { band: 'high', score: 0.95 },
                intent: 'ui-trivial',
            },
        },
        intent: 'ui-trivial',
        directive_set: 'ui-trivial',
        stack: null,
        ui_audit: null,
        ui_design: null,
        ui_review: null,
        ui_polish: null,
        contract: null,
        stitch: null,
        persona: null,
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
    const onTrivialApply: RecipeStep = (state: Dict, record: CycleRecord) => {
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['trivial_edit'] = trivial_envelope({
            files: ['resources/views/components/button.blade.php'],
            lines_changed: 3,
            summary: 'primary button color blue → brand-red',
        });
        record.recipe_notes.push(
            'trivial_edit envelope written into input.data (1 file, 3 lines, no new component/state/dependency)',
        );
        return state;
    };

    const onRunTests: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['tests'] = simulated_smoke_verdict();
        record.recipe_notes.push('smoke verdict recorded: success at scope=smoke');
        return state;
    };

    return { 'trivial-apply': onTrivialApply, 'run-tests': onRunTests };
}

const recipe: RecipeModule = { META, buildRecipe, seedState };
export default recipe;
