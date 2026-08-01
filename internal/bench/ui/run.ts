#!/usr/bin/env tsx
/**
 * `bench:ui` — deterministic port-fidelity scoring, no model in the path.
 *
 * Scores a produced UI against a provided `design.html` held as ground truth.
 * Four components, weights pre-registered in `bench.config.json` before the
 * first run:
 *
 *   1. pixel        — 8x8 windowed SSIM on the luma channel, per breakpoint.
 *   2. dom          — Sørensen–Dice over the component inventory.
 *   3. tokens       — recall of the truth's colour / spacing / radius values.
 *   4. interactions — a declarative checklist driven through the real browser.
 *
 * WHY NO MODEL. An LLM judge for "is this frontend better" imports judge
 * variance and, worse, circularity — Opus grading Opus — into the one
 * measurement that has to decide Opus vs Sonnet for the UI builders. The port
 * case is the single place a ground truth already exists, so the question can
 * be measured instead of adjudicated. That is the whole reason this harness
 * has the shape it has.
 *
 * WHY IT LIVES HERE, NOT IN `src/scripts/`. `package.json` `files[]` ships
 * `src/scripts/` to consumers but ships neither `internal/` nor `tests/`. This
 * runner imports `@playwright/test`, a devDependency: shipping it would put a
 * broken import in a consumer install and would be exactly the browser runtime
 * the 2026-06-28 lock excludes. Under `internal/` it distributes nothing.
 *
 * DETERMINISM. The score is only reproducible if the render is. Enforced here:
 * a pinned browser recorded with every run, a fixture set SHA-pinned before
 * scoring, `reducedMotion: reduce` plus an injected stylesheet that zeroes
 * animation and transition at capture, `deviceScaleFactor: 1`, sRGB forced,
 * LCD subpixel text off. Enforced in the fixtures themselves: no network
 * reference of any kind, generic font families only, no `Date`, no
 * `Math.random`. Residual limit, stated rather than hidden: generic families
 * resolve against the host's fonts, so absolute SSIM is comparable within a
 * platform epoch, which is why the platform is recorded with the run.
 *
 * Exit codes: 0 scored, 1 usage / IO error, 2 fixture lock mismatch.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type Page } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const CONFIG_PATH = path.join(HERE, 'bench.config.json');
const LOCK_PATH = path.join(HERE, 'fixtures.lock.json');
const REPORT_DIR = path.join(REPO, 'internal', 'bench', 'reports', 'ui');

interface StepSpec {
    action: string;
    selector?: string;
    attribute?: string;
    value?: string;
}

interface InteractionSpec {
    name: string;
    steps: StepSpec[];
}

interface BenchConfig {
    truth: string;
    candidates: string[];
    breakpoints: number[];
    weights: Record<string, number>;
    thresholds: Record<string, number | string>;
    ssim: { window: number; k1: number; k2: number };
    interactions: InteractionSpec[];
}

interface ComponentScore {
    score: number;
    detail: Record<string, unknown>;
}

interface CandidateReport {
    candidate: string;
    components: Record<string, ComponentScore>;
    weighted: number;
}

function readJson<T>(p: string): T {
    return JSON.parse(fs.readFileSync(p, { encoding: 'utf-8' })) as T;
}

function sha256(p: string): string {
    return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/** Round to 4 dp so a report diff shows a real change, not float noise. */
function r4(n: number): number {
    return Math.round(n * 10000) / 10000;
}

// ── Fixture freeze ────────────────────────────────────────────────────────

/**
 * Verify every scored fixture against the committed pin.
 *
 * A fixture set nudged after a first bad run contaminates the measurement
 * exactly the way a threshold chosen after seeing the distribution does. The
 * pre-registration is worthless if the *inputs* stay editable while the
 * outputs are watched, so scoring refuses rather than warns. Extensions are a
 * new set, scored separately — never a revision of this one.
 */
function verifyLock(files: string[], update: boolean): void {
    const actual: Record<string, string> = {};
    for (const rel of files) {
        actual[rel] = sha256(path.join(REPO, rel));
    }
    if (update || !fs.existsSync(LOCK_PATH)) {
        fs.writeFileSync(
            LOCK_PATH,
            JSON.stringify(
                {
                    _note:
                        'SHA-256 of every scored fixture, pinned before the first ' +
                        'scored run. A mismatch refuses the run: see run.ts § Fixture freeze.',
                    files: actual,
                },
                null,
                2,
            ) + '\n',
            'utf-8',
        );
        process.stdout.write(`bench:ui — fixture lock written (${files.length} file(s)).\n`);
        return;
    }
    const lock = readJson<{ files: Record<string, string> }>(LOCK_PATH);
    const drift: string[] = [];
    for (const rel of files) {
        const pinned = lock.files[rel];
        if (pinned === undefined) {
            drift.push(`${rel}: not in the lock — a new fixture is a new set, scored separately`);
        } else if (pinned !== actual[rel]) {
            drift.push(`${rel}: sha256 ${actual[rel]?.slice(0, 12)} ≠ pinned ${pinned.slice(0, 12)}`);
        }
    }
    if (drift.length > 0) {
        process.stderr.write('bench:ui — fixture lock mismatch, refusing to score:\n');
        for (const d of drift) process.stderr.write(`  - ${d}\n`);
        process.stderr.write(
            '  Re-pin deliberately with --update-lock; that starts a new scoring epoch.\n',
        );
        process.exit(2);
    }
}

