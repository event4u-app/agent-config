/**
 * Wizard step plan.
 *
 * Each step picks a subset of settings paths (dotted keys against the
 * full settings schema) and renders only those fields via SchemaForm.
 * The two non-settings steps (`userMd`, `review`) carry no `paths` and
 * use bespoke renderers in `WizardPage.tsx`.
 *
 * Step layout drives the GUI-only onboarding flow — the legacy
 * `/onboard` chat skill was removed in the wizard-takeover pivot.
 */

export type WizardStepKind = 'form' | 'userMd' | 'review';

export interface WizardStep {
    /** Stable id used for state-machine routing and tests. */
    id: string;
    /** H1 line, mirrored to the browser tab title in WizardPage. */
    title: string;
    /** Short label used in the clickable step navigation. */
    navLabel: string;
    /** One-line subhead under the title. */
    subtitle: string;
    /** Discriminator for the body renderer. */
    kind: WizardStepKind;
    /** Dotted settings-schema paths to expose on this step (kind=form). */
    paths?: string[];
}

export const WIZARD_STEPS: readonly WizardStep[] = [
    {
        id: 'identity',
        title: 'Editor and tooling',
        navLabel: 'Editor',
        subtitle: 'IDE and rtk go into .agent-settings.yml so the agent opens files in the right tool. Your name lives in .agent-user.yml (later step).',
        kind: 'form',
        paths: [
            'personal.ide',
            'personal.open_edited_files',
            'personal.rtk_installed',
        ],
    },
    {
        id: 'personality',
        title: 'How should the agent behave?',
        navLabel: 'Personality',
        subtitle: 'Autonomy, output verbosity, and PR-comment style.',
        kind: 'form',
        paths: [
            'personal.autonomy',
            'personal.minimal_output',
            'personal.play_by_play',
            'personal.pr_comment_bot_icon',
        ],
    },
    {
        id: 'cost',
        title: 'Cost profile and budgets',
        navLabel: 'Cost',
        subtitle: 'Master switch for which rule tiers load, plus optional spending ceilings.',
        kind: 'form',
        paths: [
            'cost_profile',
            'cost.budgets.daily',
            'cost.budgets.weekly',
            'cost.budgets.monthly',
            'cost.enforcement',
        ],
    },
    {
        id: 'roadmap-quality',
        title: 'Roadmap & quality cadence',
        navLabel: 'Roadmap & quality',
        subtitle: 'When the agent runs quality tools and refreshes roadmap dashboards.',
        kind: 'form',
        paths: [
            'roadmap.quality_cadence',
            'roadmap.dashboard_regen_cadence',
            'quality.local_auto_run',
            'quality.wait_for_remote_ci',
        ],
    },
    {
        id: 'memory',
        title: 'Memory & redaction',
        navLabel: 'Memory',
        subtitle: 'Inline-review threshold and transcript-redaction regexes.',
        kind: 'form',
        paths: [
            'memory.review_threshold',
            'memory.redact_patterns',
        ],
    },
    {
        id: 'user-md',
        title: 'Your .agent-user.yml',
        navLabel: 'User profile',
        subtitle: 'Identity, voice, preferences. Stored at agents/settings/.agent-user.yml. Skip to leave empty.',
        kind: 'userMd',
    },
    {
        id: 'review',
        title: 'Review & finish',
        navLabel: 'Review',
        subtitle: 'These keys will change. Confirm to write .agent-settings.yml and .agent-user.yml atomically.',
        kind: 'review',
    },
] as const;

export const WIZARD_TOTAL_STEPS = WIZARD_STEPS.length;

export function stepAt(index: number): WizardStep {
    const clamped = Math.max(0, Math.min(WIZARD_STEPS.length - 1, index));
    return WIZARD_STEPS[clamped] as WizardStep;
}
