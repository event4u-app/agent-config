/**
 * A label selects what it names, in every graph view (owner, 2026-10-26): a click on
 * the name behaves exactly like a click on its node, a double click opens what the
 * node's double click opens, a drag that starts on a label pans or turns and selects
 * nothing, and the pointer shows over a label. The Code workbench paints its labels
 * on a canvas, so they are hit-tested there; the ERD and the Projects graph draw
 * theirs as elements of the node itself. Real mouse events, on the demo map.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildDemoMap } from '../../src/scripts/code_graph/map_demo.js';

let tmp: string;
let mapPage: string;
let hubPage: string;
let browser: Browser;

beforeAll(async () => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-label-click-')));
    const res = await buildDemoMap(tmp, { outDir: path.join(tmp, 'demo') });
    mapPage = res.page;
    hubPage = res.hubPage;
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 300_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
});

interface Box { x: number; y: number; w: number; h: number }
interface Label extends Box { kind: string; idx: number }
interface View { level: string; area: number; file: number; drawn: Array<{ kind: string; idx: number; x: number; y: number }> }

const settle = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const view = (page: Page): Promise<View> => page.evaluate(() => (window as unknown as { __mapView: View }).__mapView);
const boxes = (page: Page): Promise<{ boxes: Box[]; labels?: Label[] }> => page.evaluate(() => (window as unknown as { __mapLabelBoxes: { boxes: Box[]; labels?: Label[] } }).__mapLabelBoxes);

async function openCode(): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(mapPage).href + '#/code');
    await page.waitForFunction(() => (window as unknown as { __mapView?: { level: string } }).__mapView?.level === 'overview');
    await settle(page);
    return page;
}
async function stageAt(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
    const b = (await page.locator('#stage').boundingBox())!;
    return { x: b.x + x, y: b.y + y };
}
/** Escape clears a selection the way the page does; the canvas must not hold the search field's focus. */
async function clearSelection(page: Page): Promise<void> {
    await page.locator('#stage').focus().catch(() => undefined);
    await page.keyboard.press('Escape');
    await settle(page);
}
/** A name label whose centre lies on no node, so a click there can only reach the label. */
async function freeLabel(page: Page, kind: string): Promise<Label> {
    const lb = await boxes(page);
    const v = await view(page);
    const label = (lb.labels ?? []).find((l) => l.kind === kind && !v.drawn.some((d) => Math.hypot(d.x - (l.x + l.w / 2), d.y - (l.y + l.h / 2)) < 30));
    expect(label, `a ${kind} label clear of the nodes`).toBeTruthy();
    return label!;
}
const centre = (b: Box): { x: number; y: number } => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

