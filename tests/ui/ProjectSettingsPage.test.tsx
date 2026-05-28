/**
 * ProjectSettingsPage tests — the standalone project-scoped surface that
 * replaced the wizard's modules step.
 *
 *   - on mount, GET /api/v1/modules/detect runs and pre-selects every
 *     detected candidate;
 *   - Save POSTs the selection to /api/v1/modules/apply with the correct
 *     `modules:` block shape;
 *   - a detect failure surfaces an error and leaves the list empty.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { ProjectSettingsPage } from '../../src/ui/pages/ProjectSettingsPage.js';
import {
    moduleCandidates, moduleSelection, modulesAgentFolder, modulesEnabled,
    modulesLoaded, modulesLoadError, modulesLoading, modulesNamespaceTemplate,
    modulesProjectRoot,
} from '../../src/ui/wizard/state.js';

function resetSignals(): void {
    modulesLoaded.value = false;
    modulesLoading.value = false;
    modulesLoadError.value = null;
    moduleCandidates.value = [];
    moduleSelection.value = {};
    modulesEnabled.value = true;
    modulesNamespaceTemplate.value = '';
    modulesAgentFolder.value = 'agents';
    modulesProjectRoot.value = null;
}

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

function installFetchMock(overrides: { detect?: unknown; detectStatus?: number } = {}): { calls: Call[]; restore: () => void } {
    const calls: Call[] = [];
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        const body = init?.body !== undefined ? JSON.parse(init.body as string) : undefined;
        calls.push({ method, path, body });
        if (path === '/api/v1/modules/detect' && method === 'GET') {
            return new Response(JSON.stringify(overrides.detect ?? DETECT_RESPONSE), { status: overrides.detectStatus ?? 200 });
        }
        if (path === '/api/v1/modules/apply' && method === 'POST') {
            return new Response(JSON.stringify({ ok: true, appliedTo: '/repo/.agent-project-settings.yml', projectRoot: '/repo' }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { calls, restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { resetSignals(); });
afterEach(() => { cleanup(); });

describe('ProjectSettingsPage', () => {
    it('detects module roots on mount and pre-selects every candidate', async () => {
        const mock = installFetchMock();
        try {
            render(<ProjectSettingsPage />);
            await waitFor(() => expect(modulesLoaded.value).toBe(true));

            const detectCalls = mock.calls.filter((c) => c.path === '/api/v1/modules/detect' && c.method === 'GET');
            expect(detectCalls.length).toBe(1);
            expect(moduleCandidates.value.length).toBe(2);
            expect(moduleSelection.value['src/Module']).toBe(true);
            expect(moduleSelection.value['packages']).toBe(true);
            expect(modulesProjectRoot.value).toBe('/repo');
        } finally {
            mock.restore();
        }
    });

    it('POSTs the selection to /api/v1/modules/apply on Save', async () => {
        const mock = installFetchMock();
        try {
            const { getByRole } = render(<ProjectSettingsPage />);
            await waitFor(() => expect(modulesLoaded.value).toBe(true));

            // Deselect one candidate, tweak a field.
            moduleSelection.value = { ...moduleSelection.value, packages: false };
            modulesNamespaceTemplate.value = 'Custom\\NS\\{ModuleName}';

            const saveBtn = getByRole('button', { name: /Save project settings/ });
            fireEvent.click(saveBtn);
            await waitFor(() => {
                const applies = mock.calls.filter((c) => c.path === '/api/v1/modules/apply' && c.method === 'POST');
                expect(applies.length).toBe(1);
            });

            const apply = mock.calls.find((c) => c.path === '/api/v1/modules/apply' && c.method === 'POST');
            const body = apply!.body as { enabled: boolean; root_paths: string[]; namespace_template?: string; agent_folder?: string };
            expect(body.enabled).toBe(true);
            expect(body.root_paths).toEqual(['src/Module']);
            expect(body.namespace_template).toBe('Custom\\NS\\{ModuleName}');
            expect(body.agent_folder).toBe('agents');
        } finally {
            mock.restore();
        }
    });

    it('surfaces an error when /modules/detect fails', async () => {
        const mock = installFetchMock({ detect: { error: { code: 'INTERNAL', message: 'detection failed' } }, detectStatus: 500 });
        try {
            render(<ProjectSettingsPage />);
            await waitFor(() => expect(modulesLoaded.value).toBe(true));

            expect(modulesLoadError.value).not.toBeNull();
            expect(moduleCandidates.value).toEqual([]);
        } finally {
            mock.restore();
        }
    });
});
