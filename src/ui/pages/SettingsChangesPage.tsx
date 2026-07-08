/**
 * SettingsChangesPage — upgrade-time settings review
 * (road-to-settings-change-review; council 2026-07-08).
 *
 * Renders the pending settings-surface delta (written by the installer on
 * upgrade) against the user's CURRENT values, grouped by severity:
 *
 *   - Must fix          — stored value invalid under the new surface
 *                         (removed enum value / type change); blocks save.
 *   - Changed defaults  — `adopt` (never customized → preselected to take
 *                         the new default) and `review` (customized →
 *                         keep by default, old→new shown as context).
 *   - New settings      — prefilled with the shipped default; editable.
 *   - New options       — enum vocabulary grew; informational.
 *   - Removed           — key no longer exists; informational (sync parks
 *                         user-only keys, nothing is deleted).
 *
 * One save action: resolutions are applied onto the merged values and
 * written through the existing comment-preserving settings PUT
 * (optimistic locking via If-Unmodified-Since), then the pending delta
 * is acknowledged. Classification is client-side via the shared
 * `settingsSurface` module — the server only serves and clears the flag.
 */

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { apiFetch, ApiCallError } from '../api.js';
import { navigate } from '../router.js';
import {
    classifyChange,
    type ChangeSeverity,
    type SurfaceChange,
    type SurfaceDelta,
    type JsonLike,
} from '../../shared/settingsSurface.js';
import { getValueAt, setValueAt, type JsonValue } from '../forms/schemaTypes.js';
import { topLevelCopy } from '../copyErrors.js';

interface ChangesGetResponse {
    delta: SurfaceDelta;
    source: 'writeRoot' | 'userGlobal';
}

interface SettingsGetResponse {
    values: Record<string, JsonValue>;
    lastModified: number;
}

/** How the user resolved one actionable change. */
interface Resolution {
    /** 'keep' | 'adopt' | 'custom' — must_fix items start unresolved (null). */
    mode: 'keep' | 'adopt' | 'custom' | null;
    /** Custom value (mode === 'custom' or must-fix pick). */
    value?: JsonValue;
}

const loading = signal(true);
const loadError = signal<string | null>(null);
const noPending = signal(false);
const delta = signal<SurfaceDelta | null>(null);
const values = signal<Record<string, JsonValue>>({});
const lastModified = signal<number>(0);
const resolutions = signal<Record<string, Resolution>>({});
const banner = signal<string | null>(null);
const saving = signal(false);
const done = signal(false);

function changeId(c: SurfaceChange): string {
    return `${c.key}:${c.kind}`;
}

async function load(): Promise<void> {
    loading.value = true;
    loadError.value = null;
    noPending.value = false;
    done.value = false;
    try {
        const changes = await apiFetch<ChangesGetResponse>('/api/v1/settings/changes');
        const settings = await apiFetch<SettingsGetResponse>('/api/v1/settings');
        delta.value = changes.delta;
        values.value = settings.values;
        lastModified.value = settings.lastModified;
        seedResolutions(changes.delta, settings.values);
    } catch (err) {
        if (err instanceof ApiCallError && err.status === 404) {
            noPending.value = true;
        } else {
            loadError.value = err instanceof Error ? err.message : String(err);
        }
    } finally {
        loading.value = false;
    }
}

/** Preselect per council Q3: adopt-class items start checked; review keeps. */
function seedResolutions(d: SurfaceDelta, vals: Record<string, JsonValue>): void {
    const seeded: Record<string, Resolution> = {};
    for (const c of d.changes) {
        const severity = classifyChange(c, getValueAt(vals, c.key.split('.')) as JsonLike | undefined);
        if (severity === 'adopt') seeded[changeId(c)] = { mode: 'adopt' };
        else if (severity === 'review') seeded[changeId(c)] = { mode: 'keep' };
        else if (severity === 'must_fix') seeded[changeId(c)] = { mode: null };
    }
    resolutions.value = seeded;
}

function severityOf(c: SurfaceChange): ChangeSeverity {
    return classifyChange(c, getValueAt(values.value, c.key.split('.')) as JsonLike | undefined);
}

function setResolution(id: string, res: Resolution): void {
    resolutions.value = { ...resolutions.value, [id]: res };
}

function unresolvedMustFix(): SurfaceChange[] {
    const d = delta.value;
    if (d === null) return [];
    return d.changes.filter((c) => {
        if (severityOf(c) !== 'must_fix') return false;
        const res = resolutions.value[changeId(c)];
        return res === undefined || res.mode === null
            || (res.mode === 'custom' && (res.value === undefined || res.value === ''));
    });
}

