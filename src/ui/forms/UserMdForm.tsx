/**
 * UserMdForm — structured editor for `.agent-user.yml`.
 *
 * Renders a `UserIdentity` object (the post-migration shape — see
 * `docs/contracts/agent-user-schema.md`) as a typed form. The form value
 * IS the identity object; there is no separate frontmatter / content
 * wrapper anymore. Server validates against `userIdentitySchema`.
 *
 * Fields mirror the v1 contract:
 *   - identity.name (required)
 *   - language (BCP-47, autocomplete)
 *   - role[] (≥1, free-form; hidden when `hideRole` — roles come from the
 *     dedicated wizard step in extended mode)
 *   - style.pace (enum)
 *   - voice_sample (required, multiline)
 *   - notes (optional, multiline)
 *   - last_updated (auto-bumped to today on every edit; not exposed)
 *
 * The agent always addresses the user informally ("Du") — formality is not
 * configurable.
 *
 * Errors are keyed by dotted Zod path (`identity.name`, `style.pace`,
 * …) so server-side issues bind to fields with no transformation.
 */

import { useState } from 'preact/hooks';
import { Field } from './Field.js';
import { TextInput } from './TextInput.js';
import { Textarea } from './Textarea.js';
import { Radio } from './Radio.js';
import { Autocomplete } from './Autocomplete.js';
import type { UserIdentity } from '@shared/userMd/schema.js';

/** Non-binding seed suggestions for the role chip-list. UI-only. */
const SEED_ROLE_IDS = [
    'developer',
    'reviewer',
    'designer',
    'product-manager',
    'ops',
    'qa',
    'maintainer',
];

const LANGUAGE_SUGGESTIONS = ['de', 'en', 'en-US', 'en-GB', 'fr', 'es', 'it', 'nl', 'pt', 'pt-BR'];

export interface UserMdFormProps {
    value: UserIdentity;
    onChange: (next: UserIdentity) => void;
    errors?: Record<string, string> | undefined;
    /**
     * Hide the role chip-list — set in the extended wizard, where roles are
     * collected on the dedicated roles step and injected at finish.
     */
    hideRole?: boolean;
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function err(errors: Record<string, string> | undefined, path: string): string | undefined {
    return errors?.[path];
}

export function UserMdForm({ value, onChange, errors, hideRole }: UserMdFormProps): preact.JSX.Element {
    const [pendingRole, setPendingRole] = useState('');
    const roleListId = 'umd-role-suggestions';

    function patch(next: Partial<UserIdentity>): void {
        onChange({ ...value, ...next, last_updated: todayIso() });
    }

    // `defaultIdentity()` seeds `role: ['']` so the YAML stays well-shaped
    // before the user types anything. Render-time filters drop those empty
    // placeholders so an empty pill with a disabled `×` never appears, and
    // the last-entry guard counts only non-empty entries.
    const filledRoles = value.role.filter((r) => r.trim() !== '');

    function addRole(raw: string): void {
        const trimmed = raw.trim();
        if (trimmed === '' || filledRoles.includes(trimmed)) {
            setPendingRole('');
            return;
        }
        patch({ role: [...filledRoles, trimmed] });
        setPendingRole('');
    }

    function removeRole(target: string): void {
        // Schema requires ≥1 — refuse to drop the last non-empty entry; the
        // form surfaces the constraint through the field's disabled state.
        if (filledRoles.length <= 1) return;
        patch({ role: filledRoles.filter((r) => r !== target) });
    }

    function setNotes(raw: string): void {
        // Empty string collapses to undefined so the composed YAML omits
        // the key — keeps the file tidy when there is nothing to remember.
        const next: UserIdentity = { ...value, last_updated: todayIso() };
        if (raw === '') {
            delete next.notes;
        } else {
            next.notes = raw;
        }
        onChange(next);
    }

    const remainingSeeds = SEED_ROLE_IDS.filter((s) => !filledRoles.includes(s));

    return (
        <div class="ac-user-md-form">
            <TextInput
                id="umd-name" name="identity.name" label="Name"
                description="How the agent addresses you in chat (e.g. &quot;Matze&quot;, &quot;Sarah&quot;). Required."
                value={value.identity.name}
                error={err(errors, 'identity.name')}
                onChange={(v): void => patch({ identity: { ...value.identity, name: v } })}
            />
            <Autocomplete
                id="umd-language" name="language" label="Language"
                description="BCP-47 tag the agent mirrors in replies (e.g. 'de', 'en', 'en-US')."
                value={value.language}
                suggestions={LANGUAGE_SUGGESTIONS}
                error={err(errors, 'language')}
                onChange={(v): void => patch({ language: v })}
            />
            {hideRole ? null : (
            <Field
                id="umd-role-input"
                label="Roles"
                description="One or more roles. Seeded suggestions are non-binding — type anything and press Enter."
                error={err(errors, 'role')}
            >
                <ul class="ac-chip-list" data-testid="umd-role-list">
                    {filledRoles.map((r) => (
                        <li key={r} class="ac-chip">
                            <span>{r}</span>
                            <button
                                type="button"
                                class="ac-chip__remove"
                                aria-label={`Remove ${r}`}
                                disabled={filledRoles.length <= 1}
                                onClick={(): void => removeRole(r)}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
                <div class="ac-role-add">
                    <input
                        class="ac-input"
                        type="text"
                        id="umd-role-input"
                        name="role-add"
                        list={roleListId}
                        placeholder="Add a role and press Enter"
                        value={pendingRole}
                        onInput={(e): void => setPendingRole((e.currentTarget as HTMLInputElement).value)}
                        onKeyDown={(e): void => {
                            if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                addRole(pendingRole);
                            }
                        }}
                    />
                    <datalist id={roleListId}>
                        {remainingSeeds.map((s) => <option key={s} value={s} />)}
                    </datalist>
                    <button
                        type="button"
                        class="ac-button"
                        onClick={(): void => addRole(pendingRole)}
                    >
                        Add role
                    </button>
                </div>
            </Field>
            )}
            <Radio
                id="umd-pace" name="style.pace" label="Pace"
                value={value.style.pace}
                error={err(errors, 'style.pace')}
                options={[
                    { value: 'pragmatic', label: 'Pragmatic' },
                    { value: 'thorough', label: 'Thorough' },
                    { value: 'rapid', label: 'Rapid' },
                ]}
                onChange={(v): void => patch({ style: { ...value.style, pace: v as 'pragmatic' | 'thorough' | 'rapid' } })}
            />
            <Textarea
                id="umd-voice" name="voice_sample" label="Voice sample"
                description="One to three sentences in your own style. The agent uses it as a tone anchor."
                rows={4}
                value={value.voice_sample}
                error={err(errors, 'voice_sample')}
                onChange={(v): void => patch({ voice_sample: v })}
            />
            <Textarea
                id="umd-notes" name="notes" label="Notes"
                description="Optional free-form prose the agent remembers across sessions."
                rows={6}
                value={value.notes ?? ''}
                error={err(errors, 'notes')}
                onChange={setNotes}
            />
        </div>
    );
}
