/**
 * GT-U13 — a11y findings drive polish loop; round 1 fixes them (TS twin of
 * gt_u13_a11y_polish.py). Audit declares an `a11y_baseline=[]` opt-in; the
 * first review reports one serious a11y violation, the engine's a11y gate
 * synthesises a finding + flips `review_clean=False`, polish round 1 fixes it
 * and writes a clean review, the run ships. 1 `_no_directive` (design confirm);
 * the polish loop converges so `polish_a11y_blocking` never fires.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U13',
    prompt_relpath: 'prompts/gt-u13-a11y-polish.txt',
    persona: null,
    cycle_cap: 8,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = {
            components_found: [
                {
                    path: 'resources/views/components/banners/status.blade.php',
                    name: 'banners.status',
                    kind: 'banner',
                    similarity: 0.78,
                },
            ],
            design_tokens: { spacing: { sm: '8px', md: '12px' } },
            audit_path: 'high_confidence',
            candidate_pick: 'banners.status',
            a11y_baseline: [],
        };
        record.recipe_notes.push('ui_audit populated with empty a11y_baseline (a11y gate opted in)');
        return state;
    };

    const onDesignBrief: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_design'] = {
            layout: 'horizontal banner under top nav, full-width',
            components: [{ name: 'StatusBanner', primitives: ['banners.status'] }],
            states: {
                empty: 'Banner hidden when no status to surface',
                loading: 'Banner shows neutral spinner while message resolves',
                error: 'Banner switches to danger variant on failures',
                success: 'Banner switches to success variant on positive ack',
                disabled: 'Banner muted while another modal owns focus',
            },
            microcopy: {
                title: 'System status',
                message: 'All services operating normally.',
                buttons: { dismiss: 'Dismiss' },
            },
            a11y: {
                labels: 'banner has role=status with aria-live=polite',
                focus: 'dismiss button reachable as last item in tab order',
                aria_live: 'status changes announced via aria-live=polite',
            },
            reused_from_audit: ['banners.status'],
        };
        record.recipe_notes.push('ui_design brief written for status banner');
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
            summary: 'Status banner rendered under the dashboard header',
            rendered: {
                'resources/views/dashboard/header.blade.php':
                    'System status — All services operating normally. Dismiss.',
            },
            files: ['resources/views/dashboard/header.blade.php'],
        };
        record.recipe_notes.push('ui_apply envelope written: 1 file');
        return state;
    };

    const onReview: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_review'] = {
            findings: [],
            review_clean: true,
            a11y: {
                violations: [{ rule: 'image-alt', selector: 'img.banner-icon', severity: 'serious' }],
            },
        };
        record.recipe_notes.push('ui_review with 1 serious a11y violation; gate will synthesise finding');
        return state;
    };

    const onPolish: RecipeStep = (state: Dict, record: CycleRecord) => {
        let polish = state['ui_polish'];
        if (typeof polish !== 'object' || polish === null || Array.isArray(polish)) {
            polish = {};
            state['ui_polish'] = polish;
        }
        const p = polish as Dict;
        let rounds = p['rounds'];
        if (typeof rounds !== 'number') {
            rounds = 0;
        }
        p['rounds'] = (rounds as number) + 1;
        const applied = (p['applied'] ??= []) as unknown[];
        applied.push(`round ${p['rounds']}: added alt text to banner-icon image`);
        state['ui_review'] = { findings: [], review_clean: true, a11y: { violations: [] } };
        record.recipe_notes.push(`polish round ${p['rounds']}: a11y violation fixed; review clean`);
        return state;
    };

    return {
        'existing-ui-audit': onAudit,
        'ui-design-brief': onDesignBrief,
        _no_directive: onNoDirective,
        'ui-apply-plain': onApply,
        'ui-design-review-plain': onReview,
        'ui-polish-plain': onPolish,
    };
}

const recipe: RecipeModule = { META, buildRecipe };
export default recipe;
