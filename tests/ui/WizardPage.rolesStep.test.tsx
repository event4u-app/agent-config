/**
 * WizardPage roles-step behaviour — role/domain checkboxes that recommend
 * packs on the next step.
 *
 *   - Gate: Next is blocked until at least one role is selected.
 *   - Recommendation: selecting a role pre-selects its `default_packs` on the
 *     packs step (seedPacksFromRoles), until the user edits packs manually.
 *
 * Resumes directly on the roles step (index 1 in extended mode) with a small
 * workspaces + packs manifest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { WizardPage } from '../../src/ui/pages/WizardPage.js';
import {
    banner, diffLoading, discoveryLoaded, discoveryLoading, discoveryLoadError,
    discoveryPacks, discoveryWorkspaces, detectedPackIds, errors, extendedSteps,
    initialSettings, loaded, loadError, packsTouched, saving, schema, selectedPacks,
    selectedRoles, selectedTools, settingsLastModified, stepIndex, userMdBody,
    userMdExists, userMdInitial, userMdLoaded, userMdSkipped, values, wizardComplete,
} from '../../src/ui/wizard/state.js';

const ROLES_STEP_INDEX = 2;
const EXTENDED_TOTAL = 13;

const SETTINGS_SCHEMA = {
    type: 'object',
    properties: { personal: { type: 'object', properties: { user_name: { type: 'string' } } } },
};

const MANIFEST = {
    packs: [
        { id: 'engineering-base', label: 'Engineering Base' },
        { id: 'founder-strategy', label: 'Founder Strategy', workspaces: ['founder'] },
        { id: 'product-basic', label: 'Product Basic', workspaces: ['product'] },
    ],
    workspaces: [
        { id: 'founder', label: 'Founder', description: 'Strategy, fundraising.', example_roles: ['CEO', 'Co-Founder'], default_packs: ['founder-strategy'], optional_packs: [] },
        { id: 'product', label: 'Product', description: 'Discovery, roadmaps.', example_roles: ['Product Manager'], default_packs: ['product-basic'], optional_packs: [] },
        { id: 'agent-config-maintainer', label: 'Maintainer', description: 'Internal.', default_packs: ['meta'], optional_packs: [] },
    ],
};

function resetSignals(): void {
    loaded.value = false; loadError.value = null; banner.value = null; saving.value = false;
    diffLoading.value = false; stepIndex.value = 0; schema.value = null; values.value = {};
    initialSettings.value = {}; settingsLastModified.value = 0; errors.value = {};
    userMdBody.value = null; userMdInitial.value = null; userMdExists.value = false;
    userMdLoaded.value = false; userMdSkipped.value = false; wizardComplete.value = false;
    extendedSteps.value = false;
    discoveryLoaded.value = false; discoveryLoading.value = false; discoveryLoadError.value = null;
    discoveryPacks.value = []; discoveryWorkspaces.value = []; detectedPackIds.value = [];
    selectedPacks.value = {}; selectedRoles.value = {}; selectedTools.value = {};
    packsTouched.value = false;
}

function installFetchMock(): { restore: () => void } {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        if (path === '/api/v1/wizard/state' && method === 'GET') {
            return new Response(JSON.stringify({ step: ROLES_STEP_INDEX, totalSteps: EXTENDED_TOTAL, partial: {}, startedAt: null, extendedSteps: true }), { status: 200 });
        }
        if (path === '/api/v1/settings' && method === 'GET') {
            return new Response(JSON.stringify({ values: {}, lastModified: 1, path: '.agent-settings.yml', schema: SETTINGS_SCHEMA }), { status: 200 });
        }
        if (path === '/api/v1/wizard/state' && method === 'POST') return new Response('{"ok":true}', { status: 200 });
        if (path === '/api/v1/user-md' && method === 'GET') return new Response(JSON.stringify({ body: '', exists: false, lastModified: null }), { status: 200 });
        if (path === '/api/v1/user-md/template' && method === 'GET') return new Response('{"body":""}', { status: 200 });
        if (path === '/api/v1/wizard/manifest' && method === 'GET') return new Response(JSON.stringify(MANIFEST), { status: 200 });
        if (path === '/api/v1/wizard/auto-detect' && method === 'GET') return new Response(JSON.stringify({ root: '/repo', signals: [] }), { status: 200 });
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { resetSignals(); });
afterEach(() => { cleanup(); });

function roleCheckbox(container: HTMLElement, label: string): HTMLInputElement {
    const lab = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(label));
    if (!lab) throw new Error(`role not found: ${label}`);
    return lab.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

describe('WizardPage roles step', () => {
    it('hides the maintainer workspace and blocks Next until a role is picked', async () => {
        const mock = installFetchMock();
        try {
            const { getByRole, container } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(discoveryLoaded.value).toBe(true));

            // Maintainer workspace is excluded from the role list.
            expect(discoveryWorkspaces.value.some((w) => w.id === 'agent-config-maintainer')).toBe(false);
            // Example roles are surfaced under the area (not the raw workspace id).
            expect(container.textContent).toContain('e.g. CEO, Co-Founder');
            expect(container.textContent).not.toContain('Role: founder');

            const next = getByRole('button', { name: 'Next' }) as HTMLButtonElement;
            expect(next.disabled).toBe(true);

            fireEvent.click(roleCheckbox(container, 'Founder'));
            await waitFor(() => expect(next.disabled).toBe(false));
        } finally {
            mock.restore();
        }
    });

    it('recommends the role default_packs on the packs step', async () => {
        const mock = installFetchMock();
        try {
            const { getByRole, container } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(discoveryLoaded.value).toBe(true));

            fireEvent.click(roleCheckbox(container, 'Founder'));
            await waitFor(() => expect(selectedRoles.value['founder']).toBe(true));

            // Advance to the packs step (index 3) — seedPacksFromRoles runs.
            fireEvent.click(getByRole('button', { name: 'Next' }));
            await waitFor(() => expect(stepIndex.value).toBe(3));
            await waitFor(() => expect(selectedPacks.value['founder-strategy']).toBe(true));
            expect(selectedPacks.value['product-basic']).toBeFalsy();
        } finally {
            mock.restore();
        }
    });
});
