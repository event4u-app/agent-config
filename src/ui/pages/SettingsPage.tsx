/**
 * SettingsPage — loads `.agent-settings.yml`, drives SchemaForm, saves
 * with optimistic locking. Diff modal is intentionally simple: list the
 * changed paths before commit so the user confirms the write.
 */

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { apiFetch, ApiCallError } from '../api.js';
import { SchemaForm } from '../forms/SchemaForm.js';
import type { JsonSchemaLeaf, JsonValue } from '../forms/schemaTypes.js';
import { topLevelCopy, fieldErrorMap } from '../copyErrors.js';

interface SettingsGetResponse {
    values: Record<string, JsonValue>;
    lastModified: number;
    path: string;
    schema: JsonSchemaLeaf | { definitions?: Record<string, JsonSchemaLeaf>; $ref?: string };
}

interface DiffChange {
    path: string;
    before: JsonValue;
    after: JsonValue;
}

const loaded = signal(false);
const loadError = signal<string | null>(null);
const values = signal<Record<string, JsonValue>>({});
const schema = signal<JsonSchemaLeaf | null>(null);
const lastModified = signal<number>(0);
const errors = signal<Record<string, string>>({});
const banner = signal<string | null>(null);
const saving = signal(false);
const pendingDiff = signal<DiffChange[] | null>(null);

function unwrap(raw: SettingsGetResponse['schema']): JsonSchemaLeaf {
    if ('$ref' in raw && raw.$ref !== undefined && 'definitions' in raw && raw.definitions !== undefined) {
        const name = raw.$ref.replace('#/definitions/', '');
        const def = raw.definitions[name];
        if (def !== undefined) return def;
    }
    return raw as JsonSchemaLeaf;
}

async function load(): Promise<void> {
    loadError.value = null;
    try {
        const res = await apiFetch<SettingsGetResponse>('/api/v1/settings');
        values.value = res.values;
        schema.value = unwrap(res.schema);
        lastModified.value = res.lastModified;
        loaded.value = true;
    } catch (err) {
        loadError.value = err instanceof Error ? err.message : String(err);
    }
}

async function preview(): Promise<void> {
    if (saving.value) return;
    banner.value = null;
    errors.value = {};
    try {
        const res = await apiFetch<{ changes: DiffChange[] }>('/api/v1/settings/diff', {
            method: 'POST',
            body: { values: values.value, ifUnmodifiedSince: lastModified.value },
        });
        if (res.changes.length === 0) {
            banner.value = 'No changes to save.';
            return;
        }
        pendingDiff.value = res.changes;
    } catch (err) {
        if (err instanceof ApiCallError) {
            errors.value = fieldErrorMap(err.body.error ?? { code: 'UNKNOWN', message: err.message });
            banner.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
        } else {
            banner.value = err instanceof Error ? err.message : String(err);
        }
    }
}

async function commit(): Promise<void> {
    saving.value = true;
    try {
        const res = await apiFetch<{ lastModified: number; writtenPaths: string[] }>('/api/v1/settings', {
            method: 'PUT',
            headers: { 'If-Unmodified-Since': String(lastModified.value) },
            body: { values: values.value },
        });
        lastModified.value = res.lastModified;
        pendingDiff.value = null;
        banner.value = `Saved (${res.writtenPaths.join(', ')}).`;
    } catch (err) {
        if (err instanceof ApiCallError) {
            errors.value = fieldErrorMap(err.body.error ?? { code: 'UNKNOWN', message: err.message });
            banner.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
        } else {
            banner.value = err instanceof Error ? err.message : String(err);
        }
    } finally {
        saving.value = false;
    }
}

function DiffModal({ changes }: { changes: DiffChange[] }): preact.JSX.Element {
    return (
        <div class="ac-modal" role="dialog" aria-modal="true" aria-labelledby="diff-title">
            <div class="ac-modal__panel">
                <h2 id="diff-title">Confirm changes</h2>
                <ul class="ac-diff">
                    {changes.map((c) => (
                        <li key={c.path}>
                            <code>{c.path}</code>
                            <span class="ac-diff__before">{JSON.stringify(c.before)}</span>
                            <span class="ac-diff__arrow">→</span>
                            <span class="ac-diff__after">{JSON.stringify(c.after)}</span>
                        </li>
                    ))}
                </ul>
                <div class="ac-modal__actions">
                    <button type="button" class="ac-button" onClick={(): void => { pendingDiff.value = null; }}>
                        Cancel
                    </button>
                    <button type="button" class="ac-button ac-button--primary" disabled={saving.value} onClick={(): void => { void commit(); }}>
                        {saving.value ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function SettingsPage(): preact.JSX.Element {
    useEffect(() => { void load(); }, []);

    if (!loaded.value) {
        return (
            <div class="ac-page">
                <h1>Settings</h1>
                {loadError.value !== null
                    ? <p class="ac-banner ac-banner--error">{loadError.value}</p>
                    : <p>Loading…</p>}
            </div>
        );
    }

    return (
        <div class="ac-page">
            <header class="ac-page__header">
                <h1>Settings</h1>
                <nav class="ac-page__nav">
                    <a href="#/settings/user">Edit .agent-user.md →</a>
                </nav>
            </header>
            {banner.value !== null ? <p class="ac-banner">{banner.value}</p> : null}
            <SchemaForm
                schema={schema.value!}
                values={values.value}
                errors={errors.value}
                onChange={(next): void => { values.value = next; }}
                actions={
                    <>
                        <button type="button" class="ac-button" onClick={(): void => { void load(); }}>
                            Reload
                        </button>
                        <button type="button" class="ac-button ac-button--primary" onClick={(): void => { void preview(); }}>
                            Preview & Save
                        </button>
                    </>
                }
            />
            {pendingDiff.value !== null ? <DiffModal changes={pendingDiff.value} /> : null}
        </div>
    );
}