// ── Capture ───────────────────────────────────────────────────────────────

/** Kill every motion source that would make a screenshot time-dependent. */
const FREEZE_CSS = `*,*::before,*::after{animation:none!important;` +
    `transition:none!important;caret-color:transparent!important;` +
    `scroll-behavior:auto!important}`;

async function capture(browser: Browser, fileUrl: string, width: number): Promise<string> {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        colorScheme: 'light',
    });
    const page = await context.newPage();
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.addStyleTag({ content: FREEZE_CSS });
    const buf = await page.screenshot({ fullPage: true, type: 'png', animations: 'disabled' });
    await context.close();
    return buf.toString('base64');
}

// ── Component 1: perceptual diff ──────────────────────────────────────────

/**
 * Windowed SSIM, computed inside the browser.
 *
 * Chromium already has a PNG decoder and a canvas, so the two screenshots are
 * decoded there and compared on the luma channel. That keeps the harness free
 * of an image-decoding dependency, which the acceptance criteria forbid, and
 * it is why this function ships a page-side function rather than a Node one.
 *
 * Images of different heights are compared over the common area and the score
 * is scaled by the height ratio — a port that drops half the page must not
 * score 1.0 on the half it kept.
 */
async function ssim(
    page: Page,
    aB64: string,
    bB64: string,
    opts: { window: number; k1: number; k2: number },
): Promise<{ score: number; coverage: number }> {
    return page.evaluate(
        async ([a, b, cfg]) => {
            const conf = cfg as { window: number; k1: number; k2: number };
            async function luma(b64: string): Promise<{ d: Float64Array; w: number; h: number }> {
                const img = new Image();
                img.src = `data:image/png;base64,${b64}`;
                await img.decode();
                const c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                if (ctx === null) throw new Error('no 2d context');
                ctx.drawImage(img, 0, 0);
                const px = ctx.getImageData(0, 0, c.width, c.height).data;
                const out = new Float64Array(c.width * c.height);
                for (let i = 0, j = 0; i < px.length; i += 4, j += 1) {
                    out[j] =
                        0.2126 * (px[i] as number) +
                        0.7152 * (px[i + 1] as number) +
                        0.0722 * (px[i + 2] as number);
                }
                return { d: out, w: c.width, h: c.height };
            }

            const A = await luma(a as string);
            const B = await luma(b as string);
            const w = Math.min(A.w, B.w);
            const h = Math.min(A.h, B.h);
            const win = conf.window;
            const C1 = (conf.k1 * 255) ** 2;
            const C2 = (conf.k2 * 255) ** 2;

            let total = 0;
            let count = 0;
            for (let y = 0; y + win <= h; y += win) {
                for (let x = 0; x + win <= w; x += win) {
                    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
                    const n = win * win;
                    for (let dy = 0; dy < win; dy += 1) {
                        for (let dx = 0; dx < win; dx += 1) {
                            const va = A.d[(y + dy) * A.w + (x + dx)] as number;
                            const vb = B.d[(y + dy) * B.w + (x + dx)] as number;
                            sa += va; sb += vb;
                            saa += va * va; sbb += vb * vb; sab += va * vb;
                        }
                    }
                    const ma = sa / n;
                    const mb = sb / n;
                    const va = saa / n - ma * ma;
                    const vb = sbb / n - mb * mb;
                    const cab = sab / n - ma * mb;
                    total +=
                        ((2 * ma * mb + C1) * (2 * cab + C2)) /
                        ((ma * ma + mb * mb + C1) * (va + vb + C2));
                    count += 1;
                }
            }
            const raw = count === 0 ? 0 : total / count;
            // Penalise a port that simply produced less page.
            const coverage = Math.min(A.h, B.h) / Math.max(A.h, B.h, 1);
            return { score: Math.max(0, raw) * coverage, coverage };
        },
        [aB64, bB64, opts] as const,
    );
}

// ── Component 2 + 3: DOM inventory and tokens ─────────────────────────────

