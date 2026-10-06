/**
 * A default ceiling cannot come back unnoticed.
 *
 * Step 4.3 of `road-to-a-spend-bound-only-where-one-was-set`, under ADR-279.
 *
 * The other suites in this change each pin one layer. This one builds the
 * budget **the way the command does** for a council file carrying no
 * `cost_budget` block, and then asserts the four properties ADR-279 promises,
 * end to end:
 *
 *   1. no breach for a large estimate,
 *   2. an `ok` gate verdict with no caps,
 *   3. a ledger line after a billable response,
 *   4. a breach again as soon as any one cap is set.
 *
 * The fourth is the one that keeps the other three honest. Three assertions
 * that something does NOT happen can all be satisfied by a mechanism that
 * stopped working; only the fourth distinguishes "no bound was configured"
 * from "bounding is broken".
 *
 * Why the command's own fallback rather than `new CostBudget()`: the command
 * writes those numbers a third time, independently of the loader and the
 * constructor, so a future edit could move two layers and leave this one
 * bounding. The literal below mirrors `council_cli.ts`'s `_pyInt(cost_cfg[…] ??
 * 0, 0)` shape for a config with no `cost_budget` block.
 *
 * Units: token caps count TOKENS, USD caps count US DOLLARS, and this file
 * never compares one with the other.
 */
import * as fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HERMETIC_CONFIG_HOME } from '../_lib/hermetic-env.js';
import { LEDGER_PATH, read_entries } from '../../src/scripts/ai_council/budget_guard.js';
import { CostBudget, _breach, type Spent } from '../../src/scripts/ai_council/spend_gate.js';
import { evaluateGateBudget } from '../../src/agent-src/scripts/gate_budget.js';
import {
    consult,
    CouncilQuestion,
} from '../../src/scripts/ai_council/orchestrator.js';
import { CouncilResponse, ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { load_prices } from '../../src/scripts/ai_council/pricing.js';
import type { CostEstimate } from '../../src/scripts/ai_council/pricing.js';

const NOTHING_SPENT: Spent = { input: 0, output: 0, usd: 0 };
const NOW = new Date('2026-10-06T12:00:00Z');

/**
 * The budget the command builds for a council file with no `cost_budget`
 * block — the shape `council_cli.ts` constructs at both of its call sites.
 */
function budgetAsCommandBuildsIt(): CostBudget {
    const cost_cfg: Record<string, number | undefined> = {};
    return new CostBudget({
        max_input_tokens: cost_cfg['max_input_tokens'] ?? 0,
        max_output_tokens: cost_cfg['max_output_tokens'] ?? 0,
        max_calls: cost_cfg['max_calls'] ?? 10,
        max_total_usd: cost_cfg['max_total_usd'] ?? 0.0,
        daily_limit_usd: cost_cfg['daily_limit_usd'] ?? 0.0,
    });
}

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

class BillableMock extends ExternalAIClient {
    constructor(name: string, model: string) {
        super();
        this.name = name;
        this.model = model;
        this.billable = true;
        this.transport = 'api';
    }
    override ask(): CouncilResponse {
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text: 'answered',
            error: null,
            input_tokens: 1_000,
            output_tokens: 1_000,
            latency_ms: 5,
        });
    }
}

function clearLedger(): void {
    if (fs.existsSync(LEDGER_PATH)) fs.rmSync(LEDGER_PATH);
}

beforeEach(() => {
    if (!LEDGER_PATH.startsWith(HERMETIC_CONFIG_HOME)) {
        throw new Error(`ledger resolves outside the hermetic home: ${LEDGER_PATH}`);
    }
    clearLedger();
});

afterEach(clearLedger);

describe('nothing configured — no ceiling applies anywhere', () => {
    it('1. no breach for a large estimate', () => {
        const budget = budgetAsCommandBuildsIt();
        expect(_breach(estimate(10_000_000, 5_000), NOTHING_SPENT, budget)).toBeNull();
    });

    it('2. the paid gate returns ok with no caps', () => {
        const v = evaluateGateBudget({
            caps: null,
            records: [],
            estimateUsd: 1_000,
            now: NOW,
        });
        expect(v.ok).toBe(true);
    });

    it('3. a billable response still lands a ledger line', () => {
        consult(
            [new BillableMock('anthropic', 'claude-sonnet-4-5')],
            new CouncilQuestion({ mode: 'prompt', user_prompt: 'x'.repeat(200) }),
            budgetAsCommandBuildsIt(),
            { table: load_prices() },
        );
        const entries = read_entries(LEDGER_PATH);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.usd).toBeGreaterThan(0);
    });
});

describe('one cap set — bounding still works', () => {
    it('4a. the input-token cap breaches alone', () => {
        const b = budgetAsCommandBuildsIt();
        b.max_input_tokens = 1_000;
        expect(_breach(estimate(1_001, 0), NOTHING_SPENT, b)).toBe('tokens');
    });

    it('4b. the output-token cap breaches alone', () => {
        const b = budgetAsCommandBuildsIt();
        b.max_output_tokens = 500;
        expect(_breach(estimate(501, 0), NOTHING_SPENT, b)).toBe('tokens');
    });

    it('4c. the session USD cap breaches alone', () => {
        const b = budgetAsCommandBuildsIt();
        b.max_total_usd = 1.0;
        expect(_breach(estimate(10, 2.0), NOTHING_SPENT, b)).toBe('session');
    });

    it('4d. the paid gate refuses over a cap that was set', () => {
        expect(
            evaluateGateBudget({
                caps: { maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: null },
                records: [],
                estimateUsd: 5.01,
                now: NOW,
            }),
        ).toMatchObject({ ok: false, reason: 'over_per_run' });
    });
});

describe('the command fallback itself carries no ceiling', () => {
    it('builds every money and token cap at 0, and keeps max_calls', () => {
        // If a future edit reintroduces a default here, this is the assertion
        // that names it — the three other layers have their own.
        const b = budgetAsCommandBuildsIt();
        expect(b.max_input_tokens).toBe(0);
        expect(b.max_output_tokens).toBe(0);
        expect(b.max_total_usd).toBe(0);
        expect(b.daily_limit_usd).toBe(0);
        expect(b.max_calls).toBe(10);
    });
});
