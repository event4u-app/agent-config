/**
 * The measuring side of the map-views fidelity matrices
 * (road-to-map-views-from-the-handover): it draws this repository's map and
 * the demo map from the CURRENT viewer sources, opens them and the handover's
 * pages in Chromium, and returns what was measured — custom properties,
 * computed styles at named selectors, landmarks and roles, overflow at a
 * width. No network: every request but file:// is aborted.
 *
 *   npx tsx tests/scripts/code_graph/map_fidelity_probe.ts <probe> <out.json>
 *
 * The handover is not in the tree (inbox rounds are local); set
 * MAP_HANDOVER_DIR to the folder holding p01 … p12.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';

import { renderHtml } from '../../../src/scripts/code_graph/map.js';
import { buildDemoMap } from '../../../src/scripts/code_graph/map_demo.js';
import { HANDOVER_TOKENS } from './handover_tokens.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export type Theme = 'dark' | 'light';
export const WIDTHS = [1440, 375, 320] as const;

export interface Built { real: string; demo: string; hub: string }

/** This repository's committed map re-rendered with the current viewer, and the demo map. */
export async function buildPages(out = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-fidelity-'))): Promise<Built> {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'agents/map/code/map.json'), 'utf-8')) as { meta: Parameters<typeof renderHtml>[1]; model: Parameters<typeof renderHtml>[0]; areas: Parameters<typeof renderHtml>[2] };
    const real = path.join(out, 'real.html');
    fs.writeFileSync(real, renderHtml(doc.model, doc.meta, doc.areas));
    process.env['EVENT4U_CONFIG_HOME'] = path.join(out, 'home');
    const demoRoot = path.join(out, 'demo');
    fs.mkdirSync(demoRoot, { recursive: true });
    const demo = await buildDemoMap(demoRoot);
    return { real, demo: demo.page, hub: demo.hubPage };
}

export async function launch(): Promise<Browser> {
    const { chromium } = await import('@playwright/test');
    return chromium.launch({ headless: true });
}

async function offline(page: Page): Promise<void> {
    await page.route(/^(https?|wss?):/, (r) => r.abort());
}

/** A built map page, German, at a width and theme, once the router has drawn a route. */
export async function openBuilt(browser: Browser, html: string, hash: string, width: number, theme: Theme): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme, locale: 'de-DE' });
    await offline(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return page;
}

/** A handover page (`p12/Overview.dc.html` …), switched to the light theme by its own button. */
export async function openDesign(browser: Browser, rel: string, width: number, theme: Theme): Promise<Page> {
    const dir = process.env['MAP_HANDOVER_DIR'];
    if (!dir) throw new Error('MAP_HANDOVER_DIR is not set');
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme, locale: 'de-DE' });
    await offline(page);
    await page.goto(pathToFileURL(path.join(dir, rel)).href, { waitUntil: 'load' });
    await page.waitForSelector('.ac-dark, .ac-light', { timeout: 15_000 });
    await page.waitForTimeout(400);
    // The handover starts in the scheme the browser prefers; its own button switches it.
    const want = theme === 'light' ? '.ac-light' : '.ac-dark';
    if (!(await page.$(want))) {
        await page.locator('button[aria-label="Helles Design"], button[aria-label="Dunkles Design"]').first().click();
        await page.waitForSelector(want);
    }
    return page;
}

/** Custom properties as the browser computes them at an element (`:root` by default). */
export async function computedVars(page: Page, names: readonly string[], selector = ':root'): Promise<Record<string, string>> {
    return page.evaluate(
        ([n, s]) => {
            const el = document.querySelector(s as string) ?? document.documentElement;
            const cs = getComputedStyle(el);
            return Object.fromEntries((n as string[]).map((k) => [k, cs.getPropertyValue(k).trim()]));
        },
        [names, selector] as const,
    );
}

/** Computed properties at the first visible element matching each selector; null when none matches. */
export async function computedAt(page: Page, selectors: readonly string[], props: readonly string[]): Promise<Record<string, Record<string, string> | null>> {
    return page.evaluate(
        ([sels, ps]) => {
            const vis = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
            const out: Record<string, Record<string, string> | null> = {};
            for (const s of sels as string[]) {
                const el = Array.from(document.querySelectorAll(s)).find(vis);
                if (!el) { out[s] = null; continue; }
                const cs = getComputedStyle(el);
                out[s] = Object.fromEntries((ps as string[]).map((p) => [p, cs.getPropertyValue(p)]));
            }
            return out;
        },
        [selectors, props] as const,
    );
}

