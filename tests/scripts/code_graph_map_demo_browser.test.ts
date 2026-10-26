import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { labelProblems } from '../../src/scripts/code_graph/map_verify.js';
import { buildDemoMap, type DemoResult } from '../../src/scripts/code_graph/map_demo.js';

// The demo map in a browser: every area route is live — no area-level "no data
// yet" card — and the sample-data chip sits in the header; a real map has none.

const ROUTES = ['overview', 'code', 'data', 'interfaces', 'runtime', 'delivery', 'impact', 'agent'] as const;

let browser: Browser;
let demo: DemoResult;
let realPage: string;
let savedHome: string | undefined;
const dirs: string[] = [];

function tmp(prefix: string): string {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    dirs.push(d);
    return d;
}

async function open(html: string, hash: string, width = 1440): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'dark' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}

beforeAll(async () => {
    savedHome = process.env['EVENT4U_CONFIG_HOME'];
    process.env['EVENT4U_CONFIG_HOME'] = path.join(tmp('cg-demo-b-home-'), 'home');
    const root = tmp('cg-demo-b-');
    fs.mkdirSync(path.join(root, 'agents'));
    demo = await buildDemoMap(root);
    const real = tmp('cg-demo-b-real-');
    fs.mkdirSync(path.join(real, 'agents'));
    fs.writeFileSync(path.join(real, 'a.ts'), 'export const a = 1;\n');
    realPage = path.join((await buildMap(real)).outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 180_000);
afterAll(async () => {
    await browser?.close();
    if (savedHome === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = savedHome;
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('the demo map in a browser', () => {
    it('opens every area with data and the sample-data chip, at desktop and phone width', async () => {
        for (const width of [1440, 375]) {
            for (const r of ROUTES) {
                const { page, errors } = await open(demo.page, `#/${r}`, width);
                expect((await page.evaluate(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route)), r).toBe(r);
                expect(await page.locator('.empty-card').count(), `${r} @${width}`).toBe(0);
                expect(await page.locator('#areanav a.empty').count(), `${r} @${width}`).toBe(0);
                expect(await page.locator('#pin-demo').isVisible(), r).toBe(true);
                expect(await page.locator('#pin-demo').textContent()).toBe('Sample data · Fixture');
                expect(errors, r).toEqual([]);
                await page.close();
            }
        }
    }, 180_000);

    it('every Overview layer card with an area is live, Environment included', async () => {
        const { page } = await open(demo.page, '#/overview');
        expect(await page.locator('.ocard.empty, .ocard.none').count()).toBe(0);
        expect(await page.locator('#ov-env.live').count()).toBe(1);
        await page.close();
    }, 60_000);

    it('relabels the chip in German', async () => {
        const { page } = await open(demo.page, '#/data');
        await page.click('#lang');
        expect(await page.locator('#pin-demo').textContent()).toBe('Beispieldaten · Fixture');
        await page.close();
    }, 60_000);

    it('the hub demo shows its projects and the chip', async () => {
        const { page, errors } = await open(demo.hubPage, '#/projects');
        expect(await page.locator('.empty-card').count()).toBe(0);
        expect(await page.locator('#pin-demo').isVisible()).toBe(true);
        expect(await page.locator('body').innerText()).toContain('demo-shop');
        expect(errors).toEqual([]);
        await page.close();
    }, 60_000);

    it('the hub graph bundles the links of one pair, and no label overlaps another or leaves the canvas, at every width', async () => {
        for (const width of [1440, 1000, 375, 320]) {
            const { page } = await open(demo.hubPage, '#/projects', width);
            const r = await page.evaluate(() => (window as unknown as { __mapLabelBoxes: { boxes: Array<{ x: number; y: number; w: number; h: number }>; width: number; height: number } }).__mapLabelBoxes);
            expect(r.boxes.length, `@${width}`).toBeGreaterThan(3);
            expect(labelProblems(r.boxes, r.width, r.height), `@${width}`).toEqual({ outside: 0, overlapping: 0 });
            // Every label sits inside the visible graph: no sideways scroll hides one on a phone.
            const clipped = await page.evaluate(() => {
                const view = document.querySelector('.ops-gscroll') as HTMLElement;
                const v = view.getBoundingClientRect();
                return Array.prototype.filter.call(document.querySelectorAll('.ops-elabel, .ops-pnode'), (e: Element) => {
                    const b = e.getBoundingClientRect();
                    return b.left < v.left - 0.5 || b.right > v.right + 0.5;
                }).length;
            });
            expect(clipped, `@${width}`).toBe(0);
            await page.close();
        }
        const { page } = await open(demo.hubPage, '#/projects');
        type Fact = { uses: unknown[] };
        const hub = JSON.parse(fs.readFileSync(path.join(path.dirname(demo.hubPage), 'projects', 'hub.json'), 'utf-8')) as { edges: unknown[]; calls: Array<{ match?: unknown }>; ports: Fact[]; images: Fact[]; services: Fact[] };
        const links = hub.edges.length + hub.calls.filter((c) => c.match).length + [...hub.ports, ...hub.images, ...hub.services].reduce((n, f) => n + f.uses.length - 1, 0);
        // Bundled: fewer labels than links, drawn or listed below the drawing.
        expect(await page.locator('.ops-elabel').count()).toBeLessThan(links);
        expect(await page.locator('.ops-elabel', { hasText: '+' }).count()).toBeGreaterThan(0);
        await page.locator('.ops-elabel', { hasText: '+' }).first().click();
        const list = page.locator('#av-side .ops-bundle');
        await expect.poll(() => list.count()).toBeGreaterThan(1);
        await list.nth(1).click();
        await expect.poll(() => page.locator('#av-side .ops-bundle').nth(1).getAttribute('aria-pressed')).toBe('true');
        expect(await page.locator('#av-side .ops-bundle.on').count()).toBe(1);
        await page.close();
    }, 120_000);

    it('a large schema opens on the picked table and its links at a readable zoom; Fit still shows all', async () => {
        type Erd = { z: number; focus: string; lines: string; tables: string[] };
        const erd = (page: Page): Promise<Erd> => page.evaluate(() => (window as unknown as { __mapErd: Erd }).__mapErd);
        for (const width of [1440, 375]) {
            const { page, errors } = await open(demo.page, '#/data', width);
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
            const e = await erd(page);
            expect(e.tables.length, `@${width}`).toBeGreaterThan(100);
            expect(e.lines).toBe('focus');
            expect(await page.locator('.dimseg button[data-dim="2d"]').getAttribute('aria-pressed')).toBe('true');
            expect(e.z, `@${width}`).toBeGreaterThanOrEqual(0.9);
            const stage = (await page.locator('#db-stage').boundingBox())!;
            const card = (await page.locator(`.db-table[data-table="${e.focus}"]`).boundingBox())!;
            expect(card.x, `@${width}`).toBeGreaterThanOrEqual(stage.x - 0.5);
            expect(card.y, `@${width}`).toBeGreaterThanOrEqual(stage.y - 0.5);
            expect(Math.min(card.x + card.width, stage.x + stage.width) - card.x, `@${width} visible width`).toBeGreaterThan(Math.min(card.width, stage.width) * 0.95);
            expect(card.y + Math.min(card.height, 60), `@${width}`).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
            // Fit shows the whole schema: on a desktop stage that means zooming out; a phone stage fits its width.
            await page.click('.db-zoom button.fit');
            if (width === 1440) expect((await erd(page)).z, 'after Fit').toBeLessThan(e.z);
            expect(errors).toEqual([]);
            await page.close();
        }
    }, 120_000);

    it('a real map has no chip', async () => {
        const { page } = await open(realPage, '#/overview');
        expect(await page.locator('#pin-demo').count()).toBe(0);
        await page.close();
    }, 60_000);
});
