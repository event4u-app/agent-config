/**
 * GT-U6B — stack dispatch: react-shadcn apply directive (TS twin of
 * gt_u6b_stack_react.py). Sister of GT-U6A; identical seed except
 * stack.frontend == "react-shadcn" → `@agent-directive: ui-apply-react-shadcn`.
 */
import type { RecipeModule } from './index.js';
import { stack_state } from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U6B',
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
        stack: stack_state({ frontend: 'react-shadcn', php_framework: null }),
        ui_audit: {
            components_found: [
                { path: 'src/components/ui/empty-state.tsx', name: 'EmptyState', kind: 'ui-primitive', similarity: 0.78 },
            ],
            design_tokens: { spacing: ['sm', 'md', 'lg'] },
            audit_path: 'high_confidence',
        },
        ui_design: {
            layout: 'sidebar empty-state slot, vertically centered',
            components: [{ name: 'SidebarEmptyState', primitives: ['EmptyState', 'Icon'] }],
            states: {
                empty: 'illustration + heading + body copy + primary action',
                loading: 'Skeleton placeholder while sidebar loads',
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
            reused_from_audit: ['EmptyState'],
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
            summary: 'Sidebar empty-state rendered as React + shadcn-ui component',
            rendered: {
                'src/components/sidebar/empty-state.tsx':
                    'import { Card, CardContent } from "@/components/ui/card"; ' +
                    'import { Button } from "@/components/ui/button"; ' +
                    'import { Inbox } from "lucide-react"; ' +
                    'export function SidebarEmptyState() { return (<Card className="text-center">' +
                    '<CardContent className="py-8"><Inbox className="mx-auto h-12 w-12 text-muted-foreground" />' +
                    '<h3 className="mt-2 text-sm font-medium">Nothing here yet</h3>' +
                    '<p className="mt-1 text-sm text-muted-foreground">Items you create will appear in this list.</p>' +
                    '<Button className="mt-4">Create one</Button></CardContent></Card>); }',
            },
            files: ['src/components/sidebar/empty-state.tsx'],
        };
        record.recipe_notes.push(
            'ui_apply envelope written for react-shadcn stack (1 file: TSX component using Card + Button primitives)',
        );
        return state;
    };

    return { 'ui-apply-react-shadcn': onApply };
}

const recipe: RecipeModule = { META, buildRecipe, seedState };
export default recipe;
