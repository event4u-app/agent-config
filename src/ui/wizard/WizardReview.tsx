/**
 * WizardReview — final step. Lists each prior step as a clickable box
 * with a right-aligned status indicator. The verbose diff list was
 * removed in favour of per-step change counts; details live one click
 * away on each section.
 *
 * Path ownership: exact match against `step.paths` for form steps,
 * plus the cost step owns the `telegraph.*` / `verbosity.*` bundles
 * because `rule_loading_tier` selection mutates those keys server-side.
 * The `userMd` step uses `userMdChanged` directly.
 */

import type { JsonValue } from '../forms/schemaTypes.js';
import type { WizardStep } from './steps.js';

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
     * Selection counts surfaced on the aiTools / packs rows of the
     * jump-back nav (road-to-unified-setup § Phase 2). `undefined` keeps
     * the row in its idle state — used in the legacy 7-step flow where
     * neither step is present.
     */
    selectedToolsCount?: number;
    selectedPacksCount?: number;
    /**
     * Installed packs the current selection would remove
     * (road-to-setup-experience § Phase 2). Rendered as a flagged
     * destructive block; Finish stays disabled until `removalsConfirmed`.
     */
    packRemovals?: readonly string[];
    removalsConfirmed?: boolean;
    onConfirmRemovals?: (confirmed: boolean) => void;
    /**
     * "What happens on Finish" summary (road-to-setup-experience
     * § Phase 3.3): selected tool ids and pack additions (selected but
     * not yet installed). Omitted in the non-extended flow.
     */
    selectedToolIds?: readonly string[];
    packAdditions?: readonly string[];
}

function stepOwnsPath(step: WizardStep, path: string): boolean {
    if (step.kind !== 'form' || step.paths === undefined) return false;
    if (step.paths.includes(path)) return true;
    if (step.id === 'cost' && (path.startsWith('telegraph.') || path.startsWith('verbosity.'))) {
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
    const removals = props.packRemovals ?? [];
    const tools = props.selectedToolIds ?? [];
    const additions = props.packAdditions ?? [];
    const settingsCount = props.changes.length;
    const hasSummary = tools.length > 0 || additions.length > 0
        || settingsCount > 0 || props.userMdChanged;
    return (
        <>
            {hasSummary ? (
                <section class="ac-review-summary" aria-label="What happens on Finish">
                    <h2 class="ac-review-summary__title">What happens on Finish</h2>
                    <ul class="ac-review-summary__list">
                        {settingsCount > 0 ? (
                            <li>
                                <strong>{settingsCount}</strong> setting{settingsCount === 1 ? '' : 's'} will change
                                {' '}in <code>.agent-settings.yml</code>.
                            </li>
                        ) : <li>No settings change.</li>}
                        {props.userMdChanged ? (
                            <li>
                                <code>.agent-user.yml</code> will be
                                {' '}{props.userMdAction === 'create' ? 'created' : 'updated'}.
                            </li>
                        ) : null}
                        {tools.length > 0 ? (
                            <li>
                                Config is installed for {tools.length} tool{tools.length === 1 ? '' : 's'}:
                                <span class="ac-review-summary__chips">
                                    {tools.map((t) => <code key={t} class="ac-review-summary__chip">{t}</code>)}
                                </span>
                            </li>
                        ) : null}
                        {additions.length > 0 ? (
                            <li>
                                New pack{additions.length === 1 ? '' : 's'}:
                                <span class="ac-review-summary__chips">
                                    {additions.map((p) => <code key={p} class="ac-review-summary__chip">{p}</code>)}
                                </span>
                            </li>
                        ) : null}
                    </ul>
                </section>
            ) : null}
            {removals.length > 0 ? (
                <div class="ac-review-removals" role="alert">
                    <p class="ac-review-removals__title">
                        ⚠️ {removals.length === 1
                            ? '1 installed pack will be removed'
                            : `${removals.length} installed packs will be removed`}
                    </p>
                    <ul class="ac-review-removals__list">
                        {removals.map((id) => <li key={id}><code>{id}</code></li>)}
                    </ul>
                    <label class="ac-review-removals__confirm">
                        <input
                            type="checkbox"
                            checked={props.removalsConfirmed ?? false}
                            onChange={(e): void => {
                                props.onConfirmRemovals?.((e.currentTarget as HTMLInputElement).checked);
                            }}
                        />
                        <span>
                            I understand these packs will no longer be installed.
                            Re-check them on the packs step to keep them.
                        </span>
                    </label>
                </div>
            ) : null}
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
        </>
    );
}

