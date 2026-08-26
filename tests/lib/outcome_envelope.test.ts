// Tests for src/scripts/_lib/outcome_envelope.ts
// (road-to-skill-ecosystem-runtime-enforcement Phase 4 Steps 4-5).
//
// The two REFUSALS are the load-bearing tests. An envelope that accepts a
// non-success state with no next action, or a `truncated` flag with no counts,
// is the same report it replaced with a schema wrapped round it.
import { describe, expect, it } from 'vitest';

import {
    EnvelopeContractError,
    NON_SUCCESS_STATES,
    capPerCategory,
    classifyFailure,
    envelope,
} from '../../src/scripts/_lib/outcome_envelope.js';

describe('envelope — the refusals', () => {
    it.each([...NON_SUCCESS_STATES])('REFUSES %s with no suggestion', (state) => {
        expect(() => envelope({ state, payload: null })).toThrow(EnvelopeContractError);
    });

    it('REFUSES truncated: true with no per-category totals', () => {
        expect(() =>
            envelope({ state: 'success', truncated: true, payload: [] }),
        ).toThrow(EnvelopeContractError);
    });

    it('accepts a non-success state once it names a next action', () => {
        const e = envelope({ state: 'blocked', suggestion: 'set GITHUB_TOKEN', payload: null });
        expect(e.state).toBe('blocked');
        expect(e.suggestion).toBe('set GITHUB_TOKEN');
    });
});

describe('envelope — defaults', () => {
    it('marks a success as not-applicable for retry, never retryable', () => {
        expect(envelope({ state: 'success', payload: 1 }).retry).toBe('not-applicable');
        expect(envelope({ state: 'clean-no-op', payload: 1 }).retry).toBe('not-applicable');
    });

    it('defaults a failure to RETRYABLE — the safe direction', () => {
        // A wasted retry costs one iteration; a wrongly-permanent verdict costs
        // the task. The default must err toward retry.
        expect(envelope({ state: 'exhausted', suggestion: 'raise the cap', payload: 1 }).retry).toBe('retryable');
    });

    it('honours an explicit hard-blocker', () => {
        const e = envelope({ state: 'blocked', retry: 'hard-blocker', suggestion: 'add creds', payload: 1 });
        expect(e.retry).toBe('hard-blocker');
    });
});

describe('capPerCategory', () => {
    const items = [
        { c: 'a', n: 1 }, { c: 'a', n: 2 }, { c: 'a', n: 3 },
        { c: 'b', n: 4 },
    ];

    it('caps EACH category, so one high-volume category cannot fill the budget', () => {
        const r = capPerCategory(items, (i) => i.c, 2);
        expect(r.kept.map((i) => i.n)).toEqual([1, 2, 4]);
        // `b` survives despite `a` overflowing — the whole point of per-category.
        expect(r.kept.some((i) => i.c === 'b')).toBe(true);
    });

    it('reports PRE-cap totals, not kept counts', () => {
        expect(capPerCategory(items, (i) => i.c, 2).totals).toEqual({ a: 3, b: 1 });
    });

    it('is not truncated when nothing was dropped', () => {
        const r = capPerCategory(items, (i) => i.c, 10);
        expect(r.truncated).toBe(false);
        expect(r.kept).toHaveLength(4);
    });

    it('feeds envelope() without drift — the flag and the counts come from one call', () => {
        const r = capPerCategory(items, (i) => i.c, 1);
        const e = envelope({ state: 'success', truncated: r.truncated, totals: r.totals, payload: r.kept });
        expect(e.truncated).toBe(true);
        expect(e.totals).toEqual({ a: 3, b: 1 });
    });
});

describe('classifyFailure', () => {
    it.each([
        'Permission denied',
        'HTTP 403 Forbidden',
        '401 unauthorized',
        'rate limit exceeded',
        'bash: gh: command not found',
        'GITHUB_TOKEN is not set — missing credential',
        'spend cap reached',
    ])('classifies %s as a hard-blocker', (text) => {
        expect(classifyFailure(text)).toBe('hard-blocker');
    });

    it.each(['connection reset by peer', 'test failed: expected 1 to be 2', 'ENOENT while writing'])(
        'leaves %s retryable — unmatched defaults to the safe direction',
        (text) => {
            expect(classifyFailure(text)).toBe('retryable');
        },
    );

    it('does not classify a bare "missing" as a credential blocker', () => {
        // The credential pattern requires the credential word nearby. Without
        // that, "missing" appears in ordinary test output and would turn every
        // assertion failure into a permanent stop.
        expect(classifyFailure('missing expected key in the response body')).toBe('retryable');
    });
});
