import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';

// A control whose data is missing stays visible, says "no data" and names what is
// missing; the same control with data is an ordinary, working control.

let browser: Browser;
const roots: string[] = [];

async function mapOf(withGit: boolean): Promise<string> {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-nodata-')));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b', 'c', 'd']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const ${n} = a;\n`);
    if (withGit) {
        const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, stdio: 'ignore' }); };
        git('init', '-q');
        git('add', '.');
        git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init');
    }
    const res = await buildMap(root);
    return path.join(res.outDir, 'index.html');
}

async function open(html: string): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(`${pathToFileURL(html).href}#/code`);
    await page.waitForFunction(() => (window as unknown as { __mapView?: unknown }).__mapView !== undefined);
    return page;
}

beforeAll(async () => {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('controls without data are labelled, never hidden', () => {
    it('without git history "Churn" is visible, disabled, labelled and names what is missing', async () => {
        const page = await open(await mapOf(false));
        const churn = page.locator('#colorby button', { hasText: 'Churn' });
        expect(await churn.isVisible()).toBe(true);
        expect(await churn.isDisabled()).toBe(true);
        expect(await churn.textContent()).toMatch(/no data/i);
        expect(await churn.getAttribute('title')).toMatch(/no data yet.*git history/i);
        await page.close();
    });

    it('with git history "Churn" is an ordinary control', async () => {
        const page = await open(await mapOf(true));
        const churn = page.locator('#colorby button', { hasText: 'Churn' });
        expect(await churn.isDisabled()).toBe(false);
        expect(await churn.textContent()).not.toMatch(/no data/i);
        await page.close();
    });

    it('the Flow lens and the Memory column say what is missing instead of a bare "?"', async () => {
        const page = await open(await mapOf(false));
        const flow = page.locator('#lenses button', { hasText: 'Flow' });
        expect(await flow.isVisible()).toBe(true);
        expect(await flow.textContent()).toMatch(/no view yet/i);
        await page.click('#lenses button:has-text("Knowledge")');
        // Knowledge needs a file: mark one through search.
        await page.fill('#search', 'a.ts');
        await page.locator('#results button', { hasText: /^a\.ts$/ }).click();
        await page.click('#lenses button:has-text("Knowledge")');
        expect(await page.locator('#lensview').textContent()).toMatch(/Memory\s*no data/i);
        await page.close();
    });
});
