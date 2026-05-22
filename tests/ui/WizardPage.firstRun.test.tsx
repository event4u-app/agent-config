/**
 * WizardPage first-run test — settings file does not yet exist.
 *
 * Asserts that GET /api/v1/settings returning 404 / NOT_FOUND does NOT
 * surface as `loadError` (which would render the contradictory
 * "Use the wizard to create it" banner inside the wizard itself).
 * Instead the wizard falls back to GET /api/v1/schema, seeds empty
 * values, and renders Step 0 normally — that's the first-run path
 * `setup --dry-run` lands on when there is no `.agent-settings.yml`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/preact';
import { WizardPage } from '../../src/ui/pages/WizardPage.js';
import {
    banner, diffLoading, errors, initialSettings, loaded, loadError, reviewChanges,
    saving, schema, settingsLastModified, stepIndex, userMdBody, userMdExists,
    userMdInitial, userMdLoaded, userMdSkipped, values,
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
    userMdBody.value = '';
    userMdInitial.value = '';
    userMdExists.value = false;
    userMdLoaded.value = false;
    userMdSkipped.value = false;
    reviewChanges.value = [];
}

const FALLBACK_SCHEMA = {
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

interface Call { method: string; path: string }

function installFirstRunFetchMock(): { calls: Call[]; restore: () => void } {
    const calls: Call[] = [];
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        calls.push({ method, path });
        if (path === '/api/v1/wizard/state' && method === 'GET') {
            return new Response(
                JSON.stringify({ step: 0, totalSteps: WIZARD_TOTAL_STEPS, partial: {}, startedAt: null }),
                { status: 200 },
            );
        }
        if (path === '/api/v1/settings' && method === 'GET') {
            return new Response(
                JSON.stringify({ error: { code: 'NOT_FOUND', message: 'settings file missing' } }),
                { status: 404 },
            );
        }
        if (path === '/api/v1/schema' && method === 'GET') {
            return new Response(
                JSON.stringify({ settings: FALLBACK_SCHEMA, userMd: {}, generatedAt: '2026-05-22T00:00:00Z' }),
                { status: 200 },
            );
        }
        if (path === '/api/v1/user-md' && method === 'GET') {
            return new Response(JSON.stringify({ body: '', exists: false, lastModified: null }), { status: 200 });
        }
        if (path === '/api/v1/user-md/template' && method === 'GET') {
            return new Response(JSON.stringify({ body: '# template\n' }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { calls, restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { resetSignals(); });
afterEach(() => { cleanup(); });

describe('WizardPage first-run (no .agent-settings.yml on disk)', () => {
    it('falls back to /api/v1/schema and renders the wizard without a loadError', async () => {
        const mock = installFirstRunFetchMock();
        try {
            render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));

            // The wizard mounted and is on step 0 — no contradictory banner.
            expect(loadError.value).toBeNull();
            expect(stepIndex.value).toBe(0);
            // Schema came from the /api/v1/schema fallback.
            expect(schema.value).not.toBeNull();
            // Values seeded as empty (no settings on disk yet).
            expect(values.value).toEqual({});
            expect(settingsLastModified.value).toBe(0);
            // Both endpoints were consulted: settings (404) then schema.
            const settingsCalls = mock.calls.filter((c) => c.path === '/api/v1/settings' && c.method === 'GET');
            const schemaCalls = mock.calls.filter((c) => c.path === '/api/v1/schema' && c.method === 'GET');
            expect(settingsCalls.length).toBe(1);
            expect(schemaCalls.length).toBe(1);
        } finally {
            mock.restore();
        }
    });
});
