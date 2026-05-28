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
import { apiFetch, apiStream, ApiCallError } from '../api.js';
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
import { RecoveryBanner } from '../wizard/RecoveryBanner.js';
import { ContinueScreen } from '../wizard/ContinueScreen.js';
import { BackupScreen } from '../wizard/BackupScreen.js';
import {
    activeTotalSteps,
    aiCouncilConfig,
    aiCouncilKeyInstall,
    aiCouncilKeyPresence,
    aiCouncilLoaded,
    aiCouncilProviders,
    type AiCouncilClassMode,
    type AiCouncilMode,
    type AiCouncilState,
    banner,
    clampStep,
    continueAcknowledged,
    detectedPackIds,
    diffLoading,
    discoveryLoadError,
    discoveryLoaded,
    discoveryLoading,
    discoveryPacks,
    discoveryWorkspaces,
    errors,
    extendedSteps,
    getActiveSteps,
    initialSettings,
    legacyHints,
    legacyV3,
    legacyV3Acknowledged,
    legacyV3Busy,
    legacyV3Error,
    loaded,
    loadError,
    recoveryDismissed,
    recoveryStatus,
    reviewChanges,
    rtkDetectionLoaded,
    rtkInstallCommand,
    rtkInstalled,
    rtkRepo,
    packsTouched,
    saving,
    schema,
    welcomePrefilled,
    selectedPacks,
    selectedRoles,
    selectedTools,
    settingsLastModified,
    startedAtNow,
    stepIndex,
    toolPresence,
    toolsDetectionLoaded,
    toolsDetectionLoading,
    userMdBody,
    userMdExists,
    userMdInitial,
    userMdLoaded,
    userMdSkipped,
    VALID_TOOLS,
    values,
    wizardComplete,
    wizardMode,
    type DiscoveryPack,
    type DiscoveryWorkspace,
    type LegacyV3Status,
    type RecoveryStatus,
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

/**
 * Fetch the recovery status from `/api/v1/install/recovery` — road-to-unified-setup
 * § Phase B4. Silent failure on transport errors so a missing endpoint
 * (older server bundles) never blocks wizard boot; the banner just stays
 * hidden. Aborts the result if the txlog reports a clean tail.
 */
async function loadRecovery(): Promise<void> {
    try {
        const res = await apiFetch<RecoveryStatus>('/api/v1/install/recovery');
        recoveryStatus.value = res.incomplete ? res : null;
    } catch {
        recoveryStatus.value = null;
    }
}

/**
 * Probe the v3 legacy install state via `GET /api/v1/install/legacy-v3` —
 * road-to-unified-setup § E2. Silent failure on transport errors so the
 * wizard never blocks on an older server bundle.
 */
async function loadLegacyV3(): Promise<void> {
    try {
        const res = await apiFetch<LegacyV3Status>('/api/v1/install/legacy-v3');
        legacyV3.value = res.present ? res : null;
    } catch {
        legacyV3.value = null;
    }
}

async function runBackupV3(): Promise<void> {
    legacyV3Busy.value = true;
    legacyV3Error.value = null;
    try {
        await apiFetch('/api/v1/install/backup-v3', { method: 'POST' });
        legacyV3Acknowledged.value = true;
    } catch (err) {
        legacyV3Error.value = err instanceof ApiCallError
            ? topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message })
            : err instanceof Error ? err.message : String(err);
    } finally {
        legacyV3Busy.value = false;
    }
}

async function dismissRecovery(reason: 'resume' | 'rollback' | 'ignore'): Promise<void> {
    try {
        await apiFetch('/api/v1/install/recovery/dismiss', {
            method: 'POST',
            body: { reason },
        });
    } catch (err) {
        banner.value = {
            message: err instanceof Error ? err.message : String(err),
            tone: 'error',
        };
        return;
    }
    recoveryStatus.value = null;
    recoveryDismissed.value = true;
}

