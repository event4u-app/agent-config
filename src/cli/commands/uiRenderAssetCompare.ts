/**
 * uiRenderAssetCompare — step 2.6 of `road-to-svg-with-a-witness`.
 *
 * One comparison of two renders of the SAME frame: before and after an edit, or
 * a source raster against its vector.
 *
 * Three things this deliberately does not do. It does not decide a surgical
 * edit — `lint_svg_asset --baseline` does, on attributes, because anti-aliasing
 * and font metrics would make a pixel verdict a per-machine verdict. It does
 * not guess a registration for a raster: without a declared one the reading is
 * `unverified`, never the best of several guesses. And it does not call a
 * font-caused delta a failure — a delta whose only cause is a different
 * resolved family reads `degraded`, with BOTH families named.
 */
import * as fs from 'node:fs';

import type { Browser, Page, Route } from '@playwright/test';

import { parseElements, readViewBox } from '../../scripts/lint_svg_asset.js';
import type { ViewBox } from '../../scripts/lint_svg_asset.js';

import {
    ALLOWED_SCHEMES,
    SAMPLE_RES,
    type AssetClass,
    type Box,
    type GeometryTolerance,
} from './uiRenderAssetTypes.js';

/** The source region of a raster, in the source's own pixel frame (S9). */
export interface Registration {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
}

/**
 * `--registration x,y,w,h[@scale]` — the source crop's own pixel frame (S9).
 * An unparseable spec returns `null`, which leaves the raster reading
 * `unverified` rather than letting the comparison guess an offset.
 *
 * Finding 2.4 of `road-to-svg-rules-in-the-dispatch-path`: `scale` was parsed
 * and validated here and then read by nothing, so `@2` was a silent no-op. It
 * now reaches the comparison, which multiplies the crop rect by it — the
 * operator states the crop in logical units and `@2` says the raster is a 2x
 * capture of them.
 *
 * `@0` and `@-1` still return `null`, and that is deliberate rather than
 * leftover: a zero-scale crop has no pixels, so there is nothing to compare,
 * and reporting the registration as absent is the same verdict a reader would
 * reach from an empty crop. The caller prints the spec it could not parse, so
 * "absent" is not the only thing the operator sees.
 */
