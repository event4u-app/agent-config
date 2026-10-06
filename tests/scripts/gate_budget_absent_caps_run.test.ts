/**
 * A paid gate runs without caps, and one cap bounds alone.
 *
 * Step 2.2 of `road-to-a-spend-bound-only-where-one-was-set`, under ADR-279.
 *
 * Two defects are pinned here, and they are opposites, which is why both
 * directions are asserted in every block:
 *
 *   1. **Absent caps refused.** `evaluateGateBudget` returned `no_caps` and
 *      the caller rendered the entry instead of running it, on the reading
 *      that "an install whose settings do not carry the caps has not
 *      authorised a standing budget". ADR-279 supersedes that reading: the
 *      authorisation is `--confirm`, which this change does not touch, and
 *      the caps only ever bounded its SIZE.
 *   2. **One cap bounded nothing.** `readGateBudgetCaps` returned `null`
 *      unless BOTH caps were numeric, so a person who set one cap was bounded
 *      by neither — the stricter-looking rule produced the laxer result. That
 *      is the defect this step cares about more, because it silently removed a
 *      bound someone had actually chosen.
 *
 * Unit: every figure below is **US dollars**. `estimated_usd`, `actual_usd`,
 * both caps and `rollingUsd` are all USD; nothing here counts tokens.
 */
import { describe, expect, it } from 'vitest';

import {
    evaluateGateBudget,
    readGateBudgetCaps,
    type GateBudgetReceipt,
} from '../../src/agent-src/scripts/gate_budget.js';

const NOW = new Date('2026-10-06T12:00:00Z');

function receipt(usd: number, at: Date = NOW): GateBudgetReceipt {
    return {
        kind: 'consumption',
        blocker: 'b-x',
        authorization: 'confirm-flag',
        estimated_usd: usd,
        actual_usd: null,
        at: at.toISOString(),
        single_use: true,
    };
}

describe('no cap configured — the gate runs', () => {
    it('is ok with no caps and an estimate', () => {
        const v = evaluateGateBudget({ caps: null, records: [], estimateUsd: 4.5, now: NOW });
        expect(v.ok).toBe(true);
        expect(v).toMatchObject({ estimateUsd: 4.5 });
    });

    it('is ok with no caps and an estimate far above the figures the template used to ship', () => {
        // The template shipped USD 5 per run and USD 25 per seven days. With
        // no cap set, neither figure exists to be exceeded.
        const v = evaluateGateBudget({
            caps: null,
            records: [receipt(500)],
            estimateUsd: 1_000,
            now: NOW,
        });
        expect(v).toMatchObject({ ok: true, estimateUsd: 1_000, rollingUsd: 500 });
    });

    it('is ok with no caps and NO estimate', () => {
        // A missing estimate refuses only because a cap exists that nothing
        // can be compared against. With no cap there is no comparison to fail.
        const v = evaluateGateBudget({ caps: null, records: [], estimateUsd: null, now: NOW });
        expect(v).toMatchObject({ ok: true, estimateUsd: null });
    });

    it('still reports rolling spend with no cap to compare it against', () => {
        // ADR-279's first consequence: recording never depends on bounding.
        const v = evaluateGateBudget({
            caps: null,
            records: [receipt(2), receipt(3)],
            estimateUsd: 1,
            now: NOW,
        });
        expect(v).toMatchObject({ ok: true, rollingUsd: 5 });
    });

    it('refuses a missing estimate again as soon as a cap is set', () => {
        // The twin of the third case. A guard that was too eager would make a
        // cap the user DID set stop bounding, which is the worse defect.
        const v = evaluateGateBudget({
            caps: { maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: null },
            records: [],
            estimateUsd: null,
            now: NOW,
        });
        expect(v).toMatchObject({ ok: false, reason: 'no_estimate' });
    });
});

describe('one cap set — it bounds alone', () => {
    it('the per-run cap bounds with the rolling cap unset', () => {
        const caps = { maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: null };
        expect(
            evaluateGateBudget({ caps, records: [], estimateUsd: 5.01, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_per_run' });
        // Exactly at the cap is admitted — the boundary, not just the far side.
        expect(evaluateGateBudget({ caps, records: [], estimateUsd: 5, now: NOW })).toMatchObject({
            ok: true,
        });
        // And a rolling total of USD 900 does not bound, because that cap is unset.
        expect(
            evaluateGateBudget({ caps, records: [receipt(900)], estimateUsd: 5, now: NOW }),
        ).toMatchObject({ ok: true });
    });

    it('the rolling cap bounds with the per-run cap unset', () => {
        const caps = { maxCostPerRunUsd: null, maxCostPerRolling7dUsd: 25 };
        expect(
            evaluateGateBudget({ caps, records: [receipt(24)], estimateUsd: 1.01, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_rolling_7d' });
        expect(
            evaluateGateBudget({ caps, records: [receipt(24)], estimateUsd: 1, now: NOW }),
        ).toMatchObject({ ok: true });
        // On an EMPTY window a single run of USD 900 is still refused: the
        // rolling cap bounds the window's total, and this run's own estimate
        // is part of that total. An unset per-run cap does not make one run
        // exempt from the cap that was set.
        expect(
            evaluateGateBudget({ caps, records: [], estimateUsd: 900, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_rolling_7d' });
    });

    it('both caps set still bound exactly as before', () => {
        const caps = { maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: 25 };
        expect(
            evaluateGateBudget({ caps, records: [], estimateUsd: 5.01, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_per_run' });
        expect(
            evaluateGateBudget({ caps, records: [receipt(24)], estimateUsd: 2, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_rolling_7d' });
        expect(
            evaluateGateBudget({ caps, records: [receipt(10)], estimateUsd: 2, now: NOW }),
        ).toMatchObject({ ok: true, estimateUsd: 2, rollingUsd: 10 });
    });
});

describe('readGateBudgetCaps — one set cap survives the read', () => {
    it('null only when neither is set', () => {
        expect(readGateBudgetCaps({ roadmap: { gate_budget: {} } })).toBeNull();
        expect(
            readGateBudgetCaps({
                roadmap: {
                    gate_budget: { max_cost_per_run_usd: null, max_cost_per_rolling_7d_usd: null },
                },
            }),
        ).toBeNull();
    });

    it('a settings file with only the per-run cap still bounds per run', () => {
        const caps = readGateBudgetCaps({
            roadmap: { gate_budget: { max_cost_per_run_usd: 5 } },
        });
        expect(caps).toEqual({ maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: null });
        // End to end through the reader, because the defect lived in the seam
        // between these two functions rather than inside either one.
        expect(
            evaluateGateBudget({ caps, records: [], estimateUsd: 6, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_per_run' });
    });

    it('a settings file with only the rolling cap still bounds the window', () => {
        const caps = readGateBudgetCaps({
            roadmap: { gate_budget: { max_cost_per_rolling_7d_usd: 25 } },
        });
        expect(caps).toEqual({ maxCostPerRunUsd: null, maxCostPerRolling7dUsd: 25 });
        expect(
            evaluateGateBudget({ caps, records: [receipt(25)], estimateUsd: 1, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_rolling_7d' });
    });
});
