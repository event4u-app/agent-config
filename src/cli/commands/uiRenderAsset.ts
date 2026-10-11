/**
 * `agent-config ui:render <file> --profile asset` — the engine witness for one
 * hand-authored SVG. Step 2.1 and step 2.6 of `road-to-svg-with-a-witness`.
 *
 * The PAGE profile is untouched. Its `VIEWPORTS` contract, its capture loop and
 * its manifest keys are the same bytes they were before this file existed —
 * step 2.2 pins that, and the pin is the reason the asset code lives here
 * rather than inside `uiRender.ts`'s loop.
 *
 * CLASS A, inherited from `uiRender.ts` and not weakened: the browser this
 * module is handed is closed by its caller in a `finally`, nothing is cached
 * between invocations, and no listener or watch mode exists.
 *
 * WHAT THIS READS, and why each reading is here rather than in the static
 * linter (`src/scripts/lint_svg_asset.ts`):
 *
 *   - fill ratio, per asset class — a global threshold read a 24-grid
 *     hamburger's designed padding as a loose viewBox (R12). The threshold
 *     comes from the fixture manifest's `fill_ratio_thresholds` when one is
 *     supplied, from the per-class defaults below otherwise. Never global.
 *   - the resolved font family — a `<text>` with no `font-family` resolves to
 *     `Times` in Chromium (R1). Only a renderer knows that.
 *   - draw-on dead time — `getTotalLength()` against the dash. Deliberately
 *     NOT a static rule: the prototype's regex fired on an intentional spinner
 *     (R9, R12), so the dash is measured against the geometry it actually runs
 *     on or it is not measured at all.
 *   - frames at a declared time — `pauseAnimations()` + `setCurrentTime()`.
 *     `screenshot({ animations: 'disabled' })` does NOT freeze SMIL: three
 *     captures 300 ms apart read `cx` 21.3, 46.3, 70.9, while the pause-and-seek
 *     pair held 100 and 100 (R6).
 *   - a near-white region enclosed by paint where the source shows a hole (S5).
 *   - `img` / CSS-background delivery: the emulated preference does not reach an
 *     image document (R5), so the reading is `not_witnessable` and the HOST is
 *     checked for a `<picture>` route instead.
 *
 * NO NETWORK. Every request whose scheme is not `file:` (plus the `data:`,
 * `blob:` and `about:` schemes a page makes of itself) is aborted, so an asset
 * cannot fetch during its own witness.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Browser, Page, Route } from '@playwright/test';

import { elementExtent, parseElements, readViewBox, vectorVerdict } from '../../scripts/lint_svg_asset.js';
import type { DeliveryMode, SvgElement, ViewBox } from '../../scripts/lint_svg_asset.js';
import { hasCssAnimation, hasSmilMarkup } from '../../scripts/_lib/svg_motion.js';
import { compareGeometry, sampleSource, type Registration } from './uiRenderAssetCompare.js';
import {
    ASSET_CLASSES,
    BRAND_TOKEN_PATHS,
    DEFAULT_FILL_RATIO_THRESHOLDS,
    DEFAULT_GEOMETRY_TOLERANCES,
    DRAW_ON_DEAD_TIME_THRESHOLD,
    FALLBACK_BACKGROUNDS,
    ALLOWED_SCHEMES,
    HOST_BASENAME,
    ICON_SIZES,
    NEAR_WHITE_CHANNEL,
    type AssetClass,
    type AssetFinding,
    type AssetReading,
    type Box,
    type FrameReading,
    type GeometryTolerance,
    type IconGridReading,
    type ReducedMotionReading,
} from './uiRenderAssetTypes.js';

export * from './uiRenderAssetTypes.js';
export * from './uiRenderAssetCompare.js';

// ---------------------------------------------------------------------------
// Pure readings — no browser
// ---------------------------------------------------------------------------

export function sha256(buf: Buffer | string): string {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * The class when `--class` was not given. Recorded as `asset_class_inferred`
 * so a reader never mistakes a guess for a declaration.
 */
export function inferAssetClass(content: string): AssetClass {
    if (hasSmilMarkup(content) || hasCssAnimation(content)) return 'animated';
    const elements = parseElements(content);
    const root = elements.find((el) => el.name === 'svg' && !el.closing);
    const vb = readViewBox(root);
    const texts = elements.filter((el) => el.name === 'text' && !el.closing).length;
    const markers = elements.filter((el) => el.name === 'marker' && !el.closing).length;
    if (vb && vb.w === vb.h && Math.max(vb.w, vb.h) <= 64) return 'icon';
    if (markers > 0 || texts >= 2) return 'diagram';
    if (texts >= 1) return 'illustration';
    return 'mark';
}

/** The declared intrinsic size: `width`/`height` first, the viewBox otherwise. */
export function intrinsicSize(root: SvgElement | undefined, vb: ViewBox | null): { width: number; height: number } {
    const num = (raw: string | undefined): number | null => {
        if (!raw) return null;
        const m = /^\s*(-?[\d.]+)\s*(px)?\s*$/i.exec(raw);
        const v = m ? Number(m[1]) : Number.NaN;
        return Number.isFinite(v) && v > 0 ? v : null;
    };
    const w = num(root?.attrs['width']) ?? vb?.w ?? 48;
    const h = num(root?.attrs['height']) ?? vb?.h ?? 48;
    return { width: w, height: h };
}

/** Icons at 16/24/48; every other class at 1x and 2x its intrinsic size. */
export function assetSizes(
    cls: AssetClass,
    intrinsic: { width: number; height: number },
): Array<{ label: string; width: number; height: number }> {
    if (cls === 'icon') {
        return ICON_SIZES.map((px) => ({ label: `${px}`, width: px, height: px }));
    }
    const ratio = intrinsic.height / intrinsic.width;
    return [1, 2].map((k) => ({
        label: `${k}x`,
        width: Math.round(intrinsic.width * k),
        height: Math.round(intrinsic.width * k * ratio),
    }));
}

export interface ThresholdSource {
    fillRatio: Readonly<Record<AssetClass, number>>;
    fillRatioSource: 'manifest' | 'default';
    geometry: Readonly<Record<AssetClass, GeometryTolerance>>;
    geometrySource: 'manifest' | 'default';
}

/**
 * Thresholds from a fixture manifest when one is supplied, the per-class
 * defaults otherwise. The SOURCE travels with the number: a threshold a reader
 * cannot trace is a threshold they cannot argue with.
 */
