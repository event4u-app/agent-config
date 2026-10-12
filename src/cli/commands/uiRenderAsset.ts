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
 * NO NETWORK, NO SCRIPT, NO FILE OUTSIDE THE PROJECT — `uiRenderAssetIsolation.ts`.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Browser, Page, Route } from '@playwright/test';

import { elementExtent, parseElements, readViewBox, vectorVerdict } from '../../scripts/lint_svg_asset.js';
import type { DeliveryMode, SvgElement, ViewBox } from '../../scripts/lint_svg_asset.js';
import { hasCssAnimation, hasSmilMarkup } from '../../scripts/_lib/svg_motion.js';
import { compareGeometry, sampleSource, type Registration } from './uiRenderAssetCompare.js';
import { readGrounds, type OpenPage } from './uiRenderAssetGrounds.js';
import { gradeIconGrid } from './uiRenderAssetGrid.js';
import { fileRootsFor, injectStyle, requestAllowed } from './uiRenderAssetIsolation.js';
export * from './uiRenderAssetGrid.js';
import {
    ASSET_CLASSES,
    BRAND_TOKEN_PATHS,
    DEFAULT_FILL_RATIO_THRESHOLDS,
    DEFAULT_GEOMETRY_TOLERANCES,
    DRAW_ON_DEAD_TIME_THRESHOLD,
    FALLBACK_BACKGROUNDS,
    BLEED_SHARE_THRESHOLD,
    FOREIGN_CONTENT_SHARE_THRESHOLD,
    HOLE_ATTRIBUTE,
    HOST_BASENAME,
    ICON_SIZES,
    LOW_CONTRAST_SHARE_THRESHOLD,
    MARK_SMALL_SIZES,
    NEAR_WHITE_CHANNEL,
    type AssetClass,
    type AssetFinding,
    type AssetReading,
    type Box,
    type FrameReading,
    type GeometryTolerance,
    type ReducedMotionReading,
} from './uiRenderAssetTypes.js';

export * from './uiRenderAssetTypes.js';
export * from './uiRenderAssetCompare.js';

// ---------------------------------------------------------------------------
// Pure readings — no browser
// ---------------------------------------------------------------------------

/**
 * The cost reading — step 3.2 of `road-to-svg-from-a-live-session`.
 *
 * Counted from the bytes, so it needs no renderer and is the same number on
 * every machine. `coordinates` counts the numbers inside `d` and `points`,
 * which is the axis that makes a traced file hostile to edit: one accepted
 * mark went 5.3 KB to 49.5 KB in a conversion and nothing measured it.
 */
export function costReading(content: string, elements: readonly SvgElement[]): AssetReading['cost'] {
    let coordinates = 0;
    for (const el of elements) {
        if (el.closing) continue;
        for (const key of ['d', 'points']) {
            const v = el.attrs[key];
            if (!v) continue;
            coordinates += (v.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? []).length;
        }
    }
    const open = elements.filter((el) => !el.closing);
    return {
        bytes: Buffer.byteLength(content, 'utf8'),
        elements: open.length,
        paths: open.filter((el) => el.name === 'path').length,
        gradients: open.filter((el) => el.name === 'lineargradient' || el.name === 'radialgradient').length,
        coordinates,
    };
}

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

/**
 * Icons at 16/24/48; a MARK additionally at 16 and 32; every other class at 1x
 * and 2x its intrinsic size.
 *
 * Step 4.3 of `road-to-svg-from-a-live-session`. A review sent an accepted
 * mark back because its face turned to mush at 32 px, and the only way anybody
 * could know that was to look — there was no capture at a small size to look
 * AT. Legibility stays a look; the capture is the evidence that the look
 * happened, which is the same split the rest of this profile keeps.
 *
 * The small sizes come FIRST so a reader scanning the manifest meets them
 * before the 1x the file was designed at.
 */
/**
 * The LARGEST capture, which is not the last one.
 *
 * Finding 6 of the third completion review. `assetSizes` PREPENDS
 * `MARK_SMALL_SIZES` for a mark — so a reader taking `sizes[sizes.length - 1]`
 * gets the 2x scaled size, which is smaller than 32 whenever the intrinsic
 * width is under 16. Reproduced: intrinsic width 10 gives a last entry of 20
 * against a maximum of 32, so the geometry pass read the asset at a size it
 * was not biggest at and the grounds reading used a capture that was not the
 * largest taken.
 *
 * A named function rather than an inline `reduce`, because the defect was
 * exactly that the selection looked obvious enough not to be read — and an
 * inline expression is not something a test can hold.
 */
