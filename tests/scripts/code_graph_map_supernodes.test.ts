/**
 * Folder super-nodes in the Code area: an area drawn with more nodes than the
 * measured line folds its files into one node per folder; it unfolds only at the
 * lower count, a click opens one folder, and zoom opens and folds them with its
 * own two thresholds.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap, renderHtml } from '../../src/scripts/code_graph/map.js';

const LIMITS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/scripts/code_graph/map_viewer/supernodes.json'), 'utf-8')) as {
    collapseAbove: number;
    expandBelow: number;
    zoomExpand: number;
    zoomCollapse: number;
};

let browser: Browser;
let html: string;
let root: string;
interface SuperState { on: boolean; zoomed: boolean; nodes: number; supers: number }

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-super-')));
    fs.mkdirSync(path.join(root, 'agents'));
    fs.mkdirSync(path.join(root, 'src/alpha'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src/beta'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src/gamma'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/hub.ts'), 'export const hub = 1;\n');
    // Code files between the two lines; the tests push the area above the upper one.
    const code = LIMITS.expandBelow + Math.ceil((LIMITS.collapseAbove - LIMITS.expandBelow) / 2);
    for (let i = 0; i < code; i++) {
        const dir = ['alpha', 'beta'][i % 2];
        fs.writeFileSync(path.join(root, `src/${dir}/f${i}.ts`), `import { hub } from '../hub';\nexport const f${i} = hub + ${i};\n`);
    }
    for (let i = 0; i < LIMITS.collapseAbove - code + 6; i++) {
        fs.writeFileSync(path.join(root, `src/gamma/t${i}.test.ts`), `import { hub } from '../hub';\nexport const t${i} = hub;\n`);
    }
    const res = await buildMap(root);
    // Community detection splits a star; the fold is a property of one area's size, so every file goes into one area.
    const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as {
        meta: Parameters<typeof renderHtml>[1];
        model: Parameters<typeof renderHtml>[0] & { files: Array<{ area: number }>; areas: Array<{ files: number[]; local: Array<[number, number, number]> }> };
        areas: Parameters<typeof renderHtml>[2];
    };
    const all = doc.model.files.map((_, i) => i);
    doc.model.files.forEach((f) => { f.area = 0; });
    doc.model.areas = [{ ...doc.model.areas[0]!, files: all, local: all.map((i) => [i, Math.cos(i * 2.4) * (0.2 + (i % 7) / 9), Math.sin(i * 2.4) * (0.2 + (i % 7) / 9)] as [number, number, number]) }];
    html = path.join(res.outDir, 'one-area.html');
    fs.writeFileSync(html, renderHtml(doc.model, doc.meta, doc.areas));
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

async function openHubArea(): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(html).href + '#/code');
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    await enter(page);
    return page;
}
async function enter(page: Page): Promise<void> {
    await page.fill('#search', 'src/hub.ts');
    await page.locator('#results button', { hasText: 'src/hub.ts' }).first().click();
    await page.waitForFunction(() => (window as unknown as { __mapView: { level: string } }).__mapView.level === 'area');
    await drawnAtStageSize(page);
}
/**
 * The last drawing was made at the stage's present size, so the positions __mapView reports are where the
 * nodes are now: the drawing's size is the stage's box, and the bitmap matches it.
 */
async function drawnAtStageSize(page: Page): Promise<void> {
    await page.waitForFunction(() => {
        const c = document.getElementById('stage') as HTMLCanvasElement;
        const r = c.getBoundingClientRect();
        const d = window.devicePixelRatio || 1;
        const lb = (window as unknown as { __mapLabelBoxes: { width: number; height: number } }).__mapLabelBoxes;
        return lb.width === r.width && lb.height === r.height && c.width === Math.max(1, Math.round(r.width * d)) && c.height === Math.max(1, Math.round(r.height * d));
    });
}
const sup = (page: Page): Promise<SuperState> => page.evaluate(() => (window as unknown as { __mapSuper: SuperState }).__mapSuper);
const drawnKinds = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __mapView: { drawn: Array<{ kind: string }> } }).__mapView.drawn.map((d) => d.kind));

describe('folder super-nodes', () => {
    it('fold an area above the line into folders, with the count in the footer', async () => {
        const page = await openHubArea();
        const s = await sup(page);
        expect(s.nodes).toBeGreaterThan(LIMITS.collapseAbove);
        expect(s.on).toBe(true);
        expect(s.supers).toBeGreaterThanOrEqual(2);
        const kinds = await drawnKinds(page);
        expect(kinds.filter((k) => k === 'super')).toHaveLength(s.supers);
        expect(kinds.length).toBeLessThan(s.nodes);
        expect(await page.locator('#foot').textContent()).toMatch(/folded: \d+ files into \d+ folder nodes/);
        await page.close();
    });

    it('stay folded while a filter moves the count into the band, and do not fold an area that opens inside it', async () => {
        const page = await openHubArea();
        await page.click('#t-tests');
        const s = await sup(page);
        expect(s.nodes).toBeLessThanOrEqual(LIMITS.collapseAbove);
        expect(s.nodes).toBeGreaterThan(LIMITS.expandBelow);
        expect(s.on).toBe(true);
        // Leaving and entering the area again decides from the upper line: inside the band it opens unfolded.
        await page.click('#back');
        await page.waitForFunction(() => (window as unknown as { __mapView: { level: string } }).__mapView.level === 'overview');
        await enter(page);
        const f = await sup(page);
        expect(f.nodes).toBe(s.nodes);
        expect(f.on).toBe(false);
        expect(await drawnKinds(page)).not.toContain('super');
        await page.close();
    });

    it('a click opens one folder; zooming past the upper scale opens all, and they fold again only below the lower one', async () => {
        const page = await openHubArea();
        const before = (await sup(page)).supers;
        const target = await page.evaluate(() => (window as unknown as { __mapView: { drawn: Array<{ kind: string; x: number; y: number }> } }).__mapView.drawn.find((d) => d.kind === 'super')!);
        const box = (await page.locator('#stage').boundingBox())!;
        await page.mouse.click(box.x + target.x, box.y + target.y);
        expect((await sup(page)).supers).toBe(before - 1);
        const scale = (): Promise<number> => page.evaluate(() => (window as unknown as { __mapSuper: { scale: number } }).__mapSuper.scale);
        while ((await scale()) < LIMITS.zoomExpand) await page.click('#z-in');
        expect((await sup(page)).zoomed).toBe(true);
        expect(await drawnKinds(page)).not.toContain('super');
        while ((await scale()) >= LIMITS.zoomExpand) await page.click('#z-out');
        expect(await scale()).toBeGreaterThanOrEqual(LIMITS.zoomCollapse);
        expect((await sup(page)).zoomed).toBe(true);
        while ((await scale()) >= LIMITS.zoomCollapse) await page.click('#z-out');
        expect((await sup(page)).zoomed).toBe(false);
        expect(await drawnKinds(page)).toContain('super');
        await page.close();
    });

    it('the limits the page uses are the recorded measurement', () => {
        const page = fs.readFileSync(html, 'utf-8');
        expect(page).toContain(`var SUPER_LIMITS = ${JSON.stringify({ collapseAbove: LIMITS.collapseAbove, expandBelow: LIMITS.expandBelow, zoomExpand: LIMITS.zoomExpand, zoomCollapse: LIMITS.zoomCollapse })};`);
        expect(LIMITS.expandBelow).toBeLessThan(LIMITS.collapseAbove);
        expect(LIMITS.zoomCollapse).toBeLessThan(LIMITS.zoomExpand);
    });
});
