/**
 * WizardPage packs-step behaviour — road-to-wizard-ux-improvements follow-up.
 *
 *   - B2: a language tile gates its frameworks without destroying their
 *     stored selection. Laravel on / Symfony off survives a PHP off→on
 *     round-trip, and the child checkboxes stay checked (disabled) while the
 *     language is off.
 *   - C:  the packs step blocks Next until at least one effective pack is
 *     selected.
 *
 * Resumes directly on the packs step (index 1 in extended mode) with a small
 * php→{laravel,symfony} manifest and no auto-detect signals.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { WizardPage } from '../../src/ui/pages/WizardPage.js';
import {
    banner, diffLoading, discoveryLoaded, discoveryLoading, discoveryLoadError,
    discoveryPacks, detectedPackIds, errors, extendedSteps, initialSettings,
    loaded, loadError, saving, schema, selectedPacks, selectedTools,
    settingsLastModified, stepIndex, userMdBody, userMdExists, userMdInitial,
    userMdLoaded, userMdSkipped, values, wizardComplete,
} from '../../src/ui/wizard/state.js';

const PACKS_STEP_INDEX = 1;
const EXTENDED_TOTAL = 11;

const SETTINGS_SCHEMA = {
    type: 'object',
    properties: { personal: { type: 'object', properties: { user_name: { type: 'string' } } } },
};

const MANIFEST = {
    packs: [
        { id: 'engineering-base', label: 'Engineering Base' },
        { id: 'php', label: 'PHP', requires_hint: ['engineering-base'] },
        { id: 'laravel', label: 'Laravel', requires_hint: ['php', 'engineering-base'], cluster: 'php' },
        { id: 'symfony', label: 'Symfony', requires_hint: ['php', 'engineering-base'], cluster: 'php' },
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
    discoveryPacks.value = []; detectedPackIds.value = [];
    selectedPacks.value = {}; selectedTools.value = {};
}

function installFetchMock(): { restore: () => void } {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        if (path === '/api/v1/wizard/state' && method === 'GET') {
            return new Response(JSON.stringify({ step: PACKS_STEP_INDEX, totalSteps: EXTENDED_TOTAL, partial: {}, startedAt: null, extendedSteps: true }), { status: 200 });
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

function checkboxByLabel(container: HTMLElement, label: string): HTMLInputElement {
    const lab = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(label));
    if (!lab) throw new Error(`label not found: ${label}`);
    return lab.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

describe('WizardPage packs step', () => {
    it('blocks Next until at least one pack is selected (C)', async () => {
        const mock = installFetchMock();
        try {
            const { getByRole, container } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(discoveryLoaded.value).toBe(true));

            const next = getByRole('button', { name: 'Next' }) as HTMLButtonElement;
            expect(next.disabled).toBe(true); // nothing selected

            fireEvent.click(checkboxByLabel(container, 'PHP'));
            await waitFor(() => expect(next.disabled).toBe(false));
        } finally {
            mock.restore();
        }
    });

    it('preserves child selection across a language off→on round-trip (B2)', async () => {
        const mock = installFetchMock();
        try {
            const { container } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(discoveryLoaded.value).toBe(true));

            // Enable PHP → laravel + symfony default on.
            fireEvent.click(checkboxByLabel(container, 'PHP'));
            await waitFor(() => expect(selectedPacks.value['laravel']).toBe(true));
            expect(selectedPacks.value['symfony']).toBe(true);

            // Turn Symfony off.
            fireEvent.click(checkboxByLabel(container, 'Symfony'));
            await waitFor(() => expect(selectedPacks.value['symfony']).toBe(false));

            // Disable PHP, then re-enable — laravel on / symfony off must survive.
            fireEvent.click(checkboxByLabel(container, 'PHP'));
            await waitFor(() => expect(selectedPacks.value['php']).toBe(false));
            expect(selectedPacks.value['laravel']).toBe(true); // preserved while disabled
            expect(selectedPacks.value['symfony']).toBe(false);

            fireEvent.click(checkboxByLabel(container, 'PHP'));
            await waitFor(() => expect(selectedPacks.value['php']).toBe(true));
            expect(selectedPacks.value['laravel']).toBe(true);
            expect(selectedPacks.value['symfony']).toBe(false);
        } finally {
            mock.restore();
        }
    });
});
