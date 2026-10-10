import { describe, expect, it } from 'vitest';

import {
    deriveModificationVerdict,
} from '../../../src/scripts/ai_council/modification_review.js';

const R = 2; // required_providers, as src/config/ratification-policy.json ships it

describe('3.3 — the verdict is derived, by one rule, in one order', () => {
    it('any concluding seat on refused gives refused — before any count is taken', () => {
        expect(deriveModificationVerdict({ a: 'refused', b: 'ratified' }, R)).toBe('refused');
        // Even when the refusing seat is the ONLY one that concluded, so the
        // quorum rule would otherwise have fired first.
        expect(deriveModificationVerdict({ a: 'refused', b: null }, R)).toBe('refused');
    });

    it('fewer concluding providers than required gives non-convergent', () => {
        expect(deriveModificationVerdict({ a: 'ratified', b: null }, R)).toBe('non-convergent');
        expect(deriveModificationVerdict({ a: null, b: null }, R)).toBe('non-convergent');
        expect(deriveModificationVerdict({}, R)).toBe('non-convergent');
    });

    it('ratified if ANY concluding seat said so', () => {
        expect(deriveModificationVerdict({ a: 'ratified', b: 'ratified' }, R)).toBe('ratified');
        expect(
            deriveModificationVerdict({ a: 'ratified', b: 'confirmed-non-expanding' }, R),
        ).toBe('ratified');
    });

    it('confirmed-non-expanding only if ALL concluding seats said so', () => {
        expect(
            deriveModificationVerdict(
                { a: 'confirmed-non-expanding', b: 'confirmed-non-expanding' },
                R,
            ),
        ).toBe('confirmed-non-expanding');
    });

    it('a non-concluding seat never counts toward the quorum', () => {
        expect(
            deriveModificationVerdict({ a: 'ratified', b: 'ratified', c: null }, R),
        ).toBe('ratified');
        expect(deriveModificationVerdict({ a: 'ratified', b: null, c: null }, R)).toBe(
            'non-convergent',
        );
    });

    it('the required count is a parameter, not a constant baked in here', () => {
        expect(deriveModificationVerdict({ a: 'ratified' }, 1)).toBe('ratified');
        expect(deriveModificationVerdict({ a: 'ratified', b: 'ratified' }, 3)).toBe(
            'non-convergent',
        );
    });

    it('refusal beats a quorum that would otherwise pass — order is the rule', () => {
        expect(
            deriveModificationVerdict({ a: 'ratified', b: 'ratified', c: 'refused' }, R),
        ).toBe('refused');
    });
});
