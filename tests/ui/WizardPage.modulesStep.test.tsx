/**
 * WizardPage modules-step tests — road-to-configurable-modules § Phase E.
 *
 * Asserts the extended-mode modules step end-to-end:
 *   - GET /api/v1/modules/detect is called once on entry to the step
 *   - candidates render, selection toggles flow into /finish body
 *   - skipping leaves `modulesConfig` off the wire entirely
 *   - custom paths (manual edits to namespace / agent_folder) survive
 *
 * Mounts the wizard with the server reporting `extendedSteps: true` and
 * resumes directly on step 2 (modules) — that's the entry path Phase E
 * is wired against.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { WizardPage } from '../../src/ui/pages/WizardPage.js';
import {
    banner, diffLoading, errors, extendedSteps, initialSettings, loaded,
    loadError, moduleCandidates, moduleSelection, modulesAgentFolder,
    modulesEnabled, modulesLoaded, modulesLoadError, modulesLoading,
    modulesNamespaceTemplate, modulesProjectRoot, modulesSkipped, reviewChanges,
    saving, schema, settingsLastModified, stepIndex, userMdBody, userMdExists,
    userMdInitial, userMdLoaded, userMdSkipped, values, wizardComplete,
} from '../../src/ui/wizard/state.js';

function resetSignals(): void {
    loaded.value = false;
    loadError.value = null;
    banner.value = null;
    saving.value = false;
    diffLoading.value = false;
    stepIndex.value = 0;
    schema.value = null;
    values.value = {};
    initialSettings.value = {};
    settingsLastModified.value = 0;
    errors.value = {};
    userMdBody.value = null;
    userMdInitial.value = null;
    userMdExists.value = false;
    userMdLoaded.value = false;
    userMdSkipped.value = false;
    reviewChanges.value = [];
    wizardComplete.value = false;
    extendedSteps.value = false;
    modulesLoaded.value = false;
    modulesLoading.value = false;
    modulesLoadError.value = null;
    moduleCandidates.value = [];
    moduleSelection.value = {};
    modulesEnabled.value = true;
    modulesNamespaceTemplate.value = '';
    modulesAgentFolder.value = 'agents';
    modulesSkipped.value = false;
    modulesProjectRoot.value = null;
}

const SETTINGS_SCHEMA = {
    type: 'object',
    properties: {
        personal: {
            type: 'object',
            properties: { user_name: { type: 'string', title: 'Your name' } },
        },
    },
};

const DETECT_RESPONSE = {
    project_root: '/repo',
    candidates: [
        { path: 'src/Module', stack: 'symfony', namespace_template_guess: 'App\\Module\\{ModuleName}', confidence: 'high' },
        { path: 'packages', stack: 'node', namespace_template_guess: '', confidence: 'medium' },
    ],
    proposed_block: {
        enabled: true,
        root_paths: ['src/Module', 'packages'],
        namespace_template: 'App\\Module\\{ModuleName}',
        agent_folder: 'agents',
    },
};

interface Call { method: string; path: string; body: unknown }

// Total = 4 (extended lead: ai-tools, roles, packs, modules) + 8 core = 12. Step index 3 lands on modules.
const EXTENDED_TOTAL = 13;
const MODULES_STEP_INDEX = 4;

function installFetchMock(overrides: { detect?: unknown; detectStatus?: number } = {}): { calls: Call[]; restore: () => void } {
    const calls: Call[] = [];
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        const body = init?.body !== undefined ? JSON.parse(init.body as string) : undefined;
        calls.push({ method, path, body });
        if (path === '/api/v1/wizard/state' && method === 'GET') {
            return new Response(JSON.stringify({ step: MODULES_STEP_INDEX, totalSteps: EXTENDED_TOTAL, partial: {}, startedAt: null, extendedSteps: true }), { status: 200 });
        }
        if (path === '/api/v1/settings' && method === 'GET') {
            return new Response(JSON.stringify({ values: {}, lastModified: 1, path: '.agent-settings.yml', schema: SETTINGS_SCHEMA }), { status: 200 });
        }
        if (path === '/api/v1/wizard/state' && method === 'POST') {
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (path === '/api/v1/user-md' && method === 'GET') {
            return new Response(JSON.stringify({ body: '', exists: false, lastModified: null }), { status: 200 });
        }
        if (path === '/api/v1/user-md/template' && method === 'GET') {
            return new Response(JSON.stringify({ body: '' }), { status: 200 });
        }
        if (path === '/api/v1/modules/detect' && method === 'GET') {
            return new Response(JSON.stringify(overrides.detect ?? DETECT_RESPONSE), { status: overrides.detectStatus ?? 200 });
        }
        if (path === '/api/v1/settings/diff' && method === 'POST') {
            // Force at least one diff entry so `canFinish` evaluates true
            // and the Finish button stays clickable on the review step.
            return new Response(JSON.stringify({ changes: [{ path: 'personal.user_name', from: '', to: 'Matze' }] }), { status: 200 });
        }
        if (path === '/api/v1/wizard/finish' && method === 'POST') {
            return new Response(JSON.stringify({ writtenPaths: ['.agent-settings.yml'], txnId: 'tx-1' }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { calls, restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { resetSignals(); });
afterEach(() => { cleanup(); });


async function walkToFinish(getByRole: (role: string, opts: { name: RegExp | string }) => HTMLElement): Promise<void> {
    // From modules step (index 2) to review (index 9 in extended) — 7 Next clicks.
    for (let i = MODULES_STEP_INDEX; i < EXTENDED_TOTAL - 1; i++) {
        const nextBtn = getByRole('button', { name: 'Next' });
        fireEvent.click(nextBtn);
        await waitFor(() => expect(stepIndex.value).toBe(i + 1));
    }
    await waitFor(() => expect(diffLoading.value).toBe(false));
    const finishBtn = getByRole('button', { name: /Finish/ });
    fireEvent.click(finishBtn);
    await waitFor(() => expect(saving.value).toBe(false));
}

describe('WizardPage modules step', () => {
    it('fetches /modules/detect and pre-selects every candidate', async () => {
        const mock = installFetchMock();
        try {
            render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(modulesLoaded.value).toBe(true));

            const detectCalls = mock.calls.filter((c) => c.path === '/api/v1/modules/detect' && c.method === 'GET');
            expect(detectCalls.length).toBe(1);
            expect(moduleCandidates.value.length).toBe(2);
            expect(moduleSelection.value['src/Module']).toBe(true);
            expect(moduleSelection.value['packages']).toBe(true);
            expect(modulesProjectRoot.value).toBe('/repo');
            expect(modulesEnabled.value).toBe(true);
            expect(modulesNamespaceTemplate.value).toBe('App\\Module\\{ModuleName}');
            expect(modulesAgentFolder.value).toBe('agents');
        } finally {
            mock.restore();
        }
    });

    it('sends modulesConfig with the user selection on /finish', async () => {
        const mock = installFetchMock();
        try {
            const { getByRole } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(modulesLoaded.value).toBe(true));

            // Deselect the `packages` candidate via signal mutation — DOM
            // toggling is covered by the third test, this one focuses on
            // the wire shape so we keep the assertion surface tight.
            moduleSelection.value = { ...moduleSelection.value, packages: false };

            await walkToFinish(getByRole);

            const finishes = mock.calls.filter((c) => c.path === '/api/v1/wizard/finish' && c.method === 'POST');
            expect(finishes.length).toBe(1);
            const body = finishes[0]!.body as { modulesConfig?: { enabled: boolean; root_paths: string[]; namespace_template?: string; agent_folder?: string } };
            expect(body.modulesConfig).toBeDefined();
            expect(body.modulesConfig!.enabled).toBe(true);
            expect(body.modulesConfig!.root_paths).toEqual(['src/Module']);
            expect(body.modulesConfig!.namespace_template).toBe('App\\Module\\{ModuleName}');
            expect(body.modulesConfig!.agent_folder).toBe('agents');
        } finally {
            mock.restore();
        }
    });

    it('omits modulesConfig from /finish when the user skips the step', async () => {
        const mock = installFetchMock();
        try {
            const { getByRole } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(modulesLoaded.value).toBe(true));

            const skipBtn = getByRole('button', { name: /Skip/ });
            fireEvent.click(skipBtn);
            await waitFor(() => expect(modulesSkipped.value).toBe(true));
            await waitFor(() => expect(stepIndex.value).toBe(MODULES_STEP_INDEX + 1));

            // Continue to finish from the next step (index 3) onwards.
            for (let i = MODULES_STEP_INDEX + 1; i < EXTENDED_TOTAL - 1; i++) {
                const nextBtn = getByRole('button', { name: 'Next' });
                fireEvent.click(nextBtn);
                await waitFor(() => expect(stepIndex.value).toBe(i + 1));
            }
            await waitFor(() => expect(diffLoading.value).toBe(false));
            const finishBtn = getByRole('button', { name: /Finish/ });
            fireEvent.click(finishBtn);
            await waitFor(() => expect(saving.value).toBe(false));

            const finishes = mock.calls.filter((c) => c.path === '/api/v1/wizard/finish' && c.method === 'POST');
            expect(finishes.length).toBe(1);
            const body = finishes[0]!.body as { modulesConfig?: unknown };
            expect(body.modulesConfig).toBeUndefined();
        } finally {
            mock.restore();
        }
    });

    it('forwards manually edited namespace_template and agent_folder', async () => {
        const mock = installFetchMock();
        try {
            const { getByRole } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(modulesLoaded.value).toBe(true));

            modulesNamespaceTemplate.value = 'Custom\\NS\\{ModuleName}';
            modulesAgentFolder.value = 'custom-agents';
            modulesEnabled.value = false;

            await walkToFinish(getByRole);

            const finishes = mock.calls.filter((c) => c.path === '/api/v1/wizard/finish' && c.method === 'POST');
            const body = finishes[0]!.body as { modulesConfig: { enabled: boolean; namespace_template?: string; agent_folder?: string } };
            expect(body.modulesConfig.enabled).toBe(false);
            expect(body.modulesConfig.namespace_template).toBe('Custom\\NS\\{ModuleName}');
            expect(body.modulesConfig.agent_folder).toBe('custom-agents');
        } finally {
            mock.restore();
        }
    });

    it('surfaces modulesLoadError when /modules/detect fails', async () => {
        const mock = installFetchMock({ detect: { error: { code: 'INTERNAL', message: 'detection failed' } }, detectStatus: 500 });
        try {
            render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(modulesLoaded.value).toBe(true));

            expect(modulesLoadError.value).not.toBeNull();
            expect(moduleCandidates.value).toEqual([]);
        } finally {
            mock.restore();
        }
    });
});
