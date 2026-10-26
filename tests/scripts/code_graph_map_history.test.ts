import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { writeProvenanceFixture } from './code_graph/provenance_fixture.js';

// History on the page, drawn from a real repository: the file panel names the
// commit, PR and ticket that introduced the file and its routes, and the search
// finds a ticket key with what it introduced one level down.

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
    root = writeProvenanceFixture();
    fs.mkdirSync(path.join(root, 'agents'));
    html = path.join((await buildMap(root, {})).outDir, 'index.html');
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    fs.rmSync(root, { recursive: true, force: true });
});

describe('history on the map', () => {
    it('the file panel shows when the file came in, its last change and the routes declared in it', async () => {
        const { page, errors } = await open('#/code');
        await page.fill('#search', 'app.js');
        await page.locator('#results [role="option"]', { hasText: 'src/app.js' }).first().click();
        const panel = (await page.locator('.hist').first().textContent()) ?? '';
        expect(panel).toMatch(/introduced[\s\S]*chore: init/);
        expect(panel).toMatch(/last changed[\s\S]*#7[\s\S]*ABC-12/);
        expect(panel).toMatch(/Routes declared here \(1\)[\s\S]*POST \/orders[\s\S]*#7/);
        expect(panel).toContain('Ticket and PR text stays in its tracker');
        expect(errors).toEqual([]);
        await page.close();
    });

    it('a ticket key in the search lists what it introduced', async () => {
        const { page, errors } = await open('#/code');
        await page.fill('#search', 'abc-12');
        const row = page.locator('#results [role="option"]', { hasText: 'Ticket · ABC-12' });
        expect(await row.textContent()).toMatch(/Ticket · ABC-12 — 1 file · 1 route/);
        await row.locator('.schev').click();
        const kids = await page.locator('#results [role="option"] button').allTextContents();
        expect(kids).toEqual(['database/migrations/2026_10_01_000000_create_orders_table.php', '↳ POST /orders']);
        expect(errors).toEqual([]);
        await page.close();
    });
});
