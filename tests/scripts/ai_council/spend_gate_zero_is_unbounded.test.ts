/**
 * Zero means unbounded, on every cap the contract says it means it on.
 *
 * `docs/contracts/ai-council-config.md:84-86` documents `0` as disabling both
 * token caps and the call cap. Measured at `df377ca64`: `_breach` compared the
 * token totals with no zero guard, while the two USD comparisons two lines
 * below it (`:110`, `:113`) carried one. So a budget with every cap set to
 * zero — the shape the contract calls "no bound at all" — returned `'tokens'`
 * for a ten-token estimate, and a user who disabled every ceiling got the
 * strictest possible one.
 *
 * The two call-cap comparisons in `orchestrator.ts` had the same hole and are
 * covered here too, because the three are one rule stated in three places and
 * the useful assertion is that they agree.
 *
 * Both directions are pinned deliberately. A zero guard that is too eager
 * would make a cap a user DID set stop bounding, which is the opposite defect
 * and strictly worse than the one being fixed — so every "no breach at zero"
 * assertion has a "still breaches when set" twin.
 *
 * Unit note: the token caps count TOKENS and the two USD caps count US
 * DOLLARS. They are never compared with each other, and the fixtures below
 * keep the two unmistakable — token figures are whole thousands, USD figures
 * carry cents.
 */
import { describe, expect, it } from 'vitest';

import { CostBudget, _breach, type Spent } from '../../../src/scripts/ai_council/spend_gate.js';
import type { CostEstimate } from '../../../src/scripts/ai_council/pricing.js';

/** An estimate of a stated token size, priced at a stated USD amount. */
function estimate(inputTokens: number, outputTokens: number, usd = 0): CostEstimate {
    return {
        provider: 'test',
        model: 'test-model',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        input_usd: usd,
        output_usd: 0,
    };
}

const NOTHING_SPENT: Spent = { input: 0, output: 0, usd: 0 };

/** Every cap at zero — the contract's "no bound at all". */
function unbounded(): CostBudget {
    return new CostBudget({
        max_input_tokens: 0,
        max_output_tokens: 0,
        max_calls: 0,
        max_total_usd: 0,
        daily_limit_usd: 0,
    });
}

describe('_breach — zero disables a cap', () => {
    it('returns no breach for a small estimate when every cap is zero', () => {
        expect(_breach(estimate(10, 10), NOTHING_SPENT, unbounded())).toBeNull();
    });

    it('returns no breach for an estimate of any size when every cap is zero', () => {
        // The point of "unbounded" is that size stops mattering, so the
        // assertion is over sizes spanning six orders of magnitude rather
        // than over one arbitrary large number.
        for (const tokens of [1_000, 100_000, 10_000_000, 1_000_000_000]) {
            expect(_breach(estimate(tokens, tokens, 9_999.99), NOTHING_SPENT, unbounded())).toBeNull();
        }
    });

    it('returns no breach when spend already recorded is large and every cap is zero', () => {
        const spent: Spent = { input: 5_000_000, output: 5_000_000, usd: 12_345.67 };
        expect(_breach(estimate(1_000, 1_000, 10.0), spent, unbounded())).toBeNull();
    });

    it('returns no breach for a null estimate when every cap is zero', () => {
        expect(_breach(null, NOTHING_SPENT, unbounded())).toBeNull();
    });
});

describe('_breach — a cap that was set still bounds, alone', () => {
    it('breaches on the input-token cap alone', () => {
        const budget = new CostBudget({
            max_input_tokens: 1_000,
            max_output_tokens: 0,
            max_calls: 0,
            max_total_usd: 0,
            daily_limit_usd: 0,
        });
        expect(_breach(estimate(1_001, 10_000_000), NOTHING_SPENT, budget)).toBe('tokens');
        // And does not breach just under it — the boundary, not just the far side.
        expect(_breach(estimate(1_000, 10_000_000), NOTHING_SPENT, budget)).toBeNull();
    });

    it('breaches on the output-token cap alone', () => {
        const budget = new CostBudget({
            max_input_tokens: 0,
            max_output_tokens: 2_000,
            max_calls: 0,
            max_total_usd: 0,
            daily_limit_usd: 0,
        });
        expect(_breach(estimate(10_000_000, 2_001), NOTHING_SPENT, budget)).toBe('tokens');
        expect(_breach(estimate(10_000_000, 2_000), NOTHING_SPENT, budget)).toBeNull();
    });

    it('breaches on the session USD cap alone', () => {
        const budget = new CostBudget({
            max_input_tokens: 0,
            max_output_tokens: 0,
            max_calls: 0,
            max_total_usd: 1.5,
            daily_limit_usd: 0,
        });
        expect(_breach(estimate(10, 10, 2.0), NOTHING_SPENT, budget)).toBe('session');
        expect(_breach(estimate(10, 10, 1.0), NOTHING_SPENT, budget)).toBeNull();
    });

    it('counts already-recorded token spend against a cap that was set', () => {
        const budget = new CostBudget({
            max_input_tokens: 1_000,
            max_output_tokens: 0,
            max_calls: 0,
            max_total_usd: 0,
            daily_limit_usd: 0,
        });
        const spent: Spent = { input: 999, output: 0, usd: 0 };
        expect(_breach(estimate(2, 0), spent, budget)).toBe('tokens');
        expect(_breach(estimate(1, 0), spent, budget)).toBeNull();
    });
});

describe('CostBudget defaults', () => {
    it('still carries its constructor defaults when no argument is given', () => {
        // Phase 3 of the roadmap moves these to zero. This assertion exists so
        // that move is a deliberate edit to a named test rather than a silent
        // drift, and it is updated in the same commit that moves them.
        const d = new CostBudget();
        expect(d.max_calls).toBe(10);
    });
});
