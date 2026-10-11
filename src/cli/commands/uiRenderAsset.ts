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

import { parseElements, readViewBox, vectorVerdict } from '../../scripts/lint_svg_asset.js';
import type { DeliveryMode, SvgElement, ViewBox } from '../../scripts/lint_svg_asset.js';
import { hasCssAnimation, hasSmilMarkup } from '../../scripts/_lib/svg_motion.js';

// ---------------------------------------------------------------------------
// Declared constants — every one of them pre-registered in step 0.3
// ---------------------------------------------------------------------------

export const ASSET_CLASSES = ['icon', 'mark', 'illustration', 'diagram', 'animated'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/**
 * Per class, never global. A file is loose BELOW its class threshold.
 * Overridden by a `fill_ratio_thresholds` block in `--thresholds <file>`.
 */
export const DEFAULT_FILL_RATIO_THRESHOLDS: Readonly<Record<AssetClass, number>> = {
    icon: 0.3,
    mark: 0.45,
    illustration: 0.4,
    diagram: 0.35,
    animated: 0.35,
};

export interface GeometryTolerance {
    silhouette_iou_min: number;
    max_boundary_distance_units: number;
}

/** Step 2.6's tolerances. Overridden by `geometry_tolerances` in `--thresholds`. */
export const DEFAULT_GEOMETRY_TOLERANCES: Readonly<Record<AssetClass, GeometryTolerance>> = {
    icon: { silhouette_iou_min: 0.98, max_boundary_distance_units: 1 },
    mark: { silhouette_iou_min: 0.98, max_boundary_distance_units: 2 },
    illustration: { silhouette_iou_min: 0.96, max_boundary_distance_units: 3 },
    diagram: { silhouette_iou_min: 0.97, max_boundary_distance_units: 2 },
    animated: { silhouette_iou_min: 0.97, max_boundary_distance_units: 2 },
};

/**
 * Used ONLY when no `tokens.json` resolves. The manifest records
 * `source: "fallback"` whenever these are used, because a reader cannot
 * otherwise tell a project's own background from this module's guess.
 */
export const FALLBACK_BACKGROUNDS = { light: '#ffffff', dark: '#111111' } as const;

/** The four paths the brand resolver searches, in its order. First hit wins. */
export const BRAND_TOKEN_PATHS: readonly string[] = [
    'tokens.json',
    'assets/tokens.json',
    'resources/tokens.json',
    path.join('agents', 'settings', 'brand', 'tokens.json'),
];

/** Icon sizes are the three the incumbent sets ship at. Other classes: 1x and 2x. */
export const ICON_SIZES: readonly number[] = [16, 24, 48];

/**
 * Below this, a draw-on animation is not reported. The planted row reads
 * 0.283 (a 300-unit dash on a 215-unit path) and its twin reads 0.0, so the
 * band between them is wide; 0.05 is inside it with room on both sides.
 */
export const DRAW_ON_DEAD_TIME_THRESHOLD = 0.05;

/** A channel at or above this, with alpha 1, counts as near-white paint. */
const NEAR_WHITE_CHANNEL = 237;

/**
 * The synthetic host document. Fulfilled by the route handler at a URL inside
 * the asset's OWN directory, so a relative `href` inside the asset resolves
 * exactly as it would in place — without this module ever writing into the
 * directory it is reading.
 */
const HOST_BASENAME = '__agent-config-asset-host__.html';

/** Schemes a page may reach. Everything else is aborted and counted. */
const ALLOWED_SCHEMES = ['file:', 'data:', 'blob:', 'about:'];

// ---------------------------------------------------------------------------
// Manifest shapes — additive, keyed under `profile: "asset"` (step 2.2)
// ---------------------------------------------------------------------------

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface AssetSizeCapture {
    label: string;
    css_width: number;
    css_height: number;
    background: 'light' | 'dark';
    background_color: string;
    screenshot: string;
}

export interface OutsideViewBoxElement {
    index: number;
    id: string;
    tag: string;
    box: Box;
    wholly_outside: boolean;
}

export interface TextReading {
    index: number;
    id: string;
    text: string;
    box: Box;
    declared_box_id: string | null;
    declared_box: Box;
    fits: boolean;
    declared_family: string;
    first_family: string;
    resolved_family: string;
    first_family_resolved: boolean;
}

export interface DrawOnReading {
    index: number;
    id: string;
    total_length: number;
    path_length_attr: number | null;
    dash_units: number;
    offset_from: number;
    offset_to: number;
    dead_fraction: number;
}

export interface FrameReading {
    label: 'start' | 'mid' | 'end';
    t: number;
    digest: string;
}

export interface ReducedMotionReading {
    witnessable: boolean;
    /** Only meaningful when `witnessable` — `null` otherwise, never `true`. */
    frames_equal: boolean | null;
    reason: string;
    host_picture_route?: boolean;
}

export interface AssetFinding {
    rule: string;
    detail: string;
    severity: 'error' | 'warning';
}

export interface AssetReading {
    profile: 'asset';
    file: string;
    digest: string;
    asset_class: AssetClass;
    asset_class_inferred: boolean;
    delivery: DeliveryMode;
    view_box: ViewBox | null;
    intrinsic: { width: number; height: number };
    backgrounds: { light: string; dark: string; source: 'tokens' | 'fallback'; tokens_file: string | null };
    sizes: AssetSizeCapture[];
    readings_at: { css_width: number; css_height: number; background: 'light' | 'dark'; t: number } | null;
    true_vector: boolean;
    painted_box: Box | null;
    fill_ratio: number | null;
    fill_ratio_threshold: number;
    fill_ratio_threshold_source: 'manifest' | 'default';
    outside_view_box: OutsideViewBoxElement[];
    texts: TextReading[];
    accessible_names: Array<{ name: string; count: number }>;
    duplicate_accessible_names: string[];
    frames: FrameReading[];
    distinct_frames: number;
    draw_on: DrawOnReading[];
    icon_grid: IconGridReading | null;
    near_white_regions: Array<{ index: number; id: string; fill: string; enclosed_by: string }>;
    network: { aborted: number; blocked_urls: string[] };
    findings: AssetFinding[];
    comparison?: GeometryComparison;
    reduced_motion: ReducedMotionReading;
}

export interface IconGridReading {
    /** `unverified` when no reference icon shares this file's viewBox size (E6). */
    status: 'read' | 'unverified';
    reference_files: string[];
    reference_stroke_widths: number[];
    reference_padding: number[];
    stroke_width: number | null;
    padding: number | null;
    reason: string;
}

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

/**
 * Stroke width and padding of each reference icon, read from its own bytes.
 * Padding is the smallest distance from a viewBox edge to the painted geometry.
 * Nothing is declared here and no grid table is vendored (E6, Non-goals).
 */
export function readIconReferences(files: readonly string[]): IconReference[] {
    const out: IconReference[] = [];
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        const elements = parseElements(content);
        const root = elements.find((el) => el.name === 'svg' && !el.closing);
        const vb = readViewBox(root);
        if (!vb) continue;
        const strokes = new Set<number>();
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const el of elements) {
            if (el.closing) continue;
            const sw = Number(el.attrs['stroke-width']);
            if (Number.isFinite(sw) && sw > 0) strokes.add(sw);
            for (const m of (el.attrs['d'] ?? '').matchAll(/(-?[\d.]+)[\s,]+(-?[\d.]+)/g)) {
                const x = Number(m[1]);
                const y = Number(m[2]);
                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
        if (!Number.isFinite(minX)) continue;
        const padding = Math.min(minX - vb.x, minY - vb.y, vb.x + vb.w - maxX, vb.y + vb.h - maxY);
        out.push({ file, viewBox: vb, strokeWidths: [...strokes].sort((a, b) => a - b), padding });
    }
    return out;
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
                await page.screenshot({ path: shot });
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
        const ib = inner.geom;
        if (!ib) continue;
        const host = raw.elements.find(
            (o) =>
                o.index !== inner.index &&
                o.opaque &&
                !isNearWhite(o.fill) &&
                o.geom !== null &&
                ib.x > o.geom.x &&
                ib.y > o.geom.y &&
                ib.x + ib.w < o.geom.x + o.geom.w &&
                ib.y + ib.h < o.geom.y + o.geom.h,
        );
        if (host) {
            reading.near_white_regions.push({
                index: inner.index,
                id: inner.id,
                fill: inner.fill,
                enclosed_by: host.id || `${host.tag}@${host.index}`,
            });
        }
    }
}

