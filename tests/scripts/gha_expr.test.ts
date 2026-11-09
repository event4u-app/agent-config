import { describe, expect, it } from 'vitest';
import {
    type ExprContext,
    UnsupportedExpression,
    evaluate,
    evaluateCondition,
    interpolate,
} from '../../src/scripts/_lib/gha_expr.js';

function ctx(over: Partial<ExprContext> = {}, table: Record<string, string> = {}): ExprContext {
    const base: Record<string, string> = { 'github.event_name': 'pull_request', 'github.base_ref': 'main', ...table };
    return {
        lookup: (p) => (p in base ? base[p] : p.startsWith('env.') ? '' : undefined),
        steps: {},
        jobSucceeded: true,
        ...over,
    };
}

describe('gha_expr — conditions follow Actions semantics', () => {
    it.each([
        ['no condition, job green', undefined, true, true],
        ['no condition, job red', undefined, false, false],
        ['plain comparison is implicitly success() &&', "github.event_name == 'pull_request'", false, false],
        ['plain comparison on a green job', "github.event_name == 'pull_request'", true, true],
        ['always() runs after a failure', 'always()', false, true],
        ['!cancelled() runs after a failure', '${{ !cancelled() }}', false, true],
        ['!cancelled() combined with a comparison', "${{ !cancelled() && (github.event_name == 'pull_request') }}", false, true],
        ['failure() runs only after a failure', 'failure()', false, true],
        ['failure() on a green job', 'failure()', true, false],
        ['a false comparison under !cancelled()', "${{ !cancelled() && github.event_name == 'push' }}", false, false],
    ])('%s', (_label, raw, jobSucceeded, expected) => {
        expect(evaluateCondition(raw, ctx({ jobSucceeded }))).toBe(expected);
    });

    it('compares strings case-insensitively', () => {
        expect(evaluate("github.base_ref == 'MAIN'", ctx())).toBe(true);
        expect(evaluate("github.base_ref != 'Main'", ctx())).toBe(false);
    });

    it('reads step outputs and outcomes, and a missing output is the empty string', () => {
        const c = ctx({ steps: { scope: { outputs: { relevant: 'true' }, outcome: 'success' } } });
        expect(evaluateCondition("always() && steps.scope.outputs.relevant == 'true'", c)).toBe(true);
        expect(evaluate('steps.scope.outcome', c)).toBe('success');
        expect(evaluate('steps.scope.outputs.absent', c)).toBe('');
        expect(evaluate('steps.never.outputs.x', c)).toBe('');
    });

    it('supports startsWith / contains / endsWith and boolean operators', () => {
        const c = ctx({}, { 'github.head_ref': 'release/1.0' });
        expect(evaluate("startsWith(github.head_ref, 'release/')", c)).toBe(true);
        expect(evaluate("!startsWith(github.head_ref, 'feat/') && contains(github.head_ref, '1.')", c)).toBe(true);
        expect(evaluate("endsWith(github.head_ref, '2.0') || github.base_ref == 'main'", c)).toBe(true);
    });

    it("unescapes '' inside a string literal", () => {
        expect(evaluate("'it''s'", ctx())).toBe("it's");
    });
});

describe('gha_expr — interpolation', () => {
    it('replaces every ${{ }} in a run block', () => {
        const c = ctx({ steps: { base: { outputs: { merge_base: 'abc' }, outcome: 'success' } } });
        expect(interpolate('git diff "${{ steps.base.outputs.merge_base }}" origin/${{ github.base_ref }}', c))
            .toBe('git diff "abc" origin/main');
    });

    it('leaves shell ${VAR} untouched', () => {
        expect(interpolate('echo "${HOME}" ${{ github.base_ref }}', ctx())).toBe('echo "${HOME}" main');
    });
});

describe('gha_expr — refuses rather than guesses', () => {
    it.each([
        ['an unknown context', 'matrix.os'],
        ['an unknown function', "fromJSON('[]')"],
        ['an ordering operator', 'github.run_attempt > 1'],
        ['a malformed step reference', 'steps.x.with.y'],
        ['an unterminated string', "github.base_ref == 'main"],
    ])('throws UnsupportedExpression for %s', (_label, src) => {
        expect(() => evaluate(src, ctx())).toThrow(UnsupportedExpression);
    });
});
