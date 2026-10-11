import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { assetSizes, biggestSize, isDeclaredTranslucent } from '../../src/cli/commands/uiRenderAsset.js';
import { readIconReferencesDetailed } from '../../src/cli/commands/uiRenderAssetGrid.js';
import type { SvgElement } from '../../src/scripts/_lib/svg_rules.js';

/** Findings 5, 6 and 8 of the third completion review, each reproduced first. */
const el = (attrs: Record<string, string>): SvgElement =>
    ({ name: 'rect', attrs, line: 1, start: 0, selfClosing: true, closing: false, raw: '' });

describe('three readings that returned the wrong number', () => {
    it('a percentage opacity is a declaration, and so is a translucent stroke', () => {
        // Finding 8. `Number('50%')` is NaN, so the shape read as NOT declared
        // translucent and every one of its pixels was counted as background
        // bleeding through the author's paint — the exact false warning the
        // declaration exists to prevent.
        expect(isDeclaredTranslucent(el({ 'fill-opacity': '50%' }))).toBe(true);
        expect(isDeclaredTranslucent(el({ opacity: '50%' }))).toBe(true);
        expect(isDeclaredTranslucent(el({ style: 'fill-opacity: 50%' }))).toBe(true);
        // `stroke-opacity` was not in the list at all.
        expect(isDeclaredTranslucent(el({ 'stroke-opacity': '0.4' }))).toBe(true);
        expect(isDeclaredTranslucent(el({ 'stroke-opacity': '40%' }))).toBe(true);
        // The decimal spelling still works, and an opaque shape is still opaque.
        expect(isDeclaredTranslucent(el({ 'fill-opacity': '0.5' }))).toBe(true);
        expect(isDeclaredTranslucent(el({ 'fill-opacity': '1' }))).toBe(false);
        expect(isDeclaredTranslucent(el({ 'fill-opacity': '100%' }))).toBe(false);
        expect(isDeclaredTranslucent(el({}))).toBe(false);
        // Garbage is not a declaration — it must not quietly exclude a shape.
        expect(isDeclaredTranslucent(el({ 'fill-opacity': 'inherit' }))).toBe(false);
    });

    it('the biggest capture is the largest, not the last', () => {
        // Finding 6. `assetSizes` PREPENDS the small mark sizes, so the last
        // entry is the 2x scaled size — smaller than 32 whenever the intrinsic
        // width is under 16.
        const sizes = assetSizes('mark', { width: 10, height: 10 });
        // The shape of the trap: the LAST entry is 20 and the largest is 32.
        expect(sizes[sizes.length - 1]?.width).toBe(20);
        expect(biggestSize(sizes).width).toBe(32);
        // And for the ordinary case the two agree, which is why it went
        // unnoticed: a mark of intrinsic width 100 ends at its own 2x.
        const wide = assetSizes('mark', { width: 100, height: 50 });
        expect(biggestSize(wide).width).toBe(200);
        expect(biggestSize(wide)).toEqual(wide[wide.length - 1]);
        // An empty list is the documented fallback, never a crash.
        expect(biggestSize([])).toEqual({ label: '1x', width: 64, height: 64 });
    });

    it('a reference icon is read with the same walk as the candidate', () => {
        // Finding 5. The candidate's stroke reading moved onto
        // `renderingElements` and the reference side did not, so a clip path's
        // stroke-width leaked into the incumbent set the candidate is judged
        // against.
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-refs-'));
        try {
            const file = path.join(root, 'ref.svg');
            fs.writeFileSync(
                file,
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">\n' +
                    '  <title>t</title>\n' +
                    '  <clipPath id="c"><rect x="0" y="0" width="24" height="24" stroke-width="8"/></clipPath>\n' +
                    '  <path d="M4 12h16" stroke="#000" stroke-width="1.5" fill="none"/>\n' +
                    '</svg>\n',
            );
            const { refs } = readIconReferencesDetailed([file]);
            expect(refs).toHaveLength(1);
            expect(refs[0]?.strokeWidths).toEqual([1.5]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