/** Structural signature per element, plus every token-ish value in the CSS. */
async function inspect(
    browser: Browser,
    fileUrl: string,
): Promise<{ inventory: Record<string, number>; tokens: string[]; css: string }> {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(fileUrl, { waitUntil: 'load' });
    const out = await page.evaluate(() => {
        const inventory: Record<string, number> = {};
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style') continue;
            // Signature = tag + the semantics a port must preserve. Class names
            // are deliberately excluded: a real port renames them, and scoring
            // them would reward copying over porting.
            const bits = [tag];
            const role = el.getAttribute('role');
            if (role !== null) bits.push(`role=${role}`);
            for (const attr of ['aria-selected', 'aria-expanded', 'aria-controls', 'type', 'hidden']) {
                if (el.hasAttribute(attr)) bits.push(attr);
            }
            const key = bits.join('|');
            inventory[key] = (inventory[key] ?? 0) + 1;
        }
        let css = '';
        for (const sheet of Array.from(document.styleSheets)) {
            try {
                for (const rule of Array.from((sheet as CSSStyleSheet).cssRules)) {
                    css += `${rule.cssText}\n`;
                }
            } catch {
                /* cross-origin sheets cannot occur here: the fixtures have none */
            }
        }
        return { inventory, css };
    });
    await context.close();
    const tokens = extractTokens(out.css);
    return { inventory: out.inventory, tokens, css: out.css };
}

/** Colour, spacing, and radius values — the decisions a port must carry. */
export function extractTokens(css: string): string[] {
    const found = new Set<string>();
    for (const m of css.matchAll(/#[0-9a-f]{6}\b/gi)) found.add(m[0].toLowerCase());
    for (const m of css.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g)) found.add(`${m[1]}px`);
    for (const m of css.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)rem\b/g)) found.add(`${m[1]}rem`);
    return [...found].sort();
}

/** Sørensen–Dice over two multisets — symmetric, and 1.0 only on equality. */
export function diceMultiset(a: Record<string, number>, b: Record<string, number>): number {
    let inter = 0;
    let sizeA = 0;
    let sizeB = 0;
    for (const v of Object.values(a)) sizeA += v;
    for (const v of Object.values(b)) sizeB += v;
    for (const [k, v] of Object.entries(a)) inter += Math.min(v, b[k] ?? 0);
    return sizeA + sizeB === 0 ? 1 : (2 * inter) / (sizeA + sizeB);
}

/** Recall of the truth's values: a port is judged on what it kept. */
export function tokenRecall(truth: string[], candidate: string[]): number {
    if (truth.length === 0) return 1;
    const have = new Set(candidate);
    return truth.filter((t) => have.has(t)).length / truth.length;
}

// ── Component 4: interaction checklist ────────────────────────────────────

async function runInteractions(
    browser: Browser,
    fileUrl: string,
    specs: InteractionSpec[],
    css: string,
): Promise<{ score: number; results: Array<{ name: string; ok: boolean; error?: string }> }> {
    const results: Array<{ name: string; ok: boolean; error?: string }> = [];
    for (const spec of specs) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await context.newPage();
        await page.goto(fileUrl, { waitUntil: 'load' });
        let ok = true;
        let error: string | undefined;
        try {
            for (const step of spec.steps) {
                await runStep(page, step, css);
            }
        } catch (e) {
            ok = false;
            error = e instanceof Error ? e.message : String(e);
        }
        await context.close();
        results.push(error === undefined ? { name: spec.name, ok } : { name: spec.name, ok, error });
    }
    const passed = results.filter((r) => r.ok).length;
    return { score: results.length === 0 ? 1 : passed / results.length, results };
}

async function runStep(page: Page, step: StepSpec, css: string): Promise<void> {
    const sel = step.selector ?? '';
    switch (step.action) {
        case 'click':
            await page.locator(sel).first().click({ timeout: 2000 });
            return;
        case 'fill':
            await page.locator(sel).first().fill(step.value ?? '', { timeout: 2000 });
            return;
        case 'expectVisible':
            if (!(await page.locator(sel).first().isVisible())) {
                throw new Error(`${sel} is not visible`);
            }
            return;
        case 'expectHidden':
            if (await page.locator(sel).first().isVisible()) {
                throw new Error(`${sel} is visible but should be hidden`);
            }
            return;
        case 'expectDisabled':
            if (!(await page.locator(sel).first().isDisabled())) {
                throw new Error(`${sel} is not disabled`);
            }
            return;
        case 'expectAttribute': {
            const actual = await page.locator(sel).first().getAttribute(step.attribute ?? '');
            if (actual !== step.value) {
                throw new Error(`${sel}[${step.attribute}] = ${actual}, want ${step.value}`);
            }
            return;
        }
        case 'expectCssRule':
            if (!css.replace(/\s+/g, ' ').includes((step.value ?? '').replace(/\s+/g, ' '))) {
                throw new Error(`no CSS rule matching ${step.value}`);
            }
            return;
        default:
            throw new Error(`unknown action ${step.action}`);
    }
}