function gradeIconGrid(
    file: string,
    vb: ViewBox | null,
    elements: SvgElement[],
    iconSet: readonly string[],
    paintedBox: Box | null,
): IconGridReading {
    const self = path.resolve(file);
    const refs = readIconReferences(iconSet.map((f) => path.resolve(f)).filter((f) => f !== self));
    const comparable = vb ? refs.filter((r) => r.viewBox.w === vb.w && r.viewBox.h === vb.h) : [];
    const strokes = new Set<number>();
    for (const el of elements) {
        if (el.closing) continue;
        const sw = Number(el.attrs['stroke-width']);
        if (Number.isFinite(sw) && sw > 0) strokes.add(sw);
    }
    const strokeWidth = strokes.size > 0 ? Math.max(...strokes) : null;
    const padding =
        vb && paintedBox
            ? Math.min(
                  paintedBox.x - vb.x,
                  paintedBox.y - vb.y,
                  vb.x + vb.w - (paintedBox.x + paintedBox.w),
                  vb.y + vb.h - (paintedBox.y + paintedBox.h),
              )
            : null;
    if (comparable.length === 0) {
        return {
            status: 'unverified',
            reference_files: refs.map((r) => path.basename(r.file)),
            reference_stroke_widths: [],
            reference_padding: [],
            stroke_width: strokeWidth,
            padding,
            reason:
                refs.length === 0
                    ? 'no icon reference set was supplied, so the incumbent grid was never read (E6)'
                    : 'no reference icon shares this viewBox size, so there is no grid to compare against',
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
        out.push({
            rule: 'geometry/near-white-hole',
            severity: 'warning',
            detail:
                `${n.fill} is painted opaquely inside ${n.enclosed_by}; if the source shows a hole there it must be ` +
                'cut out, not painted near-white — it reads white on a dark background (S5)',
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

    if (r.reduced_motion.host_picture_route === false) {
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
            const route = await page.evaluate(() => {
                const sources = Array.from(document.querySelectorAll('picture > source'));
                return sources.some((s) => /prefers-reduced-motion\s*:\s*reduce/i.test(s.getAttribute('media') ?? ''));
            });
            return { witnessable: false, frames_equal: null, reason: R5, host_picture_route: route };
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

// ---------------------------------------------------------------------------
// Step 2.6 — geometry comparison with declared tolerances
// ---------------------------------------------------------------------------

/** The source region of a raster, in the source's own pixel frame (S9). */
export interface Registration {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
}

export interface RasterRegionReading {
    region: string;
    silhouette_iou: number;
    mean_colour_error: number;
    share_off_by_40: number;
}

export interface TextDelta {
    index: number;
    baseline_family: string;
    candidate_family: string;
    baseline_box: Box;
    candidate_box: Box;
}

export interface GeometryComparison {
    verdict: 'pass' | 'degraded' | 'fail' | 'unverified';
    reason: string;
    asset_class: AssetClass;
    tolerance: GeometryTolerance;
    tolerance_source: 'manifest' | 'default';
    sample_resolution: number;
    anti_alias_band_units: number;
    silhouette_iou: number | null;
    max_boundary_distance_units: number | null;
    sub_pixel_offset: { dx_units: number; dy_units: number } | null;
    texts: TextDelta[];
    font_only_delta: boolean;
    raster: { registration: Registration; regions: RasterRegionReading[]; worst_region: string } | null;
}

export interface CompareSpec {
    baseline: string;
    candidate: string;
    assetClass: AssetClass;
    tolerance: GeometryTolerance;
    toleranceSource: 'manifest' | 'default';
    registration?: Registration;
    regions?: ReadonlyArray<{ id: string; box: Box }>;
    blocked: string[];
}

const SAMPLE_RES = 256;

/**
 * One comparison of two renders of the SAME frame — before and after an edit,
 * or a source raster against its vector.
 *
 * Three things this deliberately does not do. It does not decide a surgical
 * edit (`lint_svg_asset --baseline` does, on attributes, because anti-aliasing
 * and font metrics would make a pixel verdict a per-machine verdict). It does
 * not guess a registration for a raster — without a declared one the reading is
 * `unverified`, never the best of several guesses. And it does not call a
 * font-caused delta a failure: a delta whose only cause is a different resolved
 * family reads `degraded`, with BOTH families named.
 */
export async function compareGeometry(
    context: Awaited<ReturnType<Browser['newContext']>>,
    spec: CompareSpec,
): Promise<GeometryComparison> {
    const baselineContent = fs.readFileSync(spec.baseline, 'utf8');
    const elements = parseElements(baselineContent);
    const vb = readViewBox(elements.find((el) => el.name === 'svg' && !el.closing)) ?? { x: 0, y: 0, w: 100, h: 100 };
    const frame = sampleFrame(vb, SAMPLE_RES);
    const unitsPerSample = 1 / frame.scale;

    const base: GeometryComparison = {
        verdict: 'unverified',
        reason: '',
        asset_class: spec.assetClass,
        tolerance: spec.tolerance,
        tolerance_source: spec.toleranceSource,
        sample_resolution: SAMPLE_RES,
        anti_alias_band_units: unitsPerSample,
        silhouette_iou: null,
        max_boundary_distance_units: null,
        sub_pixel_offset: null,
        texts: [],
        font_only_delta: false,
        raster: null,
    };

    const candidateIsRaster = /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(spec.candidate);
    if (candidateIsRaster && !spec.registration) {
        return {
            ...base,
            reason:
                'a raster source needs a declared registration (the source crop\'s own pixel frame, S9); ' +
                'without one the reading is unverified rather than the best of several guesses',
        };
    }

    const page = await context.newPage();
    await page.setViewportSize({ width: SAMPLE_RES, height: SAMPLE_RES });
    await page.route('**/*', async (route: Route) => {
        const url = route.request().url();
        if (!ALLOWED_SCHEMES.some((s) => url.startsWith(s))) {
            spec.blocked.push(url);
            await route.abort();
            return;
        }
        await route.continue();
    });
    try {
        await page.goto('about:blank');
        const baselineMask = await rasterise(page, spec.baseline, vb, null);
        const candidateMask = await rasterise(
            page,
            spec.candidate,
            vb,
            spec.registration ?? null,
        );
        if (!baselineMask || !candidateMask) {
            return { ...base, reason: 'one of the two inputs could not be decoded in the renderer' };
        }

        const { iou, dx, dy } = bestAlignment(baselineMask.painted, candidateMask.painted, frame.w, frame.h);
        const shifted = shift(candidateMask.painted, frame.w, frame.h, dx, dy);
        const maxDistance = boundaryDistance(baselineMask.painted, shifted, frame.w, frame.h) * unitsPerSample;

        // Text is compared by box and resolved family only.
        const baseTexts = await readTextBoxes(page, spec.baseline);
        const candTexts = candidateIsRaster ? [] : await readTextBoxes(page, spec.candidate);
        const texts: TextDelta[] = [];
        for (let i = 0; i < Math.min(baseTexts.length, candTexts.length); i++) {
            const a = baseTexts[i];
            const b = candTexts[i];
            if (!a || !b) continue;
            texts.push({
                index: i,
                baseline_family: a.family,
                candidate_family: b.family,
                baseline_box: a.box,
                candidate_box: b.box,
            });
        }
        const familyDiffers = texts.some((t) => t.baseline_family !== t.candidate_family);
        // Unshifted on purpose: the alignment search above is driven by the very
        // glyphs under test, so asking whether the delta is text-shaped must not
        // consult an offset the delta itself chose.
        const fontOnly =
            familyDiffers &&
            disagreementIsInsideTextBoxes(baselineMask.painted, candidateMask.painted, frame, vb, texts);

        let raster: GeometryComparison['raster'] = null;
        if (candidateIsRaster && spec.registration) {
            const regions = spec.regions ?? [{ id: 'whole', box: { x: vb.x, y: vb.y, w: vb.w, h: vb.h } }];
            const readings = regions.map((region) => rasterRegionReading(baselineMask, candidateMask, frame, vb, region));
            const worst = readings.reduce(
                (acc, r) => (r.mean_colour_error > acc.mean_colour_error ? r : acc),
                readings[0] ?? { region: 'whole', silhouette_iou: 0, mean_colour_error: 0, share_off_by_40: 0 },
            );
            raster = { registration: spec.registration, regions: readings, worst_region: worst.region };
        }

        const withinIou = iou >= spec.tolerance.silhouette_iou_min;
        const withinBoundary = maxDistance <= spec.tolerance.max_boundary_distance_units;
        const verdict: GeometryComparison['verdict'] = fontOnly
            ? 'degraded'
            : withinIou && withinBoundary
              ? 'pass'
              : 'fail';
        const reason = fontOnly
            ? `the only geometric delta lies inside <text>, and the resolved families differ: ` +
              `"${texts.map((t) => t.baseline_family).join(', ')}" against "${texts.map((t) => t.candidate_family).join(', ')}" — ` +
              'a renderer delta, never a fail'
            : verdict === 'pass'
              ? `silhouette IoU ${iou.toFixed(4)} and boundary ${maxDistance.toFixed(2)} units are inside the ${spec.assetClass} tolerance`
              : `silhouette IoU ${iou.toFixed(4)} (min ${spec.tolerance.silhouette_iou_min}) / boundary ` +
                `${maxDistance.toFixed(2)} units (max ${spec.tolerance.max_boundary_distance_units})`;

        return {
            ...base,
            verdict,
            reason,
            silhouette_iou: iou,
            max_boundary_distance_units: maxDistance,
            sub_pixel_offset: { dx_units: dx * unitsPerSample, dy_units: dy * unitsPerSample },
            texts,
            font_only_delta: fontOnly,
            raster,
        };
    } finally {
        await page.close();
    }
}

interface Rasterised {
    alpha: Uint8Array;
    rgb: Uint8Array;
    /** 1 where the pixel differs from this image's OWN background, 0 elsewhere. */
    painted: Uint8Array;
}

/**
 * The sample grid, in viewBox units.
 *
 * MEASURED, not assumed: `drawImage` STRETCHES an SVG into the destination
 * rect — a 160x60 viewBox drawn into 256x256 put a `y = 20..44` rect at rows
 * 85..187, which is 256/60 per unit on the vertical and 256/160 on the
 * horizontal, with no letterbox at all. A square canvas would therefore give
 * the two axes different units and make "the largest boundary distance in
 * viewBox units" two different numbers depending on direction. So the canvas
 * takes the asset's own aspect instead, and one scale governs both axes.
 */
function sampleFrame(vb: ViewBox, res: number): { w: number; h: number; scale: number } {
    const scale = res / Math.max(vb.w, vb.h);
    return {
        w: Math.max(1, Math.round(vb.w * scale)),
        h: Math.max(1, Math.round(vb.h * scale)),
        scale,
    };
}

type SampleFrame = ReturnType<typeof sampleFrame>;

/**
 * Painted = differs from this image's own background.
 *
 * Alpha alone cannot see a `<text>` sitting on an opaque background rect: every
 * pixel of such a file is alpha 255, so an alpha mask reads two different
 * labels as the same silhouette. The corner pixel is the background reference.
 */
function paintedMask(alpha: Uint8Array, rgb: Uint8Array): Uint8Array {
    const out = new Uint8Array(alpha.length);
    const bgA = alpha[0] as number;
    const bgR = rgb[0] as number;
    const bgG = rgb[1] as number;
    const bgB = rgb[2] as number;
    for (let i = 0; i < alpha.length; i++) {
        const dA = Math.abs((alpha[i] as number) - bgA);
        const dR = Math.abs((rgb[i * 3] as number) - bgR);
        const dG = Math.abs((rgb[i * 3 + 1] as number) - bgG);
        const dB = Math.abs((rgb[i * 3 + 2] as number) - bgB);
        const visible = (alpha[i] as number) >= 16;
        out[i] = visible && (dA > 8 || dR > 8 || dG > 8 || dB > 8) ? 1 : 0;
    }
    return out;
}

/**
 * One file sampled into an alpha mask and an RGB buffer, both at `SAMPLE_RES`
 * over the baseline's viewBox. A `data:` URL plus `drawImage` keeps this inside
 * the page and inside the no-network rule — nothing is fetched.
 */
async function rasterise(
    page: Page,
    file: string,
    vb: ViewBox,
    registration: Registration | null,
): Promise<Rasterised | null> {
    const buf = fs.readFileSync(file);
    const isSvg = /\.svg$/i.test(file);
    const mime = isSvg
        ? 'image/svg+xml'
        : /\.png$/i.test(file)
          ? 'image/png'
          : /\.webp$/i.test(file)
            ? 'image/webp'
            : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    const frame = sampleFrame(vb, SAMPLE_RES);
    const out = await page.evaluate(
        async (args: {
            url: string;
            w: number;
            h: number;
            reg: { x: number; y: number; width: number; height: number } | null;
        }): Promise<{ alpha: number[]; rgb: number[] } | null> => {
            const img = new Image();
            img.src = args.url;
            try {
                await img.decode();
            } catch {
                return null;
            }
            const canvas = document.createElement('canvas');
            canvas.width = args.w;
            canvas.height = args.h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return null;
            ctx.clearRect(0, 0, args.w, args.h);
            if (args.reg) {
                // The SAME destination rect the vector is stretched into, which
                // is what makes the two masks comparable at all.
                ctx.drawImage(img, args.reg.x, args.reg.y, args.reg.width, args.reg.height, 0, 0, args.w, args.h);
            } else {
                ctx.drawImage(img, 0, 0, args.w, args.h);
            }
            const data = ctx.getImageData(0, 0, args.w, args.h).data;
            const alpha: number[] = [];
            const rgb: number[] = [];
            for (let i = 0; i < data.length; i += 4) {
                alpha.push(data[i + 3] as number);
                rgb.push(data[i] as number, data[i + 1] as number, data[i + 2] as number);
            }
            return { alpha, rgb };
        },
        {
            url: dataUrl,
            w: frame.w,
            h: frame.h,
            reg: registration
                ? { x: registration.x, y: registration.y, width: registration.width, height: registration.height }
                : null,
        },
    );
    if (!out) return null;
    const alpha = Uint8Array.from(out.alpha);
    const rgb = Uint8Array.from(out.rgb);
    return { alpha, rgb, painted: paintedMask(alpha, rgb) };
}

async function readTextBoxes(page: Page, file: string): Promise<Array<{ family: string; box: Box }>> {
    if (!/\.svg$/i.test(file)) return [];
    const svg = fs.readFileSync(file, 'utf8').replace(/<\?xml[^>]*\?>\s*/i, '');
    return page.evaluate((markup: string) => {
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        document.body.appendChild(holder);
        const out: Array<{ family: string; box: { x: number; y: number; w: number; h: number } }> = [];
        for (const t of Array.from(holder.querySelectorAll('text'))) {
            const bb = (t as SVGGraphicsElement).getBBox();
            out.push({
                family: window.getComputedStyle(t).fontFamily,
                box: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
            });
        }
        holder.remove();
        return out;
    }, svg);
}


function shift(mask: Uint8Array, w: number, h: number, dx: number, dy: number): Uint8Array {
    if (dx === 0 && dy === 0) return mask;
    const out = new Uint8Array(mask.length);
    for (let y = 0; y < h; y++) {
        const sy = y - dy;
        if (sy < 0 || sy >= h) continue;
        for (let x = 0; x < w; x++) {
            const sx = x - dx;
            if (sx < 0 || sx >= w) continue;
            out[y * w + x] = mask[sy * w + sx] as number;
        }
    }
    return out;
}

function iouOf(a: Uint8Array, b: Uint8Array): number {
    let inter = 0;
    let union = 0;
    for (let i = 0; i < a.length; i++) {
        const pa = (a[i] as number) === 1;
        const pb = (b[i] as number) === 1;
        if (pa && pb) inter += 1;
        if (pa || pb) union += 1;
    }
    return union === 0 ? 1 : inter / union;
}

/** The sub-pixel offset of the candidate against the baseline is PART of the reading (S12). */
function bestAlignment(a: Uint8Array, b: Uint8Array, w: number, h: number): { iou: number; dx: number; dy: number } {
    let best = { iou: iouOf(a, b), dx: 0, dy: 0 };
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const v = iouOf(a, shift(b, w, h, dx, dy));
            if (v > best.iou) best = { iou: v, dx, dy };
        }
    }
    return best;
}

/**
 * The thickness of the disagreement band, in sample pixels, with a one-device-
 * pixel anti-aliasing band excluded: a multi-source BFS out of the pixels where
 * the two masks agree, taking the furthest disagreeing pixel.
 */
function boundaryDistance(a: Uint8Array, b: Uint8Array, w: number, h: number): number {
    const dist = new Int32Array(a.length).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < a.length; i++) {
        if (((a[i] as number) === 1) === ((b[i] as number) === 1)) {
            dist[i] = 0;
            queue.push(i);
        }
    }
    if (queue.length === 0) return Math.max(w, h);
    let head = 0;
    let max = 0;
    while (head < queue.length) {
        const i = queue[head++] as number;
        const d = dist[i] as number;
        const x = i % w;
        const y = (i - x) / w;
        for (const [nx, ny] of [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
        ]) {
            if ((nx as number) < 0 || (nx as number) >= w || (ny as number) < 0 || (ny as number) >= h) continue;
            const j = (ny as number) * w + (nx as number);
            if ((dist[j] as number) !== -1) continue;
            dist[j] = d + 1;
            if (d + 1 > max) max = d + 1;
            queue.push(j);
        }
    }
    // One sample pixel of disagreement is the anti-aliasing band, not a defect.
    return Math.max(0, max - 1);
}

function disagreementIsInsideTextBoxes(
    a: Uint8Array,
    b: Uint8Array,
    frame: SampleFrame,
    vb: ViewBox,
    texts: readonly TextDelta[],
): boolean {
    if (texts.length === 0) return false;
    const boxes = texts.flatMap((t) => [t.baseline_box, t.candidate_box]);
    // One user unit for the glyph's own overshoot, plus one sample pixel for the
    // anti-aliasing band. Wider than that and a real delta beside a label would
    // be swallowed; the differing-family check is the other half of the gate.
    const pad = 1 + 1 / frame.scale;
    let disagreements = 0;
    for (let i = 0; i < a.length; i++) {
        if (((a[i] as number) === 1) === ((b[i] as number) === 1)) continue;
        disagreements += 1;
        const px = i % frame.w;
        const py = (i - px) / frame.w;
        const ux = vb.x + px / frame.scale;
        const uy = vb.y + py / frame.scale;
        const inside = boxes.some(
            (box) =>
                ux >= box.x - pad && ux <= box.x + box.w + pad && uy >= box.y - pad && uy <= box.y + box.h + pad,
        );
        if (!inside) return false;
    }
    return disagreements > 0;
}

/**
 * TWO numbers per region, because S4 and S13 show either alone misleads:
 * silhouette agreement over the saturated regions, and the colour error over
 * every non-background pixel with the share that is badly off beside it.
 */
function rasterRegionReading(
    baseline: Rasterised,
    candidate: Rasterised,
    frame: SampleFrame,
    vb: ViewBox,
    region: { id: string; box: Box },
): RasterRegionReading {
    const inRegion = (i: number): boolean => {
        const px = i % frame.w;
        const py = (i - px) / frame.w;
        const ux = vb.x + px / frame.scale;
        const uy = vb.y + py / frame.scale;
        return ux >= region.box.x && ux <= region.box.x + region.box.w && uy >= region.box.y && uy <= region.box.y + region.box.h;
    };
    const chroma = (buf: Uint8Array, i: number): number => {
        const r = buf[i * 3] as number;
        const g = buf[i * 3 + 1] as number;
        const b = buf[i * 3 + 2] as number;
        return Math.max(r, g, b) - Math.min(r, g, b);
    };
    let inter = 0;
    let union = 0;
    let errorSum = 0;
    let errorCount = 0;
    let off40 = 0;
    for (let i = 0; i < baseline.painted.length; i++) {
        if (!inRegion(i)) continue;
        const aPainted = (baseline.painted[i] as number) === 1;
        const bPainted = (candidate.painted[i] as number) === 1;
        const aSat = aPainted && chroma(baseline.rgb, i) >= 24;
        const bSat = bPainted && chroma(candidate.rgb, i) >= 24;
        if (aSat && bSat) inter += 1;
        if (aSat || bSat) union += 1;
        if (!aPainted && !bPainted) continue;
        const d =
            (Math.abs((baseline.rgb[i * 3] as number) - (candidate.rgb[i * 3] as number)) +
                Math.abs((baseline.rgb[i * 3 + 1] as number) - (candidate.rgb[i * 3 + 1] as number)) +
                Math.abs((baseline.rgb[i * 3 + 2] as number) - (candidate.rgb[i * 3 + 2] as number))) /
            3;
        errorSum += d;
        errorCount += 1;
        if (d > 40) off40 += 1;
    }
    return {
        region: region.id,
        silhouette_iou: union === 0 ? 1 : inter / union,
        mean_colour_error: errorCount === 0 ? 0 : errorSum / errorCount,
        share_off_by_40: errorCount === 0 ? 0 : off40 / errorCount,
    };
}
