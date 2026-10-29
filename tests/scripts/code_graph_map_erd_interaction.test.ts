/**
 * The Data ERD under real input (DEC-19 as corrected): the wheel zooms and a drag
 * pans without a modifier; only moving a table needs Ctrl / ⌘. Every line icon
 * sits on its own drawn line after a page scroll, a pan, a zoom and a table drag.
 * In 3D a plain drag turns the schema freely, the wheel zooms, and a click on a
 * chip or a dot picks exactly that table. Run on the demo's 111-table schema and
 * on the small P1 fixture.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { buildDemoMap } from '../../src/scripts/code_graph/map_demo.js';

let tmp: string;
const pages: Record<'demo' | 'p1', string> = { demo: '', p1: '' };
let browser: Browser;

beforeAll(async () => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-erd-input-')));
    pages.demo = (await buildDemoMap(tmp, { outDir: path.join(tmp, 'demo') })).page;
    const p1 = path.join(tmp, 'p1');
    fs.cpSync(path.resolve(__dirname, '../fixtures/code-graph/correctness/p1-blog'), p1, { recursive: true });
    fs.mkdirSync(path.join(p1, 'agents'), { recursive: true });
    const git = (...args: string[]): string => execFileSync('git', ['-C', p1, '-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf-8' });
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'base');
    pages.p1 = path.join((await buildMap(p1)).outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 300_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
});

async function open(which: 'demo' | 'p1', width = 1440, height = 900): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(pages[which]).href + '#/data');
    await page.waitForFunction(() => (window as unknown as { __mapErd?: unknown }).__mapErd !== undefined);
    await settle(page);
    return page;
}
const settle = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const zoomOf = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __mapErd: { z: number } }).__mapErd.z);
const worldTransform = (page: Page): Promise<string> => page.evaluate(() => (document.querySelector('#db-stage .db-world') as HTMLElement).style.transform);
const cardPos = (page: Page, name: string): Promise<string> =>
    page.evaluate((n) => { const c = document.querySelector(`#db-stage .db-table[data-table="${n}"]`) as HTMLElement; return `${c.style.left},${c.style.top}`; }, name);

/** A point on the stage where only the background is under the pointer — no card, control, badge or popup. */
async function backgroundPoint(page: Page): Promise<{ x: number; y: number }> {
    const pt = await page.evaluate(() => {
        const st = document.getElementById('db-stage')!.getBoundingClientRect();
        for (let y = st.top + 70; y < st.bottom - 40; y += 23) {
            for (let x = st.left + 30; x < st.right - 30; x += 29) {
                const hit = document.elementFromPoint(x, y);
                if (hit && hit.closest('#db-stage') && !hit.closest('.db-table, .db-overlay, .db-badge, #db-pop, .db-zl, .db-3dot')) return { x, y };
            }
        }
        return null;
    });
    expect(pt, 'an empty spot on the stage').not.toBeNull();
    return pt!;
}

/**
 * Every icon whose centre is on the stage that is NOT at the middle of the line it
 * annotates — the drawn line or path whose title the icon's label names, measured
 * by arc length on the geometry the browser draws, within 2 px. The one allowed
 * exception is the one step a later icon takes along its own line when another
 * icon already sits at its middle: then it must lie on its line, at most one step
 * (26 layer units) from the middle, with another icon at that middle.
 */
