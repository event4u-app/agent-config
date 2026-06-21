/**
 * GT-U14 — a11y blocks at ceiling; user accepts known violations (TS twin of
 * gt_u14_a11y_ceiling.py). Two moderate violations: round 1 fixes A, round 2
 * cannot fix B → at `rounds==2` with an `a11y_violation` finding open the
 * engine emits `polish_a11y_blocking` (not the subjective ceiling halt). User
 * accepts: B is appended to `ui_review.a11y.accepted_violations`, the next
 * review re-enters clean, run ships. `_no_directive` shared by design-confirm
 * (cycle 3) and a11y_blocking (cycle 8), discriminated on `ui_polish.rounds`.
 */
import type { RecipeModule } from './index.js';
import type { CycleRecord, Dict, RecipeStep } from '../runner.js';

const VIOLATION_A: Dict = {
    rule: 'label',
    selector: 'input#settings-toggle-notifications',
    severity: 'moderate',
};

const VIOLATION_B: Dict = {
    rule: 'aria-tooltip-name',
    selector: '[role=tooltip]#settings-help',
    severity: 'moderate',
};

export const META: RecipeModule['META'] = {
    gt_id: 'GT-U14',
    prompt_relpath: 'prompts/gt-u14-a11y-ceiling.txt',
    persona: null,
    cycle_cap: 10,
};

export function buildRecipe(_workspace: string): Record<string, RecipeStep> {
    const onAudit: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_audit'] = {
            components_found: [
                {
                    path: 'resources/views/components/forms/toggle.blade.php',
                    name: 'forms.toggle',
                    kind: 'form-primitive',
                    similarity: 0.81,
                },
            ],
            design_tokens: { spacing: { sm: '8px', md: '12px' } },
            audit_path: 'high_confidence',
            candidate_pick: 'forms.toggle',
            a11y_baseline: [],
        };
        record.recipe_notes.push('ui_audit populated with empty a11y_baseline (a11y gate opted in)');
        return state;
    };

    const onDesignBrief: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_design'] = {
            layout: 'two-column settings panel, max-w-3xl',
            components: [{ name: 'SettingsPanel', primitives: ['forms.toggle', 'tooltip'] }],
            states: {
                empty: 'Panel renders with default toggle states',
                loading: 'Save button shows spinner while persisting',
                error: 'Inline error replaces toast on save failure',
                success: 'Save button confirms with checkmark for 1s',
                disabled: 'Toggles disabled while save is in flight',
            },
            microcopy: {
                title: 'Notification settings',
                fields: { notifications: 'Email me when a job finishes' },
                tooltips: { notifications: 'Sent at most once per hour.' },
                buttons: { save: 'Save changes' },
            },
            a11y: {
                labels: 'every toggle has a visible label and matching for/id',
                focus: 'save button reachable after the last toggle',
                aria_live: 'save confirmation announced via aria-live=polite',
            },
            reused_from_audit: ['forms.toggle'],
        };
        record.recipe_notes.push('ui_design brief written for settings panel');
        return state;
    };

    const onNoDirective: RecipeStep = (state: Dict, record: CycleRecord) => {
        const polish = (typeof state['ui_polish'] === 'object' && state['ui_polish'] !== null
            ? state['ui_polish']
            : {}) as Dict;
        const rounds = polish['rounds'];
        if (typeof rounds === 'number' && rounds >= 2) {
            let review = state['ui_review'];
            if (typeof review !== 'object' || review === null || Array.isArray(review)) {
                review = {};
                state['ui_review'] = review;
            }
            let a11y = (review as Dict)['a11y'];
            if (typeof a11y !== 'object' || a11y === null || Array.isArray(a11y)) {
                a11y = {};
                (review as Dict)['a11y'] = a11y;
            }
            let accepted = (a11y as Dict)['accepted_violations'];
            if (!Array.isArray(accepted)) {
                accepted = [];
                (a11y as Dict)['accepted_violations'] = accepted;
            }
            (accepted as unknown[]).push({ ...VIOLATION_B });
            (review as Dict)['review_clean'] = true;
            record.recipe_notes.push(
                'a11y_blocking halt: user picked Accept; VIOLATION_B appended to accepted_violations',
            );
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
            summary: 'Settings panel rendered with toggles and tooltips',
            rendered: {
                'resources/views/settings/notifications.blade.php':
                    'Notification settings — Email me when a job finishes. Save changes.',
            },
            files: ['resources/views/settings/notifications.blade.php'],
        };
        record.recipe_notes.push('ui_apply envelope written: 1 file');
        return state;
    };

    const onReview: RecipeStep = (state: Dict, record: CycleRecord) => {
        state['ui_review'] = {
            findings: [],
            review_clean: true,
            a11y: { violations: [{ ...VIOLATION_A }, { ...VIOLATION_B }] },
        };
        record.recipe_notes.push('ui_review with 2 moderate a11y violations; gate will synthesise findings');
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
        if (p['rounds'] === 1) {
            applied.push('round 1: added <label for> on settings-toggle-notifications; tooltip name still missing');
        } else {
            applied.push(
                `round ${p['rounds']}: tried wrapping tooltip in role=group; a11y still flags missing accessible name`,
            );
        }
        state['ui_review'] = {
            findings: [
                {
                    kind: 'a11y_violation',
                    rule: VIOLATION_B['rule'],
                    selector: VIOLATION_B['selector'],
                    severity: VIOLATION_B['severity'],
                },
            ],
            review_clean: false,
            a11y: { violations: [{ ...VIOLATION_B }] },
        };
        record.recipe_notes.push(
            `polish round ${p['rounds']}: VIOLATION_B still open; synthesised a11y_violation finding into ui_review.findings`,
        );
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
