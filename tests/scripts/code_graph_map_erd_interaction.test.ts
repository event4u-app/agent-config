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
 * Every icon whose centre is on the stage, with its distance in screen pixels to the
 * nearest point of the line it annotates — the drawn line or path whose title the
 * icon's label names, measured on the geometry the browser draws.
 */
async function iconsOffTheirLine(page: Page): Promise<{ n: number; off: string[] }> {
    return page.evaluate(() => {
        const st = document.getElementById('db-stage')!.getBoundingClientRect();
        const lines = new Map<string, Array<[number[], number[]]>>();
        for (const g of document.querySelectorAll('#db-stage svg line, #db-stage svg path')) {
            const title = g.querySelector('title')?.textContent;
            if (!title) continue;
            const m = (g as SVGGraphicsElement).getScreenCTM()!;
            const pt = (x: number, y: number): number[] => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
            const segs = lines.get(title) ?? [];
            lines.set(title, segs);
            if (g.tagName === 'line') {
                segs.push([pt(+g.getAttribute('x1')!, +g.getAttribute('y1')!), pt(+g.getAttribute('x2')!, +g.getAttribute('y2')!)]);
            } else {
                const p = g as SVGPathElement;
                const len = p.getTotalLength();
                let prev: number[] | null = null;
                for (let i = 0; i <= 120; i++) {
                    const q = p.getPointAtLength((len * i) / 120);
                    const s = pt(q.x, q.y);
                    if (prev) segs.push([prev, s]);
                    prev = s;
                }
            }
        }
        const dist = (c: number[], a: number[], b: number[]): number => {
            const dx = b[0]! - a[0]!;
            const dy = b[1]! - a[1]!;
            const t = Math.max(0, Math.min(1, ((c[0]! - a[0]!) * dx + (c[1]! - a[1]!) * dy) / (dx * dx + dy * dy || 1)));
            return Math.hypot(c[0]! - a[0]! - t * dx, c[1]! - a[1]! - t * dy);
        };
        const off: string[] = [];
        let n = 0;
        for (const b of document.querySelectorAll('#db-stage button.db-badge')) {
            const r = b.getBoundingClientRect();
            const c = [r.left + r.width / 2, r.top + r.height / 2];
            if ((b as HTMLElement).hidden || c[0]! <= st.left || c[0]! >= st.right || c[1]! <= st.top || c[1]! >= st.bottom) continue;
            n += 1;
            const label = b.getAttribute('aria-label') ?? '';
            let best = Infinity;
            for (const [title, segs] of lines) if (label.includes(title)) for (const s of segs) best = Math.min(best, dist(c, s[0], s[1]));
            if (!(best <= 3)) off.push(`${label} ${Math.round(best)}px`);
        }
        return { n, off };
    });
}

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

    it('demo: every visible line icon stays on its own line after a page scroll, a pan, a zoom, a table drag and with all lines drawn', async () => {
        const page = await open('demo', 1440, 640);
        const check = async (step: string): Promise<void> => {
            const r = await iconsOffTheirLine(page);
            expect(r.n, `${step}: icons on the stage`).toBeGreaterThan(0);
            expect(r.off, step).toEqual([]);
        };
        await check('open');
        await page.evaluate(() => { document.getElementById('av-main')!.scrollTop += 180; window.scrollBy(0, 120); });
        await settle(page);
        await check('page scroll');
        const box = (await page.locator('#db-stage').boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, Math.max(4, box.y - 40));
        await page.mouse.wheel(0, 200);
        await settle(page);
        await check('wheel beside the stage');
        await drag(page, await backgroundPoint(page), { x: 260, y: -140 });
        await check('pan');
        const sb = (await page.locator('#db-stage').boundingBox())!;
        await page.mouse.move(sb.x + sb.width * 0.45, sb.y + sb.height * 0.55);
        await page.mouse.wheel(0, -300);
        await settle(page);
        await check('zoom in');
        await page.mouse.wheel(0, 900);
        await settle(page);
        await check('zoom out');
        const name = await page.evaluate(() => (window as unknown as { __mapErd: { focus: string } }).__mapErd.focus);
        const hb = (await page.locator(`#db-stage .db-table[data-table="${name}"] .db-thead`).boundingBox())!;
        await drag(page, { x: hb.x + 30, y: hb.y + hb.height / 2 }, { x: 140, y: 90 }, 'Meta');
        await check('table drag');
        await page.click('.db-seg[aria-label="Lines"] button[data-v="all"]');
        await settle(page);
        await check('all lines');
        await drag(page, await backgroundPoint(page), { x: -300, y: 200 });
        await check('all lines, pan');
        await page.setViewportSize({ width: 1100, height: 700 });
        await settle(page);
        await check('resize');
        await page.close();
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
            const r = await iconsOffTheirLine(page);
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
