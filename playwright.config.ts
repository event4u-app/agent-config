/**
 * Playwright config — road-to-global-only-install Phase 0.2 + 1.8.
 *
 * The specs under `tests/e2e/` boot the relevant server in-process via
 * Playwright's `request` fixture (no browser binaries required). Each spec
 * is responsible for spawning its own fixture and tearing it down — there
 * is intentionally no `webServer` block so the harness stays additive and
 * cannot collide with the maintainer's local dev server.
 *
 * The dry-run invariant is asserted by snapshotting the writeRoot before
 * and after the apply call. No real filesystem mutation is allowed.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.ts',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? [['line'], ['github']] : 'list',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    use: {
        baseURL: 'http://127.0.0.1:0',
        trace: 'off',
    },
});
