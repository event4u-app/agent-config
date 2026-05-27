/**
 * WizardPage flow test — Phase 3 acceptance.
 *
 * Mounts the wizard, drives Next/Finish via click events, and asserts:
 *   - POST /api/v1/wizard/state is called between every step transition
 *   - POST /api/v1/wizard/finish is called exactly once, with values
 *
 * Signals are module-level globals shared with the page, so the test
 * resets them in `beforeEach` to avoid cross-test bleed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { WizardPage } from '../../src/ui/pages/WizardPage.js';
import {
    banner, diffLoading, errors, initialSettings, loaded, loadError, reviewChanges,
    saving, schema, settingsLastModified, stepIndex, userMdBody, userMdExists,
    userMdInitial, userMdLoaded, userMdSkipped, values, wizardComplete,
} from '../../src/ui/wizard/state.js';
import { WIZARD_TOTAL_STEPS } from '../../src/ui/wizard/steps.js';

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
}

const SETTINGS_SCHEMA = {
    type: 'object',
    properties: {
        personal: {
            type: 'object',
            properties: {
                user_name: { type: 'string', title: 'Your name' },
            },
        },
    },
};

interface Call { method: string; path: string; body: unknown }

function installFetchMock(): { calls: Call[]; restore: () => void } {
    const calls: Call[] = [];
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        const body = init?.body !== undefined ? JSON.parse(init.body as string) : undefined;
        calls.push({ method, path, body });
        if (path === '/api/v1/wizard/state' && method === 'GET') {
            return new Response(JSON.stringify({ step: 0, totalSteps: WIZARD_TOTAL_STEPS, partial: {}, startedAt: null }), { status: 200 });
        }
        if (path === '/api/v1/settings' && method === 'GET') {
            return new Response(JSON.stringify({ values: { 'personal.user_name': '' }, lastModified: 1, path: 'settings/.agent-settings.yml', schema: SETTINGS_SCHEMA }), { status: 200 });
        }
        if (path === '/api/v1/wizard/state' && method === 'POST') {
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (path === '/api/v1/user-md' && method === 'GET') {
            return new Response(JSON.stringify({ identity: null, exists: false, lastModified: null }), { status: 200 });
        }
        if (path === '/api/v1/user-md/template' && method === 'GET') {
            const tpl = [
                'version: 1',
                'identity:',
                '    name: ""',
                'language: "en"',
                'role:',
                '    - ""',
                'style:',
                '    pace: "pragmatic"',
                'voice_sample: ""',
                'last_updated: "1970-01-01"',
                '',
            ].join('\n');
            return new Response(JSON.stringify({ body: tpl }), { status: 200 });
        }
        if (path === '/api/v1/settings/diff' && method === 'POST') {
            return new Response(JSON.stringify({ changes: [{ path: 'personal.user_name', from: '', to: 'Matze' }] }), { status: 200 });
        }
        if (path === '/api/v1/wizard/finish' && method === 'POST') {
            return new Response(JSON.stringify({ writtenPaths: ['settings/.agent-settings.yml'], txnId: 'tx-1' }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { calls, restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { resetSignals(); });
afterEach(() => { cleanup(); });

describe('WizardPage flow', () => {
    it('persists every transition and finishes with one POST /finish', async () => {
        const mock = installFetchMock();
        try {
            const { getByRole } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));

            // Walk steps 0 → last via Next clicks.
            for (let i = 0; i < WIZARD_TOTAL_STEPS - 1; i++) {
                const nextBtn = getByRole('button', { name: 'Next' });
                fireEvent.click(nextBtn);
                await waitFor(() => expect(stepIndex.value).toBe(i + 1));
            }

            // Last step renders Finish button — wait for the diff refresh to settle first.
            await waitFor(() => expect(diffLoading.value).toBe(false));
            const finishBtn = getByRole('button', { name: /Finish/ });
            fireEvent.click(finishBtn);
            await waitFor(() => expect(saving.value).toBe(false));

            const stateWrites = mock.calls.filter((c) => c.path === '/api/v1/wizard/state' && c.method === 'POST');
            expect(stateWrites.length).toBe(WIZARD_TOTAL_STEPS - 1);

            const finishes = mock.calls.filter((c) => c.path === '/api/v1/wizard/finish' && c.method === 'POST');
            expect(finishes.length).toBe(1);
            expect(finishes[0]!.body).toMatchObject({ settings: expect.any(Object) });

            // Post-finish UI contract: banner carries the close-window hint
            // and the Finish button is gone (completed=true suppresses it).
            expect(wizardComplete.value).toBe(true);
            expect(banner.value?.message ?? '').toContain('You can close this browser window');
            expect(() => getByRole('button', { name: /Finish/ })).toThrow();
        } finally {
            mock.restore();
        }
    });
});
