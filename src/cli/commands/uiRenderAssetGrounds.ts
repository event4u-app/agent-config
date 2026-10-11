/**
 * uiRenderAssetGrounds — the per-capture readings of steps 4.1 and 4.2 of
 * `road-to-svg-from-a-live-session`.
 *
 * Its own module for a measured reason: `uiRenderAsset.ts` is over the
 * source-size budget and this pass is the most self-contained thing left in
 * it — one browser context in, one array of readings out, sharing nothing with
 * the geometry pass but the declared types.
 *
 * The page opener is INJECTED rather than imported. `uiRenderAsset` calls this
 * module, so importing its `openPage` back would make the two a cycle; a
 * parameter says the dependency runs one way and keeps it that way.
 */
import type { Browser, Page } from '@playwright/test';

import type { ViewBox } from '../../scripts/lint_svg_asset.js';
import {
    HOST_BASENAME,
    MIN_CONTRAST_RATIO,
    type AssetReading,
    type Box,
    type GroundReading,
} from './uiRenderAssetTypes.js';

/** The subset of the caller's page opener this pass needs. */
export type OpenPage = (
    context: Awaited<ReturnType<Browser['newContext']>>,
    spec: {
        url: string;
        hostHtml: string | null;
        hostBasename: string;
        width: number;
        height: number;
        background: string;
        cssWidth: number;
        blocked: string[];
    },
) => Promise<Page>;

/**
 * The per-ground readings — steps 4.1 and 4.2 of
 * `road-to-svg-from-a-live-session`.
 *
 * Three images, read in one scratch page so nothing is decoded twice:
 *
 *   transparent  the file on no ground at all, which is where its own
 *                silhouette comes from. A silhouette taken from the light
 *                capture would lose every white part of the graphic, which is
 *                precisely the paint these two readings are about.
 *   light / dark the two captures the profile already wrote.
 *
 * Inside that silhouette, two counts per ground. A pixel whose contrast ratio
 * against the ground is below 3:1 is hard to see there (4.2) — a wordmark in
 * dark violet shipped unreadable on a dark ground and the variant was never
 * built. A pixel whose colour sits within the anti-alias band of the ground is
 * the ground showing THROUGH the graphic (4.1) — the hairline seams between
 * abutting traced segments, invisible on white and obvious on black.
 *
 * Holes are excluded by declaration, never by geometry: a ring's middle is
 * ground on purpose, and only the author can say which gaps are intended.
 */
/**
 * What FRACTION of the capture the graphic covers, width and height.
 *
 * Finding 4 of this change's second completion review. The capture is the
 * VIEWPORT, floored at 64 px, while the page is `margin:0` with
 * `body>svg{width:cssWidth}` — so the graphic sits in the top-left corner and
 * covers only part of the image whenever `cssWidth` is smaller. Every icon is
 * such a case: the sizes are 16/24/48 against a floor of 64. Mapping a
 * user-unit box across the whole capture therefore put every declared hole and
 * every declared-translucent shape 4/3 too far out, and the exclusions the
 * author declared were applied to the wrong part of their own file.
 *
 * A FRACTION rather than a pixel count, because the image's size is known only
 * inside the page while everything this needs is known outside it — which is
 * also what makes the arithmetic testable without a renderer. Clamped to 1:
 * `cssWidth` above the viewport is the graphic filling the capture, not
 * overflowing the coordinate space.
 */
export function graphicFraction(spec: {
    width: number;
    height: number;
    cssWidth: number;
    viewBox: ViewBox | null;
}): { w: number; h: number } {
    if (spec.width <= 0 || spec.height <= 0 || spec.cssWidth <= 0) return { w: 1, h: 1 };
    const w = Math.min(1, spec.cssWidth / spec.width);
    const vb = spec.viewBox;
    if (!vb || vb.w <= 0) return { w, h: 1 };
    // The rendered height follows the viewBox aspect from the rendered width.
    const cssHeight = spec.cssWidth * (vb.h / vb.w);
    return { w, h: Math.min(1, cssHeight / spec.height) };
}

