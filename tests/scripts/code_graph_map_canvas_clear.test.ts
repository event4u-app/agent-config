import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';

// Every redraw wipes the whole canvas bitmap. With a fractional device-pixel ratio
// and a stage whose height is not a whole pixel, the bitmap is rounded up, so a
// clear in CSS pixels leaves the last row and column of the previous frame behind.

let browser: Browser;
let root: string;
let html: string;

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-clear-')));
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b', 'c', 'd']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const ${n} = a;\n`);
    html = path.join((await buildMap(root)).outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

async function open(): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1401, height: 1000 }, deviceScaleFactor: 1.5 });
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => (window as unknown as { __mapView?: unknown }).__mapView !== undefined);
    return page;
}

// Marking a file drills into its area, where the area-limit select disappears and
// the stage shrinks by a few pixels — no window resize fires.
async function drillIn(page: Page): Promise<void> {
    await page.fill('#search', 'a.ts');
    await page.locator('#results button', { hasText: /^a\.ts$/ }).click();
    await page.waitForFunction(() => (window as unknown as { __mapView: { level: string } }).__mapView.level === 'area');
    await page.waitForTimeout(200);
}

// Paints an opaque frame over the full bitmap, redraws through `act`, and returns
// how many pixels of the last bitmap row and column are still painted.
async function leftoverAfter(page: Page, act: () => Promise<void>): Promise<number> {
    await page.evaluate(() => {
        const c = document.querySelector('.stage canvas') as HTMLCanvasElement;
        const ctx = c.getContext('2d')!;
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
    });
    await act();
    return page.evaluate(() => {
        const c = document.querySelector('.stage canvas') as HTMLCanvasElement;
        const ctx = c.getContext('2d')!;
        const row = ctx.getImageData(0, c.height - 1, c.width, 1).data;
        const col = ctx.getImageData(c.width - 1, 0, 1, c.height).data;
        let n = 0;
        for (let i = 3; i < row.length; i += 4) if (row[i] !== 0) n++;
        for (let i = 3; i < col.length; i += 4) if (col[i] !== 0) n++;
        return n;
    });
}

describe('the graph canvas leaves no trace of the previous frame', () => {
    it('after the stage shrinks, a redraw clears the whole bitmap', async () => {
        const page = await open();
        await drillIn(page);
        // Zoomed out the nodes sit in the middle, so the bitmap edges must be empty.
        expect(await leftoverAfter(page, async () => { for (let i = 0; i < 4; i++) await page.click('#z-out'); })).toBe(0);
        await page.close();
    });

    it('the bitmap follows the stage size without a window resize', async () => {
        const page = await open();
        const before = await page.evaluate(() => document.querySelector('.stage canvas')!.getBoundingClientRect().height);
        await drillIn(page);
        const m = await page.evaluate(() => {
            const c = document.querySelector('.stage canvas') as HTMLCanvasElement;
            return { css: c.getBoundingClientRect().height, bitmap: c.height, dpr: window.devicePixelRatio };
        });
        expect(m.css).not.toBe(before);
        expect(m.bitmap).toBe(Math.round(m.css * m.dpr));
        await page.close();
    });
});
