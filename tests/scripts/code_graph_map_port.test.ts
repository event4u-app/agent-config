import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { sampleAreas } from './code_graph_map_areas_fixture.js';

// The Overview and the Code Workbench follow the design handover: its layer
// cards, its rows and labels, its rail order — filled with this tree's facts,
// or "no data yet" with the reason where the map has none.

let browser: Browser;
let full: string;
let empty: string;
const roots: string[] = [];

async function drawn(withAreas: boolean): Promise<string> {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-port-')));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'agents'));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'order_service.ts'), 'export const a = 1;\n');
    for (const n of ['b', 'c', 'd']) fs.writeFileSync(path.join(root, 'src', `${n}.ts`), `import { a } from './order_service';\nexport const ${n} = a;\n`);
    // Without areas no reader's payload is drawn: every knowledge layer is one no reader ran for.
    const res = await buildMap(root, { areas: withAreas ? sampleAreas() : {} });
    return path.join(res.outDir, 'index.html');
}

async function open(file: string, hash: string, lang = 'en-US'): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: lang });
    await page.goto(pathToFileURL(file).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return page;
}

beforeAll(async () => {
    full = await drawn(true);
    empty = await drawn(false);
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('the Overview carries the design layers', () => {
    it('nine cards with the four rows each, in the design order', async () => {
        const page = await open(full, '#/overview');
        const names = await page.locator('.ocard > .between b').allTextContents();
        expect(names).toEqual(['Code', 'Database', 'Systems', 'Integrations', 'Environment', 'CI/CD', 'Infrastructure', 'Knowledge · Memory', 'Impact', 'Projects']);
        for (const card of await page.locator('.ocard').all()) {
            expect(await card.locator('.okv > span.muted').allTextContents()).toEqual(['indexed', 'source checked', 'coverage', 'findings']);
        }
        await page.close();
    });

    it('a layer without a reader keeps its card, says "no data yet" and why', async () => {
        const page = await open(empty, '#/overview');
        const data = page.locator('#ov-data');
        expect(await data.locator('.nodata-tag').textContent()).toBe('no data yet');
        expect(await data.textContent()).toMatch(/No schema reader ran/);
        expect(await data.locator('.okv > span:not(.muted)').allTextContents()).toEqual(['–', '–', '–', '–']);
        await page.close();
    });

    it('Projects is its own scope: no link, no path of this machine', async () => {
        const page = await open(full, '#/overview');
        const proj = page.locator('#ov-projects');
        expect(await proj.evaluate((n) => n.tagName)).toBe('DIV');
        expect(await proj.textContent()).not.toMatch(/~\/|\/Users\/|\/home\//);
        expect(await page.locator('a[href*="estate"], a[href*="event4u"]').count()).toBe(0);
        await page.close();
    });

    it('the reliability baseline shows R1–R6 without a state the map does not hold', async () => {
        const page = await open(full, '#/overview');
        const rows = page.locator('.gate');
        expect(await rows.count()).toBe(6);
        expect(await rows.locator('.nodata-tag').count()).toBe(6);
        expect(await page.locator('.oproto li').count()).toBe(7);
        await page.close();
    });
});

describe('the Code Workbench follows the design rail by rail', () => {
    it('colour options in the design order, Lines among them', async () => {
        const page = await open(full, '#/code');
        const opts = (await page.locator('#colorby .opt').allTextContents()).map((s) => s.replace(/no data.*$/, '').trim());
        expect(opts).toEqual(['Blast', 'Area', 'Test share', 'Role', 'Churn', 'Lines', 'Folder', 'Layer', 'Domain', 'Complexity']);
        await page.click('#colorby .opt:has-text("Lines")');
        expect(await page.locator('#legend').textContent()).toMatch(/Lines per area: [\d,]+ → [\d,]+/);
        await page.close();
    });

    it('rail heads name their rail, the breadcrumb starts at the repository', async () => {
        const page = await open(full, '#/code', 'de-DE');
        expect(await page.locator('#title-left').textContent()).toBe('Repository');
        expect(await page.locator('#title-right').textContent()).toBe('Detail');
        expect((await page.locator('#crumbs > button').allTextContents())[0]).toBe('Repo');
        await page.close();
    });

    it('the findings tab opens with file cycles, then hotspots and dead files', async () => {
        const page = await open(full, '#/code');
        await page.click('#tabs button:nth-child(2)');
        const titles = await page.locator('#panel .card > .between b').allTextContents();
        expect(titles.slice(0, 3)).toEqual(['File cycles', 'Hotspots', 'Dead files']);
        await page.close();
    });

    it('a marked area shows its working title from the hub file, the hub and six tiles', async () => {
        const page = await open(full, '#/code');
        await page.click('#tabs button:nth-child(3)');
        expect(await page.locator('#panel .aentry').count()).toBeGreaterThan(0);
        await page.locator('#panel .aentry').first().click();
        await page.click('#tabs button:nth-child(3)');
        const title = (await page.locator('#panel .atitle b').textContent()) ?? '';
        expect(title).toMatch(/^a\d+ · [A-Z]/);
        expect(title).not.toMatch(/\.ts$/);
        expect(await page.locator('#panel .atitle .mono').textContent()).toMatch(/^Hub: /);
        expect(await page.locator('#panel .atiles .tile').count()).toBe(6);
        expect(await page.locator('#panel .aentry').count()).toBe(0);
        await page.close();
    });
});