/** Apply all resolutions onto the merged values object. */
function applyResolutions(): Record<string, JsonValue> {
    const d = delta.value;
    let next = values.value;
    if (d === null) return next;
    for (const c of d.changes) {
        const res = resolutions.value[changeId(c)];
        if (res === undefined || res.mode === null || res.mode === 'keep') continue;
        const path = c.key.split('.');
        if (res.mode === 'adopt' && c.new?.default !== undefined) {
            next = setValueAt(next, path, c.new.default as JsonValue);
        } else if (res.mode === 'custom' && res.value !== undefined) {
            next = setValueAt(next, path, res.value);
        }
    }
    return next;
}

async function save(): Promise<void> {
    if (saving.value) return;
    const blocking = unresolvedMustFix();
    if (blocking.length > 0) {
        banner.value = `Resolve the ${blocking.length} “Must fix” item${blocking.length === 1 ? '' : 's'} first.`;
        return;
    }
    saving.value = true;
    banner.value = null;
    try {
        const nextValues = applyResolutions();
        if (JSON.stringify(nextValues) !== JSON.stringify(values.value)) {
            const res = await apiFetch<{ lastModified: number }>('/api/v1/settings', {
                method: 'PUT',
                headers: { 'If-Unmodified-Since': String(lastModified.value) },
                body: { values: nextValues },
            });
            values.value = nextValues;
            lastModified.value = res.lastModified;
        }
        await apiFetch('/api/v1/settings/changes/ack', { method: 'POST' });
        done.value = true;
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

async function dismissAll(): Promise<void> {
    if (saving.value) return;
    const blocking = unresolvedMustFix();
    if (blocking.length > 0) {
        banner.value = 'Cannot dismiss — “Must fix” items would leave invalid values in place.';
        return;
    }
    saving.value = true;
    try {
        await apiFetch('/api/v1/settings/changes/ack', { method: 'POST' });
        done.value = true;
    } catch (err) {
        banner.value = err instanceof Error ? err.message : String(err);
    } finally {
        saving.value = false;
    }
}

function fmt(v: JsonLike | JsonValue | undefined): string {
    if (v === undefined) return '—';
    return typeof v === 'string' ? v : JSON.stringify(v);
}

/** Value editor for must-fix / custom entries — enum select or typed input. */
function ValueEditor({ change, id }: { change: SurfaceChange; id: string }): preact.JSX.Element {
    const entry = change.new;
    const res = resolutions.value[id];
    const current = res?.value;
    if (entry?.enum !== undefined) {
        return (
            <select
                class="ac-input"
                aria-label={`New value for ${change.key}`}
                value={current === undefined ? '' : String(current)}
                onChange={(e): void => {
                    const raw = (e.currentTarget as HTMLSelectElement).value;
                    setResolution(id, { mode: 'custom', value: raw });
                }}
            >
                <option value="" disabled>Choose a value…</option>
                {entry.enum.map((opt) => (
                    <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                ))}
            </select>
        );
    }
    if (entry?.type === 'boolean') {
        return (
            <select
                class="ac-input"
                aria-label={`New value for ${change.key}`}
                value={current === undefined ? '' : String(current)}
                onChange={(e): void => {
                    setResolution(id, { mode: 'custom', value: (e.currentTarget as HTMLSelectElement).value === 'true' });
                }}
            >
                <option value="" disabled>Choose…</option>
                <option value="true">true</option>
                <option value="false">false</option>
            </select>
        );
    }
    return (
        <input
            class="ac-input"
            type={entry?.type === 'number' || entry?.type === 'integer' ? 'number' : 'text'}
            aria-label={`New value for ${change.key}`}
            value={current === undefined ? '' : String(current)}
            onInput={(e): void => {
                const raw = (e.currentTarget as HTMLInputElement).value;
                const val: JsonValue = entry?.type === 'number' || entry?.type === 'integer' ? Number(raw) : raw;
                setResolution(id, { mode: 'custom', value: val });
            }}
        />
    );
}

function ChangeCard({ change }: { change: SurfaceChange }): preact.JSX.Element {
    const severity = severityOf(change);
    const id = changeId(change);
    const res = resolutions.value[id];
    const currentValue = getValueAt(values.value, change.key.split('.'));
    return (
        <li class={`ac-change-card ac-change-card--${severity}`} data-key={change.key} data-kind={change.kind}>
            <div class="ac-change-card__head">
                <code class="ac-change-card__key">{change.key}</code>
                <span class={`ac-change-card__badge ac-change-card__badge--${severity}`}>
                    {severity === 'must_fix' ? 'Must fix' : severity === 'adopt' ? 'New default' : severity === 'review' ? 'Review' : 'Info'}
                </span>
            </div>
            {change.new?.description !== undefined
                ? <p class="ac-change-card__desc">{change.new.description}</p>
                : null}
            {change.kind === 'default_changed' ? (
                <>
                    <p class="ac-change-card__detail">
                        Default changed: <code>{fmt(change.old?.default)}</code> → <code>{fmt(change.new?.default)}</code>
                        {severity === 'review' ? <> · your value: <code>{fmt(currentValue)}</code></> : null}
                    </p>
                    <div class="ac-change-card__choices" role="radiogroup" aria-label={`Resolution for ${change.key}`}>
                        <label class="ac-change-card__choice">
                            <input
                                type="radio"
                                name={id}
                                checked={res?.mode === 'adopt'}
                                onChange={(): void => { setResolution(id, { mode: 'adopt' }); }}
                            />
                            <span>Adopt new default (<code>{fmt(change.new?.default)}</code>)</span>
                        </label>
                        <label class="ac-change-card__choice">
                            <input
                                type="radio"
                                name={id}
                                checked={res?.mode === 'keep'}
                                onChange={(): void => { setResolution(id, { mode: 'keep' }); }}
                            />
                            <span>Keep current (<code>{fmt(currentValue ?? change.old?.default)}</code>)</span>
                        </label>
                    </div>
                </>
            ) : null}
            {change.kind === 'enum_removed' ? (
                severity === 'must_fix' ? (
                    <>
                        <p class="ac-change-card__detail">
                            Your value <code>{fmt(currentValue)}</code> is no longer valid — removed option{(change.values?.length ?? 0) === 1 ? '' : 's'}: <code>{(change.values ?? []).join(', ')}</code>. Pick a replacement:
                        </p>
                        <ValueEditor change={change} id={id} />
                    </>
                ) : (
                    <p class="ac-change-card__detail">
                        Removed option{(change.values?.length ?? 0) === 1 ? '' : 's'}: <code>{(change.values ?? []).join(', ')}</code> — your value <code>{fmt(currentValue ?? change.new?.default)}</code> is unaffected.
                    </p>
                )
            ) : null}
            {change.kind === 'enum_added' ? (
                <p class="ac-change-card__detail">
                    New option{(change.values?.length ?? 0) === 1 ? '' : 's'} available: <code>{(change.values ?? []).join(', ')}</code>
                </p>
            ) : null}
            {change.kind === 'added' ? (
                severity === 'must_fix' ? (
                    <>
                        <p class="ac-change-card__detail">New setting without a shipped default — define a value:</p>
                        <ValueEditor change={change} id={id} />
                    </>
                ) : (
                    <p class="ac-change-card__detail">
                        New setting · default: <code>{fmt(change.new?.default)}</code>
                        {change.new?.enum !== undefined ? <> · options: <code>{change.new.enum.join(', ')}</code></> : null}
                    </p>
                )
            ) : null}
            {change.kind === 'removed' ? (
                <p class="ac-change-card__detail">
                    This setting no longer exists. Your stored value is kept in place and ignored (nothing is deleted).
                </p>
            ) : null}
            {change.kind === 'type_changed' ? (
                <>
                    <p class="ac-change-card__detail">
                        Type changed: <code>{change.old?.type}</code> → <code>{change.new?.type}</code>. Define a new value:
                    </p>
                    <ValueEditor change={change} id={id} />
                </>
            ) : null}
        </li>
    );
}

interface Group {
    title: string;
    hint?: string;
    changes: SurfaceChange[];
}

function buildGroups(d: SurfaceDelta): Group[] {
    const bySeverity = new Map<ChangeSeverity, SurfaceChange[]>();
    for (const c of d.changes) {
        const s = severityOf(c);
        bySeverity.set(s, [...(bySeverity.get(s) ?? []), c]);
    }
    const groups: Group[] = [];
    const mustFix = bySeverity.get('must_fix') ?? [];
    if (mustFix.length > 0) {
        groups.push({ title: 'Must fix', hint: 'These stored values are invalid after the upgrade — saving is blocked until each has a valid value.', changes: mustFix });
    }
    const defaults = [...(bySeverity.get('adopt') ?? []), ...(bySeverity.get('review') ?? [])];
    if (defaults.length > 0) {
        groups.push({ title: 'Changed defaults', hint: 'Values you never customized are preselected to adopt the new default; customized values are kept unless you choose otherwise.', changes: defaults });
    }
    const info = bySeverity.get('info') ?? [];
    const added = info.filter((c) => c.kind === 'added');
    const enumAdded = info.filter((c) => c.kind === 'enum_added');
    const rest = info.filter((c) => c.kind !== 'added' && c.kind !== 'enum_added');
    if (added.length > 0) groups.push({ title: 'New settings', changes: added });
    if (enumAdded.length > 0) groups.push({ title: 'New options', changes: enumAdded });
    if (rest.length > 0) groups.push({ title: 'Removed / other', changes: rest });
    return groups;
}

export function SettingsChangesPage(): preact.JSX.Element {
    useEffect(() => { void load(); }, []);

    if (loading.value) {
        return <div class="ac-page"><h1>Settings changes</h1><p>Loading…</p></div>;
    }
    if (loadError.value !== null) {
        return (
            <div class="ac-page">
                <h1>Settings changes</h1>
                <p class="ac-banner ac-banner--error">{loadError.value}</p>
            </div>
        );
    }
    if (done.value || noPending.value) {
        return (
            <div class="ac-page ac-settings-changes">
                <h1>Settings changes</h1>
                <p class="ac-banner">
                    {done.value ? 'Review complete — all changes resolved.' : 'Nothing to review — your settings are up to date.'}
                </p>
                <button type="button" class="ac-button" onClick={(): void => navigate('/settings')}>
                    Back to Settings
                </button>
            </div>
        );
    }

    const d = delta.value;
    if (d === null) return <div class="ac-page"><h1>Settings changes</h1></div>;
    const groups = buildGroups(d);
    const blocking = unresolvedMustFix().length;

    return (
        <div class="ac-page ac-settings-changes">
            <header class="ac-page__header">
                <h1>Settings changes</h1>
                <p class="ac-page__lede">
                    The upgrade <code>{d.oldVersion}</code> → <code>{d.newVersion}</code> changed the available
                    settings. Review below — nothing was changed automatically.
                </p>
            </header>
            {banner.value !== null ? <p class="ac-banner ac-banner--error" role="alert">{banner.value}</p> : null}
            {groups.map((g) => (
                <section key={g.title} class="ac-settings-changes__group">
                    <h2>{g.title} <span class="ac-settings-changes__count">({g.changes.length})</span></h2>
                    {g.hint !== undefined ? <p class="ac-settings-changes__hint">{g.hint}</p> : null}
                    <ul class="ac-settings-changes__list">
                        {g.changes.map((c) => <ChangeCard key={changeId(c)} change={c} />)}
                    </ul>
                </section>
            ))}
            <div class="ac-form__actions">
                <button type="button" class="ac-button" disabled={saving.value} onClick={(): void => { void dismissAll(); }}>
                    Dismiss (keep everything)
                </button>
                <button
                    type="button"
                    class="ac-button ac-button--primary"
                    disabled={saving.value || blocking > 0}
                    title={blocking > 0 ? `${blocking} “Must fix” item${blocking === 1 ? '' : 's'} unresolved` : undefined}
                    onClick={(): void => { void save(); }}
                >
                    {saving.value ? 'Saving…' : 'Apply & finish review'}
                </button>
            </div>
        </div>
    );
}

/**
 * Pending-review banner — rendered by the Settings hub (and reusable
 * elsewhere). Cheap probe: one GET; 404 → renders nothing.
 */
const pendingCount = signal<number | null>(null);

export function SettingsChangesBanner(): preact.JSX.Element | null {
    useEffect(() => {
        void (async (): Promise<void> => {
            try {
                const res = await apiFetch<ChangesGetResponse>('/api/v1/settings/changes');
                pendingCount.value = res.delta.changes.length;
            } catch {
                pendingCount.value = null;
            }
        })();
    }, []);
    if (pendingCount.value === null || pendingCount.value === 0) return null;
    return (
        <div class="ac-banner ac-banner--pending" role="status">
            <span>
                An upgrade changed {pendingCount.value} setting{pendingCount.value === 1 ? '' : 's'} — review recommended.
            </span>
            <button type="button" class="ac-button ac-button--small" onClick={(): void => navigate('/settings/changes')}>
                Review changes
            </button>
        </div>
    );
}
