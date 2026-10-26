import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';

// Domains on the page: the lens colours by the declared domain, the Domains
// card names the breach against domain_allow, the file panel carries the domain
// chip, and the search finds a domain with its files one level down.

let browser: Browser;
let root: string;
let html: string;

async function open(hash: string): Promise<{ page: Page; errors: string[] }> {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return { page, errors };
}

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-dompage-')));
    const w = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    };
    w('package.json', '{"name":"shop"}');
    w('src/orders/order.ts', "import { invoice } from '../billing/invoice';\nexport const order = invoice;\n");
    w('src/billing/invoice.ts', 'export const invoice = 1;\n');
    w('src/billing/ledger.ts', "import { order } from '../orders/order';\nexport const ledger = order;\n");
    w('agents/map/layers.yaml', 'domains:\n  - name: Orders\n    paths: ["src/orders/**"]\n  - name: Billing\n    paths: ["src/billing/**"]\ndomain_allow:\n  Billing: [Orders]\n');
    html = path.join((await buildMap(root, {})).outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

describe('domains on the map', () => {
    it('the Domain lens is enabled and its legend names the declared domains', async () => {
        const { page, errors } = await open('#/code');
        const lens = page.locator('#colorby [role="radio"]', { hasText: 'Domain' });
        expect(await lens.isDisabled()).toBe(false);
        await lens.click();
        expect(await page.locator('#colorby [role="radio"][aria-checked="true"]').textContent()).toBe('Domain');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('the Domains card names the breach against domain_allow', async () => {
        const { page, errors } = await open('#/code');
        await page.locator('#tabs [role="tab"]').nth(1).click();
        const card = page.locator('#panel .card', { hasText: 'Domains' }).first();
        expect(await card.textContent()).toMatch(/Domains[\s\S]*declared in layers\.yaml[\s\S]*Orders[\s\S]*Billing[\s\S]*not allowed · Orders → Billing/);
        expect(errors).toEqual([]);
        await page.close();
    });

    it('the search finds a domain with its files', async () => {
        const { page, errors } = await open('#/code');
        await page.fill('#search', 'billing');
        const row = page.locator('#results [role="option"]', { hasText: 'Domain · Billing' });
        expect(await row.textContent()).toMatch(/Domain · Billing — 2 files/);
        await row.locator('.schev').click();
        expect((await page.locator('#results [role="option"] button').allTextContents()).sort()).toEqual(['src/billing/invoice.ts', 'src/billing/ledger.ts']);
        await page.keyboard.press('Enter');
        expect(errors).toEqual([]);
        await page.close();
    });
});