async function iconsOffMidpoint(page: Page): Promise<{ n: number; off: string[] }> {
    return page.evaluate(() => {
        const stage = document.getElementById('db-stage')!;
        const st = stage.getBoundingClientRect();
        const z = stage.classList.contains('db-3d') ? 1 : (window as unknown as { __mapErd: { z: number } }).__mapErd.z;
        const lines = new Map<string, Array<{ segs: Array<[number[], number[]]>; mid: number[] }>>();
        for (const g of document.querySelectorAll('#db-stage svg line, #db-stage svg path')) {
            const title = g.querySelector('title')?.textContent;
            if (!title) continue;
            const m = (g as SVGGraphicsElement).getScreenCTM()!;
            const pt = (x: number, y: number): number[] => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
            const pts: number[][] = [];
            if (g.tagName === 'line') {
                pts.push(pt(+g.getAttribute('x1')!, +g.getAttribute('y1')!), pt(+g.getAttribute('x2')!, +g.getAttribute('y2')!));
            } else {
                const p = g as SVGPathElement;
                const len = p.getTotalLength();
                for (let i = 0; i <= 200; i++) { const q = p.getPointAtLength((len * i) / 200); pts.push(pt(q.x, q.y)); }
            }
            const cum = [0];
            for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0]! - pts[i - 1]![0]!, pts[i]![1]! - pts[i - 1]![1]!));
            const half = cum[cum.length - 1]! / 2;
            let k = 1;
            while (k < pts.length - 1 && cum[k]! < half) k++;
            const u = (half - cum[k - 1]!) / ((cum[k]! - cum[k - 1]!) || 1);
            const mid = [pts[k - 1]![0]! + (pts[k]![0]! - pts[k - 1]![0]!) * u, pts[k - 1]![1]! + (pts[k]![1]! - pts[k - 1]![1]!) * u];
            const segs: Array<[number[], number[]]> = [];
            for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1]!, pts[i]!]);
            const list = lines.get(title) ?? [];
            list.push({ segs, mid });
            lines.set(title, list);
        }
        const dist = (c: number[], a: number[], b: number[]): number => {
            const dx = b[0]! - a[0]!;
            const dy = b[1]! - a[1]!;
            const t = Math.max(0, Math.min(1, ((c[0]! - a[0]!) * dx + (c[1]! - a[1]!) * dy) / (dx * dx + dy * dy || 1)));
            return Math.hypot(c[0]! - a[0]! - t * dx, c[1]! - a[1]! - t * dy);
        };
        const centres = [...document.querySelectorAll('#db-stage button.db-badge')].map((b) => {
            const r = b.getBoundingClientRect();
            return { b, c: [r.left + r.width / 2, r.top + r.height / 2] };
        });
        const off: string[] = [];
        let n = 0;
        for (const { b, c } of centres) {
            if ((b as HTMLElement).hidden || c[0]! <= st.left || c[0]! >= st.right || c[1]! <= st.top || c[1]! >= st.bottom) continue;
            n += 1;
            const label = b.getAttribute('aria-label') ?? '';
            let ok = false;
            let best = Infinity;
            for (const [title, list] of lines) {
                if (!label.includes(title)) continue;
                for (const l of list) {
                    const dMid = Math.hypot(c[0]! - l.mid[0]!, c[1]! - l.mid[1]!);
                    best = Math.min(best, dMid);
                    if (dMid <= 2) ok = true;
                    const onLine = Math.min(...l.segs.map((s2) => dist(c, s2[0], s2[1])));
                    const other = centres.some((o) => o.b !== b && Math.hypot(o.c[0]! - l.mid[0]!, o.c[1]! - l.mid[1]!) < 24 * z + 4);
                    if (onLine <= 2 && dMid <= 26 * z + 3 && other) ok = true;
                }
            }
            if (!ok) off.push(`${label} ${Math.round(best)}px from the middle`);
        }
        return { n, off };
    });
}

/** Where each icon sits in its own layer (left / top), which pan, zoom, scroll and resize must not change. */
const iconPlaces = (page: Page): Promise<string[]> =>
    page.evaluate(() => [...document.querySelectorAll('#db-stage button.db-badge')].map((b) => `${b.getAttribute('aria-label')} @ ${(b as HTMLElement).style.left},${(b as HTMLElement).style.top}`));

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }, mod?: 'Control' | 'Meta'): Promise<void> {
    if (mod) await page.keyboard.down(mod);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 });
    await page.mouse.up();
    if (mod) await page.keyboard.up(mod);
    await settle(page);
}

