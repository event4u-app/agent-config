/**
 * WizardReview — final step. Lists each prior step as a clickable box
 * with a right-aligned status indicator. The verbose diff list was
 * removed in favour of per-step change counts; details live one click
 * away on each section.
 *
 * Path ownership: exact match against `step.paths` for form steps,
 * plus the cost step owns the `caveman.*` / `verbosity.*` bundles
 * because `cost_profile` selection mutates those keys server-side.
 * The `userMd` step uses `userMdChanged` directly.
 */

import type { JsonValue } from '../forms/schemaTypes.js';
import type { WizardStep } from './steps.js';
import { WizardConflicts } from './WizardConflicts.js';
import type {
    ConflictBatchChoice,
    ConflictEntryWire,
    ConflictResolutionWire,
} from './state.js';

export interface DiffRow {
    path: string;
    from: JsonValue;
    to: JsonValue;
}

export interface WizardReviewProps {
    steps: readonly WizardStep[];
    currentIndex: number;
    changes: DiffRow[];
    errors: Record<string, string>;
    userMdChanged: boolean;
    userMdAction: 'create' | 'replace' | null;
    loading: boolean;
    onJump: (index: number) => void;
    /**
     * Wizard write scope (road-to-global-only-install § Phase 2.3). The
     * checkbox is rendered only when `scopeAvailable` is `true` — that
     * flag mirrors the server's `projectScopeAvailable`, which is `false`
     * in package-sandbox mode and when the operator pinned the write
     * root via `--project`. The default scope is `'global'`.
     */
    scope: 'global' | 'project';
    scopeAvailable: boolean;
    onScopeChange: (next: 'global' | 'project') => void;
    /**
     * Selection counts surfaced on the aiTools / packs rows of the
     * jump-back nav (road-to-unified-setup § Phase 2). `undefined` keeps
     * the row in its idle state — used in the legacy 7-step flow where
     * neither step is present.
     */
    selectedToolsCount?: number;
    selectedPacksCount?: number;
    /**
     * Install plan summary — per-tool file counts plus a flag for
     * "nothing to install". `undefined` keeps the panel hidden (legacy
     * 7-step flow); `installPlanReady === false` shows a loading state;
     * empty `installPlanByTool` shows the "nothing to install" line.
     * road-to-unified-setup § Phase B2.
     */
    installPlanByTool?: Record<string, number>;
    installPlanReady?: boolean;
    installPlanError?: string | null;
    /**
     * Filesystem-collision panel surfaced beneath the install summary
     * (road-to-unified-setup § Phase B3). `undefined` keeps the panel
     * hidden — used by the legacy 7-step flow and when the install plan
     * hasn't loaded yet. Empty array still hides the panel because
     * `WizardConflicts` short-circuits on zero entries.
     */
    conflicts?: ReadonlyArray<ConflictEntryWire>;
    conflictResolutions?: Readonly<Record<string, ConflictResolutionWire>>;
    conflictBatchChoice?: ConflictBatchChoice | null;
    onConflictResolutionChange?: (path: string, choice: ConflictResolutionWire) => void;
    onConflictBatchChoice?: (choice: ConflictBatchChoice | null) => void;
}

function stepOwnsPath(step: WizardStep, path: string): boolean {
    if (step.kind !== 'form' || step.paths === undefined) return false;
    if (step.paths.includes(path)) return true;
    if (step.id === 'cost' && (path.startsWith('caveman.') || path.startsWith('verbosity.'))) {
        return true;
    }
    return false;
}

function stepOwnsErrorPath(step: WizardStep, path: string): boolean {
    // userMd step owns errors whose path is `body` or nested under it —
    // server validates `{ body: <text> }` so Zod issues come back as
    // `body` / `body.<...>`.
    if (step.kind === 'userMd') {
        return path === 'body' || path.startsWith('body.');
    }
    return stepOwnsPath(step, path);
}

function stepHasError(step: WizardStep, props: WizardReviewProps): boolean {
    for (const p of Object.keys(props.errors)) {
        if (stepOwnsErrorPath(step, p)) return true;
    }
    return false;
}

function stepStatus(
    step: WizardStep,
    props: WizardReviewProps,
): { label: string; tone: 'changed' | 'error' | 'idle' } {
    // Errors trump change counts — a step that won't validate is the
    // first thing the user has to fix before finish() can succeed.
    if (stepHasError(step, props)) {
        return { label: 'needs attention', tone: 'error' };
    }
    if (step.kind === 'userMd') {
        if (!props.userMdChanged) return { label: '', tone: 'idle' };
        return {
            label: props.userMdAction === 'create' ? 'will create' : 'will replace',
            tone: 'changed',
        };
    }
    if (step.kind === 'form') {
        const count = props.changes.filter((c) => stepOwnsPath(step, c.path)).length;
        if (count === 0) return { label: '', tone: 'idle' };
        return { label: `${count} change${count === 1 ? '' : 's'}`, tone: 'changed' };
    }
    if (step.kind === 'aiTools') {
        const count = props.selectedToolsCount ?? 0;
        if (count === 0) return { label: '', tone: 'idle' };
        return { label: `${count} tool${count === 1 ? '' : 's'}`, tone: 'changed' };
    }
    if (step.kind === 'packs') {
        const count = props.selectedPacksCount ?? 0;
        if (count === 0) return { label: '', tone: 'idle' };
        return { label: `${count} pack${count === 1 ? '' : 's'}`, tone: 'changed' };
    }
    return { label: '', tone: 'idle' };
}

