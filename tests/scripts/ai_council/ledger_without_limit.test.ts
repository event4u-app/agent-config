/**
 * The ledger does not wait for a limit.
 *
 * Step 4.2 of `road-to-a-spend-bound-only-where-one-was-set`, under ADR-279.
 *
 * The orchestrator appended a spend line only while `daily_limit_usd > 0`, and
 * no default set one — so with the shipped configuration the ledger was never
 * written at all. That made the measurement depend on the bound, which is
 * exactly backwards: ADR-279's first consequence is that estimating and
 * recording spend never depend on a ceiling, because the ceiling is the part
 * that became optional.
 *
 * The orchestrator now appends for every billable response. The cap decides
 * only whether the recorded total is compared.
 *
 * Runs against the hermetic configuration home pinned by step 4.1's
 * `setupFiles` entry — see `ledger_is_hermetic.test.ts`. Without that this file
 * would write real-looking spend records onto whoever ran the suite, which is
 * why 4.1 landed first.
 *
 * Units: `usd` is US dollars; the token fields are tokens.
 */
import * as fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HERMETIC_CONFIG_HOME } from '../../_lib/hermetic-env.js';
import { LEDGER_PATH, read_entries } from '../../../src/scripts/ai_council/budget_guard.js';
import {
    consult,
    CostBudget,
    CouncilQuestion,
} from '../../../src/scripts/ai_council/orchestrator.js';
import { CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { load_prices } from '../../../src/scripts/ai_council/pricing.js';

/** A billable seat that answers, so the orchestrator prices and records it. */
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
    // Never run against the real home — the same refusal `ledger_is_hermetic`
    // carries, because this file writes too.
    if (!LEDGER_PATH.startsWith(HERMETIC_CONFIG_HOME)) {
        throw new Error(`ledger resolves outside the hermetic home: ${LEDGER_PATH}`);
    }
    clearLedger();
});

afterEach(clearLedger);

const QUESTION = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x'.repeat(200) });

describe('the ledger is written without a daily limit', () => {
    it('appends a line with daily_limit_usd at 0 — the shipped default', () => {
        const budget = new CostBudget(); // every cap 0 after step 3.1
        expect(budget.daily_limit_usd).toBe(0);

        consult([new BillableMock('anthropic', 'claude-sonnet-4-5')], QUESTION, budget, {
            table: load_prices(),
        });

        const entries = read_entries(LEDGER_PATH);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.usd).toBeGreaterThan(0);
        expect(entries[0]!.provider).toBe('anthropic');
    });

    it('still appends when a daily limit IS set', () => {
        // The twin: removing the condition must not have removed the append on
        // the path that already had it.
        consult(
            [new BillableMock('anthropic', 'claude-sonnet-4-5')],
            QUESTION,
            new CostBudget({ daily_limit_usd: 100 }),
            { table: load_prices() },
        );
        expect(read_entries(LEDGER_PATH)).toHaveLength(1);
    });

    it('appends one line per billable seat', () => {
        consult(
            [
                new BillableMock('anthropic', 'claude-sonnet-4-5'),
                new BillableMock('openai', 'gpt-4o'),
            ],
            QUESTION,
            new CostBudget(),
            { table: load_prices() },
        );
        const entries = read_entries(LEDGER_PATH);
        expect(entries).toHaveLength(2);
        expect(entries.map((e) => e.provider).sort()).toEqual(['anthropic', 'openai']);
    });
});