describe('the Code workbench: a canvas label selects its node', () => {
    it('2D overview: a click on a name selects that area, as a click on the bubble does; nothing else is hit there', async () => {
        const page = await openCode();
        // Behaviour first, from what the page drew: the first name it placed is a target.
        const first = (await boxes(page)).boxes[0]!;
        const fp = await stageAt(page, first.x + first.w / 2, first.y + first.h / 2);
        await page.mouse.click(fp.x, fp.y);
        await settle(page);
        expect((await view(page)).area, 'a click on a name selects an area').toBeGreaterThanOrEqual(0);
        await clearSelection(page);
        const label = await freeLabel(page, 'area');
        const node = (await view(page)).drawn.find((d) => d.kind === 'area' && d.idx === label.idx)!;
        const np = await stageAt(page, node.x, node.y);
        await page.mouse.click(np.x, np.y);
        await settle(page);
        const byNode = await view(page);
        expect(byNode.area).toBe(label.idx);
        await clearSelection(page);
        expect((await view(page)).area).toBe(-1);
        const lp = await stageAt(page, centre(label).x, centre(label).y);
        await page.mouse.click(lp.x, lp.y);
        await settle(page);
        const byLabel = await view(page);
        expect({ level: byLabel.level, area: byLabel.area, file: byLabel.file }).toEqual({ level: byNode.level, area: byNode.area, file: byNode.file });
        await page.close();
    });

    it('2D: hovering a name shows the pointer; a drag that starts on it pans and selects nothing; a double click opens the area, and there a file name selects the file', async () => {
        const page = await openCode();
        const label = await freeLabel(page, 'area');
        const lp = await stageAt(page, centre(label).x, centre(label).y);
        await page.mouse.move(lp.x, lp.y);
        expect(await page.locator('#stage').evaluate((c) => getComputedStyle(c).cursor)).toBe('pointer');
        const before = (await view(page)).drawn.find((d) => d.kind === 'area' && d.idx === label.idx)!;
        await page.mouse.down();
        await page.mouse.move(lp.x + 90, lp.y + 50, { steps: 6 });
        await page.mouse.up();
        await settle(page);
        const after = await view(page);
        const moved = after.drawn.find((d) => d.kind === 'area' && d.idx === label.idx)!;
        expect(Math.round(moved.x - before.x)).toBe(90);
        expect(after.area, 'a drag selects nothing').toBe(-1);
        // The label moved with the view; double-click it where it is now.
        const again = (await boxes(page)).labels!.find((l) => l.kind === 'area' && l.idx === label.idx)!;
        const ap = await stageAt(page, centre(again).x, centre(again).y);
        await page.mouse.dblclick(ap.x, ap.y);
        await page.waitForFunction(() => (window as unknown as { __mapView: { level: string } }).__mapView.level === 'area');
        expect((await view(page)).area).toBe(label.idx);
        await settle(page);
        const fileLabel = await freeLabel(page, 'file');
        const fp = await stageAt(page, centre(fileLabel).x, centre(fileLabel).y);
        await page.mouse.click(fp.x, fp.y);
        await settle(page);
        expect((await view(page)).file).toBe(fileLabel.idx);
        await page.close();
    });

    it('3D orb: a click on a name selects its node; a drag that starts on it turns the orb and selects nothing', async () => {
        const page = await openCode();
        await page.click('#dim');
        await settle(page);
        const label = await freeLabel(page, 'area');
        const turned = await page.evaluate(() => JSON.stringify((window as unknown as { __mapOrbNodes: unknown }).__mapOrbNodes));
        const lp = await stageAt(page, centre(label).x, centre(label).y);
        await page.mouse.move(lp.x, lp.y);
        await page.mouse.down();
        await page.mouse.move(lp.x + 60, lp.y + 20, { steps: 6 });
        await page.mouse.up();
        await settle(page);
        expect(await page.evaluate(() => JSON.stringify((window as unknown as { __mapOrbNodes: unknown }).__mapOrbNodes))).not.toBe(turned);
        expect((await view(page)).area, 'a drag selects nothing').toBe(-1);
        const now = await freeLabel(page, 'area');
        const np = await stageAt(page, centre(now).x, centre(now).y);
        await page.mouse.click(np.x, np.y);
        await settle(page);
        expect((await view(page)).area).toBe(now.idx);
        await page.close();
    });
});

describe('the ERD and the Projects graph: the name is part of the node', () => {
    it('ERD 2D and 3D: a click on a table name picks the table', async () => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(pathToFileURL(mapPage).href + '#/data');
        await page.waitForFunction(() => (window as unknown as { __mapErd?: unknown }).__mapErd !== undefined);
        await settle(page);
        const pick = async (sel: string): Promise<void> => {
            const target = await page.evaluate((s) => {
                const st = document.getElementById('db-stage')!.getBoundingClientRect();
                for (const n of document.querySelectorAll(s)) {
                    const r = n.getBoundingClientRect();
                    const x = r.left + Math.min(r.width / 2, 40);
                    const y = r.top + r.height / 2;
                    if (x < st.left + 10 || x > st.right - 10 || y < st.top + 60 || y > st.bottom - 10) continue;
                    const name = n.closest('[data-table]')!.getAttribute('data-table')!;
                    if (document.elementFromPoint(x, y) === n || n.contains(document.elementFromPoint(x, y))) return { x, y, name };
                }
                return null;
            }, sel);
            expect(target, sel).not.toBeNull();
            await page.mouse.click(target!.x, target!.y);
            await page.waitForFunction((n) => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === `table/${n}`, target!.name);
        };
        await pick('#db-stage .db-table:not(.focus):not(.ghost) .db-thead .tn');
        await page.click('#db-stage .dimseg button[data-dim="3d"]');
        await page.waitForFunction(() => (window as unknown as { __mapErd3d?: unknown }).__mapErd3d !== undefined);
        await settle(page);
        await pick('#db-stage .db-3card.chip:not([hidden]) .tn');
        await page.close();
    });

    it('Projects: a click on a project name selects the project, and on a link label selects the link', async () => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(pathToFileURL(hubPage).href + '#/projects');
        await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
        await settle(page);
        const name = page.locator('.ops-graph .ops-pnode .ops-pname').nth(1);
        const id = await name.evaluate((n) => n.closest('.ops-pnode')!.getAttribute('title'));
        await name.click();
        await page.waitForFunction((x) => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === `project/${x}`, id);
        await page.locator('.ops-graph .ops-elabel').first().click();
        await page.waitForFunction(() => /^edge\//.test((window as unknown as { __mapRoute: { item: string } }).__mapRoute.item));
        await page.close();
    });
});
