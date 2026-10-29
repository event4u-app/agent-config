import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { sampleAreas } from './code_graph_map_areas_fixture.js';

// Every route switch draws its page in full, whatever the previous route left
// behind: an area opened deep (an item picked, a file marked) and then the
// Overview — by the nav, by the browser's back button, by a typed hash — shows
// its cards, without a page error.

let browser: Browser;
let html: string;
let root: string;

const DEEP: Record<string, string> = {
    data: 'table/users',
    interfaces: 'service/partner',
    runtime: '',
    delivery: 'workflow/.github/workflows/ci.yml',
    impact: '',
    agent: '',
};

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-roundtrip-')));
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b', 'c']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const ${n} = a;\n`);
    const res = await buildMap(root, { areas: sampleAreas() });
    html = path.join(res.outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

async function open(hash: string): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}
const at = (page: Page, r: string) => page.waitForFunction((x) => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === x, r);
async function hashTo(page: Page, h: string, route: string): Promise<void> {
    await page.evaluate((x) => { location.hash = x; }, h);
    await at(page, route);
}
async function overviewDrawn(page: Page): Promise<void> {
    expect(await page.locator('#av-main .ocard').count()).toBe(11);
    expect(await page.locator('#av-main').isVisible()).toBe(true);
}

/** Into one area as deep as it goes: an item picked, or for Code a file marked inside an opened area. */
async function goDeep(page: Page, area: string): Promise<void> {
    if (area === 'code') {
        await hashTo(page, '#/code', 'code');
        await page.click('#tabs button:nth-child(3)');
        // The Code area keeps its mark across routes: the second visit is already deep.
        if ((await page.locator('#panel .aentry').count()) > 0) await page.locator('#panel .aentry').first().click();
        await page.locator('#panel .atitle').waitFor();
        return;
    }
    await hashTo(page, '#/' + area + (DEEP[area] ? '/' + encodeURIComponent(DEEP[area]) : ''), area);
}

describe('back to the Overview from every area, however deep', () => {
    for (const area of ['code', 'data', 'systems', 'interfaces', 'runtime', 'delivery', 'impact', 'agent']) {
        it(`${area} → Overview by the nav, by back, by a typed hash`, async () => {
            const { page, errors } = await open('#/overview');
            await overviewDrawn(page);
            await goDeep(page, area);
            await page.click('#areanav a[data-route="overview"]');
            await at(page, 'overview');
            await overviewDrawn(page);
            await goDeep(page, area);
            await page.goBack();
            await at(page, 'overview');
            await overviewDrawn(page);
            await goDeep(page, area);
            await hashTo(page, '#/overview', 'overview');
            await overviewDrawn(page);
            expect(errors).toEqual([]);
            await page.close();
        });
    }

    it('a tour through all areas lands on a full Overview at every stop home', async () => {
        const { page, errors } = await open('#/overview');
        for (const area of ['data', 'code', 'interfaces', 'delivery', 'agent', 'runtime', 'impact']) {
            await goDeep(page, area);
            await hashTo(page, '#/overview', 'overview');
            await overviewDrawn(page);
        }
        expect(errors).toEqual([]);
        await page.close();
    });
});
