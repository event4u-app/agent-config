/**
 * WizardPage resume test — Phase 3 acceptance.
 *
 * Mocks a partial server state (step 3, partial values populated) and
 * asserts the wizard mounts on the correct step with the persisted
 * values seeded into the form signal.
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

function installFetchMock(serverStep: number, partial: Record<string, unknown>): () => void {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = typeof url === 'string' ? url : url.toString();
        const method = init?.method ?? 'GET';
        if (path === '/api/v1/wizard/state' && method === 'GET') {
            return new Response(JSON.stringify({ step: serverStep, totalSteps: WIZARD_TOTAL_STEPS, partial, startedAt: '2026-05-20T00:00:00Z' }), { status: 200 });
        }
        if (path === '/api/v1/settings' && method === 'GET') {
            return new Response(JSON.stringify({ values: { 'personal.user_name': '' }, lastModified: 1, path: '.agent-settings.yml', schema: SETTINGS_SCHEMA }), { status: 200 });
        }
        if (path === '/api/v1/user-md' && method === 'GET') {
            return new Response(JSON.stringify({ body: '', exists: false, lastModified: null }), { status: 200 });
        }
        if (path === '/api/v1/user-md/template' && method === 'GET') {
            return new Response(JSON.stringify({ body: '' }), { status: 200 });
        }
        if (path === '/api/v1/settings/diff' && method === 'POST') {
            return new Response(JSON.stringify({ changes: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;
    return (): void => { global.fetch = original; };
}

beforeEach(() => { resetSignals(); });
afterEach(() => { cleanup(); });

describe('WizardPage resume', () => {
    it('mounts at the persisted step and seeds partial values', async () => {
        const restore = installFetchMock(3, { 'personal.user_name': 'Matze' });
        try {
            render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            expect(stepIndex.value).toBe(3);
            expect(values.value['personal.user_name']).toBe('Matze');
        } finally {
            restore();
        }
    });

    it('clamps an out-of-range server step into [0, WIZARD_TOTAL_STEPS-1]', async () => {
        const restore = installFetchMock(999, {});
        try {
            render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            expect(stepIndex.value).toBe(WIZARD_TOTAL_STEPS - 1);
        } finally {
            restore();
        }
    });

    it('triggers loadUserMdOnce when resuming directly on the userMd step (no Loading hang)', async () => {
        // Resume on step 7 (user-md). Non-extended order: welcome(0), editor(1),
        // personality(2), cost(3), roadmap-quality(4), memory(5), ai-council(6),
        // user-md(7). Without the post-loadAll dispatch the body fetch would
        // never fire and the form would stay stuck on "Loading .agent-user.md…".
        const restore = installFetchMock(7, {});
        try {
            render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(userMdLoaded.value).toBe(true));
            expect(stepIndex.value).toBe(7);
        } finally {
            restore();
        }
    });

    it('triggers refreshDiff and userMd load when resuming directly on the review step', async () => {
        const restore = installFetchMock(WIZARD_TOTAL_STEPS - 1, {});
        try {
            render(<WizardPage path="/wizard" />);
            await waitFor(() => expect(loaded.value).toBe(true));
            await waitFor(() => expect(userMdLoaded.value).toBe(true));
            // refreshDiff resolves with empty changes; toggling diffLoading
            // back to false is the evidence it ran.
            await waitFor(() => expect(diffLoading.value).toBe(false));
            expect(reviewChanges.value).toEqual([]);
        } finally {
            restore();
        }
    });
});