/** Landmarks and widget roles that are visible: tag[role] "aria-label" and, for options, their text and state. */
export async function landmarks(page: Page): Promise<{ groups: string[]; roles: string[] }> {
    return page.evaluate(() => {
        const vis = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const txt = (e: Element) => ((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
        const q = (s: string) => Array.from(document.querySelectorAll(s)).filter(vis);
        return {
            groups: q('header,nav,main,aside,footer,[role=tablist],[role=radiogroup],[role=group],[role=switch]').map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('role') ? `[${e.getAttribute('role')}]` : ''} "${e.getAttribute('aria-label') ?? ''}"`),
            roles: q('[role=tab],[role=radio],[role=checkbox],[role=switch]').map((e) => {
                const on = e.getAttribute('aria-selected') ?? e.getAttribute('aria-checked');
                return `${e.getAttribute('role')}:${txt(e)}${on === 'true' ? '*' : ''}`;
            }),
        };
    });
}

/** Whether the document scrolls sideways, and a named element's scroll and client width. */
export async function overflowAt(page: Page, selector?: string): Promise<{ doc: boolean; docSw: number; vw: number; sw?: number; cw?: number; overflowX?: string }> {
    return page.evaluate((s) => {
        const d = document.documentElement;
        const out: { doc: boolean; docSw: number; vw: number; sw?: number; cw?: number; overflowX?: string } = { doc: d.scrollWidth > window.innerWidth, docSw: d.scrollWidth, vw: window.innerWidth };
        if (s) {
            const el = document.querySelector(s) as HTMLElement | null;
            if (el) { out.sw = el.scrollWidth; out.cw = el.clientWidth; out.overflowX = getComputedStyle(el).overflowX; }
        }
        return out;
    }, selector);
}

const TOKEN_NAMES = Object.keys(HANDOVER_TOKENS);

/** Probe `tokens`: every handover token computed at :root of the built map and of the handover, both themes. */
async function probeTokens(browser: Browser, built: Built): Promise<unknown> {
    const out: Record<string, unknown> = {};
    for (const theme of ['dark', 'light'] as const) {
        const b = await openBuilt(browser, built.real, '#/overview', 1440, theme);
        out[`built_${theme}`] = await computedVars(b, TOKEN_NAMES);
        out[`built_alias_${theme}`] = await computedVars(b, ['--alert', '--alertText', '--alertChip', '--alertTint']);
        await b.close();
        const h = await openBuilt(browser, built.hub, '#/projects', 1440, theme);
        out[`hub_grid_${theme}`] = await computedVars(h, ['--grid'], '.ops-graph');
        await h.close();
        const d = await openDesign(browser, 'p08/Systems.dc.html', 1440, theme);
        out[`design_${theme}`] = await computedVars(d, TOKEN_NAMES, theme === 'dark' ? '.ac-dark' : '.ac-light');
        await d.close();
        const m = await openDesign(browser, 'p11/Main.dc.html', 1440, theme);
        out[`design_main_${theme}`] = await computedVars(m, ['--node', '--nodeStroke', '--edge', '--d3', '--blastBg', '--glow', '--grid'], theme === 'dark' ? '.ac-dark' : '.ac-light');
        await m.close();
    }
    return out;
}

export const PROBES: Record<string, (b: Browser, built: Built) => Promise<unknown>> = { tokens: probeTokens };

if (process.argv[1] && /map_fidelity_probe\.ts$/.test(process.argv[1])) {
    const [name, out] = process.argv.slice(2);
    const run = name ? PROBES[name] : undefined;
    if (!run || !out) {
        process.stderr.write(`usage: map_fidelity_probe.ts <${Object.keys(PROBES).join('|')}> <out.json>\n`);
        process.exit(2);
    }
    void (async () => {
        const built = await buildPages();
        const browser = await launch();
        try {
            fs.writeFileSync(out, JSON.stringify(await run(browser, built), null, 1));
        } finally {
            await browser.close();
        }
    })();
}
