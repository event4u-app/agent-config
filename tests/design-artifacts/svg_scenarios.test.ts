import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    compareGeometry,
    runAssetRender,
    type AssetClass,
    type AssetReading,
} from '../../src/cli/commands/uiRenderAsset.js';
import { parseElements, preservationReadout, scanSvg, vectorVerdict } from '../../src/scripts/lint_svg_asset.js';
import { smilVerdict } from '../../src/scripts/_lib/svg_motion.js';

/**
 * Phase 6 of `road-to-svg-with-a-witness` — five recorded runs of the
 * `svg-authoring` skill, decided by the witnesses.
 *
 * No model scores anything here, including this test's own author. Each case
 * runs the same two witnesses a consumer would run — `lint_svg_asset` and
 * `ui:render --profile asset` — over files committed under `scenarios/`, and
 * asserts the properties `scenarios/manifest.json` declared beside them.
 *
 * The committed artefacts are the point. A scenario whose files live only in a
 * transcript cannot be re-checked by anybody, which is the failure the recorded
 * conversion session demonstrated: it reported an SVG as delivered on the
 * strength of the text it had just written.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIR = path.join(HERE, 'scenarios');
const FIXTURES = path.join(HERE, 'fixtures', 'svg-assets');

interface Scenario {
    id: string;
    dir: string;
    asset_class?: AssetClass;
    delivery?: string;
    delivered: string[];
    input?: string;
    allowed_ids?: string[];
    asserts: Record<string, unknown>;
}
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf-8')) as {
    scenarios: Scenario[];
};
const scenario = (id: string): Scenario => {
    const s = manifest.scenarios.find((x) => x.id === id);
    if (!s) throw new Error(`scenario ${id} is not declared in manifest.json`);
    return s;
};

const read = (rel: string): string => fs.readFileSync(path.join(DIR, rel), 'utf-8');
const count = (content: string, tag: string): number =>
    parseElements(content).filter((el) => !el.closing && el.name === tag).length;

let browser: Browser | null = null;
let outRoot = '';

beforeAll(async () => {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
    outRoot = fs.mkdtempSync(path.join(ROOT, 'agents', 'runtime', 'state', 'render', 'scenario-'));
}, 120_000);

afterAll(async () => {
    // The Class-A boundary: no browser survives this file, on any path.
    await browser?.close();
    if (outRoot) fs.rmSync(outRoot, { recursive: true, force: true });
});

/** One asset-profile pass over a scenario file. */
async function render(rel: string, assetClass: AssetClass, delivery = 'inline'): Promise<AssetReading> {
    if (!browser) throw new Error('no browser');
    const result = await runAssetRender(browser, {
        file: path.join(DIR, rel),
        projectRoot: ROOT,
        outDir: path.join(outRoot, rel.replace(/[^a-z0-9]+/gi, '-')),
        assetClass,
        delivery: delivery as 'inline' | 'img' | 'css-bg',
        thresholdsFile: path.join(FIXTURES, 'manifest.json'),
    });
    return result.reading;
}