// ── Orchestration ─────────────────────────────────────────────────────────

function fileUrl(rel: string): string {
    return `file://${path.join(REPO, rel)}`;
}

async function main(argv: string[]): Promise<number> {
    const wantJson = argv.includes('--json');
    const updateLock = argv.includes('--update-lock');
    const config = readJson<BenchConfig>(CONFIG_PATH);

    verifyLock([config.truth, ...config.candidates], updateLock);

    const browser = await chromium.launch({
        args: [
            '--force-color-profile=srgb',
            '--font-render-hinting=none',
            '--disable-lcd-text',
            '--hide-scrollbars',
        ],
    });
    const epoch = {
        browser: `chromium ${browser.version()}`,
        platform: `${process.platform}-${process.arch}`,
        node: process.version,
    };

    const truthShots: Record<number, string> = {};
    for (const bp of config.breakpoints) {
        truthShots[bp] = await capture(browser, fileUrl(config.truth), bp);
    }
    const truthInspect = await inspect(browser, fileUrl(config.truth));

    // One scratch page hosts the SSIM computation for every comparison.
    const scratchCtx = await browser.newContext();
    // esbuild (via tsx) keeps function names by emitting a `__name` helper, and
    // a serialized page function carries the call but not the helper. Supplying
    // an identity shim is the narrowest fix: the alternative is passing the
    // page-side code as an untyped string and losing the type-check on it.
    await scratchCtx.addInitScript({ content: 'globalThis.__name = globalThis.__name || ((f) => f);' });
    const scratch = await scratchCtx.newPage();
    await scratch.setContent('<!doctype html><meta charset="utf-8"><title>ssim</title>');

    const reports: CandidateReport[] = [];
    for (const candidate of config.candidates) {
        const perBreakpoint: Record<string, number> = {};
        for (const bp of config.breakpoints) {
            const shot = await capture(browser, fileUrl(candidate), bp);
            const { score } = await ssim(scratch, truthShots[bp] as string, shot, config.ssim);
            perBreakpoint[String(bp)] = r4(score);
        }
        const pixel =
            Object.values(perBreakpoint).reduce((a, b) => a + b, 0) / config.breakpoints.length;

        const candInspect = await inspect(browser, fileUrl(candidate));
        const dom = diceMultiset(truthInspect.inventory, candInspect.inventory);
        const tokens = tokenRecall(truthInspect.tokens, candInspect.tokens);
        const inter = await runInteractions(
            browser,
            fileUrl(candidate),
            config.interactions,
            candInspect.css,
        );

        const components: Record<string, ComponentScore> = {
            pixel: { score: r4(pixel), detail: { perBreakpoint } },
            dom: {
                score: r4(dom),
                detail: {
                    truthElements: Object.values(truthInspect.inventory).reduce((a, b) => a + b, 0),
                    candidateElements: Object.values(candInspect.inventory).reduce((a, b) => a + b, 0),
                },
            },
            tokens: {
                score: r4(tokens),
                detail: {
                    truthTokens: truthInspect.tokens.length,
                    missing: truthInspect.tokens.filter((t) => !candInspect.tokens.includes(t)),
                },
            },
            interactions: { score: r4(inter.score), detail: { results: inter.results } },
        };
        let weighted = 0;
        for (const [key, weight] of Object.entries(config.weights)) {
            weighted += (components[key]?.score ?? 0) * weight;
        }
        reports.push({ candidate, components, weighted: r4(weighted) });
    }

    await scratchCtx.close();
    await browser.close();

    const report = { epoch, truth: config.truth, weights: config.weights, reports };
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
        path.join(REPORT_DIR, 'latest.json'),
        JSON.stringify(report, null, 2) + '\n',
        'utf-8',
    );

    if (wantJson) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return 0;
    }
    process.stdout.write(`bench:ui — ${epoch.browser} · ${epoch.platform}\n`);
    process.stdout.write(`truth: ${config.truth}\n\n`);
    for (const r of reports) {
        process.stdout.write(`${path.basename(r.candidate)}  weighted ${r.weighted.toFixed(4)}\n`);
        for (const [name, c] of Object.entries(r.components)) {
            process.stdout.write(`  ${name.padEnd(13)} ${c.score.toFixed(4)}\n`);
        }
        process.stdout.write('\n');
    }
    process.stdout.write(`report: internal/bench/reports/ui/latest.json\n`);
    return 0;
}

const invokedDirectly =
    process.argv[1] !== undefined && /run\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (e: unknown) => {
            process.stderr.write(`bench:ui — ${e instanceof Error ? e.message : String(e)}\n`);
            process.exit(1);
        },
    );
}
