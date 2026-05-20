/**
 * WizardReview — diff list shown on the final step.
 *
 * Reuses the visual language from `SettingsPage` (paths + before/after
 * arrow rows). When `userMdChanged` is true we add a single synthetic
 * row pointing at `.agent-user.md` so the user sees both files in one
 * place.
 */

import type { JsonValue } from '../forms/schemaTypes.js';

export interface DiffRow {
    path: string;
    before: JsonValue;
    after: JsonValue;
}

export interface WizardReviewProps {
    changes: DiffRow[];
    userMdChanged: boolean;
    userMdAction: 'create' | 'replace' | null;
    loading: boolean;
}

function format(value: JsonValue): string {
    if (value === null || value === undefined) return '∅';
    if (typeof value === 'string') return value === '' ? '""' : value;
    return JSON.stringify(value);
}

export function WizardReview(props: WizardReviewProps): preact.JSX.Element {
    if (props.loading) {
        return <p>Computing diff…</p>;
    }
    const hasChanges = props.changes.length > 0 || props.userMdChanged;
    if (!hasChanges) {
        return (
            <p class="ac-banner">
                Nothing to write — current values already match `.agent-settings.yml`.
            </p>
        );
    }
    return (
        <div class="ac-wizard__review">
            <ul class="ac-diff">
                {props.changes.map((c) => (
                    <li key={c.path}>
                        <code>{c.path}</code>
                        <span class="ac-diff__before">{format(c.before)}</span>
                        <span class="ac-diff__arrow">→</span>
                        <span class="ac-diff__after">{format(c.after)}</span>
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
