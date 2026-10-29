/**
 * The Data ERD under load: the demo's 111-table schema. In 2D every badge of the
 * focused lines is on the stage and clickable, on open and after each pick; in 3D
 * the cards facing the viewer do not overlap, the picked table is readable and its
 * lines' badges are on the stage.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildDemoMap } from '../../src/scripts/code_graph/map_demo.js';
import type { DataPayload, MapAreas } from '../../src/scripts/code_graph/map_areas.js';

let tmp: string;
let html: string;
let data: DataPayload;
let browser: Browser;

beforeAll(async () => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-erd-load-')));
    const res = await buildDemoMap(tmp, { outDir: path.join(tmp, 'demo') });
    html = res.page;
    data = (JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { areas: MapAreas }).areas.data!;
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 300_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
});

async function open(hash: string, width: number, height = 1000): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapErd?: unknown }).__mapErd !== undefined);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page;
}

/**
 * Badges and how a click reaches them: shown (`n` of `total`), centred on the stage, wholly inside it, the
 * topmost element at their centre (clickable), or centred under the stage's own controls (covered).
 */
async function badgeReach(page: Page): Promise<{ n: number; total: number; inside: number; clickable: number; centred: number; covered: number }> {
    return page.evaluate(() => {
        const st = document.getElementById('db-stage')!.getBoundingClientRect();
        const all = [...document.querySelectorAll('#db-stage button.db-badge')] as HTMLElement[];
        // In 3D a connector too short to hold a badge carries none.
        const bs = all.filter((b) => !b.hidden);
        let inside = 0;
        let clickable = 0;
        let centred = 0;
        let covered = 0;
        for (const b of bs) {
            const r = b.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const on = cx > st.left && cx < st.right && cy > st.top && cy < st.bottom;
            if (on) centred += 1;
            if (on && document.elementFromPoint(cx, cy)?.closest('.db-overlay, .db-zl, #db-pop')) covered += 1;
            if (r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom) inside += 1;
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (hit && (hit === b || b.contains(hit))) clickable += 1;
        }
        return { n: bs.length, total: all.length, inside, clickable, centred, covered };
    });
}

describe('2D on the demo schema', () => {
    it('every badge of the focused lines is shown, and each one centred on the stage is clickable unless the stage controls cover it, on open and after picking tables with links', async () => {
        expect(data.tables.length).toBeGreaterThan(100);
        for (const width of [1440, 375]) {
            const page = await open('#/data', width);
            // A badge stays at the middle of its line (owner, 2026-10-26); a long line's middle can lie off the
            // stage, so the badges counted are the ones whose middle is on it.
            const first = await badgeReach(page);
            // On a phone the single column makes the focused lines long, and their middles can all lie off the stage.
            expect(width < 721 ? first.total : first.centred, `open ${width}`).toBeGreaterThan(0);
            expect(first.n, `open ${width}`).toBe(first.total);
            expect(first.clickable + first.covered, `open ${width}`).toBe(first.centred);
            // The picked table alone is framed, and one of its badges is in the free part of the stage, not at an
            // edge a few pixels of header height push it past, nor under the stage controls.
            if (width > 720) expect(first.clickable, `open ${width} clickable`).toBeGreaterThan(0);
            const picks = data.tables.filter((t) => t.columns.some((c) => (c.links ?? []).length)).slice(0, 4).map((t) => t.name);
            for (const name of picks) {
                await page.evaluate((n) => { location.hash = `#/data/table%2F${encodeURIComponent(n)}`; }, name);
                await page.waitForFunction((n) => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === `table/${n}`, name);
                await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
                // On a phone the pick opens the detail flyout over the stage; close it to reach the stage again.
                if (width < 721) await page.keyboard.press('Escape');
                const r = await badgeReach(page);
                expect(r.n, `${name} ${width}`).toBe(r.total);
                expect(r.clickable + r.covered, `${name} ${width}`).toBe(r.centred);
            }
            await page.close();
        }
    }, 120_000);

    it('the 2D / 3D switch sits on the stage, and the legend under it lists the icons', async () => {
        const page = await open('#/data', 1440);
        expect(await page.locator('#db-stage .db-overlay .dimseg button').allTextContents()).toEqual(['2D', '3D']);
        expect(await page.locator('.db-legend .db-leg').count()).toBe(7);
        await page.close();
    });
});

describe('3D on the demo schema', () => {
    it('front-facing cards do not overlap, the picked table is readable, its lines carry visible badges — at 1440 and 375', async () => {
        for (const width of [1440, 375]) {
            const page = await open('#/data', width);
            await page.click('#db-stage .db-overlay .dimseg button[data-dim="3d"]');
            await page.waitForFunction(() => (window as unknown as { __mapErd3d?: unknown }).__mapErd3d !== undefined);
            const boxes = await page.locator('.db-3card:not([hidden])').evaluateAll((cs) => cs.map((c) => { const r = c.getBoundingClientRect(); return { n: c.getAttribute('data-table')!, l: r.left, t: r.top, r: r.right, b: r.bottom, front: c.classList.contains('front') }; }));
            expect(boxes.length, `${width}`).toBeGreaterThan(width < 721 ? 2 : 5);
            expect(boxes.length, `${width}`).toBeLessThanOrEqual(24);
            const margin = 4;
            for (let i = 0; i < boxes.length; i++) {
                for (let j = i + 1; j < boxes.length; j++) {
                    const a = boxes[i]!;
                    const b = boxes[j]!;
                    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
                    const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
                    expect(ox <= margin || oy <= margin, `${width}: ${a.n} over ${b.n} by ${ox.toFixed(0)}×${oy.toFixed(0)}`).toBe(true);
                }
            }
            const front = boxes.find((b) => b.front)!;
            expect(front.r - front.l, `${width}`).toBeGreaterThanOrEqual(170);
            expect(await page.locator('.db-3card.front .db-col').count()).toBe(data.tables.find((t) => t.name === front.n)!.columns.length);
            const r = await badgeReach(page);
            expect(r.n, `${width}`).toBeGreaterThan(0);
            expect(r.inside, `${width}`).toBe(r.n);
            await page.close();
        }
    }, 120_000);
});
