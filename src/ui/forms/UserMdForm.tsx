/**
 * UserMdForm — structured editor for `.agent-user.md` frontmatter + notes.
 *
 * Replaces the raw textarea in the wizard's user-md step (and, optionally,
 * the standalone UserMdPanel) with a typed form that round-trips through
 * `frontmatterSchema` from `@shared/userMd/schema`. Consumers parse the
 * file body via `parseUserMd` before mount and call `composeUserMd` after
 * `onChange` to persist the result.
 *
 * Fields mirror the v1 contract (`docs/contracts/agent-user-schema.md`):
 *   - identity.name (required)
 *   - language (BCP-47, autocomplete)
 *   - role[] (≥1, free-form per contract; seeded suggestions via SEED_ROLE_IDS)
 *   - style.formality, style.pace (enums)
 *   - voice_sample (required, multiline)
 *   - last_updated (auto-set to today on every edit; not exposed)
 *
 * Errors are keyed by dotted Zod path; the route bubbles up validation
 * issues via `body.identity.name`, `body.style.formality`, etc.
 */

import { useState } from 'preact/hooks';
import { Field } from './Field.js';
import { TextInput } from './TextInput.js';
import { Textarea } from './Textarea.js';
import { Radio } from './Radio.js';
import { Autocomplete } from './Autocomplete.js';
import {
    SEED_ROLE_IDS,
    type UserMdFrontmatter,
} from '@shared/userMd/schema.js';

export interface UserMdFormValue {
    frontmatter: UserMdFrontmatter;
    content: string;
}

export interface UserMdFormProps {
    value: UserMdFormValue;
    onChange: (next: UserMdFormValue) => void;
    errors?: Record<string, string> | undefined;
}

const LANGUAGE_SUGGESTIONS = ['de', 'en', 'en-US', 'en-GB', 'fr', 'es', 'it', 'nl', 'pt', 'pt-BR'];

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function err(errors: Record<string, string> | undefined, path: string): string | undefined {
    return errors?.[path];
}

export function UserMdForm({ value, onChange, errors }: UserMdFormProps): preact.JSX.Element {
    const fm = value.frontmatter;
    const [pendingRole, setPendingRole] = useState('');
    const roleListId = 'umd-role-suggestions';

    function patch(next: Partial<UserMdFrontmatter>): void {
        onChange({
            frontmatter: { ...fm, ...next, last_updated: todayIso() },
            content: value.content,
        });
    }

    function setContent(content: string): void {
        onChange({
            frontmatter: { ...fm, last_updated: todayIso() },
            content,
        });
    }

    function addRole(raw: string): void {
        const trimmed = raw.trim();
        if (trimmed === '' || fm.role.includes(trimmed)) {
            setPendingRole('');
            return;
        }
        patch({ role: [...fm.role, trimmed] });
        setPendingRole('');
    }

    function removeRole(target: string): void {
        // Schema requires ≥1 — refuse to drop the last entry; the form
        // surfaces the constraint through the field's disabled state.
        if (fm.role.length <= 1) return;
        patch({ role: fm.role.filter((r) => r !== target) });
    }

    const remainingSeeds = SEED_ROLE_IDS.filter((s) => !fm.role.includes(s));

    return (
        <div class="ac-user-md-form">
            <TextInput
                id="umd-name" name="identity.name" label="Name"
                description="How the agent addresses you in chat (e.g. &quot;Matze&quot;, &quot;Sarah&quot;). Required."
                value={fm.identity.name}
                error={err(errors, 'identity.name')}
                onChange={(v): void => patch({ identity: { ...fm.identity, name: v } })}
            />
            <Autocomplete
                id="umd-language" name="language" label="Language"
                description="BCP-47 tag the agent mirrors in replies (e.g. 'de', 'en', 'en-US')."
                value={fm.language}
                suggestions={LANGUAGE_SUGGESTIONS}
                error={err(errors, 'language')}
                onChange={(v): void => patch({ language: v })}
            />
            <Field
                id="umd-role-input"
                label="Roles"
                description="One or more roles. Seeded suggestions are non-binding — type anything and press Enter."
                error={err(errors, 'role')}
            >
                <ul class="ac-chip-list" data-testid="umd-role-list">
                    {fm.role.map((r) => (
                        <li key={r} class="ac-chip">
                            <span>{r}</span>
                            <button
                                type="button"
                                class="ac-chip__remove"
                                aria-label={`Remove ${r}`}
                                disabled={fm.role.length <= 1}
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
            <Radio
                id="umd-formality" name="style.formality" label="Formality"
                value={fm.style.formality}
                error={err(errors, 'style.formality')}
                options={[
                    { value: 'informal', label: 'Informal (Du / first-name)' },
                    { value: 'formal', label: 'Formal (Sie / surname)' },
                ]}
                onChange={(v): void => patch({ style: { ...fm.style, formality: v as 'informal' | 'formal' } })}
            />
            <Radio
                id="umd-pace" name="style.pace" label="Pace"
                value={fm.style.pace}
                error={err(errors, 'style.pace')}
                options={[
                    { value: 'pragmatic', label: 'Pragmatic' },
                    { value: 'thorough', label: 'Thorough' },
                    { value: 'rapid', label: 'Rapid' },
                ]}
                onChange={(v): void => patch({ style: { ...fm.style, pace: v as 'pragmatic' | 'thorough' | 'rapid' } })}
            />
            <Textarea
                id="umd-voice" name="voice_sample" label="Voice sample"
                description="One to three sentences in your own style. The agent uses it as a tone anchor."
                rows={4}
                value={fm.voice_sample}
                error={err(errors, 'voice_sample')}
                onChange={(v): void => patch({ voice_sample: v })}
            />
            <Textarea
                id="umd-content" name="content" label="Notes"
                description="Free-form notes appended below the frontmatter."
                rows={6}
                value={value.content}
                onChange={setContent}
            />
        </div>
    );
}
