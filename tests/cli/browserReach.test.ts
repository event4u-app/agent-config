// road-to-tells-a-near-miss-can-refute 2.1: a browser without a new dependency.
import { describe, expect, it } from 'vitest';

import { findSystemBrowser, resolveBrowser, systemBrowserCandidates } from '../../src/cli/commands/browserReach.js';

describe('systemBrowserCandidates', () => {
    it('AGENT_CONFIG_BROWSER comes first on every platform', () => {
        for (const platform of ['darwin', 'linux', 'win32'] as const) {
            expect(systemBrowserCandidates(platform, { AGENT_CONFIG_BROWSER: '/opt/my/chrome', PATH: '/usr/bin' })[0]).toBe(
                '/opt/my/chrome',
            );
        }
    });

    it('linux searches PATH for the Chromium family', () => {
        const c = systemBrowserCandidates('linux', { PATH: '/usr/bin:/snap/bin' });
        expect(c).toContain('/usr/bin/google-chrome');
        expect(c).toContain('/snap/bin/chromium');
    });

    it('macOS names the app bundles', () => {
        expect(systemBrowserCandidates('darwin', {})).toContain('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    });
});

describe('findSystemBrowser', () => {
    it('returns the first candidate that exists, or null', () => {
        const env = { PATH: '/a:/b' };
        expect(findSystemBrowser('linux', env, (p) => p === '/b/chromium')).toBe('/b/chromium');
        expect(findSystemBrowser('linux', env, () => false)).toBeNull();
    });
});

describe('resolveBrowser', () => {
    it('resolves a driver in this repository (its devDependency) and says which', async () => {
        const reach = await resolveBrowser();
        expect(reach).not.toBeNull();
        expect(['@playwright/test', 'playwright-core']).toContain(reach!.source);
    });
});
