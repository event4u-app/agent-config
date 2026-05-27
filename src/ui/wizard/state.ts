/**
 * Shared signal store for the wizard page.
 *
 * Splitting the signals out of `WizardPage.tsx` keeps the page render
 * function readable and lets the chrome components (StepNav, StepHeader)
 * stay pure — they read props, not module state.
 */

import { signal } from '@preact/signals';
import type { JsonSchemaLeaf, JsonValue } from '../forms/schemaTypes.js';
import type { UserIdentity } from '@shared/userMd/schema.js';
import { getWizardSteps, type WizardStep } from './steps.js';

export interface WizardServerState {
    step: number;
    totalSteps: number;
    partial: Record<string, JsonValue>;
    startedAt: string | null;
    /**
     * Server-side feature flag for the 9-step unified flow
     * (ai-tools + packs prepended ahead of the canonical 7 settings
     * steps). Defaults to `false` so older server bundles that omit
     * the field stay on the 7-step contract. See
     * road-to-global-only-install § Phase 1.6 and
     * `src/server/routes/wizard.ts` (`extendedSteps: extended`).
     */
    extendedSteps?: boolean;
    /**
     * Wizard entry mode — `install` triggers the hard-stop continue-screen
     * after Step 3 (modules); `setup` skips it. Older server bundles omit
     * the field; the UI treats `null` / undefined as "no special mode" and
     * never renders the continue-screen. road-to-unified-setup § B5.
     */
    wizardMode?: 'install' | 'setup' | null;
}

export interface DiffChange {
    path: string;
    from: JsonValue;
    to: JsonValue;
}

export type BannerTone = 'info' | 'success' | 'error';

export interface BannerState {
    message: string;
    tone: BannerTone;
}

export const loaded = signal(false);
export const loadError = signal<string | null>(null);
export const banner = signal<BannerState | null>(null);
export const saving = signal(false);
export const diffLoading = signal(false);

export const stepIndex = signal(0);
export const schema = signal<JsonSchemaLeaf | null>(null);
export const values = signal<Record<string, JsonValue>>({});
export const initialSettings = signal<Record<string, JsonValue>>({});
export const settingsLastModified = signal<number>(0);
export const errors = signal<Record<string, string>>({});

/**
 * Parsed identity object — `null` until the wizard userMd step has loaded
 * (or skipped) so the form-render branch knows the difference between
 * "still fetching" and "empty file". Post-migration the wire/disk format
 * is pure YAML; the signal carries the structured object, never the
 * serialized text. See `docs/contracts/agent-user-schema.md`.
 */
export const userMdBody = signal<UserIdentity | null>(null);
export const userMdInitial = signal<UserIdentity | null>(null);
export const userMdExists = signal(false);
export const userMdLoaded = signal(false);
export const userMdSkipped = signal(false);

/**
 * Sidecar hints from `GET /api/v1/settings` — carries values that moved
 * out of `settingsSchema` but still live in a pre-v2 file on disk. The
 * wizard consumes these once, when `.agent-user.yml` does not yet exist,
 * to pre-fill merged fields (e.g. legacy `personal.user_name` &rarr;
 * `identity.name`). See `docs/contracts/settings-api.md`.
 */
export interface SettingsLegacyHints {
    user_name?: string;
}
export const legacyHints = signal<SettingsLegacyHints>({});

export const reviewChanges = signal<DiffChange[]>([]);

/**
 * Wizard write-scope choice — picked on the Review step when the server
 * advertises `projectScopeAvailable: true` (road-to-global-only-install
 * § Phase 2.3). `'global'` (default) routes the 2PC commit to the
 * resolved global write root (typically `~/.event4u/agent-config/`).
 * `'project'` routes the commit to `<cwd>/settings/` so the consumer
 * pins settings to a single repo. The signal is wire-stable: the
 * /finish payload sends the value verbatim under `scope`.
 */
export const wizardScope = signal<'global' | 'project'>('global');

