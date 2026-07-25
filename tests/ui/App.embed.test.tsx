/**
 * App embed chrome switch (reciprocal-ecosystem embed contract, Phase 1).
 *
 * Under `?embed=1` the host owns navigation and theme, so the standalone
 * chrome (TopNav — brand, surface tabs, theme toggle) is hidden while every
 * settings surface stays reachable: the `#/settings` / `#/settings/<section>`
 * deep links still render. Without the flag the standalone surface — chrome
 * included — is unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/preact';

function installFetch(): { restore: () => void } {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request) => {
        const path = typeof url === 'string' ? url : url.toString();
        if (path.startsWith('/api/v1/ping')) {
            return new Response(JSON.stringify({
                ok: true,
                version: '9.7.0',
                projectRoot: '/x',
                writeRoot: '/x',
                mode: 'global',
                dryRun: false,
                projectScopeAvailable: false,
                systemUser: 'test',
                projectSurface: false,
                devSurfaces: false,
                capabilities: { configRoot: true, embed: { supported: true, version: 1, features: ['theme', 'deepLink'] } },
            }), { status: 200 });
        }
        if (path.startsWith('/api/v1/settings')) {
            return new Response(JSON.stringify({
                values: {},
                lastModified: 1700000000000,
                path: '.agent-settings.yml',
                schema: { type: 'object', properties: {} },
            }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: path } }), { status: 404 });
    }) as unknown as typeof fetch;
    return { restore: (): void => { global.fetch = original; } };
}

async function renderAppAt(url: string): Promise<ReturnType<typeof render>> {
    vi.resetModules();
    window.location.href = url;
    const { App } = await import('../../src/ui/App.js');
    return render(<App />);
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); vi.resetModules(); });

describe('App — embed chrome switch', () => {
    it('standalone (#/settings): renders the top nav + theme toggle and the settings surface', async () => {
        const mock = installFetch();
        try {
            const { container } = await renderAppAt('http://localhost/#/settings');
            await waitFor(() => expect(container.querySelector('.ac-page')).not.toBeNull());
            expect(container.querySelector('.ac-topnav')).not.toBeNull();
            expect(container.querySelector('.ac-topnav__theme')).not.toBeNull();
        } finally {
            mock.restore();
        }
    });

    it('embed (?embed=1#/settings): hides the top nav + theme toggle, settings deep link still renders', async () => {
        const mock = installFetch();
        try {
            const { container } = await renderAppAt('http://localhost/?embed=1#/settings');
            await waitFor(() => expect(container.querySelector('.ac-page')).not.toBeNull());
            expect(container.querySelector('.ac-topnav')).toBeNull();
            expect(container.querySelector('.ac-topnav__theme')).toBeNull();
            expect(container.querySelector('.ac-page')?.textContent).toContain('Settings');
        } finally {
            mock.restore();
        }
    });

    it('embed deep link to a settings section (#/settings/personal) renders the surface, no chrome', async () => {
        const mock = installFetch();
        try {
            const { container } = await renderAppAt('http://localhost/?embed=1#/settings/personal');
            await waitFor(() => expect(container.querySelector('.ac-page')).not.toBeNull());
            expect(container.querySelector('.ac-topnav')).toBeNull();
        } finally {
            mock.restore();
        }
    });
});
