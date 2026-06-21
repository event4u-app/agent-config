/**
 * GT-U4 — polish-loop ceiling: engine refuses a third polish round (TS twin
 * of gt_u4_polish_ceiling.py). Pins POLISH_CEILING == 2.
 *
 * The recipe walks the UI track, keeps the review dirty across both polish
 * rounds; after round 2 the dispatcher emits a `_no_directive` ceiling halt,
 * re-emitted idempotently until the cap trips (`cycle_cap_reached`). The
 * `_no_directive` key serves two halts (design confirm at cycle 3, ceiling at
 * 8-9) — discriminated by `ui_polish.rounds`.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U4',
    prompt_relpath: 'prompts/gt-u4-polish-ceiling.txt',
    persona: null,
    cycle_cap: 9,
};

function dirtyReview(): Dict {
    return {
        findings: [
            {
                kind: 'spacing-mismatch',
                component: 'OnboardingWizard',
                severity: 'minor',
                note: 'step indicators use 8px gap; brief asks 12px',
            },
        ],
        review_clean: false,
    };
}

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = {
            components_found: [
                {
                    path: 'resources/views/components/wizards/step.blade.php',
                    name: 'wizards.step',
                    kind: 'wizard-step',
                    similarity: 0.74,
                },
            ],
            design_tokens: { spacing: { sm: '8px', md: '12px', lg: '16px' } },
            audit_path: 'high_confidence',
            candidate_pick: 'wizards.step',
        };
        record.recipe_notes.push('ui_audit populated for polish-ceiling run');
        return state;
    };

    const onDesign: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_design'] = {
            layout: 'vertical wizard, max-w-2xl, 12px step gap',
            components: [{ name: 'OnboardingWizard', primitives: ['wizards.step'] }],
            states: {
                empty: 'Wizard rendered with first step active',
                loading: 'Step transition shows inline spinner',
                error: 'Step-level validation errors inline',
                success: 'Final step replaced by completion card',
                disabled: 'Disabled steps show muted indicators',
            },
            microcopy: {
                title: "Welcome — let's set up your account",
                buttons: { next: 'Continue', back: 'Back' },
                completion: 'All set — onboarding complete.',
            },
            a11y: {
                labels: 'every step has aria-current=step when active',
                focus: 'first invalid field focused on validation error',
                aria_live: 'completion card announced via aria-live=polite',
            },
            reused_from_audit: ['wizards.step'],
        };
        record.recipe_notes.push('ui_design brief written for wizard polish');
        return state;
    };

    const onNoDirective: RecipeStep = (state: Dict, record: CycleRecord) => {
        const polish = (state['ui_polish'] as Dict | undefined) ?? {};
        const rounds = polish['rounds'];
        if (typeof rounds === 'number' && rounds >= 2) {
            record.recipe_notes.push('ceiling halt observed; state left untouched for idempotent re-halt');
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

    const onApply: RecipeStep = (state: Dict, record: CycleRecord) => {
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['ui_apply'] = {
            summary: 'Onboarding wizard rendered; spacing applied per brief',
            rendered: {
                'resources/views/onboarding/wizard.blade.php':
                    "Welcome — let's set up your account. Continue / Back. All set — onboarding complete.",
            },
            files: ['resources/views/onboarding/wizard.blade.php'],
        };
        record.recipe_notes.push('ui_apply envelope written: 1 file');
        return state;
    };

    const onReview: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_review'] = dirtyReview();
        record.recipe_notes.push('ui_review dirty: 1 finding, review_clean=False (round 0 baseline)');
        return state;
    };

    const onPolish: RecipeStep = (state: Dict, record: CycleRecord) => {
        let polish = state['ui_polish'];
        if (typeof polish !== 'object' || polish === null || Array.isArray(polish)) {
            polish = {};
            state['ui_polish'] = polish;
        }
        const p = polish as Dict;
        const prev = typeof p['rounds'] === 'number' ? (p['rounds'] as number) : 0;
        p['rounds'] = prev + 1;
        const applied = (p['applied'] ??= []) as string[];
        applied.push(`round ${p['rounds'] as number}: tried tightening step gap; review still dirty`);
        state['ui_review'] = dirtyReview();
        record.recipe_notes.push(`polish round ${p['rounds'] as number}: review still dirty, no convergence`);
        return state;
    };

    return {
        'existing-ui-audit': onAudit,
        'ui-design-brief': onDesign,
        _no_directive: onNoDirective,
        'ui-apply-plain': onApply,
        'ui-design-review-plain': onReview,
        'ui-polish-plain': onPolish,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