/**
 * Flipped to `true` once `/api/v1/wizard/finish` returns successfully (real
 * commit or dry-run). The page chrome uses it to suppress the Finish button
 * — there is nothing left to save — and the banner adds a close-window hint.
 */
export const wizardComplete = signal(false);

/**
 * Mirrors the server's `extendedSteps` flag from
 * `GET /api/v1/wizard/state`. Flips the active step list between the
 * canonical 7-step (false) and the 9-step ai-tools + packs flow
 * (true). Page chrome reads `getActiveSteps()` / `activeTotalSteps()`
 * instead of the static `WIZARD_TOTAL_STEPS` constant so a server
 * toggle takes effect on the next load without a code change.
 */
export const extendedSteps = signal(false);

/**
 * Module-root candidate emitted by `GET /api/v1/modules/detect`.
 * Mirrors the JSON shape produced by
 * `scripts/propose_modules_config.py --json` (the wire format the server
 * passes through unchanged). The `confidence` field is a free-form
 * string so the UI can render it verbatim without normalising on the
 * client. See road-to-configurable-modules § Phase E.
 */
export interface ModuleCandidate {
    path: string;
    stack: string;
    namespace_template_guess: string;
    confidence: string;
}

/**
 * `modules:` block proposed by the detection helper — the same shape
 * that gets patched into `.agent-project-settings.yml` by
 * `scripts/apply_modules_config.py` when the user confirms. Optional
 * fields stay optional on the wire so future schema additions are
 * backwards-compatible.
 */
export interface ProposedModulesBlock {
    enabled: boolean;
    root_paths: string[];
    namespace_template?: string;
    agent_folder?: string;
    skip_dirs?: string[];
}

export interface ModulesDetectResponse {
    project_root: string;
    candidates: ModuleCandidate[];
    proposed_block: ProposedModulesBlock;
}

/**
 * Signals for the modules wizard step (extended mode only). The step is
 * skippable: when `modulesSkipped` is true the /finish handler never
 * invokes the persistence helper and `.agent-project-settings.yml`
 * stays untouched.
 *
 * `moduleSelection` is keyed by candidate path so toggling a checkbox
 * is O(1) and the on-wire payload is just the keys of the truthy
 * entries — no need to diff against the source list.
 */
export const modulesLoaded = signal(false);
export const modulesLoading = signal(false);
export const modulesLoadError = signal<string | null>(null);
export const moduleCandidates = signal<ModuleCandidate[]>([]);
export const moduleSelection = signal<Record<string, boolean>>({});
export const modulesEnabled = signal(true);
export const modulesNamespaceTemplate = signal('');
export const modulesAgentFolder = signal('agents');
export const modulesSkipped = signal(false);
export const modulesProjectRoot = signal<string | null>(null);

/**
 * Discovery state for the extended-mode `ai-tools` + `packs` steps
 * (road-to-global-only-install § Phase 2). The wizard fetches both
 * `/api/v1/wizard/manifest` (ADR-015 packs list) and
 * `/api/v1/wizard/auto-detect` (project signals — `pack-php`, `pack-js`,
 * …) once per session and caches under `discoveryLoaded`.
 *
 * Detection signals carry a `pack-` prefix on the wire; the loader
 * strips it so `detectedPackIds` joins 1:1 to manifest `id`s. The
 * `pack-` ↔ manifest-id mapping is intentionally trivial — if the
 * server adds richer detection metadata later, only the loader
 * changes.
 */
export interface DiscoveryPack {
    id: string;
    label: string;
    description: string;
    /** Other pack ids this pack hints at as prerequisites. */
    requires_hint?: string[];
    /**
     * Advisory wizard grouping (road-to-wizard-ux-improvements § Phase 4):
     * the language pack id this framework pack collapses under in Step 2
     * (e.g. `react` → `typescript`). Absent on language/standalone packs.
     */
    cluster?: string;
    /** Workspace/role domains this pack belongs to (e.g. `engineering`, `founder`). */
    workspaces?: string[];
}

/**
 * A discovery workspace = a role/domain the user works in (Engineering,
 * Product, Finance, Founder, …). Surfaced as Step-2 checkboxes; the selected
 * ids become `.agent-user.yml` `role[]` and recommend each domain's
 * `default_packs` on the packs step.
 */
