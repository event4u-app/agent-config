/**
 * With nothing configured, no ceiling on money or tokens applies.
 *
 * Step 3.1 of `road-to-a-spend-bound-only-where-one-was-set`, under ADR-279.
 *
 * The council budget had THREE independent default layers and every one of
 * them bounded: the loader's `_build_cost_budget` (500,000 input tokens,
 * 200,000 output tokens, 50 calls, USD 20), the command's own fallback for a
 * file carrying no `cost_budget` block (50,000, 20,000, 10 calls), and the
 * `CostBudget` constructor's defaults (the same three). A debate refused above
 * USD 5 in two further places. None of the five figures was chosen by the
 * person they bound.
 *
 * This file pins the layer a unit test can reach directly — the constructor —
 * plus the loader through `load_council_config`. The command's fallback is the
 * same three numbers written a third time; `no_default_spend_bound.test.ts`
 * (step 4.3) builds the budget the way the command does and asserts the whole
 * chain end to end.
 *
 * What is NOT moved, and is asserted here so a later edit cannot quietly take
 * it: `max_calls` and the debate round limits. They bound FAN-OUT against a
 * plan quota, not money, and a subscription call has no marginal price.
 *
 * Units: `max_input_tokens` and `max_output_tokens` are TOKENS.
 * `max_total_usd`, `daily_limit_usd` and `debate.max_cost_usd` are US DOLLARS.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import * as cfg from '../../../src/scripts/ai_council/config.js';
import { CostBudget, _breach, type Spent } from '../../../src/scripts/ai_council/spend_gate.js';
import type { CostEstimate } from '../../../src/scripts/ai_council/pricing.js';

const NOTHING_SPENT: Spent = { input: 0, output: 0, usd: 0 };
const tmpDirs: string[] = [];

afterAll(() => {
    while (tmpDirs.length > 0) {
        fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    }
});

function estimate(tokens: number, usd: number): CostEstimate {
    return {
        provider: 'test',
        model: 'test-model',
        input_tokens: tokens,
        output_tokens: tokens,
        input_usd: usd,
        output_usd: 0,
    };
}

describe('CostBudget defaults — no ceiling on money or tokens', () => {
    it('defaults both token ceilings to 0', () => {
        const d = new CostBudget();
        expect(d.max_input_tokens).toBe(0);
        expect(d.max_output_tokens).toBe(0);
    });

    it('defaults both USD ceilings to 0', () => {
        const d = new CostBudget();
        expect(d.max_total_usd).toBe(0);
        expect(d.daily_limit_usd).toBe(0);
    });

    it('keeps max_calls, which bounds fan-out rather than money', () => {
        expect(new CostBudget().max_calls).toBe(10);
    });

    it('a default budget breaches on nothing, at any size', () => {
        // The whole point, stated as the behaviour rather than as four
        // field reads: a run with nothing configured is not stopped.
        const d = new CostBudget();
        for (const tokens of [1_000, 1_000_000, 1_000_000_000]) {
            expect(_breach(estimate(tokens, 10_000), NOTHING_SPENT, d)).toBeNull();
        }
    });

    it('a figure the caller passes still bounds', () => {
        // The twin. If this ever goes null, the defaults did not become
        // unbounded — the gate stopped working.
        expect(
            _breach(estimate(2_000, 0), NOTHING_SPENT, new CostBudget({ max_input_tokens: 1_000 })),
        ).toBe('tokens');
        expect(
            _breach(estimate(10, 5), NOTHING_SPENT, new CostBudget({ max_total_usd: 1 })),
        ).toBe('session');
    });
});

describe('loader defaults — the same answer one layer up', () => {
    // Through the real public loader, not an internal helper: the figures
    // that bound a consumer are the ones `load_council_config` emits.
    const EMPTY_BUDGET = `enabled: true
defaults:
  mode: api
cost_budget: {}
members:
  anthropic:
    enabled: true
    model: claude-x
    api_key_ref: env:ANTHROPIC_KEY
`;

    function loadWith(yaml: string): cfg.CouncilConfig {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-budget-'));
        tmpDirs.push(dir);
        const file = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(file, yaml, 'utf-8');
        return cfg.load_council_config(file);
    }

    it('an empty cost_budget block loads every money and token ceiling at 0', () => {
        const c = loadWith(EMPTY_BUDGET);
        expect(c.cost_budget.max_input_tokens).toBe(0);
        expect(c.cost_budget.max_output_tokens).toBe(0);
        expect(c.cost_budget.max_total_usd).toBe(0);
        expect(c.cost_budget.daily_limit_usd).toBe(0);
    });

    it('max_calls keeps its loader default of 50 — fan-out, not money', () => {
        expect(loadWith(EMPTY_BUDGET).cost_budget.max_calls).toBe(50);
    });

    it('a figure the file states still loads and still bounds', () => {
        // The twin: these defaults moved, the mechanism did not.
        const c = loadWith(EMPTY_BUDGET.replace('cost_budget: {}', 'cost_budget:\n  max_total_usd: 20.0'));
        expect(c.cost_budget.max_total_usd).toBe(20.0);
        expect(
            _breach(estimate(10, 25), NOTHING_SPENT, new CostBudget({ max_total_usd: 20.0 })),
        ).toBe('session');
    });

    it('debate.max_cost_usd defaults to 0 — no unconditional refusal cap', () => {
        // `off` is quoted: bare `off` is a YAML boolean, and the loader
        // rejects `False` as a disclosure mode.
        const c = loadWith(EMPTY_BUDGET + 'debate:\n  cost_disclosure:\n    mode: "off"\n');
        expect(c.debate.max_cost_usd).toBe(0);
    });
});
