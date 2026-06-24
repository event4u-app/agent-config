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

export type WizardStepKind = 'form' | 'userMd' | 'review' | 'welcome' | 'aiTools' | 'roles' | 'packs';

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
 * Feature-flagged extended step set — prepends the install-only lead
 * (`ai-tools` → `roles` → `packs`) ahead of the canonical settings steps
 * so a single `agent-config setup` run covers KI → Roles → Packs →
 * Settings end-to-end (road-to-global-only-install § Phase 1, D9). The
 * project-specific `modules` step is NOT part of this lead — it is
 * appended at the end of the flow (just before `review`) by
 * `getWizardSteps`, so global/user settings come first and the project
 * step comes last. Enabled when `AGENT_CONFIG_DEV_MODE=1` or when the
 * server advertises `extendedSteps: true` via /api/v1/wizard/state.
 */
/**
 * Always-first step (both modes): name + language. Pulled out of the user-md
 * step so the agent knows who it's talking to before anything else. Language
 * is pre-filled from the browser locale and the name from the system user
 * when not already set (see WizardPage).
 */
const WELCOME_STEP: WizardStep = {
    id: 'welcome',
    title: 'Welcome — who are you?',
    navLabel: 'You',
    subtitle: 'Your name and language. Stored in .agent-user.yml; we pre-fill what we can detect.',
    kind: 'welcome',
};

/**
 * Profile / experience — the first substantive question in both flows
 * (road-to-6.0.0-a Phase 2 / Step 7). Maps to the six seed profiles
 * (docs/contracts/profile-system.md) and writes `profile.id` to
 * `.agent-settings.yml`. Surfacing the experience choice first is the
 * cheap perception fix; the behavioural change (pack-scoped projection,
 * ADR-040) is gated behind 6.0.0-B's staged rollout — this step records
 * the choice only and changes no projection.
 */
const PROFILE_STEP: WizardStep = {
    id: 'profile',
    title: 'Which experience?',
    navLabel: 'Experience',
    subtitle: 'Pick the experience that fits you — developer · content · founder · agency · finance · ops. It selects your default command/skill surface and persona pre-selection. Cost tier is a secondary knob on a later step. You can switch later with `agent-config use --profile=<id>`.',
    kind: 'form',
    paths: [
        'profile.id',
    ],
};

const EXTENDED_STEPS_LEAD: readonly WizardStep[] = [
    {
        id: 'ai-tools',
        title: 'Which AI tools do you use?',
        navLabel: 'AI tools',
        subtitle: 'Pick the editors and CLIs that should pick up this config. Auto-detect runs first; you can override.',
        kind: 'aiTools',
    },
    {
        id: 'roles',
        title: 'What do you work on?',
        navLabel: 'Roles',
        subtitle: 'Pick the areas you work in. We use them to recommend capability packs on the next step, and they become your roles in .agent-user.yml.',
        kind: 'roles',
    },
    {
        id: 'packs',
        title: 'Which capability packs do you want?',
        navLabel: 'Packs',
        subtitle: 'Founder-strategy, finance-basic, gtm-sales, ops-people, ai-video — pick zero or more. You can change this later.',
        kind: 'packs',
    },
    {
        id: 'legal-consent',
        title: 'Legal review-prep — not legal advice',
        navLabel: 'Legal consent',
        subtitle: 'Only relevant if you picked the legal-review-prep pack. It provides templates and general information, never legal advice — check the box to acknowledge before it activates. Leave unchecked otherwise; the pack stays inactive.',
        kind: 'form',
        paths: [
            'legal_review_prep.acknowledged',
        ],
    },
];

const CORE_WIZARD_STEPS: readonly WizardStep[] = [
    {
        id: 'identity',
        title: 'Editor and tooling',
        navLabel: 'Editor',
        subtitle: 'IDE goes into .agent-settings.yml so the agent opens files in the right tool. rtk presence is auto-detected (see the rtk row). Your name lives in .agent-user.yml (later step).',
        kind: 'form',
        // `personal.rtk_installed` is NOT a form field — it is auto-detected at
        // runtime (road-to-wizard-ux-improvements § Phase 7) and rendered by a
        // dedicated rtk widget above the form, never a manual toggle.
        paths: [
            'personal.ide',
            'personal.open_edited_files',
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
        title: 'Rule loading, budgets & model tier',
        navLabel: 'Cost & rules',
        subtitle: 'Three distinct levers: rule_loading_tier (how many behavioural rules load — token footprint), cost.budgets (optional USD spending ceilings), and model.auto_switch (per-skill model tier). They are independent — the rule tier is not a spend lever and the model tier is not a rule lever.',
        kind: 'form',
        paths: [
            'rule_loading_tier',
            'cost.budgets.daily',
            'cost.budgets.weekly',
            'cost.budgets.monthly',
            'cost.enforcement',
            'model.auto_switch',
            'tokens.rich_skills',
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
 * Canonical settings-only wizard — preserved verbatim for v2.x users.
 * The extended flow (install-only lead prepended + the project `modules`
 * step appended before `review`) is exposed via
 * `getWizardSteps({ extended: true })`. See road-to-global-only-install
 * Phase 1.9 — no dual code paths, the npm version is the kill-switch.
 */
export const WIZARD_STEPS = CORE_WIZARD_STEPS;

/** Non-extended flow length — welcome (Step 1) + profile (Step 2) + the core steps. */
export const WIZARD_TOTAL_STEPS = CORE_WIZARD_STEPS.length + 2;

export interface GetWizardStepsOptions {
    /** Prepend the install-only lead + append the project modules step (D9). */
    extended?: boolean;
}

export function getWizardSteps(opts: GetWizardStepsOptions = {}): readonly WizardStep[] {
    if (opts.extended === true) {
        // Welcome → profile (which experience?) → install-only lead
        // (ai-tools / roles / packs) → global/user settings. Profile is the
        // first substantive question (road-to-6.0.0-a Step 7). Project-scoped
        // configuration (modules) is not a wizard step — it lives on its own
        // "Projekt" surface.
        return [WELCOME_STEP, PROFILE_STEP, ...EXTENDED_STEPS_LEAD, ...CORE_WIZARD_STEPS];
    }
    return [WELCOME_STEP, PROFILE_STEP, ...CORE_WIZARD_STEPS];
}

export function stepAt(index: number, opts: GetWizardStepsOptions = {}): WizardStep {
    const steps = getWizardSteps(opts);
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    return steps[clamped] as WizardStep;
}
