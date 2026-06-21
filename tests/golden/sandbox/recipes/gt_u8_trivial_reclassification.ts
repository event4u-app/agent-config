/**
 * GT-U8 — ui-trivial reclassification: violations promote to `ui` (TS twin of
 * gt_u8_trivial_reclassification.py). A violating trivial-apply envelope (>1
 * file / >5 lines) triggers `reclassify-to-ui-improve`; the recipe promotes
 * directive_set=ui, clears outcomes, then runs the full audit→…→review track.
 */
import type { RecipeModule } from './index.js';
import { trivial_envelope } from './_helpers.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U8',
    prompt_relpath: 'prompts/gt-u8-trivial-reclassification.txt',
    persona: null,
    cycle_cap: 8,
};

export function seedState(_workspace: string): Dict {
    return {
        version: 1,
        input: {
            kind: 'prompt',
            data: {
                raw: 'Tweak the marketing hero copy and align the CTA button color to the new brand-red token.\n',
                reconstructed_ac: [
                    "Hero headline reads 'Welcome to the next chapter'",
                    'CTA button uses brand-red token',
                ],
                assumptions: ['brand-red token already exists', 'edit fits the trivial path'],
                confidence: { band: 'high', score: 0.9 },
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
            files: [
                'resources/views/marketing/hero.blade.php',
                'resources/views/components/button.blade.php',
            ],
            lines_changed: 7,
            summary: 'hero copy + CTA button color (touches 2 files / 7 lines)',
        });
        record.recipe_notes.push('violating trivial_edit written: 2 files (>1), 7 lines (>5)');
        return state;
    };

    const onReclassify: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['directive_set'] = 'ui';
        state['intent'] = 'ui-improve';
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['intent'] = 'ui-improve';
        delete data['trivial_edit'];
        delete data['__reclassify_to__'];
        state['outcomes'] = {};
        record.recipe_notes.push(
            'promoted directive_set=ui, intent=ui-improve, outcomes cleared so audit gate runs from scratch',
        );
        return state;
    };

    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = {
            components_found: [
                { path: 'resources/views/components/button.blade.php', name: 'button', kind: 'ui-primitive', similarity: 0.82 },
            ],
            design_tokens: { spacing: ['sm', 'md', 'lg'], color: ['primary', 'muted', 'danger', 'brand-red'] },
            audit_path: 'high_confidence',
            candidate_pick: 'button',
        };
        record.recipe_notes.push('ui_audit populated: 1 component, audit_path=high_confidence');
        return state;
    };

    const onDesign: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_design'] = {
            layout: 'marketing hero band, full-width, single CTA',
            components: [{ name: 'Hero', primitives: ['button'] }],
            states: {
                empty: 'Headline + subhead + CTA rendered',
                loading: 'n/a — static surface',
                error: 'n/a — static surface',
                success: 'n/a — static surface',
                disabled: 'n/a — static surface',
            },
            microcopy: { title: 'Welcome to the next chapter', buttons: { submit: 'Get started' } },
            a11y: {
                labels: "CTA carries accessible name 'Get started'",
                focus: 'CTA receives focus on tab order entry',
                aria_live: 'n/a — static surface',
            },
            reused_from_audit: ['button'],
            design_confirmed: true,
        };
        record.recipe_notes.push('ui_design brief written with design_confirmed=True (sign-off halt skipped)');
        return state;
    };

    const onApply: RecipeStep = (state: Dict, record: CycleRecord) => {
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['ui_apply'] = {
            summary: 'Hero headline updated and CTA button retokenised to brand-red',
            rendered: {
                'resources/views/marketing/hero.blade.php': 'Welcome to the next chapter — Get started.',
                'resources/views/components/button.blade.php': '<button class="bg-brand-red">Get started</button>',
            },
            files: ['resources/views/marketing/hero.blade.php', 'resources/views/components/button.blade.php'],
        };
        record.recipe_notes.push('ui_apply envelope written: 2 files via the audit-gated path');
        return state;
    };

    const onReview: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_review'] = { findings: [], review_clean: true };
        record.recipe_notes.push('ui_review clean: 0 findings, review_clean=True');
        return state;
    };

    return {
        'trivial-apply': onTrivialApply,
        'reclassify-to-ui-improve': onReclassify,
        'existing-ui-audit': onAudit,
        'ui-design-brief': onDesign,
        'ui-apply-plain': onApply,
        'ui-design-review-plain': onReview,
    };
}

const recipe: RecipeModule = { META, buildRecipe, seedState };
export default recipe;
