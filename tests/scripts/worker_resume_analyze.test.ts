// road-to-a-cold-start-paid-once 6.2: the worker-resume analysis reads the
// registered bars, so a sample under its floor is underpowered, an unparsed
// session is excluded rather than scored as nine misses, and a session with no
// id is never counted as a session.
import { describe, expect, it } from 'vitest';

import {
    isFailedSession,
    nonInferiority,
    reliefVerdict,
    scorableSessions,
    sessionsWithResumes,
    type Result,
} from '../../internal/bench/worker-resume/analyze.js';
import { shouldStop } from '../../internal/bench/worker-resume/run.js';

const T = (n: number): string[] => Array.from({ length: 9 }, (_, i) => `t${n}-${i}`);

function session(arm: 'fresh' | 'reuse', k: number, passes: boolean[], extra: Partial<Result> = {}): Result {
    return { arm, session_index: k, session_id: `${arm}-${k}`, tasks: T(k), passes, answers_parsed: true, is_error: false, api_error_status: null, ...extra };
}

const all = (b: boolean): boolean[] => Array(9).fill(b) as boolean[];

describe('relief floors', () => {
    it('is underpowered below 30 resumes or below 5 sessions, whatever the ratio', () => {
        expect(reliefVerdict(29, 8, 0.1)).toBe('underpowered');
        expect(reliefVerdict(64, 4, 0.1)).toBe('underpowered');
        expect(reliefVerdict(64, 8, null)).toBe('underpowered');
    });

    it('is backed at the bar and null above it once powered', () => {
        expect(reliefVerdict(30, 5, 0.2)).toBe('backed');
        expect(reliefVerdict(30, 5, 0.21)).toBe('null');
    });
});

describe('session counting', () => {
    it('never counts a resume with no known session as a session', () => {
        const refSession = new Map([
            ['a', 's1'],
            ['b', 's1'],
            ['c', 's2'],
        ]);
        expect(sessionsWithResumes(['a', 'b', 'c', 'orphan', 'orphan2'], refSession)).toBe(2);
    });

    it('treats a missing api_error_status as no error, not as a failed session', () => {
        expect(isFailedSession({ is_error: false, api_error_status: undefined })).toBe(false);
        expect(isFailedSession({ is_error: false, api_error_status: null })).toBe(false);
        expect(isFailedSession({ is_error: false, api_error_status: 429 })).toBe(true);
        expect(isFailedSession({ is_error: true, api_error_status: null })).toBe(true);
    });
});

describe('unparsed sessions', () => {
    it('excludes a session whose answers did not parse, an errored one, and a short one, and counts them', () => {
        const rs = [
            session('fresh', 0, all(true)),
            session('fresh', 1, all(false), { answers_parsed: false }),
            session('reuse', 2, all(true), { is_error: true }),
            session('reuse', 3, [true, true]),
        ];
        const { scorable, excluded } = scorableSessions(rs);
        expect(scorable.map((r) => r.session_index)).toEqual([0]);
        expect(excluded).toHaveLength(3);
    });

    it('does not read an unparsed FRESH session as nine task failures', () => {
        const rs: Result[] = [];
        for (let k = 0; k < 5; k++) rs.push(session('fresh', k, all(true)), session('reuse', k, all(true)));
        rs.push(session('fresh', 5, all(false), { answers_parsed: false }));
        const ni = nonInferiority(rs);
        expect(ni.excluded_sessions).toBe(1);
        expect(ni.pooled.fresh_tasks).toBe(45);
        expect(ni.pooled.fresh_pass_rate).toBe(1);
    });
});

describe('non-inferiority floors', () => {
    function arms(sessions: number, freshMissPerSession: number): Result[] {
        const rs: Result[] = [];
        for (let k = 0; k < sessions; k++) {
            const f = all(true).map((_, i) => !(i >= 1 && i <= freshMissPerSession));
            rs.push(session('fresh', k, f), session('reuse', k, all(true)));
        }
        return rs;
    }

    it('is underpowered below 30 tasks in either arm', () => {
        // 3 sessions: 24 resumed tasks (positions 2-9), 27 fresh.
        expect(nonInferiority(arms(3, 0)).verdict).toBe('underpowered');
    });

    it('is backed at exactly -5 pp, and null below it', () => {
        // Reuse 8 sessions x 8 resumed tasks = 64 at 100 %. Fresh 72 tasks.
        const backed = arms(8, 0);
        // Flip the reuse arm to lose some, so the difference is computed, not assumed.
        expect(nonInferiority(backed).verdict).toBe('backed');
        const rs: Result[] = [];
        for (let k = 0; k < 8; k++) {
            // fresh 100 %; reuse loses 1 resumed task in 4 of 8 sessions: 60/64 = 93.75 % -> -6.25 pp
            rs.push(session('fresh', k, all(true)), session('reuse', k, all(true).map((_, i) => !(i === 1 && k < 4))));
        }
        expect(nonInferiority(rs).verdict).toBe('null');
        const edge: Result[] = [];
        for (let k = 0; k < 10; k++) {
            // fresh 100 % over 90; reuse 80 resumed, 4 lost -> 95 % -> exactly -5 pp
            edge.push(session('fresh', k, all(true)), session('reuse', k, all(true).map((_, i) => !(i === 1 && k < 4))));
        }
        expect(nonInferiority(edge).pooled.difference_pp).toBeCloseTo(-5, 9);
        expect(nonInferiority(edge).verdict).toBe('backed');
    });

    it('pairs by session and task position 2-9 only when both arms ran the same tasks', () => {
        const rs = [
            session('fresh', 0, [true, false, true, true, true, true, true, true, false]),
            session('reuse', 0, [true, true, true, true, true, true, false, true, true]),
            session('fresh', 1, all(true)),
            session('reuse', 1, all(true), { tasks: T(99) }),
        ];
        const p = nonInferiority(rs).paired;
        expect(p.pairs).toBe(8);
        expect(p.sessions).toBe(1);
        expect(p.reuse_only_pass).toBe(2);
        expect(p.fresh_only_pass).toBe(1);
    });
});

describe('run stop condition', () => {
    it('stops on an error, a non-zero exit, or answers that did not parse', () => {
        expect(shouldStop({ isError: true, status: 0, answersParsed: true })).toBe(true);
        expect(shouldStop({ isError: false, status: 1, answersParsed: true })).toBe(true);
        expect(shouldStop({ isError: false, status: 0, answersParsed: false })).toBe(true);
    });

    it('does not stop a clean, parsed session whose answers merely mention a rate limit', () => {
        expect(shouldStop({ isError: false, status: 0, answersParsed: true })).toBe(false);
    });
});
