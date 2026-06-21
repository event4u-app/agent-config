/**
 * GT-U15 — preview render failure; user skips the visual artifact (TS twin of
 * gt_u15_preview_fail.py). The review skill writes `ui_review.preview.render_ok
 * =False`; the engine emits `preview_render_failed` (same review directive so
 * the skill can retry). User picks Skip → `preview.skipped=True`, next review
 * re-enters with the gate a no-op, run ships. Audit omits `a11y_baseline` so
 * the a11y gate stays silent; the preview halt is discriminated inside the
 * review callback on the `preview` envelope (one `_no_directive` = design
 * confirm only).
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U15',
    prompt_relpath: 'prompts/gt-u15-preview-fail.txt',
    persona: null,
    cycle_cap: 8,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = {
            components_found: [
                {
                    path: 'resources/views/components/cards/tier.blade.php',
                    name: 'cards.tier',
                    kind: 'card',
                    similarity: 0.83,
                },
            ],
            design_tokens: {
                spacing: { sm: '8px', md: '12px', lg: '16px' },
                color: { primary: '#1a73e8', muted: '#6b7280' },
            },
            audit_path: 'high_confidence',
            candidate_pick: 'cards.tier',
        };
        record.recipe_notes.push('ui_audit populated; no a11y_baseline (a11y gate stays silent)');
        return state;
    };

    const onDesignBrief: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_design'] = {
            layout: 'three-column tier grid, max-w-6xl, centered',
            components: [{ name: 'PricingTierCard', primitives: ['cards.tier', 'button'] }],
            states: {
                empty: 'Grid renders all three tiers with default emphasis',
                loading: 'Skeleton placeholders while pricing data resolves',
                error: 'Inline error replaces grid on price-feed failure',
                success: 'Selected tier highlighted; CTA enabled',
                disabled: 'Tiers muted while a checkout flow is active',
            },
            microcopy: {
                title: 'Pricing',
                tiers: {
                    starter: 'Starter — for solo builders',
                    team: 'Team — for growing squads',
                    enterprise: 'Enterprise — talk to sales',
                },
                buttons: { cta: 'Choose plan' },
            },
            a11y: {
                labels: 'each tier card is a labelled region with heading',
                focus: 'CTA button reachable after the tier description',
                aria_live: 'selection feedback announced via aria-live=polite',
            },
            reused_from_audit: ['cards.tier'],
        };
        record.recipe_notes.push('ui_design brief written for pricing grid');
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
            summary: 'Pricing tier grid rendered with three tiers',
            rendered: {
                'resources/views/marketing/pricing.blade.php':
                    'Pricing — Starter, Team, Enterprise. Choose plan.',
            },
            files: ['resources/views/marketing/pricing.blade.php'],
        };
        record.recipe_notes.push('ui_apply envelope written: 1 file');
        return state;
    };

    const onReview: RecipeStep = (state: Dict, record: CycleRecord) => {
        const review = state['ui_review'];
        const existingPreview =
            typeof review === 'object' && review !== null && !Array.isArray(review)
                ? (review as Dict)['preview']
                : null;
        if (
            typeof existingPreview === 'object' &&
            existingPreview !== null &&
            !Array.isArray(existingPreview) &&
            (existingPreview as Dict)['render_ok'] === false &&
            !(existingPreview as Dict)['skipped']
        ) {
            (existingPreview as Dict)['skipped'] = true;
            record.recipe_notes.push(
                'preview_render_failed halt: user picked Skip; preview.skipped=True (gate is now a no-op)',
            );
            return state;
        }
        state['ui_review'] = {
            findings: [],
            review_clean: true,
            preview: {
                render_ok: false,
                error: 'playwright: net::ERR_CONNECTION_REFUSED at http://localhost:8080/marketing/pricing',
            },
        };
        record.recipe_notes.push(
            'ui_review with preview.render_ok=False; engine will halt on preview_render_failed',
        );
        return state;
    };

    return {
        'existing-ui-audit': onAudit,
        'ui-design-brief': onDesignBrief,
        _no_directive: onNoDirective,
        'ui-apply-plain': onApply,
        'ui-design-review-plain': onReview,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
