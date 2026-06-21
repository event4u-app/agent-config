/**
 * GT-U9 — greenfield audit halt → user picks `scaffold` → full Zero-to-One
 * flow (TS twin of gt_u9_greenfield_scaffold.py). audit → greenfield decision
 * → app-spec → design → scaffold-plan → scaffold → apply → review → report.
 * `_no_directive` is shared by greenfield/app-spec-confirm/design-confirm,
 * discriminated by state shape.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U9',
    prompt_relpath: 'prompts/gt-u9-greenfield-scaffold.txt',
    persona: null,
    cycle_cap: 12,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = { greenfield: true, components_found: [], design_tokens: {} };
        record.recipe_notes.push('ui_audit populated: greenfield=True, no components, no decision');
        return state;
    };

    const onNoDirective: RecipeStep = (state: Dict, record: CycleRecord) => {
        const audit = state['ui_audit'];
        if (
            typeof audit === 'object' && audit !== null && !Array.isArray(audit) &&
            (audit as Dict)['greenfield'] === true && !(audit as Dict)['greenfield_decision']
        ) {
            (audit as Dict)['greenfield_decision'] = 'scaffold';
            record.recipe_notes.push('greenfield_decision=scaffold (user picked option 1)');
            return state;
        }
        const spec = state['app_spec'];
        if (
            typeof spec === 'object' && spec !== null && !Array.isArray(spec) &&
            Array.isArray((spec as Dict)['pages']) && (spec as Dict)['confirmed'] !== true &&
            !(spec as Dict)['bypassed']
        ) {
            (spec as Dict)['confirmed'] = true;
            record.recipe_notes.push('app_spec confirmed (user picked option 1)');
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

    const onAppSpec: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['app_spec'] = {
            pages: ['Landing'],
            entity_model: ['SignupLead'],
            flow_map: { Landing: ['signup-submit'] },
        };
        record.recipe_notes.push('app_spec derived: 1 page (Landing), 1 entity (SignupLead)');
        return state;
    };

    const onDesign: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_design'] = {
            layout: 'single-column landing page, max-w-5xl, hero + 3 feature blocks',
            components: [{ name: 'MarketingLanding', primitives: ['hero', 'feature-grid', 'cta'] }],
            states: {
                empty: 'First load with hero, features, CTA',
                loading: 'CTA button shows spinner while signup form submits',
                error: 'Inline validation on signup field',
                success: "CTA replaced by 'Thanks — check your inbox'",
                disabled: 'CTA disabled while submission is in flight',
            },
            microcopy: {
                hero_title: 'Ship faster with our SaaS platform',
                hero_subtitle: 'Deploy in minutes, not days.',
                cta_button: 'Start free trial',
                success: 'Thanks — check your inbox to confirm your email.',
            },
            a11y: {
                labels: 'hero h1 is the page title; CTA button labelled explicitly',
                focus: 'skip link to main content; CTA receives focus on success',
                aria_live: 'success message announced via aria-live=polite',
            },
            reused_from_audit: [],
        };
        record.recipe_notes.push('ui_design brief written for greenfield landing');
        return state;
    };

    const onScaffoldPlan: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_scaffold'] = {
            pages: ['Landing'],
            routes: ['/'],
            layout_strategy: 'single-column-shell',
            component_manifest: ['MarketingLanding', 'SignupForm'],
            token_seed: { radius: '0.5rem', font: 'system-ui' },
        };
        record.recipe_notes.push('ui_scaffold plan written: 1 page, 1 route, single-column-shell');
        return state;
    };

    const onScaffold: RecipeStep = (state: Dict, record: CycleRecord) => {
        const scaffold = (state['ui_scaffold'] ??= {}) as Dict;
        scaffold['scaffolded'] = true;
        scaffold['artifacts'] = ['resources/views/marketing/landing.blade.php', 'routes/marketing.php'];
        record.recipe_notes.push('scaffold skeleton created: scaffolded=True, 2 artifacts');
        return state;
    };

    const onApply: RecipeStep = (state: Dict, record: CycleRecord) => {
        const input = (state['input'] ??= {}) as Dict;
        const data = (input['data'] ??= {}) as Dict;
        data['ui_apply'] = {
            summary: 'Marketing landing page scaffolded with locked microcopy',
            rendered: {
                'resources/views/marketing/landing.blade.php':
                    'Ship faster with our SaaS platform. Deploy in minutes, not days. Start free trial.',
            },
            files: ['resources/views/marketing/landing.blade.php'],
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
        _no_directive: onNoDirective,
        'app-spec': onAppSpec,
        'ui-design-brief': onDesign,
        'ui-scaffold-plan': onScaffoldPlan,
        'ui-scaffold-plain': onScaffold,
        'ui-apply-plain': onApply,
        'ui-design-review-plain': onReview,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
