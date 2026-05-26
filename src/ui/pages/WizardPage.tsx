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
    detectedPackIds,
    diffLoading,
    discoveryLoadError,
    discoveryLoaded,
    discoveryLoading,
    discoveryPacks,
    errors,
    extendedSteps,
    getActiveSteps,
    initialSettings,
    installPlan,
    installPlanError,
    installPlanLoading,
    legacyHints,
    loaded,
    loadError,
    moduleCandidates,
    moduleSelection,
    modulesAgentFolder,
    modulesEnabled,
    modulesLoadError,
    modulesLoaded,
    modulesLoading,
    modulesNamespaceTemplate,
    modulesProjectRoot,
    modulesSkipped,
    reviewChanges,
    saving,
    schema,
    selectedPacks,
    selectedTools,
    settingsLastModified,
    startedAtNow,
    stepIndex,
    userMdBody,
    userMdExists,
    userMdInitial,
    userMdLoaded,
    userMdSkipped,
    VALID_TOOLS,
    values,
    wizardComplete,
    wizardScope,
    type DiscoveryPack,
    type InstallPlanWire,
    type ModulesDetectResponse,
    type ProposedModulesBlock,
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
        if (resumed.kind === 'modules') {
            void loadModulesOnce();
        }
        if (resumed.kind === 'aiTools' || resumed.kind === 'packs') {
            void loadDiscoveryOnce();
        }
        if (resumed.kind === 'review') {
            void refreshDiff();
            void loadInstallPlan();
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

/**
 * Fetch `/api/v1/modules/detect` once per wizard session. The endpoint
 * shells out to `scripts/propose_modules_config.py --json` which can be
 * slow on large repos, so we cache the result behind `modulesLoaded`
 * and only re-fetch on an explicit page reload.
 *
 * On error we surface the message on `modulesLoadError` and leave the
 * candidates list empty — the renderer falls back to the "no roots
 * detected" branch which still lets the user skip the step.
 */
async function loadModulesOnce(): Promise<void> {
    if (modulesLoaded.value || modulesLoading.value) return;
    modulesLoading.value = true;
    modulesLoadError.value = null;
    try {
        const res = await apiFetch<ModulesDetectResponse>('/api/v1/modules/detect');
        moduleCandidates.value = res.candidates;
        modulesProjectRoot.value = res.project_root;
        // Pre-select every detected candidate — the most common path is
        // "yes, all of them"; declining is one click per row.
        const sel: Record<string, boolean> = {};
        for (const c of res.candidates) sel[c.path] = true;
        moduleSelection.value = sel;
        modulesEnabled.value = res.proposed_block.enabled;
        modulesNamespaceTemplate.value = res.proposed_block.namespace_template ?? '';
        modulesAgentFolder.value = res.proposed_block.agent_folder ?? 'agents';
    } catch (err) {
        if (err instanceof ApiCallError) {
            modulesLoadError.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
        } else {
            modulesLoadError.value = err instanceof Error ? err.message : String(err);
        }
    } finally {
        modulesLoading.value = false;
        modulesLoaded.value = true;
    }
}

interface ManifestResponse {
    packs?: Array<{
        id: string;
        label?: string;
        description?: string;
        requires_hint?: string[];
    }>;
}

interface AutoDetectResponse {
    root: string;
    signals: Array<{ id: string; reason: string; evidence: string }>;
}

/**
 * Fetch the discovery manifest + auto-detect signals once per session
 * (road-to-global-only-install § Phase 2). Both endpoints are gated on
 * extended-mode (HTTP 404 in legacy 7-step bundles); the loader stays
 * silent in that case so older servers don't break the step navigation.
 *
 * Detection signals arrive with a `pack-` prefix (`pack-php`, `pack-js`,
 * …); the loader strips it so the ids join 1:1 to the manifest's pack
 * ids. Detected packs are pre-selected on first load — declining is one
 * click per row.
 */
async function loadDiscoveryOnce(): Promise<void> {
    if (discoveryLoaded.value || discoveryLoading.value) return;
    discoveryLoading.value = true;
    discoveryLoadError.value = null;
    try {
        const [manifest, autoDetect] = await Promise.all([
            apiFetch<ManifestResponse>('/api/v1/wizard/manifest'),
            apiFetch<AutoDetectResponse>('/api/v1/wizard/auto-detect'),
        ]);
        const packs: DiscoveryPack[] = (manifest.packs ?? []).map((p) => ({
            id: p.id,
            label: p.label ?? p.id,
            description: p.description ?? '',
            requires_hint: p.requires_hint,
        }));
        discoveryPacks.value = packs;
        // Strip the `pack-` prefix so ids match the manifest. Unknown
        // signals (e.g. future detector additions not yet in the
        // manifest) are dropped silently rather than rendering as
        // orphan checkboxes.
        const knownIds = new Set(packs.map((p) => p.id));
        const detected = autoDetect.signals
            .map((s) => s.id.startsWith('pack-') ? s.id.slice(5) : s.id)
            .filter((id) => knownIds.has(id));
        detectedPackIds.value = detected;
        // Pre-select detected packs only when the user hasn't already
        // touched the selection (e.g. resume from server partial).
        if (Object.keys(selectedPacks.value).length === 0) {
            const seed: Record<string, boolean> = {};
            for (const id of detected) seed[id] = true;
            selectedPacks.value = seed;
        }
    } catch (err) {
        if (err instanceof ApiCallError) {
            discoveryLoadError.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
        } else {
            discoveryLoadError.value = err instanceof Error ? err.message : String(err);
        }
    } finally {
        discoveryLoading.value = false;
        discoveryLoaded.value = true;
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

/**
 * Fetch the install plan for the current AI-tool selection from the v4
 * TypeScript engine (`POST /api/v1/install/plan`, wizard branch). Runs
 * on every Review-step entry so a back-edit on the AI-tools step is
 * reflected without a manual refresh. Empty `selectedTools` → skips
 * the fetch and clears the plan so the Review screen renders the
 * "nothing to install" line. road-to-unified-setup § Phase B2.
 */
async function loadInstallPlan(): Promise<void> {
    const toolIds = Object.entries(selectedTools.value)
        .filter(([, v]) => v === true)
        .map(([id]) => id);
    if (toolIds.length === 0) {
        installPlan.value = null;
        installPlanError.value = null;
        return;
    }
    installPlanLoading.value = true;
    installPlanError.value = null;
    try {
        const res = await apiFetch<InstallPlanWire>(
            '/api/v1/install/plan',
            {
                method: 'POST',
                body: {
                    target: 'global',
                    root: '~',
                    toolIds,
                    policy: {
                        force: false,
                        interactive: true,
                        knownPaths: [],
                        knownPointers: [],
                        defaultStrategy: 'surface-to-ui',
                    },
                },
            },
        );
        installPlan.value = res;
    } catch (err) {
        installPlan.value = null;
        const message = err instanceof ApiCallError
            ? topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message })
            : err instanceof Error ? err.message : String(err);
        installPlanError.value = message;
    } finally {
        installPlanLoading.value = false;
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
    if (next.kind === 'modules') {
        void loadModulesOnce();
    }
    if (next.kind === 'aiTools' || next.kind === 'packs') {
        void loadDiscoveryOnce();
    }
    if (next.kind === 'review') {
        void refreshDiff();
        void loadInstallPlan();
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

interface ApplyResponse {
    ok: boolean;
    dryRun: boolean;
    schemaVersion: 'wizard-v2' | 'installer-v1';
    preview?: string;
}

/**
 * Build the wizard-v2 apply payload from the current selection signals.
 * Returns `null` when no AI tool is checked — the server schema requires
 * `tools.min(1)`, and an empty selection means there is nothing for the
 * installer bridge to do. Packs default to `[]` when unset.
 */
function buildApplyPayload(): {
    schema_version: 'wizard-v2';
    tools: string[];
    packs: string[];
    settings: Record<string, JsonValue>;
    scope_to_project_only?: boolean;
} | null {
    const tools = Object.entries(selectedTools.value)
        .filter(([, v]) => v === true)
        .map(([id]) => id);
    if (tools.length === 0) return null;
    const packs = Object.entries(selectedPacks.value)
        .filter(([, v]) => v === true)
        .map(([id]) => id);
    const payload: {
        schema_version: 'wizard-v2';
        tools: string[];
        packs: string[];
        settings: Record<string, JsonValue>;
        scope_to_project_only?: boolean;
    } = {
        schema_version: 'wizard-v2',
        tools,
        packs,
        settings: values.value,
    };
    if (serverStatus.value?.projectScopeAvailable === true && wizardScope.value === 'project') {
        payload.scope_to_project_only = true;
    }
    return payload;
}

async function finish(): Promise<void> {
    saving.value = true;
    banner.value = null;
    try {
        const body: {
            settings: Record<string, JsonValue>;
            identity?: UserIdentity;
            scope?: 'global' | 'project';
            modulesConfig?: ProposedModulesBlock;
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
        // road-to-configurable-modules § Phase E — include the modules
        // payload only when the maintainer reached the modules step and
        // didn't explicitly skip. Omitted on skip / decline so the team
        // file (`.agent-project-settings.yml`) stays untouched.
        const modulesConfig = buildModulesConfig();
        if (modulesConfig !== null) {
            body.modulesConfig = modulesConfig;
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
        const finishCopy = res.dryRun === true
            ? `Dry-run complete — no files written. Settings would be saved.`
            : Array.isArray(res.writtenPaths)
                ? `Saved (${res.writtenPaths.join(', ')}). Wizard complete.`
                : `Wizard complete.`;
        // road-to-global-only-install § Phase 1.5 — Wizard Apply bridge.
        // After the 2PC settings commit lands, hand the AI-tool + pack
        // selection to `/api/v1/wizard/apply` so `scripts/install.py`
        // can dry-run the install plan. The server forces `dry_run:true`
        // until Phase 1.9 — the preview text comes back as
        // installer-side stdout. Skipped when no tool is selected
        // (schema requires `tools.min(1)`) or when extended-mode is off
        // (endpoint returns 404). Apply failures are soft: settings are
        // already persisted, so we surface the error as a warning
        // instead of rolling the banner back to red.
        const applyPayload = extendedSteps.value ? buildApplyPayload() : null;
        let applyCopy = '';
        if (applyPayload !== null) {
            try {
                const applyRes = await apiFetch<ApplyResponse>(
                    '/api/v1/wizard/apply',
                    { method: 'POST', body: applyPayload },
                );
                const toolCount = applyPayload.tools.length;
                const packCount = applyPayload.packs.length;
                applyCopy = applyRes.dryRun
                    ? ` Installer dry-run planned ${toolCount} tool${toolCount === 1 ? '' : 's'}` +
                      (packCount > 0 ? ` and ${packCount} pack${packCount === 1 ? '' : 's'}.` : '.')
                    : ` Installer applied ${toolCount} tool${toolCount === 1 ? '' : 's'}` +
                      (packCount > 0 ? ` and ${packCount} pack${packCount === 1 ? '' : 's'}.` : '.');
            } catch (err) {
                const message = err instanceof ApiCallError
                    ? topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message })
                    : err instanceof Error ? err.message : String(err);
                applyCopy = ` Installer bridge failed: ${message}. Settings were saved; re-run the wizard to retry the install plan.`;
            }
        }
        banner.value = { message: `${finishCopy}${applyCopy} ${closeHint}`, tone: 'success' };
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

/**
 * Renderer for the extended-mode `modules` step. Bespoke (not driven by
 * `SchemaForm`) because the data source is the live `/modules/detect`
 * scan, not the static settings schema — candidates change per project,
 * per branch, even per commit. road-to-configurable-modules § Phase E.
 *
 * UI shape:
 *   - Loading spinner while detection runs.
 *   - Error banner with retry copy when the bridge fails.
 *   - "No roots detected" branch with a skip hint when the scan finds
 *     nothing — the user can still click Skip on the StepNav to leave
 *     `.agent-project-settings.yml` untouched.
 *   - One checkbox per detected candidate; pre-selected on first load.
 *   - Two text inputs for `namespace_template` and `agent_folder`
 *     (default `agents`) so a maintainer can tighten the proposal
 *     before persisting.
 *   - Master enable/disable toggle — turning it off writes
 *     `modules.enabled: false` so the team file stays explicit.
 */
function ModulesStepBody(): preact.JSX.Element {
    if (modulesLoading.value) {
        return <p>Detecting module roots…</p>;
    }
    if (modulesLoadError.value !== null) {
        return (
            <div class="ac-wizard-step-stub">
                <p class="ac-banner ac-banner--error">
                    Module detection failed: {modulesLoadError.value}
                </p>
                <p>
                    You can skip this step — `.agent-project-settings.yml` will be
                    left as-is. Re-run the wizard after fixing the underlying
                    bridge to populate `modules:` automatically.
                </p>
            </div>
        );
    }
    const candidates = moduleCandidates.value;
    const sel = moduleSelection.value;
    const root = modulesProjectRoot.value;
    return (
        <div class="ac-wizard-step-stub">
            {root !== null
                ? (
                    <p>
                        Scanning <code>{root}</code>. Pick which detected roots the
                        agent should treat as modules. Skip leaves
                        <code> .agent-project-settings.yml</code> untouched.
                    </p>
                )
                : null}
            <label>
                <input
                    type="checkbox"
                    checked={modulesEnabled.value}
                    onChange={(e): void => {
                        modulesEnabled.value = (e.currentTarget as HTMLInputElement).checked;
                        modulesSkipped.value = false;
                    }}
                />
                {' '}Enable module discovery (writes <code>modules.enabled</code>)
            </label>
            {candidates.length === 0
                ? (
                    <p>
                        <em>No module roots detected.</em> The wizard found no
                        common module layouts (Laravel <code>app/Modules/</code>,
                        Symfony <code>src/Module/</code>, Node <code>packages/</code>,
                        Python <code>src/</code>, Go <code>internal/</code>). Skip to
                        leave <code>modules:</code> blank.
                    </p>
                )
                : (
                    <ul style="list-style: none; padding-left: 0;">
                        {candidates.map((cand) => (
                            <li key={cand.path}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={sel[cand.path] ?? false}
                                        onChange={(e): void => {
                                            const checked = (e.currentTarget as HTMLInputElement).checked;
                                            moduleSelection.value = { ...sel, [cand.path]: checked };
                                            modulesSkipped.value = false;
                                        }}
                                    />
                                    {' '}<code>{cand.path}</code> — {cand.stack}{' '}
                                    <small>({cand.confidence} confidence)</small>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            <label>
                Namespace template:{' '}
                <input
                    type="text"
                    value={modulesNamespaceTemplate.value}
                    placeholder="e.g. App\\Modules\\{ModuleName}\\App"
                    onInput={(e): void => {
                        modulesNamespaceTemplate.value = (e.currentTarget as HTMLInputElement).value;
                        modulesSkipped.value = false;
                    }}
                />
            </label>
            <label>
                Agent folder:{' '}
                <input
                    type="text"
                    value={modulesAgentFolder.value}
                    placeholder="agents"
                    onInput={(e): void => {
                        modulesAgentFolder.value = (e.currentTarget as HTMLInputElement).value;
                        modulesSkipped.value = false;
                    }}
                />
            </label>
        </div>
    );
}

/**
 * Build the `modulesConfig` body sent to `/api/v1/wizard/finish` when
 * the user didn't skip the modules step. Filters `moduleSelection` to
 * the keys that are still in the candidates list (defends against a
 * stale selection if the candidates were refreshed) and intersects
 * with truthy values. Returns `null` when nothing should be persisted.
 */
function buildModulesConfig(): ProposedModulesBlock | null {
    if (modulesSkipped.value) return null;
    if (!modulesLoaded.value) return null;
    const knownPaths = new Set(moduleCandidates.value.map((c) => c.path));
    const sel = moduleSelection.value;
    const root_paths = Object.keys(sel).filter((p) => sel[p] === true && knownPaths.has(p));
    return {
        enabled: modulesEnabled.value,
        root_paths,
        namespace_template: modulesNamespaceTemplate.value,
        agent_folder: modulesAgentFolder.value || 'agents',
    };
}

/**
 * Renderer for the extended-mode `ai-tools` step. The list is static
 * (mirrors `_VALID_TOOLS` in `scripts/install.py`) because tools are a
 * substrate-level concept — which AI client the user runs — not a
 * package artefact discovered from the manifest.
 *
 * Selection is stored in `selectedTools` and consumed by the eventual
 * Wizard Apply bridge (road-to-global-only-install § Phase 1.5). The
 * current finish endpoint accepts only settings + identity, so the
 * selection is captured but not yet persisted — the apply bridge is
 * gated until the merged path ships end-to-end.
 */
function AiToolsStepBody(): preact.JSX.Element {
    const sel = selectedTools.value;
    return (
        <div class="ac-wizard-step-stub">
            <p>
                Pick the AI tools you use. The installer wires each selected
                tool's surface (skills, rules, commands) on apply. You can
                change this list later by re-running the wizard.
            </p>
            <ul style="list-style: none; padding-left: 0;">
                {VALID_TOOLS.map((tool) => (
                    <li key={tool.id}>
                        <label>
                            <input
                                type="checkbox"
                                checked={sel[tool.id] ?? false}
                                onChange={(e): void => {
                                    const checked = (e.currentTarget as HTMLInputElement).checked;
                                    selectedTools.value = { ...sel, [tool.id]: checked };
                                }}
                            />
                            {' '}{tool.label} <small><code>{tool.id}</code></small>
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Renderer for the extended-mode `packs` step. Reads the live discovery
 * manifest (ADR-015) so the available packs always match the bundle on
 * disk. Auto-detected packs (e.g. `pack-php` when `composer.json` is
 * present) are pre-selected by `loadDiscoveryOnce`.
 *
 * `requires_hint` is surfaced as informational copy under each pack —
 * the installer resolves dependencies at apply time, so the wizard
 * does not force the user to tick the hinted parents.
 */
function PacksStepBody(): preact.JSX.Element {
    if (discoveryLoading.value) {
        return <p>Loading discovery manifest…</p>;
    }
    if (discoveryLoadError.value !== null) {
        return (
            <div class="ac-wizard-step-stub">
                <p class="ac-banner ac-banner--error">
                    Discovery failed: {discoveryLoadError.value}
                </p>
                <p>
                    The manifest endpoint is gated on extended-mode. Re-run the
                    server with extended steps enabled to populate this list.
                </p>
            </div>
        );
    }
    const packs = discoveryPacks.value;
    const sel = selectedPacks.value;
    const detected = new Set(detectedPackIds.value);
    return (
        <div class="ac-wizard-step-stub">
            <p>
                Pick the capability packs to install. Auto-detected packs are
                pre-selected based on files in your project root.
            </p>
            {packs.length === 0
                ? <p><em>No packs available in the manifest.</em></p>
                : (
                    <ul style="list-style: none; padding-left: 0;">
                        {packs.map((pack) => (
                            <li key={pack.id}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={sel[pack.id] ?? false}
                                        onChange={(e): void => {
                                            const checked = (e.currentTarget as HTMLInputElement).checked;
                                            selectedPacks.value = { ...sel, [pack.id]: checked };
                                        }}
                                    />
                                    {' '}<strong>{pack.label}</strong>{' '}
                                    <small><code>{pack.id}</code></small>
                                    {detected.has(pack.id)
                                        ? <small> — <em>auto-detected</em></small>
                                        : null}
                                    {pack.description !== ''
                                        ? <div><small>{pack.description}</small></div>
                                        : null}
                                    {pack.requires_hint && pack.requires_hint.length > 0
                                        ? (
                                            <div>
                                                <small>
                                                    Requires: {pack.requires_hint.map((r) => <code key={r}>{r}</code>).reduce<preact.JSX.Element[]>((acc, el, i) => i === 0 ? [el] : [...acc, <>, </>, el], [])}
                                                </small>
                                            </div>
                                        )
                                        : null}
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
        </div>
    );
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
    if (step.kind === 'aiTools') {
        return <AiToolsStepBody />;
    }
    if (step.kind === 'packs') {
        return <PacksStepBody />;
    }
    if (step.kind === 'modules') {
        return <ModulesStepBody />;
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
            selectedToolsCount={Object.values(selectedTools.value).filter(Boolean).length}
            selectedPacksCount={Object.values(selectedPacks.value).filter(Boolean).length}
            installPlanByTool={extendedSteps.value ? installPlanByTool() : undefined}
            installPlanReady={extendedSteps.value ? installPlan.value !== null : undefined}
            installPlanError={extendedSteps.value && !installPlanLoading.value ? installPlanError.value : null}
        />
    );
}

/**
 * Collapse the InstallPlan wire shape into the flat per-tool count map
 * the Review panel consumes. Returns an empty map when the plan hasn't
 * loaded yet (the panel renders the loading state in that branch).
 * road-to-unified-setup § Phase B2.
 */
function installPlanByTool(): Record<string, number> {
    const plan = installPlan.value;
    if (plan === null) return {};
    const out: Record<string, number> = {};
    for (const [tool, files] of Object.entries(plan.filesByTool)) {
        out[tool] = files.length;
    }
    return out;
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
                canSkip={step.kind === 'userMd' || step.kind === 'modules'}
                isLast={isLast}
                busy={saving.value || diffLoading.value}
                canFinish={reviewChanges.value.length > 0 || userMdChanged()}
                completed={wizardComplete.value}
                onPrev={(): void => { void goTo(idx - 1); }}
                onNext={(): void => { void goTo(idx + 1); }}
                onSkip={(): void => {
                    if (step.kind === 'modules') {
                        modulesSkipped.value = true;
                    } else {
                        userMdSkipped.value = true;
                    }
                    void goTo(idx + 1);
                }}
                onFinish={(): void => { void finish(); }}
            />
        </div>
    );
}
