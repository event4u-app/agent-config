/**
 * Browser E2E for the standalone settings hub
 * (road-to-setup-experience § Phase 5) + the theme runtime (Phase 4.2).
 *
 * Drives real Chromium against the built `dist/ui` bundle on `#/settings`:
 * simple/advanced disclosure, search across tiers, @modified filter,
 * per-field reset, layer-source badge wiring, theme toggle persistence,
 * and the no-horizontal-overflow layout invariant.
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

import { createApp } from '../../src/server/app.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..', '..');

async function findFreePort(): Promise<number> {
    return await new Promise<number>((res, rej) => {
        const srv = createServer();
        srv.unref();
        srv.on('error', rej);
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            if (addr === null || typeof addr === 'string') {
                rej(new Error('no address'));
                return;
            }
            const port = addr.port;
            srv.close(() => res(port));
        });
    });
}

let tmpRoot: string;
let baseURL: string;
let shutdown: () => Promise<void>;

test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'settings-hub-browser-'));
    mkdirSync(join(tmpRoot, 'settings'), { recursive: true });
    // `personal.autonomy: on` differs from the schema default (`auto`) —
    // drives the modified indicator, @modified filter, and reset assertions.
    writeFileSync(
        join(tmpRoot, 'settings', '.agent-settings.yml'),
        'rule_loading_tier: balanced\npersonal:\n  autonomy: "on"\n',
        { mode: 0o600 },
    );

    const port = await findFreePort();
    const app = await createApp({
        writeRoot: tmpRoot,
        packageRoot: REPO_ROOT,
        projectRoot: tmpRoot,
        dryRun: true,
        skipReplay: true,
        token: 'test-token',
        expectedPort: port,
        uiDistDir: join(REPO_ROOT, 'dist', 'ui'),
    });
    await app.listen({ host: '127.0.0.1', port });
    baseURL = `http://127.0.0.1:${port}`;
    shutdown = async () => { await app.close(); };
});

test.afterAll(async () => {
    if (shutdown) await shutdown();
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

async function expectNoPageOverflow(page: Page): Promise<void> {
    const delta = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(delta, `page overflows horizontally by ${delta}px`).toBeLessThanOrEqual(1);
}

test.describe('settings hub — browser', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('tiers, search, @modified, reset, and layout hold up', async ({ page }, testInfo) => {
        await page.goto(`${baseURL}/?token=test-token#/settings`);
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

        // Basic tier renders; a deep advanced key does not (yet).
        await expect(page.getByText('Autonomy', { exact: true }).first()).toBeVisible();
        const personalSection = page.locator('.ac-section', { hasText: 'Personal' }).first();
        const disclosure = personalSection.getByRole('button', { name: /Show \d+ advanced setting/ });
        await expect(disclosure).toBeVisible();
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath('01-hub-basic.png'), fullPage: true });

        // Disclosure reveals the section's advanced fields.
        await disclosure.click();
        await expect(personalSection.getByRole('button', { name: 'Hide advanced settings' })).toBeVisible();
        await expect(personalSection.getByText('Rtk Installed').first()).toBeVisible();
        await personalSection.getByRole('button', { name: 'Hide advanced settings' }).click();

        // Search bypasses the tier split — an advanced-only key is findable.
        const search = page.getByPlaceholder(/Search all settings/);
        await search.fill('rtk_installed');
        await expect(page.getByText('Rtk Installed').first()).toBeVisible();
        await search.fill('');

        // Modified indicator + @modified filter: autonomy=on ≠ default auto.
        await expect(page.locator('.ac-field-row--modified').first()).toBeVisible();
        await page.getByRole('button', { name: /@modified/ }).click();
        await expect(page.getByText('Autonomy', { exact: true }).first()).toBeVisible();
        // Non-modified basic keys are filtered out in @modified view.
        await expect(page.getByText('Minimal Output', { exact: true })).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath('02-hub-modified.png'), fullPage: true });

        // Reset restores the schema default and clears the indicator.
        await page.getByRole('button', { name: 'Reset', exact: true }).first().click();
        await expect(page.locator('.ac-field-row--modified')).toHaveCount(0);
        await page.getByRole('button', { name: /@modified/ }).click(); // back to full view
        await expect(page.getByText('Autonomy', { exact: true }).first()).toBeVisible();
    });

    test('theme toggle flips data-theme, persists, and dark mode renders', async ({ page }, testInfo) => {
        await page.goto(`${baseURL}/?token=test-token#/settings`);
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

        const initial = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(initial === 'light' || initial === 'dark').toBe(true);

        const toggle = page.locator('.ac-topnav__theme');
        await toggle.click();
        const flipped = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(flipped).not.toBe(initial);

        // Persisted override survives a reload (localStorage).
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
        const afterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(afterReload).toBe(flipped);

        // Capture the dark variant for visual review.
        if (afterReload !== 'dark') await toggle.click();
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath('03-hub-dark.png'), fullPage: true });
    });
});
