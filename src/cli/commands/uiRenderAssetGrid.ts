/**
 * uiRenderAssetGrid — the incumbent icon grid, read from the set's own SVGs.
 *
 * Step E6 of `road-to-svg-with-a-witness`, carrying findings 2.1 and 2.2 of
 * `road-to-svg-rules-in-the-dispatch-path`. Its own module because
 * `uiRenderAsset.ts` is over the source-size budget and this is the most
 * self-contained reading in it: no browser, no page, no shared state — bytes
 * in, one grading out, which is also why its two findings are exercisable
 * without a render.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { elementExtent, parseElements, readViewBox } from '../../scripts/lint_svg_asset.js';
import type { SvgElement, ViewBox } from '../../scripts/lint_svg_asset.js';
import type { Box, IconGridReading } from './uiRenderAssetTypes.js';

/**
 * Elements whose contents DEFINE something rather than paint it.
 *
 * A shape inside one of these never appears on the canvas on its own, so it
 * must not contribute to the graphic's extent. `<pattern>` and `<symbol>` join
 * the three obvious ones for the same reason.
 */
const NON_RENDERING = new Set(['defs', 'clippath', 'mask', 'symbol', 'marker', 'pattern']);

/**
 * The elements that actually paint: everything outside a transformed subtree
 * and outside a non-rendering container.
 *
 * Extracted by finding 9 of this change's second completion review. The extent
 * reading did this walk and the stroke-width reading did not, so an icon whose
 * clip path carried `stroke-width="8"` reported 8 as its stroke while its
 * padding was measured from the 1.5 the viewer sees. Two readings of the same
 * file disagreeing about which elements are in it is the shape a shared walk
 * removes by construction — the previous fix widened the extent half and left
 * the other, which is exactly how the pair came to disagree.
 */
function renderingElements(elements: ReadonlyArray<SvgElement>): SvgElement[] {
    const out: SvgElement[] = [];
    const openSkips: boolean[] = [];
    let skipDepth = 0;
    for (const el of elements) {
        if (el.closing) {
            const was = openSkips.pop();
            if (was === true) skipDepth -= 1;
            continue;
        }
        const carries =
            Boolean(el.attrs['transform'] || el.attrs['style']?.includes('transform')) ||
            NON_RENDERING.has(el.name);
        if (!el.selfClosing) {
            openSkips.push(carries);
            if (carries) skipDepth += 1;
        }
        if (skipDepth > 0 || (el.selfClosing && carries)) continue;
        out.push(el);
    }
    return out;
}

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
    // Two reasons to skip a subtree, tracked on one stack: an ancestor carries
    // a transform, or an ancestor DOES NOT RENDER.
    //
    // The second is finding 3 of this change's completion review. Geometry
    // inside `<defs>`, `<clipPath>`, `<mask>`, `<symbol>`, `<marker>` or
    // `<pattern>` is a definition, not paint — and a clip path is usually a
    // full-bleed rect, so an exported icon reported padding 0 on BOTH sides
    // and the comparison finding 2.2 exists to make meaningful compared two
    // zeroes. The old `d`-scraping reader had the same blind spot; reading
    // primitives widened it, because clip and mask shapes are rects and
    // circles.
    for (const el of renderingElements(elements)) {
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
        // The SAME walk the candidate's stroke reading uses. Finding 5 of the
        // third completion review: the candidate side was moved onto
        // `renderingElements` and the reference side was not, so a reference
        // icon's clip path contributed a stroke the viewer never sees.
        // Reproduced: two byte-identical files reported 1.5 against [1.5, 8].
        // The same defect as finding 9 of the previous round, in the other
        // half of the same pair — which is what a defect-pattern sweep over
        // the construct, rather than over the one reported site, is for.
        const strokes = new Set<number>();
        for (const el of renderingElements(elements)) {
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
    for (const el of renderingElements(elements)) {
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
                    ? (refs.length === 0 && skipped.length === 0 && iconSet.length > 0
                          ? 'every file in the supplied icon reference set is the file under test, so there is ' +
                            'nothing to compare against'
                          : iconSet.length === 0
                          ? 'no icon reference set was supplied, so the incumbent grid was never read (E6)'
                            : 'an icon reference set was supplied but no file in it yielded a reading, so there ' +
                              'is no grid to compare against') + unreadable
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
