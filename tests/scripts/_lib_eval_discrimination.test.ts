import { describe, expect, it } from 'vitest';

import {
    computeDiscrimination,
    controlCaughtFromAssertions,
    type NegativeControl,
} from '../../src/scripts/_lib/eval_discrimination.js';

describe('controlCaughtFromAssertions', () => {
    it('caught when any assertion explicitly failed', () => {
        expect(controlCaughtFromAssertions([{ pass: true }, { pass: false }])).toBe(true);
    });

    it('not caught when all assertions pass', () => {
        expect(controlCaughtFromAssertions([{ pass: true }, { pass: true }])).toBe(false);
    });

    it('null (ungraded rubric) does NOT count as caught', () => {
        expect(controlCaughtFromAssertions([{ pass: null }, { pass: true }])).toBe(false);
    });
});

describe('computeDiscrimination', () => {
    const gross = (caught: boolean): NegativeControl => ({ id: 'gross-1', severity: 'gross', caught });
    const subtle = (caught: boolean): NegativeControl => ({ id: 'subtle-1', severity: 'subtle', caught });

    it('both controls caught → discrimination_ok = true', () => {
        const r = computeDiscrimination([gross(true), subtle(true)]);
        expect(r.discrimination_ok).toBe(true);
        expect(r.gross_caught).toBe(true);
        expect(r.subtle_caught).toBe(true);
    });

    it('gross caught but subtle missed → NOT ok (the green-check underpowered-null trap)', () => {
        const r = computeDiscrimination([gross(true), subtle(false)]);
        expect(r.discrimination_ok).toBe(false);
        expect(r.subtle_caught).toBe(false);
        expect(r.reason).toMatch(/underpowered/i);
    });

    it('gross missed → NOT ok (harness blind, cannot fail at all)', () => {
        const r = computeDiscrimination([gross(false), subtle(true)]);
        expect(r.discrimination_ok).toBe(false);
        expect(r.gross_caught).toBe(false);
        expect(r.reason).toMatch(/blind/i);
    });

    it('only a gross control (no subtle) → NOT ok (incomplete control set)', () => {
        const r = computeDiscrimination([gross(true)]);
        expect(r.discrimination_ok).toBe(false);
        expect(r.reason).toMatch(/incomplete/i);
    });

    it('empty control set → NOT ok', () => {
        const r = computeDiscrimination([]);
        expect(r.discrimination_ok).toBe(false);
    });
});
