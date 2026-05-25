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

export type WizardStepKind = 'form' | 'userMd' | 'review' | 'aiTools' | 'packs' | 'modules';

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

/**
 * Feature-flagged extended step set — prepends `ai-tools` + `packs` ahead
 * of the canonical 7 settings steps so a single `agent-config setup` run
 * covers KI → Packs → Settings end-to-end (road-to-global-only-install §
 * Phase 1, D9). Enabled when `AGENT_CONFIG_DEV_MODE=1` or when the server
 * advertises `extendedSteps: true` via /api/v1/wizard/state — keeps the
 * canonical 7-step contract for v2.x users until the merged flow ships
 * end-to-end (Phase 1.9 — npm-version kill-switch, no dual code paths).
 */
const EXTENDED_STEPS_LEAD: readonly WizardStep[] = [
    {
        id: 'ai-tools',
        title: 'Which AI tools do you use?',
        navLabel: 'AI tools',
        subtitle: 'Pick the editors and CLIs that should pick up this config. Auto-detect runs first; you can override.',
        kind: 'aiTools',
    },
    {
        id: 'packs',
        title: 'Which capability packs do you want?',
        navLabel: 'Packs',
        subtitle: 'Founder-strategy, finance-basic, gtm-sales, ops-people, ai-video — pick zero or more. You can change this later.',
        kind: 'packs',
    },
    {
        id: 'modules',
        title: 'Module roots for this project',
        navLabel: 'Modules',
        subtitle: 'Auto-detected source roots from the project. Pick which ones the agent should treat as modules, or skip to leave .agent-project-settings.yml as-is.',
        kind: 'modules',
    },
];

const CORE_WIZARD_STEPS: readonly WizardStep[] = [
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

/**
 * Canonical 7-step wizard — preserved verbatim for v2.x users. The
 * 9-step flow (ai-tools + packs prepended) is exposed via
 * `getWizardSteps({ extended: true })`. See road-to-global-only-install
 * Phase 1.9 — no dual code paths, the npm version is the kill-switch.
 */
export const WIZARD_STEPS = CORE_WIZARD_STEPS;

export const WIZARD_TOTAL_STEPS = WIZARD_STEPS.length;

export interface GetWizardStepsOptions {
    /** Prepend ai-tools + packs to ship the 9-step flow (D9). */
    extended?: boolean;
}

export function getWizardSteps(opts: GetWizardStepsOptions = {}): readonly WizardStep[] {
    if (opts.extended === true) {
        return [...EXTENDED_STEPS_LEAD, ...CORE_WIZARD_STEPS];
    }
    return CORE_WIZARD_STEPS;
}

export function stepAt(index: number, opts: GetWizardStepsOptions = {}): WizardStep {
    const steps = getWizardSteps(opts);
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    return steps[clamped] as WizardStep;
}
