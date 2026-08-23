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

    it('grants acceptance only to cross-family AND fresh', () => {
        // CONTRACT CHANGE, 2026-08-23 (road-to-review-independence step 2.1). This test
        // asserted `acceptanceStatus('cross-family') === 'accepted'` on the family axis
        // alone, and was seen RED by the change that added the second axis — which is the
        // evidence the step asks for. Model family and author relation are different
        // questions, and a cross-family pair that both read the implementer's envelope
        // shares the framing even though it disagrees about the model.
        expect(acceptanceStatus('cross-family', 'fresh')).toBe('accepted');
        for (const i of ['same-family', 'single-member', 'unknown'] as const) {
            expect(acceptanceStatus(i, 'fresh')).toBe('provisional');
        }
    });

    it('does NOT grant acceptance to a same-session cross-family reviewer', () => {
        // The fixture step 2.1 names explicitly, and the one case the old single-axis
        // contract got wrong.
        expect(acceptanceStatus('cross-family', 'same-session')).toBe('provisional');
        expect(assuranceFor('cross-family', 'same-session')).toBe('single-pass');
        expect(independenceFields(['anthropic', 'openai'], 'same-session')).toEqual({
            review_independence: 'cross-family',
            context_relation: 'same-session',
            acceptance_status: 'provisional',
            assurance: 'single-pass',
            reviewers: ['anthropic', 'openai'],
        });
    });

    it('treats an unrecorded relation as the weaker claim, never as fresh', () => {
        // Same reasoning `unknown` already gets on the family axis: an unrecorded
        // relation is not evidence of freshness, and the default is what every existing
        // caller now gets.
        expect(acceptanceStatus('cross-family')).toBe('provisional');
        expect(acceptanceStatus('cross-family', 'unknown')).toBe('provisional');
        expect(independenceFields(['anthropic', 'openai']).context_relation).toBe('unknown');
    });

    it('treats unknown as provisional, never as a third acceptance value', () => {
        // An unrecorded member set is not evidence of independence; the safe
        // direction on an integrity field is the weaker claim.
        expect(acceptanceStatus('unknown')).toBe('provisional');
        expect(assuranceFor('unknown')).toBe('unreviewed');
    });

    it('keeps assurance orthogonal to effort', () => {
        // A same-family review is single-pass however much work it did.
        expect(assuranceFor('same-family', 'fresh')).toBe('single-pass');
        expect(assuranceFor('single-member', 'fresh')).toBe('single-pass');
        expect(assuranceFor('cross-family', 'fresh')).toBe('independent');
        // `unreviewed` still comes from the family axis alone: no member set is not the
        // same failure as an unrecorded relation, and collapsing them would lose which
        // one occurred.
        expect(assuranceFor('unknown', 'fresh')).toBe('unreviewed');
    });

    it('derives a consistent field set from the reviewer list', () => {
        expect(independenceFields(['anthropic'], 'fresh')).toEqual({
            review_independence: 'single-member',
            context_relation: 'fresh',
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