describe('svg end-to-end scenarios', () => {
    it(
        'new-logo-true-vector',
        async () => {
            // --- (a) from a brief alone -------------------------------------
            const a = scenario('new-logo-true-vector');
            const file = a.delivered[0] as string;
            const content = read(file);

            expect(count(content, 'image'), 'an embedded raster is not a vector').toBe(0);
            expect(count(content, 'foreignobject')).toBe(0);
            expect(count(content, 'text'), 'the brief asked for no text').toBe(0);
            expect(vectorVerdict(parseElements(content)).trueVector).toBe(true);
            expect(scanSvg(content, file, { delivery: 'inline' })).toEqual([]);

            const reading = await render(file, 'mark');
            expect(reading.true_vector).toBe(true);
            expect(reading.fill_ratio, 'fill ratio was not read').not.toBeNull();
            expect(reading.fill_ratio as number).toBeGreaterThanOrEqual(reading.fill_ratio_threshold);
            expect(reading.outside_view_box).toEqual([]);
            // Step 3.5: `verified` is bound to the digest of the file on disk.
            expect(reading.digest).toBe(
                crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, file))).digest('hex'),
            );

            // --- (b) from the conversion raster -----------------------------
            const b = scenario('new-logo-from-raster');
            const converted = b.delivered[0] as string;
            const convContent = read(converted);

            expect(count(convContent, 'image'), 'a converted file carrying a raster is not a conversion').toBe(0);
            expect(count(convContent, 'foreignobject')).toBe(0);
            expect(count(convContent, 'text'), 'the task excluded the wordmark and the strapline').toBe(0);
            expect(vectorVerdict(parseElements(convContent)).trueVector).toBe(true);
            expect(scanSvg(convContent, converted, { delivery: 'inline' })).toEqual([]);

            // The two numbers, against the reference it was rendered from. The
            // tolerance is the one pre-registered in the fixture manifest, and
            // it starts from the single accepted point on record.
            const tol = (
                JSON.parse(fs.readFileSync(path.join(FIXTURES, 'manifest.json'), 'utf-8')) as {
                    raster_conversion_tolerance: { silhouette_iou_min: number };
                }
            ).raster_conversion_tolerance;
            // The baseline is the MARK ONLY, framed to the mark — because that
            // is what the task asked for. `compareGeometry` renders both files
            // into the BASELINE's viewBox, so comparing a mark against the full
            // lockup counts the deliberately-excluded wordmark and strapline as
            // missing silhouette: measured, that reads IoU 0.177 and says
            // nothing about the conversion. The mark-only reference is derived
            // here rather than committed, so the committed ground truth stays
            // the single file the raster is rendered from.
            const reference = fs.readFileSync(path.join(FIXTURES, 'conversion', 'reference.svg'), 'utf-8');
            const markOnly = reference
                .replace(/<g id="wordmark"[\s\S]*?<\/g>/, '')
                .replace(/<g id="slogan"[\s\S]*?<\/g>/, '')
                .replace(/viewBox="0 0 240 160" width="240" height="160"/, 'viewBox="20 20 80 80" width="320" height="320"');
            expect(markOnly, 'the mark-only reference could not be derived').not.toContain('id="wordmark"');
            expect(markOnly).not.toContain('id="slogan"');
            expect(markOnly).toContain('viewBox="20 20 80 80"');
            const markOnlyPath = path.join(outRoot, 'reference-mark-only.svg');
            fs.writeFileSync(markOnlyPath, markOnly);

            if (!browser) throw new Error('no browser');
            const context = await browser.newContext();
            try {
                const comparison = await compareGeometry(context, {
                    baseline: markOnlyPath,
                    candidate: path.join(DIR, converted),
                    assetClass: 'mark',
                    tolerance: { silhouette_iou_min: tol.silhouette_iou_min, max_boundary_distance_units: 4 },
                    toleranceSource: 'manifest',
                } as Parameters<typeof compareGeometry>[1]);
                // A reading, reported as numbers — never "matches" and never
                // "100 %". An unverified verdict is a real outcome and is
                // asserted as such rather than quietly accepted.
                expect(comparison.verdict, comparison.reason).not.toBe('unverified');
                expect(comparison.silhouette_iou, comparison.reason).not.toBeNull();
                // The pre-registered number, asserted as a number. It starts
                // from the one accepted point on record (IoU 0.984), and the
                // fixture raster is rendered from a flat-gradient vector, so a
                // re-derivation must do at least that well.
                expect(
                    comparison.silhouette_iou as number,
                    `silhouette IoU ${comparison.silhouette_iou} against the pre-registered ${tol.silhouette_iou_min}`,
                ).toBeGreaterThanOrEqual(tol.silhouette_iou_min);
            } finally {
                await context.close();
            }

            // The report the run owes: per-pass numbers, the residual's cause,
            // and the file size. Its absence is the failure mode S7 recorded.
            const report = read(path.join('s1b-conversion', 'report.md'));
            expect(report).toMatch(/registration|crop offset/i);
            expect(report).toMatch(/\bbytes?\b|\bKB\b/i);

            // The pass budget is part of the procedure, not a soft target: a
            // run that needed a sixth scored pass fails the scenario.
            const passRows = report
                .split('\n')
                .filter((l) => /^\|\s*\d+\s*\|/.test(l))
                .map((l) => Number(l.split('|')[1]?.trim()));
            expect(passRows.length, 'the report carries no per-pass table').toBeGreaterThan(0);
            expect(
                Math.max(...passRows),
                `the run took ${Math.max(...passRows)} scored passes against a budget of 5`,
            ).toBeLessThanOrEqual(b.asserts['max_scored_passes'] as number);
        },
        180_000,
    );

    it('face-removed-hat-unchanged', async () => {
        const s = scenario('face-removed-hat-unchanged');
        const before = read(s.input as string);
        const after = read(s.delivered[0] as string);

        // The preservation readout decides this, not a pixel diff: anti-aliasing
        // and font metrics would make a pixel verdict a per-machine verdict.
        const changes = preservationReadout(before, after, s.allowed_ids ?? []);
        expect(changes, JSON.stringify(changes)).toEqual([]);

        // The hat and the shared symbol survive; the face is gone.
        for (const id of ['hat-group', 'hat-crown', 'hat-brim', 'hat-band', 'figure-eye', 'shoulders']) {
            expect(after, `${id} must survive the edit`).toContain(`id="${id}"`);
        }
        for (const id of ['face-group', 'face-shape', 'eye-left', 'eye-right', 'mouth']) {
            expect(after, `${id} was inside the declared edit`).not.toContain(`id="${id}"`);
        }

        // Both revisions are clean under the static witness: the edit did not
        // trade one defect for another.
        expect(scanSvg(before, 'before.svg', { delivery: 'inline' })).toEqual([]);
        expect(scanSvg(after, 'after.svg', { delivery: 'inline' })).toEqual([]);

        const reading = await render(s.delivered[0] as string, 'illustration');
        expect(reading.outside_view_box).toEqual([]);
    }, 120_000);

    it(
        'scales-3000x-sharp',
        async () => {
            const s = scenario('scales-3000x-sharp');
            const source = read(s.input as string);
            expect(count(source, 'image'), 'an embedded raster blurs across hundreds of pixels').toBe(0);
            // A filter that rasterises at a fixed resolution defeats the point
            // of a vector as surely as an embedded raster does.
            expect(source).not.toMatch(/<fe(GaussianBlur|Turbulence|Image|DropShadow)\b/i);

            if (!browser) throw new Error('no browser');
            const scale = s.asserts['device_scale'] as number;
            const tile = s.asserts['tile_units'] as number;

            // The magnification is reached by CROPPING the viewBox, not by
            // laying the graphic out at 64 x scale px. Measured first, then
            // rewritten: at scale 3000 that layout is 192,000 px wide, which
            // exceeds Chromium's maximum image size — it rasterises nothing,
            // the canvas reads uniformly transparent, and the band comes back 0
            // for a vector AND for a raster. A check that returns 0 on both is
            // not a check. A 512 px box over 512/3000 user units is the same
            // magnification and is inside every engine limit.
            const span = tile / scale;
            const edge = { x: 1, y: 32 };
            const viewBox = `${edge.x - span / 2} ${edge.y - span / 2} ${span} ${span}`;

            /** Lay one graphic out at the crop and read the transition band. */
            const bandOf = async (markup: string): Promise<number> => {
                const context = await browser!.newContext({ viewport: { width: tile, height: tile } });
                const page = await context.newPage();
                try {
                    await page.route('**/*', (route) =>
                        route.request().url().startsWith('data:') || route.request().url() === 'about:blank'
                            ? route.continue()
                            : route.abort(),
                    );
                    await page.setContent(
                        `<!doctype html><html><body style="margin:0;background:#ffffff">${markup}</body></html>`,
                        { waitUntil: 'load' },
                    );
                    const shot = (await page.screenshot()).toString('base64');
                    const reader = await context.newPage();
                    try {
                        await reader.setContent('<!doctype html><body></body>');
                        return await reader.evaluate(async (b64: string) => {
                            const img = new Image();
                            img.src = `data:image/png;base64,${b64}`;
                            await img.decode();
                            const c = document.createElement('canvas');
                            c.width = img.naturalWidth;
                            c.height = img.naturalHeight;
                            const cx = c.getContext('2d');
                            if (!cx) return -1;
                            cx.drawImage(img, 0, 0);
                            const d = cx.getImageData(0, Math.floor(c.height / 2), c.width, 1).data;
                            const px = (i: number): [number, number, number] => [
                                d[i * 4] as number,
                                d[i * 4 + 1] as number,
                                d[i * 4 + 2] as number,
                            ];
                            const left = px(0);
                            const right = px(c.width - 1);
                            const near = (a: [number, number, number], b: [number, number, number]): boolean =>
                                Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 12;
                            // A uniform row means the crop missed the edge — a
                            // band of 0 would then be an artefact, not a reading.
                            if (near(left, right)) return -1;
                            let band = 0;
                            for (let i = 0; i < c.width; i++) {
                                const p = px(i);
                                if (!near(p, left) && !near(p, right)) band += 1;
                            }
                            return band;
                        }, shot);
                    } finally {
                        await reader.close();
                    }
                } finally {
                    await page.close();
                    await context.close();
                }
            };

            // The vector, re-rasterised by the engine at the final resolution.
            const inner = source.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg\s*>\s*$/, '');
            const vectorBand = await bandOf(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${tile}" height="${tile}">${inner}</svg>`,
            );

            // THE CONTROL, and it is not optional. The same mark rasterised at
            // its intrinsic 64 px and magnified through the identical path must
            // blur across far more than the bound — otherwise this measurement
            // cannot tell a vector from a raster and the vector reading above
            // proves nothing about either.
            const png = await (async (): Promise<string> => {
                const context = await browser!.newContext({ viewport: { width: 64, height: 64 } });
                const page = await context.newPage();
                try {
                    await page.setContent(
                        `<!doctype html><html><body style="margin:0;background:#ffffff">` +
                            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${inner}</svg>` +
                            `</body></html>`,
                        { waitUntil: 'load' },
                    );
                    return (await page.screenshot()).toString('base64');
                } finally {
                    await page.close();
                    await context.close();
                }
            })();
            const rasterBand = await bandOf(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${tile}" height="${tile}">` +
                    `<image href="data:image/png;base64,${png}" x="0" y="0" width="64" height="64"/></svg>`,
            );

            const bound = s.asserts['max_edge_transition_device_px'] as number;
            expect(vectorBand, 'the crop did not land on an edge — the reading is an artefact').toBeGreaterThanOrEqual(
                0,
            );
            expect(
                rasterBand,
                `the rasterised control blurred across only ${rasterBand} device px, against the vector's ` +
                    `${vectorBand} — this measurement cannot tell a vector from a raster`,
            ).toBeGreaterThan(bound * 10);
            expect(
                vectorBand,
                `edge transition is ${vectorBand} device px at ${scale}x (raster control: ${rasterBand})`,
            ).toBeLessThanOrEqual(bound);
        },
        240_000,
    );

    it(
        'animated-with-reduced-motion-route',
        async () => {
            const s = scenario('animated-with-reduced-motion-route');
            const animated = s.delivered[0] as string;
            const content = read(animated);

            // The route must actually reach SMIL. A CSS `animation: none` does
            // not, which is the measured R4 case.
            expect(smilVerdict(content)).toBe('routed');
            expect(scanSvg(content, animated, { delivery: 'inline' })).toEqual([]);

            const reading = await render(animated, 'animated');
            expect(reading.frames.length).toBeGreaterThanOrEqual(3);
            expect(
                reading.distinct_frames,
                'three declared times must yield three different frames',
            ).toBe(s.asserts['distinct_frames'] as number);
            expect(reading.reduced_motion.witnessable).toBe(true);
            expect(reading.reduced_motion.frames_equal, 'under reduce the inline delivery must hold still').toBe(
                true,
            );
            expect(reading.findings.filter((f) => f.rule.startsWith('motion/'))).toEqual([]);

            // The `img` delivery: not witnessable by emulation, so the HOST
            // carries the route and the witness says so rather than passing.
            const host = s.delivered[2] as string;
            const imgReading = await render(animated, 'animated', 'img');
            expect(imgReading.reduced_motion.witnessable).toBe(false);
            expect(imgReading.reduced_motion.reason).toMatch(/image document|emulation/i);

            const hostContent = read(host);
            expect(hostContent).toMatch(/<picture>/);
            expect(hostContent).toMatch(/media="\(prefers-reduced-motion:\s*reduce\)"/);
            expect(hostContent).toMatch(/srcset="mark-static\.svg"/);
        },
        180_000,
    );

    it(
        'delivered-files-reopen',
        async () => {
            if (!browser) throw new Error('no browser');
            const covered = (scenario('delivered-files-reopen').asserts, manifest.scenarios)
                .filter((s) => s.id !== 'delivered-files-reopen' && s.delivered.length)
                .flatMap((s) => s.delivered);
            expect(covered.length).toBeGreaterThanOrEqual(4);

            const context = await browser.newContext();
            try {
                for (const rel of covered) {
                    const abs = path.join(DIR, rel);
                    expect(fs.existsSync(abs), `${rel} does not exist at its reported path`).toBe(true);

                    const bytes = fs.readFileSync(abs);
                    expect(bytes.length, `${rel} is empty`).toBeGreaterThan(0);
                    // Parses — not "looks like it would".
                    expect(parseElements(bytes.toString('utf8')).length, `${rel} parses to no elements`).toBeGreaterThan(
                        0,
                    );

                    // Re-render FROM DISK in a fresh context, network aborted.
                    const page = await context.newPage();
                    try {
                        await page.route('**/*', (route) =>
                            route.request().url().startsWith('file:') ? route.continue() : route.abort(),
                        );
                        await page.goto(`file://${abs}`, { waitUntil: 'load', timeout: 30_000 });
                        const painted = await page.evaluate(
                            () => document.documentElement.getBoundingClientRect().width > 0,
                        );
                        expect(painted, `${rel} re-opened empty`).toBe(true);
                    } finally {
                        await page.close();
                    }

                    // An `img` delivery additionally loads through a host `<img>`
                    // and must report a non-zero natural width.
                    if (/\.svg$/i.test(rel)) {
                        const page = await context.newPage();
                        // The probe host is written NEXT TO the asset and loaded
                        // over file://, not injected with setContent. A page at
                        // about:blank cannot load a file:// subresource at all,
                        // so a setContent probe reports naturalWidth 0 for every
                        // file including a perfectly good one — it would measure
                        // Chromium's origin rule, not the asset.
                        const probeHost = path.join(path.dirname(abs), `.probe-${path.basename(abs)}.html`);
                        fs.writeFileSync(
                            probeHost,
                            `<!doctype html><img id="probe" src="${path.basename(abs)}">`,
                        );
                        try {
                            await page.route('**/*', (route) =>
                                route.request().url().startsWith('file:') ? route.continue() : route.abort(),
                            );
                            await page.goto(`file://${probeHost}`, { waitUntil: 'load', timeout: 30_000 });
                            const natural = await page.evaluate(async () => {
                                const img = document.getElementById('probe') as HTMLImageElement;
                                try {
                                    await img.decode();
                                } catch {
                                    return 0;
                                }
                                return img.naturalWidth;
                            });
                            expect(natural, `${rel} has no natural width through an <img>`).toBeGreaterThan(0);
                        } finally {
                            await page.close();
                            fs.rmSync(probeHost, { force: true });
                        }
                    }
                }
            } finally {
                await context.close();
            }
        },
        300_000,
    );
});
