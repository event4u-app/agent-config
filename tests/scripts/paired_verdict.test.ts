import { describe, expect, it } from 'vitest';

import { correctForMultiplicity, decidePairedVerdict, holmSignificant } from '../../src/scripts/_lib/paired_verdict.js';

describe('Holm step-down over the candidates of one run', () => {
    it('rejects in order until the first p above its step bound', () => {
        expect(holmSignificant([0.001, 0.03, 0.04], 0.05)).toEqual([true, false, false]);
        expect(holmSignificant([0.01, 0.02, 0.04], 0.05)).toEqual([true, true, true]);
        expect(holmSignificant([0.04, 0.001], 0.05)).toEqual([true, true]);
        expect(holmSignificant([], 0.05)).toEqual([]);
    });

    it('five candidates each just under alpha alone are not significant after correction', () => {
        const alone = decidePairedVerdict({ deltas: [1, 1, 1, 1, 1] });
        expect(alone.kind).toBe('pass');
        expect(alone.p).toBeLessThan(0.05);
        const corrected = correctForMultiplicity([alone, alone, alone, alone, alone]);
        expect(corrected.every((v) => v.kind === 'no-change')).toBe(true);
        expect(corrected[0]?.reason).toMatch(/Holm/);
    });

    it('keeps a strong result significant and leaves underpowered verdicts untouched', () => {
        const strong = decidePairedVerdict({ deltas: Array(12).fill(1) });
        const weak = decidePairedVerdict({ deltas: [1, 1] });
        const out = correctForMultiplicity([strong, weak]);
        expect(out[0]?.kind).toBe('pass');
        expect(out[1]?.kind).toBe('underpowered');
    });
});
