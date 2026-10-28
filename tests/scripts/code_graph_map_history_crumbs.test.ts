import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';

// The shared Verlauf component of the map-views handover (step 1.3): a stack of
// up to 50 page states, a trail with `›` between its steps, and a 24px ← that
// exists only while there is history. Driven on a real map page through the
// `window.__mapPageHistory` seam, with a state object standing in for a page.

let browser: Browser;
let html: string;
let root: string;

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-hist-')));
    fs.mkdirSync(path.join(root, 'agents'));
    fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\n');
    html = path.join((await buildMap(root, {})).outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

interface Harness { stack: number; state: { lens: string; sel: string; limit: number }; back: boolean; steps: string[]; seps: number; current: string | null }

/** A page standing in for Systeme: state, a host, and a redraw after every apply. */
async function harness(skipPush = false): Promise<Page> {
    const page = await browser.newPage({ locale: 'de-DE', colorScheme: 'dark' });
    await page.goto(pathToFileURL(html).href + '#/overview');
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    await page.evaluate((skip) => {
        const w = window as unknown as Record<string, unknown>;
        const make = w['__mapPageHistory'] as (o: object) => { stack: unknown[]; push: () => void; nav: (f: () => void) => void; back: () => void; node: () => HTMLElement };
        const host = document.createElement('div');
        host.id = 'hist-host';
        document.body.prepend(host);
        const st = { lens: 'overview', sel: '', limit: 60 };
        const draw = () => { host.replaceChildren(h.node()); };
        const h = make({
            snap: () => ({ ...st }),
            apply: (s: typeof st) => { Object.assign(st, s); draw(); },
            key: (s: typeof st) => (s.lens === 'deps' ? s.sel : s.lens),
        });
        if (skip) h.push = () => undefined;
        w['__h'] = h;
        w['__st'] = st;
        w['__go'] = (patch: Partial<typeof st>) => { h.nav(() => Object.assign(st, patch)); draw(); };
        draw();
    }, skipPush);
    return page;
}
async function read(page: Page): Promise<Harness> {
    return page.evaluate(() => {
        const w = window as unknown as { __h: { stack: unknown[] }; __st: Harness['state'] };
        const nav = document.querySelector('#hist-host nav')!;
        return {
            stack: w.__h.stack.length,
            state: { ...w.__st },
            back: !!nav.querySelector('.hist-back'),
            steps: Array.from(nav.querySelectorAll('.hist-step')).map((b) => b.textContent ?? ''),
            seps: nav.querySelectorAll('.hist-sep').length,
            current: nav.querySelector('[aria-current="page"]')?.textContent ?? null,
        };
    });
}
const go = (page: Page, patch: object) => page.evaluate((p) => (window as unknown as { __go: (p: object) => void }).__go(p), patch);

describe('the Verlauf crumbs', () => {
    it('show no ← without history, then a trail with › between steps and the current one marked', async () => {
        const page = await harness();
        let h = await read(page);
        expect(h).toMatchObject({ stack: 0, back: false, steps: ['overview'], seps: 0, current: 'overview' });
        expect(await page.locator('#hist-host nav').getAttribute('aria-label')).toBe('Verlauf');
        await go(page, { lens: 'pk' });
        await go(page, { lens: 'deps', sel: 'fastify@5.12.7' });
        h = await read(page);
        expect(h).toMatchObject({ stack: 2, back: true, steps: ['overview', 'pk', 'fastify@5.12.7'], seps: 2, current: 'fastify@5.12.7' });
        const back = page.locator('#hist-host .hist-back');
        expect(await back.getAttribute('aria-label')).toBe('Zurück');
        expect(await back.evaluate((e) => [getComputedStyle(e).width, getComputedStyle(e).height].join('×'))).toBe('24px×24px');
        expect(await page.locator('#hist-host nav button').filter({ hasText: /^(Zurück|Back)$/ }).count()).toBe(0);
        await page.close();
    });

    it('← restores the previous state exactly, a trail step restores its own and drops what came after', async () => {
        const page = await harness();
        await go(page, { lens: 'pk', limit: 120 });
        await go(page, { lens: 'deps', sel: 'a@1' });
        await go(page, { sel: 'b@2' });
        await page.locator('#hist-host .hist-back').click();
        expect((await read(page)).state).toEqual({ lens: 'deps', sel: 'a@1', limit: 120 });
        await page.locator('#hist-host .hist-step', { hasText: /^overview$/ }).click();
        const h = await read(page);
        expect(h.state).toEqual({ lens: 'overview', sel: '', limit: 60 });
        expect(h).toMatchObject({ stack: 0, back: false });
        await page.close();
    });

    it('keeps at most 50 states, shows the last five steps, and folds repeated steps into one', async () => {
        const page = await harness();
        for (let i = 0; i < 60; i++) await go(page, { lens: 'deps', sel: `p${i}` });
        let h = await read(page);
        expect(h.stack).toBe(50);
        expect(h.steps).toEqual(['p55', 'p56', 'p57', 'p58', 'p59']);
        await page.close();
        const same = await harness();
        await go(same, { limit: 120 });
        await go(same, { limit: 180 });
        h = await read(same);
        expect(h).toMatchObject({ stack: 2, steps: ['overview'] });
        await same.close();
    });

    it('sensitivity: with the push neutralised, ← never appears and nothing can be restored', async () => {
        const page = await harness(true);
        await go(page, { lens: 'pk' });
        await go(page, { lens: 'deps', sel: 'a@1' });
        const h = await read(page);
        expect(h.back).toBe(false);
        expect(h.stack).toBe(0);
        expect(h.steps).toEqual(['a@1']);
        await page.close();
    });
});