export function parseRegistration(spec: string | undefined): Registration | null {
    if (!spec) return null;
    const [frame, scaleRaw] = spec.split('@');
    const parts = (frame ?? '').split(',').map((n) => Number(n.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
    const scale = scaleRaw === undefined ? 1 : Number(scaleRaw);
    if (!Number.isFinite(scale) || scale <= 0) return null;
    return {
        x: parts[0] as number,
        y: parts[1] as number,
        width: parts[2] as number,
        height: parts[3] as number,
        scale,
    };
}

/**
 * The crop rect in the raster's OWN pixels.
 *
 * Finding 2.4 of `road-to-svg-rules-in-the-dispatch-path`: `Registration.scale`
 * was parsed by the CLI, validated, recorded in the manifest and then read by
 * nothing — `@2` was a silent no-op. The operator states the region in logical
 * units; `@2` says the raster is a 2x capture of them, so the rect in image
 * pixels is the region multiplied through.
 *
 * Its own exported function rather than four expressions inside a
 * `page.evaluate` argument, because the defect was exactly that those four
 * expressions were unreachable from any test that does not drive a browser.
 */
export function cropRect(
    registration: Registration | null,
): { x: number; y: number; width: number; height: number } | null {
    if (!registration) return null;
    const s = registration.scale;
    return {
        x: registration.x * s,
        y: registration.y * s,
        width: registration.width * s,
        height: registration.height * s,
    };
}

/**
 * What the SOURCE raster shows at a list of points, and what its background is.
 *
 * Step 1.2 of `road-to-svg-from-a-live-session`. `geometry/near-white-hole`
 * asks a question about the source — "is there a hole there?" — and until now
 * nothing read the source to answer it. Measured consequence: the rule fired
 * six times on paint an owner had chosen, and zero times on the file the same
 * owner rejected.
 *
 * Points are in the VECTOR's user units; the registration maps them into the
 * raster's own pixel frame, the same mapping the comparison uses, so the two
 * cannot disagree about where a point is.
 *
 * The background is the raster's corner pixel. That is the same assumption the
 * comparison's own background mask makes, and it is stated here rather than
 * hidden: a source whose corner is not its background will answer `paint`
 * everywhere, which is the direction that produces no finding.
 */
export interface SourceSample {
    /** `true` when the source at this point matches its own background. */
    isBackground: boolean;
    rgb: [number, number, number];
}

export async function sampleSource(
    context: Awaited<ReturnType<Browser['newContext']>>,
    sourceFile: string,
    vb: ViewBox,
    registration: Registration,
    points: ReadonlyArray<{ x: number; y: number }>,
    blocked: string[],
): Promise<SourceSample[] | null> {
    if (points.length === 0) return [];
    let buf: Buffer;
    try {
        buf = fs.readFileSync(sourceFile);
    } catch {
        return null;
    }
    const mime = /\.png$/i.test(sourceFile)
        ? 'image/png'
        : /\.webp$/i.test(sourceFile)
          ? 'image/webp'
          : /\.svg$/i.test(sourceFile)
            ? 'image/svg+xml'
            : 'image/jpeg';
    const crop = cropRect(registration);
    if (!crop) return null;

    const page = await context.newPage();
    await page.route('**/*', async (route: Route) => {
        const url = route.request().url();
        if (!ALLOWED_SCHEMES.some((p) => url.startsWith(p))) {
            blocked.push(url);
            await route.abort();
            return;
        }
        await route.continue();
    });
    try {
        await page.setContent('<!doctype html><body></body>');
        return await page.evaluate(
            async (args: {
                url: string;
                crop: { x: number; y: number; width: number; height: number };
                vb: ViewBox;
                points: ReadonlyArray<{ x: number; y: number }>;
            }): Promise<SourceSample[] | null> => {
                const img = new Image();
                img.src = args.url;
                try {
                    await img.decode();
                } catch {
                    return null;
                }
                const w = Math.max(1, Math.round(args.crop.width));
                const h = Math.max(1, Math.round(args.crop.height));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return null;
                ctx.drawImage(img, args.crop.x, args.crop.y, args.crop.width, args.crop.height, 0, 0, w, h);
                const data = ctx.getImageData(0, 0, w, h).data;
                const at = (px: number, py: number): [number, number, number] => {
                    const x = Math.min(w - 1, Math.max(0, Math.round(px)));
                    const y = Math.min(h - 1, Math.max(0, Math.round(py)));
                    const i = (y * w + x) * 4;
                    return [data[i] as number, data[i + 1] as number, data[i + 2] as number];
                };
                const background = at(0, 0);
                const near = (a: [number, number, number], b: [number, number, number]): boolean =>
                    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 24;
                return args.points.map((p) => {
                    // User units → the crop's own pixels, which is the same
                    // mapping the comparison stretches the vector through.
                    const rgb = at(
                        ((p.x - args.vb.x) / args.vb.w) * w,
                        ((p.y - args.vb.y) / args.vb.h) * h,
                    );
                    return { isBackground: near(rgb, background), rgb };
                });
            },
            { url: `data:${mime};base64,${buf.toString('base64')}`, crop, vb, points },
        );
    } finally {
        await page.close();
    }
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
    raster: {
        registration: Registration;
        regions: RasterRegionReading[];
        worst_region: string;
        /**
         * The share of the candidate's painted pixels that lie OUTSIDE the
         * subject — a neighbouring mark the crop included, a glow, a shadow.
         * Its own reading (step 2.1), never folded into IoU.
         */
        foreign_content_share: number;
        /**
         * Frame sides the candidate's content runs into. A source cut by its
         * own crop agrees with a trace of that crop exactly, so IoU cannot see
         * the cut and this is the only signal there is.
         */
        frame_edge_contact: string[];
    } | null;
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

        // Step 2.1: against a REGISTERED RASTER the comparison judges the
        // SUBJECT, not everything the crop happened to contain. The subject is
        // the baseline's own silhouette widened by the anti-alias band the
        // comparison already computes — not by a number chosen to pass a
        // fixture. Foreign content and a frame-edge cut are reported as their
        // own readings below rather than folded into IoU, where they made the
        // witness fail a trace its owner had accepted.
        const judgeSubjectOnly = candidateIsRaster && spec.registration !== undefined;
        // The subject for JUDGING is the baseline's silhouette exactly, with no
        // dilation. A dilated mask would let a one-sample ring of whatever
        // surrounds the subject — a glow, a shadow — into the union and cost
        // the IoU about four points on a small mark, which is a tax on being
        // photographed next to something rather than a reading about the
        // conversion. What the restricted IoU then measures is how much of the
        // subject the candidate actually paints; a candidate that misses part
        // of it, or is shifted, still fails.
        //
        // The subject for FOREIGN CONTENT is dilated by the anti-alias band
        // the comparison already computes, so the rasteriser's own edge smear
        // is not reported as a neighbouring mark. Two masks, because the two
        // questions have different right answers at the boundary.
        const subjectForJudging = judgeSubjectOnly ? baselineMask.painted : null;
        const subjectForForeign = judgeSubjectOnly
            ? // ONE SAMPLE, and the units are the point. `unitsPerSample` is
              // user units per sample — `dilate`'s own doc says its radius is
              // in SAMPLES, so passing it read a units value as a sample count
              // (finding 5). It happened to equal 1 only while
              // `frame.scale >= 1`; on a coarse frame — a large viewBox against
              // a small raster — it dilated by several samples and
              // `foreign_content_share` under-reported exactly where the
              // sampling is least precise. The anti-alias band IS one sample by
              // construction, whatever that sample is worth in user units.
              dilate(baselineMask.painted, frame.w, frame.h, 1)
            : null;
        const candidateForJudging =
            subjectForJudging === null
                ? candidateMask.painted
                : intersect(candidateMask.painted, subjectForJudging);

        const { iou, dx, dy } = bestAlignment(baselineMask.painted, candidateForJudging, frame.w, frame.h);
        const shifted = shift(candidateForJudging, frame.w, frame.h, dx, dy);
        const maxDistance = boundaryDistance(baselineMask.painted, shifted, frame.w, frame.h) * unitsPerSample;

        const foreign =
            subjectForForeign === null ? null : shareOutside(candidateMask.painted, subjectForForeign);
        const cutSides = judgeSubjectOnly ? touchesFrameEdge(candidateMask.painted, frame.w, frame.h) : [];

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
            // `whole` stays first, always — it is the reading every consumer
            // already reads, and a per-group breakdown is added beside it
            // rather than instead of it (step 2.2).
            const derived = spec.regions ?? (await readTopLevelGroupBoxes(page, spec.baseline));
            const regions = [
                { id: 'whole', box: { x: vb.x, y: vb.y, w: vb.w, h: vb.h } },
                ...derived.filter((r) => r.id !== 'whole'),
            ];
            const readings = regions.map((region) => rasterRegionReading(baselineMask, candidateMask, frame, vb, region));
            const worst = readings.reduce(
                (acc, r) => (r.mean_colour_error > acc.mean_colour_error ? r : acc),
                readings[0] ?? { region: 'whole', silhouette_iou: 0, mean_colour_error: 0, share_off_by_40: 0 },
            );
            raster = {
                registration: spec.registration,
                regions: readings,
                worst_region: worst.region,
                foreign_content_share: foreign?.share ?? 0,
                frame_edge_contact: cutSides,
            };
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

/**
 * The subject's own neighbourhood — a dilation of the baseline's silhouette.
 *
 * Step 2.1 of `road-to-svg-from-a-live-session`. When the candidate is a
 * REGISTERED RASTER, everything inside the frame is in the comparison:
 * neighbouring marks the crop happened to include, a soft glow around the
 * subject, a drop shadow. The background mask is taken from the corner pixel,
 * so all of it counts as painted and all of it lands in IoU and in the
 * boundary distance. Measured consequence: the witness failed a trace the
 * owner had accepted, and ranked the rejected trace above the accepted
 * construction on every number.
 *
 * `radius` is in SAMPLES, and the caller passes the anti-alias band the
 * comparison already computes — so this widens by exactly the amount the
 * rasteriser can smear an edge and not by a number chosen to make a fixture
 * pass.
 */
function dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
    if (radius <= 0) return mask;
    const r = Math.ceil(radius);
    const out = new Uint8Array(mask.length);
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            if (mask[y * w + x] !== 1) continue;
            for (let dy = -r; dy <= r; dy += 1) {
                const sy = y + dy;
                if (sy < 0 || sy >= h) continue;
                for (let dx = -r; dx <= r; dx += 1) {
                    const sx = x + dx;
                    if (sx < 0 || sx >= w) continue;
                    out[sy * w + sx] = 1;
                }
            }
        }
    }
    return out;
}