describe('2D: zoom and pan need no modifier, only moving a table does', () => {
    for (const which of ['demo', 'p1'] as const) {
        it(`${which}: a plain wheel over the stage zooms and leaves the page where it is; a wheel beside the stage scrolls the page`, async () => {
            const page = await open(which, 1440, 640);
            const scroll = (): Promise<number> => page.evaluate(() => document.getElementById('av-main')!.scrollTop + window.scrollY);
            const box = (await page.locator('#db-stage').boundingBox())!;
            const z0 = await zoomOf(page);
            const s0 = await scroll();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.wheel(0, -240);
            await settle(page);
            const zIn = await zoomOf(page);
            expect(zIn).toBeGreaterThan(z0);
            expect(await scroll()).toBe(s0);
            await page.mouse.wheel(0, 480);
            await settle(page);
            expect(await zoomOf(page)).toBeLessThan(zIn);
            expect(await scroll()).toBe(s0);
            // Beside the stage the wheel is the page's again.
            await page.mouse.move(box.x + box.width / 2, Math.max(4, box.y - 60));
            await page.mouse.wheel(0, 300);
            await page.waitForTimeout(150);
            expect(await scroll()).toBeGreaterThan(s0);
            await page.close();
        });

        it(`${which}: a plain drag pans the view from the background and from a table, the table stays; with Ctrl or ⌘ the drag moves the table; a click still picks`, async () => {
            const page = await open(which);
            const bg = await backgroundPoint(page);
            const t0 = await worldTransform(page);
            await drag(page, bg, { x: 120, y: 70 });
            const t1 = await worldTransform(page);
            expect(t1).not.toBe(t0);
            const name = await page.evaluate(() => (window as unknown as { __mapErd: { focus: string } }).__mapErd.focus);
            const head = page.locator(`#db-stage .db-table[data-table="${name}"] .db-thead`);
            const at = await cardPos(page, name);
            let hb = (await head.boundingBox())!;
            await drag(page, { x: hb.x + 30, y: hb.y + hb.height / 2 }, { x: -90, y: 60 });
            expect(await cardPos(page, name)).toBe(at);
            expect(await worldTransform(page)).not.toBe(t1);
            for (const mod of ['Control', 'Meta'] as const) {
                const before = await cardPos(page, name);
                const t2 = await worldTransform(page);
                hb = (await head.boundingBox())!;
                await drag(page, { x: hb.x + 30, y: hb.y + hb.height / 2 }, { x: 70, y: 40 }, mod);
                expect(await cardPos(page, name), mod).not.toBe(before);
                expect(await worldTransform(page), mod).toBe(t2);
            }
            // A click without a drag still picks a table: one whose head is on the stage and in front.
            const other = await page.evaluate((n) => {
                const st = document.getElementById('db-stage')!.getBoundingClientRect();
                for (const c of document.querySelectorAll('#db-stage .db-table:not(.ghost)')) {
                    const t = c.getAttribute('data-table')!;
                    const r = c.querySelector('.db-thead')!.getBoundingClientRect();
                    const x = r.left + 20;
                    const y = r.top + r.height / 2;
                    if (t === n || x < st.left + 10 || x > st.right - 10 || y < st.top + 60 || y > st.bottom - 10) continue;
                    if (document.elementFromPoint(x, y)?.closest('.db-table')?.getAttribute('data-table') === t) return { t, x, y };
                }
                return null;
            }, name);
            expect(other, 'a table to click').not.toBeNull();
            await page.mouse.click(other!.x, other!.y);
            await page.waitForFunction((n) => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === `table/${n}`, other!.t);
            expect(await page.locator('.db-help').first().textContent()).toMatch(/drag .*pan|move a table/i);
            await page.close();
        });
    }

    it('demo: every visible line icon sits at the middle of its own line and keeps its place in the layer through a page scroll, a pan, a zoom and a resize; a table drag moves it to the new middle', async () => {
        const page = await open('demo', 1440, 640);
        // The demo's focused lines are long; a pan brings the middle of the first one to the stage's centre.
        const icon = (await page.locator('#db-stage button.db-badge').first().boundingBox())!;
        const sbox = (await page.locator('#db-stage').boundingBox())!;
        const from = await backgroundPoint(page);
        await drag(page, from, { x: sbox.x + sbox.width / 2 - (icon.x + icon.width / 2), y: sbox.y + sbox.height / 2 - (icon.y + icon.height / 2) });
        const check = async (step: string): Promise<void> => {
            const r = await iconsOffMidpoint(page);
            expect(r.n, `${step}: icons on the stage`).toBeGreaterThan(0);
            expect(r.off, step).toEqual([]);
        };
        await check('open');
        const placed = await iconPlaces(page);
        const kept = async (step: string): Promise<void> => expect(await iconPlaces(page), `${step}: places in the layer`).toEqual(placed);
        await page.evaluate(() => { document.getElementById('av-main')!.scrollTop += 180; window.scrollBy(0, 120); });
        await settle(page);
        await check('page scroll');
        await kept('page scroll');
        const box = (await page.locator('#db-stage').boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, Math.max(4, box.y - 40));
        await page.mouse.wheel(0, 200);
        await settle(page);
        await check('wheel beside the stage');
        await drag(page, await backgroundPoint(page), { x: 80, y: -50 });
        await check('pan');
        await kept('pan');
        // Zoom about an icon, so the point under the pointer — the icon — stays on the stage.
        const ib = (await page.locator('#db-stage button.db-badge').first().boundingBox())!;
        await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
        await page.mouse.wheel(0, -300);
        await settle(page);
        await check('zoom in');
        await kept('zoom in');
        await page.mouse.wheel(0, 900);
        await settle(page);
        await check('zoom out');
        await kept('zoom out');
        await page.setViewportSize({ width: 1100, height: 700 });
        await settle(page);
        await kept('resize');
        // A table on the stage that one of the icons' lines joins, moved by its head.
        const head = await page.evaluate(() => {
            const st = document.getElementById('db-stage')!.getBoundingClientRect();
            const labels = [...document.querySelectorAll('#db-stage button.db-badge')].map((b) => b.getAttribute('aria-label') ?? '');
            for (const c of document.querySelectorAll('#db-stage .db-table')) {
                const name = c.getAttribute('data-table')!;
                if (!labels.some((l) => l.includes(`${name}.`))) continue;
                const r = c.querySelector('.db-thead')!.getBoundingClientRect();
                const x = r.left + 20;
                const y = r.top + r.height / 2;
                if (x > st.left + 10 && x < st.right - 160 && y > st.top + 60 && y < st.bottom - 100 && document.elementFromPoint(x, y)?.closest('.db-table') === c) return { x, y };
            }
            return null;
        });
        expect(head, 'a joined table on the stage').not.toBeNull();
        await drag(page, head!, { x: 140, y: 90 }, 'Meta');
        await check('table drag');
        expect(await iconPlaces(page), 'a moved table moves its icons').not.toEqual(placed);
        await page.click('.db-seg[aria-label="Lines"] button[data-v="all"]');
        await settle(page);
        await check('all lines');
        const all = await iconPlaces(page);
        await drag(page, await backgroundPoint(page), { x: -300, y: 200 });
        await check('all lines, pan');
        expect(await iconPlaces(page), 'all lines, pan: places in the layer').toEqual(all);
        await page.close();
    });
});