export function WizardReview(props: WizardReviewProps): preact.JSX.Element {
    const jumpSteps = props.steps.filter((_, i) => i !== props.currentIndex);
    return (
        <>
            <nav class="ac-wizard__review-nav" aria-label="Jump back to a step">
                <p class="ac-wizard__review-nav-label">Jump back to a step:</p>
                <ul class="ac-wizard__review-nav-list">
                    {jumpSteps.map((s) => {
                        const i = props.steps.indexOf(s);
                        const status = stepStatus(s, props);
                        const buttonClass = status.tone === 'error'
                            ? 'ac-wizard__review-nav-button ac-wizard__review-nav-button--error'
                            : 'ac-wizard__review-nav-button';
                        return (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    class={buttonClass}
                                    onClick={(): void => { props.onJump(i); }}
                                >
                                    <span class="ac-wizard__review-nav-index">{i + 1}</span>
                                    <span class="ac-wizard__review-nav-text">{s.navLabel}</span>
                                    {status.label !== '' ? (
                                        <span
                                            class={`ac-wizard__review-nav-status ac-wizard__review-nav-status--${status.tone}`}
                                        >
                                            {status.label}
                                        </span>
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            {props.scopeAvailable ? (
                <fieldset class="ac-wizard__scope">
                    <legend class="ac-wizard__scope-legend">Where should these settings be written?</legend>
                    <label class="ac-wizard__scope-option">
                        <input
                            type="radio"
                            name="ac-wizard-scope"
                            value="global"
                            checked={props.scope === 'global'}
                            onChange={(): void => { props.onScopeChange('global'); }}
                        />
                        <span class="ac-wizard__scope-option-text">
                            <strong>Global</strong> — write to <code>~/.event4u/agent-config/</code> so every project picks them up.
                        </span>
                    </label>
                    <label class="ac-wizard__scope-option">
                        <input
                            type="radio"
                            name="ac-wizard-scope"
                            value="project"
                            checked={props.scope === 'project'}
                            onChange={(): void => { props.onScopeChange('project'); }}
                        />
                        <span class="ac-wizard__scope-option-text">
                            <strong>This project only</strong> — write to <code>settings/</code> under the current repo (overrides the global layer).
                        </span>
                    </label>
                </fieldset>
            ) : null}
            {props.installPlanByTool !== undefined ? (
                <InstallPlanSummary
                    byTool={props.installPlanByTool}
                    ready={props.installPlanReady === true}
                    error={props.installPlanError ?? null}
                />
            ) : null}
            {props.conflicts !== undefined
                && props.conflictResolutions !== undefined
                && props.onConflictResolutionChange !== undefined
                && props.onConflictBatchChoice !== undefined ? (
                <WizardConflicts
                    conflicts={props.conflicts}
                    resolutions={props.conflictResolutions}
                    batchChoice={props.conflictBatchChoice ?? null}
                    onResolutionChange={props.onConflictResolutionChange}
                    onBatchChoice={props.onConflictBatchChoice}
                />
            ) : null}
        </>
    );
}

/**
 * Renders the per-tool file-count summary returned by the v4 engine
 * (`POST /api/v1/install/plan`). Three render states:
 *   - loading  → "Calculating install plan…"
 *   - error    → red banner with the server message
 *   - ready    → list of tools + total, or "nothing to install" line
 * road-to-unified-setup § Phase B2.
 */
function InstallPlanSummary(props: {
    byTool: Record<string, number>;
    ready: boolean;
    error: string | null;
}): preact.JSX.Element {
    if (!props.ready && props.error === null) {
        return (
            <section class="ac-wizard__install-plan" aria-live="polite">
                <h3 class="ac-wizard__install-plan-title">Install plan</h3>
                <p class="ac-wizard__install-plan-status">Calculating install plan…</p>
            </section>
        );
    }
    if (props.error !== null) {
        return (
            <section class="ac-wizard__install-plan ac-wizard__install-plan--error" aria-live="polite">
                <h3 class="ac-wizard__install-plan-title">Install plan</h3>
                <p class="ac-wizard__install-plan-status">{props.error}</p>
            </section>
        );
    }
    const entries = Object.entries(props.byTool).filter(([, n]) => n > 0);
    if (entries.length === 0) {
        return (
            <section class="ac-wizard__install-plan" aria-live="polite">
                <h3 class="ac-wizard__install-plan-title">Install plan</h3>
                <p class="ac-wizard__install-plan-status">Nothing to install — no files match the selected tools.</p>
            </section>
        );
    }
    const total = entries.reduce((sum, [, n]) => sum + n, 0);
    return (
        <section class="ac-wizard__install-plan" aria-live="polite">
            <h3 class="ac-wizard__install-plan-title">Install plan</h3>
            <p class="ac-wizard__install-plan-status">
                {total} file{total === 1 ? '' : 's'} across {entries.length} tool{entries.length === 1 ? '' : 's'}.
            </p>
            <ul class="ac-wizard__install-plan-list">
                {entries.map(([tool, n]) => (
                    <li key={tool} class="ac-wizard__install-plan-row">
                        <span class="ac-wizard__install-plan-tool">{tool}</span>
                        <span class="ac-wizard__install-plan-count">{n} file{n === 1 ? '' : 's'}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
