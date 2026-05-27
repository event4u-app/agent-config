/**
 * WizardPage welcome step (Step 1) — name + language pulled to the front.
 *
 *   - Name pre-fills from the OS account (serverStatus.systemUser) when empty.
 *   - Language pre-fills from the browser locale when no .agent-user.yml exists.
 *   - Editing flows into userMdBody (written at finish).
 *
 * Resumes directly on the welcome step (index 0, extended/install mode).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/preact';
import { WizardPage } from '../../src/ui/pages/WizardPage.js';
import { serverStatus } from '../../src/ui/serverStatus.js';
import {
    banner, diffLoading, errors, extendedSteps, initialSettings, loaded, loadError,
    saving, schema, settingsLastModified, stepIndex, userMdBody, userMdExists,
    userMdInitial, userMdLoaded, userMdSkipped, values, welcomePrefilled, wizardComplete,
} from '../../src/ui/wizard/state.js';

const SETTINGS_SCHEMA = {
    type: 'object',
    properties: { personal: { type: 'object', properties: { user_name: { type: 'string' } } } },
};

function resetSignals(): void {
    loaded.value = false; loadError.value = null; banner.value = null; saving.value = false;
    diffLoading.value = false; stepIndex.value = 0; schema.value = null; values.value = {};
    initialSettings.value = {}; settingsLastModified.value = 0; errors.value = {};
    userMdBody.value = null; userMdInitial.value = null; userMdExists.value = false;
    userMdLoaded.value = false; userMdSkipped.value = false; wizardComplete.value = false;
    extendedSteps.value = false; welcomePrefilled.value = false; serverStatus.value = null;
}

function installFetchMock(userMdExistsOnDisk: boolean, systemUser: string): { restore: () => void } {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        if (path === '/api/v1/ping' && method === 'GET') {
            return new Response(JSON.stringify({
                ok: true, version: '0', projectRoot: '/x', writeRoot: '/x',
                mode: 'global', dryRun: false, projectScopeAvailable: false, systemUser,
            }), { status: 200 });
        }
        if (path === '/api/v1/wizard/state' && method === 'GET') {
            return new Response(JSON.stringify({ step: 0, totalSteps: 13, partial: {}, startedAt: null, extendedSteps: true }), { status: 200 });
        }
        if (path === '/api/v1/settings' && method === 'GET') {
            return new Response(JSON.stringify({ values: {}, lastModified: 1, path: '.agent-settings.yml', schema: SETTINGS_SCHEMA }), { status: 200 });
        }
        if (path === '/api/v1/user-md' && method === 'GET') {
            // When the file exists, return a parsed identity (language already
            // set to 'en') so the browser-locale pre-fill must NOT override it.
            const identity = userMdExistsOnDisk
                ? { version: 1, identity: { name: 'Existing' }, language: 'en', role: ['founder'], style: { pace: 'pragmatic' }, voice_sample: 'hi', last_updated: '2026-05-19' }
                : null;
            return new Response(JSON.stringify({ body: '', exists: userMdExistsOnDisk, identity, lastModified: null }), { status: 200 });
        }
        if (path === '/api/v1/user-md/template' && method === 'GET') return new Response('{"body":""}', { status: 200 });
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { restore: (): void => { global.fetch = original; } };
}

function nameInput(container: HTMLElement): HTMLInputElement {
    return container.querySelector('#welcome-name') as HTMLInputElement;
}
function langInput(container: HTMLElement): HTMLInputElement {
    return container.querySelector('#welcome-lang') as HTMLInputElement;
}

beforeEach(() => {
    resetSignals();
    Object.defineProperty(navigator, 'language', { value: 'de-DE', configurable: true });
});
afterEach(() => { cleanup(); });

describe('WizardPage welcome step', () => {
    it('pre-fills name from the system user and language from the browser', async () => {
        // WizardPage does not fetch /ping itself (App does), so seed it.
        serverStatus.value = {
            ok: true, version: '0', projectRoot: '/x', writeRoot: '/x',
            mode: 'global', dryRun: false, projectScopeAvailable: false, systemUser: 'matze',
        };
        const mock = installFetchMock(false, 'matze');
        try {
            const { container } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(nameInput(container)).not.toBeNull());
            await waitFor(() => expect(nameInput(container).value).toBe('matze'));
            expect(langInput(container).value).toBe('de'); // de-DE → de
            expect(userMdBody.value?.identity.name).toBe('matze');
        } finally {
            mock.restore();
        }
    });

    it('does not pre-fill language when a .agent-user.yml already exists', async () => {
        const mock = installFetchMock(true, ''); // file exists → keep its language
        try {
            const { container } = render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(langInput(container)).not.toBeNull());
            // Template default language is 'en'; browser pre-fill is suppressed.
            expect(langInput(container).value).toBe('en');
        } finally {
            mock.restore();
        }
    });
});
