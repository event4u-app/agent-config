/**
 * `svg-structure-filled-counter` — step 3.2 of `road-to-type-with-a-witness`.
 *
 * Two same-direction circles in one path, under `nonzero`: the inner subpath
 * adds to the winding number instead of cancelling it, so the counter paints.
 * Measured on Chromium against these fixtures: the disc paints 196,282 dark
 * pixels, each of its three ring twins 115,940. The finding is advisory
 * (decision A8) — a `warning`, never an error — until step 3.3 has measured
 * its false-positive count over the tracked SVGs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { filledCounters } from '../../src/scripts/_lib/svg_filled_counter.js';
import { parseElements, scanSvg } from '../../src/scripts/_lib/svg_rules.js';

const DIR = path.resolve(__dirname, '..', 'fixtures', 'svg-filled-counter');
const RULE = 'svg-structure-filled-counter';

function scan(name: string): string[] {
    const file = path.join(DIR, `${name}.svg`);
    return scanSvg(fs.readFileSync(file, 'utf8'), file)
        .filter((f) => f.rule === RULE)
        .map((f) => f.severity);
}

describe('svg-structure-filled-counter', () => {
    it('flags the two-circle disc under nonzero, as a warning', () => {
        expect(scan('disc-nonzero')).toEqual(['warning']);
    });

    it('stays quiet on the even-odd twin', () => {
        expect(scan('ring-evenodd')).toEqual([]);
    });

    it('stays quiet when the inner contour winds the other way', () => {
        expect(scan('ring-opposite-winding')).toEqual([]);
    });

    it('reads a fill rule inherited from an ancestor', () => {
        expect(scan('ring-inherited-evenodd')).toEqual([]);
    });

    it('names the subpaths it compared', () => {
        const content = fs.readFileSync(path.join(DIR, 'disc-nonzero.svg'), 'utf8');
        const hits = filledCounters(parseElements(content));
        expect(hits).toHaveLength(1);
        expect(hits[0]?.inner).toBe(2);
        expect(hits[0]?.outer).toBe(1);
    });

    it('does not flag side-by-side subpaths or a straight-edged counter wound correctly', () => {
        const svg = (d: string): string =>
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${d}"/></svg>`;
        // Two squares next to each other, same winding: neither contains the other.
        expect(filledCounters(parseElements(svg('M0 0H40V40H0Z M50 0H90V40H50Z')))).toEqual([]);
        // An "O" built from rectangles: outer clockwise, inner counter-clockwise.
        expect(filledCounters(parseElements(svg('M0 0H100V100H0Z M20 20V80H80V20Z')))).toEqual([]);
        // The same "O" with the inner square wound the same way — the counter fills.
        expect(filledCounters(parseElements(svg('M0 0H100V100H0Z M20 20H80V80H20Z')))).toHaveLength(1);
        // A bullseye: outer clockwise, counter counter-clockwise, island clockwise
        // inside the counter. The island's winding number is +1 — painted, as meant.
        expect(
            filledCounters(parseElements(svg('M0 0H100V100H0Z M10 10V90H90V10Z M30 30H70V70H30Z'))),
        ).toEqual([]);
        // The same bullseye with the counter wound wrongly still flags the counter.
        expect(
            filledCounters(parseElements(svg('M0 0H100V100H0Z M10 10H90V90H10Z M30 30V70H70V30Z'))).map(
                (h) => h.inner,
            ),
        ).toEqual([2]);
        // An unfilled outline is not a fill problem.
        expect(
            filledCounters(
                parseElements(
                    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" d="M0 0H100V100H0Z M20 20H80V80H20Z"/></svg>',
                ),
            ),
        ).toEqual([]);
    });
});
