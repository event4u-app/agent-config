import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap, renderHtml } from '../../src/scripts/code_graph/map.js';
import type { MapAreas } from '../../src/scripts/code_graph/map_areas.js';
import { sampleAreas } from './code_graph_map_areas_fixture.js';

// The Übersicht page of the 2026-10-bf handover (road-to-map-views-from-the-handover,
// Phase 2), drawn from a sample map: every figure on it is checked against the
// page's own `#map-data`, never against a number the handover printed.

let browser: Browser;
let full: string;
let behind: string;
let emptyData: string;
const roots: string[] = [];

async function open(html: string, hash = '#/overview', locale = 'de-DE', width = 1440): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'dark', locale });
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return page;
}
/** Every {file, line, hash} object in the area payloads: the witnesses the map holds. */
function witnesses(v: unknown, out: Array<{ confirm?: string }> = []): Array<{ confirm?: string }> {
    if (!v || typeof v !== 'object') return out;
    if (Array.isArray(v)) { v.forEach((x) => witnesses(x, out)); return out; }
    const o = v as Record<string, unknown>;
    if (typeof o['file'] === 'string' && typeof o['line'] === 'number' && o['hash'] !== undefined) { out.push(o as { confirm?: string }); return out; }
    Object.values(o).forEach((x) => witnesses(x, out));
    return out;
}

