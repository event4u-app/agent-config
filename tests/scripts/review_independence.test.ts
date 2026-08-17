import { describe, expect, it } from 'vitest';

import {
    acceptanceStatus,
    assuranceFor,
    independenceFields,
    independenceViolations,
    reviewIndependence,
} from '../../src/scripts/_lib/review_independence.js';

describe('review independence', () => {
    it.each([
        [['anthropic', 'openai'], 'cross-family'],
        [['gemini', 'xai', 'openai'], 'cross-family'],
        [['anthropic', 'anthropic'], 'same-family'],
        [['anthropic'], 'single-member'],
        [[], 'unknown'],
    ] as const)('classifies %j as %s', (members, expected) => {
        expect(reviewIndependence(members)).toBe(expected);
    });

    it('grants acceptance to cross-family alone', () => {
        expect(acceptanceStatus('cross-family')).toBe('accepted');
        for (const i of ['same-family', 'single-member', 'unknown'] as const) {
            expect(acceptanceStatus(i)).toBe('provisional');
        }
    });

    it('treats unknown as provisional, never as a third acceptance value', () => {
        // An unrecorded member set is not evidence of independence; the safe
        // direction on an integrity field is the weaker claim.
        expect(acceptanceStatus('unknown')).toBe('provisional');
        expect(assuranceFor('unknown')).toBe('unreviewed');
    });

    it('keeps assurance orthogonal to effort', () => {
        // A same-family review is single-pass however much work it did.
        expect(assuranceFor('same-family')).toBe('single-pass');
        expect(assuranceFor('single-member')).toBe('single-pass');
        expect(assuranceFor('cross-family')).toBe('independent');
    });

    it('derives a consistent field set from the reviewer list', () => {
        expect(independenceFields(['anthropic'])).toEqual({
            review_independence: 'single-member',
            acceptance_status: 'provisional',
            assurance: 'single-pass',
            reviewers: ['anthropic'],
        });
    });

    it('flags a hand-set acceptance that contradicts the independence', () => {
        const v = independenceViolations({
            review_independence: 'same-family',
            acceptance_status: 'accepted',
            assurance: 'independent',
        });
        expect(v.length).toBe(2);
        expect(v.join(' ')).toContain('acceptance_status');
    });

    it('flags an artifact that declares no independence at all', () => {
        const v = independenceViolations({ acceptance_status: 'accepted' });
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('review_independence is absent');
    });

    it('accepts a self-consistent artifact', () => {
        expect(independenceViolations({ ...independenceFields(['anthropic', 'openai']) })).toEqual([]);
    });
});
