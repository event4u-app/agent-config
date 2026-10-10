import { describe, expect, it } from 'vitest';

import {
    MODIFICATION_VERDICT_LABELS,
    seatConclusion,
    readSeatConclusions,
} from '../../../src/scripts/ai_council/modification_review.js';

/** A seat reply closing on the existing stance grammar. */
function reply(stance: string): string {
    return `Body of the answer.\n\nSTANCE: ${stance} | CONFIDENCE: high | DEALBREAKER: no`;
}

describe('3.2 — a seat closes on the stance line, read by the parser that exists', () => {
    it('the three labels are the closed vocabulary, and nothing else concludes', () => {
        expect([...MODIFICATION_VERDICT_LABELS]).toEqual([
            'ratified',
            'confirmed-non-expanding',
            'refused',
        ]);
    });

    it.each(['ratified', 'confirmed-non-expanding', 'refused'])(
        'a seat closing on %s concludes with that label',
        (label) => {
            expect(seatConclusion(reply(label))).toBe(label);
        },
    );

    it('reads the LAST stance line, as the existing parser does', () => {
        const text = `${reply('refused')}\n\nOn reflection:\n\n${reply('ratified')}`;
        expect(seatConclusion(text)).toBe('ratified');
    });

    it('tolerates the cosmetic defects the existing parser forgives', () => {
        expect(seatConclusion('**STANCE:** ratified, CONFIDENCE: med, DEALBREAKER: no')).toBe(
            'ratified',
        );
        expect(seatConclusion('stance: REFUSED | confidence: low | dealbreaker: yes')).toBe(
            'refused',
        );
    });

    it('a missing line, an abstention, or any other label does NOT conclude', () => {
        expect(seatConclusion('I have no view.')).toBeNull();
        expect(seatConclusion(reply('abstain'))).toBeNull();
        expect(seatConclusion(reply('approve'))).toBeNull();
        expect(seatConclusion(reply('non-convergent'))).toBeNull();
        expect(seatConclusion('')).toBeNull();
    });

    it('a label buried in prose without the stance grammar does NOT conclude', () => {
        expect(seatConclusion('I would call this ratified, personally.')).toBeNull();
    });

    it('reads a whole seat map, keeping non-concluding seats visible as null', () => {
        const seats = readSeatConclusions({
            anthropic: reply('ratified'),
            openai: reply('confirmed-non-expanding'),
            google: 'no stance line here',
        });
        expect(seats).toEqual({
            anthropic: 'ratified',
            openai: 'confirmed-non-expanding',
            google: null,
        });
    });
});
