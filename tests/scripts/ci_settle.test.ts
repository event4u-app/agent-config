// Tests for src/scripts/ci_settle.ts.
//
// The failure this file exists to prevent, measured 2026-08-20: a hand-written
// waiter exited on `error connecting to api.github.com` because the error text
// contained no "pending", and the session reported a settle that had not
// happened. So the load-bearing assertion is the negative one — an API error
// must never classify as settled.
import { describe, expect, it } from 'vitest';

import { classifyPoll, FOREGROUND_CEILING_MIN } from '../../src/scripts/ci_settle.js';

const roll = (rows: unknown[]): string => JSON.stringify({ statusCheckRollup: rows });

describe('classifyPoll', () => {
    it('reads an API error as unreadable, never as settled', () => {
        const s = classifyPoll('', 'error connecting to api.github.com\ncheck your internet connection', 1);
        expect(s.kind).toBe('unreadable');
    });

    it('reads every transport failure shape as unreadable', () => {
        const shapes = [
            'could not resolve host: api.github.com',
            'connection refused',
            'request timed out',
            'HTTP 502 Bad Gateway',
            'API rate limit exceeded',
            'gh auth login required',
        ];
        for (const text of shapes) {
            expect(classifyPoll('', text, 1).kind, text).toBe('unreadable');
        }
    });

    it('reads a non-zero exit with no marker as unreadable', () => {
        expect(classifyPoll('', 'something unexpected', 3).kind).toBe('unreadable');
    });

    it('reads unparseable output as unreadable', () => {
        expect(classifyPoll('not json at all', '', 0).kind).toBe('unreadable');
    });

    it('reads zero registered checks as pending, not as settled green', () => {
        // A run that has not registered its checks yet looks identical to a
        // finished one with nothing to report. Calling that green is the same
        // class of error as the API-failure exit.
        const s = classifyPoll(roll([]), '', 0);
        expect(s.kind).toBe('pending');
    });

    it('reads a mixed set as pending while any check has no conclusion', () => {
        const s = classifyPoll(
            roll([
                { name: 'a', conclusion: 'SUCCESS' },
                { name: 'b', conclusion: null, status: 'IN_PROGRESS' },
            ]),
            '',
            0,
        );
        expect(s.kind).toBe('pending');
        if (s.kind === 'pending') {
            expect(s.done).toBe(1);
            expect(s.total).toBe(2);
        }
    });

    it('reads an all-successful set as settled green', () => {
        const s = classifyPoll(roll([{ name: 'a', conclusion: 'SUCCESS' }, { name: 'b', conclusion: 'SKIPPED' }]), '', 0);
        expect(s.kind).toBe('settled');
        if (s.kind === 'settled') {
            expect(s.failing).toEqual([]);
        }
    });

    it('reads a failing set as settled red and names the checks', () => {
        const s = classifyPoll(
            roll([
                { name: 'Node Tests', conclusion: 'FAILURE' },
                { name: 'Static Checks', conclusion: 'SUCCESS' },
                { name: 'Golden', conclusion: 'TIMED_OUT' },
            ]),
            '',
            0,
        );
        expect(s.kind).toBe('settled');
        if (s.kind === 'settled') {
            expect(s.failing).toEqual(['Node Tests', 'Golden']);
        }
    });

    it('never reports settled for any input that is not a complete rollup', () => {
        // The property, stated as one assertion: nothing outside a fully
        // concluded rollup may end a wait.
        const notSettled = [
            classifyPoll('', 'error connecting to api.github.com', 1),
            classifyPoll('', '', 1),
            classifyPoll('garbage', '', 0),
            classifyPoll(roll([]), '', 0),
            classifyPoll(roll([{ name: 'a', conclusion: null }]), '', 0),
        ];
        for (const s of notSettled) {
            expect(s.kind).not.toBe('settled');
        }
    });
});

// road-to-agent-turnaround 3.1. The measured defect was not a wrong verdict, it
// was NO verdict: a 45-minute default deadline against a 600 s `Bash` ceiling
// meant ten of the twelve slowest calls in a ten-session corpus were this script
// killed at 592-603 s and re-invoked. A killed wait prints nothing, so the
// carefully separated exit codes above never reach the caller at all.
describe('foreground deadline', () => {
    it('fits inside one Bash call with at least one poll interval to spare', () => {
        // 600 s is the tool ceiling; 60 s is the default poll interval. The
        // deadline must leave room for the loop to REACH its own DID-NOT-SETTLE
        // branch, not merely to be under the cap.
        expect(FOREGROUND_CEILING_MIN * 60).toBeLessThanOrEqual(600 - 60);
    });

    it('is a number, not a comment — a documented ceiling nobody reads is the old state', () => {
        expect(Number.isInteger(FOREGROUND_CEILING_MIN)).toBe(true);
        expect(FOREGROUND_CEILING_MIN).toBeGreaterThan(0);
    });
});
