/**
 * WizardReview — diff list shown on the final step.
 *
 * Two blocks:
 *   1. Clickable step list — every prior step's navLabel as a button that
 *      calls `onJump(i)` so the user can return to any earlier section to
 *      adjust values. The review step itself is excluded.
 *   2. Diff list — paths + from/to arrows, matching SettingsPage. When
 *      `userMdChanged` is true a synthetic row for `.agent-user.md` is
 *      appended so both files are visible at once.
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
    userMdChanged: boolean;
    userMdAction: 'create' | 'replace' | null;
    loading: boolean;
    onJump: (index: number) => void;
}

function format(value: JsonValue): string {
    if (value === null || value === undefined) return '∅';
    if (typeof value === 'string') return value === '' ? '""' : value;
    return JSON.stringify(value);
}

export function WizardReview(props: WizardReviewProps): preact.JSX.Element {
    const jumpSteps = props.steps.filter((_, i) => i !== props.currentIndex);
    const stepNav = (
        <nav class="ac-wizard__review-nav" aria-label="Jump back to a step">
            <p class="ac-wizard__review-nav-label">Jump back to a step:</p>
            <ul class="ac-wizard__review-nav-list">
                {jumpSteps.map((s) => {
                    const i = props.steps.indexOf(s);
                    return (
                        <li key={s.id}>
                            <button
                                type="button"
                                class="ac-wizard__review-nav-button"
                                onClick={(): void => { props.onJump(i); }}
                            >
                                <span class="ac-wizard__review-nav-index">{i + 1}</span>
                                <span class="ac-wizard__review-nav-text">{s.navLabel}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );

    if (props.loading) {
        return (
            <div class="ac-wizard__review">
                {stepNav}
                <p>Computing diff…</p>
            </div>
        );
    }
    const hasChanges = props.changes.length > 0 || props.userMdChanged;
    if (!hasChanges) {
        return (
            <div class="ac-wizard__review">
                {stepNav}
                <p class="ac-banner">
                    Nothing to write — current values already match `.agent-settings.yml`.
                </p>
            </div>
        );
    }
    return (
        <div class="ac-wizard__review">
            {stepNav}
            <ul class="ac-diff">
                {props.changes.map((c) => (
                    <li key={c.path}>
                        <code>{c.path}</code>
                        <span class="ac-diff__before">{format(c.from)}</span>
                        <span class="ac-diff__arrow">→</span>
                        <span class="ac-diff__after">{format(c.to)}</span>
                    </li>
                ))}
                {props.userMdChanged ? (
                    <li key="__user_md">
                        <code>.agent-user.md</code>
                        <span class="ac-diff__before">
                            {props.userMdAction === 'create' ? '(not present)' : '(existing body)'}
                        </span>
                        <span class="ac-diff__arrow">→</span>
                        <span class="ac-diff__after">
                            {props.userMdAction === 'create' ? 'created' : 'replaced'}
                        </span>
                    </li>
                ) : null}
            </ul>
        </div>
    );
}