export interface DiscoveryWorkspace {
    id: string;
    label: string;
    description: string;
    default_packs: string[];
    optional_packs?: string[];
}

/**
 * Valid AI tool IDs accepted by `scripts/install.py --tools`. Mirrors
 * `_VALID_TOOLS` in install.py (source of truth). The wizard hard-codes
 * the list because tools are NOT in the discovery manifest — they are
 * a substrate-level concept (which AI client the user runs), not a
 * package artefact. Bump in lockstep with install.py.
 */
export interface ToolDescriptor {
    id: string;
    label: string;
}

export const VALID_TOOLS: readonly ToolDescriptor[] = [
    { id: 'claude-code', label: 'Claude Code' },
    { id: 'claude-desktop', label: 'Claude Desktop' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'windsurf', label: 'Windsurf' },
    { id: 'cline', label: 'Cline' },
    { id: 'gemini-cli', label: 'Gemini CLI' },
    { id: 'copilot', label: 'GitHub Copilot' },
    { id: 'augment', label: 'Augment' },
    { id: 'aider', label: 'Aider' },
    { id: 'codex', label: 'Codex' },
    { id: 'roocode', label: 'Roo Code' },
    { id: 'continue', label: 'Continue' },
    { id: 'kilocode', label: 'Kilo Code' },
    { id: 'zed', label: 'Zed' },
    { id: 'jetbrains', label: 'JetBrains' },
    { id: 'kiro', label: 'Kiro' },
    { id: 'qoder', label: 'Qoder' },
    { id: 'opencode', label: 'OpenCode' },
    { id: 'trae', label: 'Trae' },
    { id: 'antigravity', label: 'Antigravity' },
    { id: 'codebuddy', label: 'CodeBuddy' },
    { id: 'droid', label: 'Droid' },
    { id: 'warp', label: 'Warp' },
];

export const discoveryLoaded = signal(false);
export const discoveryLoading = signal(false);
export const discoveryLoadError = signal<string | null>(null);
export const discoveryPacks = signal<DiscoveryPack[]>([]);
export const detectedPackIds = signal<string[]>([]);
/** Role/domain workspaces from the manifest, rendered as Step-2 checkboxes. */
export const discoveryWorkspaces = signal<DiscoveryWorkspace[]>([]);

/**
 * Selected role/domain ids (Step 2) — keyed for O(1) toggle. Truthy keys
 * become `.agent-user.yml` `role[]` and drive pack recommendations on Step 3.
 * `agent-config-maintainer` is intentionally excluded from the UI list.
 */
export const selectedRoles = signal<Record<string, boolean>>({});

/**
 * AI-tool native presence on the machine (road-to-wizard-ux-improvements
 * § Phase 2). `{ <toolId>: installed }` from `GET /api/v1/wizard/detect-tools`.
 * Drives the Step-1 per-tool badge and first-run pre-selection. Loaded once
 * per session; `{}` until the probe lands (badges render "not installed").
 */
export const toolsDetectionLoaded = signal(false);
export const toolsDetectionLoading = signal(false);
export const toolPresence = signal<Record<string, boolean>>({});

/**
 * rtk (Rust Token Killer) presence on the Editor-and-tooling step
 * (road-to-wizard-ux-improvements § Phase 7). Always detected at runtime via
 * `GET /api/v1/wizard/detect-rtk` — never read from settings. `null` = not yet
 * probed. When missing, `rtkInstallCommand` carries the per-OS install hint.
 */
export const rtkDetectionLoaded = signal(false);
export const rtkInstalled = signal<boolean | null>(null);
export const rtkInstallCommand = signal<string | null>(null);
export const rtkRepo = signal<string>('https://github.com/event4u-app/rtk');

/**
 * AI Council step (road-to-wizard-ux-improvements § Phase 8). The
 * wizard-controlled scalar subset of `.ai-council.yml`, loaded from
 * `GET /api/v1/wizard/ai-council` and persisted on finish via POST. Only the
 * safe scalar leaves are editable; deep/locked knobs stay hand-edited.
 */
