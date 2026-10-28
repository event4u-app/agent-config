import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap, renderHtml } from '../../src/scripts/code_graph/map.js';
import type { MapAreas } from '../../src/scripts/code_graph/map_areas.js';

// The Bugs & Fixes route of the 2026-10-bf handover (road-to-map-views-from-the-handover,
// Phase 7): a local map draws the bug lane; a committed map draws only its
// empty state, and no bug id, title or message planted in the local lane
// reaches any file under agents/map/ outside .build/ (AC-17, view half).

let browser: Browser;
let root: string;
let committed: string;
let local: string;
const PLANT = { id: 'BUG-7f3a91', title: 'Checkout crashes for planted-user@example.com', message: 'TypeError: planted secret cart token xyz-91' };
const bugs = {
    reader: 'bugs lane · local', completeness: 'complete', findings: [], adapters: { Sentry: true, Linear: true, Bugsnag: false },
    bugs: [
        { id: 'B-1', title: 'Checkout total off by one', status: 'open', source: 'Sentry', env: 'prod', area: 'checkout', cause: 'logic', symbolicated: true, fixes: [], timeline: [{ at: '2026-10-20', kind: 'seen', text: 'first seen' }], frames: [{ file: 'src/cart.ts', line: 41, fn: 'total' }], hypotheses: ['rounding before tax'], introducedBy: { sha: 'abc12345', why: 'touched total() last' } },
        { id: 'B-2', title: 'Login loop on Safari', status: 'fixed', source: 'Linear', env: 'prod', area: 'auth', cause: 'config', symbolicated: false, fixes: [{ sha: 'def67890', title: 'fix cookie SameSite' }], timeline: [], frames: [], hypotheses: [] },
        { id: 'B-3', title: 'Slow search', status: 'open', source: 'Sentry', env: 'staging', area: 'search', cause: 'perf', symbolicated: true, fixes: [], timeline: [], frames: [], hypotheses: [] },
    ],
};
async function open(html: string): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'de-DE' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + '#/bugs');
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}
function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '.build') walk(f, out); } else out.push(f);
    }
    return out;
}

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-bugs-')));
    fs.mkdirSync(path.join(root, 'agents'));
    fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\n');
    // The local bug lane, as Stage H writes it: never part of the committed map.
    for (const dir of [path.join(root, '.build', 'bugs'), path.join(root, 'agents', 'map', '.build', 'bugs')]) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'bugs.json'), JSON.stringify({ bugs: [{ ...PLANT, status: 'open' }] }));
    }
    const res = await buildMap(root);
    committed = path.join(res.outDir, 'index.html');
    const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { meta: Parameters<typeof renderHtml>[1]; model: Parameters<typeof renderHtml>[0] };
    const localDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-bugs-local-'));
    local = path.join(localDir, 'index.html');
    fs.writeFileSync(local, renderHtml(doc.model, doc.meta, { bugs } as unknown as MapAreas));
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(path.dirname(local), { recursive: true, force: true });
});

describe('Bugs & Fixes', () => {
    it('local: five lenses with counts, the Filter aside with "kein Adapter", Verlauf crumbs and the bug detail', async () => {
        const { page, errors } = await open(local);
        expect(await page.locator('#av-bar [role="tab"]').allTextContents()).toEqual(['Übersicht', 'Bugs · 3', 'Behoben · 1', 'Regressionspfade', 'Zeitleiste']);
        expect(await page.locator('#av-left').getAttribute('aria-label')).toBe('Filter');
        expect(await page.locator('#av-side').getAttribute('aria-label')).toBe('Bug');
        expect(await page.locator('#av-left-body [data-group] > .cap').allTextContents()).toEqual(['Status', 'Quelle', 'Umgebung', 'Area', 'Ursache', 'Symbolisierung']);
        const bugsnag = page.locator('[data-group="source"] [data-v="Bugsnag"]');
        expect(await bugsnag.textContent()).toContain('kein Adapter');
        expect(await bugsnag.isDisabled()).toBe(true);
        expect(await page.locator('[data-group="source"] [data-v="Sentry"] .sy-n').textContent()).toBe('2');
        await page.click('[data-group="env"] [data-v="staging"]');
        expect(await page.locator('#av-bar [role="tab"]').nth(1).textContent()).toBe('Bugs · 2');
        await page.click('#b-list [data-id="B-1"]');
        const d = page.locator('#b-detail');
        expect(await d.textContent()).toContain('Verursachender Commit · Kandidat');
        expect(await d.textContent()).toContain('abc12345 · touched total() last');
        expect(await d.textContent()).toContain('src/cart.ts:41 total');
        await page.click('#b-bar .hist-back');
        expect(await page.locator('#b-detail').textContent()).toContain('Bug wählen');
        await page.click('#b-bar .hist-back');
        expect(await page.locator('#av-bar [role="tab"]').nth(1).textContent()).toBe('Bugs · 3');
        await page.click('[data-lens="fixed"]');
        expect(await page.locator('#b-list .k-src').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-id')))).toEqual(['B-2']);
        expect(errors).toEqual([]);
        await page.close();
    });

    it('committed: only the "keine Daten" tab, the why-empty card and the local-data chip; nothing planted in the lane reaches agents/map', async () => {
        const { page, errors } = await open(committed);
        expect(await page.locator('#av-bar [role="tab"]').allTextContents()).toEqual(['Bugs & Fixes · keine Daten']);
        expect(await page.locator('#av-bar .st').textContent()).toBe('nicht in committeter Map');
        expect(await page.locator('#nodata-bugs .ep-head').textContent()).toBe('Bug-Daten sind lokal – diese Map enthält keine.');
        expect(await page.locator('#b-why .b-tile b').allTextContents()).toEqual(['Committete Map', 'Nicht verbunden', 'Keine Berechtigung', 'Keine Events', 'Sync fehlgeschlagen']);
        expect(await page.locator('#av-left').isVisible()).toBe(false);
        expect(await page.locator('#av-side').isVisible()).toBe(false);
        expect(await page.locator('#areanav a[data-route="bugs"]').getAttribute('class')).toContain('empty');
        expect(errors).toEqual([]);
        await page.close();
        const files = walk(path.join(root, 'agents', 'map'));
        expect(files.length).toBeGreaterThan(0);
        for (const f of files) {
            const text = fs.readFileSync(f, 'utf-8');
            for (const v of Object.values(PLANT)) expect(text.includes(v), `${path.relative(root, f)} carries "${v}"`).toBe(false);
        }
        // Sensitivity: the same grep finds a planted string once one is written outside .build.
        fs.writeFileSync(path.join(root, 'agents', 'map', 'leak.txt'), PLANT.title);
        expect(walk(path.join(root, 'agents', 'map')).some((f) => fs.readFileSync(f, 'utf-8').includes(PLANT.title))).toBe(true);
        fs.rmSync(path.join(root, 'agents', 'map', 'leak.txt'));
    });
});