export function biggestSize(
    sizes: ReadonlyArray<{ label: string; width: number; height: number }>,
): { label: string; width: number; height: number } {
    let best: { label: string; width: number; height: number } | null = null;
    for (const s of sizes) if (best === null || s.width > best.width) best = s;
    return best ?? { label: '1x', width: 64, height: 64 };
}

export function assetSizes(
    cls: AssetClass,
    intrinsic: { width: number; height: number },
): Array<{ label: string; width: number; height: number }> {
    if (cls === 'icon') {
        return ICON_SIZES.map((px) => ({ label: `${px}`, width: px, height: px }));
    }
    const ratio = intrinsic.height / intrinsic.width;
    const scaled = [1, 2].map((k) => ({
        label: `${k}x`,
        width: Math.round(intrinsic.width * k),
        height: Math.round(intrinsic.width * k * ratio),
    }));
    if (cls !== 'mark') return scaled;
    const small = MARK_SMALL_SIZES.map((px) => ({
        label: `${px}`,
        width: px,
        height: Math.max(1, Math.round(px * ratio)),
    }));
    return [...small, ...scaled];
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
    const gt = obj.geometry_tolerances as Record<string, Partial<GeometryTolerance>> | undefined;
    // EVERY SUPPLIED FIELD IS A NUMBER, not just the one the guard used to
    // name. Finding 5 of the review of this branch: the merge closed the
    // missing-key hole and left the wrong-TYPE one, so
    // `max_boundary_distance_units: "lots"` was accepted as manifest-sourced
    // and returned verbatim — and `0 <= "lots"` is false, which is the same
    // fail-closed comparison the missing key produced. A threshold that is not
    // a number is not a threshold.
    const wellTyped = (t: Partial<GeometryTolerance> | undefined): boolean =>
        t !== undefined &&
        typeof t.silhouette_iou_min === 'number' &&
        Object.values(t).every((v) => typeof v === 'number' && Number.isFinite(v));
    if (gt && ASSET_CLASSES.every((c) => wellTyped(gt[c]))) {
        // MERGED PER CLASS, not spread over the class. Finding 3 of the sixth
        // completion review: the validation checks one field per class and the
        // spread then replaced the whole class object, so a manifest naming
        // every class but supplying only `silhouette_iou_min` was accepted as
        // `geometrySource: manifest` with `max_boundary_distance_units`
        // UNDEFINED.
        //
        // THE DIRECTION, corrected — the first version of this comment had it
        // backwards and the review of this branch caught it. `undefined` does
        // not make the boundary check vanish: `maxDistance <= undefined` is
        // FALSE, so every comparison failed it, and a pixel-perfect render
        // (iou 1.0, boundary distance 0.0) scored `fail`. It was fail-CLOSED,
        // not silently absent. That is the better of the two directions and
        // still wrong: a manifest the reader was told to trust refused every
        // file it was applied to.
        const merged = {} as Record<AssetClass, GeometryTolerance>;
        for (const c of ASSET_CLASSES) {
            merged[c] = { ...DEFAULT_GEOMETRY_TOLERANCES[c], ...gt[c] };
        }
        out.geometry = merged;
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

/** Does this element declare itself less than fully opaque? */
export function isDeclaredTranslucent(el: SvgElement): boolean {
    const style = el.attrs['style'] ?? '';
    const read = (key: string): number | null => {
        const fromStyle = new RegExp(`(?:^|;)\\s*${key}\\s*:\\s*([^;]+)`).exec(style)?.[1];
        const raw = (fromStyle ?? el.attrs[key] ?? '').trim();
        if (raw === '') return null;
        // A PERCENTAGE IS LEGAL CSS AND `Number()` CANNOT READ IT.
        //
        // Finding 8 of the third completion review: `Number('50%')` is NaN, so
        // `fill-opacity="50%"` read as "not declared translucent" and every
        // pixel of that half-transparent shape was counted as background
        // bleeding through the author's paint — the exact false warning the
        // comment above this function says the declaration prevents.
        const pct = /^([+-]?(?:\d*\.\d+|\d+\.?))\s*%$/.exec(raw);
        const v = pct ? Number(pct[1]) / 100 : Number(raw);
        return Number.isFinite(v) ? v : null;
    };
    // `stroke-opacity` belongs here for the same reason the other two do: a
    // stroke the author made translucent is a declaration, not a seam. It was
    // missing from the list, which finding 8 also names.
    for (const key of ['opacity', 'fill-opacity', 'stroke-opacity']) {
        const v = read(key);
        if (v !== null && v < 0.99) return true;
    }
    return false;
}

/** Boxes, in user units, of every element matching `pick`. */
function extentsOf(elements: readonly SvgElement[], pick: (el: SvgElement) => boolean): Box[] {
    const out: Box[] = [];
    for (const el of elements) {
        if (el.closing || !pick(el)) continue;
        const b = elementExtent(el);
        if (b) out.push({ x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY });
    }
    return out;
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
        cost: costReading(content, elements),
        grounds: [],
        network: { aborted: 0, blocked_urls: blocked },
        findings: [],
        reduced_motion: { witnessable: false, frames_equal: null, reason: 'not read' },
    };

    const hostHtml = isHost ? null : inlineHost(content);
    const targetUrl = isHost ? `file://${opts.file}` : `file://${path.join(dir, HOST_BASENAME)}`;

    const fileRoots = fileRootsFor(opts.projectRoot, opts.file);
    const context = await browser.newContext({ javaScriptEnabled: false });
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
                    fileRoots,
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
        const biggest = biggestSize(sizes);
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
            fileRoots,
        });

        if (!isHost) {
            const raw = await page.evaluate(readAssetInPage, { nearWhite: NEAR_WHITE_CHANNEL });
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
            fileRoots,
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
        // Steps 4.1 and 4.2: the per-ground readings, taken at the biggest
        // size so the counts are not dominated by anti-aliasing. Not for a
        // host document — the silhouette of a page is the page.
        if (!isHost) {
            const confinedOpen: OpenPage = (ctx, spec) => openPage(ctx, { ...spec, fileRoots });
            reading.grounds = await readGrounds(context, confinedOpen, {
                url: targetUrl,
                hostHtml,
                width: Math.max(biggest.width, 64),
                height: Math.max(biggest.height, 64),
                cssWidth: biggest.width,
                blocked,
                backgrounds,
                holeBoxes: extentsOf(elements, (el) => (el.attrs[HOLE_ATTRIBUTE] ?? '') !== ''),
                // Finding 7: a shape the author made translucent is not a seam.
                softBoxes: extentsOf(elements, isDeclaredTranslucent),
                viewBox: vb,
            });
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
    /** `file:` requests resolving outside every one of these directories are aborted. */
    fileRoots: readonly string[];
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
        if (!requestAllowed(url, spec.fileRoots)) {
            spec.blocked.push(url);
            await route.abort();
            return;
        }
        await route.continue();
    });
    await page.goto(spec.url, { waitUntil: 'load', timeout: 30_000 });
    await injectStyle(
        page,
        `html,body{margin:0;padding:0;background:${spec.background}}` +
            `body>svg{display:block;width:${spec.cssWidth}px;height:auto}`,
    );
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