/**
 * Visible icons whose box overlaps (by more than 1 px) one of the two cards its own line joins — 2D cards, 3D
 * cards and chips. The line's ends lie on those cards' borders; a long line may cross a third card, and its
 * middle may then lie on it, which is the owner's choice (the icon stays at the middle of its line).
 */
async function iconsOnTheirCards(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const st = document.getElementById('db-stage')!.getBoundingClientRect();
        const cards = [...document.querySelectorAll('#db-stage .db-table')]
            .filter((c) => !(c as HTMLElement).hidden && (c as HTMLElement).offsetWidth > 0)
            .map((c) => ({ name: c.getAttribute('data-table')!, r: c.getBoundingClientRect() }));
        const ends = new Map<string, number[][]>();
        for (const g of document.querySelectorAll('#db-stage svg line, #db-stage svg path')) {
            const title = g.querySelector('title')?.textContent;
            if (!title) continue;
            const m = (g as SVGGraphicsElement).getScreenCTM()!;
            const pt = (x: number, y: number): number[] => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
            const list = ends.get(title) ?? [];
            if (g.tagName === 'line') list.push(pt(+g.getAttribute('x1')!, +g.getAttribute('y1')!), pt(+g.getAttribute('x2')!, +g.getAttribute('y2')!));
            else {
                const p = g as SVGPathElement;
                const a = p.getPointAtLength(0);
                const b = p.getPointAtLength(p.getTotalLength());
                list.push(pt(a.x, a.y), pt(b.x, b.y));
            }
            ends.set(title, list);
        }
        const out: string[] = [];
        for (const b of document.querySelectorAll('#db-stage button.db-badge')) {
            if ((b as HTMLElement).hidden) continue;
            const r = b.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (cx <= st.left || cx >= st.right || cy <= st.top || cy >= st.bottom) continue;
            const label = b.getAttribute('aria-label') ?? '';
            const own: number[][] = [];
            for (const [title, list] of ends) if (label.includes(title)) own.push(...list);
            for (const c of cards) {
                const joins = own.some((q) => q[0]! >= c.r.left - 3 && q[0]! <= c.r.right + 3 && q[1]! >= c.r.top - 3 && q[1]! <= c.r.bottom + 3);
                if (!joins) continue;
                const w = Math.min(r.right, c.r.right) - Math.max(r.left, c.r.left);
                const h = Math.min(r.bottom, c.r.bottom) - Math.max(r.top, c.r.top);
                if (w > 1 && h > 1) out.push(`${label} on ${c.name}`);
            }
        }
        return out;
    });
}

