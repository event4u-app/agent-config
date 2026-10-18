import { describe, expect, it } from 'vitest';

import { parsePrRef, resolvePrTarget, type PrLookup } from '../../src/scripts/analysis_pr_target.js';

const PR = { number: 42, baseSha: 'b1', headSha: 'h1', state: 'OPEN' as const };

function lookup(over: Partial<PrLookup> = {}): PrLookup {
    return {
        byNumber: (n) => (n === 42 ? PR : null),
        openForBranch: () => [],
        ...over,
    };
}

describe('parsePrRef', () => {
    it('reads a number, a #number and a PR URL', () => {
        expect(parsePrRef('42')).toBe(42);
        expect(parsePrRef('#42')).toBe(42);
        expect(parsePrRef('https://github.com/o/r/pull/42')).toBe(42);
        expect(parsePrRef('https://github.com/o/r/pull/42/files')).toBe(42);
        expect(parsePrRef('main')).toBeNull();
    });
});

describe('resolvePrTarget (step 5.1)', () => {
    it('an argument resolves without a question and pins base and head', () => {
        expect(resolvePrTarget({ argument: '#42', branch: 'feat/x', conversation: [] }, lookup())).toEqual({
            kind: 'resolved',
            via: 'argument',
            pr: 42,
            baseSha: 'b1',
            headSha: 'h1',
        });
    });

    it("without an argument the current branch's open PR resolves", () => {
        const out = resolvePrTarget({ argument: null, branch: 'feat/x', conversation: [] }, lookup({ openForBranch: () => [42] }));
        expect(out).toMatchObject({ kind: 'resolved', via: 'branch', pr: 42 });
    });

    it('otherwise the PR the conversation already named resolves', () => {
        const out = resolvePrTarget(
            { argument: null, branch: 'main', conversation: ['please look at https://github.com/o/r/pull/42 again'] },
            lookup(),
        );
        expect(out).toMatchObject({ kind: 'resolved', via: 'conversation', pr: 42 });
    });

    it('an ambiguous case asks once for the link', () => {
        const several = resolvePrTarget({ argument: null, branch: 'feat/x', conversation: [] }, lookup({ openForBranch: () => [42, 43] }));
        expect(several).toEqual({ kind: 'ask', question: expect.stringMatching(/link/) as unknown as string, candidates: [42, 43] });
        const none = resolvePrTarget({ argument: null, branch: 'main', conversation: ['#41 and #42'] }, lookup());
        expect(none).toMatchObject({ kind: 'ask', candidates: [41, 42] });
        const nothing = resolvePrTarget({ argument: null, branch: 'main', conversation: [] }, lookup());
        expect(nothing).toMatchObject({ kind: 'ask', candidates: [] });
    });

    it('an argument naming no open PR asks rather than guessing', () => {
        const out = resolvePrTarget({ argument: '99', branch: 'feat/x', conversation: [] }, lookup({ openForBranch: () => [42] }));
        expect(out).toMatchObject({ kind: 'ask', candidates: [] });
    });
});
