/**
 * ProjectSettingsPage — project-scoped configuration surface.
 *
 * Global settings (`.agent-settings.yml`, `.agent-user.yml`, `.ai-council.yml`)
 * live in the Setup wizard and always write to the global tree. Project-only
 * configuration — currently the `modules:` block written to the consumer
 * repo's `.agent-project-settings.yml` — lives here instead, on its own
 * top-level surface between Setup and Tasks.
 *
 * Flow: on mount, detect module-root candidates via `/api/v1/modules/detect`;
 * the user toggles roots + tweaks the namespace/agent-folder fields, then
 * Save POSTs the block to `/api/v1/modules/apply`, which runs
 * `apply_modules_config.py` against the project root.
 */

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { apiFetch, ApiCallError } from '../api.js';
import { topLevelCopy } from '../copyErrors.js';
import {
    moduleCandidates,
    moduleSelection,
    modulesAgentFolder,
    modulesEnabled,
    modulesLoadError,
    modulesLoaded,
    modulesLoading,
    modulesNamespaceTemplate,
    modulesProjectRoot,
    type ModulesDetectResponse,
    type ProposedModulesBlock,
} from '../wizard/state.js';

const saving = signal(false);
const banner = signal<{ message: string; tone: 'success' | 'error' } | null>(null);

/**
 * Detect module-root candidates for the current project. Re-runs on every
 * mount (the scan is cheap relative to a page visit and the project tree can
 * change between visits), populating the shared module signals.
 */
async function detectModules(): Promise<void> {
    modulesLoading.value = true;
    modulesLoadError.value = null;
    try {
        const res = await apiFetch<ModulesDetectResponse>('/api/v1/modules/detect');
        moduleCandidates.value = res.candidates;
        modulesProjectRoot.value = res.project_root;
        const sel: Record<string, boolean> = {};
        for (const c of res.candidates) sel[c.path] = true;
        moduleSelection.value = sel;
        modulesEnabled.value = res.proposed_block.enabled;
        modulesNamespaceTemplate.value = res.proposed_block.namespace_template ?? '';
        modulesAgentFolder.value = res.proposed_block.agent_folder ?? 'agents';
    } catch (err) {
        modulesLoadError.value = err instanceof ApiCallError
            ? topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message })
            : err instanceof Error ? err.message : String(err);
    } finally {
        modulesLoading.value = false;
        modulesLoaded.value = true;
    }
}

function buildModulesConfig(): ProposedModulesBlock {
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

async function save(): Promise<void> {
    saving.value = true;
    banner.value = null;
    try {
        const res = await apiFetch<{ ok: boolean; appliedTo: string | null; projectRoot: string }>(
            '/api/v1/modules/apply',
            { method: 'POST', body: buildModulesConfig() },
        );
        banner.value = {
            message: res.appliedTo !== null
                ? `Saved project settings to ${res.appliedTo}.`
                : `Saved project settings to ${res.projectRoot}.`,
            tone: 'success',
        };
    } catch (err) {
        const message = err instanceof ApiCallError
            ? topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message })
            : err instanceof Error ? err.message : String(err);
        banner.value = { message: `Could not save project settings: ${message}`, tone: 'error' };
    } finally {
        saving.value = false;
    }
}

function ModulesSection(): preact.JSX.Element {
    if (modulesLoading.value) {
        return <p>Detecting module roots…</p>;
    }
    if (modulesLoadError.value !== null) {
        return (
            <p class="ac-banner ac-banner--error">
                Module detection failed: {modulesLoadError.value}
            </p>
        );
    }
    const candidates = moduleCandidates.value;
    const sel = moduleSelection.value;
    const root = modulesProjectRoot.value;
    return (
        <div class="ac-section">
            {root !== null
                ? (
                    <p class="ac-section__description">
                        Scanning <code>{root}</code>. Pick which detected roots the agent
                        should treat as modules. These write to
                        <code> .agent-project-settings.yml</code> in this repo only.
                    </p>
                )
                : null}
            <label>
                <input
                    type="checkbox"
                    checked={modulesEnabled.value}
                    onChange={(e): void => {
                        modulesEnabled.value = (e.currentTarget as HTMLInputElement).checked;
                    }}
                />
                {' '}Enable module discovery (writes <code>modules.enabled</code>)
            </label>
            {candidates.length === 0
                ? (
                    <p>
                        <em>No module roots detected.</em> The scan found no common module
                        layouts (Laravel <code>app/Modules/</code>, Symfony
                        <code> src/Module/</code>, Node <code>packages/</code>, Python
                        <code> src/</code>, Go <code>internal/</code>).
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
                                        }}
                                    />
                                    {' '}<code>{cand.path}</code> — {cand.stack}{' '}
                                    <small>({cand.confidence} confidence)</small>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            <div class="ac-wizard__module-fields">
                <div class="ac-field">
                    <label class="ac-field__label" for="ac-modules-namespace">Namespace template</label>
                    <input
                        id="ac-modules-namespace"
                        class="ac-input"
                        type="text"
                        value={modulesNamespaceTemplate.value}
                        placeholder="e.g. App\\Modules\\{ModuleName}\\App"
                        onInput={(e): void => {
                            modulesNamespaceTemplate.value = (e.currentTarget as HTMLInputElement).value;
                        }}
                    />
                    <span class="ac-field__description">
                        How a module path maps to its namespace. Leave blank to skip namespacing.
                    </span>
                </div>
                <div class="ac-field">
                    <label class="ac-field__label" for="ac-modules-agent-folder">Agent folder</label>
                    <input
                        id="ac-modules-agent-folder"
                        class="ac-input"
                        type="text"
                        value={modulesAgentFolder.value}
                        placeholder="agents"
                        onInput={(e): void => {
                            modulesAgentFolder.value = (e.currentTarget as HTMLInputElement).value;
                        }}
                    />
                    <span class="ac-field__description">
                        Folder name that holds per-module agent docs (default <code>agents</code>).
                    </span>
                </div>
            </div>
        </div>
    );
}

export function ProjectSettingsPage(): preact.JSX.Element {
    useEffect(() => { void detectModules(); }, []);
    return (
        <div class="ac-page">
            <header class="ac-page__header">
                <h1>Project settings</h1>
                <p class="ac-section__description">
                    Configuration scoped to this repository — written to
                    <code> .agent-project-settings.yml</code>, not the global tree.
                </p>
            </header>
            {banner.value !== null
                ? (
                    <p class={`ac-banner ac-banner--${banner.value.tone === 'success' ? 'success' : 'error'}`}>
                        {banner.value.message}
                    </p>
                )
                : null}
            <section class="ac-section">
                <h2 class="ac-section__title">Modules</h2>
                <ModulesSection />
            </section>
            <div class="ac-form__actions ac-wizard__nav">
                <button
                    type="button"
                    class="ac-button ac-button--primary"
                    disabled={saving.value || modulesLoading.value}
                    onClick={(): void => { void save(); }}
                >
                    {saving.value ? 'Saving…' : 'Save project settings'}
                </button>
            </div>
        </div>
    );
}
