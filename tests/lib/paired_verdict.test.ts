/**
 * paired_verdict — direction decides, magnitude reports.
 *
 * The load-bearing case is `the clean sweep a magnitude-weighted verdict
 * fails`: it is the observed defect, reproduced here as an assertion rather
 * than described in a comment, so a future change that reinstates magnitude
 * weighting reds instead of passing quietly.
 */
import { describe, expect, it } from 'vitest';

import {
    ALPHA,
    MIN_DISCORDANT,
    decidePairedVerdict,
    deriveMinDiscordant,
    exactOneSidedP,
    floorWarning,
    passRate,
} from '../../src/scripts/_lib/paired_verdict.js';

describe('the floor is derived, not chosen', () => {
    it('is the smallest n whose perfect sweep can clear alpha', () => {
        expect(MIN_DISCORDANT).toBe(5);
        expect(0.5 ** 4).toBeGreaterThan(ALPHA);
        expect(0.5 ** 5).toBeLessThanOrEqual(ALPHA);
    });

    it('moves with alpha rather than staying a stale constant', () => {
        expect(deriveMinDiscordant(0.01)).toBe(7);
        expect(deriveMinDiscordant(0.5)).toBe(1);
    });
});

describe('exactOneSidedP', () => {
    it('a perfect sweep of n is 0.5^n', () => {
        expect(exactOneSidedP(5, 5)).toBeCloseTo(0.03125, 8);
        expect(exactOneSidedP(10, 10)).toBeCloseTo(0.0009765625, 10);
    });

    it('one dissent at the floor already fails — the arithmetic the warning is about', () => {
        expect(exactOneSidedP(4, 5)).toBeCloseTo(0.1875, 8);
    });

    it('no discordant trials is p=1, never a division by zero', () => {
        expect(exactOneSidedP(0, 0)).toBe(1);
    });
});

describe('direction, not magnitude', () => {
    it('passes the clean sweep a magnitude-weighted verdict fails', () => {
        // Eight small wins and one large loss. A magnitude-weighted interval
        // straddles zero here; direction does not.
        const v = decidePairedVerdict({ deltas: [1, 1, 1, 1, 1, 1, 1, 1, -40] });
        expect(v.kind).toBe('pass');
        expect(v.wins).toBe(8);
        expect(v.losses).toBe(1);
        // And the magnitude is still REPORTED — it just decided nothing.
        expect(v.magnitude_mean).toBeLessThan(0);
    });

    it('ties are excluded rather than diluting the count', () => {
        const withTies = decidePairedVerdict({ deltas: [1, 1, 1, 1, 1, 0, 0, 0, 0, 0] });
        const without = decidePairedVerdict({ deltas: [1, 1, 1, 1, 1] });
        expect(withTies.discordant).toBe(5);
        expect(withTies.p).toBeCloseTo(without.p, 12);
    });

    it('honours a tie epsilon for continuous deltas', () => {
        const v = decidePairedVerdict({ deltas: [0.001, -0.001, 1, 1, 1, 1, 1], tieEpsilon: 0.01 });
        expect(v.discordant).toBe(5);
        expect(v.kind).toBe('pass');
    });

    it('calls a losing sweep a regression, not a failed pass', () => {
        const v = decidePairedVerdict({ deltas: [-1, -1, -1, -1, -1, -1] });
        expect(v.kind).toBe('regression');
    });

    it('a genuine coin-flip is no-change, and is decidable', () => {
        const v = decidePairedVerdict({ deltas: [1, -1, 1, -1, 1, -1, 1, -1] });
        expect(v.kind).toBe('no-change');
        expect(v.p).toBeGreaterThan(ALPHA);
    });
});

describe('underpowered is its own verdict', () => {
    it('below the floor is underpowered, never no-change', () => {
        const v = decidePairedVerdict({ deltas: [1, 1, 1, 1] });
        expect(v.kind).toBe('underpowered');
        expect(v.reason).toContain('absent measurement');
    });

    it('an all-tie sample is underpowered rather than a null result', () => {
        expect(decidePairedVerdict({ deltas: [0, 0, 0, 0, 0, 0, 0] }).kind).toBe('underpowered');
    });

    it('is excluded from the pass-rate denominator', () => {
        const rate = passRate([
            decidePairedVerdict({ deltas: [1, 1, 1, 1, 1] }),
            decidePairedVerdict({ deltas: [-1, -1, -1, -1, -1] }),
            decidePairedVerdict({ deltas: [1, 1] }),
        ]);
        expect(rate).toEqual({ rate: 0.5, decided: 2, excluded: 1 });
    });

    it('an all-underpowered set has NO rate rather than a rate of zero', () => {
        expect(passRate([decidePairedVerdict({ deltas: [1] })])).toBeNull();
    });
});

describe('the at-floor warning', () => {
    it('fires exactly on the floor and names the arithmetic', () => {
        const v = decidePairedVerdict({ deltas: [1, 1, 1, 1, 1] });
        const w = floorWarning(v);
        expect(w).toContain('0.1875');
        expect(w).toContain('Raise the trial count');
    });

    it('is silent above the floor', () => {
        expect(floorWarning(decidePairedVerdict({ deltas: [1, 1, 1, 1, 1, 1] }))).toBeNull();
    });

    it('is silent below the floor — that case is underpowered, a different message', () => {
        expect(floorWarning(decidePairedVerdict({ deltas: [1, 1, 1] }))).toBeNull();
    });
});
