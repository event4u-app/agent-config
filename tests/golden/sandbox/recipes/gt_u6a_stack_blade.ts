/**
 * GT-U6A — stack dispatch: blade-livewire-flux apply directive (TS twin of
 * gt_u6a_stack_blade.py). Pins ui.apply stack-dispatch: stack.frontend ==
 * "blade-livewire-flux" → `@agent-directive: ui-apply-blade-livewire-flux`.
 * Seeded audit/design/review so the apply directive is the only halt.
 */
import type { RecipeModule } from './index.js';
import { stack_state } from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U6A',
    prompt_relpath: 'prompts/gt-u6-stack-dispatch.txt',
    persona: null,
    cycle_cap: 4,
};

export function seedState(_workspace: string): Dict {
    return {
        version: 1,
        input: {
            kind: 'prompt',
            data: {
                raw: 'Add an empty-state component to the dashboard sidebar.\n',
                reconstructed_ac: [
                    'Empty-state shown when the sidebar list is empty',
                    'Reuses the existing illustration + heading primitives',
                ],
                assumptions: ['sidebar already supports a slot for empty content'],
                confidence: { band: 'high', score: 0.9 },
                acceptance_criteria: [
                    'Empty-state shown when the sidebar list is empty',
                    'Reuses the existing illustration + heading primitives',
                ],
            },
        },
        intent: 'ui-build',
        directive_set: 'ui',
        stack: stack_state({ frontend: 'blade-livewire-flux', php_framework: 'laravel' }),
        ui_audit: {
            components_found: [
                {
                    path: 'resources/views/components/empty-state.blade.php',
                    name: 'empty-state',
                    kind: 'ui-primitive',
                    similarity: 0.78,
                },
            ],
            design_tokens: { spacing: ['sm', 'md', 'lg'] },
            audit_path: 'high_confidence',
        },
        ui_design: {
            layout: 'sidebar empty-state slot, vertically centered',
            components: [{ name: 'SidebarEmptyState', primitives: ['empty-state', 'icon'] }],
            states: {
                empty: 'illustration + heading + body copy + primary action',
                loading: 'skeleton placeholder while sidebar loads',
                error: 'fallback message with retry action',
                success: 'list renders normally, empty-state hidden',
                disabled: 'n/a — empty-state never disabled',
            },
            microcopy: {
                heading: 'Nothing here yet',
                body: 'Items you create will appear in this list.',
                primary_action: 'Create one',
            },
            a11y: { role: 'status', aria_live: 'polite', focus_target: 'primary_action' },
            reused_from_audit: ['empty-state'],
            design_confirmed: true,
        },
        ui_review: { findings: [], review_clean: true, preview: { render_ok: true } },
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
    const onApply: RecipeStep = (state: Dict, record: CycleRecord) => {
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['ui_apply'] = {
            summary: 'Sidebar empty-state rendered as Flux + Livewire component',
            rendered: {
                'resources/views/livewire/sidebar-empty-state.blade.php':
                    '<flux:card class="text-center"><x-icon name="inbox" class="mx-auto h-12 w-12" />' +
                    '<flux:heading size="sm">Nothing here yet</flux:heading>' +
                    '<flux:subheading>Items you create will appear in this list.</flux:subheading>' +
                    '<flux:button wire:click="create">Create one</flux:button></flux:card>',
                'app/Livewire/Sidebar/EmptyState.php':
                    'namespace App\\Livewire\\Sidebar; use Livewire\\Component; ' +
                    'class EmptyState extends Component { public function create(): void {} ' +
                    "public function render() { return view('livewire.sidebar-empty-state'); } }",
            },
            files: [
                'resources/views/livewire/sidebar-empty-state.blade.php',
                'app/Livewire/Sidebar/EmptyState.php',
            ],
        };
        record.recipe_notes.push(
            'ui_apply envelope written for blade-livewire-flux stack (2 files: Livewire component + Flux blade view)',
        );
        return state;
    };

    return { 'ui-apply-blade-livewire-flux': onApply };
}

const recipe: RecipeModule = { META, buildRecipe, seedState };
export default recipe;
