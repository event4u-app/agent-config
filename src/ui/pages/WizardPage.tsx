/**
 * WizardPage — step-by-step setup flow.
 *
 * Phase 3 of the unified-setup-and-settings-gui roadmap. The wizard
 * shares the SchemaForm primitive with SettingsPage so step bodies
 * stay declarative: each step picks a subset of schema paths and
 * renders only those fields. Final step calls `/api/v1/wizard/finish`
 * which dual-writes `.agent-settings.yml` + `settings/.agent-user.yml`
 * via 2PC.
 *
 * Step layout lives in `wizard/steps.ts`. Signal store is in
 * `wizard/state.ts`.
 */

import { useEffect } from 'preact/hooks';
import { apiFetch, ApiCallError } from '../api.js';
import { serverStatus } from '../serverStatus.js';
import { topLevelCopy, fieldErrorMap } from '../copyErrors.js';
import { SchemaForm } from '../forms/SchemaForm.js';
import { UserMdForm } from '../forms/UserMdForm.js';
import { defaultIdentity, mergeIdentity } from '@shared/userMd/formAdapter.js';
import { parseUserIdentity } from '@shared/userMd/utils.js';
import type { UserIdentity } from '@shared/userMd/schema.js';
import type { JsonSchemaLeaf, JsonValue } from '../forms/schemaTypes.js';
import { stepAt } from '../wizard/steps.js';
import { sliceSchema } from '../wizard/sliceSchema.js';
import { StepHeader } from '../wizard/StepHeader.js';
import { StepNav } from '../wizard/StepNav.js';
import { WizardReview } from '../wizard/WizardReview.js';
import {
    activeTotalSteps,
    banner,
    clampStep,
    diffLoading,
    errors,
    extendedSteps,
    getActiveSteps,
    initialSettings,
    legacyHints,
    loaded,
    loadError,
    reviewChanges,
    saving,
    schema,
    settingsLastModified,
    startedAtNow,
    stepIndex,
    userMdBody,
    userMdExists,
    userMdInitial,
    userMdLoaded,
    userMdSkipped,
    values,
    wizardComplete,
    wizardScope,
    type SettingsLegacyHints,
    type WizardServerState,
} from '../wizard/state.js';

interface SettingsGetResponse {
    values: Record<string, JsonValue>;
    lastModified: number;
    path: string;
    schema: JsonSchemaLeaf | { definitions?: Record<string, JsonSchemaLeaf>; $ref?: string };
    legacyHints?: SettingsLegacyHints;
}

interface UserMdGetResponse {
    identity: Record<string, unknown> | null;
    exists: boolean;
    lastModified: number | null;
}

function unwrapSchema(raw: SettingsGetResponse['schema']): JsonSchemaLeaf {
    if ('$ref' in raw && raw.$ref !== undefined && 'definitions' in raw && raw.definitions !== undefined) {
        const name = raw.$ref.replace('#/definitions/', '');
        const def = raw.definitions[name];
        if (def !== undefined) return def;
    }
    return raw as JsonSchemaLeaf;
}

/**
 * Fetch `/api/v1/settings`, falling back to `/api/v1/schema` + empty values
 * on the first-run NOT_FOUND. The wizard is the tool for creating
 * `.agent-settings.yml`, so a missing file is the expected empty state, not
 * an error — surfacing it as `loadError` would render the contradictory
 * "Use the wizard to create it" banner inside the wizard itself.
 */
async function fetchSettingsWithFallback(): Promise<SettingsGetResponse> {
    try {
        return await apiFetch<SettingsGetResponse>('/api/v1/settings');
    } catch (err) {
        if (
            err instanceof ApiCallError
            && err.status === 404
            && err.body.error?.code === 'NOT_FOUND'
        ) {
            const schemaRes = await apiFetch<{ settings: JsonSchemaLeaf }>('/api/v1/schema');
            return {
                values: {},
                lastModified: 0,
                path: '.agent-settings.yml',
                schema: schemaRes.settings,
            };
        }
        throw err;
    }
}

