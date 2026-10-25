import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';

// 2D and 3D are two views of one graph: the area limit is its own switch, and
// switching the view never changes which areas are shown.

const AREAS = 20;
let root: string;
let html: string;
let areaCount: number;
let browser: Browser;

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-area-limit-')));
    fs.mkdirSync(path.join(root, 'agents'));
    for (let i = 0; i < AREAS; i++) {
        const dir = path.join(root, `pkg${String(i).padStart(2, '0')}`);
        fs.mkdirSync(dir, { recursive: true });
        // Four coupled files per directory: areas under three files are folded away.
        fs.writeFileSync(path.join(dir, 'a.ts'), `export const a${i} = ${i};\n`);
        for (const n of ['b', 'c', 'd'])
            fs.writeFileSync(path.join(dir, `${n}.ts`), `import { a${i} } from './a';\nexport const ${n}${i} = a${i};\n`);
    }
    const res = await buildMap(root);
    html = path.join(res.outDir, 'index.html');
    const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'map.json'), 'utf-8')) as { model?: { areas?: unknown[] } };
    areaCount = (doc.model?.areas ?? []).length;
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);

afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

async function open(): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => (window as unknown as { __mapView?: unknown }).__mapView !== undefined);
    return page;
}

interface MapView {
    lens: string;
    treePath: string;
    level: string;
    area: number;
    file: number;
    shownAreas: number[];
    drawn: Array<{ kind: string; idx: number; x: number; y: number }>;
}
const view = (page: Page): Promise<MapView> =>
    page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as { __mapView: MapView }).__mapView)) as MapView);
const shown = async (page: Page): Promise<number[]> => (await view(page)).shownAreas;

/** Page coordinates of the first drawn area node. */
async function firstArea(page: Page): Promise<{ idx: number; x: number; y: number }> {
    const node = (await view(page)).drawn.find((d) => d.kind === 'area');
    if (!node) throw new Error('no area drawn');
    const box = await page.locator('#stage').boundingBox();
    if (!box) throw new Error('no stage');
    return { idx: node.idx, x: box.x + node.x, y: box.y + node.y };
}

describe('the area limit is independent of 2D / 3D', () => {
    it('the fixture has more areas than the top-15 limit', () => {
        expect(areaCount).toBeGreaterThan(15);
    });

    it('by default both views show every area', async () => {
        const page = await open();
        const flat = await shown(page);
        await page.click('#dim');
        const orb = await shown(page);
        expect(flat).toHaveLength(areaCount);
        expect(orb).toEqual(flat);
        await page.close();
    });

    it('"Top 15" limits both views to the same fifteen areas', async () => {
        const page = await open();
        await page.click('#lim-top');
        const flat = await shown(page);
        await page.click('#dim');
        const orb = await shown(page);
        expect(flat).toHaveLength(15);
        expect(orb).toEqual(flat);
        await page.click('#lim-all');
        expect(await shown(page)).toHaveLength(areaCount);
        await page.close();
    });
});

describe('click marks, double click opens', () => {
    it('one click on an area marks it and stays in the overview', async () => {
        const page = await open();
        const a = await firstArea(page);
        await page.mouse.click(a.x, a.y);
        const v = await view(page);
        expect(v.level).toBe('overview');
        expect(v.area).toBe(a.idx);
        await page.close();
    });

    it('a double click on an area opens it', async () => {
        const page = await open();
        const a = await firstArea(page);
        await page.mouse.dblclick(a.x, a.y);
        const v = await view(page);
        expect(v.level).toBe('area');
        expect(v.area).toBe(a.idx);
        await page.close();
    });
});

describe('the map uses the height it is given', () => {
    it('on a wide window the stage reaches the foot of the centre column', async () => {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
        await page.goto(pathToFileURL(html).href);
        await page.waitForFunction(() => (window as unknown as { __mapView?: unknown }).__mapView !== undefined);
        const m = await page.evaluate(() => ({
            stage: (document.querySelector('.stage') as HTMLElement).getBoundingClientRect().height,
            page: document.documentElement.scrollHeight,
            vh: window.innerHeight,
        }));
        expect(m.stage).toBeGreaterThan(700);
        expect(m.page).toBeLessThanOrEqual(m.vh + 1);
        await page.close();
    });
});

describe('every lens has a way back to where it started', () => {
    it('the treemap: a folder drill is undone by "back", and the lens crumb returns to the root', async () => {
        const page = await open();
        await page.click('#lenses button:has-text("Treemap")');
        await page.locator('#lensview .treemap button').first().click();
        expect((await view(page)).treePath).not.toBe('');
        await page.click('#nav-back');
        expect((await view(page)).treePath).toBe('');
        await page.locator('#lensview .treemap button').first().click();
        await page.click('#crumbs button.lens-home');
        expect((await view(page)).treePath).toBe('');
        await page.close();
    });

    it('a double click that opens an area is undone by "back"', async () => {
        const page = await open();
        const a = await firstArea(page);
        await page.mouse.dblclick(a.x, a.y);
        expect((await view(page)).level).toBe('area');
        await page.click('#nav-back');
        expect((await view(page)).level).toBe('overview');
        await page.close();
    });

    it('"back" is absent while there is nothing to go back to', async () => {
        const page = await open();
        expect(await page.locator('#nav-back').count()).toBe(0);
        await page.close();
    });
});


describe('the brand mark', () => {
    it('is the AC icon, embedded so the page loads nothing but itself', async () => {
        const text = fs.readFileSync(html, 'utf-8');
        expect(text).toMatch(/<img class="logo" src="data:image\/png;base64,[A-Za-z0-9+/=]{1000,}" width="40" height="40" alt="AC">/);
        // The policy opens inline images and nothing on the network.
        expect(text).toMatch(/img-src data:;/);
        expect(text).toMatch(/default-src 'none'/);
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const external: string[] = [];
        page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) external.push(r.url()); });
        await page.goto(pathToFileURL(html).href);
        const loaded = await page.evaluate(async () => {
            const img = document.querySelector('.brand .logo') as HTMLImageElement;
            await img.decode().catch(() => undefined);
            return img.naturalWidth;
        });
        expect(loaded).toBe(96);
        expect(external).toEqual([]);
        await page.close();
    });
});