describe('no icon covers a table its line joins', () => {
    it('demo, 1440 and 375: no visible icon lies on either card its line joins — 2D after a pan, a zoom and a table drag, 3D after turning', async () => {
        for (const width of [1440, 375]) {
            const page = await open('demo', width, 900);
            const check = async (step: string): Promise<void> => expect(await iconsOnTheirCards(page), `${width} ${step}`).toEqual([]);
            await check('2D open');
            await drag(page, await backgroundPoint(page), { x: width > 500 ? 220 : 60, y: -120 });
            await check('2D pan');
            const sb = (await page.locator('#db-stage').boundingBox())!;
            await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
            await page.mouse.wheel(0, -300);
            await settle(page);
            await check('2D zoom in');
            await page.mouse.wheel(0, 700);
            await settle(page);
            await check('2D zoom out');
            const name = await page.evaluate(() => (window as unknown as { __mapErd: { focus: string } }).__mapErd.focus);
            const hb = await page.locator(`#db-stage .db-table[data-table="${name}"] .db-thead`).boundingBox();
            if (hb) {
                await drag(page, { x: hb.x + 20, y: hb.y + hb.height / 2 }, { x: 60, y: 50 }, 'Control');
                await check('2D table drag');
            }
            await page.click('#db-stage .dimseg button[data-dim="3d"]');
            await page.waitForFunction(() => (window as unknown as { __mapErd3d?: unknown }).__mapErd3d !== undefined);
            await settle(page);
            await check('3D open');
            const box = (await page.locator('#db-stage').boundingBox())!;
            for (const by of [{ x: 120, y: -40 }, { x: -60, y: 160 }, { x: 200, y: 90 }]) {
                await drag(page, { x: box.x + box.width / 2, y: box.y + box.height - 30 }, by);
                await check(`3D turned ${by.x},${by.y}`);
            }
            await page.close();
        }
    });
});

