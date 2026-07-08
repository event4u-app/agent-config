/**
 * Browser E2E for the upgrade-time settings review
 * (road-to-settings-change-review).
 *
 * Seeds a pending `state/settings-delta.json` (as the installer writes it
 * on upgrade) plus a settings file whose stored value is invalid under
 * the new surface, then drives real Chromium through the full flow:
 * pending banner on the hub → review page groups → must-fix blocks save
 * → resolve → apply writes the settings + clears the flag → banner gone.
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * The delta an upgrade would have produced:
 *   - personal.autonomy lost the 'on' option → the stored value ('on')
 *     is invalid → Must fix.
 *   - rule_loading_tier default changed balanced → full and the user
 *     never customized → adopt preselected.
 *   - discipline_profile is new with a default → info.
 * Replacement values are drawn from the REAL schema enums so the final
 * PUT validates.
 */
function fixtureDelta(): object {
    return {
        oldVersion: '8.3.0',
        newVersion: '8.4.0',
        changes: [
            {
                key: 'personal.autonomy',
                kind: 'enum_removed',
                old: { type: 'string', default: 'auto', enum: ['on', 'off', 'auto'] },
                new: { type: 'string', default: 'auto', enum: ['off', 'auto'], description: 'Autonomy mode.' },
                values: ['on'],
            },
            {
                key: 'rule_loading_tier',
                kind: 'default_changed',
                old: { type: 'string', default: 'balanced', enum: ['minimal', 'balanced', 'full', 'custom'] },
                new: { type: 'string', default: 'full', enum: ['minimal', 'balanced', 'full', 'custom'] },
            },
            {
                key: 'discipline_profile',
                kind: 'added',
                new: { type: 'string', default: 'auto', enum: ['auto', 'off', 'essential', 'full'], description: 'The ONE runtime discipline knob.' },
            },
        ],
    };
}

let tmpRoot: string;
let baseURL: string;
let shutdown: () => Promise<void>;

test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'settings-changes-browser-'));
    mkdirSync(join(tmpRoot, 'settings'), { recursive: true });
    mkdirSync(join(tmpRoot, 'state'), { recursive: true });
    // autonomy=on: invalid under the delta's new surface (must-fix);
    // rule_loading_tier=balanced == old default (adopt preselected).
    writeFileSync(
        join(tmpRoot, 'settings', '.agent-settings.yml'),
        'rule_loading_tier: balanced\npersonal:\n  autonomy: "on"\n',
        { mode: 0o600 },
    );
    writeFileSync(join(tmpRoot, 'state', 'settings-delta.json'), JSON.stringify(fixtureDelta(), null, 2));

    const port = await findFreePort();
    // Real writes (dryRun: false) — everything stays inside the temp root.
    const app = await createApp({
        writeRoot: tmpRoot,
        packageRoot: REPO_ROOT,
        projectRoot: tmpRoot,
        dryRun: false,
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

test.describe('settings changes review — browser', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('banner → review → must-fix gate → apply → resolved', async ({ page }, testInfo) => {
        // 1. Hub shows the pending banner.
        await page.goto(`${baseURL}/?token=test-token#/settings`);
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
        const bannerButton = page.getByRole('button', { name: 'Review changes' });
        await expect(bannerButton).toBeVisible();
        await expect(page.getByText(/An upgrade changed 3 settings/)).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('01-hub-pending-banner.png'), fullPage: true });

        // 2. Banner navigates to the review page — groups render.
        await bannerButton.click();
        await expect(page.getByRole('heading', { name: 'Settings changes' })).toBeVisible();
        await expect(page.getByText(/8\.3\.0/).first()).toBeVisible();
        await expect(page.getByRole('heading', { name: /Must fix/ })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Changed defaults/ })).toBeVisible();
        await expect(page.getByRole('heading', { name: /New settings/ })).toBeVisible();
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath('02-review-page.png'), fullPage: true });

        // Must-fix card explains the invalid value.
        const mustFixCard = page.locator('.ac-change-card--must_fix');
        await expect(mustFixCard).toHaveCount(1);
        await expect(mustFixCard.getByText(/no longer valid/)).toBeVisible();

        // Adopt card is preselected to the new default.
        const adoptCard = page.locator('.ac-change-card[data-key="rule_loading_tier"]');
        await expect(adoptCard.getByRole('radio').first()).toBeChecked();

        // 3. Save is blocked while the must-fix item is unresolved.
        const applyButton = page.getByRole('button', { name: 'Apply & finish review' });
        await expect(applyButton).toBeDisabled();

        // Resolve: pick a replacement from the NEW enum.
        await mustFixCard.getByRole('combobox').selectOption('off');
        await expect(applyButton).toBeEnabled();

        // 4. Apply — settings written, delta acknowledged.
        await applyButton.click();
        await expect(page.getByText('Review complete — all changes resolved.')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('03-review-done.png'), fullPage: true });

        const settingsBody = readFileSync(join(tmpRoot, 'settings', '.agent-settings.yml'), 'utf8');
        expect(settingsBody).toMatch(/autonomy:\s*['"]?off['"]?/);
        expect(settingsBody).toMatch(/rule_loading_tier:\s*['"]?full['"]?/);
        expect(existsSync(join(tmpRoot, 'state', 'settings-delta.json'))).toBe(false);

        // 5. Banner is gone; direct visit reports nothing pending.
        await page.goto(`${baseURL}/?token=test-token#/settings`);
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Review changes' })).toHaveCount(0);
        await page.goto(`${baseURL}/?token=test-token#/settings/changes`);
        await expect(page.getByText('Nothing to review — your settings are up to date.')).toBeVisible();
    });
});