export type AiCouncilMode = 'manual' | 'api' | 'cli';
export type AiCouncilClassMode = 'agent' | 'council' | 'user';
export interface AiCouncilMemberState { enabled: boolean; participateLowImpact: boolean }
export interface AiCouncilState {
    enabled: boolean;
    defaultMode: AiCouncilMode;
    minRounds: number;
    maxTotalUsd: number;
    members: Record<string, AiCouncilMemberState>;
    decision: Record<string, AiCouncilClassMode>;
}
export const aiCouncilLoaded = signal(false);
export const aiCouncilConfig = signal<AiCouncilState | null>(null);
export const aiCouncilProviders = signal<readonly string[]>([]);
export const aiCouncilKeyPresence = signal<Record<string, boolean>>({});
export const aiCouncilKeyInstall = signal<Record<string, string>>({});

/**
 * Tool + pack selection — keyed by id for O(1) toggle. The on-wire
 * payload is the list of truthy keys; falsy/missing means "unchecked".
 * Both seed empty so the user makes an explicit choice; the loader
 * pre-selects detected packs once the manifest + signals land.
 */
export const selectedTools = signal<Record<string, boolean>>({});
export const selectedPacks = signal<Record<string, boolean>>({});
/**
 * True once the user has manually toggled a pack on Step 3. Until then the
 * packs step re-seeds from the selected roles' recommended packs on entry;
 * after a manual edit the role-driven seeding stops clobbering the choice.
 */
export const packsTouched = signal(false);

/**
 * Wire-shape of an InstallPlan returned by `POST /api/v1/install/plan`
 * — mirrors `planToWire` in `src/server/routes/install.ts`. Carried
 * client-side as `unknown`-ish on purpose: the wizard only needs the
 * file counts per tool and the policy `defaultStrategy` to drive the
 * Review summary + the upcoming conflict UI (Phase B3). Full structural
 * checking happens on the server before it ships the response.
 *
 * road-to-unified-setup § Phase B2.
 */
export interface InstallPlanWire {
    readonly version: 2;
    readonly target: 'global' | 'project';
    readonly root: string;
    readonly filesByTool: Record<string, ReadonlyArray<{
        readonly path: string;
        readonly kind: 'deployed' | 'marker' | 'bridge';
        readonly sha256: string | null;
    }>>;
    readonly mergedKeysByTool: Record<string, ReadonlyArray<{
        readonly file: string;
        readonly pointer: string;
    }>>;
    readonly policy: {
        readonly force: boolean;
        readonly interactive: boolean;
        readonly knownPaths: ReadonlyArray<string>;
        readonly knownPointers: ReadonlyArray<string>;
        readonly defaultStrategy: 'skip' | 'overwrite' | 'surface-to-ui';
    };
    /**
     * Phase B3 — filesystem collisions the policy would surface to the
     * wizard. Each entry carries the planned + on-disk SHA-256 so the
     * conflict screen can render a "bytes differ" hint without re-reading
     * the file. `mergeable` is `true` only for `.json` deployed targets;
     * the merge CTA is hidden for everything else.
     */
    readonly conflicts: ReadonlyArray<ConflictEntryWire>;
}

export interface ConflictEntryWire {
    readonly path: string;
    readonly kind: 'deployed' | 'marker' | 'bridge';
    readonly plannedSha256: string | null;
    readonly existingSha256: string | null;
    readonly mergeable: boolean;
}

/**
 * Resolution chosen by the user on the conflict screen — mirrors
 * `ConflictResolution` on the server. `skip` leaves the file untouched,
 * `overwrite` writes the planned bytes verbatim, `merge` performs a JSON
 * deep-merge (server-side; falls back to `overwrite` for non-JSON).
 */
export type ConflictResolutionWire = 'skip' | 'overwrite' | 'merge';