describe('3D: a plain drag turns, the wheel zooms, a click picks', () => {
    interface Erd3d { front: string; z: number; proj: Record<string, { x: number; y: number }> }
    const erd3 = (page: Page): Promise<Erd3d> => page.evaluate(() => (window as unknown as { __mapErd3d: Erd3d }).__mapErd3d);
    async function open3d(which: 'demo' | 'p1', width = 1440): Promise<Page> {
        const page = await open(which, width, 900);
        await page.click('#db-stage .dimseg button[data-dim="3d"]');
        await page.waitForFunction(() => (window as unknown as { __mapErd3d?: unknown }).__mapErd3d !== undefined);
        await settle(page);
        return page;
    }
    const spread = (a: Erd3d, b: Erd3d): number => Object.keys(a.proj).reduce((m, n) => Math.max(m, b.proj[n] ? Math.hypot(a.proj[n]!.x - b.proj[n]!.x, a.proj[n]!.y - b.proj[n]!.y) : 0), 0);

    for (const which of ['demo', 'p1'] as const) {
        it(`${which}: a plain drag turns the schema without end, over the poles too; the wheel zooms; the arrow keys turn it`, async () => {
            const page = await open3d(which);
            const box = (await page.locator('#db-stage').boundingBox())!;
            const start = { x: box.x + 40, y: box.y + box.height - 50 };
            const a = await erd3(page);
            await drag(page, start, { x: 160, y: 0 });
            const b = await erd3(page);
            expect(spread(a, b), 'sideways').toBeGreaterThan(5);
            // Over the top and on: a clamped pitch would stop turning after the first stretch.
            await drag(page, { x: box.x + 40, y: box.y + 70 }, { x: 0, y: 300 });
            const c = await erd3(page);
            expect(spread(b, c), 'down').toBeGreaterThan(5);
            await drag(page, { x: box.x + 40, y: box.y + 70 }, { x: 0, y: 300 });
            const d = await erd3(page);
            expect(spread(c, d), 'down again').toBeGreaterThan(5);
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.wheel(0, -240);
            await settle(page);
            expect((await erd3(page)).z).toBeGreaterThan(d.z);
            await page.locator('#db-stage').focus();
            const e = await erd3(page);
            await page.keyboard.press('ArrowUp');
            await page.keyboard.press('ArrowUp');
            await settle(page);
            expect(spread(e, await erd3(page)), 'arrows').toBeGreaterThan(2);
            const r = await iconsOffMidpoint(page);
            expect(r.off, 'icons after turning').toEqual([]);
            await page.close();
        });
    }

    it('demo, 1440 and 375: a click on a chip or a dot picks exactly that table and brings it to the front', async () => {
        for (const width of [1440, 375]) {
            const page = await open3d('demo', width);
            const box = (await page.locator('#db-stage').boundingBox())!;
            await drag(page, { x: box.x + 30, y: box.y + box.height - 40 }, { x: 90, y: -50 });
            // Every dot on the open stage is a target a hand can hit: 5 px beside its centre the pointer still finds a
            // dot (a nearer one in front of it wins), unless a card covers it.
            const missed = await page.evaluate(() => {
                const st = document.getElementById('db-stage')!.getBoundingClientRect();
                const out: string[] = [];
                for (const el of document.querySelectorAll('#db-stage .db-3dot')) {
                    const r = el.getBoundingClientRect();
                    const x = r.left + r.width / 2;
                    const y = r.top + r.height / 2;
                    if (x < st.left + 20 || x > st.right - 20 || y < st.top + 60 || y > st.bottom - 20) continue;
                    // At the handover's 1000 px breakpoint the page scrolls, not the main column: a dot below the fold is not under a hand.
                    if (y > window.innerHeight - 20) continue;
                    if (document.elementFromPoint(x, y)?.closest('.db-table, .db-overlay, .db-badge')) continue;
                    const hit = document.elementFromPoint(x + 5, y)?.closest('.db-3dot, .db-table, .db-badge');
                    if (!hit) out.push(el.getAttribute('data-table')!);
                }
                return out;
            });
            expect(missed, `${width}: dots a click 5 px off the centre misses`).toEqual([]);
            const picked: string[] = [];
            for (const kind of ['chip', 'dot', 'chip', 'dot', 'dot']) {
                // Where the pointer goes: the drawn centre of a chip, or a point 5 px beside a dot's centre (a dot is a target a hand can hit); the
                // element the browser finds there must be that table's — what is in front is what is clicked.
                const target = await page.evaluate(({ kind: k, done }) => {
                    const st = document.getElementById('db-stage')!.getBoundingClientRect();
                    const front = (window as unknown as { __mapErd3d: { front: string } }).__mapErd3d.front;
                    const sel = k === 'chip' ? '#db-stage .db-3card.chip:not([hidden])' : '#db-stage .db-3dot';
                    for (const el of document.querySelectorAll(sel)) {
                        const name = el.getAttribute('data-table')!;
                        if (name === front || done.includes(name)) continue;
                        const r = el.getBoundingClientRect();
                        const x = r.left + r.width / 2 + (k === 'dot' ? 5 : 0);
                        const y = r.top + r.height / 2;
                        if (x < st.left + 20 || x > st.right - 20 || y < st.top + 60 || y > st.bottom - 20) continue;
                        const hit = document.elementFromPoint(x, y);
                        const owner = hit?.closest('[data-table]');
                        if (owner && owner.getAttribute('data-table') === name) return { name, x, y };
                    }
                    return null;
                }, { kind, done: picked });
                expect(target, `${width}: a reachable ${kind}`).not.toBeNull();
                await page.mouse.click(target!.x, target!.y);
                await page.waitForFunction((n) => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === `table/${n}`, target!.name, { timeout: 3000 });
                await page.waitForFunction((n) => (window as unknown as { __mapErd3d: { front: string } }).__mapErd3d.front === n, target!.name);
                await settle(page);
                if (width < 721) await page.keyboard.press('Escape');
                picked.push(target!.name);
            }
            await page.close();
        }
    });
});

