/**
 * The asset witness says which face painted — steps 1.1, 1.2 and 1.4 of
 * `road-to-type-with-a-witness`.
 *
 * Every face here is built in memory at test time (decision A7): no font file
 * is committed and nothing is downloaded. The faces are written to a temp
 * directory beside the SVG that declares them, or served through an
 * intercepted route where the test needs control over timing.
 *
 * A real Chromium is launched, so this file is a browser suite: it is
 * excluded from the sharded matrix in `vitest.config.ts` (run it locally with
 * `AGENT_CONFIG_BROWSER_SUITES=1`) and runs in the `svg-witness-tests` job, on
 * ubuntu and macOS, through the import at the foot of
 * `ui_render_asset_profile.test.ts`.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { chromium } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runUiRender } from '../../src/cli/commands/uiRender.js';
import type { RenderManifest } from '../../src/cli/commands/uiRender.js';
import { readFaceStates } from '../../src/cli/commands/uiRenderAssetFonts.js';
import { buildTestFace } from '../_lib/test_truetype_face.js';

const BROWSER_BUDGET_MS = 90_000;

let tmpRoot: string;
let browser: Browser;

function svgWith(fontFace: string, text: string): string {
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120" width="600" height="120">' +
        `<style>${fontFace}</style>${text}</svg>`
    );
}

const FACE_400 = '@font-face{font-family:"Witness Face";src:url(witness-400.ttf) format("truetype");font-weight:400}';

async function renderTexts(slug: string, svg: string): Promise<NonNullable<RenderManifest['asset']>> {
    const file = path.join(tmpRoot, `${slug}.svg`);
    fs.writeFileSync(file, svg);
    const code = await runUiRender({ target: file, projectRoot: tmpRoot, slug, profile: 'asset' });
    expect(code, `ui:render exited ${code} for ${slug}`).toBe(0);
    const manifestFile = path.join(tmpRoot, 'agents', 'runtime', 'state', 'render', slug, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as RenderManifest;
    expect(manifest.asset, 'the asset profile must produce an asset reading').toBeTruthy();
    return manifest.asset as NonNullable<RenderManifest['asset']>;
}

describe('ui:render --profile asset — the face that painted', () => {
    beforeAll(async () => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-render-font-state-'));
        fs.writeFileSync(path.join(tmpRoot, 'witness-400.ttf'), buildTestFace({ family: 'Witness Face', weight: 400 }));
        browser = await chromium.launch();
    });

    afterAll(async () => {
        await browser?.close();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it(
        'face-loaded-reads-loaded',
        async () => {
            const asset = await renderTexts(
                'face-loaded',
                svgWith(FACE_400, '<text x="10" y="80" font-family="Witness Face, monospace" font-size="48">Hamburg</text>'),
            );
            const t = asset.texts[0];
            expect(t?.face_family).toBe('Witness Face');
            expect(t?.face_state).toBe('loaded');
            expect(asset.findings.map((f) => f.rule)).not.toContain('geometry/font-face-error');
            expect(asset.findings.map((f) => f.rule)).not.toContain('geometry/font-synthesised');
        },
        BROWSER_BUDGET_MS,
    );

    it(
        'face-error-reads-error',
        async () => {
            // A 404: the file the @font-face names does not exist. The declared
            // family is still the FIRST family of the stack, which is exactly
            // what the page witness used to report as if it had painted.
            const asset = await renderTexts(
                'face-error',
                svgWith(
                    '@font-face{font-family:"Gone Face";src:url(gone-404.ttf) format("truetype")}',
                    '<text x="10" y="80" font-family="Gone Face, serif" font-size="48">Hamburg</text>',
                ),
            );
            const t = asset.texts[0];
            expect(t?.face_family).toBe('Gone Face');
            expect(t?.face_state).toBe('error');
            expect(asset.findings.map((f) => f.rule)).toContain('geometry/font-face-error');
        },
        BROWSER_BUDGET_MS,
    );

    it(
        'missing-weight-reads-synthesised',
        async () => {
            // 700 requested of a family whose only face is 400: the renderer
            // emboldens the 400 face, which is a faux bold, not the face.
            const asset = await renderTexts(
                'face-synthesised',
                svgWith(
                    FACE_400,
                    '<text x="10" y="80" font-family="Witness Face" font-weight="700" font-size="48">Hamburg</text>',
                ),
            );
            const t = asset.texts[0];
            expect(t?.face_state).toBe('synthesised');
            expect(asset.findings.map((f) => f.rule)).toContain('geometry/font-synthesised');
        },
        BROWSER_BUDGET_MS,
    );

    it(
        'synthesis-none-is-not-synthesised',
        async () => {
            // The near miss: the same request with `font-synthesis: none` set on
            // purpose paints the 400 face unemboldened — no faux bold exists.
            const asset = await renderTexts(
                'face-synthesis-none',
                svgWith(
                    FACE_400,
                    '<text x="10" y="80" font-family="Witness Face" font-weight="700" ' +
                        'style="font-synthesis:none" font-size="48">Hamburg</text>',
                ),
            );
            expect(asset.texts[0]?.face_state).toBe('loaded');
            expect(asset.findings.map((f) => f.rule)).not.toContain('geometry/font-synthesised');
        },
        BROWSER_BUDGET_MS,
    );

    it(
        'a-weight-the-face-covers-is-not-synthesised',
        async () => {
            // 500 of a 400-only face matches the 400 face; no emboldening runs
            // below 600, so 500 is not a synthesis.
            const asset = await renderTexts(
                'face-500',
                svgWith(
                    FACE_400,
                    '<text x="10" y="80" font-family="Witness Face" font-weight="500" font-size="48">Hamburg</text>',
                ),
            );
            expect(asset.texts[0]?.face_state).toBe('loaded');
        },
        BROWSER_BUDGET_MS,
    );

    it(
        'a-family-without-font-face-has-no-face-state',
        async () => {
            const asset = await renderTexts(
                'face-none',
                svgWith('', '<text x="10" y="80" font-family="serif" font-size="48">Hamburg</text>'),
            );
            expect(asset.texts[0]?.face_state).toBeUndefined();
        },
        BROWSER_BUDGET_MS,
    );

    it(
        'load-waited-for-delayed-face',
        async () => {
            // The roadmap's corrected-from-reproduction finding, pinned: a face
            // the page uses holds `load`, so the reading needs no wait of its
            // own. Served through an intercepted route with a 2,000 ms delay.
            const page = await browser.newPage();
            try {
                await page.route('http://fixture.test/slow.ttf', async (route) => {
                    await new Promise((r) => setTimeout(r, 2_000));
                    await route.fulfill({
                        status: 200,
                        contentType: 'font/ttf',
                        body: buildTestFace({ family: 'Slow Face' }),
                    });
                });
                await page.route('http://fixture.test/slow.svg', (route) =>
                    route.fulfill({
                        status: 200,
                        contentType: 'image/svg+xml',
                        body: svgWith(
                            '@font-face{font-family:"Slow Face";src:url(slow.ttf) format("truetype")}',
                            '<text x="10" y="80" font-family="Slow Face" font-size="48">Hamburg</text>',
                        ),
                    }),
                );
                const t0 = Date.now();
                await page.goto('http://fixture.test/slow.svg', { waitUntil: 'load' });
                expect(Date.now() - t0, '`load` must have waited for the delayed face').toBeGreaterThanOrEqual(1_900);
                const result = await readFaceStates(page);
                expect(result.waited, 'no bounded wait may run when load already held').toBe(false);
                expect(result.readings[0]?.state).toBe('loaded');
            } finally {
                await page.close();
            }
        },
        BROWSER_BUDGET_MS,
    );

    it(
        'a-face-still-loading-after-the-bounded-wait-reads-timeout',
        async () => {
            // A face only a later script asks for — the case `load` does not
            // cover. Its file never arrives, so the bounded wait runs and ends,
            // and the state is `timeout`, never a fallback and never `loaded`.
            const page = await browser.newPage();
            try {
                await page.route('http://fixture.test/never.ttf', () => new Promise<void>(() => undefined));
                await page.route('http://fixture.test/late.svg', (route) =>
                    route.fulfill({
                        status: 200,
                        contentType: 'image/svg+xml',
                        body: svgWith(
                            '@font-face{font-family:"Late Face";src:url(never.ttf) format("truetype")}',
                            '<text x="10" y="80" font-family="serif" font-size="48">Hamburg</text>',
                        ),
                    }),
                );
                await page.goto('http://fixture.test/late.svg', { waitUntil: 'load' });
                await page.evaluate(() => {
                    const text = document.querySelector('text');
                    if (text) text.setAttribute('font-family', '"Late Face", serif');
                });
                const result = await readFaceStates(page, undefined, 500);
                expect(result.waited).toBe(true);
                expect(result.readings[0]?.state).toBe('timeout');
            } finally {
                await page.close();
            }
        },
        BROWSER_BUDGET_MS,
    );
});