/** `a AND b`, pixel for pixel. */
function intersect(a: Uint8Array, b: Uint8Array): Uint8Array {
    const out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i += 1) out[i] = a[i] === 1 && b[i] === 1 ? 1 : 0;
    return out;
}

/** Painted pixels in `mask` that `within` does not cover, as a share of `mask`. */
function shareOutside(mask: Uint8Array, within: Uint8Array): { share: number; count: number } {
    let painted = 0;
    let outside = 0;
    for (let i = 0; i < mask.length; i += 1) {
        if (mask[i] !== 1) continue;
        painted += 1;
        if (within[i] !== 1) outside += 1;
    }
    return { share: painted === 0 ? 0 : outside / painted, count: outside };
}

/**
 * Does painted content touch the frame's own edge?
 *
 * Step 2.1, and the crown-cut case it exists for: a trace whose crop started
 * five pixels below the top of the mark took the crop border for a contour,
 * and a comparison against that same crop cannot see the cut — the trace and
 * the source agree exactly, because both are missing the same thing. The only
 * signal available is that the content runs into the border, which is what
 * this reports.
 */
function touchesFrameEdge(mask: Uint8Array, w: number, h: number): string[] {
    const sides: string[] = [];
    const any = (idx: (i: number) => number, n: number): boolean => {
        for (let i = 0; i < n; i += 1) if (mask[idx(i)] === 1) return true;
        return false;
    };
    if (any((i) => i, w)) sides.push('top');
    if (any((i) => (h - 1) * w + i, w)) sides.push('bottom');
    if (any((i) => i * w, h)) sides.push('left');
    if (any((i) => i * w + (w - 1), h)) sides.push('right');
    return sides;
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
            reg: cropRect(registration),
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


/**
 * The rendered box of every TOP-LEVEL `<g id>`, in user units.
 *
 * Step 2.2 of `road-to-svg-from-a-live-session`. `CompareSpec.regions` existed
 * and `main.ts` carried no option for it, so `worst_region` was always
 * `whole` and the per-region breakdown an earlier learning asked for was
 * unreachable from the CLI. A flag would have been one more input nobody
 * passes; a hand-built file already names its own parts — `hat`, `head-group`,
 * `arms`, `legs` — so the regions are read from the file instead.
 *
 * TOP-LEVEL only, and `id` required. A nested group is part of its parent's
 * reading, and an anonymous group has no name to report a verdict under.
 */
async function readTopLevelGroupBoxes(page: Page, file: string): Promise<Array<{ id: string; box: Box }>> {
    if (!/\.svg$/i.test(file)) return [];
    const svg = fs.readFileSync(file, 'utf8').replace(/<\?xml[^>]*\?>\s*/i, '');
    return page.evaluate((markup: string) => {
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        document.body.appendChild(holder);
        const out: Array<{ id: string; box: { x: number; y: number; w: number; h: number } }> = [];
        const root = holder.querySelector('svg');
        if (root) {
            for (const child of Array.from(root.children)) {
                if (child.tagName.toLowerCase() !== 'g') continue;
                const id = child.getAttribute('id');
                if (!id) continue;
                try {
                    const bb = (child as SVGGraphicsElement).getBBox();
                    if (bb.width > 0 || bb.height > 0) {
                        out.push({ id, box: { x: bb.x, y: bb.y, w: bb.width, h: bb.height } });
                    }
                } catch {
                    // A group the renderer cannot box contributes no region,
                    // which leaves `whole` as its reading rather than a guess.
                }
            }
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
 * silhouette agreement over the saturated regions, and the color error over
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
