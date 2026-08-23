/**
 * E3.1 behaviour. The pure helpers are unit-tested here; the Playwright path is
 * covered by a real capture whose result is recorded in the commit message
 * (three viewports, zero surviving processes, a genuine 320 px overflow found in
 * a corpus fixture).
 */
import { describe, expect, it } from 'vitest';

import {
    CAPTURED_PROPERTIES,
    VIEWPORTS,
    collectPalette,
    collectTypeFamilies,
    slugify,
} from './uiRender.js';

describe('E3.1 — the three viewports are the contract', () => {
    it('captures desktop, 375 and 320', () => {
        expect(VIEWPORTS.map((v) => v.width)).toEqual([1440, 375, 320]);
    });

    it('includes 320 because the fidelity roadmap AC-6 floor is stated there', () => {
        expect(VIEWPORTS.some((v) => v.width === 320)).toBe(true);
    });

    it('captures the properties the A1.5 delta needs, plus the overflow signals', () => {
        for (const p of ['color', 'background-color', 'font-family', 'overflow-x']) {
            expect(CAPTURED_PROPERTIES as unknown as string[]).toContain(p);
        }
    });
});

describe('palette extraction feeds the A1.5 threshold', () => {
    it('drops fully transparent values', () => {
        expect(
            collectPalette([{ color: 'rgb(1, 2, 3)', 'background-color': 'rgba(0, 0, 0, 0)' }]),
        ).toEqual(['rgb(1, 2, 3)']);
    });

    it('dedupes and sorts, so a delta is a set difference and not an ordering artefact', () => {
        expect(
            collectPalette([
                { color: 'rgb(9, 9, 9)' },
                { color: 'rgb(1, 1, 1)' },
                { 'border-color': 'rgb(9, 9, 9)' },
            ]),
        ).toEqual(['rgb(1, 1, 1)', 'rgb(9, 9, 9)']);
    });

    it('ignores properties outside the colour set', () => {
        expect(collectPalette([{ 'font-size': '16px' }])).toEqual([]);
    });
});

describe('type-family extraction takes the FIRST choice only', () => {
    it('the winning family is the one that matters, not the fallback stack', () => {
        expect(collectTypeFamilies([{ 'font-family': 'Fraunces, Georgia, serif' }])).toEqual(['fraunces']);
    });

    it('strips quotes so a quoted and unquoted declaration are one family', () => {
        expect(collectTypeFamilies([{ 'font-family': '"IBM Plex Sans", system-ui' }, { 'font-family': 'IBM Plex Sans' }])).toEqual(
            ['ibm plex sans'],
        );
    });

    it('is empty when nothing declares a family', () => {
        expect(collectTypeFamilies([{ color: 'red' }])).toEqual([]);
    });
});

describe('slug is stable and filesystem-safe', () => {
    it('strips the scheme and collapses separators', () => {
        expect(slugify('https://example.com/pricing?x=1')).toBe('example-com-pricing-x-1');
    });

    it('is deterministic for the same target', () => {
        expect(slugify('a/b/c.html')).toBe(slugify('a/b/c.html'));
    });

    it('never yields an empty directory name', () => {
        expect(slugify('///')).toBe('render');
    });
});
