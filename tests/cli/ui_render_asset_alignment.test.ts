import { describe, expect, it } from 'vitest';

import { bestAlignment, intersect, iouOf } from '../../src/cli/commands/uiRenderAssetCompare.js';
import { graphicFraction } from '../../src/cli/commands/uiRenderAssetGrounds.js';

/**
 * Finding 1 of the second completion review of `feat/svg-roadmaps-all-20261011`.
 *
 * `sub_pixel_offset` is reported as a measurement of how far the candidate sits
 * from the baseline. On the registered-raster path the candidate was clipped to
 * the baseline's silhouette BEFORE the alignment search, which makes it a
 * subset — and for a subset the search can never leave (0, 0). The number was a
 * constant wearing a reading's clothes, which is the one defect class this
 * branch is about.
 *
 * The proof is short enough to state: at zero shift a subset gives
 * |candidate| / |baseline|; any shift can only shrink the intersection and grow
 * the union, and `bestAlignment` replaces its seed on a STRICTLY greater value.
 * These cases are the proof executed.
 */
const W = 16;
const H = 16;

/** A filled rectangle mask, [x, y) half-open. */
function rect(x0: number, y0: number, x1: number, y1: number): Uint8Array {
    const m = new Uint8Array(W * H);
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) m[y * W + x] = 1;
    return m;
}

describe('the offset is measured before the clip, not after', () => {
    it('a clipped candidate can never report a shift', () => {
        const baseline = rect(4, 4, 12, 12);
        // The candidate as rendered: the same mark, two samples right and one
        // down. A reading worth having says so.
        const candidate = rect(6, 5, 14, 13);

        // What the code does now: align first.
        const live = bestAlignment(baseline, candidate, W, H);
        expect([live.dx, live.dy]).toEqual([-2, -1]);

        // What it did before: clip, then align. The clipped candidate is a
        // subset of the baseline by construction, so the search is pinned.
        const clipped = intersect(candidate, baseline);
        const old = bestAlignment(baseline, clipped, W, H);
        expect([old.dx, old.dy]).toEqual([0, 0]);

        // Not a coincidence of this one offset: every displacement reads 0
        // once the candidate is clipped, which is what makes it a constant
        // rather than an inaccuracy.
        for (const [ox, oy] of [[1, 0], [0, 3], [-2, 2], [3, -1]] as const) {
            const moved = rect(4 + ox, 4 + oy, 12 + ox, 12 + oy);
            const c = bestAlignment(baseline, intersect(moved, baseline), W, H);
            expect([c.dx, c.dy]).toEqual([0, 0]);
        }
    });

    it('clipping after the alignment still keeps a neighbour out of the IoU', () => {
        // The clip earns its place — it is why it was introduced — and the
        // reordering must not give that up. A candidate carrying a second mark
        // beside the subject scores on the subject alone.
        const baseline = rect(4, 4, 8, 8);
        const withNeighbour = intersect(new Uint8Array(W * H).fill(1), rect(0, 0, W, H));
        for (let y = 10; y < 14; y += 1) for (let x = 10; x < 14; x += 1) withNeighbour[y * W + x] = 1;
        const candidate = rect(4, 4, 8, 8);
        for (let y = 10; y < 14; y += 1) for (let x = 10; x < 14; x += 1) candidate[y * W + x] = 1;

        const { dx, dy } = bestAlignment(baseline, candidate, W, H);
        expect([dx, dy]).toEqual([0, 0]);
        // Unclipped, the neighbour is in the union and costs half the score.
        expect(iouOf(baseline, candidate)).toBeCloseTo(16 / 32, 6);
        // Clipped to the subject, the candidate is judged on what it painted
        // there — which is all of it.
        expect(iouOf(baseline, intersect(candidate, baseline))).toBe(1);
    });
});

/**
 * Finding 4 of the same review. Pinned on the arithmetic rather than on a
 * rendered fixture, and the reason is worth stating because the obvious test
 * is the other one: three planted/clean pairs were built and none of them
 * could separate the two mappings at icon resolution. A 24-unit viewBox drawn
 * at 48 px puts one user unit at two device pixels, so the sub-pixel seam that
 * makes the `mark`-scale fixture fire is fully covered by anti-aliasing here,
 * and the pair went green under BOTH mappings — a test that cannot fail on the
 * defect is not evidence. The arithmetic can, and does.
 */
describe('the graphic covers part of the capture, and the boxes follow it', () => {
    const vb = { x: 0, y: 0, w: 24, h: 24 };

    it('an icon is a fraction of its capture, not all of it', () => {
        // The case every icon in this suite is: sizes 16/24/48, viewport
        // floored at 64. Under the old mapping these were all 1.
        expect(graphicFraction({ width: 64, height: 64, cssWidth: 48, viewBox: vb })).toEqual({
            w: 0.75,
            h: 0.75,
        });
        expect(graphicFraction({ width: 64, height: 64, cssWidth: 16, viewBox: vb })).toEqual({
            w: 0.25,
            h: 0.25,
        });
        // A declared hole at the centre of a 24-unit file maps to the centre
        // of the GRAPHIC. Under the old mapping it landed at 0.75 of the way
        // across the capture — outside the box the author declared.
        const f = graphicFraction({ width: 64, height: 64, cssWidth: 48, viewBox: vb });
        const centreOfGraphic = (64 * f.w) / 2;
        expect(vb.x + (centreOfGraphic / (64 * f.w)) * vb.w).toBe(12);
        expect(vb.x + (centreOfGraphic / 64) * vb.w).toBe(9);
    });

    it('a non-square viewBox takes its height from the aspect', () => {
        // A wordmark: the width is what is set, the height follows.
        expect(
            graphicFraction({ width: 100, height: 100, cssWidth: 100, viewBox: { x: 0, y: 0, w: 200, h: 50 } }),
        ).toEqual({ w: 1, h: 0.25 });
    });

    it('a capture the graphic fills, and the degenerate inputs', () => {
        // Equal sizes: the whole capture, which is the case the old mapping
        // was right about and the only one it was right about.
        expect(graphicFraction({ width: 48, height: 48, cssWidth: 48, viewBox: vb })).toEqual({ w: 1, h: 1 });
        // Wider than the viewport is still the whole capture, never more.
        expect(graphicFraction({ width: 48, height: 48, cssWidth: 96, viewBox: vb })).toEqual({ w: 1, h: 1 });
        // No viewBox: nothing to map into, so the width is still honest and
        // the height does not pretend to know an aspect.
        expect(graphicFraction({ width: 64, height: 64, cssWidth: 48, viewBox: null })).toEqual({ w: 0.75, h: 1 });
        // Degenerate input is the whole capture rather than a divide by zero.
        expect(graphicFraction({ width: 0, height: 0, cssWidth: 48, viewBox: vb })).toEqual({ w: 1, h: 1 });
    });
});