describe('2D: picking a table leaves zoom and position alone', () => {
    for (const which of ['demo', 'p1'] as const) {
        it(`${which}: a click on another table, or a pick from the list, changes neither the zoom nor the view`, async () => {
            const page = await open(which);
            const z0 = await zoomOf(page);
            const t0 = await worldTransform(page);
            const focus = await page.evaluate(() => (window as unknown as { __mapErd: { focus: string } }).__mapErd.focus);
            const other = await page.evaluate((f) => {
                const cards = [...document.querySelectorAll('#db-stage .db-table')] as HTMLElement[];
                const stage = (document.getElementById('db-stage') as HTMLElement).getBoundingClientRect();
                const seen = cards.find((c) => {
                    const b = c.querySelector('.db-thead')!.getBoundingClientRect();
                    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
                    return c.dataset['table'] !== f && b.left > stage.left && b.right < stage.right && b.top > stage.top && b.bottom < stage.bottom && !!hit && c.contains(hit);
                });
                return seen?.dataset['table'] ?? null;
            }, focus);
            expect(other).not.toBeNull();
            await page.locator(`#db-stage .db-table[data-table="${other}"] .db-thead`).click();
            await settle(page);
            await settle(page);
            expect(await page.evaluate(() => (window as unknown as { __mapErd: { focus: string } }).__mapErd.focus)).toBe(other);
            expect(await zoomOf(page)).toBe(z0);
            expect(await worldTransform(page)).toBe(t0);
            await page.evaluate((n) => { location.hash = '#/data/' + encodeURIComponent('table/' + n); }, focus);
            await settle(page);
            await settle(page);
            expect(await zoomOf(page)).toBe(z0);
            expect(await worldTransform(page)).toBe(t0);
            await page.close();
        });
    }
});
