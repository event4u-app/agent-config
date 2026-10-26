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
    fs.writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
    const res = await buildMap(root);
    html = path.join(res.outDir, 'index.html');
    const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { model?: { areas?: unknown[] } };
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
    await page.goto(`${pathToFileURL(html).href}#/code`);
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

    it('by default both views show the same top fifteen areas', async () => {
        const page = await open();
        expect(await page.locator('#lim').getAttribute('data-value')).toBe('15');
        expect(await page.locator('#lim').textContent()).toMatch(/Top 15/);
        const flat = await shown(page);
        await page.click('#dim');
        const orb = await shown(page);
        expect(flat).toHaveLength(15);
        expect(orb).toEqual(flat);
        await page.close();
    });

    it('the area limit is a choice of 15, 30, 50, 100 or all, applied to both views', async () => {
        const page = await open();
        await page.click('#lim');
        const options = await page.locator('#limlist [role="option"]').evaluateAll((os) => os.map((o) => o.getAttribute('data-value')));
        expect(options).toEqual(['15', '30', '50', '100', 'all']);
        await page.click('#limlist [data-value="all"]');
        expect(await page.locator('#limlist').isVisible()).toBe(false);
        const flat = await shown(page);
        await page.click('#dim');
        expect(flat).toHaveLength(areaCount);
        expect(await shown(page)).toEqual(flat);
        // 30 on a map with fewer areas shows them all; the limit never invents areas.
        await pickLimit(page, '30');
        expect(await shown(page)).toHaveLength(Math.min(30, areaCount));
        await pickLimit(page, '15');
        expect(await shown(page)).toHaveLength(15);
        await page.close();
    });

    it('the area-limit dropdown works from the keyboard and closes on Escape and outside clicks', async () => {
        const page = await open();
        await page.focus('#lim');
        await page.keyboard.press('Enter');
        expect(await page.locator('#lim').getAttribute('aria-expanded')).toBe('true');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        expect(await page.locator('#lim').getAttribute('data-value')).toBe('30');
        expect(await page.locator('#limlist').isVisible()).toBe(false);
        await page.click('#lim');
        await page.keyboard.press('Escape');
        expect(await page.locator('#limlist').isVisible()).toBe(false);
        await page.click('#lim');
        await page.mouse.click(5, 5);
        expect(await page.locator('#limlist').isVisible()).toBe(false);
        await page.close();
    });

    it('the active 2D/3D button looks like the active view tab, not a solid brand fill', async () => {
        const page = await open();
        const look = (sel: string): Promise<string[]> => page.locator(sel).evaluate((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.boxShadow, c.color]; });
        const tab = await look('#lenses [aria-selected="true"]');
        expect(await look('#dim2d')).toEqual(tab);
        await page.click('#dim');
        expect(await look('#dim')).toEqual(tab);
        await page.close();
    });
});

async function pickLimit(page: Page, v: string): Promise<void> {
    await page.click('#lim');
    await page.click(`#limlist [data-value="${v}"]`);
}

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
        await page.goto(`${pathToFileURL(html).href}#/code`);
        await page.waitForFunction(() => (window as unknown as { __mapView?: unknown }).__mapView !== undefined);
        const m = await page.evaluate(() => ({
            stage: (document.querySelector('.stage') as HTMLElement).getBoundingClientRect().height,
            page: document.documentElement.scrollHeight,
            vh: window.innerHeight,
        }));
        expect(m.stage).toBeGreaterThan(700);
        expect(m.page).toBeLessThanOrEqual(m.vh + 1);
        // The side panels span the height under the header and scroll inside themselves.
        const panes = await page.evaluate(() =>
            ['pane-left', 'pane-right'].map((id) => {
                const el = document.getElementById(id) as HTMLElement;
                const top = (document.querySelector('.top') as HTMLElement).getBoundingClientRect().bottom;
                return { height: el.getBoundingClientRect().height, below: window.innerHeight - top, overflowY: getComputedStyle(el).overflowY };
            }),
        );
        for (const p of panes) {
            expect(p.overflowY).toBe('auto');
            expect(p.height).toBeGreaterThanOrEqual(p.below - 1);
        }
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
    it('is the AC mark drawn as inline vectors; the page loads no image at all', async () => {
        const text = fs.readFileSync(html, 'utf-8');
        expect(text).toMatch(/<svg class="logo" width="40" height="40" viewBox="0 0 172 172" role="img" aria-label="AC">/);
        expect(text).not.toMatch(/<img\b/);
        expect(text).toMatch(/img-src 'none'/);
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.goto(`${pathToFileURL(html).href}#/code`);
        const box = await page.evaluate(() => {
            const r = (document.querySelector('.brand .logo') as SVGElement).getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height) };
        });
        expect(box).toEqual({ w: 40, h: 40 });
        await page.close();
    });
});