async function loadAll(): Promise<void> {
    loadError.value = null;
    try {
        const [serverState, settingsRes] = await Promise.all([
            apiFetch<WizardServerState>('/api/v1/wizard/state'),
            fetchSettingsWithFallback(),
        ]);
        schema.value = unwrapSchema(settingsRes.schema);
        settingsLastModified.value = settingsRes.lastModified;
        initialSettings.value = settingsRes.values;
        legacyHints.value = settingsRes.legacyHints ?? {};
        // road-to-global-only-install § Phase 1.6 — adopt the server's
        // extended-mode flag BEFORE clamping the resumed step so the
        // 9-step bound is in effect. Older server bundles omit the
        // field; default to false to preserve the canonical 7-step
        // contract.
        extendedSteps.value = serverState.extendedSteps === true;
        // Resume from server partial when present; otherwise seed from disk values.
        const partialKeys = Object.keys(serverState.partial ?? {});
        values.value = partialKeys.length > 0
            ? { ...settingsRes.values, ...serverState.partial }
            : settingsRes.values;
        stepIndex.value = clampStep(serverState.step);
        // Reset on every (re-)load so a stale signal from a previous finish
        // in the same module instance cannot suppress the Finish button.
        wizardComplete.value = false;
        loaded.value = true;
        // Step-specific side-effects on initial load / resume. `goTo` fires
        // these on navigation, but a browser reload (or resume from server
        // partial) lands directly on the step without going through `goTo`,
        // so the userMd fetch / settings diff would otherwise never run and
        // the step body would hang on "Loading .agent-user.yml…" or render
        // an empty review list.
        const resumed = stepAt(stepIndex.value, { extended: extendedSteps.value });
        if (resumed.kind === 'userMd' || resumed.kind === 'review') {
            void loadUserMdOnce();
        }
        if (resumed.kind === 'review') {
            void refreshDiff();
        }
    } catch (err) {
        if (err instanceof ApiCallError) {
            loadError.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
        } else {
            loadError.value = err instanceof Error ? err.message : String(err);
        }
    }
}

/**
 * Seed `identity.name` from a legacy settings hint when the on-disk
 * `.agent-user.yml` does not yet exist. The hint is consumed once — the
 * server strips `personal.user_name` on the next PUT, so subsequent
 * reads return no hint.
 */
function seedIdentityFromHint(current: UserIdentity, hint: string): UserIdentity {
    if (current.identity.name.trim() !== '') return current;
    return { ...current, identity: { ...current.identity, name: hint } };
}

async function loadUserMdOnce(): Promise<void> {
    if (userMdLoaded.value) return;
    try {
        const res = await apiFetch<UserMdGetResponse>('/api/v1/user-md');
        userMdExists.value = res.exists;
        if (res.exists && res.identity !== null) {
            const merged = mergeIdentity(res.identity);
            userMdInitial.value = merged;
            userMdBody.value = merged;
        } else {
            let seed: UserIdentity;
            try {
                const tpl = await apiFetch<{ body: string }>('/api/v1/user-md/template');
                seed = mergeIdentity(parseUserIdentity(tpl.body));
            } catch {
                seed = defaultIdentity();
            }
            const hint = legacyHints.value.user_name;
            if (typeof hint === 'string' && hint.trim() !== '') {
                seed = seedIdentityFromHint(seed, hint);
            }
            // Snapshot for change-detection — diff is against the
            // pre-edit baseline (template + hint), so just landing on the
            // step does not flag the file as "changed".
            userMdInitial.value = seed;
            userMdBody.value = seed;
        }
    } catch (err) {
        banner.value = { message: err instanceof Error ? err.message : String(err), tone: 'error' };
    } finally {
        userMdLoaded.value = true;
    }
}

async function persistStep(nextIndex: number, partial: Record<string, JsonValue>): Promise<void> {
    try {
        await apiFetch('/api/v1/wizard/state', {
            method: 'POST',
            body: {
                step: nextIndex,
                totalSteps: activeTotalSteps(),
                partial,
                startedAt: startedAtNow(null),
            },
        });
    } catch (err) {
        banner.value = { message: err instanceof Error ? err.message : String(err), tone: 'error' };
    }
}


async function refreshDiff(): Promise<void> {
    diffLoading.value = true;
    try {
        const res = await apiFetch<{ changes: { path: string; from: JsonValue; to: JsonValue }[] }>(
            '/api/v1/settings/diff',
            {
                method: 'POST',
                body: { values: values.value, ifUnmodifiedSince: settingsLastModified.value },
            },
        );
        reviewChanges.value = res.changes;
        errors.value = {};
    } catch (err) {
        if (err instanceof ApiCallError) {
            errors.value = fieldErrorMap(err.body.error ?? { code: 'UNKNOWN', message: err.message });
            banner.value = { message: topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message }), tone: 'error' };
        } else {
            banner.value = { message: err instanceof Error ? err.message : String(err), tone: 'error' };
        }
    } finally {
        diffLoading.value = false;
    }
}