export function readThresholds(file: string | undefined): ThresholdSource {
    const out: ThresholdSource = {
        fillRatio: DEFAULT_FILL_RATIO_THRESHOLDS,
        fillRatioSource: 'default',
        geometry: DEFAULT_GEOMETRY_TOLERANCES,
        geometrySource: 'default',
    };
    if (!file || !fs.existsSync(file)) return out;
    let parsed: unknown;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return out;
    }
    const obj = parsed as { fill_ratio_thresholds?: unknown; geometry_tolerances?: unknown };
    const fr = obj.fill_ratio_thresholds as Record<string, number> | undefined;
    if (fr && ASSET_CLASSES.every((c) => typeof fr[c] === 'number')) {
        out.fillRatio = { ...DEFAULT_FILL_RATIO_THRESHOLDS, ...fr } as Record<AssetClass, number>;
        out.fillRatioSource = 'manifest';
    }
    const gt = obj.geometry_tolerances as Record<string, GeometryTolerance> | undefined;
    if (gt && ASSET_CLASSES.every((c) => gt[c] && typeof gt[c]?.silhouette_iou_min === 'number')) {
        out.geometry = { ...DEFAULT_GEOMETRY_TOLERANCES, ...gt } as Record<AssetClass, GeometryTolerance>;
        out.geometrySource = 'manifest';
    }
    return out;
}

/**
 * The light and dark background from the project's tokens, or the stated
 * fallback. Never a silent fallback — the caller records which it was.
 */
export function readBackgroundTokens(projectRoot: string): AssetReading['backgrounds'] {
    for (const rel of BRAND_TOKEN_PATHS) {
        const abs = path.join(projectRoot, rel);
        if (!fs.existsSync(abs)) continue;
        let doc: unknown;
        try {
            doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
        } catch {
            continue;
        }
        const light = findToken(doc, ['background', 'bg', 'surface'], ['light', 'default', 'base']);
        const dark = findToken(doc, ['background', 'bg', 'surface'], ['dark', 'inverse', 'inverted']);
        if (light || dark) {
            return {
                light: light ?? FALLBACK_BACKGROUNDS.light,
                dark: dark ?? FALLBACK_BACKGROUNDS.dark,
                source: 'tokens',
                tokens_file: rel,
            };
        }
    }
    return { ...FALLBACK_BACKGROUNDS, source: 'fallback', tokens_file: null };
}

/** A depth-first walk for a DTCG `$value` whose path carries both hints. */
function findToken(doc: unknown, nameHints: string[], modeHints: string[]): string | null {
    const stack: Array<{ node: unknown; keys: string[] }> = [{ node: doc, keys: [] }];
    let best: string | null = null;
    while (stack.length > 0) {
        const top = stack.pop();
        if (!top || typeof top.node !== 'object' || top.node === null) continue;
        const rec = top.node as Record<string, unknown>;
        const value = rec['$value'] ?? rec['value'];
        if (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value)) {
            const joined = top.keys.join('.').toLowerCase();
            if (nameHints.some((h) => joined.includes(h)) && modeHints.some((h) => joined.includes(h))) {
                best = value;
            }
        }
        for (const [k, v] of Object.entries(rec)) {
            if (k.startsWith('$')) continue;
            stack.push({ node: v, keys: [...top.keys, k] });
        }
    }
    return best;
}

/**
 * The fraction of a draw-on animation's duration during which the drawn length
 * does not change — the R8 defect, stated as a number.
 *
 * With a dash of `D` real units on a path of real length `L`, a dash offset of
 * `o` paints `clamp(D - o, 0, L)`. When `D > L` the paint reaches `L` while `o`
 * is still above zero, and every further step of the animation draws nothing.
 */
export function drawOnDeadFraction(dashUnits: number, from: number, to: number, totalLength: number): number {
    const span = Math.abs(from - to);
    if (span <= 0 || totalLength <= 0 || dashUnits <= 0) return 0;
    const drawn = (o: number): number => Math.min(Math.max(dashUnits - o, 0), totalLength);
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const STEPS = 400;
    let live = 0;
    let prev = drawn(hi);
    for (let i = 1; i <= STEPS; i++) {
        const o = hi - ((hi - lo) * i) / STEPS;
        const now = drawn(o);
        if (Math.abs(now - prev) > 1e-6) live += 1;
        prev = now;
    }
    return 1 - live / STEPS;
}

// ---------------------------------------------------------------------------
// The icon grid, read from the incumbent set's own SVGs (E6)
// ---------------------------------------------------------------------------

export interface IconReference {
    file: string;
    viewBox: ViewBox;
    strokeWidths: number[];
    padding: number;
}

/** Why a supplied reference file produced no reading. Reported, never silent. */
export interface IconReferenceSkip {
    file: string;
    reason: string;
}

export interface IconReferenceRead {
    refs: IconReference[];
    skipped: IconReferenceSkip[];
}

/**
 * The centreline extent of one graphic's own geometry, in user units.
 *
 * Shared by the references and by the candidate — finding 2.2 is precisely
 * that the two used to be measured by different methods, so the one thing this
 * function must never grow is a second caller-specific branch.
 *
 * A TRANSFORM ANYWHERE ABOVE A SHAPE DISQUALIFIES IT, not only one on the
 * shape. `elementExtent` refuses an element that carries its own `transform`,
 * and a flat element list makes it easy to miss that a `<g transform="…">`
 * moves everything inside it — measured here: a rect inside a rotated group
 * read as if the group were not there, and the file reported a padding it does
 * not have. The depth stack below is what carries the inheritance; without it
 * the refusal is a half-refusal, which is worse than none because it looks
 * like a reading.
 */
