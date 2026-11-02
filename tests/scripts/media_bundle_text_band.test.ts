// road-to-a-page-that-says-what-it-loads 6.1: the on-screen-text probe reads all
// three bands, so a slide-style frame (centre text, empty bottom) is flagged.
import { describe, expect, it } from 'vitest';

import { TEXT_BAND_EDGE_RATIO, textBandRatio } from '../../src/scripts/media_bundle';

const W = 64;
const H = 36;

/** A flat grey frame with a striped "text" block over rows [from, to). */
function frame(from: number, to: number): Uint8Array {
    const g = new Uint8Array(W * H).fill(128);
    for (let y = from; y < to; y++) for (let x = 8; x < W - 8; x++) g[y * W + x] = x % 2 === 0 ? 20 : 235;
    return g;
}

describe('textBandRatio', () => {
    it('flags a centre-text slide frame with an empty bottom band', () => {
        expect(textBandRatio(frame(14, 20), W, H)).toBeGreaterThanOrEqual(TEXT_BAND_EDGE_RATIO);
    });

    it('flags a top headline', () => {
        expect(textBandRatio(frame(2, 8), W, H)).toBeGreaterThanOrEqual(TEXT_BAND_EDGE_RATIO);
    });

    it('still flags bottom-band subtitles', () => {
        expect(textBandRatio(frame(28, 34), W, H)).toBeGreaterThanOrEqual(TEXT_BAND_EDGE_RATIO);
    });

    it('does not flag a text-free frame', () => {
        expect(textBandRatio(new Uint8Array(W * H).fill(128), W, H)).toBe(0);
    });
});
