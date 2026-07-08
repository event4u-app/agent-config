/**
 * Browser E2E for the install-wizard UI (road-to-setup-experience).
 *
 * Unlike the request-fixture specs, this drives REAL Chromium against the
 * built `dist/ui` bundle: start screen → customize walk → review, asserting
 * layout invariants (no horizontal overflow anywhere — the review-summary
 * chip run regressed exactly this way) plus the Phase 2/3 feature surface
 * (installed-pack badges, removal confirm, finish checklist).
 *
 * Prereqs: `npm run build:ui` (the server serves dist/ui verbatim) and the
 * Playwright chromium binary. Dry-run — zero writes under the temp root.
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

import { createApp } from '../../src/server/app.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..', '..');

/** Every tool id the wizard knows — mirrors VALID_TOOLS in src/ui/wizard/state.ts. */
const ALL_TOOL_IDS = [
    'claude-code', 'claude-desktop', 'cursor', 'windsurf', 'cline', 'gemini-cli',
    'copilot', 'augment', 'aider', 'codex', 'roocode', 'continue', 'kilocode',
    'zed', 'jetbrains', 'kiro', 'qoder', 'opencode', 'trae', 'antigravity',
    'codebuddy', 'droid', 'warp',
];

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
let savedWizardTools: string | undefined;

test.beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'wizard-browser-'));
    // Seed a settings file carrying an installed-packs manifest so the
    // packs step renders "installed" badges and the review can flag
    // removals (Phase 2).
    mkdirSync(join(tmpRoot, 'settings'), { recursive: true });
    writeFileSync(
        join(tmpRoot, 'settings', '.agent-settings.yml'),
        'rule_loading_tier: balanced\npacks:\n  - git\n  - php\n',
        { mode: 0o600 },
    );
    // Prior tool selection (wizard-tools lockfile) — the ai-tools step
    // pre-selects exactly these on a repeat run. ALL tools reproduces the
    // reported review-summary chip overflow.
    const lockfile = join(tmpRoot, 'wizard-tools.json');
    writeFileSync(lockfile, JSON.stringify({ tools: ALL_TOOL_IDS }), { mode: 0o600 });
    savedWizardTools = process.env['AGENT_CONFIG_WIZARD_TOOLS'];
    process.env['AGENT_CONFIG_WIZARD_TOOLS'] = lockfile;

    const port = await findFreePort();
    const app = await createApp({
        writeRoot: tmpRoot,
        packageRoot: REPO_ROOT,
        projectRoot: tmpRoot,
        dryRun: true,
        skipReplay: true,
        extendedSteps: true,
        wizardMode: 'install',
        initialStep: 0,
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
    if (savedWizardTools === undefined) delete process.env['AGENT_CONFIG_WIZARD_TOOLS'];
    else process.env['AGENT_CONFIG_WIZARD_TOOLS'] = savedWizardTools;
});

/**
 * Layout invariant: neither the page nor the given element scrolls
 * horizontally. scrollWidth may exceed clientWidth by ≤1px from rounding.
 */
async function expectNoHorizontalOverflow(page: Page, selector: string): Promise<void> {
    const delta = await page.locator(selector).first().evaluate(
        (el) => el.scrollWidth - el.clientWidth,
    );
    expect(delta, `${selector} overflows horizontally by ${delta}px`).toBeLessThanOrEqual(1);
}

async function expectNoPageOverflow(page: Page): Promise<void> {
    const delta = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(delta, `page overflows horizontally by ${delta}px`).toBeLessThanOrEqual(1);
}

async function clickNext(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
}

/** Recursive file listing — the dry-run zero-writes invariant. */
function snapshotDir(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string, prefix: string): void => {
        let entries: string[] = [];
        try { entries = readdirSync(dir); } catch { return; }
        for (const e of entries) {
            const full = join(dir, e);
            const rel = prefix ? `${prefix}/${e}` : e;
            try {
                if (statSync(full).isDirectory()) walk(full, rel);
                else out.push(rel);
            } catch { /* race-safe */ }
        }
    };
    walk(root, '');
    return out.sort();
}

