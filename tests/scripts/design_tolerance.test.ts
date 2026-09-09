/**
 * Value reconciliation — the three verdicts and the distance-on-every-row rule.
 *
 * `road-to-design-intent-conformance` 3.2 names the cases by hand: three
 * fixtures — inside tolerance, outside tolerance, switched off — produce three
 * DISTINCT verdicts, and every value row carries a distance to the nearest
 * project token even when the value is preserved.
 *
 * The fixtures configure their own tolerances explicitly. That is not a
 * convenience: the shipped config carries `null` on both axes by council
 * verdict, so a test that leaned on a shipped number would either be testing a
 * number nobody decided or be impossible to write. Configuring locally is what
 * lets the MECHANISM be exercised while the THRESHOLD stays absent — which is
 * exactly the split the council asked for.
 */
import { describe, expect, it } from 'vitest';

import {
    COLOR_DISTANCE_METRIC,
    LENGTH_DISTANCE_METRIC,
    OBSERVED_LENGTH_CANDIDATE_PX,
    SHIPPED_TOLERANCE,
    type ToleranceConfig,
    type TokenCandidate,
    deltaEOK,
    formatRow,
    lengthDistancePx,
    nearestToken,
    parseHex,
    parseLengthPx,
    reconcileValue,
} from '../../src/scripts/_lib/design_tolerance.js';

/** A project palette. `brand` is a near-neighbour of the artifact's `#3b82f6`. */
const PALETTE: TokenCandidate[] = [
    { name: 'color.brand', value: '#3b82f7' },
    { name: 'color.ink', value: '#111827' },
    { name: 'color.paper', value: '#ffffff' },
];

const SPACING: TokenCandidate[] = [
    { name: 'space.2', value: '8px' },
    { name: 'space.4', value: '16px' },
    { name: 'space.6', value: '24px' },
];

const ON = (over: Partial<ToleranceConfig> = {}): ToleranceConfig => ({
    enabled: true,
    color: 0.01,
    length: 1,
    ...over,
});

describe('the shipped configuration', () => {
    // The council's verdict, as an assertion. A future edit that fills either
    // field in has to delete this test, which is the point: the deletion is the
    // decision, and it becomes visible in review instead of arriving as a
    // plausible-looking default.
    it('ships both thresholds absent and the mechanism off', () => {
        expect(SHIPPED_TOLERANCE).toEqual({ enabled: false, color: null, length: null });
    });

    // Primer's ±1px is EVIDENCE, not a default. Nothing may read it as one.
    it('records the observed length candidate without adopting it', () => {
        expect(OBSERVED_LENGTH_CANDIDATE_PX).toBe(1);
        expect(SHIPPED_TOLERANCE.length).toBeNull();
    });
});

describe('the three verdicts 3.2 names by hand', () => {
    it('inside tolerance — the project token wins and the outcome is reported', () => {
        const row = reconcileValue('color', '#3b82f6', PALETTE, ON());
        expect(row.outcome).toBe('reconciled');
        expect(row.resolved).toBe('#3b82f7');
        expect(row.nearest?.name).toBe('color.brand');
    });

    it('outside tolerance — the artifact value is preserved and the gap reported', () => {
        const row = reconcileValue('color', '#3b82f6', PALETTE, ON({ color: 0.0000001 }));
        expect(row.outcome).toBe('preserved-outside-tolerance');
        expect(row.resolved).toBe('#3b82f6');
        expect(row.nearest?.name).toBe('color.brand');
    });

    it('switched off — preserved, and said to be preserved because it is off', () => {
        const row = reconcileValue('color', '#3b82f6', PALETTE, SHIPPED_TOLERANCE);
        expect(row.outcome).toBe('preserved-mechanism-off');
        expect(row.resolved).toBe('#3b82f6');
    });

    it('the three outcomes are distinct', () => {
        const outcomes = new Set([
            reconcileValue('color', '#3b82f6', PALETTE, ON()).outcome,
            reconcileValue('color', '#3b82f6', PALETTE, ON({ color: 1e-7 })).outcome,
            reconcileValue('color', '#3b82f6', PALETTE, SHIPPED_TOLERANCE).outcome,
        ]);
        expect(outcomes.size).toBe(3);
    });

    // `enabled: true` with no threshold cannot act, so it must report as OFF
    // rather than as a decision. Collapsing these two into one outcome is
    // deliberate and pinned.
    it('enabled with a null threshold reports as off, not as reconciled', () => {
        const row = reconcileValue('color', '#3b82f6', PALETTE, ON({ color: null }));
        expect(row.outcome).toBe('preserved-mechanism-off');
    });
});

