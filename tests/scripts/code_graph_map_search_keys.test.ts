import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { sampleAreas } from './code_graph_map_areas_fixture.js';

// The header search is a combobox: the arrow keys move one active row, Enter
// opens it, → steps into a hit that holds others and ← / Backspace on an empty
// query step back out — while the caret is inside the text, ← and → edit text.

let browser: Browser;
let html: string;
let root: string;

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-searchkeys-')));
    fs.mkdirSync(path.join(root, 'agents'));
    const put = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    };
    put('src/shop/cart.ts', 'export function addItem() { return 1; }\nexport function removeItem() { return 2; }\n');
    put('src/shop/pay/charge.ts', "import { addItem } from '../cart';\nexport const charge = () => addItem();\n");
    put('src/shop/pay/refund.ts', "import { charge } from './charge';\nexport const refund = () => charge();\n");
    put('src/util/shopping_list.ts', "import { addItem } from '../shop/cart';\nexport const list = () => addItem();\n");
    const res = await buildMap(root, { areas: sampleAreas() });
    html = path.join(res.outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

async function open(width = 1440): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, locale: 'en-US' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + '#/code');
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}
const rows = (page: Page) => page.locator('#results [role="option"] button').allTextContents();
const active = (page: Page) => page.evaluate(() => {
    const id = document.getElementById('search')!.getAttribute('aria-activedescendant');
    return id ? (document.getElementById(id)!.querySelector('button')!.textContent ?? '') : null;
});
async function activate(page: Page, text: string): Promise<void> {
    const list = await rows(page);
    const i = list.indexOf(text);
    expect(i, `${text} in ${list.join(' | ')}`).toBeGreaterThanOrEqual(0);
    for (let k = 0; k <= i; k++) await page.keyboard.press('ArrowDown');
    expect(await active(page)).toBe(text);
}

describe('the search list as a combobox', () => {
    it('↓↓ Enter opens the second hit, and the active row is the one aria-activedescendant names', async () => {
        const { page, errors } = await open();
        await page.fill('#search', 'shop');
        expect(await page.getAttribute('#search', 'role')).toBe('combobox');
        expect(await page.getAttribute('#search', 'aria-expanded')).toBe('true');
        expect(await page.getAttribute('#results', 'role')).toBe('listbox');
        expect(await active(page)).toBeNull();
        const list = await rows(page);
        await page.keyboard.press('ArrowDown');
        expect(await active(page)).toBe(list[0]);
        await page.keyboard.press('ArrowDown');
        expect(await active(page)).toBe(list[1]);
        expect(await page.locator('#results [aria-selected="true"]').count()).toBe(1);
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        expect(await active(page)).toBe(list[list.length - 1]);
        await page.keyboard.press('Home');
        expect(await active(page)).toBe(list[0]);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        expect(await page.locator('#pop').isHidden()).toBe(true);
        expect(await page.inputValue('#search')).toBe('');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('→ on a folder lists its children under a breadcrumb; ← and Backspace on an empty query step back', async () => {
        const { page } = await open();
        await page.fill('#search', 'shop');
        await activate(page, 'src/shop/');
        await page.keyboard.press('ArrowRight');
        expect(await page.locator('#searchcrumb').isVisible()).toBe(true);
        expect(await page.locator('#searchcrumb').textContent()).toContain('shop ›');
        expect(await rows(page)).toEqual(['pay/', 'cart.ts']);
        expect(await page.inputValue('#search')).toBe('');
        expect(await page.locator('#search-live').textContent()).toMatch(/2 hits in shop/);
        // A folder holds others: it shows a count and the step-in mark; a file of a folder does too, by its symbols.
        expect(await page.locator('#results [role="option"].holds').count()).toBe(2);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        expect(await page.locator('#searchcrumb').textContent()).toContain('shop › pay ›');
        expect(await rows(page)).toEqual(['charge.ts', 'refund.ts']);
        await page.keyboard.press('Backspace');
        expect(await rows(page)).toEqual(['pay/', 'cart.ts']);
        expect(await active(page)).toBe('pay/');
        await page.keyboard.press('ArrowLeft');
        expect(await page.locator('#searchcrumb').isVisible()).toBe(false);
        expect(await page.inputValue('#search')).toBe('shop');
        expect(await active(page)).toBe('src/shop/');
        await page.close();
    });

    it('typing inside a container filters within it; kind presets still apply', async () => {
        const { page } = await open();
        await page.fill('#search', 'shop');
        await activate(page, 'src/shop/');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.type('car');
        expect(await rows(page)).toEqual(['cart.ts']);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        expect(await rows(page)).toEqual(expect.arrayContaining([expect.stringMatching(/^addItem — L\d+$/), expect.stringMatching(/^removeItem — L\d+$/)]));
        await page.close();
    });

    it('with the caret inside the text, ← and → edit it and never step', async () => {
        const { page } = await open();
        await page.fill('#search', 'shop');
        await activate(page, 'src/shop/');
        await page.evaluate(() => (document.getElementById('search') as HTMLInputElement).setSelectionRange(2, 2));
        await page.keyboard.press('ArrowRight');
        expect(await page.locator('#searchcrumb').isVisible()).toBe(false);
        expect(await page.evaluate(() => (document.getElementById('search') as HTMLInputElement).selectionStart)).toBe(3);
        await page.keyboard.press('End');
        await page.fill('#search', 'shop');
        await activate(page, 'src/shop/');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.type('ca');
        await page.keyboard.press('ArrowLeft');
        expect(await page.locator('#searchcrumb').isVisible()).toBe(true);
        expect(await page.inputValue('#search')).toBe('ca');
        await page.close();
    });

    it('an area item holds its parts: a service lists its operations', async () => {
        const { page } = await open();
        await page.fill('#search', 'partner');
        await activate(page, 'Interfaces · partner');
        await page.keyboard.press('ArrowRight');
        expect(await rows(page)).toEqual(['partner · GetStock']);
        await page.close();
    });

    it('Esc closes the list, a second Esc clears the query; / focuses the field', async () => {
        const { page } = await open();
        await page.locator('body').click({ position: { x: 5, y: 600 } });
        await page.keyboard.press('/');
        expect(await page.evaluate(() => document.activeElement?.id)).toBe('search');
        await page.keyboard.type('shop');
        expect(await page.locator('#pop').isVisible()).toBe(true);
        await page.keyboard.press('Escape');
        expect(await page.locator('#pop').isHidden()).toBe(true);
        expect(await page.getAttribute('#search', 'aria-expanded')).toBe('false');
        expect(await page.inputValue('#search')).toBe('shop');
        await page.keyboard.press('Escape');
        expect(await page.inputValue('#search')).toBe('');
        await page.close();
    });

    it('the pointer moves the same active row the keys do', async () => {
        const { page } = await open();
        await page.fill('#search', 'shop');
        const list = await rows(page);
        await page.locator('#results [role="option"]').nth(2).hover();
        expect(await active(page)).toBe(list[2]);
        await page.keyboard.press('ArrowDown');
        expect(await active(page)).toBe(list[3 % list.length]);
        await page.close();
    });
});
