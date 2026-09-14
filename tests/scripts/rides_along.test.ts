/**
 * 6.1 — what rides along during a mission.
 *
 * The step's acceptance clause is the FOLLOW-UP case: a run that finds a larger
 * adjacent refactor emits the artefact and leaves the code alone. So the
 * load-bearing cases here are the refusals, one per criterion — a predicate that
 * says yes to everything is a refactor licence wearing a boy-scout name.
 */

import { describe, expect, it } from 'vitest';

import {
    RIDE_ALONG_KINDS,
    disposition,
    followUpBody,
    type Candidate,
} from '../../src/scripts/_lib/rides_along.js';

const ok = (over: Partial<Candidate> = {}): Candidate => ({
    what: 'rename `cnt` to `count` in the function this mission edits',
    local: true,
    small: true,
    lowBlastRadius: true,
    clearlyCorrect: true,
    testable: true,
    noProductDecision: true,
    ...over,
});

describe('disposition', () => {
    it('a small, local, clearly-correct improvement rides along', () => {
        expect(disposition(ok())).toEqual({ disposition: 'ride-along', failed: [] });
    });

    it.each([
        ['local', 'not local'],
        ['small', 'not small'],
        ['lowBlastRadius', 'blast radius'],
        ['clearlyCorrect', 'not clearly correct'],
        ['testable', 'not testable'],
        ['noProductDecision', 'product decision'],
    ] as const)('failing %s alone defers it', (key, fragment) => {
        // AND-ed, not scored: a large change must not buy its way in with five
        // cheap yeses, which is how a boy-scout rule becomes a refactor licence.
        const v = disposition(ok({ [key]: false } as Partial<Candidate>));
        expect(v.disposition).toBe('follow-up-artefact');
        expect(v.failed.join(' ')).toContain(fragment);
    });

    it('reports EVERY failed criterion, not just the first', () => {
        const v = disposition(ok({ small: false, local: false, testable: false }));
        expect(v.failed).toHaveLength(3);
    });

    it('the larger adjacent refactor — the step’s own case — defers', () => {
        const v = disposition(
            ok({ what: 'extract a shared helper across four modules', small: false, lowBlastRadius: false }),
        );
        expect(v.disposition).toBe('follow-up-artefact');
    });
});

describe('followUpBody', () => {
    it('names what was seen and why it was deferred', () => {
        const c = ok({ what: 'extract a shared helper', small: false });
        const body = followUpBody(c, disposition(c));
        expect(body).toContain('extract a shared helper');
        expect(body).toContain('not small');
        expect(body).toContain('the code was left alone deliberately');
    });

    it('lists every reason, so a later reader can triage it', () => {
        const c = ok({ small: false, testable: false });
        expect(followUpBody(c, disposition(c)).match(/^ {2}- /gm)).toHaveLength(2);
    });

    it('a ride-along produces no artefact body', () => {
        expect(followUpBody(ok(), disposition(ok()))).toBe('');
    });
});

describe('the permitted kinds', () => {
    it('carries the nine the step names, and nothing broader', () => {
        expect(RIDE_ALONG_KINDS).toEqual([
            'characterization-test',
            'regression-test',
            'small-adjacent-bug',
            'naming',
            'types',
            'robustness',
            'local-dead-code',
            'simplify-touched-code',
            'testability',
        ]);
    });
});