function userMdChanged(): boolean {
    if (userMdSkipped.value) return false;
    if (userMdBody.value === null || userMdInitial.value === null) {
        return userMdBody.value !== userMdInitial.value;
    }
    // Structural diff via stringify — keys land in insertion order from
    // `mergeIdentity` so the comparison is stable. Cheap enough for a
    // ~10-field object and avoids pulling a deep-equal helper.
    return JSON.stringify(userMdBody.value) !== JSON.stringify(userMdInitial.value);
}

async function goTo(nextIndex: number): Promise<void> {
    const target = clampStep(nextIndex);
    await persistStep(target, values.value);
    stepIndex.value = target;
    banner.value = null;
    const next = stepAt(target, { extended: extendedSteps.value });
    if (next.kind === 'userMd') {
        void loadUserMdOnce();
    }
    if (next.kind === 'review') {
        void refreshDiff();
    }
}

interface FinishResponse {
    writtenPaths?: string[];
    txnId?: string;
    migratedFrom?: string[];
    ok?: boolean;
    dryRun?: boolean;
    preview?: {
        settingsYaml: string;
        identity: UserIdentity | null;
        userIdentityYaml: string | null;
    };
}

async function finish(): Promise<void> {
    saving.value = true;
    banner.value = null;
    try {
        const body: {
            settings: Record<string, JsonValue>;
            identity?: UserIdentity;
            scope?: 'global' | 'project';
        } = {
            settings: values.value,
        };
        // Send the identity object only when the user actually edited or
        // created it. Skipped / untouched → omit so the server leaves any
        // existing `.agent-user.yml` alone.
        if (userMdChanged() && userMdBody.value !== null) {
            body.identity = userMdBody.value;
        }
        // road-to-global-only-install § Phase 2.3 — include the scope
        // selection only when the server advertised the opt-in. Older
        // server bundles ignore unknown fields, but omitting it on
        // unavailable surfaces keeps the wire shape minimal.
        if (serverStatus.value?.projectScopeAvailable === true) {
            body.scope = wizardScope.value;
        }
        const res = await apiFetch<FinishResponse>(
            '/api/v1/wizard/finish',
            { method: 'POST', body },
        );
        // Server returns either { writtenPaths, txnId } on a real commit
        // or { ok, dryRun, preview } when started with --dry-run. The
        // dry-run shape carries no writtenPaths, so guard the join.
        // Append a close-window hint on every success branch so the user
        // knows the wizard has nothing left to do. The Finish button stays
        // visible but is disabled (canFinish=false because reviewChanges
        // is cleared and userMdInitial is realigned below) and re-enables
        // automatically once a new edit makes canFinish true again.
        const closeHint = 'You can close this browser window now.';
        if (res.dryRun === true) {
            banner.value = { message: `Dry-run complete — no files written. Settings would be saved. ${closeHint}`, tone: 'success' };
        } else if (Array.isArray(res.writtenPaths)) {
            banner.value = { message: `Saved (${res.writtenPaths.join(', ')}). Wizard complete. ${closeHint}`, tone: 'success' };
        } else {
            banner.value = { message: `Wizard complete. ${closeHint}`, tone: 'success' };
        }
        // Drop wizard state on success — server unlinks; mirror locally.
        stepIndex.value = clampStep(activeTotalSteps() - 1);
        // Refresh initialSettings to match the just-written state so a
        // re-entry into the wizard doesn't show stale "changes".
        initialSettings.value = values.value;
        userMdInitial.value = userMdChanged() ? userMdBody.value : userMdInitial.value;
        reviewChanges.value = [];
        wizardComplete.value = true;
    } catch (err) {
        if (err instanceof ApiCallError) {
            errors.value = fieldErrorMap(err.body.error ?? { code: 'UNKNOWN', message: err.message });
            banner.value = { message: topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message }), tone: 'error' };
        } else {
            banner.value = { message: err instanceof Error ? err.message : String(err), tone: 'error' };
        }
    } finally {
        saving.value = false;
    }
}

