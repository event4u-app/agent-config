import { describe, expect, it } from 'vitest';

import { parseRegistration } from '../../src/cli/commands/uiRenderAssetCompare.js';

/** Finding 7 of the fourth completion review. */
describe('a registration crop has to be a crop', () => {
    it('a rectangle with no area is refused, like a scale with no size', () => {
        // `scale <= 0` was refused with a reason — a zero or negative scale is
        // not a frame — and the same reason applies to the rectangle, which was
        // never checked at all.
        expect(parseRegistration('0,0,0,0')).toBeNull();
        expect(parseRegistration('10,10,-5,-5')).toBeNull();
        expect(parseRegistration('10,10,100,0')).toBeNull();
        expect(parseRegistration('10,10,0,100')).toBeNull();
        // The refusals that already worked, unchanged.
        expect(parseRegistration('10,10,100,100@0')).toBeNull();
        expect(parseRegistration('10,10,100')).toBeNull();
        expect(parseRegistration('a,b,c,d')).toBeNull();
        expect(parseRegistration(undefined)).toBeNull();
        // And a real crop still reads, including a negative ORIGIN, which is
        // legal — only the size has to be positive.
        expect(parseRegistration('10,10,100,80@2')).toEqual({ x: 10, y: 10, width: 100, height: 80, scale: 2 });
        expect(parseRegistration('-5,-5,20,20')).toEqual({ x: -5, y: -5, width: 20, height: 20, scale: 1 });
    });
});