beforeAll(async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ovp-')));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const b = a;\n`);
    const res = await buildMap(root, { areas: sampleAreas() });
    full = path.join(res.outDir, 'index.html');
    const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { meta: Parameters<typeof renderHtml>[1]; model: Parameters<typeof renderHtml>[0]; areas: MapAreas };
    doc.model.pin = { ...(doc.model.pin ?? { commit: '', date: '', generation: '' }), freshness: 'behind:3' };
    behind = path.join(res.outDir, 'behind.html');
    fs.writeFileSync(behind, renderHtml(doc.model, { ...doc.meta, state: 'behind:3' }, doc.areas));
    // The data reader ran and said "empty", yet its payload still carries findings with witnesses.
    const areas = sampleAreas();
    const data = areas.data as unknown as { empty?: string; findings: Array<{ subject: string }> };
    data.empty = 'no migration was found';
    data.findings = data.findings.map((f) => ({ ...f, subject: `tests/fixtures/${f.subject}` }));
    emptyData = path.join(res.outDir, 'empty-data.html');
    fs.writeFileSync(emptyData, renderHtml(doc.model, doc.meta, areas));
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('Übersicht', () => {
    it('banner: the state filter is a radiogroup at the end of the legend, and the banner says the state as built, the command, the snapshot and the witnesses', async () => {
        const page = await open(behind);
        const group = page.locator('.ov-legend [role="radiogroup"][aria-label="Filter"]');
        expect(await group.locator('[role="radio"]').allTextContents()).toEqual(['Alle Ebenen', 'Mit Daten', 'Geplant · leer']);
        expect(await group.locator('[role="radio"][aria-checked="true"]').textContent()).toBe('Alle Ebenen');
        expect(await page.locator('#av-main [role="tablist"]').count()).toBe(0);
        await group.locator('[role="radio"]', { hasText: 'Mit Daten' }).click();
        expect(await page.locator('.ov-legend [role="radio"][aria-checked="true"]').textContent()).toBe('Mit Daten');
        await page.locator('.ov-legend [role="radio"]', { hasText: 'Alle Ebenen' }).click();
        const banner = page.locator('#ov-banner');
        const text = (await banner.textContent()) ?? '';
        const data = await page.evaluate(() => JSON.parse(document.getElementById('map-data')!.textContent!) as { areas: Record<string, unknown>; model: { pin: { commit: string } } });
        expect(text).toContain('behind:3');
        expect(text).toContain(`Gezeichnet bei ${data.model.pin.commit.slice(0, 8)}, HEAD ist 3 Commits weiter.`);
        expect(text).toContain('Die Fakten gelten für den Snapshot. Neu zeichnen: agent-config code-graph refresh.');
        expect(text).toContain('Snapshot · ohne Branch-Stand');
        const ws = ['data', 'systems', 'interfaces', 'runtime', 'delivery', 'impact', 'agent'].flatMap((id) => witnesses(data.areas[id]));
        const reread = ws.filter((w) => w.confirm && w.confirm !== 'unconfirmed').length;
        expect(ws.length).toBeGreaterThan(0);
        expect(text).toContain(`${ws.length} Zeugen · ${reread} erneut gelesen`);
        expect(await banner.evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(/inset$/);
        const amber = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--amber').trim());
        expect(await banner.evaluate((e) => getComputedStyle(e).boxShadow)).toContain(amber === '#ffc14d' ? 'rgb(255, 193, 77) 4px 0px 0px 0px inset' : amber);
        await page.close();
        // Sensitivity: the same map drawn fresh says so, in green, and never "Commits weiter".
        const fresh = await open(full);
        const ft = (await fresh.locator('#ov-banner').textContent()) ?? '';
        expect(ft).toContain('der Graph steht auf HEAD.');
        expect(ft).not.toContain('Commits weiter');
        expect(await fresh.locator('#ov-banner').evaluate((e) => getComputedStyle(e).boxShadow)).toBe('rgb(61, 220, 132) 4px 0px 0px 0px inset');
        await fresh.close();
    });

    it('cards: eleven in the handover order on an auto-fill grid, solid with data, dashed otherwise, the branch row, the warn box', async () => {
        const page = await open(full);
        const cards = page.locator('.ogrid > .ocard');
        expect(await cards.locator('.otitle').allTextContents()).toEqual(['Code', 'Datenbank', 'Systeme', 'Integrations', 'Environment', 'CI/CD', 'Infrastruktur', 'Wissen · Memory', 'Impact', 'Bugs & Fixes', 'Projects']);
        expect(await page.locator('.ogrid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(4);
        for (const id of ['ov-code', 'ov-interfaces']) expect(await page.locator(`#${id}`).evaluate((e) => getComputedStyle(e).borderTopStyle), id).toBe('solid');
        for (const id of ['ov-impact', 'ov-bugs', 'ov-projects']) expect(await page.locator(`#${id}`).evaluate((e) => getComputedStyle(e).borderTopStyle), id).toBe('dashed');
        expect(await page.locator('#ov-bugs .obadge').textContent()).toBe('nur lokal');
        expect(await page.locator('#ov-projects .obadge').textContent()).toBe('eigener Scope');
        expect(await page.locator('#ov-bugs .obranch').count()).toBe(0);
        expect(await page.locator('#ov-code .obranch').textContent()).toBe('Branch-Unterschiede:Dateien, Symbole');
        expect(await page.locator('#ov-interfaces .obranch').textContent()).toBe('Branch-Unterschiede:keine Branch-Fakten');
        expect(await page.locator('#ov-code .okv').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ')[0])).toBe('110px');
        expect(await page.locator('#ov-code .obar').evaluate((e) => getComputedStyle(e).height)).toBe('5px');
        // A payload that is not "empty" draws no warn box (sensitivity half).
        expect(await page.locator('.owarn').count()).toBe(0);
        expect(await page.locator('#ov-bugs .otitle').getAttribute('href')).toBe('#/bugs');
        await page.close();
        const warn = await open(emptyData);
        const data = await warn.evaluate(() => JSON.parse(document.getElementById('map-data')!.textContent!) as { areas: { data: { findings: unknown[] } } });
        const facts = witnesses(data.areas.data).length;
        expect(await warn.locator('#ov-data .obadge').textContent()).toBe('gelesen, leer');
        expect(await warn.locator('#ov-data .owarn').textContent()).toBe(`Manifest: „empty“, aber ${facts} Fakten und ${data.areas.data.findings.length} Befunde (Test-Fixtures).`);
        expect(await warn.locator('#ov-data .owarn').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(255, 193, 77, 0.14)');
        await warn.locator('.ov-legend [role="radio"]', { hasText: 'Mit Daten' }).click();
        expect(await warn.locator('#ov-data').count()).toBe(0);
        expect(await warn.locator('#ov-code').count()).toBe(1);
        await warn.locator('.ov-legend [role="radio"]', { hasText: 'Geplant · leer' }).click();
        expect(await warn.locator('#ov-data').count()).toBe(1);
        expect(await warn.locator('#ov-code').count()).toBe(0);
        await warn.close();
    });
});