function readAssetInPage(args: { nearWhite: number }): RawAssetReading {
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
    // Finding 9: the OUTER loop is restricted to the only consumer. The pass
    // used to call `isPointInFill` for every ordered pair of geometry-bearing
    // elements and `applyGeometry` then read `containedBy` for opaque
    // near-white elements alone — on the 195 KB, 355-gradient trace this change
    // cites as its motivation that is 10^5-10^6 cross-process calls whose
    // results are discarded. The reading is identical; only the pairs nobody
    // asks about are gone.
    //
    // The channel floor is PASSED, not spelled twice. Finding 10 of this
    // change's second completion review: a literal `237` on this side of the
    // page boundary and `NEAR_WHITE_CHANNEL` on the other, bound only by a
    // trailing comment, is the same shape as the dead constants this branch
    // fixes elsewhere — one of them changes and nothing says so. A
    // `page.evaluate` body cannot close over module scope, so it arrives as an
    // argument, exactly as `minContrast` does two files away.
    const NEAR_WHITE = args.nearWhite;
    const candidates = elements.filter((el) => {
        if (el.geom === null || !el.opaque) return false;
        const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(el.fill);
        return m !== null && [m[1], m[2], m[3]].every((c) => Number(c) >= NEAR_WHITE);
    });
    for (const inner of candidates) {
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
            // EVERY id, joined by a space. Finding 9 of the fifth completion
            // review: this read the first id only, while the static rule in
            // `svg_rules.ts` resolves the whole list — so for
            // `aria-labelledby="a b"` the two halves of one change disagreed
            // about what the accessible name IS, and the rendered reading
            // reported a shorter name than the file actually exposes. The
            // accname spec concatenates the referenced elements in order.
            const parts = by
                .split(/\s+/)
                .filter((id) => id !== '')
                .map((id) => (document.getElementById(id)?.textContent ?? '').trim())
                .filter((t) => t !== '');
            out.push(parts.join(' '));
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

    // Steps 4.1 and 4.2. Both name the GROUND they were read on, because
    // "the mark is hard to see" is not a property of the mark.
    for (const g of r.grounds) {
        if (g.background === 'dark' && g.silhouette_px > 0 && g.bleed_share > BLEED_SHARE_THRESHOLD) {
            out.push({
                rule: 'geometry/background-bleed-inside-silhouette',
                severity: 'warning',
                detail:
                    `${g.bleed_px} of ${g.silhouette_px} pixels inside the silhouette read as the ${g.background} ` +
                    `ground (${g.background_color}) — background showing THROUGH the graphic, which is what a ` +
                    'hairline seam between two abutting shapes looks like. Let the earlier surface reach about a ' +
                    `pixel under its neighbour, or declare the gap with ${HOLE_ATTRIBUTE} if it is meant to be there`,
            });
        }
        if (g.silhouette_px > 0 && g.low_contrast_share > LOW_CONTRAST_SHARE_THRESHOLD) {
            out.push({
                rule: 'accessibility/low-contrast-on-background',
                severity: 'warning',
                detail:
                    `${(g.low_contrast_share * 100).toFixed(0)} % of the painted pixels fall below a 3:1 contrast ` +
                    `ratio against the ${g.background} ground (${g.background_color}) — build a variant for that ` +
                    'ground, or name it as missing',
            });
        }
    }

    // Step 2.1: the two readings the subject-only comparison separates out.
    // Neither is folded into IoU, and neither is silent.
    const raster = r.comparison?.raster;
    if (raster) {
        if (raster.frame_edge_contact.length > 0) {
            out.push({
                rule: 'geometry/source-cut-by-frame',
                severity: 'warning',
                detail:
                    `the registered source runs into its frame on the ${raster.frame_edge_contact.join(', ')} ` +
                    'edge(s) — content cut by a crop agrees with a trace of that crop exactly, so the silhouette ' +
                    'reading cannot see the cut. Widen the crop and re-register before trusting the numbers',
            });
        }
        if (raster.foreign_content_share > FOREIGN_CONTENT_SHARE_THRESHOLD) {
            out.push({
                rule: 'geometry/foreign-content-in-frame',
                severity: 'warning',
                detail:
                    `${(raster.foreign_content_share * 100).toFixed(1)} % of the registered source's painted pixels ` +
                    'lie outside the subject — a neighbouring mark, a glow or a shadow inside the registration ' +
                    'frame. It is reported here and kept out of the silhouette and colour readings',
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
    const unread = r.reduced_motion.delivered_unreadable ?? [];
    // Finding 13. An unreadable delivered file is UNKNOWN, and unknown is
    // reported rather than passed: the page-duration fallback reads 0 for a
    // spinner and a static logo alike, so falling back to it here would be the
    // absent-is-not-clean failure the rest of this change argues against.
    const moves =
        unread.length > 0
            ? true
            : delivered === null || delivered === undefined
              ? r.animation_duration_s > 0
              : delivered;
    if (r.reduced_motion.host_picture_route === false && moves) {
        out.push({
            rule: 'motion/img-delivery-no-static-route',
            severity: 'warning',
            detail:
                (unread.length > 0
                    ? `${unread.join(', ')} could not be read, so whether it animates is unknown — reported ` +
                      'rather than passed. '
                    : '') +
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
    fileRoots: readonly string[];
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
        fileRoots: spec.fileRoots,
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
            const unreadable: string[] = [];
            for (const ref of seen.refs) {
                if (/^(?:https?:|data:)/i.test(ref)) continue;
                const abs = path.resolve(spec.hostDir, ref.replace(/^file:\/\//, ''));
                if (!/\.svg$/i.test(abs)) continue;
                let body: string;
                try {
                    body = fs.readFileSync(abs, 'utf8');
                } catch {
                    // Finding 13: an `.svg` this host DELIVERS that could not
                    // be read is absent evidence, and absent is not clean. It
                    // used to `continue` into the page-duration fallback, which
                    // that duration's own doc calls useless for an image
                    // delivery — so an animating file behind an unreadable path
                    // produced no warning at all.
                    unreadable.push(ref);
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
                ...(unreadable.length > 0 ? { delivered_unreadable: unreadable } : {}),
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
