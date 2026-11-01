#!/usr/bin/env node
// Reproducible captures of the demo knowledge map for the README and docs site.
//
// Draws `code-graph map --demo` (fixture data, never a real repository — the page
// carries its "sample data" chip) into a temporary directory, opens it headless at
// a fixed viewport and writes WebP stills plus a short clip to docs/media/code-map/.
// Every embed of these files still needs its ADR-125 human confirmation.
//
// Needs the root dependencies (`npm ci`), Playwright's Chromium
// (`npx playwright install chromium`) and `cwebp`. `ffmpeg` is optional: without it
// the clip is skipped and the script says so.
//
//   node internal/capture/capture-demo-map.mjs [--out DIR] [--no-clip]
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VIEWPORT = { width: 1440, height: 900 };
const STILL_BUDGET = 300 * 1024;
const CLIP_BUDGET = 2 * 1024 * 1024;
const CLIP_SECONDS = 10;

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT = path.resolve(outIdx >= 0 ? argv[outIdx + 1] : path.join(REPO, 'docs', 'media', 'code-map'));
const WANT_CLIP = !argv.includes('--no-clip');

function which(bin) {
    const r = spawnSync('which', [bin], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

function drawDemoMap(dir) {
    const tsx = path.join(REPO, 'node_modules', '.bin', 'tsx');
    if (!fs.existsSync(tsx)) throw new Error('root dependencies missing (no node_modules/.bin/tsx) — run `npm ci` first');
    const r = spawnSync(tsx, [path.join(REPO, 'src', 'scripts', 'code_graph', 'cli.ts'), 'map', '--demo', '--no-verify', '--out', dir], {
        cwd: REPO,
        stdio: ['ignore', 'ignore', 'inherit'],
    });
    if (r.status !== 0) throw new Error(`code-graph map --demo exited ${r.status}`);
    const page = path.join(dir, 'index.html');
    if (!fs.readFileSync(page, 'utf8').includes('id="pin-demo"')) throw new Error('the drawn page lacks its "sample data" chip (#pin-demo)');
    return page;
}

/** PNG → WebP under the size budget, stepping the quality down until it fits. */
function toWebp(cwebp, png, webp) {
    for (const q of [82, 74, 66, 58, 50]) {
        const r = spawnSync(cwebp, ['-quiet', '-q', String(q), '-m', '6', png, '-o', webp]);
        if (r.status !== 0) throw new Error(`cwebp failed on ${png}`);
        if (fs.statSync(webp).size <= STILL_BUDGET) return q;
    }
    throw new Error(`${path.basename(webp)} stays above ${STILL_BUDGET} bytes at quality 50`);
}

async function ready(page) {
    await page.waitForFunction(() => window.__mapLabelBoxes !== undefined);
    await page.waitForTimeout(600);
}

async function selectFile(page, name) {
    await page.locator('#search').fill(name);
    const row = page.locator('#results [role="option"]').first();
    await row.waitFor();
    await row.click();
    await page.waitForTimeout(900);
}

async function lens(page, name) {
    await page.getByRole('tab', { name, exact: true }).click();
    await page.waitForTimeout(900);
}

/** Each still: what it shows, and how to reach it from a freshly loaded #/code page. */
const STILLS = [
    {
        name: 'demo-graph-blast',
        async open(page, url) {
            await page.goto(`${url}#/code`);
            await ready(page);
            await selectFile(page, 'app/Models/Note.php');
        },
    },
    {
        name: 'demo-history',
        async open(page, url) {
            await page.goto(`${url}#/code`);
            await ready(page);
            await selectFile(page, 'app/Modules/Billing/Services/LegacyBillingRun.php');
            await page.locator('.sec.hist').first().scrollIntoViewIfNeeded();
        },
    },
    {
        name: 'demo-matrix',
        async open(page, url) {
            await page.goto(`${url}#/code`);
            await ready(page);
            await selectFile(page, 'app/Models/Note.php');
            await lens(page, 'Matrix');
        },
    },
    {
        name: 'demo-knowledge',
        async open(page, url) {
            await page.goto(`${url}#/code`);
            await ready(page);
            await selectFile(page, 'app/Jobs/SyncStock.php');
            await lens(page, 'Knowledge');
        },
    },
    {
        name: 'demo-erd',
        async open(page, url) {
            await page.goto(`${url}#/data`);
            await page.waitForTimeout(1500);
        },
    },
];

async function assertSampleChip(page, still) {
    const chip = page.locator('#pin-demo');
    if (!(await chip.isVisible())) throw new Error(`${still}: the "sample data" chip is not visible`);
}

async function main() {
    const cwebp = which('cwebp');
    if (!cwebp) throw new Error('cwebp is not installed');
    const ffmpeg = which('ffmpeg');
    const specifier = '@playwright/test';
    const { chromium } = await import(specifier);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-capture-map-'));
    fs.mkdirSync(OUT, { recursive: true });
    const written = [];
    let browser;
    try {
        const url = pathToFileURL(drawDemoMap(path.join(tmp, 'map'))).href;
        browser = await chromium.launch();
        const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: 'dark', locale: 'en-US' });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        for (const s of STILLS) {
            await s.open(page, url);
            await assertSampleChip(page, s.name);
            const png = path.join(tmp, `${s.name}.png`);
            await page.screenshot({ path: png });
            const webp = path.join(OUT, `${s.name}.webp`);
            const q = toWebp(cwebp, png, webp);
            written.push(`${path.relative(REPO, webp)} (${Math.round(fs.statSync(webp).size / 1024)} KB, q${q})`);
        }
        await page.close();
        if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);

        if (!WANT_CLIP) {
            console.log('clip: skipped (--no-clip)');
        } else if (!ffmpeg) {
            console.log('clip: skipped — ffmpeg is not installed, so the recording cannot be trimmed and encoded');
        } else {
            const videoDir = path.join(tmp, 'video');
            const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'dark', locale: 'en-US', recordVideo: { dir: videoDir, size: VIEWPORT } });
            const vp = await ctx.newPage();
            await vp.goto(`${url}#/code`);
            await ready(vp);
            const start = Date.now();
            await vp.waitForTimeout(800);
            await selectFile(vp, 'app/Models/Note.php');
            await vp.waitForTimeout(1400);
            await lens(vp, 'Matrix');
            await vp.waitForTimeout(1200);
            await lens(vp, 'Graph');
            await vp.getByRole('link', { name: 'Data', exact: true }).or(vp.getByRole('button', { name: 'Data', exact: true })).first().click();
            await vp.waitForTimeout(2000);
            const lead = (start - (await vp.evaluate(() => performance.timeOrigin))) / 1000;
            await ctx.close();
            const raw = fs.readdirSync(videoDir).map((f) => path.join(videoDir, f))[0];
            const mp4 = path.join(OUT, 'demo-tour.mp4');
            const enc = spawnSync(
                ffmpeg,
                ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, lead)), '-i', raw, '-t', String(CLIP_SECONDS), '-vf', 'scale=1080:-2,fps=24', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', mp4],
                { stdio: ['ignore', 'inherit', 'inherit'] },
            );
            if (enc.status !== 0) throw new Error('ffmpeg could not encode the clip');
            const size = fs.statSync(mp4).size;
            if (size > CLIP_BUDGET) throw new Error(`demo-tour.mp4 is ${size} bytes, above the ${CLIP_BUDGET}-byte budget`);
            written.push(`${path.relative(REPO, mp4)} (${Math.round(size / 1024)} KB)`);
        }
    } finally {
        if (browser) await browser.close();
        fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`capture-demo-map: wrote\n  ${written.join('\n  ')}`);
    console.log('Each embed needs its ADR-125 human confirmation before it ships.');
}

main().catch((e) => {
    console.error(`capture-demo-map: ${e.message}`);
    process.exitCode = 1;
});
