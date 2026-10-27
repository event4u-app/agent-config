import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type HubPayload, renderHub } from '../../src/scripts/code_graph/estate_map.js';

// The Projects hub of the 2026-10-bf handover (road-to-map-views-from-the-handover,
// step 5.1): two lenses, the Registry aside with its budget, the Kante aside,
// "← Projekt-Map", and Ich · Lernen — empty with its reason until the user
// learning lane writes data, then drawn from that data only.

let browser: Browser;
const roots: string[] = [];
const w = (file: string, line: number) => ({ file, line, hash: 'ab12cd34' });
const payload = (): HubPayload => ({
    reader: 'hub', completeness: 'complete', findings: [],
    projects: [{ id: 'aaaa-1', name: 'alpha', indexed: true, indexedAt: '2026-10-26', page: 'aaaa-1/index.html' }, { id: 'bbbb-2', name: 'beta', indexed: false, page: null, pageReason: 'no map drawn yet' }],
    edges: [{ source: 'aaaa-1', target: 'bbbb-2', via: 'package', detail: '@x/beta' }],
    ports: [{ port: '8080/tcp', uses: [{ project: 'aaaa-1', name: 'web', witness: w('docker-compose.yml', 5) }, { project: 'bbbb-2', name: 'api', witness: w('docker-compose.yml', 5) }] }],
    images: [], services: [], versions: [], calls: [], skipped: [],
});
function hub(p: HubPayload): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-hubme-')));
    roots.push(dir);
    const html = path.join(dir, 'index.html');
    fs.writeFileSync(html, renderHub(p, dir));
    return html;
}
async function open(html: string): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'de-DE' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + '#/projects');
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}

beforeAll(async () => {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('the Projects hub', () => {
    it('Projekte: two lenses, the Registry aside with its budget, the Kante aside and the way back', async () => {
        const { page, errors } = await open(hub(payload()));
        expect(await page.locator('#av-bar [role="tablist"] [role="tab"]').allTextContents()).toEqual(['Projekte', 'Ich · Lernen']);
        expect(await page.locator('#av-bar [role="tab"][aria-selected="true"]').textContent()).toBe('Projekte');
        expect(await page.locator('#av-bar [role="tab"][aria-selected="true"]').evaluate((e) => getComputedStyle(e).boxShadow)).toBe('rgb(201, 162, 255) 0px 0px 0px 1px inset');
        expect(await page.locator('#av-bar .hub-note').textContent()).toBe('Projekte auf diesem Rechner');
        expect(await page.locator('#av-left').getAttribute('aria-label')).toBe('Registry');
        expect(await page.locator('#av-side').getAttribute('aria-label')).toBe('Kante');
        expect(await page.locator('#av-left-body').textContent()).toContain('Budget');
        expect(await page.locator('#hub-back').textContent()).toContain('← Projekt-Map');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('Ich · Lernen: empty with its reason and no Kante aside, then drawn from the learning data alone', async () => {
        const { page, errors } = await open(hub(payload()));
        await page.click('#av-bar [data-lens="me"]');
        expect(await page.locator('#av-bar .hub-note').textContent()).toBe('Nutzer-Learnings · K.2–K.8');
        expect(await page.locator('.hub-me-only').textContent()).toContain('Nur du siehst das.');
        expect(await page.locator('#nodata-me .ep-head').textContent()).toBe('Ich · Lernen · noch keine Daten');
        expect(await page.locator('#av-side').isVisible()).toBe(false);
        expect(await page.locator('#hub-me-kpis').count()).toBe(0);
        await page.close();
        // With the data, its figures and only its figures.
        const me = { kpis: [{ v: 3, l: 'Signale', sub: 'letzte 7 Tage' }, { v: 1, l: 'Kandidaten' }], candidates: [{ title: 'kurze Antworten', state: 'Kandidat', rows: [['Sessions', '2']] as [string, string][] }], signals: [{ kind: 'Zustimmung', topic: 'Antwortlänge', span: '…kürzer…', where: 'aaaa-1' }] };
        const full = await open(hub({ ...payload(), me }));
        await full.page.click('#av-bar [data-lens="me"]');
        expect(await full.page.locator('#nodata-me').count()).toBe(0);
        expect(await full.page.locator('#hub-me-kpis .hub-me-kpi .mono').evaluateAll((xs) => xs.filter((_, i) => i % 2 === 0).map((x) => x.textContent))).toEqual(['3', '1']);
        expect(await full.page.locator('.hub-me-sec').nth(1).textContent()).toContain('Letzte Signale · 1');
        expect([...errors, ...full.errors]).toEqual([]);
        await full.page.close();
    });
});