export function centrelineExtent(elements: readonly SvgElement[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
} | null {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    // How many open ancestors carry a transform. Non-zero ⇒ skip.
    const openTransforms: boolean[] = [];
    let transformedDepth = 0;
    for (const el of elements) {
        if (el.closing) {
            const was = openTransforms.pop();
            if (was === true) transformedDepth -= 1;
            continue;
        }
        const carries = Boolean(el.attrs['transform'] || el.attrs['style']?.includes('transform'));
        if (!el.selfClosing) {
            openTransforms.push(carries);
            if (carries) transformedDepth += 1;
        }
        if (transformedDepth > 0 || (el.selfClosing && carries)) continue;
        const box = elementExtent(el);
        if (!box) continue;
        minX = Math.min(minX, box.minX);
        maxX = Math.max(maxX, box.maxX);
        minY = Math.min(minY, box.minY);
        maxY = Math.max(maxY, box.maxY);
    }
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** Smallest distance from a viewBox edge to an extent. Negative when it overflows. */
export function paddingFromExtent(
    vb: ViewBox,
    ext: { minX: number; minY: number; maxX: number; maxY: number },
): number {
    return Math.min(ext.minX - vb.x, ext.minY - vb.y, vb.x + vb.w - ext.maxX, vb.y + vb.h - ext.maxY);
}

/**
 * Stroke width and padding of each reference icon, read from its own bytes.
 * Padding is the smallest distance from a viewBox edge to the drawn geometry.
 * Nothing is declared here and no grid table is vendored (E6, Non-goals).
 *
 * Finding 2.1 of `road-to-svg-rules-in-the-dispatch-path`, both halves. This
 * used to scrape `d` with a loose number-pair regex, so:
 *
 *   · a reference drawn with `<rect>` / `<circle>` / `<line>` yielded no
 *     extent, was dropped, and — when every reference was drawn that way —
 *     the reading then said "no icon reference set was supplied" although one
 *     was. It now reads every primitive, and a file it still cannot read is
 *     returned in `skipped` with the reason rather than vanishing.
 *   · relative commands were read as absolute, so a path drawn with `m`/`l`
 *     reported an extent anchored near the origin. `pathExtent` walks the
 *     current point.
 *
 * The reading degrades to `unverified` rather than to a pass, so no verdict
 * was wrong before this — but the reason given for the degradation was.
 */
export function readIconReferencesDetailed(files: readonly string[]): IconReferenceRead {
    const refs: IconReference[] = [];
    const skipped: IconReferenceSkip[] = [];
    for (const file of files) {
        if (!fs.existsSync(file)) {
            skipped.push({ file, reason: 'file does not exist' });
            continue;
        }
        const content = fs.readFileSync(file, 'utf8');
        const elements = parseElements(content);
        const root = elements.find((el) => el.name === 'svg' && !el.closing);
        const vb = readViewBox(root);
        if (!vb) {
            skipped.push({ file, reason: 'no readable viewBox' });
            continue;
        }
        const strokes = new Set<number>();
        for (const el of elements) {
            if (el.closing) continue;
            const sw = Number(el.attrs['stroke-width']);
            if (Number.isFinite(sw) && sw > 0) strokes.add(sw);
        }
        const ext = centrelineExtent(elements.filter((el) => el.name !== 'svg'));
        if (!ext) {
            skipped.push({ file, reason: 'no element in it carries readable geometry (every shape transformed, or none drawn)' });
            continue;
        }
        refs.push({
            file,
            viewBox: vb,
            strokeWidths: [...strokes].sort((a, b) => a - b),
            padding: paddingFromExtent(vb, ext),
        });
    }
    return { refs, skipped };
}

/** The list-only form, kept because every existing caller wants exactly that. */
export function readIconReferences(files: readonly string[]): IconReference[] {
    return readIconReferencesDetailed(files).refs;
}

// ---------------------------------------------------------------------------
// The browser half
// ---------------------------------------------------------------------------

export interface AssetRenderOptions {
    /** Absolute path of the file actually opened and digested. */
    file: string;
    projectRoot: string;
    outDir: string;
    assetClass?: AssetClass | undefined;
    delivery?: DeliveryMode | undefined;
    thresholdsFile?: string | undefined;
    iconSet?: readonly string[] | undefined;
    compareTo?: string | undefined;
    registration?: Registration | undefined;
}

export interface AssetRenderResult {
    reading: AssetReading;
    verification: 'verified' | 'degraded';
    degradationReason?: string;
}

/**
 * One screenshot, with exactly one retry on a protocol error.
 *
 * Measured on a GitHub-hosted ubuntu runner with `chromium_headless_shell`:
 * `page.screenshot` failed with `Protocol error (Page.captureScreenshot):
 * Unable to capture screenshot` on one asset while the same asset captured
 * cleanly in another test of the same run — a compositor surface that was not
 * ready, not a property of the file. ONE retry, deliberately: a genuine failure
 * fails twice and still surfaces, while a loop would turn a real break into a
 * slow one. A `path` write also creates its parent directories, so a missing
 * `outDir` is not what this is for.
 */
async function captureWithOneRetry(page: Page, shot: string): Promise<void> {
    try {
        await page.screenshot({ path: shot });
    } catch (first) {
        if (!/Unable to capture screenshot|Protocol error/i.test(String(first))) throw first;
        await page.waitForTimeout(250);
        await page.screenshot({ path: shot });
    }
}

/** A reading pass over one asset. The caller owns the browser's lifetime. */
export async function runAssetRender(browser: Browser, opts: AssetRenderOptions): Promise<AssetRenderResult> {
    const bytes = fs.readFileSync(opts.file);
    const content = bytes.toString('utf8');
    const isHost = /\.html?$/i.test(opts.file);
    const dir = path.dirname(opts.file);

    const elements = isHost ? [] : parseElements(content);
    const root = elements.find((el) => el.name === 'svg' && !el.closing);
    const vb = isHost ? null : readViewBox(root);
    const intrinsic = intrinsicSize(root, vb);

    const declaredClass = opts.assetClass;
    const assetClass: AssetClass = declaredClass ?? inferAssetClass(content);
    const delivery: DeliveryMode = opts.delivery ?? 'inline';
    const thresholds = readThresholds(opts.thresholdsFile);
    const backgrounds = readBackgroundTokens(opts.projectRoot);

    const blocked: string[] = [];
    const reading: AssetReading = {
        profile: 'asset',
        file: path.relative(opts.projectRoot, opts.file).split(path.sep).join('/'),
        digest: sha256(bytes),
        asset_class: assetClass,
        asset_class_inferred: declaredClass === undefined,
        delivery,
        view_box: vb,
        intrinsic,
        backgrounds,
        sizes: [],
        readings_at: null,
        true_vector: isHost ? false : vectorVerdict(elements).trueVector,
        painted_box: null,
        fill_ratio: null,
        fill_ratio_threshold: thresholds.fillRatio[assetClass],
        fill_ratio_threshold_source: thresholds.fillRatioSource,
        outside_view_box: [],
        texts: [],
        accessible_names: [],
        duplicate_accessible_names: [],
        frames: [],
        animation_duration_s: 0,
        distinct_frames: 0,
        draw_on: [],
        icon_grid: null,
        near_white_regions: [],
        network: { aborted: 0, blocked_urls: blocked },
        findings: [],
        reduced_motion: { witnessable: false, frames_equal: null, reason: 'not read' },
    };

    const hostHtml = isHost ? null : inlineHost(content);
    const targetUrl = isHost ? `file://${opts.file}` : `file://${path.join(dir, HOST_BASENAME)}`;

    const context = await browser.newContext();
    // A transpiler shim, and it belongs here rather than in a test helper.
    // Running this file through `tsx` — which is how `./scripts-run` and every
    // consumer script reach it — emits `__name(...)` wrappers around the
    // functions handed to `page.evaluate`. The browser has no such global, so
    // the first evaluate dies with `ReferenceError: __name is not defined`
    // while the same code passes under vitest, whose transform does not add it.
    // Defining an identity shim before any page script runs makes both paths
    // behave the same; it is a no-op where the wrapper was never emitted.
    await context.addInitScript(() => {
        const g = globalThis as unknown as { __name?: (fn: unknown) => unknown };
        if (typeof g.__name !== 'function') g.__name = (fn: unknown) => fn;
    });
    try {
        // Sizes x backgrounds. Icons get 16/24/48; everything else 1x and 2x.
        const sizes = isHost
            ? [{ label: 'host', width: 800, height: 600 }]
            : assetSizes(assetClass, intrinsic);
        for (const size of sizes) {
            for (const mode of ['light', 'dark'] as const) {
                const colour = backgrounds[mode];
                const page = await openPage(context, {
                    url: targetUrl,
                    hostHtml,
                    hostBasename: HOST_BASENAME,
                    width: Math.max(size.width, 64),
                    height: Math.max(size.height, 64),
                    background: colour,
                    cssWidth: size.width,
                    blocked,
                });
                const shot = path.join(opts.outDir, `asset-${size.label}-${mode}.png`);
                await captureWithOneRetry(page, shot);
                reading.sizes.push({
                    label: size.label,
                    css_width: size.width,
                    css_height: size.height,
                    background: mode,
                    background_color: colour,
                    screenshot: path.relative(opts.projectRoot, shot).split(path.sep).join('/'),
                });
                await page.close();
            }
        }
        reading.network.aborted = blocked.length;

        // One geometry pass. Every reading below is in viewBox units, which do
        // not move with the render size — so reading them once and SAYING where
        // beats re-reading them six times and implying they might differ.
        const biggest = sizes[sizes.length - 1] ?? { label: '1x', width: 64, height: 64 };
        // The moment the geometry was read, named rather than implied: an
        // animated asset's painted box is a property of a time, and t = 0 is a
        // declared one.
        reading.readings_at = { css_width: biggest.width, css_height: biggest.height, background: 'light', t: 0 };

        const page = await openPage(context, {
            url: targetUrl,
            hostHtml,
            hostBasename: HOST_BASENAME,
            width: Math.max(biggest.width, 64),
            height: Math.max(biggest.height, 64),
            background: backgrounds.light,
            cssWidth: biggest.width,
            blocked,
        });

        if (!isHost) {
            const raw = await page.evaluate(readAssetInPage);
            applyGeometry(reading, raw, vb);
        }

        // Accessible names across every graphic on the page (R7).
        const names = await page.evaluate(readAccessibleNamesInPage);
        const counts = new Map<string, number>();
        for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
        reading.accessible_names = [...counts].map(([name, count]) => ({ name, count }));
        reading.duplicate_accessible_names = [...counts].filter(([, c]) => c > 1).map(([n]) => n);

        // Frames at t = 0, mid, end. SMIL is paused and sought; CSS/WAAPI
        // animations are paused and their currentTime is set (R6).
        const duration = await page.evaluate(readAnimationEndInPage);
        reading.animation_duration_s = duration;
        if (duration > 0) {
            const points: Array<[FrameReading['label'], number]> = [
                ['start', 0],
                ['mid', duration / 2],
                ['end', duration],
            ];
            for (const [label, t] of points) {
                await page.evaluate(seekInPage, t);
                const buf = await page.screenshot();
                reading.frames.push({ label, t, digest: sha256(buf) });
            }
            reading.distinct_frames = new Set(reading.frames.map((f) => f.digest)).size;
        }
        await page.close();

        // Reduced motion. Inline is witnessable; an image document is not (R5).
        reading.reduced_motion = await readReducedMotion(context, {
            url: targetUrl,
            hostHtml,
            width: Math.max(biggest.width, 64),
            height: Math.max(biggest.height, 64),
            background: backgrounds.light,
            cssWidth: biggest.width,
            blocked,
            delivery,
            duration,
            isHost,
            hostDir: path.dirname(path.resolve(opts.file)),
        });

        if (opts.compareTo) {
            reading.comparison = await compareGeometry(context, {
                baseline: opts.file,
                candidate: opts.compareTo,
                assetClass,
                tolerance: thresholds.geometry[assetClass],
                toleranceSource: thresholds.geometrySource,
                ...(opts.registration ? { registration: opts.registration } : {}),
                blocked,
            });

            // Step 1.2: ask the SOURCE what is under each near-white region.
            // Only reachable with a registration, which is the whole condition
            // — without one the regions keep `no-source` and produce no
            // finding, because the rule's claim is about the source and there
            // is no source to make it against.
            if (opts.registration && vb && reading.near_white_regions.length > 0) {
                const points = reading.near_white_regions.map((n) => n.centre);
                const samples = await sampleSource(context, opts.compareTo, vb, opts.registration, points, blocked);
                if (samples !== null) {
                    reading.near_white_regions = reading.near_white_regions.map((n, i) => ({
                        ...n,
                        source_verdict: (samples[i]?.isBackground ?? false) ? ('hole' as const) : ('paint' as const),
                    }));
                }
            }
        }
    } finally {
        await context.close();
    }

    if (!isHost && opts.iconSet && assetClass === 'icon') {
        reading.icon_grid = gradeIconGrid(opts.file, vb, elements, opts.iconSet, reading.painted_box);
    }

    reading.network.aborted = blocked.length;
    reading.findings = deriveFindings(reading);
    return { reading, verification: 'verified' };
}

/** The host document for an inline delivery: one background, one sized graphic. */
function inlineHost(svg: string): string {
    const body = svg.replace(/<\?xml[^>]*\?>\s*/i, '').replace(/<!DOCTYPE[^>]*>\s*/i, '');
    return `<!doctype html><html><head><meta charset="utf-8"><title>asset</title></head><body>${body}</body></html>`;
}

interface OpenPageSpec {
    url: string;
    hostHtml: string | null;
    hostBasename: string;
    width: number;
    height: number;
    background: string;
    cssWidth: number;
    blocked: string[];
    reducedMotion?: boolean;
}

/**
 * One page with the network closed. The synthetic host is fulfilled at a URL
 * inside the asset's own directory, so the asset's relative references resolve
 * from where it actually lives.
 */
async function openPage(
    context: Awaited<ReturnType<Browser['newContext']>>,
    spec: OpenPageSpec,
): Promise<Page> {
    const page = await context.newPage();
    await page.setViewportSize({ width: Math.ceil(spec.width), height: Math.ceil(spec.height) });
    if (spec.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/*', async (route: Route) => {
        const url = route.request().url();
        if (spec.hostHtml && url.endsWith(`/${spec.hostBasename}`)) {
            await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: spec.hostHtml });
            return;
        }
        if (!ALLOWED_SCHEMES.some((s) => url.startsWith(s))) {
            spec.blocked.push(url);
            await route.abort();
            return;
        }
        await route.continue();
    });
    await page.goto(spec.url, { waitUntil: 'load', timeout: 30_000 });
    await page.addStyleTag({
        content:
            `html,body{margin:0;padding:0;background:${spec.background}}` +
            `body>svg{display:block;width:${spec.cssWidth}px;height:auto}`,
    });
    return page;
}

// ---------------------------------------------------------------------------
// In-page readings. Each is one self-contained function — `page.evaluate` ships
// the source, so nothing here may close over this module's scope.
// ---------------------------------------------------------------------------

interface RawElementReading {
    index: number;
    id: string;
    tag: string;
    box: Box | null;
    geom: Box | null;
    fill: string;
    opaque: boolean;
    strokeWidth: number;
    dash: string;
    totalLength: number | null;
    pathLengthAttr: number | null;
    dashOffsetFrom: number | null;
    dashOffsetTo: number | null;
    /**
     * Indices of the elements whose FILL contains this element's centre,
     * decided in-page by `isPointInFill`.
     *
     * Step 1.2 of `road-to-svg-from-a-live-session`. Containment used to be a
     * bounding-box test, which calls a near-white shape "inside" a ring, an
     * L-shape or a crescent it is nowhere near — and the measured consequence
     * was six findings on paint an owner had deliberately chosen. A sampled
     * point is what the renderer itself would answer.
     *
     * `getBBox` returns LOCAL user units, so this is exact for an untransformed
     * tree and approximate under a transform — the same limit `staticBox`
     * already declares rather than guesses around.
     */
    containedBy: number[];
}

interface RawTextReading {
    index: number;
    id: string;
    text: string;
    box: Box;
    declaredBoxId: string | null;
    declaredBox: Box | null;
    declaredFamily: string;
    firstFamily: string;
    resolvedFamily: string;
    firstFamilyResolved: boolean;
}

interface RawAssetReading {
    viewBox: [number, number, number, number] | null;
    elements: RawElementReading[];
    texts: RawTextReading[];
}

function readAssetInPage(): RawAssetReading {
    const svg = document.querySelector('svg');
    if (!svg) return { viewBox: null, elements: [], texts: [] };
    const vbAttr = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
    const viewBox =
        vbAttr.length === 4 && vbAttr.every((n) => Number.isFinite(n))
            ? ([vbAttr[0], vbAttr[1], vbAttr[2], vbAttr[3]] as [number, number, number, number])
            : null;

    const ctm = svg.getScreenCTM();
    const inv = ctm ? ctm.inverse() : null;
    const userBox = (el: Element): Box | null => {
        const r = el.getBoundingClientRect();
        if (!inv) return null;
        const pts = [
            [r.left, r.top],
            [r.right, r.top],
            [r.left, r.bottom],
            [r.right, r.bottom],
        ].map(([x, y]) => new DOMPoint(x as number, y as number).matrixTransform(inv));
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    };

    const SKIP = ['defs', 'title', 'desc', 'style', 'metadata', 'clippath', 'mask', 'marker', 'pattern', 'symbol'];
    const inSkipped = (el: Element): boolean => {
        let p: Element | null = el.parentElement;
        while (p && p !== svg) {
            if (SKIP.includes(p.tagName.toLowerCase())) return true;
            p = p.parentElement;
        }
        return false;
    };

    const GENERIC = [
        'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
        'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
    ];
    const ctx = document.createElement('canvas').getContext('2d');
    const resolves = (first: string, sample: string): boolean => {
        if (!first) return false;
        if (GENERIC.includes(first.toLowerCase())) return true;
        if (!ctx) return true;
        ctx.font = `32px "${first}", monospace`;
        const a = ctx.measureText(sample).width;
        ctx.font = '32px "__agent_config_absent_family__", monospace';
        const b = ctx.measureText(sample).width;
        return Math.abs(a - b) > 0.01;
    };

    // The document's own default family. A <text> that declares nothing lands
    // on exactly this — which is how "no family was declared" is told apart
    // from "a family was declared and did not resolve" (R1).
    const defaultFamily = window.getComputedStyle(document.documentElement).fontFamily;

    const all = Array.from(svg.querySelectorAll('*'));
    const elements: RawElementReading[] = [];
    const texts: RawTextReading[] = [];

    for (let i = 0; i < all.length; i++) {
        const el = all[i] as Element;
        const tag = el.tagName.toLowerCase();
        if (SKIP.includes(tag) || inSkipped(el)) continue;
        if (!('getBBox' in el) || typeof (el as SVGGraphicsElement).getBBox !== 'function') continue;
        const g = el as SVGGraphicsElement;
        const cs = window.getComputedStyle(g);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        let geom: Box | null = null;
        try {
            const bb = g.getBBox();
            geom = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
        } catch {
            geom = null;
        }
        if (!geom || (geom.w === 0 && geom.h === 0)) continue;

        let totalLength: number | null = null;
        const geometry = g as unknown as { getTotalLength?: () => number };
        if (typeof geometry.getTotalLength === 'function') {
            try {
                totalLength = geometry.getTotalLength();
            } catch {
                totalLength = null;
            }
        }
        const pathLengthRaw = Number(el.getAttribute('pathLength'));
        let from: number | null = null;
        let to: number | null = null;
        for (const anim of Array.from(el.children)) {
            if (anim.tagName.toLowerCase() !== 'animate') continue;
            if ((anim.getAttribute('attributeName') ?? '') !== 'stroke-dashoffset') continue;
            const values = (anim.getAttribute('values') ?? '').split(';').map(Number).filter((n) => Number.isFinite(n));
            if (values.length >= 2) {
                from = values[0] as number;
                to = values[values.length - 1] as number;
            } else {
                const f = Number(anim.getAttribute('from'));
                const t = Number(anim.getAttribute('to'));
                if (Number.isFinite(f)) from = f;
                if (Number.isFinite(t)) to = t;
            }
        }

        const fillOpacity = Number(cs.fillOpacity || '1');
        const opacity = Number(cs.opacity || '1');
        elements.push({
            index: i,
            id: el.getAttribute('id') ?? '',
            tag,
            box: userBox(el),
            geom,
            fill: cs.fill,
            opaque: fillOpacity >= 0.99 && opacity >= 0.99 && cs.fill !== 'none',
            strokeWidth: Number.parseFloat(cs.strokeWidth || '0') || 0,
            dash: cs.strokeDasharray,
            totalLength,
            pathLengthAttr: Number.isFinite(pathLengthRaw) && pathLengthRaw > 0 ? pathLengthRaw : null,
            containedBy: [],
            dashOffsetFrom: from,
            dashOffsetTo: to,
        });

        if (tag === 'text') {
            const attrFamily = el.getAttribute('font-family');
            const cssFamily = cs.fontFamily;
            const hasDeclaration = attrFamily !== null || cssFamily !== defaultFamily;
            const declared = hasDeclaration ? (attrFamily ?? cssFamily) : '';
            const list = (declared || cssFamily).split(',');
            const first = (list[0] ?? '').trim().replace(/^["']|["']$/g, '');
            const boxRefId = el.getAttribute('data-box');
            const clip = /url\(['"]?#([^)'"]+)/.exec(el.getAttribute('clip-path') ?? '');
            const refId = boxRefId ?? (clip ? (clip[1] as string) : null);
            let declaredBox: Box | null = null;
            if (refId) {
                const ref = svg.querySelector(`#${CSS.escape(refId)}`);
                if (ref && typeof (ref as SVGGraphicsElement).getBBox === 'function') {
                    const rb = (ref as SVGGraphicsElement).getBBox();
                    declaredBox = { x: rb.x, y: rb.y, w: rb.width, h: rb.height };
                }
            }
            const sample = el.textContent ?? '';
            texts.push({
                index: i,
                id: el.getAttribute('id') ?? '',
                text: sample,
                box: geom,
                declaredBoxId: refId,
                declaredBox,
                declaredFamily: declared,
                firstFamily: first,
                resolvedFamily: cssFamily,
                firstFamilyResolved: hasDeclaration && resolves(first, sample || 'Hamburgefonstiv'),
            });
        }
    }

    // Containment by SAMPLED FILL (step 1.2). A second pass rather than a
    // branch in the loop above, because it needs every element to exist first.
    // `isPointInFill` is what the renderer itself answers with, so a near-white
    // shape beside a ring is no longer "inside" it for having a smaller box.
    for (const inner of elements) {
        if (!inner.geom) continue;
        const cx = inner.geom.x + inner.geom.w / 2;
        const cy = inner.geom.y + inner.geom.h / 2;
        for (const outer of elements) {
            if (outer.index === inner.index) continue;
            const node = all[outer.index] as unknown as {
                isPointInFill?: (p: { x: number; y: number }) => boolean;
            };
            if (typeof node.isPointInFill !== 'function') continue;
            try {
                if (node.isPointInFill({ x: cx, y: cy })) inner.containedBy.push(outer.index);
            } catch {
                // A node that refuses the question answers "not contained",
                // which is the safe direction: it produces no finding.
            }
        }
    }
    return { viewBox, elements, texts };
}

function readAccessibleNamesInPage(): string[] {
    const out: string[] = [];
    for (const svg of Array.from(document.querySelectorAll('svg'))) {
        const role = svg.getAttribute('role') ?? '';
        if (svg.getAttribute('aria-hidden') === 'true') continue;
        if (!/^(img|graphics-document|graphics-symbol)$/.test(role)) continue;
        const label = svg.getAttribute('aria-label');
        if (label) {
            out.push(label.trim());
            continue;
        }
        const by = svg.getAttribute('aria-labelledby');
        if (by) {
            const ref = document.getElementById(by.split(/\s+/)[0] ?? '');
            out.push((ref?.textContent ?? '').trim());
            continue;
        }
        const title = svg.querySelector(':scope > title');
        if (title) out.push((title.textContent ?? '').trim());
    }
    for (const el of Array.from(document.querySelectorAll('[role="img"]:not(svg)'))) {
        const label = el.getAttribute('aria-label');
        if (label) out.push(label.trim());
    }
    return out.filter((n) => n !== '');
}

/** Seconds to the end of one iteration of the longest animation; 0 when static. */
function readAnimationEndInPage(): number {
    let end = 0;
    const seconds = (raw: string | null): number => {
        if (!raw) return 0;
        const m = /^\s*([\d.]+)\s*(ms|s)?\s*$/.exec(raw);
        if (!m) return 0;
        const v = Number(m[1]);
        return m[2] === 'ms' ? v / 1000 : v;
    };
    for (const el of Array.from(document.querySelectorAll('animate,animateTransform,animateMotion,animateColor,set'))) {
        const dur = seconds(el.getAttribute('dur'));
        const rc = el.getAttribute('repeatCount');
        const reps = rc && rc !== 'indefinite' && Number.isFinite(Number(rc)) ? Number(rc) : 1;
        end = Math.max(end, dur * reps);
    }
    for (const anim of document.getAnimations()) {
        const timing = anim.effect?.getComputedTiming();
        const d = typeof timing?.duration === 'number' ? timing.duration / 1000 : 0;
        end = Math.max(end, d);
    }
    return end;
}

/**
 * A declared time, held. `screenshot({ animations: 'disabled' })` does NOT
 * freeze SMIL (R6) — `pauseAnimations()` plus `setCurrentTime()` does.
 */
function seekInPage(t: number): void {
    for (const svg of Array.from(document.querySelectorAll('svg'))) {
        const s = svg as SVGSVGElement;
        if (typeof s.pauseAnimations === 'function') {
            s.pauseAnimations();
            s.setCurrentTime(t);
        }
    }
    for (const anim of document.getAnimations()) {
        anim.pause();
        anim.currentTime = t * 1000;
    }
}

// ---------------------------------------------------------------------------
// Assembling the reading
// ---------------------------------------------------------------------------

function applyGeometry(reading: AssetReading, raw: RawAssetReading, vb: ViewBox | null): void {
    const EPS = 1e-6;
    let box: Box | null = null;
    for (const el of raw.elements) {
        const b = el.box ?? el.geom;
        if (!b) continue;
        box = box
            ? {
                  x: Math.min(box.x, b.x),
                  y: Math.min(box.y, b.y),
                  w: Math.max(box.x + box.w, b.x + b.w) - Math.min(box.x, b.x),
                  h: Math.max(box.y + box.h, b.y + b.h) - Math.min(box.y, b.y),
              }
            : { ...b };
        if (vb) {
            const outLeft = b.x < vb.x - EPS;
            const outTop = b.y < vb.y - EPS;
            const outRight = b.x + b.w > vb.x + vb.w + EPS;
            const outBottom = b.y + b.h > vb.y + vb.h + EPS;
            if (outLeft || outTop || outRight || outBottom) {
                reading.outside_view_box.push({
                    index: el.index,
                    id: el.id,
                    tag: el.tag,
                    box: b,
                    wholly_outside:
                        b.x + b.w <= vb.x || b.y + b.h <= vb.y || b.x >= vb.x + vb.w || b.y >= vb.y + vb.h,
                });
            }
        }
    }
    reading.painted_box = box;
    if (box && vb && vb.w > 0 && vb.h > 0) {
        const clipped = {
            x0: Math.max(box.x, vb.x),
            y0: Math.max(box.y, vb.y),
            x1: Math.min(box.x + box.w, vb.x + vb.w),
            y1: Math.min(box.y + box.h, vb.y + vb.h),
        };
        const area = Math.max(0, clipped.x1 - clipped.x0) * Math.max(0, clipped.y1 - clipped.y0);
        reading.fill_ratio = area / (vb.w * vb.h);
    }

    for (const t of raw.texts) {
        const declaredBox = t.declaredBox ?? (vb ? { x: vb.x, y: vb.y, w: vb.w, h: vb.h } : t.box);
        reading.texts.push({
            index: t.index,
            id: t.id,
            text: t.text,
            box: t.box,
            declared_box_id: t.declaredBoxId,
            declared_box: declaredBox,
            fits:
                t.box.x >= declaredBox.x - 0.5 &&
                t.box.y >= declaredBox.y - 0.5 &&
                t.box.x + t.box.w <= declaredBox.x + declaredBox.w + 0.5 &&
                t.box.y + t.box.h <= declaredBox.y + declaredBox.h + 0.5,
            declared_family: t.declaredFamily,
            first_family: t.firstFamily,
            resolved_family: t.resolvedFamily,
            first_family_resolved: t.firstFamilyResolved,
        });
    }

    for (const el of raw.elements) {
        if (el.dashOffsetFrom === null || el.dashOffsetTo === null) continue;
        if (!el.totalLength || el.totalLength <= 0) continue;
        const dashFirst = Number.parseFloat(el.dash.split(/[\s,]+/)[0] ?? '');
        if (!Number.isFinite(dashFirst) || dashFirst <= 0) continue;
        const scale = el.pathLengthAttr ? el.totalLength / el.pathLengthAttr : 1;
        reading.draw_on.push({
            index: el.index,
            id: el.id,
            total_length: el.totalLength,
            path_length_attr: el.pathLengthAttr,
            dash_units: dashFirst * scale,
            offset_from: el.dashOffsetFrom * scale,
            offset_to: el.dashOffsetTo * scale,
            dead_fraction: drawOnDeadFraction(
                dashFirst * scale,
                el.dashOffsetFrom * scale,
                el.dashOffsetTo * scale,
                el.totalLength,
            ),
        });
    }

    // Near-white paint where the source shows a hole (S5). Geometry, not pixels:
    // an opaque near-white shape wholly inside a non-near-white painted shape is
    // a filled hole, on any background — which is why no render is needed to
    // decide it and why the dark capture above is confirmation rather than input.
    const isNearWhite = (fill: string): boolean => {
        const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(fill);
        if (!m) return false;
        return [m[1], m[2], m[3]].every((c) => Number(c) >= NEAR_WHITE_CHANNEL);
    };
    for (const inner of raw.elements) {
        if (!inner.opaque || !isNearWhite(inner.fill)) continue;
        if (!inner.geom) continue;
        // Step 1.2: containment is the SAMPLED fill, computed in-page by
        // `isPointInFill`, not a bounding-box comparison. A box test calls a
        // near-white shape "inside" a ring, an L or a crescent it never
        // touches, which is how this rule came to fire six times on paint an
        // owner had deliberately chosen.
        const host = raw.elements.find(
            (o) => inner.containedBy.includes(o.index) && o.opaque && !isNearWhite(o.fill),
        );
        if (host) {
            reading.near_white_regions.push({
                index: inner.index,
                id: inner.id,
                fill: inner.fill,
                enclosed_by: host.id || `${host.tag}@${host.index}`,
                centre: { x: inner.geom.x + inner.geom.w / 2, y: inner.geom.y + inner.geom.h / 2 },
                // Filled in by the source sampling when a registered raster is
                // supplied. Absent evidence stays absent.
                source_verdict: 'no-source',
            });
        }
    }
}

/**
 * Graded against the incumbent set, both sides measured the same way (2.2).
 *
 * Exported so the grading can be exercised without launching a browser: the
 * two findings it carries are a padding-method mismatch and a reference set
 * dropped silently, and neither needs a render to reproduce.
 */
export function gradeIconGrid(
    file: string,
    vb: ViewBox | null,
    elements: SvgElement[],
    iconSet: readonly string[],
    /**
     * The RENDERED painted box. Kept in the signature and deliberately unread:
     * it is what the candidate's padding used to come from (finding 2.2), and
     * dropping the parameter would make a caller that still passes it look
     * correct while silently changing which argument lands where. Named with a
     * leading underscore so the linter agrees it is not used.
     */
    _paintedBox: Box | null,
): IconGridReading {
    const self = path.resolve(file);
    const { refs, skipped } = readIconReferencesDetailed(
        iconSet.map((f) => path.resolve(f)).filter((f) => f !== self),
    );
    const comparable = vb ? refs.filter((r) => r.viewBox.w === vb.w && r.viewBox.h === vb.h) : [];
    const strokes = new Set<number>();
    for (const el of elements) {
        if (el.closing) continue;
        const sw = Number(el.attrs['stroke-width']);
        if (Number.isFinite(sw) && sw > 0) strokes.add(sw);
    }
    const strokeWidth = strokes.size > 0 ? Math.max(...strokes) : null;
    /**
     * Finding 2.2: BOTH sides are centreline extents now.
     *
     * The candidate's padding used to come from `painted_box`, a RENDERED box
     * that includes half the stroke and the caps, while the references came
     * from raw coordinates. A candidate matching a reference exactly therefore
     * measured one half-stroke less padding than it — latent rather than live
     * only because the shipped icon pair happens to sit outside the band, so a
     * new fixture at a different stroke width would have made it fire on a
     * clean twin (Risk 7).
     *
     * Fixed by measuring, not by widening a threshold: `centrelineExtent` is
     * the same function the references go through. `painted_box` keeps its own
     * meaning everywhere else in the reading — it is simply not the thing to
     * compare against a centreline.
     */
    const selfExt = centrelineExtent(elements.filter((el) => el.name !== 'svg'));
    const padding = vb && selfExt ? paddingFromExtent(vb, selfExt) : null;
    if (comparable.length === 0) {
        const unreadable = skipped.length
            ? ` ${String(skipped.length)} supplied file(s) could not be read: ${skipped
                  .map((s) => `${path.basename(s.file)} (${s.reason})`)
                  .join('; ')}.`
            : '';
        return {
            status: 'unverified',
            reference_files: refs.map((r) => path.basename(r.file)),
            reference_stroke_widths: [],
            reference_padding: [],
            stroke_width: strokeWidth,
            padding,
            reason:
                refs.length === 0
                    ? (iconSet.length === 0
                          ? 'no icon reference set was supplied, so the incumbent grid was never read (E6)'
                          : 'an icon reference set was supplied but no file in it yielded a reading, so there is no grid to compare against') +
                      unreadable
                    : 'no reference icon shares this viewBox size, so there is no grid to compare against' +
                      unreadable,
        };
    }
    const refStrokes = [...new Set(comparable.flatMap((r) => r.strokeWidths))].sort((a, b) => a - b);
    const refPadding = [...new Set(comparable.map((r) => r.padding))].sort((a, b) => a - b);
    return {
        status: 'read',
        reference_files: comparable.map((r) => path.basename(r.file)),
        reference_stroke_widths: refStrokes,
        reference_padding: refPadding,
        stroke_width: strokeWidth,
        padding,
        reason: `read from ${comparable.length} incumbent SVG(s)`,
    };
}

function deriveFindings(r: AssetReading): AssetFinding[] {
    const out: AssetFinding[] = [];

    if (r.fill_ratio !== null && r.fill_ratio < r.fill_ratio_threshold) {
        out.push({
            rule: 'structure/loose-viewbox',
            severity: 'warning',
            detail:
                `fill ratio ${r.fill_ratio.toFixed(3)} is below the ${r.asset_class} threshold ` +
                `${r.fill_ratio_threshold} (${r.fill_ratio_threshold_source}) — the painted box leaves the rest of the viewBox empty`,
        });
    }

    for (const t of r.texts) {
        if (!t.fits) {
            out.push({
                rule: 'geometry/text-overflows-box',
                severity: 'warning',
                detail:
                    `<text>${t.id ? ` #${t.id}` : ''} renders ${t.box.w.toFixed(1)} x ${t.box.h.toFixed(1)} units at ` +
                    `(${t.box.x.toFixed(1)}, ${t.box.y.toFixed(1)}), outside its declared box ` +
                    `${t.declared_box_id ? `#${t.declared_box_id} ` : '(the viewBox) '}` +
                    `${t.declared_box.w.toFixed(1)} x ${t.declared_box.h.toFixed(1)}`,
            });
        }
        if (!t.first_family_resolved) {
            out.push({
                rule: 'geometry/default-font-fallback',
                severity: 'warning',
                detail: t.declared_family
                    ? `declared family "${t.first_family}" did not resolve; the renderer used "${t.resolved_family}"`
                    : `no font-family is declared, so the label resolved to the renderer default "${t.resolved_family}"`,
            });
        }
    }

    for (const d of r.draw_on) {
        if (d.dead_fraction >= DRAW_ON_DEAD_TIME_THRESHOLD) {
            out.push({
                rule: 'motion/draw-on-dead-time',
                severity: 'warning',
                detail:
                    `${(d.dead_fraction * 100).toFixed(1)}% of the draw-on duration paints nothing new: a ` +
                    `${d.dash_units.toFixed(1)}-unit dash on a ${d.total_length.toFixed(2)}-unit path` +
                    `${d.path_length_attr === null ? ' with no pathLength declared' : ''}`,
            });
        }
    }

    for (const n of r.near_white_regions) {
        // Step 1.2: a finding needs EVIDENCE of a hole. Without a registered
        // source the region is recorded in the manifest and nothing is pushed —
        // the rule's message was always conditional on what the source shows,
        // and nothing was reading it.
        if (n.source_verdict !== 'hole') continue;
        out.push({
            rule: 'geometry/near-white-hole',
            severity: 'warning',
            detail:
                `${n.fill} is painted opaquely inside ${n.enclosed_by}, and the registered source shows its own ` +
                'background there — a hole must be cut out, not painted near-white, or it reads white on a dark ' +
                'background (S5)',
        });
    }

    if (r.icon_grid?.status === 'read') {
        const g = r.icon_grid;
        const strokeOff =
            g.stroke_width !== null &&
            g.reference_stroke_widths.length > 0 &&
            !g.reference_stroke_widths.some((s) => Math.abs(s - (g.stroke_width as number)) < 0.01);
        const minRefPadding = Math.min(...g.reference_padding);
        const paddingOff = g.padding !== null && g.padding < minRefPadding - 0.01;
        if (strokeOff || paddingOff) {
            out.push({
                rule: 'geometry/icon-off-grid',
                severity: 'warning',
                detail:
                    `stroke ${g.stroke_width ?? 'none'} / padding ${g.padding?.toFixed(2) ?? 'none'} against the incumbent set's ` +
                    `stroke ${g.reference_stroke_widths.join('/')} and padding ${g.reference_padding.join('/')} ` +
                    `(read from ${g.reference_files.join(', ')})`,
            });
        }
    }

    // Measured, and previously derived nothing: an inline asset whose route was
    // read in a real browser and did NOT stop the motion produced an empty
    // findings array, so the one layer that can actually see the failure stayed
    // silent about it.
    if (r.reduced_motion.witnessable && r.reduced_motion.frames_equal === false) {
        out.push({
            rule: 'motion/reduced-motion-route-does-not-stop-it',
            severity: 'error',
            detail:
                'under an emulated prefers-reduced-motion: reduce the frames still differ — the route this ' +
                'file declares does not stop its animation, which is the R4 failure measured rather than inferred',
        });
    }

    // Step 1.1: gated on the duration, not only on the host's route. A host
    // with no `<picture>` route is correct for a file that does not move, and
    // this used to fire on all six files of a real conversion session — none
    // of which carries `<animate`, `@keyframes` or `animation`. A warning that
    // appears on every file is a warning an operator learns to scroll past,
    // which is Risk 1 of the parent roadmap arriving by a different door.
    const delivered = r.reduced_motion.delivered_animates;
    const moves = delivered === null || delivered === undefined ? r.animation_duration_s > 0 : delivered;
    if (r.reduced_motion.host_picture_route === false && moves) {
        out.push({
            rule: 'motion/img-delivery-no-static-route',
            severity: 'warning',
            detail:
                'an animated SVG is delivered through <img> or a CSS background and the host carries no ' +
                '<picture><source media="(prefers-reduced-motion: reduce)"> route — the emulated preference ' +
                'does not reach an image document (R5), so this is the only place the route can live',
        });
    }

    for (const name of r.duplicate_accessible_names) {
        out.push({
            rule: 'accessibility/duplicate-accessible-name',
            severity: 'warning',
            detail: `"${name}" names more than one graphic on this page (R7)`,
        });
    }

    return out;
}

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

interface ReducedMotionSpec {
    url: string;
    hostHtml: string | null;
    width: number;
    height: number;
    background: string;
    cssWidth: number;
    blocked: string[];
    delivery: DeliveryMode;
    duration: number;
    isHost: boolean;
    /** Directory the host's relative image references resolve against. */
    hostDir: string;
}

async function readReducedMotion(
    context: Awaited<ReturnType<Browser['newContext']>>,
    spec: ReducedMotionSpec,
): Promise<ReducedMotionReading> {
    const R5 =
        'an image document is unreachable by media emulation; the host\'s <picture> route is the thing to check';
    const page = await openPage(context, {
        url: spec.url,
        hostHtml: spec.hostHtml,
        hostBasename: HOST_BASENAME,
        width: spec.width,
        height: spec.height,
        background: spec.background,
        cssWidth: spec.cssWidth,
        blocked: spec.blocked,
        reducedMotion: true,
    });
    try {
        if (spec.delivery === 'img' || spec.delivery === 'css-bg') {
            const seen = await page.evaluate(() => {
                const sources = Array.from(document.querySelectorAll('picture > source'));
                const route = sources.some((s) =>
                    /prefers-reduced-motion\s*:\s*reduce/i.test(s.getAttribute('media') ?? ''),
                );
                // Every file this host DELIVERS, by its own reference — the
                // `<img>` src, each `<source srcset>`, and any CSS
                // background-image url. Names only; they are resolved on disk.
                const refs = new Set<string>();
                for (const img of Array.from(document.querySelectorAll('img'))) {
                    const src = img.getAttribute('src');
                    if (src) refs.add(src);
                }
                for (const s of sources) {
                    for (const part of (s.getAttribute('srcset') ?? '').split(',')) {
                        const url = part.trim().split(/\s+/)[0];
                        if (url) refs.add(url);
                    }
                }
                for (const el of Array.from(document.querySelectorAll('*'))) {
                    const bg = window.getComputedStyle(el).backgroundImage;
                    const m = /url\((['"]?)([^)'"]+)\1\)/.exec(bg);
                    if (m?.[2]) refs.add(m[2]);
                }
                return { route, refs: [...refs] };
            });
            // Step 1.1: the question is about the DELIVERED file, and the host
            // page cannot answer it — its own duration is 0 for a spinner and
            // for a static logo alike.
            let animates: boolean | null = null;
            for (const ref of seen.refs) {
                if (/^(?:https?:|data:)/i.test(ref)) continue;
                const abs = path.resolve(spec.hostDir, ref.replace(/^file:\/\//, ''));
                if (!/\.svg$/i.test(abs)) continue;
                let body: string;
                try {
                    body = fs.readFileSync(abs, 'utf8');
                } catch {
                    continue;
                }
                const moves = hasSmilMarkup(body) || hasCssAnimation(body);
                animates = (animates ?? false) || moves;
            }
            return {
                witnessable: false,
                frames_equal: null,
                reason: R5,
                host_picture_route: seen.route,
                delivered_animates: animates,
            };
        }
        if (spec.duration <= 0) {
            return { witnessable: true, frames_equal: true, reason: 'nothing animates in this file' };
        }
        await page.evaluate(seekInPage, 0);
        const a = sha256(await page.screenshot());
        await page.evaluate(seekInPage, spec.duration / 2);
        const b = sha256(await page.screenshot());
        return {
            witnessable: true,
            frames_equal: a === b,
            reason: 'inline delivery: the emulated preference reaches this document',
        };
    } finally {
        await page.close();
    }
}
