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
