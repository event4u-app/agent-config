/**
 * UserMdPanel — read / edit / save `.agent-user.md`.
 *
 * Loaded by hash route `/settings/user`. Pulls the current body + mtime
 * via the user-md route; if the file does not exist yet, falls back to
 * the shipped template. Saves with `If-Unmodified-Since` only when the
 * file already exists (server treats missing header as "create new").
 */

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { apiFetch, ApiCallError } from '../api.js';
import { Textarea } from '../forms/Textarea.js';
import { topLevelCopy } from '../copyErrors.js';

interface UserMdGetResponse {
    body: string;
    exists: boolean;
    lastModified: number | null;
}

interface TemplateResponse {
    body: string;
}

const loaded = signal(false);
const loadError = signal<string | null>(null);
const body = signal<string>('');
const exists = signal(false);
const lastModified = signal<number | null>(null);
const banner = signal<string | null>(null);
const saving = signal(false);

async function load(): Promise<void> {
    loadError.value = null;
    try {
        const res = await apiFetch<UserMdGetResponse>('/api/v1/user-md');
        body.value = res.body;
        exists.value = res.exists;
        lastModified.value = res.lastModified;
        if (!res.exists) {
            try {
                const tpl = await apiFetch<TemplateResponse>('/api/v1/user-md/template');
                body.value = tpl.body;
                banner.value = 'File does not exist yet — loaded shipped template. Save to create it.';
            } catch {
                banner.value = 'File does not exist yet — write freely and save.';
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
    try {
        const headers: Record<string, string> = {};
        if (exists.value && lastModified.value !== null) {
            headers['If-Unmodified-Since'] = String(lastModified.value);
        }
        const res = await apiFetch<{ lastModified: number; writtenPaths: string[] }>('/api/v1/user-md', {
            method: 'PUT',
            headers,
            body: { body: body.value },
        });
        lastModified.value = res.lastModified;
        exists.value = true;
        banner.value = `Saved (${res.writtenPaths.join(', ')}).`;
    } catch (err) {
        if (err instanceof ApiCallError) {
            banner.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
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
                <h1>.agent-user.md</h1>
                {loadError.value !== null
                    ? <p class="ac-banner ac-banner--error">{loadError.value}</p>
                    : <p>Loading…</p>}
            </div>
        );
    }

    return (
        <div class="ac-page">
            <header class="ac-page__header">
                <h1>.agent-user.md</h1>
                <nav class="ac-page__nav">
                    <a href="#/settings">← Back to Settings</a>
                </nav>
            </header>
            {banner.value !== null ? <p class="ac-banner">{banner.value}</p> : null}
            <Textarea
                id="user-md-body"
                name="body"
                label="Body"
                description="Long-form persona / preferences. Stored as-is at .agent-user.md."
                rows={24}
                value={body.value}
                onChange={(next): void => { body.value = next; }}
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
