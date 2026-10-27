import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { buildDemoMap } from '../../src/scripts/code_graph/map_demo.js';
import { sampleAreas } from './code_graph_map_areas_fixture.js';

// The shell at the handover's breakpoints (road-to-map-views-from-the-handover,
// step 1.5): 700 and 1000 instead of 720 and 400, the nav and every tablist one
// horizontal scroll strip at 700 and below (no ☰ menu, Decision D6), asides as
// flyouts inside the page body with the handover's shadows, each named for the
// page it serves. Every route at 1440, 375 and 320, in both themes, on a sample
// map and on the demo map: no document overflow anywhere.

const ROUTES = ['overview', 'code', 'data', 'systems', 'interfaces', 'runtime', 'delivery', 'bugs', 'knowledge', 'impact', 'agent'];
const WIDTHS = [1440, 375, 320];

let browser: Browser;
let sample: string;
let demo: string;
const roots: string[] = [];
const tmp = (p: string): string => { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), p))); roots.push(d); return d; };

async function open(html: string, hash: string, width: number, scheme: 'dark' | 'light' = 'dark'): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme, locale: 'de-DE' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}
const docOverflow = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

beforeAll(async () => {
    const root = tmp('cg-ovf-');
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const b = a;\n`);
    sample = path.join((await buildMap(root, { areas: sampleAreas() })).outDir, 'index.html');
    process.env['EVENT4U_CONFIG_HOME'] = path.join(tmp('cg-ovf-home-'), 'home');
    demo = (await buildDemoMap(tmp('cg-ovf-demo-'))).page;
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 180_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('the shell at the handover breakpoints', () => {
    for (const [name, which] of [['sample', () => sample], ['demo', () => demo]] as const) {
        for (const scheme of ['dark', 'light'] as const) {
            it(`every route at 1440, 375 and 320 has no document overflow — ${name} map, ${scheme}`, async () => {
                for (const width of WIDTHS) {
                    const { page, errors } = await open(which(), '#/overview', width, scheme);
                    for (const r of ROUTES) {
                        await page.evaluate((x) => { location.hash = `#/${x}`; }, r);
                        await page.waitForFunction((x) => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === x, r);
                        expect(await docOverflow(page), `${r} @ ${width}`).toBeLessThanOrEqual(0);
                    }
                    expect(errors).toEqual([]);
                    await page.close();
                }
            });
        }
    }

    it('at 375 the nav is one scroll strip, not a menu; at 1440 it wraps in place', async () => {
        const { page } = await open(demo, '#/agent', 375);
        expect(await page.locator('#areamenu').count()).toBe(0);
        const nav = await page.locator('#areanav').evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, ox: getComputedStyle(e).overflowX, wrap: getComputedStyle(e).flexWrap, visible: e.getBoundingClientRect().height > 0 }));
        expect(nav).toMatchObject({ ox: 'auto', wrap: 'nowrap', visible: true });
        expect(nav.sw).toBeGreaterThan(nav.cw);
        // The open area is scrolled into the strip.
        const cur = await page.locator('#areanav a[aria-current="page"]').evaluate((a) => { const n = a.parentElement!.getBoundingClientRect(); const r = a.getBoundingClientRect(); return r.left >= n.left - 1 && r.right <= n.right + 1; });
        expect(cur).toBe(true);
        expect(await docOverflow(page)).toBeLessThanOrEqual(0);
        await page.close();
        const wide = await open(demo, '#/agent', 1440);
        expect(await wide.page.locator('#areanav').evaluate((e) => getComputedStyle(e).flexWrap)).toBe('wrap');
        await wide.page.close();
    });

    it('a tablist at 375 scrolls rather than wraps', async () => {
        const { page } = await open(demo, '#/data', 375);
        const lists = await page.locator('[role="tablist"]').evaluateAll((ls) => ls.filter((l) => l.getBoundingClientRect().height > 0).map((l) => [getComputedStyle(l).flexWrap, getComputedStyle(l).overflowX].join(' ')));
        expect(lists.length).toBeGreaterThan(0);
        for (const l of lists) expect(l).toBe('nowrap auto');
        await page.close();
    });

    it('unpinned asides fly out inside the body with the handover shadows, and join the flow at 1000 and below', async () => {
        const { page } = await open(demo, '#/interfaces', 1100);
        await page.locator('#av-open').click();
        const right = await page.locator('#av-side').evaluate((e) => ({ pos: getComputedStyle(e).position, shadow: getComputedStyle(e).boxShadow, w: getComputedStyle(e).width, parent: e.parentElement!.id }));
        expect(right).toMatchObject({ pos: 'absolute', shadow: 'rgba(0, 0, 0, 0.35) -12px 0px 40px 0px', w: '400px', parent: 'av-body' });
        expect(await page.locator('#av-scrim').evaluate((e) => [getComputedStyle(e).position, getComputedStyle(e).backgroundColor].join(' '))).toBe('absolute rgba(4, 8, 14, 0.45)');
        await page.locator('#av-close').click();
        await page.locator('#av-open-left').click();
        expect(await page.locator('#av-left').evaluate((e) => [getComputedStyle(e).position, getComputedStyle(e).boxShadow, getComputedStyle(e).width].join(' | '))).toBe('absolute | rgba(0, 0, 0, 0.35) 12px 0px 40px 0px | 320px');
        await page.close();
        const narrow = await open(demo, '#/interfaces', 900);
        await narrow.page.locator('#av-open').click();
        expect(await narrow.page.locator('#av-side').evaluate((e) => getComputedStyle(e).position)).toBe('static');
        expect(await docOverflow(narrow.page)).toBeLessThanOrEqual(0);
        await narrow.page.close();
    });

    it('each aside is named for the page it serves', async () => {
        const want: Record<string, [string, string]> = { data: ['Schema', 'Detail'], interfaces: ['Dienste', 'Operation'], runtime: ['Detail', 'Ressource'], delivery: ['Detail', 'Detail'], impact: ['Detail', 'Nachweisbericht'], agent: ['Anfrage', 'Item'] };
        const { page } = await open(demo, '#/overview', 1440);
        for (const [r, [l, rr]] of Object.entries(want)) {
            await page.evaluate((x) => { location.hash = `#/${x}`; }, r);
            await page.waitForFunction((x) => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === x, r);
            expect(await page.locator('#av-left').getAttribute('aria-label'), r).toBe(l);
            expect(await page.locator('#av-side').getAttribute('aria-label'), r).toBe(rr);
        }
        await page.close();
    });
});