export async function readGrounds(
    context: Awaited<ReturnType<Browser['newContext']>>,
    openPage: OpenPage,
    spec: {
        url: string;
        hostHtml: string | null;
        width: number;
        height: number;
        cssWidth: number;
        blocked: string[];
        backgrounds: AssetReading['backgrounds'];
        holeBoxes: ReadonlyArray<Box>;
        /** Finding 7: shapes declared translucent, excluded from the bleed count. */
        softBoxes: ReadonlyArray<Box>;
        viewBox: ViewBox | null;
    },
): Promise<GroundReading[]> {
    // The transparent render: `omitBackground` leaves alpha 0 where the file
    // paints nothing, which is the only honest source for a silhouette.
    const clear = await openPage(context, {
        url: spec.url,
        hostHtml: spec.hostHtml,
        hostBasename: HOST_BASENAME,
        width: spec.width,
        height: spec.height,
        background: 'transparent',
        cssWidth: spec.cssWidth,
        blocked: spec.blocked,
    });
    let silhouette: Buffer;
    try {
        silhouette = await clear.screenshot({ omitBackground: true });
    } finally {
        await clear.close();
    }

    const out: GroundReading[] = [];
    for (const mode of ['light', 'dark'] as const) {
        const colour = spec.backgrounds[mode];
        const page = await openPage(context, {
            url: spec.url,
            hostHtml: spec.hostHtml,
            hostBasename: HOST_BASENAME,
            width: spec.width,
            height: spec.height,
            background: colour,
            cssWidth: spec.cssWidth,
            blocked: spec.blocked,
        });
        let shot: Buffer;
        try {
            shot = await page.screenshot();
        } finally {
            await page.close();
        }

        const scratch = await context.newPage();
        try {
            await scratch.setContent('<!doctype html><body></body>');
            const counts = await scratch.evaluate(
                async (args: {
                    silhouette: string;
                    ground: string;
                    colour: string;
                    holes: ReadonlyArray<Box>;
                    /** Extents of shapes the author made translucent on purpose. */
                    soft: ReadonlyArray<Box>;
                    vb: ViewBox | null;
                    // Finding 4: PASSED, not closed over. A `page.evaluate`
                    // body cannot see module scope, so the constant was
                    // exported, linked from a doc comment, and silently
                    // replaced by a literal `3` — the same defect class this
                    // change fixes two files away for `Registration.scale`.
                    minContrast: number;
                    /**
                     * Finding 4 of the second completion review. The capture is
                     * the VIEWPORT, floored at 64 px, while the graphic is laid
                     * out at `cssWidth` in the top-left corner of a page with
                     * zero margin. Mapping `x / w` across the whole image into
                     * the viewBox therefore assumed the graphic filled the
                     * capture — true only for an asset 64 px or wider. For a
                     * 48 px icon every declared hole and every declared
                     * translucent shape landed on pixels 4/3 too far out, so
                     * the exclusions the author declared were applied to the
                     * wrong part of their own file.
                     */
                    graphic: { w: number; h: number };
                }): Promise<{ silhouette: number; painted: number; low: number; bleed: number } | null> => {
                    const load = async (b64: string): Promise<HTMLImageElement | null> => {
                        const img = new Image();
                        img.src = `data:image/png;base64,${b64}`;
                        try {
                            await img.decode();
                        } catch {
                            return null;
                        }
                        return img;
                    };
                    const a = await load(args.silhouette);
                    const b = await load(args.ground);
                    if (!a || !b) return null;
                    const w = Math.min(a.naturalWidth, b.naturalWidth);
                    const h = Math.min(a.naturalHeight, b.naturalHeight);
                    if (w === 0 || h === 0) return null;
                    const read = (img: HTMLImageElement): Uint8ClampedArray | null => {
                        const c = document.createElement('canvas');
                        c.width = w;
                        c.height = h;
                        const cx = c.getContext('2d', { willReadFrequently: true });
                        if (!cx) return null;
                        cx.clearRect(0, 0, w, h);
                        cx.drawImage(img, 0, 0);
                        return cx.getImageData(0, 0, w, h).data;
                    };
                    const alpha = read(a);
                    const px = read(b);
                    if (!alpha || !px) return null;

                    const hex = args.colour.trim();
                    const parse = (v: string): [number, number, number] => {
                        const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
                        if (m3) {
                            return [
                                parseInt((m3[1] as string).repeat(2), 16),
                                parseInt((m3[2] as string).repeat(2), 16),
                                parseInt((m3[3] as string).repeat(2), 16),
                            ];
                        }
                        // 4 and 8 digits carry an ALPHA the ground does not
                        // need; 6 is the plain case. Finding 5 of the fifth
                        // completion review: this handled 3 and 6 while the
                        // token reader that produces the value accepts 3 to 8,
                        // so a `#rrggbbaa` background fell through to the
                        // white fallback and every contrast ratio on that
                        // ground was computed against a colour nobody chose —
                        // silently, because white is a plausible answer.
                        const m68 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i.exec(v);
                        if (m68) {
                            return [
                                parseInt(m68[1] as string, 16),
                                parseInt(m68[2] as string, 16),
                                parseInt(m68[3] as string, 16),
                            ];
                        }
                        const m4 = /^#([0-9a-f])([0-9a-f])([0-9a-f])[0-9a-f]$/i.exec(v);
                        if (m4) {
                            return [
                                parseInt((m4[1] as string).repeat(2), 16),
                                parseInt((m4[2] as string).repeat(2), 16),
                                parseInt((m4[3] as string).repeat(2), 16),
                            ];
                        }
                        const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(v);
                        if (rgb) {
                            return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
                        }
                        return [255, 255, 255];
                    };
                    const ground = parse(hex);
                    const lum = (c: [number, number, number]): number => {
                        const f = (v: number): number => {
                            const x = v / 255;
                            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
                        };
                        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
                    };
                    const groundLum = lum(ground);
                    const ratio = (c: [number, number, number]): number => {
                        const l = lum(c);
                        const hi = Math.max(l, groundLum);
                        const lo = Math.min(l, groundLum);
                        return (hi + 0.05) / (lo + 0.05);
                    };

                    // Declared holes and translucent shapes, mapped from user
                    // units into this image.
                    //
                    // The graphic's own extent in IMAGE pixels, which is what a
                    // user-unit coordinate maps into — not the capture's. The
                    // page is `margin:0` with `body>svg{width:cssWidth}`, so it
                    // sits at the top-left corner and the height follows the
                    // viewBox aspect. A file with no viewBox is not mapped at
                    // all (the guard below), so there is no aspect to miss.
                    const gW = w * args.graphic.w;
                    const gH = h * args.graphic.h;
                    const within = (boxes: ReadonlyArray<Box>, x: number, y: number): boolean => {
                        if (!args.vb || boxes.length === 0) return false;
                        if (gW <= 0 || gH <= 0 || x >= gW || y >= gH) return false;
                        const ux = args.vb.x + (x / gW) * args.vb.w;
                        const uy = args.vb.y + (y / gH) * args.vb.h;
                        return boxes.some(
                            (box) => ux >= box.x && ux <= box.x + box.w && uy >= box.y && uy <= box.y + box.h,
                        );
                    };
                    const inHole = (x: number, y: number): boolean => within(args.holes, x, y);
                    const inSoft = (x: number, y: number): boolean => within(args.soft, x, y);

                    // The OUTER silhouette: flood the transparent region
                    // inwards from the border. What the flood cannot reach is
                    // inside the graphic — including the hairline gaps between
                    // abutting shapes, which is the thing step 4.1 counts and
                    // which an `alpha >= 200` definition excludes by
                    // construction (measured: 0 bleed pixels on the planted
                    // fixture before this).
                    const opaque = (i: number): boolean => (alpha[i * 4 + 3] as number) >= 200;
                    const outside = new Uint8Array(w * h);
                    const stack: number[] = [];
                    const push = (i: number): void => {
                        if (outside[i] === 1 || opaque(i)) return;
                        outside[i] = 1;
                        stack.push(i);
                    };
                    for (let x = 0; x < w; x += 1) {
                        push(x);
                        push((h - 1) * w + x);
                    }
                    for (let y = 0; y < h; y += 1) {
                        push(y * w);
                        push(y * w + (w - 1));
                    }
                    while (stack.length > 0) {
                        const i = stack.pop() as number;
                        const x = i % w;
                        const y = (i - x) / w;
                        if (x > 0) push(i - 1);
                        if (x + 1 < w) push(i + 1);
                        if (y > 0) push(i - w);
                        if (y + 1 < h) push(i + w);
                    }

                    let sil = 0;
                    let painted = 0;
                    let low = 0;
                    let bleed = 0;
                    for (let i = 0; i < w * h; i += 1) {
                        if (outside[i] === 1) continue;
                        sil += 1;
                        const c: [number, number, number] = [
                            px[i * 4] as number,
                            px[i * 4 + 1] as number,
                            px[i * 4 + 2] as number,
                        ];
                        // Contrast is asked of PAINTED pixels only: the ratio
                        // of a gap against the ground showing through it is the
                        // ratio of the ground against itself.
                        if (opaque(i)) {
                            painted += 1;
                            if (ratio(c) < args.minContrast) low += 1;
                        }
                        // Bleed is an INTERIOR pixel the graphic does not fully
                        // cover, so the ground shows through it.
                        //
                        // Measured, and this is the second definition: comparing
                        // the pixel's colour against the ground within a
                        // tolerance read 0 on the planted fixture, because a
                        // half-covered seam composites to a BLEND of the two
                        // greys and the ground — nowhere near the ground itself.
                        // Alpha is the thing that is actually wrong, and it is
                        // the same number whatever colour the ground is, which
                        // is why the finding fires on the dark row: that is the
                        // capture where the consequence is visible.
                        // Finding 7: a legitimately TRANSLUCENT interior is
                        // not a seam. A `fill-opacity="0.5"` shape is excluded
                        // from `painted` and would otherwise be counted as
                        // near-total bleed against a 0.002 threshold — a
                        // warning on a correct file, which is the Risk 1
                        // failure this whole concern is shaped around. The
                        // caller passes those shapes' extents the same way it
                        // passes declared holes, because "is this coverage
                        // intended" is again a question only the author
                        // answers.
                        const x = i % w;
                        const y = Math.floor(i / w);
                        if (!opaque(i) && !inHole(x, y) && !inSoft(x, y)) bleed += 1;
                    }
                    return { silhouette: sil, painted, low, bleed };
                },
                {
                    silhouette: silhouette.toString('base64'),
                    ground: shot.toString('base64'),
                    colour,
                    holes: spec.holeBoxes,
                    soft: spec.softBoxes,
                    vb: spec.viewBox,
                    minContrast: MIN_CONTRAST_RATIO,
                    graphic: graphicFraction(spec),
                },
            );
            if (counts === null) continue;
            out.push({
                background: mode,
                background_color: colour,
                silhouette_px: counts.silhouette,
                painted_px: counts.painted,
                low_contrast_px: counts.low,
                low_contrast_share: counts.painted === 0 ? 0 : counts.low / counts.painted,
                bleed_px: counts.bleed,
                bleed_share: counts.silhouette === 0 ? 0 : counts.bleed / counts.silhouette,
            });
        } finally {
            await scratch.close();
        }
    }
    return out;
}
