import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { sampleAreas } from './code_graph_map_areas_fixture.js';

// The page-module contract of the area shell: a module with `page` gets a bar,
// a left rail, the centre and a right rail, and both rails follow the Code
// rails — pinned on a wide window, a flyout with a scrim below it, never
// pinned on a phone, one flyout at a time.

let browser: Browser;
let root: string;
let html: string;

const sha = (s: string): string => createHash('sha256').update(s, 'utf-8').digest('base64');

/** The drawn page with a test module replacing the Data area; the CSP hash is recomputed over the new script. */
function withModule(mod: string, name: string): string {
    const src = fs.readFileSync(html, 'utf-8');
    const open = src.lastIndexOf('<script>');
    const close = src.lastIndexOf('</script>');
    const js = src.slice(open + '<script>'.length, close);
    // shell.js boots the page; the module must be registered before it runs.
    const at = js.indexOf('var SHELL = data.shell');
    expect(at).toBeGreaterThan(0);
    const next = js.slice(0, at) + `AREA_MODULES.data = ${mod};\n` + js.slice(at);
    const out = (src.slice(0, open) + '<script>' + next + src.slice(close)).replace(`'sha256-${sha(js)}'`, `'sha256-${sha(next)}'`);
    const file = path.join(path.dirname(html), name + '.html');
    fs.writeFileSync(file, out);
    return file;
}

const BASE = `{
    tabs: [['one', 'lGraph'], ['two', 'lLayers']],
    items: function () { return [{ key: 'thing/a', kind: 'thing', label: 'a', rows: [], witnesses: [] }]; },
    meta: function () { return 'module meta'; },
    railTitles: RAILS,
    OWNS
    page: function (p, view, key, c) {
        c.left.appendChild(el('div', { id: 'tl' }, 'left body'));
        c.main.appendChild(el('div', { id: 'tm' }, 'view ' + view + ' key ' + key));
        c.right.appendChild(el('div', { id: 'tr' }, 'right body'));
        if (this.ownsBar) c.bar.appendChild(viewTabs('data', key, this.tabs));
    }
}`;
const mod = (rails: string, owns = false): string => BASE.replace('RAILS', rails).replace('OWNS', owns ? 'ownsBar: true,' : '');

let twoRails: string;
let rightOnly: string;
let ownBar: string;

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-rails-')));
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const b = a;\n`);
    const res = await buildMap(root, { areas: sampleAreas() });
    html = path.join(res.outDir, 'index.html');
    twoRails = withModule(mod("['repository', 'detail']"), 'two');
    rightOnly = withModule(mod("[null, 'detail']"), 'right');
    ownBar = withModule(mod("['repository', 'detail']", true), 'own');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

async function open(file: string, width: number, hash = '#/data'): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width, height: 800 }, colorScheme: 'dark', locale: 'en-US' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(file).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}
const shown = (page: Page, id: string) =>
    page.evaluate((x) => {
        const n = document.getElementById(x) as HTMLElement;
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        return { fixed: cs.position === 'fixed', visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.right > 1 && r.left < window.innerWidth - 1 };
    }, id);

describe('a page module lays out both rails and the centre', () => {
    it('hands the module three containers and keeps the witness rail out', async () => {
        const { page, errors } = await open(twoRails, 1440);
        expect(await page.locator('#tl').textContent()).toBe('left body');
        expect(await page.locator('#tm').textContent()).toBe('view one key ');
        expect(await page.locator('#av-right-body #tr').isVisible()).toBe(true);
        expect(await page.locator('#av-detail').isVisible()).toBe(false);
        expect(await page.locator('#av-left-title').textContent()).toBe('Repository');
        expect(await page.locator('#av-right-title').textContent()).toBe('Detail');
        // Not owning the bar: the shell draws one head row in the centre and leaves the bar hidden.
        expect(await page.locator('#av-bar').isVisible()).toBe(false);
        expect(await page.locator('#av-main .av-head [role="tab"]').allTextContents()).toEqual(['Graph', 'Layers']);
        expect(await page.locator('#av-main .av-head').textContent()).toContain('module meta');
        await page.click('#av-main .av-head [role="tab"]:has-text("Layers")');
        expect(await page.locator('#tm').textContent()).toBe('view two key ');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('pins both rails at 1440 with no open button showing', async () => {
        const { page } = await open(twoRails, 1440);
        expect(await shown(page, 'av-left')).toEqual({ fixed: false, visible: true });
        expect(await shown(page, 'av-side')).toEqual({ fixed: false, visible: true });
        expect(await page.locator('#av-open-left').isVisible()).toBe(false);
        expect(await page.locator('#av-open').isVisible()).toBe(false);
        await page.click('#av-pin-left');
        expect(await shown(page, 'av-left')).toMatchObject({ visible: false });
        expect(await page.locator('#av-open-left').isVisible()).toBe(true);
        await page.close();
    });

    it('flies one rail at a time with a scrim at 1000', async () => {
        const { page } = await open(twoRails, 1000);
        expect(await shown(page, 'av-left')).toMatchObject({ visible: false });
        expect(await shown(page, 'av-side')).toMatchObject({ visible: false });
        await page.click('#av-open-left');
        expect(await shown(page, 'av-left')).toEqual({ fixed: true, visible: true });
        expect(await page.locator('#av-scrim').isVisible()).toBe(true);
        await page.keyboard.press('Escape');
        expect(await shown(page, 'av-left')).toMatchObject({ visible: false });
        await page.click('#av-open');
        expect(await shown(page, 'av-side')).toEqual({ fixed: true, visible: true });
        await page.evaluate(() => (document.getElementById('av-open-left') as HTMLElement).click());
        expect(await shown(page, 'av-left')).toMatchObject({ visible: true });
        expect(await shown(page, 'av-side')).toMatchObject({ visible: false });
        await page.close();
    });

    it('never pins on a phone', async () => {
        const { page } = await open(twoRails, 375);
        await page.click('#av-open-left');
        expect(await shown(page, 'av-left')).toEqual({ fixed: true, visible: true });
        expect(await page.locator('#av-pin-left').isVisible()).toBe(false);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
        await page.close();
    });

    it('draws no left rail and no left control when the module names none', async () => {
        const { page } = await open(rightOnly, 1000);
        expect(await shown(page, 'av-left')).toMatchObject({ visible: false });
        expect(await page.locator('#av-open-left').isVisible()).toBe(false);
        expect(await page.locator('#av-open').isVisible()).toBe(true);
        await page.close();
    });

    it('a module that owns the bar fills it and keeps the open buttons at its ends', async () => {
        const { page } = await open(ownBar, 1000);
        expect(await page.locator('#av-bar').isVisible()).toBe(true);
        expect(await page.locator('#av-main .av-head').count()).toBe(0);
        expect(await page.locator('#av-bar [role="tab"]').allTextContents()).toEqual(['Graph', 'Layers']);
        const ends = await page.evaluate(() => {
            const b = document.getElementById('av-bar') as HTMLElement;
            return [b.firstElementChild?.id, b.lastElementChild?.id];
        });
        expect(ends).toEqual(['av-open-left', 'av-open']);
        await page.close();
    });

    it('a module without page keeps the witness rail', async () => {
        const { page } = await open(html, 1440, '#/interfaces');
        expect(await page.locator('#av-detail').isVisible()).toBe(true);
        expect(await shown(page, 'av-left')).toMatchObject({ visible: false });
        await page.close();
    });
});
