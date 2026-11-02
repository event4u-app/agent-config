// road-to-a-page-that-says-what-it-loads 3.1, the live half: a real Chromium
// renders the frozen corpus offline. Runs in the browser CI job
// (AGENT_CONFIG_BROWSER_SUITES=1); skips where no Chromium is installed.
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { chromiumAvailable } from '../../src/scripts/ui_conformance_probe';
import { renderWitness } from '../../src/scripts/web_launch_render';

const REPO = path.resolve(__dirname, '..', '..');
const CORPUS = path.join(REPO, 'tests', 'fixtures', 'third-party-load');
const hosts = (urls: { url: string }[]): string[] => [...new Set(urls.map((u) => new URL(u.url).host))].sort();
const live = chromiumAvailable();

describe('render witness over the frozen corpus (real browser)', () => {
    it.skipIf(!live)('records planted 1, 2, 4, 5 and lets nothing leave the machine', async () => {
        const w = await renderWitness(path.join(CORPUS, 'planted'));
        expect(w.status).toBe('ok');
        expect(hosts(w.requests)).toEqual(['fonts.googleapis.com', 'www.google.com', 'www.youtube-nocookie.com']);
        expect(w.requests.some((q) => q.page === 'css/site.css' || /Lora/.test(q.url))).toBe(true);
        expect(w.continued).toEqual([]);
    }, 60_000);

    it.skipIf(!live)('the click-to-load twins request nothing on first paint', async () => {
        const w = await renderWitness(path.join(CORPUS, 'safe'));
        expect(w.status).toBe('ok');
        expect(w.requests).toEqual([]);
        expect(w.continued).toEqual([]);
    }, 60_000);
});
