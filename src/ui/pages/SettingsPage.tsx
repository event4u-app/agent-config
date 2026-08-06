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
    /** How each value came to be set — written by `settings:set`, absent before the first one. */
    provenance?: Record<string, ProvenanceEntry>;
}

interface ProvenanceEntry {
    source: string;
    at: string;
}

interface DiffChange {
    path: string;
    from: JsonValue;
    to: JsonValue;
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
const provenance = signal<Record<string, ProvenanceEntry>>({});

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
        provenance.value = res.provenance ?? {};
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
            // The diff modal the user just confirmed IS the human review the
            // server's guarded-key gate asks for. Anything reaching this route
            // WITHOUT that flag did not pass a human, which is exactly the
            // caller the gate exists to stop.
            body: { values: values.value, confirmGuarded: true },
        });
        lastModified.value = res.lastModified;
        pendingDiff.value = null;
        banner.value = `Saved (${res.writtenPaths.join(', ')}).`;
    } catch (err) {
        if (err instanceof ApiCallError) {
            const ctx = err.body.error ?? { code: 'UNKNOWN', message: err.message };
            errors.value = fieldErrorMap(ctx);
            banner.value = topLevelCopy(ctx);
            // Close the modal so the user can act on the inline field errors;
            // focus lands on the first errored field. Roadmap § 2.2.
            pendingDiff.value = null;
            const firstPath = Object.keys(errors.value)[0];
            if (firstPath !== undefined) {
                queueMicrotask(() => {
                    const el = document.getElementById(firstPath);
                    if (el !== null) (el as HTMLElement).focus();
                });
            }
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
                            <span class="ac-diff__before">{JSON.stringify(c.from)}</span>
                            <span class="ac-diff__arrow">→</span>
                            <span class="ac-diff__after">{JSON.stringify(c.to)}</span>
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

/**
 * How each recorded value came to be set.
 *
 * Deliberately a separate table rather than a column inside the form: the form
 * is generated from the JSON schema and shows every key, while provenance
 * exists only for keys somebody actually decided. Rendering "—" beside 140
 * fields would bury the handful that carry a real answer, and the point of the
 * stamp is that a decision is visible as a decision.
 *
 * Absent before the first `settings:set` write, and that emptiness is stated
 * rather than rendered as a blank table.
 */
function ProvenanceTable({ entries }: { entries: Record<string, ProvenanceEntry> }): preact.JSX.Element {
    const rows = Object.entries(entries).sort(([a], [b]) => a.localeCompare(b));
    return (
        <section class="ac-provenance">
            <h2>How these were set</h2>
            {rows.length === 0
                ? <p>No recorded decisions yet — every value is still its documented default.</p>
                : (
                    <table class="ac-provenance__table">
                        <thead>
                            <tr><th scope="col">Setting</th><th scope="col">Set by</th><th scope="col">When</th></tr>
                        </thead>
                        <tbody>
                            {rows.map(([key, entry]) => (
                                <tr key={key}>
                                    <td><code>{key}</code></td>
                                    <td>{entry.source}</td>
                                    <td>{entry.at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
        </section>
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
                    <a href="#/settings/user">Edit .agent-user.yml →</a>
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
            <ProvenanceTable entries={provenance.value} />
            {pendingDiff.value !== null ? <DiffModal changes={pendingDiff.value} /> : null}
        </div>
    );
}