describe('side panels: pinned on a wide window, flyouts below it', () => {
    async function at(width: number, height = 900): Promise<Page> {
        const page = await browser.newPage({ viewport: { width, height } });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`${pathToFileURL(html).href}#/code`);
        await page.waitForFunction(() => (window as unknown as { __mapView?: unknown }).__mapView !== undefined);
        return page;
    }
    const pane = (page: Page, id: string) =>
        page.evaluate((sel) => {
            const el = document.getElementById(sel) as HTMLElement;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return { fixed: cs.position === 'fixed', visible: cs.visibility !== 'hidden' && r.right > 1 && r.left < window.innerWidth - 1, width: r.width };
        }, id);
    const stageWidth = (page: Page) => page.evaluate(() => (document.querySelector('.stage') as HTMLElement).getBoundingClientRect().width);

    it('wide: both panels are pinned beside the centre; unpinning one widens the centre', async () => {
        const page = await at(1600);
        expect(await pane(page, 'pane-left')).toMatchObject({ fixed: false, visible: true });
        expect(await pane(page, 'pane-right')).toMatchObject({ fixed: false, visible: true });
        const before = await stageWidth(page);
        await page.click('#pin-left');
        expect(await pane(page, 'pane-left')).toMatchObject({ visible: false });
        expect(await stageWidth(page)).toBeGreaterThan(before + 200);
        await page.click('#open-left');
        expect(await pane(page, 'pane-left')).toMatchObject({ fixed: true, visible: true });
        await page.close();
    });

    it('tablet: panels start as closed flyouts, open over the centre, and can be pinned', async () => {
        const page = await at(1000);
        expect(await pane(page, 'pane-right')).toMatchObject({ visible: false });
        const full = await stageWidth(page);
        await page.click('#open-right');
        expect(await pane(page, 'pane-right')).toMatchObject({ fixed: true, visible: true });
        expect(await stageWidth(page)).toBe(full);
        await page.click('#pin-right');
        expect(await pane(page, 'pane-right')).toMatchObject({ fixed: false, visible: true });
        expect(await stageWidth(page)).toBeLessThan(full - 200);
        await page.close();
    });

    it('phone: flyouts only — no pin, the panel lies over the graph, a tap beside it closes it', async () => {
        const page = await at(390, 800);
        expect(await page.locator('#pin-left').isVisible()).toBe(false);
        await page.click('#open-left');
        const open = await pane(page, 'pane-left');
        expect(open).toMatchObject({ fixed: true, visible: true });
        expect(await page.locator('#pin-left').isVisible()).toBe(false);
        await page.mouse.click(385, 400);
        expect(await pane(page, 'pane-left')).toMatchObject({ visible: false });
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(scroll).toBe(false);
        await page.close();
    });
});

describe('audit fixes: what the viewer shows is what the reader chose', () => {
    async function firstFileInArea(page: Page): Promise<{ idx: number; x: number; y: number }> {
        const node = (await view(page)).drawn.find((d) => d.kind === 'file');
        if (!node) throw new Error('no file drawn');
        const box = await page.locator('#stage').boundingBox();
        if (!box) throw new Error('no stage');
        return { idx: node.idx, x: box.x + node.x, y: box.y + node.y };
    }

    it('nothing is selected when the page opens', async () => {
        const page = await open();
        expect((await view(page)).file).toBe(-1);
        await page.close();
    });

    it('opening another area drops a file marked in the previous one', async () => {
        const page = await open();
        const a = await firstArea(page);
        await page.mouse.dblclick(a.x, a.y);
        const f = await firstFileInArea(page);
        await page.mouse.click(f.x, f.y);
        expect((await view(page)).file).toBe(f.idx);
        // Open another area through search, which jumps without a marking click first.
        const other = await page.evaluate((cur) => {
            const data = JSON.parse((document.getElementById('map-data') as HTMLElement).textContent as string) as { model: { areas: Array<{ id: string }> } };
            const k = data.model.areas.findIndex((_, i) => i !== cur);
            return { idx: k, id: data.model.areas[k]?.id as string };
        }, a.idx);
        await page.fill('#search', other.id);
        await page.locator('#results button').first().click();
        const v = await view(page);
        expect(v.area).toBe(other.idx);
        expect(v.file).toBe(-1);
        await page.close();
    });

    it('a double click that changes nothing leaves no dead "back" step', async () => {
        const page = await open();
        const a = await firstArea(page);
        await page.mouse.dblclick(a.x, a.y);
        const f = await firstFileInArea(page);
        await page.mouse.dblclick(f.x, f.y);
        await page.mouse.dblclick(f.x, f.y);
        // One "back" reaches the overview: the two double clicks changed nothing.
        await page.click('#nav-back');
        expect((await view(page)).level).toBe('overview');
        expect(await page.locator('#nav-back').count()).toBe(0);
        await page.close();
    });

    it('on the overview the file-edge toggles are disabled and say why; in an area they work', async () => {
        const page = await open();
        expect(await page.locator('#t-guess').isDisabled()).toBe(true);
        expect(await page.locator('#t-guess').getAttribute('title')).toMatch(/area/i);
        const a = await firstArea(page);
        await page.mouse.dblclick(a.x, a.y);
        expect(await page.locator('#t-guess').isDisabled()).toBe(false);
        await page.close();
    });

    it('a file that has no area is named as not on the graph', async () => {
        const page = await open();
        await page.fill('#search', 'README');
        await page.locator('#results button').first().click();
        expect(await page.locator('#hint').textContent()).toMatch(/README\.md .*not on the graph/);
        await page.close();
    });

    it('full screen hides the header, breadcrumb, legend and footer', async () => {
        const page = await open();
        await page.click('#full');
        for (const sel of ['.top', '#crumbs', '#legend', '#foot']) expect(await page.locator(sel).isVisible()).toBe(false);
        await page.click('#full');
        expect(await page.locator('.top').isVisible()).toBe(true);
        await page.close();
    });
});

