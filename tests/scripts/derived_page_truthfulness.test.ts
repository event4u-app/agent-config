/**
 * Derived-page truthfulness — an unmeasured dimension emits no percentage.
 *
 * The recorded failure this pins: the always-budget report printed a share for
 * a dimension it counted ZERO artefacts in. `0 / 0` rendered as `0.0%`, which
 * reads as a measurement that came back low — the most confident possible way
 * to say nothing.
 *
 * The load-bearing assertion is the negative one: given an unmeasured
 * dimension, the rendered output must contain NO `%` at all. Asserting only
 * that the string says "not measured" would still pass a renderer that
 * helpfully appended `(0.0%)` beside it.
 */
import { describe, expect, it } from 'vitest';

import {
    NOT_MEASURED,
    renderCount,
    renderCoverage,
    renderShare,
} from '../../src/scripts/_lib/measured_render.js';

describe('renderShare', () => {
    it('renders a real share', () => {
        expect(renderShare(1, 4)).toBe('25.0%');
    });

    it('EMITS NO PERCENTAGE for an empty denominator', () => {
        const out = renderShare(0, 0);
        expect(out).toBe(NOT_MEASURED);
        expect(out).not.toContain('%');
    });

    it('EMITS NO PERCENTAGE when the dimension was explicitly not measured', () => {
        // A denominator being available does not prove the measurement ran.
        const out = renderShare(3, 100, { measured: false });
        expect(out).not.toContain('%');
    });

    it('refuses a non-finite denominator rather than rendering NaN%', () => {
        expect(renderShare(1, Number.NaN)).toBe(NOT_MEASURED);
        expect(renderShare(1, Number.POSITIVE_INFINITY)).toBe(NOT_MEASURED);
    });

    it('refuses a non-finite numerator', () => {
        expect(renderShare(Number.NaN, 10)).toBe(NOT_MEASURED);
    });

    it('a genuine zero over a real population IS reported — the guard is not a blanket mute', () => {
        expect(renderShare(0, 288)).toBe('0.0%');
    });
});

describe('renderCount', () => {
    it('renders a measured count', () => {
        expect(renderCount(7)).toBe('7');
    });

    it.each([null, undefined])('renders %s as not measured', (value) => {
        expect(renderCount(value)).toBe(NOT_MEASURED);
    });

    it('renders an unmeasured zero as not measured, not as 0', () => {
        expect(renderCount(0, false)).toBe(NOT_MEASURED);
        expect(renderCount(0, false)).not.toBe('0');
    });
});

describe('renderCoverage publishes the gap list beside the number', () => {
    it('names the un-covered artefacts', () => {
        const out = renderCoverage({ label: 'ledger', covered: 2, total: 4, gaps: ['a', 'b'] });
        expect(out).toContain('2/4');
        expect(out).toContain('not covered: a, b');
    });

    it('states the true remainder when the gap list is capped', () => {
        // A silently truncated gap list reads as "covered everything" exactly
        // like the bare number it was meant to qualify.
        const gaps = Array.from({ length: 12 }, (_, i) => `g${String(i)}`);
        const out = renderCoverage({ label: 'x', covered: 1, total: 13, gaps, maxGaps: 3 });
        expect(out).toContain('… and 9 more');
    });

    it('says "no gaps" rather than leaving the reader to infer it', () => {
        expect(renderCoverage({ label: 'x', covered: 4, total: 4, gaps: [] })).toContain('no gaps');
    });

    it('EMITS NO PERCENTAGE for an empty population', () => {
        const out = renderCoverage({ label: 'x', covered: 0, total: 0, gaps: [] });
        expect(out).not.toContain('%');
        expect(out).toContain(NOT_MEASURED);
    });
});