describe('every row carries its distance, even when preserved', () => {
    it.each([
        ['inside', ON()],
        ['outside', ON({ color: 1e-7 })],
        ['off', SHIPPED_TOLERANCE],
    ])('%s tolerance still reports a distance and a metric', (_label, config) => {
        const row = reconcileValue('color', '#3b82f6', PALETTE, config as ToleranceConfig);
        expect(row.distance).toBeGreaterThan(0);
        expect(row.metric).toBe(COLOR_DISTANCE_METRIC);
        expect(formatRow(row)).toContain('distance');
    });

    it('a length row reports its distance in pixels', () => {
        const row = reconcileValue('length', '15px', SPACING, SHIPPED_TOLERANCE);
        expect(row.nearest?.name).toBe('space.4');
        expect(row.distance).toBe(1);
        expect(row.metric).toBe(LENGTH_DISTANCE_METRIC);
    });

    // The one legitimate null: there is nothing to measure against. Reported as
    // its own outcome rather than as a distance of zero, which would read as
    // "identical to a token" — the opposite of the truth.
    it('reports no-candidate rather than a zero distance when the palette is empty', () => {
        const row = reconcileValue('color', '#3b82f6', [], SHIPPED_TOLERANCE);
        expect(row.outcome).toBe('no-candidate');
        expect(row.distance).toBeNull();
        expect(row.resolved).toBe('#3b82f6');
    });
});

describe('the colour metric', () => {
    it('is zero for a colour against itself', () => {
        expect(deltaEOK('#3b82f6', '#3b82f6')).toBe(0);
    });

    it('is symmetric', () => {
        const a = deltaEOK('#3b82f6', '#111827');
        const b = deltaEOK('#111827', '#3b82f6');
        expect(a).toBeCloseTo(b as number, 12);
    });

    // The property the metric was chosen FOR, and the reason `±5 per RGB
    // channel` was rejected: RGB channel distance is not perceptually uniform,
    // so a near-neighbour must come out far closer than an unrelated hue even
    // when the raw channel deltas are comparable.
    it('ranks a near-neighbour far closer than an unrelated colour', () => {
        const near = deltaEOK('#3b82f6', '#3b82f7') as number;
        const far = deltaEOK('#3b82f6', '#f63b82') as number;
        expect(near).toBeLessThan(far / 10);
    });

    it('returns null rather than a number for an unparseable value', () => {
        expect(deltaEOK('#3b82f6', 'var(--brand)')).toBeNull();
        expect(deltaEOK('rebeccapurple', '#3b82f6')).toBeNull();
    });

    it('treats the three-digit form as its expansion', () => {
        expect(deltaEOK('#fff', '#ffffff')).toBe(0);
        expect(parseHex('#fff')).toEqual(parseHex('#ffffff'));
    });
});

describe('the length metric', () => {
    it('resolves rem against a 16px root', () => {
        expect(parseLengthPx('1rem')).toBe(16);
        expect(lengthDistancePx('1rem', '16px')).toBe(0);
    });

    it('returns null for a unit it cannot resolve', () => {
        expect(parseLengthPx('4vh')).toBeNull();
        expect(lengthDistancePx('4vh', '16px')).toBeNull();
    });
});

describe('nearestToken', () => {
    it('skips candidates it cannot measure instead of failing', () => {
        const best = nearestToken('color', '#3b82f6', [
            { name: 'broken', value: 'var(--x)' },
            { name: 'good', value: '#3b82f7' },
        ]);
        expect(best?.candidate.name).toBe('good');
    });

    it('returns null when nothing is measurable', () => {
        expect(nearestToken('color', '#3b82f6', [{ name: 'x', value: 'var(--x)' }])).toBeNull();
    });
});