async function loadAll(): Promise<void> {
    loadError.value = null;
    try {
        // Phase B4 — fire recovery alongside the regular boot fetches so
        // the banner is ready by the time the wizard renders Step 1.
        void loadRecovery();
        // Phase E2 — v3 legacy probe in parallel; the BackupScreen
        // renders pre-Step-1 when `present: true`.
        void loadLegacyV3();
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
        // road-to-unified-setup § B5 — adopt the wizardMode signal so the
        // continue-screen renders on the right step transition.
        wizardMode.value = serverState.wizardMode ?? null;
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
        if (resumed.kind === 'welcome' || resumed.kind === 'userMd' || resumed.kind === 'review') {
            void loadUserMdOnce();
        }
        if (resumed.kind === 'roles' || resumed.kind === 'aiTools' || resumed.kind === 'packs') {
            void loadDiscoveryOnce();
        }
        if (resumed.kind === 'aiTools') {
            void loadToolDetectionOnce();
        }
        if (resumed.id === 'identity') {
            void loadRtkDetectionOnce();
        }
        if (resumed.kind === 'aiCouncil') {
            void loadAiCouncilOnce();
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

interface ManifestResponse {
    packs?: Array<{
        id: string;
        label?: string;
        description?: string;
        requires_hint?: string[];
        cluster?: string | null;
        workspaces?: string[];
    }>;
    workspaces?: Array<{
        id: string;
        label?: string;
        description?: string;
        default_packs?: string[];
        optional_packs?: string[];
        example_roles?: string[];
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
/**
 * Packs whose presence in the project is NOT a signal that the user wants
 * the pack installed (road-to-wizard-ux-improvements follow-up). Python is
 * the canonical case: a non-engineer may have python on the machine but not
 * need its agent skills.
 */
const NO_AUTODETECT_PACK_IDS = new Set<string>(['python']);

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
            cluster: p.cluster ?? undefined,
            workspaces: p.workspaces,
        }));
        discoveryPacks.value = packs;
        // Role/domain workspaces drive Step 2. The maintainer-only workspace is
        // not a user-facing role, so it never appears as a checkbox.
        discoveryWorkspaces.value = (manifest.workspaces ?? [])
            .filter((w) => w.id !== 'agent-config-maintainer')
            .map((w) => ({
                id: w.id,
                label: w.label ?? w.id,
                description: w.description ?? '',
                default_packs: w.default_packs ?? [],
                optional_packs: w.optional_packs ?? [],
                ...(w.example_roles !== undefined ? { example_roles: w.example_roles } : {}),
            }));
        // Strip the `pack-` prefix so ids match the manifest. Unknown
        // signals (e.g. future detector additions not yet in the
        // manifest) are dropped silently rather than rendering as
        // orphan checkboxes.
        const knownIds = new Set(packs.map((p) => p.id));
        const detected = autoDetect.signals
            .map((s) => s.id.startsWith('pack-') ? s.id.slice(5) : s.id)
            .filter((id) => knownIds.has(id))
            // Presence of a language toolchain is not a request for its pack.
            // Python especially: a PO may have python installed but not need
            // the pack — never auto-detect / pre-select it.
            .filter((id) => !NO_AUTODETECT_PACK_IDS.has(id));
        detectedPackIds.value = detected;
        // Pack pre-selection is driven by the role step (seedPacksFromRoles),
        // not auto-detect alone — see the packs step-entry trigger.
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

interface DetectToolsResponse {
    tools?: Record<string, boolean>;
    /** Tools recorded in the install lockfile — the user's prior selection. */
    configured?: string[];
}

/**
 * Fetch native AI-tool presence once per session (road-to-wizard-ux-improvements
 * § Phase 2) and pre-select detected tools on first run. Gated on extended-mode
 * (HTTP 404 on legacy bundles) — failure leaves `toolPresence` empty so badges
 * render "not installed" and nothing is pre-selected.
 */
async function loadToolDetectionOnce(): Promise<void> {
    if (toolsDetectionLoaded.value || toolsDetectionLoading.value) return;
    toolsDetectionLoading.value = true;
    try {
        const res = await apiFetch<DetectToolsResponse>('/api/v1/wizard/detect-tools');
        const presence = res.tools ?? {};
        const configured = res.configured ?? [];
        toolPresence.value = presence;
        // Only seed when the user hasn't touched the selection yet (and isn't
        // resuming a server partial). Then:
        //   - repeat run (the lockfile records a prior selection) → pre-select
        //     exactly those tools, regardless of what is installed now;
        //   - first run (no prior selection) → pre-select every installed tool
        //     to make zero-state onboarding easier.
        if (Object.keys(selectedTools.value).length === 0) {
            const seed: Record<string, boolean> = {};
            if (configured.length > 0) {
                for (const id of configured) seed[id] = true;
            } else {
                for (const [id, installed] of Object.entries(presence)) {
                    if (installed) seed[id] = true;
                }
            }
            selectedTools.value = seed;
        }
    } catch {
        // Leave toolPresence empty; the badge falls back to "not installed".
    } finally {
        toolsDetectionLoading.value = false;
        toolsDetectionLoaded.value = true;
    }
}

interface DetectRtkResponse {
    installed?: boolean;
    installCommand?: string | null;
    repo?: string;
}

/**
 * Detect rtk presence once per session (road-to-wizard-ux-improvements § Phase
 * 7). Detection is the only source of truth — the result is written into
 * `personal.rtk_installed` so the saved setting always matches reality, never
 * a stale manual toggle. When missing, capture the per-OS install command.
 */
async function loadRtkDetectionOnce(): Promise<void> {
    if (rtkDetectionLoaded.value) return;
    rtkDetectionLoaded.value = true;
    try {
        const res = await apiFetch<DetectRtkResponse>('/api/v1/wizard/detect-rtk');
        const installed = res.installed === true;
        rtkInstalled.value = installed;
        rtkInstallCommand.value = res.installCommand ?? null;
        if (typeof res.repo === 'string') rtkRepo.value = res.repo;
        // Detection wins over whatever was loaded: overwrite the setting.
        values.value = { ...values.value, 'personal.rtk_installed': installed };
    } catch {
        // Extended-mode 404 / failure → leave rtkInstalled null (widget shows
        // an "unknown" state and does not touch the setting).
    }
}

interface AiCouncilGetResponse {
    config: AiCouncilState;
    providers?: string[];
    keyPresence?: Record<string, boolean>;
    keyInstall?: Record<string, string>;
}

/**
 * Load the AI-council config subset once per session (Phase 8). On failure
 * (extended-mode 404 / read error) the config stays null and the step renders
 * an explanatory note instead of controls.
 */
async function loadAiCouncilOnce(): Promise<void> {
    if (aiCouncilLoaded.value) return;
    aiCouncilLoaded.value = true;
    try {
        const res = await apiFetch<AiCouncilGetResponse>('/api/v1/wizard/ai-council');
        aiCouncilConfig.value = res.config;
        aiCouncilProviders.value = res.providers ?? [];
        aiCouncilKeyPresence.value = res.keyPresence ?? {};
        aiCouncilKeyInstall.value = res.keyInstall ?? {};
    } catch {
        // Leave aiCouncilConfig null; the step shows a "config unavailable" note.
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
    if (next.kind === 'welcome' || next.kind === 'userMd') {
        void loadUserMdOnce();
    }
    if (next.kind === 'roles' || next.kind === 'aiTools' || next.kind === 'packs') {
        void loadDiscoveryOnce();
    }
    if (next.kind === 'packs') {
        seedPacksFromRoles();
    }
    if (next.kind === 'aiTools') {
        void loadToolDetectionOnce();
    }
    if (next.id === 'identity') {
        void loadRtkDetectionOnce();
    }
    if (next.kind === 'aiCouncil') {
        void loadAiCouncilOnce();
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

/**
 * Resolve the final pack set submitted to the installer
 * (road-to-wizard-ux-improvements § Phase 4). Starts from the user's truthy
 * selection, drops framework packs whose language (`cluster`) is not selected,
 * then adds the transitive `requires_hint` closure — which pulls
 * `engineering-base` (auto-included whenever needed) plus any language a
 * framework depends on. The installer treats `packs` as an opaque list, so
 * dependency resolution happens here in the wizard.
 */
function resolveSelectedPacks(): string[] {
    const sel = selectedPacks.value;
    const byId = new Map(discoveryPacks.value.map((p) => [p.id, p]));
    const seed = Object.entries(sel)
        .filter(([, v]) => v === true)
        .map(([id]) => id)
        // A framework child counts only when its language tile is on.
        .filter((id) => {
            const cluster = byId.get(id)?.cluster;
            return cluster === undefined || sel[cluster] === true;
        });
    const out = new Set<string>();
    const visit = (id: string): void => {
        if (out.has(id)) return;
        out.add(id);
        for (const dep of byId.get(id)?.requires_hint ?? []) visit(dep);
    };
    for (const id of seed) visit(id);
    return [...out].sort();
}

/**
 * Recommend packs from the selected roles (Step 2 → Step 3). Each chosen
 * workspace contributes its `default_packs`; the union is the recommendation.
 * Auto-detected project packs are folded in too. No-op once the user has
 * manually edited the pack selection, so the recommendation never clobbers a
 * deliberate choice. Re-runs on every packs-step entry while untouched, so
 * changing roles updates the recommendation.
 */
function seedPacksFromRoles(): void {
    if (packsTouched.value) return;
    const roleIds = Object.entries(selectedRoles.value)
        .filter(([, v]) => v === true)
        .map(([id]) => id);
    const byWorkspace = new Map(discoveryWorkspaces.value.map((w) => [w.id, w]));
    const recommended: Record<string, boolean> = {};
    for (const role of roleIds) {
        for (const pack of byWorkspace.get(role)?.default_packs ?? []) recommended[pack] = true;
    }
    // Fold in auto-detected project packs (python already filtered upstream).
    for (const id of detectedPackIds.value) recommended[id] = true;
    selectedPacks.value = recommended;
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
    const packs = resolveSelectedPacks();
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
    // Global-only install: tool files always land in the global tree. The
    // project-scoped surface (modules) is handled by the dedicated Projekt
    // page, not the wizard apply.
    return payload;
}

async function finish(): Promise<void> {
    saving.value = true;
    banner.value = null;
    try {
        const body: {
            settings: Record<string, JsonValue>;
            identity?: UserIdentity;
        } = {
            settings: values.value,
        };
        // Roles come from Step 2 (extended mode) and override the identity's
        // `role[]` — the user-md form no longer asks for them there.
        const roleIds = Object.entries(selectedRoles.value)
            .filter(([, v]) => v === true)
            .map(([id]) => id);
        const hasName = userMdBody.value !== null
            && typeof userMdBody.value.identity?.name === 'string'
            && userMdBody.value.identity.name.trim().length > 0;
        // Send the identity object when the user edited it OR selected roles —
        // but only when a name exists (the schema requires it). Otherwise omit
        // so the server leaves any existing `.agent-user.yml` alone.
        if (userMdBody.value !== null && hasName && (userMdChanged() || roleIds.length > 0)) {
            body.identity = roleIds.length > 0
                ? { ...userMdBody.value, role: roleIds }
                : userMdBody.value;
        }
        // Global-only install: settings always land in the global tree, so
        // no `scope` field is sent (the server defaults to 'global'). The
        // project-scoped surface (modules) lives on the dedicated Projekt
        // page and saves via `/api/v1/modules/apply`, not the wizard finish.
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
        // road-to-single-install-source-of-truth § Phase 2 — Wizard Apply bridge.
        // After the 2PC settings commit lands, hand the AI-tool + pack
        // selection to `/api/v1/wizard/apply` so `scripts/install.py` runs the
        // REAL install (single source of truth, D12). The endpoint streams SSE
        // progress (`progress`/`done`/`error`); we consume it and surface the
        // terminal outcome in the Finish banner. Skipped when no tool is
        // selected (schema requires `tools.min(1)`) or extended-mode is off
        // (endpoint 404s). Apply failures are soft: settings are already
        // persisted, so the error surfaces as a warning, not a red rollback.
        const applyPayload = extendedSteps.value ? buildApplyPayload() : null;
        let applyCopy = '';
        if (applyPayload !== null) {
            try {
                let streamError: string | null = null;
                await apiStream('/api/v1/wizard/apply', applyPayload, (frame) => {
                    if (frame.type === 'error') {
                        streamError = typeof frame.message === 'string' ? frame.message : 'install failed';
                    }
                    // 'progress' / 'done' frames could drive a live progress
                    // bar; the Finish banner only needs the terminal outcome.
                });
                const toolCount = applyPayload.tools.length;
                const packCount = applyPayload.packs.length;
                applyCopy = streamError !== null
                    ? ` Installer failed: ${streamError}. Settings were saved; re-run the wizard to retry.`
                    : ` Installer applied ${toolCount} tool${toolCount === 1 ? '' : 's'}` +
                      (packCount > 0 ? ` and ${packCount} pack${packCount === 1 ? '' : 's'}.` : '.');
            } catch (err) {
                const message = err instanceof ApiCallError
                    ? topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message })
                    : err instanceof Error ? err.message : String(err);
                applyCopy = ` Installer bridge failed: ${message}. Settings were saved; re-run the wizard to retry the install plan.`;
            }
        }
        // road-to-wizard-ux-improvements § Phase 8 — persist the AI-council
        // config (scalar subset) into .ai-council.yml. Best-effort: settings
        // are already committed, so a failure surfaces as a soft warning.
        let councilCopy = '';
        if (extendedSteps.value && aiCouncilConfig.value !== null) {
            try {
                await apiFetch('/api/v1/wizard/ai-council', { method: 'POST', body: aiCouncilConfig.value });
                councilCopy = ' AI Council saved.';
            } catch (err) {
                const message = err instanceof ApiCallError
                    ? topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message })
                    : err instanceof Error ? err.message : String(err);
                councilCopy = ` AI Council save failed: ${message}.`;
            }
        }
        banner.value = { message: `${finishCopy}${applyCopy}${councilCopy} ${closeHint}`, tone: 'success' };
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

const WELCOME_LANGUAGES = ['de', 'en', 'en-US', 'en-GB', 'fr', 'es', 'it', 'nl', 'pt', 'pt-BR'];

/**
 * Pre-fill the welcome step once: the name from the OS account (when the
 * field is still empty) and the language from the browser locale (only when
 * no `.agent-user.yml` already exists). Never overwrites a value the user
 * already has on disk.
 */
function prefillWelcomeOnce(): void {
    if (welcomePrefilled.value) return;
    const cur = userMdBody.value;
    // Body not loaded yet — retry on the next render rather than burning the
    // guard (loadUserMdOnce populates it asynchronously).
    if (cur === null) return;
    welcomePrefilled.value = true;
    let next = cur;
    if (cur.identity.name.trim() === '') {
        const sys = serverStatus.value?.systemUser;
        if (sys !== undefined && sys.trim() !== '') {
            next = { ...next, identity: { ...next.identity, name: sys } };
        }
    }
    if (!userMdExists.value && typeof navigator !== 'undefined') {
        const code = (navigator.language || '').split('-')[0];
        if (code.length >= 2) next = { ...next, language: code };
    }
    if (next !== cur) userMdBody.value = next;
}

/**
 * Welcome step (Step 1, both modes in install): name + language, pulled out
 * of the user-md step so the agent has them up front. Pre-filled from the OS
 * account + browser locale via {@link prefillWelcomeOnce}.
 */
function WelcomeStepBody(): preact.JSX.Element {
    const body = userMdBody.value;
    // Re-run once the user-md body is loaded (loadUserMdOnce is async, so the
    // body is usually null on first mount).
    useEffect(() => { prefillWelcomeOnce(); }, [body]);
    if (body === null) return <p>Loading…</p>;
    const patch = (next: UserIdentity): void => {
        userMdBody.value = { ...next, last_updated: new Date().toISOString().slice(0, 10) };
        userMdSkipped.value = false;
    };
    return (
        <div class="ac-wizard-step-stub ac-wizard__module-fields">
            <p>
                Tell the agent who you are. We pre-filled what we could detect —
                adjust freely. Stored in <code>.agent-user.yml</code>.
            </p>
            <div class="ac-field">
                <label class="ac-field__label" for="welcome-name">Name</label>
                <input
                    class="ac-input" id="welcome-name" type="text"
                    placeholder="How should the agent address you?"
                    value={body.identity.name}
                    onInput={(e): void => patch({ ...body, identity: { ...body.identity, name: (e.currentTarget as HTMLInputElement).value } })}
                />
            </div>
            <div class="ac-field">
                <label class="ac-field__label" for="welcome-lang">Language</label>
                <input
                    class="ac-input" id="welcome-lang" type="text" list="welcome-lang-list"
                    placeholder="BCP-47 code, e.g. de, en, en-US"
                    value={body.language}
                    onInput={(e): void => patch({ ...body, language: (e.currentTarget as HTMLInputElement).value })}
                />
                <datalist id="welcome-lang-list">
                    {WELCOME_LANGUAGES.map((l) => <option key={l} value={l} />)}
                </datalist>
            </div>
        </div>
    );
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
    const presence = toolPresence.value;
    return (
        <div class="ac-wizard-step-stub">
            <p>
                Pick the AI tools you use. Tools detected on this machine are
                pre-selected on first run. The installer wires each selected
                tool's surface (skills, rules, commands) on apply; you can
                change this list later by re-running the wizard.
            </p>
            <ul class="ac-wizard__tool-list">
                {VALID_TOOLS.map((tool) => {
                    const installed = presence[tool.id] === true;
                    return (
                        <li key={tool.id} class="ac-wizard__tool-row">
                            <label class="ac-wizard__tool-label">
                                <input
                                    type="checkbox"
                                    checked={sel[tool.id] ?? false}
                                    onChange={(e): void => {
                                        const checked = (e.currentTarget as HTMLInputElement).checked;
                                        selectedTools.value = { ...sel, [tool.id]: checked };
                                    }}
                                />
                                {' '}{tool.label}
                            </label>
                            <span
                                class={`ac-badge ${installed ? 'ac-badge--installed' : 'ac-badge--missing'}`}
                                title={installed ? 'Detected on this machine' : 'Not detected on this machine'}
                            >
                                {installed ? 'installed' : 'not installed'}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/**
 * Renderer for the extended-mode `roles` step (Step 2). The discovery
 * workspaces are the role/domain checkboxes; the chosen ids become
 * `.agent-user.yml` `role[]` and recommend each domain's `default_packs` on
 * the packs step (Step 3) via `seedPacksFromRoles`.
 */
function RolesStepBody(): preact.JSX.Element {
    if (discoveryLoading.value) {
        return <p>Loading roles…</p>;
    }
    if (discoveryLoadError.value !== null) {
        return (
            <div class="ac-wizard-step-stub">
                <p class="ac-banner ac-banner--error">Discovery failed: {discoveryLoadError.value}</p>
            </div>
        );
    }
    const sel = selectedRoles.value;
    const workspaces = discoveryWorkspaces.value;
    const setRole = (id: string, checked: boolean): void => {
        selectedRoles.value = { ...selectedRoles.value, [id]: checked };
        // Roles changed → refresh the pack recommendation (no-op once the user
        // has manually edited packs on Step 3).
        seedPacksFromRoles();
    };
    return (
        <div class="ac-wizard-step-stub">
            <p>
                Pick the areas you work in. We use them to recommend capability
                packs on the next step, and they become your roles in
                <code> .agent-user.yml</code>.
            </p>
            {workspaces.length === 0
                ? <p><em>No roles available in the manifest.</em></p>
                : (
                    <div class="ac-wizard__pack-grid">
                        {workspaces.map((ws: DiscoveryWorkspace) => (
                            <section key={ws.id} class="ac-pack-tile">
                                <label class="ac-pack-tile__head">
                                    <input
                                        type="checkbox"
                                        checked={sel[ws.id] ?? false}
                                        onChange={(e): void => { setRole(ws.id, (e.currentTarget as HTMLInputElement).checked); }}
                                    />
                                    <span class="ac-pack-tile__title">{ws.label}</span>
                                </label>
                                {(ws.example_roles ?? []).length > 0
                                    ? (
                                        <p class="ac-pack-tile__role">
                                            e.g. {(ws.example_roles ?? []).join(', ')}
                                        </p>
                                    )
                                    : null}
                                {ws.description !== ''
                                    ? <p class="ac-pack-tile__desc">{ws.description}</p>
                                    : null}
                            </section>
                        ))}
                    </div>
                )}
        </div>
    );
}

/**
 * Renderer for the extended-mode `packs` step (Step 3). Reads the live
 * discovery manifest (ADR-015) so the available packs always match the bundle
 * on disk. Pre-selection is recommended from the Step-2 roles
 * (`seedPacksFromRoles`); the user can override any tile.
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
    const sel = selectedPacks.value;
    const detected = new Set(detectedPackIds.value);
    // Workspace id → label, and the user's selected roles, so each pack tile
    // can badge the areas it belongs to (and highlight the ones the user picked
    // on Step 2 — "this pack matches your role").
    const wsLabel = new Map(discoveryWorkspaces.value.map((w) => [w.id, w.label]));
    const pickedRoles = selectedRoles.value;
    const renderWorkspaceBadges = (ids: string[] | undefined): preact.JSX.Element | null => {
        const list = (ids ?? []).filter((id) => id !== 'agent-config-maintainer');
        if (list.length === 0) return null;
        return (
            <span class="ac-pack-tile__ws">
                {list.map((id) => (
                    <span
                        key={id}
                        class={`ac-badge ac-badge--ws${pickedRoles[id] === true ? ' ac-badge--ws-active' : ''}`}
                        title={pickedRoles[id] === true ? 'Matches a role you picked' : 'Workspace / area'}
                    >
                        {wsLabel.get(id) ?? id}
                    </span>
                ))}
            </span>
        );
    };
    // engineering-base is an auto-included dependency — never shown as a tile
    // (road-to-wizard-ux-improvements § Phase 4).
    const visible = discoveryPacks.value.filter((p) => p.id !== 'engineering-base');
    // Group framework packs under their language tile via `cluster`.
    const childrenOf = new Map<string, DiscoveryPack[]>();
    for (const p of visible) {
        if (p.cluster !== undefined) {
            const arr = childrenOf.get(p.cluster) ?? [];
            arr.push(p);
            childrenOf.set(p.cluster, arr);
        }
    }
    const childIds = new Set(visible.filter((p) => p.cluster !== undefined).map((p) => p.id));
    const topLevel = visible.filter((p) => !childIds.has(p.id));

    const setPack = (id: string, checked: boolean): void => {
        packsTouched.value = true;
        selectedPacks.value = { ...selectedPacks.value, [id]: checked };
    };
    // A language tile gates its frameworks without destroying their stored
    // selection. First time it is enabled, children with no explicit choice
    // default ON (deselectable). Turning the language off only disables the
    // children in the UI — their checked state is preserved, so toggling the
    // language back on restores the exact prior selection (Laravel on /
    // Symfony off survives a php off→on round-trip).
    const setLanguage = (id: string, checked: boolean): void => {
        packsTouched.value = true;
        const next = { ...selectedPacks.value, [id]: checked };
        if (checked) {
            for (const child of childrenOf.get(id) ?? []) {
                if (next[child.id] === undefined) next[child.id] = true;
            }
        }
        selectedPacks.value = next;
    };

    return (
        <div class="ac-wizard-step-stub">
            <p>
                Pick the capability packs to install. Auto-detected packs are
                pre-selected; engineering hygiene is included automatically when
                a pack needs it. A language tile expands to its frameworks —
                turn the language off to skip them all.
            </p>
            {topLevel.length === 0
                ? <p><em>No packs available in the manifest.</em></p>
                : (
                    <div class="ac-wizard__pack-grid">
                        {topLevel.map((pack) => {
                            const kids = childrenOf.get(pack.id) ?? [];
                            const isLanguage = kids.length > 0;
                            const checked = sel[pack.id] ?? false;
                            return (
                                <section key={pack.id} class="ac-pack-tile">
                                    <label class="ac-pack-tile__head">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e): void => {
                                                const next = (e.currentTarget as HTMLInputElement).checked;
                                                if (isLanguage) setLanguage(pack.id, next);
                                                else setPack(pack.id, next);
                                            }}
                                        />
                                        <span class="ac-pack-tile__title">{pack.label}</span>
                                        {detected.has(pack.id)
                                            ? <span class="ac-badge ac-badge--installed">auto-detected</span>
                                            : null}
                                    </label>
                                    {renderWorkspaceBadges(pack.workspaces)}
                                    {pack.description !== ''
                                        ? <p class="ac-pack-tile__desc">{pack.description}</p>
                                        : null}
                                    {isLanguage
                                        ? (
                                            <fieldset class="ac-pack-tile__children" disabled={!checked}>
                                                {kids.map((child) => (
                                                    <label key={child.id} class="ac-pack-tile__child">
                                                        <input
                                                            type="checkbox"
                                                            checked={sel[child.id] ?? false}
                                                            disabled={!checked}
                                                            onChange={(e): void => {
                                                                setPack(child.id, (e.currentTarget as HTMLInputElement).checked);
                                                            }}
                                                        />
                                                        <span>{child.label}</span>
                                                    </label>
                                                ))}
                                            </fieldset>
                                        )
                                        : null}
                                </section>
                            );
                        })}
                    </div>
                )}
        </div>
    );
}

/**
 * rtk presence row on the Editor-and-tooling step (Phase 7). Detection-driven,
 * read-only — when missing, surfaces the per-OS install command + repo link.
 */
function RtkRow(): preact.JSX.Element {
    const installed = rtkInstalled.value;
    const cmd = rtkInstallCommand.value;
    return (
        <div class="ac-rtk-row">
            <div class="ac-rtk-row__head">
                <span class="ac-rtk-row__label">rtk <small>(Rust Token Killer)</small></span>
                {installed === null
                    ? <span class="ac-badge ac-badge--missing">detecting…</span>
                    : installed
                        ? <span class="ac-badge ac-badge--installed">installed</span>
                        : <span class="ac-badge ac-badge--missing">not installed</span>}
            </div>
            {installed === false
                ? (
                    <div class="ac-rtk-row__install">
                        <p class="ac-field__description">
                            rtk wraps verbose CLI output for ~60–90% token
                            savings. Install it, then re-open the wizard to
                            pick up detection:
                        </p>
                        {cmd !== null ? <code class="ac-rtk-row__cmd">{cmd}</code> : null}
                        <a class="ac-button" href={rtkRepo.value} target="_blank" rel="noreferrer noopener">
                            Open rtk repo
                        </a>
                    </div>
                )
                : null}
        </div>
    );
}

/**
 * AI Council step (Phase 8). Edits the wizard-controlled scalar subset of
 * `.ai-council.yml` held in `aiCouncilConfig`; finish() persists it via POST.
 * Deep/locked knobs (advisors, model_ladder, high_impact/user_required classes)
 * are intentionally not editable here.
 */
function AiCouncilStepBody(): preact.JSX.Element {
    const cfg = aiCouncilConfig.value;
    if (cfg === null) {
        return (
            <div class="ac-wizard-step-stub">
                <p class="ac-banner">
                    AI Council config is unavailable (extended-mode only, or
                    <code> .ai-council.yml </code> could not be read). Configure
                    it later by editing <code>agents/settings/.ai-council.yml</code>.
                </p>
            </div>
        );
    }
    const providers = aiCouncilProviders.value;
    const keyPresence = aiCouncilKeyPresence.value;
    const keyInstall = aiCouncilKeyInstall.value;
    const update = (patch: Partial<AiCouncilState>): void => {
        aiCouncilConfig.value = { ...cfg, ...patch };
    };
    const updateMember = (p: string, patch: Partial<{ enabled: boolean; participateLowImpact: boolean }>): void => {
        const cur = cfg.members[p] ?? { enabled: false, participateLowImpact: false };
        aiCouncilConfig.value = { ...cfg, members: { ...cfg.members, [p]: { ...cur, ...patch } } };
    };
    return (
        <div class="ac-wizard-step-stub ac-council">
            <label class="ac-council__master">
                <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e): void => { update({ enabled: (e.currentTarget as HTMLInputElement).checked }); }}
                />
                {' '}Enable the AI Council (external second-opinion network)
            </label>
            <fieldset class="ac-council__section" disabled={!cfg.enabled}>
                <div class="ac-field">
                    <label class="ac-field__label">Transport mode (default for all members)</label>
                    <select
                        class="ac-input"
                        value={cfg.defaultMode}
                        onChange={(e): void => { update({ defaultMode: (e.currentTarget as HTMLSelectElement).value as AiCouncilMode }); }}
                    >
                        <option value="manual">manual — copy &amp; paste (free, no key)</option>
                        <option value="api">api — stored key, per-token billing</option>
                        <option value="cli">cli — subscription auth (flat-rate)</option>
                    </select>
                </div>
                <div class="ac-field">
                    <label class="ac-field__label">Debate rounds (minimum)</label>
                    <input
                        class="ac-input"
                        type="number"
                        min="1"
                        value={cfg.minRounds}
                        onInput={(e): void => { update({ minRounds: Math.max(1, Number.parseInt((e.currentTarget as HTMLInputElement).value, 10) || 1) }); }}
                    />
                </div>
                <div class="ac-field">
                    <label class="ac-field__label">Cost budget — max total USD per invocation</label>
                    <input
                        class="ac-input"
                        type="number"
                        min="0"
                        step="0.5"
                        value={cfg.maxTotalUsd}
                        onInput={(e): void => { update({ maxTotalUsd: Math.max(0, Number.parseFloat((e.currentTarget as HTMLInputElement).value) || 0) }); }}
                    />
                </div>
                <h3 class="ac-council__h">Members</h3>
                <ul class="ac-wizard__tool-list">
                    {providers.map((p) => {
                        const m = cfg.members[p] ?? { enabled: false, participateLowImpact: false };
                        const hasKey = keyPresence[p] === true;
                        const installCmd = keyInstall[p];
                        return (
                            <li key={p} class="ac-pack-tile">
                                <div class="ac-pack-tile__head">
                                    <label class="ac-pack-tile__head" style="flex:1;">
                                        <input
                                            type="checkbox"
                                            checked={m.enabled}
                                            onChange={(e): void => { updateMember(p, { enabled: (e.currentTarget as HTMLInputElement).checked }); }}
                                        />
                                        <span class="ac-pack-tile__title">{p}</span>
                                    </label>
                                    <span class={`ac-badge ${hasKey ? 'ac-badge--installed' : 'ac-badge--missing'}`}>
                                        {hasKey ? 'key present' : 'no key'}
                                    </span>
                                </div>
                                <label class="ac-pack-tile__child">
                                    <input
                                        type="checkbox"
                                        checked={m.participateLowImpact}
                                        disabled={!m.enabled}
                                        onChange={(e): void => { updateMember(p, { participateLowImpact: (e.currentTarget as HTMLInputElement).checked }); }}
                                    />
                                    <span>low-impact fast-path</span>
                                </label>
                                {!hasKey
                                    ? (
                                        <p class="ac-field__description">
                                            {installCmd !== undefined
                                                ? <>Add a key — run in a terminal: <code>{installCmd}</code></>
                                                : <>No installer; set <code>api_key_ref: env:{p.toUpperCase()}_API_KEY</code> and export that variable.</>}
                                        </p>
                                    )
                                    : null}
                            </li>
                        );
                    })}
                </ul>
                <h3 class="ac-council__h">Impact routing</h3>
                {(['trivial', 'low_impact', 'medium_impact'] as const).map((cls) => (
                    <div class="ac-field" key={cls}>
                        <label class="ac-field__label">{cls}</label>
                        <select
                            class="ac-input"
                            value={cfg.decision[cls] ?? 'agent'}
                            onChange={(e): void => {
                                const mode = (e.currentTarget as HTMLSelectElement).value as AiCouncilClassMode;
                                aiCouncilConfig.value = { ...cfg, decision: { ...cfg.decision, [cls]: mode } };
                            }}
                        >
                            <option value="agent">agent — the agent decides</option>
                            <option value="council">council — poll the council</option>
                            <option value="user">user — always ask you</option>
                        </select>
                    </div>
                ))}
                <p class="ac-field__description">
                    <code>high_impact</code> and <code>user_required</code> are
                    locked to “user” (Iron Law) and not editable here.
                </p>
            </fieldset>
        </div>
    );
}

function StepBody(): preact.JSX.Element | null {
    const step = stepAt(stepIndex.value, { extended: extendedSteps.value });
    // road-to-unified-setup § B5 — hard-stop continue-screen between the
    // install-only lead (ai-tools / roles / packs) and the settings section.
    // The handoff renders AT the first settings step (`identity`); keying it
    // off the step id keeps it correct regardless of the step's index (the
    // project `modules` step now sits at the end of the flow, before review).
    // Render the handoff only when the install entry mode is active and the
    // user has not already acknowledged the transition in this session.
    const onContinueHandoff = extendedSteps.value
        && wizardMode.value === 'install'
        && step.id === 'identity'
        && !continueAcknowledged.value;
    if (onContinueHandoff) {
        return <ContinueScreen />;
    }
    if (step.kind === 'form') {
        const sliced = sliceSchema(schema.value!, step.paths ?? []);
        return (
            <>
                {step.id === 'identity' ? <RtkRow /> : null}
                <SchemaForm
                    schema={sliced}
                    values={values.value}
                    errors={errors.value}
                    onChange={(next): void => { values.value = next; }}
                />
            </>
        );
    }
    if (step.kind === 'userMd') {
        if (!userMdLoaded.value || userMdBody.value === null) {
            return <p>Loading .agent-user.yml…</p>;
        }
        // Server validates `body.identity` against `userIdentitySchema`,
        // so Zod paths come back as `identity.name`, `style.pace`,
        // … with no wire-level wrapper to strip — they bind 1:1 to the
        // form's field keys.
        return (
            <UserMdForm
                value={userMdBody.value}
                errors={errors.value}
                hideRole={extendedSteps.value && wizardMode.value === 'install'}
                hideIdentityBasics={extendedSteps.value && wizardMode.value === 'install'}
                onChange={(next): void => {
                    userMdBody.value = next;
                    userMdSkipped.value = false;
                }}
            />
        );
    }
    if (step.kind === 'welcome') {
        return <WelcomeStepBody />;
    }
    if (step.kind === 'aiTools') {
        return <AiToolsStepBody />;
    }
    if (step.kind === 'roles') {
        return <RolesStepBody />;
    }
    if (step.kind === 'packs') {
        return <PacksStepBody />;
    }
    if (step.kind === 'aiCouncil') {
        return <AiCouncilStepBody />;
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
            selectedToolsCount={Object.values(selectedTools.value).filter(Boolean).length}
            selectedPacksCount={Object.values(selectedPacks.value).filter(Boolean).length}
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
    // AI-tools (Step 1) and packs (Step 2) require at least one effective
    // selection before Next is allowed (road-to-wizard-ux-improvements
    // follow-up). For packs, "effective" excludes framework boxes whose
    // language is off, mirroring what actually gets installed.
    const blockedByEmptySelection =
        (step.kind === 'aiTools' && Object.values(selectedTools.value).filter(Boolean).length === 0)
        || (step.kind === 'roles' && Object.values(selectedRoles.value).filter(Boolean).length === 0)
        || (step.kind === 'packs' && resolveSelectedPacks().length === 0);
    // Install→setup hand-off (road-to-wizard-ux-improvements § Phase 6): an
    // intermediate shown AT the first settings step (`identity`). Next
    // acknowledges + reveals "Editor and tooling" (the identity form at the
    // same index); "Finish install here" sits in the nav like Skip and jumps
    // to Review. Keyed off the step id so it survives step reordering.
    const isContinueHandoff = extendedSteps.value
        && wizardMode.value === 'install'
        && step.id === 'identity'
        && !continueAcknowledged.value;

    const rec = recoveryStatus.value;
    const showRecovery = rec !== null && !recoveryDismissed.value;
    const v3 = legacyV3.value;
    const showBackup = v3 !== null && v3.present && !legacyV3Acknowledged.value;

    // road-to-unified-setup § E2 — BackupScreen is a hard gate. Until
    // the operator picks "Backup v3 and proceed" or "Abort", the rest
    // of the wizard chrome stays hidden so a stale v3 tree cannot get
    // silently overwritten by the v4 plan.
    if (showBackup) {
        return (
            <div class="ac-page">
                <BackupScreen
                    sourcePath={v3.path}
                    backupTarget={v3.backupTarget}
                    version={v3.version}
                    busy={legacyV3Busy.value}
                    error={legacyV3Error.value}
                    onBackupAndProceed={(): void => { void runBackupV3(); }}
                    onAbort={(): void => {
                        // Operator handles the cleanup manually — closing
                        // the tab is the documented exit. We surface a
                        // banner so they know the wizard is dismissed.
                        banner.value = {
                            tone: 'info',
                            message: 'Aborted. Uninstall v3 manually, then re-run `agent-config install`.',
                        };
                        legacyV3Acknowledged.value = true;
                    }}
                />
            </div>
        );
    }

    return (
        <div class="ac-page">
            <StepHeader
                step={step}
                index={idx}
                total={total}
            />
            {showRecovery
                ? (
                    <RecoveryBanner
                        abortedAt={rec.abortedAt}
                        abortNote={rec.abortNote}
                        writesSinceRollback={rec.writesSinceRollback}
                        busy={saving.value}
                        onResume={(): void => { void dismissRecovery('resume'); }}
                        onRollback={(): void => { void dismissRecovery('rollback'); }}
                        onIgnore={(): void => { void dismissRecovery('ignore'); }}
                    />
                )
                : null}
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
            {blockedByEmptySelection
                ? (
                    <p class="ac-wizard__hint">
                        {step.kind === 'aiTools'
                            ? 'Select at least one AI tool to continue.'
                            : step.kind === 'roles'
                                ? 'Select at least one role to continue.'
                                : 'Select at least one capability pack to continue.'}
                    </p>
                )
                : null}
            <StepNav
                canGoPrev={idx > 0}
                canGoNext={!isLast && !blockedByEmptySelection}
                canSkip={isContinueHandoff || step.kind === 'userMd'}
                skipLabel={isContinueHandoff ? 'Finish install here' : 'Skip'}
                isLast={isLast}
                busy={saving.value || diffLoading.value}
                canFinish={reviewChanges.value.length > 0 || userMdChanged()}
                completed={wizardComplete.value}
                onPrev={(): void => { void goTo(idx - 1); }}
                onNext={(): void => {
                    if (isContinueHandoff) {
                        // Reveal "Editor and tooling" at this same index — do
                        // not advance past it.
                        continueAcknowledged.value = true;
                        return;
                    }
                    void goTo(idx + 1);
                }}
                onSkip={(): void => {
                    if (isContinueHandoff) {
                        continueAcknowledged.value = true;
                        void goTo(activeTotalSteps() - 1);
                        return;
                    }
                    userMdSkipped.value = true;
                    void goTo(idx + 1);
                }}
                onFinish={(): void => { void finish(); }}
            />
        </div>
    );
}
