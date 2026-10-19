import { describe, expect, it } from 'vitest';

import {
    deriveModificationOutcome,
    deriveModificationVerdict,
    readSeatConclusions,
} from '../../../src/scripts/ai_council/modification_review.js';
import { deriveRatificationHeader } from '../../../src/scripts/_lib/ratification_artifact.js';

const R = 2;

describe('3.4 — the header and the disposition are two answers, never one', () => {
    it('one seat ratified, the other gave no verdict', () => {
        const out = deriveModificationOutcome({ anthropic: 'ratified', openai: null }, R);
        expect(out.header).toEqual({ providers: ['anthropic'], verdict: 'ratified' });
        expect(out.quorumSatisfied).toBe(false);
        expect(out.disposition).toBe('quorum-short');
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
            deriveModificationOutcome({ a: 'confirmed-non-expanding', b: 'ratified' }, R)
                .disposition,
        ).toBe('accepted');
        expect(deriveModificationOutcome({ a: null, b: null }, R).disposition).toBe('quorum-short');
        expect(deriveModificationOutcome({}, 1).disposition).toBe('quorum-short');
    });

    it('a threshold of one still needs one concluding seat', () => {
        expect(deriveModificationOutcome({ a: 'ratified' }, 1).disposition).toBe('accepted');
        expect(deriveModificationOutcome({ a: null }, 1).disposition).toBe('quorum-short');
    });
});

describe('3.4 — a threshold that is not a positive integer is refused', () => {
    const bad = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const n of bad) {
        it(`refuses requiredProviders = ${String(n)} in both functions`, () => {
            // Without the guard, 0 or below turns an empty council into `accepted`.
            expect(() => deriveModificationOutcome({}, n)).toThrow(RangeError);
            expect(() => deriveModificationOutcome({ a: 'ratified', b: 'ratified' }, n)).toThrow(
                RangeError,
            );
            expect(() => deriveModificationVerdict({}, n)).toThrow(RangeError);
        });
    }
});

describe('3.4 — a seat named __proto__ is a seat, not a prototype', () => {
    it('survives readSeatConclusions', () => {
        const replies = JSON.parse(
            '{"__proto__": "x\\nSTANCE: refused | CONFIDENCE: high | DEALBREAKER: yes", "b": "y\\nSTANCE: ratified | CONFIDENCE: high | DEALBREAKER: no"}',
        ) as Record<string, string>;
        const seats = readSeatConclusions(replies);
        expect(Object.keys(seats).sort()).toEqual(['__proto__', 'b']);
        expect(seats['__proto__']).toBe('refused');
    });

    it('is counted by deriveModificationOutcome', () => {
        const seats = JSON.parse('{"__proto__": "ratified", "b": "ratified"}') as Record<
            string,
            'ratified'
        >;
        const out = deriveModificationOutcome(seats, R);
        expect(out.header.providers.sort()).toEqual(['__proto__', 'b']);
        expect(out.disposition).toBe('accepted');

        const refusing = JSON.parse('{"__proto__": "refused", "b": "ratified"}') as Record<
            string,
            'refused' | 'ratified'
        >;
        expect(deriveModificationOutcome(refusing, R).disposition).toBe('refused');
    });
});

describe('3.4 — a seat value outside the vocabulary is refused, never counted', () => {
    const malformed = [
        '{"a": "garbage", "b": "garbage"}',
        '{"a": "ratified", "b": "garbage"}',
        '{"a": "RATIFIED", "b": "ratified"}',
        '{"a": "no-final-verdict", "b": "ratified"}',
        '{"a": 1, "b": "ratified"}',
        '{"a": "ratified", "b": {}}',
    ];
    for (const json of malformed) {
        it(`refuses ${json} in both functions`, () => {
            const seats = JSON.parse(json) as Record<string, 'ratified'>;
            expect(() => deriveModificationOutcome(seats, R)).toThrow(TypeError);
            expect(() => deriveModificationVerdict(seats, R)).toThrow(TypeError);
        });
    }

    it('null stays a seat that did not conclude', () => {
        const seats = JSON.parse('{"a": null, "b": "ratified"}') as Record<string, 'ratified' | null>;
        expect(deriveModificationOutcome(seats, R).disposition).toBe('quorum-short');
    });
});
