/**
 * SettingsHubPage — the standalone settings editor
 * (road-to-setup-experience § Phase 5).
 *
 * Simple/advanced split: fields listed in `BASIC_PATHS` render by
 * default; everything else sits behind a per-section "Show N advanced
 * settings" disclosure. Search matches across BOTH tiers (the split is
 * a navigation aid, never access control). VS-Code-style affordances:
 * left-edge indicator on values that differ from the schema default,
 * an `@modified` filter chip, and per-field reset-to-default.
 *
 * Save flow mirrors the classic SettingsPage: Preview & Save renders
 * the server-computed diff in a confirm modal, PUT uses optimistic
 * locking via `If-Unmodified-Since`.
 */

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { apiFetch, ApiCallError } from '../api.js';
import { SectionBlock, type FieldDecoration } from '../forms/SchemaForm.js';
import {
    flattenSchema,
    getValueAt,
    setValueAt,
    type FlatField,
    type JsonSchemaLeaf,
    type JsonValue,
    type Section,
} from '../forms/schemaTypes.js';
import { isBasicPath } from '../settings/basicPaths.js';
import { topLevelCopy, fieldErrorMap } from '../copyErrors.js';

interface SettingsGetResponse {
    values: Record<string, JsonValue>;
    lastModified: number;
    path: string;
    schema: JsonSchemaLeaf | { definitions?: Record<string, JsonSchemaLeaf>; $ref?: string };
    /** Per-layer provenance — dotted leaf paths present in each layer file. */
    sources?: { global?: string[]; project?: string[] };
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
const searchQuery = signal('');
const modifiedOnly = signal(false);
/** Per-section advanced-disclosure state, keyed by section path. */
const expandedSections = signal<Record<string, boolean>>({});
/** Layer provenance from GET /api/v1/settings (Phase 5.4). */
const layerSources = signal<{ global: Set<string>; project: Set<string> }>({
    global: new Set(),
    project: new Set(),
});

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
        layerSources.value = {
            global: new Set(res.sources?.global ?? []),
            project: new Set(res.sources?.project ?? []),
        };
        loaded.value = true;
    } catch (err) {
        // First-run 404 carries the merged template defaults + schema — the
        // hub can still render and the first save creates the file.
        if (err instanceof ApiCallError && err.status === 404 && err.body.error?.code === 'NOT_FOUND') {
            const body = err.body as {
                defaults?: Record<string, JsonValue>;
                schema?: SettingsGetResponse['schema'];
                lastModified?: number;
            };
            if (body.defaults !== undefined && body.schema !== undefined) {
                values.value = body.defaults;
                schema.value = unwrap(body.schema);
                lastModified.value = body.lastModified ?? 0;
                loaded.value = true;
                return;
            }
        }
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
            const ctx = err.body.error ?? { code: 'UNKNOWN', message: err.message };
            errors.value = fieldErrorMap(ctx);
            banner.value = topLevelCopy(ctx);
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

function isModified(field: FlatField): boolean {
    if (field.defaultValue === undefined) return false;
    const current = getValueAt(values.value, field.path);
    if (current === undefined) return false;
    return JSON.stringify(current) !== JSON.stringify(field.defaultValue);
}

function decorate(id: string, field: FlatField): FieldDecoration {
    const modified = isModified(field);
    // Project layer wins over global (deep-merge order) — badge the layer
    // that actually supplies the effective value. No badge = template default.
    const sourceLabel = layerSources.value.project.has(id)
        ? 'project'
        : layerSources.value.global.has(id) && layerSources.value.project.size > 0
            ? 'global'
            : undefined;
    return {
        modified,
        onReset: modified && field.defaultValue !== undefined
            ? (): void => { values.value = setValueAt(values.value, field.path, field.defaultValue as JsonValue); }
            : undefined,
        sourceLabel,
    };
}

function fieldMatchesSearch(field: FlatField, q: string): boolean {
    const needle = q.toLowerCase();
    return field.path.join('.').toLowerCase().includes(needle)
        || field.label.toLowerCase().includes(needle)
        || (field.description ?? '').toLowerCase().includes(needle);
}

interface SectionView {
    section: Section;
    visible: FlatField[];
    hiddenAdvancedCount: number;
    expanded: boolean;
}

/**
 * Partition a section's fields into what renders now vs what hides
 * behind the advanced disclosure. Search and `@modified` bypass the
 * tier split entirely (both tiers are searched/filtered).
 */
function buildSectionView(section: Section): SectionView | null {
    const q = searchQuery.value.trim();
    const filterModified = modifiedOnly.value;
    const key = section.path.join('.');
    const expanded = expandedSections.value[key] === true;

    let fields = section.fields.filter((f) => f.kind !== 'unsupported');
    if (q !== '') fields = fields.filter((f) => fieldMatchesSearch(f, q));
    if (filterModified) fields = fields.filter((f) => isModified(f));

    if (q !== '' || filterModified) {
        // Filtered views bypass the tier split — show every match.
        if (fields.length === 0) return null;
        return { section, visible: fields, hiddenAdvancedCount: 0, expanded };
    }

    const basic = fields.filter((f) => isBasicPath(f.path.join('.')));
    const advanced = fields.filter((f) => !isBasicPath(f.path.join('.')));
    const visible = expanded ? [...basic, ...advanced] : basic;
    if (visible.length === 0 && advanced.length === 0) return null;
    return {
        section,
        visible,
        hiddenAdvancedCount: expanded ? 0 : advanced.length,
        expanded,
    };
}

function toggleSection(key: string): void {
    expandedSections.value = { ...expandedSections.value, [key]: expandedSections.value[key] !== true };
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

export function SettingsHubPage(): preact.JSX.Element {
    useEffect(() => { void load(); }, []);

    if (!loaded.value || schema.value === null) {
        return (
            <div class="ac-page">
                <h1>Settings</h1>
                {loadError.value !== null
                    ? <p class="ac-banner ac-banner--error">{loadError.value}</p>
                    : <p>Loading…</p>}
            </div>
        );
    }

    const sections = flattenSchema(schema.value);
    const views = sections
        .map(buildSectionView)
        .filter((v): v is SectionView => v !== null);
    const modifiedCount = sections
        .flatMap((s) => s.fields)
        .filter((f) => isModified(f)).length;
    const filtering = searchQuery.value.trim() !== '' || modifiedOnly.value;

    return (
        <div class="ac-page ac-settings-hub">
            <header class="ac-page__header">
                <h1>Settings</h1>
                <nav class="ac-page__nav">
                    <a href="#/settings/user">Edit .agent-user.yml →</a>
                </nav>
            </header>
            <div class="ac-settings-hub__toolbar" role="search">
                <input
                    class="ac-input ac-settings-hub__search"
                    type="search"
                    placeholder="Search all settings (basic and advanced)…"
                    value={searchQuery.value}
                    onInput={(e): void => { searchQuery.value = (e.currentTarget as HTMLInputElement).value; }}
                />
                <button
                    type="button"
                    class={`ac-chip-toggle${modifiedOnly.value ? ' ac-chip-toggle--active' : ''}`}
                    aria-pressed={modifiedOnly.value}
                    onClick={(): void => { modifiedOnly.value = !modifiedOnly.value; }}
                >
                    @modified{modifiedCount > 0 ? ` (${modifiedCount})` : ''}
                </button>
            </div>
            {banner.value !== null ? <p class="ac-banner">{banner.value}</p> : null}
            <form class="ac-form" onSubmit={(e): void => e.preventDefault()}>
                {views.length === 0
                    ? <p class="ac-settings-hub__empty">No settings match.</p>
                    : views.map((v) => {
                        const key = v.section.path.join('.');
                        return (
                            <SectionBlock
                                key={key}
                                section={{ ...v.section, fields: v.visible }}
                                values={values.value}
                                errors={errors.value}
                                onChange={(next): void => { values.value = next; }}
                                decorate={decorate}
                                footer={!filtering && (v.hiddenAdvancedCount > 0 || v.expanded)
                                    ? (
                                        <button
                                            type="button"
                                            class="ac-settings-hub__disclosure"
                                            aria-expanded={v.expanded}
                                            onClick={(): void => { toggleSection(key); }}
                                        >
                                            {v.expanded
                                                ? 'Hide advanced settings'
                                                : `Show ${v.hiddenAdvancedCount} advanced setting${v.hiddenAdvancedCount === 1 ? '' : 's'}`}
                                        </button>
                                    )
                                    : undefined}
                            />
                        );
                    })}
                <div class="ac-form__actions">
                    <button type="button" class="ac-button" onClick={(): void => { void load(); }}>
                        Reload
                    </button>
                    <button type="button" class="ac-button ac-button--primary" onClick={(): void => { void preview(); }}>
                        Preview & Save
                    </button>
                </div>
            </form>
            {pendingDiff.value !== null ? <DiffModal changes={pendingDiff.value} /> : null}
        </div>
    );
}
