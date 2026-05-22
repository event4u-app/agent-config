/**
 * UserMdPanel — read / edit / save `.agent-user.yml`.
 *
 * Loaded by hash route `/settings/user`. Pulls the current identity
 * object + mtime via the user-md route; if the file does not exist
 * yet, falls back to the shipped template parsed through
 * `mergeIdentity` so every field has a default. Saves with
 * `If-Unmodified-Since` only when the file already exists (server
 * treats missing header as "create new").
 *
 * Wire format is `{ identity }` — the server owns YAML serialization,
 * the UI never touches `js-yaml.dump`. Server-side Zod errors arrive
 * keyed by the dotted field path (`identity.name`, `style.formality`,
 * …) which binds 1:1 to UserMdForm field keys; no transformation.
 */

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { apiFetch, ApiCallError } from '../api.js';
import { UserMdForm } from '../forms/UserMdForm.js';
import { defaultIdentity, mergeIdentity } from '@shared/userMd/formAdapter.js';
import { parseUserIdentity } from '@shared/userMd/utils.js';
import type { UserIdentity } from '@shared/userMd/schema.js';
import { topLevelCopy, fieldErrorMap } from '../copyErrors.js';

interface UserMdGetResponse {
    identity: Record<string, unknown> | null;
    exists: boolean;
    lastModified: number | null;
}

interface TemplateResponse {
    body: string;
}

const loaded = signal(false);
const loadError = signal<string | null>(null);
const identity = signal<UserIdentity>(defaultIdentity());
const exists = signal(false);
const lastModified = signal<number | null>(null);
const banner = signal<string | null>(null);
const saving = signal(false);
const errors = signal<Record<string, string>>({});

async function load(): Promise<void> {
    loadError.value = null;
    try {
        const res = await apiFetch<UserMdGetResponse>('/api/v1/user-md');
        exists.value = res.exists;
        lastModified.value = res.lastModified;
        if (res.exists && res.identity !== null) {
            identity.value = mergeIdentity(res.identity);
            banner.value = null;
        } else {
            try {
                const tpl = await apiFetch<TemplateResponse>('/api/v1/user-md/template');
                identity.value = mergeIdentity(parseUserIdentity(tpl.body));
                banner.value = 'File does not exist yet — loaded shipped template. Save to create it.';
            } catch {
                identity.value = defaultIdentity();
                banner.value = 'File does not exist yet — fill the form and save.';
            }
        }
        loaded.value = true;
    } catch (err) {
        loadError.value = err instanceof Error ? err.message : String(err);
    }
}

async function save(): Promise<void> {
    saving.value = true;
    banner.value = null;
    errors.value = {};
    try {
        const headers: Record<string, string> = {};
        if (exists.value && lastModified.value !== null) {
            headers['If-Unmodified-Since'] = String(lastModified.value);
        }
        const res = await apiFetch<{ lastModified: number; writtenPaths: string[] }>('/api/v1/user-md', {
            method: 'PUT',
            headers,
            body: { identity: identity.value },
        });
        lastModified.value = res.lastModified;
        exists.value = true;
        banner.value = `Saved (${res.writtenPaths.join(', ')}).`;
    } catch (err) {
        if (err instanceof ApiCallError) {
            const errBody = err.body.error ?? { code: 'UNKNOWN', message: err.message };
            // Zod paths bind directly to UserMdForm field keys — the
            // server validates `body.identity` against
            // `userIdentitySchema`, so paths come back as `identity.name`,
            // `style.formality`, … with no wire-level wrapper to strip.
            errors.value = fieldErrorMap(errBody);
            banner.value = topLevelCopy(errBody);
        } else {
            banner.value = err instanceof Error ? err.message : String(err);
        }
    } finally {
        saving.value = false;
    }
}

export function UserMdPanel(): preact.JSX.Element {
    useEffect(() => { void load(); }, []);

    if (!loaded.value) {
        return (
            <div class="ac-page">
                <h1>.agent-user.yml</h1>
                {loadError.value !== null
                    ? <p class="ac-banner ac-banner--error">{loadError.value}</p>
                    : <p>Loading…</p>}
            </div>
        );
    }

    return (
        <div class="ac-page">
            <header class="ac-page__header">
                <h1>.agent-user.yml</h1>
                <nav class="ac-page__nav">
                    <a href="#/settings">← Back to Settings</a>
                </nav>
            </header>
            {banner.value !== null ? <p class="ac-banner">{banner.value}</p> : null}
            <UserMdForm
                value={identity.value}
                errors={errors.value}
                onChange={(next): void => { identity.value = next; }}
            />
            <div class="ac-form__actions">
                <button type="button" class="ac-button" onClick={(): void => { void load(); }}>
                    Reload
                </button>
                <button
                    type="button"
                    class="ac-button ac-button--primary"
                    disabled={saving.value}
                    onClick={(): void => { void save(); }}
                >
                    {saving.value ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
}
