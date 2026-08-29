// Tests for the consumption acknowledgment field set and the ignored-blocker
// detector (`road-to-runtime-event-journal` Phase 3.1).
//
// The load-bearing pair is the two directions of the SAME return: a
// non-success return with no acknowledgment IS reported, and the identical
// return carrying `rejected-with-reason` is NOT. A test that only asserted the
// first would pass against a detector that reports every non-success return,
// which is the useless-detector failure this phase exists to avoid.
import { describe, expect, it } from 'vitest';

import {
    findIgnoredBlockers,
    isIgnoredBlocker,
} from '../../src/scripts/_lib/ignored_blocker.js';
import {
    NON_SUCCESS_STATES,
    acknowledge,
    envelope,
} from '../../src/scripts/_lib/outcome_envelope.js';
import type { TerminalState } from '../../src/scripts/_lib/outcome_envelope.js';

/** The fixture return. One shape, reused in both directions, so the only
 *  difference between reported and not-reported is the acknowledgment. */
function fixtureReturn(state: TerminalState) {
    return envelope({
        state,
        suggestion: 'set GITHUB_TOKEN and re-run',
        payload: { findings: [] },
    });
}

const NON_SUCCESS = [...NON_SUCCESS_STATES];

describe('the detector — a non-success return with no acknowledgment', () => {
    it.each(NON_SUCCESS)('REPORTS %s with no acknowledgment', (state) => {
        expect(isIgnoredBlocker(fixtureReturn(state))).toBe(true);
    });

    it('all four NON_SUCCESS_STATES are covered by this file, not just blocked', () => {
        // Guards the test itself: if a seventh state joins the non-success set,
        // this fails rather than the suite silently covering three of five.
        expect(NON_SUCCESS.sort()).toEqual(
            ['approval-required', 'blocked', 'exhausted', 'stagnated'],
        );
    });
});

describe('the detector — an acknowledged return', () => {
    it.each(NON_SUCCESS)('does NOT report %s carrying rejected-with-reason', (state) => {
        const acked = acknowledge(fixtureReturn(state), {
            consumption: 'rejected-with-reason',
            reason: 'the token is intentionally unset on this runner',
        });
        expect(isIgnoredBlocker(acked)).toBe(false);
    });

    it.each(NON_SUCCESS)('does NOT report %s carrying consumed', (state) => {
        expect(isIgnoredBlocker(acknowledge(fixtureReturn(state), { consumption: 'consumed' }))).toBe(false);
    });

    it.each(NON_SUCCESS)('does NOT report %s carrying partially-consumed', (state) => {
        const acked = acknowledge(fixtureReturn(state), { consumption: 'partially-consumed' });
        expect(isIgnoredBlocker(acked)).toBe(false);
    });
});

describe('the detector — the success path', () => {
    it.each(['success', 'clean-no-op'] as const)(
        'does NOT report %s with no acknowledgment',
        (state) => {
            expect(isIgnoredBlocker(envelope({ state, payload: null }))).toBe(false);
        },
    );

    it('an acknowledged success is not reported either', () => {
        const e = acknowledge(envelope({ state: 'success', payload: null }), { consumption: 'consumed' });
        expect(isIgnoredBlocker(e)).toBe(false);
    });
});

describe('findIgnoredBlockers over a batch', () => {
    it('returns exactly the unacknowledged non-success returns, with their next action', () => {
        const batch = [
            fixtureReturn('blocked'),
            acknowledge(fixtureReturn('exhausted'), { consumption: 'consumed' }),
            envelope({ state: 'success', payload: null }),
            fixtureReturn('stagnated'),
        ];
        const found = findIgnoredBlockers(batch);
        expect(found.map((f) => f.state)).toEqual(['blocked', 'stagnated']);
        expect(found[0]?.suggestion).toBe('set GITHUB_TOKEN and re-run');
        expect(found[0]?.episodeId).toBeNull();
    });
});

describe('the additive change did not break envelope construction', () => {
    it('constructs with no acknowledgment argument at all — the existing call shape', () => {
        const e = envelope({ state: 'success', payload: [1, 2] });
        expect(e.payload).toEqual([1, 2]);
        expect(e.retry).toBe('not-applicable');
        // Absent, never defaulted. A defaulted `consumed` would make every
        // unread return look read — the exact failure the field exposes.
        expect('acknowledgment' in e).toBe(false);
        expect(e.acknowledgment).toBeUndefined();
    });

    it('still refuses a non-success state with no suggestion', () => {
        expect(() => envelope({ state: 'blocked', payload: null })).toThrow();
    });

    it('accepts an acknowledgment passed at construction', () => {
        const e = envelope({
            state: 'blocked',
            suggestion: 'raise the cap',
            payload: null,
            acknowledgment: { consumption: 'rejected-with-reason', reason: 'cap is deliberate' },
        });
        expect(e.acknowledgment?.consumption).toBe('rejected-with-reason');
        expect(isIgnoredBlocker(e)).toBe(false);
    });

    it('acknowledge() does not mutate the producer’s envelope', () => {
        const original = fixtureReturn('blocked');
        const acked = acknowledge(original, { consumption: 'consumed' });
        expect(original.acknowledgment).toBeUndefined();
        expect(acked.acknowledgment?.consumption).toBe('consumed');
        expect(isIgnoredBlocker(original)).toBe(true);
    });
});