test.describe('install wizard — browser walk', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('start screen → customize walk → review has no layout overflow', async ({ page }, testInfo) => {
        test.setTimeout(120_000); // full walk + dry-run installer preview
        const writeRootBefore = snapshotDir(tmpRoot);
        await page.goto(`${baseURL}/?token=test-token#/wizard`);

        // ---- Start screen (Phase 3.2) ----
        await expect(page.getByRole('heading', { name: 'Recommended setup' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Customize' })).toBeVisible();
        // Detection facts resolve; the CTA enables once probes land.
        const recommendedCta = page.getByRole('button', { name: /Use recommended setup|Detecting…/ });
        await expect(recommendedCta).toBeVisible();
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath('01-start-screen.png'), fullPage: true });

        await page.getByRole('button', { name: 'Customize step by step' }).click();

        // ---- Welcome ----
        await expect(page.getByRole('heading', { name: /Welcome — who are you\?/ })).toBeVisible();
        await clickNext(page);

        // ---- Profile / experience ----
        await expect(page.getByRole('heading', { name: 'Which experience?' })).toBeVisible();
        await clickNext(page);

        // ---- AI tools — the lockfile pre-selects ALL tools (repeat run) ----
        await expect(page.getByRole('heading', { name: /Which AI tools do you use\?/ })).toBeVisible();
        const checkedTools = page.locator('.ac-wizard__tool-row input:checked');
        await expect(checkedTools).toHaveCount(ALL_TOOL_IDS.length);
        await expectNoPageOverflow(page);
        await clickNext(page);

        // ---- Roles — pick the first workspace ----
        await expect(page.getByRole('heading', { name: /What do you work on\?/ })).toBeVisible();
        await page.locator('.ac-pack-tile input[type="checkbox"]').first().check();
        await clickNext(page);

        // ---- Packs — installed packs (git, php) pre-checked with badges ----
        await expect(page.getByRole('heading', { name: /Which capability packs/ })).toBeVisible();
        await expect(page.locator('.ac-badge--installed').first()).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('02-packs-step.png'), fullPage: true });
        await clickNext(page);

        // ---- Legal consent ----
        await expect(page.getByRole('heading', { name: /Legal review-prep/ })).toBeVisible();
        await clickNext(page);

        // ---- Install→setup handoff (install mode) — Next reveals the form ----
        await clickNext(page);

        // ---- Editor & behaviour (merged identity+personality, Phase 3.1) ----
        await expect(page.getByRole('heading', { name: /Editor & behaviour/ })).toBeVisible();
        await expectNoPageOverflow(page);
        await clickNext(page);

        // ---- Budgets, rules & cadence (merged cost step) ----
        await expect(page.getByRole('heading', { name: /Budgets, rules & cadence/ })).toBeVisible();
        await clickNext(page);

        // ---- User profile — skip ----
        await page.getByRole('button', { name: 'Skip', exact: true }).click();

        // ---- Review ----
        await expect(page.getByRole('heading', { name: /Review & finish/ })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'What happens on Finish' })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('03-review.png'), fullPage: true });

        // The regression: 23 tool chips rendered as one unbreakable inline
        // run overflowed the summary box. The box AND the page must not
        // scroll horizontally, and every chip must sit inside the box.
        await expectNoHorizontalOverflow(page, '.ac-review-summary');
        await expectNoPageOverflow(page);
        const summaryBox = await page.locator('.ac-review-summary').boundingBox();
        const lastChip = await page.locator('.ac-review-summary__chip').last().boundingBox();
        expect(summaryBox).not.toBeNull();
        expect(lastChip).not.toBeNull();
        expect(lastChip!.x + lastChip!.width).toBeLessThanOrEqual(summaryBox!.x + summaryBox!.width + 1);

        // All selected tools appear as chips.
        await expect(page.locator('.ac-review-summary__chip')).toHaveCount(ALL_TOOL_IDS.length);

        // ---- Phase 2: uncheck an installed pack → flagged removal ----
        await page.getByRole('button', { name: /Packs/ }).click();
        await expect(page.getByRole('heading', { name: /Which capability packs/ })).toBeVisible();
        // `git` is in the installed manifest — uncheck its tile.
        const gitTile = page.locator('.ac-pack-tile', { hasText: 'Git' }).first();
        await gitTile.locator('input[type="checkbox"]').first().uncheck();
        // Walk forward to review (legal → handoff already acknowledged →
        // preferences → budgets → skip user profile).
        await clickNext(page); // → legal consent
        await clickNext(page); // → Editor & behaviour (handoff acked earlier)
        await clickNext(page); // → Budgets, rules & cadence
        await clickNext(page); // → user profile
        await page.getByRole('button', { name: 'Skip', exact: true }).click(); // → review

        const removals = page.locator('.ac-review-removals');
        await expect(removals).toBeVisible();
        await expect(removals).toContainText('git');
        await expectNoHorizontalOverflow(page, '.ac-review-removals');
        await page.screenshot({ path: testInfo.outputPath('04-review-removal.png'), fullPage: true });

        // Finish stays disabled until the removal is explicitly confirmed.
        const finish = page.getByRole('button', { name: /Finish & save/ });
        await expect(finish).toBeDisabled();
        await removals.locator('input[type="checkbox"]').check();
        await expect(finish).toBeEnabled();

        // ---- Phase 3.4: Finish (dry-run) lands on the checklist ----
        // The dry-run apply spawns the installer with --dry-run for the
        // preview — allow it a generous timeout (cold tsx boot).
        await finish.click();
        await expect(page.getByRole('heading', { name: 'Setup complete' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.ac-checklist__cmd', { hasText: 'agent-config doctor' })).toBeVisible();
        await expect(page.locator('.ac-checklist__cmd', { hasText: 'agent-config config' }).first()).toBeVisible();
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath('05-finish-checklist.png'), fullPage: true });

        // Dry-run hard floor: the whole walk (including Finish + the apply
        // preview) wrote NOTHING under the writeRoot. Before the server-side
        // `opts.dryRun` guard, Finish spawned the REAL installer here.
        expect(snapshotDir(tmpRoot)).toEqual(writeRootBefore);
    });
});
