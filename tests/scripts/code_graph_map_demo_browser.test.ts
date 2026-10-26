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

const ROUTES = ['overview', 'code', 'data', 'systems', 'interfaces', 'runtime', 'delivery', 'impact', 'agent'] as const;

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

    it('the Runtime environment comparison stays readable on a phone: no word broken mid-letter, no chip overlapping', async () => {
        for (const width of [375, 1440]) {
            const { page, errors } = await open(demo.page, '#/runtime', width);
            const r = await page.evaluate(() => {
                const inside = (a: DOMRect, b: DOMRect): boolean => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
                const cells = Array.from(document.querySelectorAll('.ops-cmpgrid .ops-cell, .ops-cmpgrid .ops-cmpname, .ops-cmpgrid .ops-th'));
                let broken = 0;
                let spill = 0;
                const chips: DOMRect[] = [];
                for (const cell of cells) {
                    const cb = cell.getBoundingClientRect();
                    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
                    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                        const text = n.textContent ?? '';
                        // A dot or slash is a wrap point of its own (Terraform address, kind/name); a break anywhere else is letter-wrapping.
                        const re = /[^\s./]+[./]?/g;
                        for (let m = re.exec(text); m; m = re.exec(text)) {
                            const range = document.createRange();
                            range.setStart(n, m.index);
                            range.setEnd(n, m.index + m[0].length);
                            const lines = new Set(Array.from(range.getClientRects()).filter((q) => q.width > 0).map((q) => Math.round(q.top)));
                            if (lines.size > 1) broken += 1;
                        }
                    }
                    for (const chip of Array.from(cell.querySelectorAll('.st'))) {
                        const b = chip.getBoundingClientRect();
                        if (!inside(b, cb)) spill += 1;
                        chips.push(b);
                    }
                }
                let overlap = 0;
                for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
                    const a = chips[i]!;
                    const b = chips[j]!;
                    if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlap += 1;
                }
                const scroller = document.querySelector('.ops-cmp') as HTMLElement;
                return { cells: cells.length, broken, spill, overlap, pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, scroll: scroller.scrollWidth > scroller.clientWidth };
            });
            expect(r.cells, `@${width}`).toBeGreaterThan(50);
            expect({ broken: r.broken, spill: r.spill, overlap: r.overlap, pageScroll: r.pageScroll }, `@${width}`).toEqual({ broken: 0, spill: 0, overlap: 0, pageScroll: 0 });
            if (width === 375) {
                // The grid scrolls inside its box and the resource column stays put while it does.
                expect(r.scroll).toBe(true);
                const first = page.locator('.ops-cmpname .ops-b').first();
                const before = (await first.boundingBox())!.x;
                await page.locator('.ops-cmp').evaluate((e) => { e.scrollLeft = 200; });
                expect(Math.abs((await first.boundingBox())!.x - before)).toBeLessThan(1);
            }
            expect(errors).toEqual([]);
            await page.close();
        }
    }, 120_000);

    it('the Code detail names colliding file names apart by folder and keeps the full path as the title', async () => {
        for (const width of [1440, 375]) {
            const { page, errors } = await open(demo.page, '#/code', width);
            const groups = await page.evaluate(() =>
                Array.from(document.querySelectorAll('#panel .egroup')).map((g) => ({
                    cap: g.querySelector('.cap')?.textContent ?? '',
                    rows: Array.from(g.querySelectorAll('li button')).map((b) => ({ label: b.querySelector('.fname')?.textContent ?? '', title: b.getAttribute('title') ?? '' })),
                })),
            );
            const listed = groups.filter((g) => g.rows.length > 1);
            expect(listed.length, `@${width}`).toBeGreaterThan(0);
            for (const g of listed) {
                expect(new Set(g.rows.map((r) => r.label)).size, `${g.cap} @${width}: ${g.rows.map((r) => r.label).join(', ')}`).toBe(g.rows.length);
                for (const r of g.rows) {
                    expect(r.title.endsWith(r.label.split(' · ').pop() ?? ''), r.title).toBe(true);
                    const prefix = r.label.includes(' · ') ? r.label.split(' · ')[0]! : '';
                    if (prefix) expect(r.title.includes(`${prefix}/`), r.title).toBe(true);
                }
            }
            // The demo's two most used stores sit in different feature folders.
            const most = listed.find((g) => /Most used/.test(g.cap))!;
            expect(most.rows.filter((r) => r.label.endsWith('store.ts')).every((r) => r.label.includes(' · '))).toBe(true);
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