/**
 * Batch CTAs surfaced when `conflicts.length >= CONFLICT_BATCH_THRESHOLD`
 * (5, council Finding #19). Mirrors the server's `batchChoice` enum on
 * `ApplyRequestSchema`. `merge-json` maps non-JSON entries to `skip`
 * server-side so one stray non-JSON file in a batch never silently
 * overwrites.
 */
export type ConflictBatchChoice = 'skip-all' | 'overwrite-all' | 'merge-json';

/** Mirror of `CONFLICT_BATCH_THRESHOLD` from `src/install/conflict.ts`. */
export const CONFLICT_BATCH_THRESHOLD = 5;

/**
 * Per-path conflict resolutions chosen on the conflict screen. Keys are
 * absolute target paths (matching `installPlan.value.conflicts[i].path`).
 * Empty until the screen mounts; the apply call sends only present keys
 * and leaves the rest to the policy default (`surface` → `skip`).
 */
export const conflictResolutions = signal<Record<string, ConflictResolutionWire>>({});

/**
 * Batch CTA selected on the conflict screen. `null` means the screen is
 * in single-pick mode (or no batch CTA was clicked). The apply call
 * sends it under `batchChoice`; per-path entries in `conflictResolutions`
 * override the batch choice on a per-path basis.
 */
export const conflictBatchChoice = signal<ConflictBatchChoice | null>(null);

/**
 * Loaded InstallPlan for the Review step — `null` until the wizard
 * enters the Review step (or when the user has zero AI tools selected).
 * The plan is re-fetched on every entry into Review so a back-edit on
 * the AI-tools step is reflected in the summary without a manual
 * refresh. road-to-unified-setup § Phase B2.
 */
export const installPlan = signal<InstallPlanWire | null>(null);
export const installPlanLoading = signal(false);
export const installPlanError = signal<string | null>(null);

/**
 * Recovery state surfaced by `/api/v1/install/recovery` — road-to-unified-setup
 * § Phase B4. The wizard fetches this on boot; when `incomplete` is true,
 * a pre-Step-1 banner offers Resume / Rollback / Ignore. Local
 * `recoveryDismissed` short-circuits the banner after the user picks an
 * action so a stale signal in-memory does not re-block the wizard.
 */
export interface RecoveryStatus {
    incomplete: boolean;
    recommendation: 'none' | 'resume' | 'rollback' | 'ignore';
    abortedAt: string | null;
    abortNote: string | null;
    writesSinceRollback: number;
}

export const recoveryStatus = signal<RecoveryStatus | null>(null);
export const recoveryDismissed = signal(false);

/**
 * v3 legacy detection — populated by `GET /api/v1/install/legacy-v3` on
 * boot. When `present: true`, the BackupScreen renders pre-Step-1.
 * road-to-unified-setup § Phase E2 (council Finding #21).
 */
export interface LegacyV3Status {
    present: boolean;
    path: string;
    version: string | null;
    backupTarget: string;
}

export const legacyV3 = signal<LegacyV3Status | null>(null);
export const legacyV3Acknowledged = signal(false);
export const legacyV3Busy = signal(false);
export const legacyV3Error = signal<string | null>(null);

/**
 * Wizard entry mode — set on load from `/api/v1/wizard/state.wizardMode`.
 * Drives the hard-stop continue-screen between Step 3 (modules) and Step 4
 * (identity) when in `install` mode. `setup` and `null` bypass it.
 * road-to-unified-setup § B5.
 */
export const wizardMode = signal<'install' | 'setup' | null>(null);

/**
 * Local flag: user has acknowledged the install→setup handoff screen for
 * this session. Prevents the continue-screen from re-rendering on every
 * back-navigation through Step 3. Reset on a fresh page load.
 */
export const continueAcknowledged = signal(false);

export function getActiveSteps(): readonly WizardStep[] {
    return getWizardSteps({ extended: extendedSteps.value });
}

export function activeTotalSteps(): number {
    return getActiveSteps().length;
}

export function startedAtNow(existing: string | null): string {
    return existing ?? new Date().toISOString();
}

export function clampStep(idx: number): number {
    return Math.max(0, Math.min(activeTotalSteps() - 1, idx));
}
