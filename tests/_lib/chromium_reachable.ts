/**
 * Whether a browser suite may run here.
 *
 * The font-witness suites of `road-to-type-with-a-witness` run in the
 * `svg-witness-tests` job, which installs Chromium and sets
 * `AGENT_CONFIG_BROWSER_SUITES=1`; there they reach the runner through an
 * import in `ui_render_asset_profile.test.ts`. On a sharded runner without the
 * binary they would fail on `Executable doesn't exist` rather than on anything
 * they assert, so they stand down there — and ONLY there: with the job's flag
 * set, a missing binary is a failure, never a skip.
 */

import * as fs from 'node:fs';

import { chromium } from '@playwright/test';

export function chromiumReachable(): boolean {
    if (process.env['AGENT_CONFIG_BROWSER_SUITES'] === '1') return true;
    try {
        return fs.existsSync(chromium.executablePath());
    } catch {
        return false;
    }
}
