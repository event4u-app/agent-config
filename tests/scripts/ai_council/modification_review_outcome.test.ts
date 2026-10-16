import { describe, expect, it } from 'vitest';

import {
    deriveModificationOutcome,
    deriveModificationVerdict,
} from '../../../src/scripts/ai_council/modification_review.js';
import { deriveRatificationHeader } from '../../../src/scripts/_lib/ratification_artifact.js';

const R = 2;

/**
 * Step 3.4's reconciliation, settled by a 2/2 council on 2026-10-12: the record's
 * header comes from `deriveRatificationHeader` alone, and the review's own rule
 * drives what the run does next. One call returns both, under different names,
 * so a caller cannot write the orchestration answer into the record.
 */
describe('3.4 — the header and the disposition are two answers, never one', () => {
    it('the measured contradiction: one seat ratified, the other gave no verdict', () => {
        const out = deriveModificationOutcome({ anthropic: 'ratified', openai: null }, R);
        // What the record says is what the evidence says…
        expect(out.header).toEqual({ providers: ['anthropic'], verdict: 'ratified' });
        // …and what the run does is NOT land it.
        expect(out.quorumSatisfied).toBe(false);
        expect(out.disposition).toBe('quorum-short');
        // The orchestration rule still answers what it always answered.
        expect(deriveModificationVerdict({ anthropic: 'ratified', openai: null }, R)).toBe(
            'non-convergent',
        );
    });

    it('the header is exactly the canonical derivation, for every case', () => {
        const cases = [
            { a: 'ratified', b: 'ratified' },
            { a: 'refused', b: null },
            { a: null, b: null },
            { a: 'confirmed-non-expanding', b: 'confirmed-non-expanding' },
        ] as const;
        for (const seats of cases) {
            const asSeat = Object.fromEntries(
                Object.entries(seats).map(([k, v]) => [k, v ?? 'no-final-verdict']),
            );
            expect(deriveModificationOutcome(seats, R).header).toEqual(
                deriveRatificationHeader(asSeat),
            );
        }
    });

    it('a refusal is a refusal before any count is taken', () => {
        expect(deriveModificationOutcome({ a: 'refused', b: null }, R).disposition).toBe('refused');
        expect(deriveModificationOutcome({ a: 'refused', b: 'ratified' }, R).disposition).toBe(
            'refused',
        );
    });

    it('accepted only when every concluding seat passed and quorum is met', () => {
        expect(deriveModificationOutcome({ a: 'ratified', b: 'ratified' }, R).disposition).toBe(
            'accepted',
        );
        expect(
            deriveModificationOutcome(
                { a: 'confirmed-non-expanding', b: 'ratified' },
                R,
            ).disposition,
        ).toBe('accepted');
        expect(deriveModificationOutcome({ a: null, b: null }, R).disposition).toBe('quorum-short');
    });
});