function StepBody(): preact.JSX.Element | null {
    const step = stepAt(stepIndex.value, { extended: extendedSteps.value });
    if (step.kind === 'form') {
        const sliced = sliceSchema(schema.value!, step.paths ?? []);
        return (
            <SchemaForm
                schema={sliced}
                values={values.value}
                errors={errors.value}
                onChange={(next): void => { values.value = next; }}
            />
        );
    }
    if (step.kind === 'userMd') {
        if (!userMdLoaded.value || userMdBody.value === null) {
            return <p>Loading .agent-user.yml…</p>;
        }
        // Server validates `body.identity` against `userIdentitySchema`,
        // so Zod paths come back as `identity.name`, `style.formality`,
        // … with no wire-level wrapper to strip — they bind 1:1 to the
        // form's field keys.
        return (
            <UserMdForm
                value={userMdBody.value}
                errors={errors.value}
                onChange={(next): void => {
                    userMdBody.value = next;
                    userMdSkipped.value = false;
                }}
            />
        );
    }
    // road-to-global-only-install § Phase 1.4 — placeholder renderers for
    // the extended-mode lead steps. The full picker UI ships in the
    // follow-up phase that wires discovery state into the wizard store;
    // these stubs keep the step navigation walkable today so the 9-step
    // flow is testable end-to-end while the deeper UX is in flight.
    if (step.kind === 'aiTools') {
        return (
            <div class="ac-wizard-step-stub">
                <p>
                    Auto-detected AI tools will appear here. The wizard reads
                    <code> /api/v1/wizard/auto-detect</code> and lets you toggle each
                    discovered tool on or off. Pick-list UI lands in the follow-up
                    extended-mode phase; the endpoint is already live so you can
                    inspect raw output via <code>curl</code> in the meantime.
                </p>
            </div>
        );
    }
    if (step.kind === 'packs') {
        return (
            <div class="ac-wizard-step-stub">
                <p>
                    Capability packs (founder-strategy, finance-basic, gtm-sales,
                    ops-people, ai-video) will appear here. The wizard reads
                    <code> /api/v1/wizard/manifest</code> and lets you toggle each
                    pack on or off. Selection UI lands in the follow-up phase.
                </p>
            </div>
        );
    }
    // review
    return (
        <WizardReview
            steps={getActiveSteps()}
            currentIndex={stepIndex.value}
            changes={reviewChanges.value}
            errors={errors.value}
            userMdChanged={userMdChanged()}
            userMdAction={userMdExists.value ? 'replace' : 'create'}
            loading={diffLoading.value}
            onJump={(i): void => { void goTo(i); }}
            scope={wizardScope.value}
            scopeAvailable={serverStatus.value?.projectScopeAvailable === true}
            onScopeChange={(next): void => { wizardScope.value = next; }}
        />
    );
}

export function WizardPage({ path: _path }: { path: string }): preact.JSX.Element {
    useEffect(() => { void loadAll(); }, []);

    if (!loaded.value || schema.value === null) {
        return (
            <div class="ac-page">
                <h1>Setup wizard</h1>
                {loadError.value !== null
                    ? <p class="ac-banner ac-banner--error">{loadError.value}</p>
                    : <p>Loading…</p>}
            </div>
        );
    }

    const idx = stepIndex.value;
    const total = activeTotalSteps();
    const step = stepAt(idx, { extended: extendedSteps.value });
    const isLast = idx === total - 1;

    return (
        <div class="ac-page">
            <StepHeader
                step={step}
                index={idx}
                total={total}
            />
            {banner.value !== null
                ? (
                    <p class={`ac-banner${banner.value.tone === 'error' ? ' ac-banner--error' : ''}`}>
                        {banner.value.message}
                    </p>
                )
                : null}
            <div class="ac-wizard__step">
                <StepBody />
            </div>
            <StepNav
                canGoPrev={idx > 0}
                canGoNext={!isLast}
                canSkip={step.kind === 'userMd'}
                isLast={isLast}
                busy={saving.value || diffLoading.value}
                canFinish={reviewChanges.value.length > 0 || userMdChanged()}
                completed={wizardComplete.value}
                onPrev={(): void => { void goTo(idx - 1); }}
                onNext={(): void => { void goTo(idx + 1); }}
                onSkip={(): void => { userMdSkipped.value = true; void goTo(idx + 1); }}
                onFinish={(): void => { void finish(); }}
            />
        </div>
    );
}
