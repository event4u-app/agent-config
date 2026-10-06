// Tests for src/agent-src/scripts/gate_budget.ts — the class-1 spend bound
// decided at `road-to-gate-autonomy`'s `b-gate-budget-preauth` (option (a)).
//
// The cases that matter are the ones where a wrong answer would let money
// through: a `Budget:` field with no currency marker, an unreported actual
// cost, and a receipt whose timestamp cannot be parsed.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    appendGateBudgetReceipt,
    evaluateGateBudget,
    gateBudgetLedgerPath,
    parseBudgetUsd,
    readGateBudgetCaps,
    readGateBudgetLedger,
    rollingSpendUsd,
    type GateBudgetReceipt,
} from '../../src/agent-src/scripts/gate_budget.js';

let repo = '';
const NOW = new Date('2026-08-20T12:00:00Z');

function receipt(over: Partial<GateBudgetReceipt> = {}): GateBudgetReceipt {
    return {
        kind: 'consumption',
        blocker: 'b-x',
        authorization: 'confirm-flag',
        estimated_usd: 1,
        actual_usd: null,
        at: NOW.toISOString(),
        single_use: true,
        ...over,
    };
}

beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-budget-'));
});

afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
});

describe('parseBudgetUsd — a currency marker is required', () => {
    it('reads a dollar-sign figure', () => {
        expect(parseBudgetUsd('~$12.50 per run')).toBe(12.5);
    });

    it('reads a USD-suffixed figure, case-insensitively', () => {
        expect(parseBudgetUsd('about 40 usd per eval')).toBe(40);
        expect(parseBudgetUsd('40 USD')).toBe(40);
        expect(parseBudgetUsd('3 dollars')).toBe(3);
    });

    it('refuses a bare number — a misread cap is worse than no cap', () => {
        // "~50 queries" must not read as fifty dollars: that would admit a
        // large run under a small number, which is the one direction a spend
        // bound may never fail.
        expect(parseBudgetUsd('~50 queries per run')).toBeNull();
        expect(parseBudgetUsd('one afternoon')).toBeNull();
        expect(parseBudgetUsd('')).toBeNull();
    });

    it('accepts a comma decimal separator', () => {
        expect(parseBudgetUsd('12,50 USD')).toBe(12.5);
    });
});

describe('readGateBudgetCaps — absent is not a default, and each cap stands alone', () => {
    it('returns both caps when both are numbers', () => {
        expect(
            readGateBudgetCaps({
                roadmap: { gate_budget: { max_cost_per_run_usd: 5, max_cost_per_rolling_7d_usd: 25 } },
            }),
        ).toEqual({ maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: 25 });
    });

    it('returns null only when NEITHER cap is set', () => {
        expect(readGateBudgetCaps({})).toBeNull();
        expect(readGateBudgetCaps({ roadmap: {} })).toBeNull();
        expect(readGateBudgetCaps({ roadmap: { gate_budget: {} } })).toBeNull();
        expect(
            readGateBudgetCaps({
                roadmap: {
                    gate_budget: { max_cost_per_run_usd: null, max_cost_per_rolling_7d_usd: null },
                },
            }),
        ).toBeNull();
    });

    it('returns the one cap that was set, with the other null', () => {
        // Changed with ADR-279. This returned `null` for both of these until
        // 2026-10-06, so a person who set ONE cap was bounded by NEITHER —
        // the stricter-looking rule produced the laxer result.
        expect(
            readGateBudgetCaps({ roadmap: { gate_budget: { max_cost_per_run_usd: 5 } } }),
        ).toEqual({ maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: null });
        expect(
            readGateBudgetCaps({ roadmap: { gate_budget: { max_cost_per_rolling_7d_usd: 25 } } }),
        ).toEqual({ maxCostPerRunUsd: null, maxCostPerRolling7dUsd: 25 });
    });

    it('treats a non-numeric cap as unset rather than as a bound', () => {
        expect(
            readGateBudgetCaps({
                roadmap: {
                    gate_budget: { max_cost_per_run_usd: '5', max_cost_per_rolling_7d_usd: 25 },
                },
            }),
        ).toEqual({ maxCostPerRunUsd: null, maxCostPerRolling7dUsd: 25 });
    });
});

describe('rollingSpendUsd — the window fails closed', () => {
    it('prefers the actual cost when the run reported one', () => {
        expect(rollingSpendUsd([receipt({ estimated_usd: 1, actual_usd: 7 })], NOW)).toBe(7);
    });

    it('falls back to the estimate when no actual was reported', () => {
        expect(rollingSpendUsd([receipt({ estimated_usd: 3, actual_usd: null })], NOW)).toBe(3);
    });

    it('drops a receipt older than the window', () => {
        const old = new Date(NOW.getTime() - 8 * 24 * 3600_000).toISOString();
        expect(rollingSpendUsd([receipt({ at: old, estimated_usd: 9 })], NOW)).toBe(0);
    });

    it('counts a receipt with an unparseable timestamp as inside the window', () => {
        // Dropping it would understate the total, and a spend cap that
        // understates is a cap that fails open.
        expect(rollingSpendUsd([receipt({ at: 'sometime', estimated_usd: 9 })], NOW)).toBe(9);
    });
});

describe('the ledger is append-only and tolerant of junk lines', () => {
    it('appends without rewriting, creating the state directory', () => {
        appendGateBudgetReceipt(repo, receipt({ estimated_usd: 1 }));
        appendGateBudgetReceipt(repo, receipt({ estimated_usd: 2 }));
        const raw = fs.readFileSync(gateBudgetLedgerPath(repo), 'utf-8');
        expect(raw.trimEnd().split('\n')).toHaveLength(2);
        expect(readGateBudgetLedger(repo).map((r) => r.estimated_usd)).toEqual([1, 2]);
    });

    it('skips a malformed line rather than throwing', () => {
        appendGateBudgetReceipt(repo, receipt({ estimated_usd: 4 }));
        fs.appendFileSync(gateBudgetLedgerPath(repo), 'not json\n{"kind":"other"}\n', 'utf-8');
        expect(readGateBudgetLedger(repo)).toHaveLength(1);
    });

    it('reads an absent ledger as empty', () => {
        expect(readGateBudgetLedger(repo)).toEqual([]);
    });
});

describe('evaluateGateBudget — every no renders, none of them runs', () => {
    const caps = { maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: 25 };

    it('runs with no caps configured', () => {
        // Reversed with ADR-279: this asserted `{ ok: false, reason: 'no_caps' }`
        // until 2026-10-06. The absence of a ceiling on money is not a refusal
        // — `--confirm` is the authorisation, and the caps only ever bounded
        // its size.
        const v = evaluateGateBudget({ caps: null, records: [], estimateUsd: 1, now: NOW });
        expect(v).toMatchObject({ ok: true, estimateUsd: 1 });
    });

    it('runs with no caps AND no estimate, recording that there was nothing to record', () => {
        const v = evaluateGateBudget({ caps: null, records: [], estimateUsd: null, now: NOW });
        expect(v).toMatchObject({ ok: true, estimateUsd: null, rollingUsd: 0 });
    });

    it('reports rolling spend even with no cap to compare it against', () => {
        // Recording never depended on bounding — ADR-279's first consequence.
        const v = evaluateGateBudget({
            caps: null,
            records: [receipt({ estimated_usd: 3, actual_usd: null })],
            estimateUsd: 1,
            now: NOW,
        });
        expect(v).toMatchObject({ ok: true, rollingUsd: 3 });
    });

    it('refuses with no USD estimate when a cap exists to compare against', () => {
        const v = evaluateGateBudget({ caps, records: [], estimateUsd: null, now: NOW });
        expect(v).toMatchObject({ ok: false, reason: 'no_estimate' });
    });

    it('bounds on the per-run cap alone, with the rolling cap unset', () => {
        const only = { maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: null };
        expect(
            evaluateGateBudget({ caps: only, records: [], estimateUsd: 5.01, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_per_run' });
        // A rolling total far over the OTHER cap's usual figure does not bound,
        // because that cap was not set.
        expect(
            evaluateGateBudget({
                caps: only,
                records: [receipt({ estimated_usd: 900, actual_usd: null })],
                estimateUsd: 5,
                now: NOW,
            }),
        ).toMatchObject({ ok: true });
    });

    it('bounds on the rolling cap alone, with the per-run cap unset', () => {
        const only = { maxCostPerRunUsd: null, maxCostPerRolling7dUsd: 25 };
        expect(
            evaluateGateBudget({
                caps: only,
                records: [receipt({ estimated_usd: 24, actual_usd: null })],
                estimateUsd: 1.01,
                now: NOW,
            }),
        ).toMatchObject({ ok: false, reason: 'over_rolling_7d' });
        // A single-run figure far over the OTHER cap's usual value is admitted,
        // because that cap was not set and the rolling window still fits.
        expect(
            evaluateGateBudget({ caps: only, records: [], estimateUsd: 20, now: NOW }),
        ).toMatchObject({ ok: true });
    });

    it('refuses over the per-run cap and admits exactly at it', () => {
        expect(
            evaluateGateBudget({ caps, records: [], estimateUsd: 5.01, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_per_run' });
        expect(evaluateGateBudget({ caps, records: [], estimateUsd: 5, now: NOW })).toMatchObject({
            ok: true,
        });
    });

    it('refuses when the window total would cross the rolling cap', () => {
        // The per-run check runs FIRST, so isolating the rolling half needs an
        // estimate that passes per-run and a window that does not: a tighter
        // rolling cap, not a bigger estimate.
        const tight = { maxCostPerRunUsd: 5, maxCostPerRolling7dUsd: 22 };
        const records = [0, 1, 2, 3].map((d) =>
            receipt({ estimated_usd: 5, at: new Date(NOW.getTime() - d * 3600_000).toISOString() }),
        );
        expect(
            evaluateGateBudget({ caps: tight, records, estimateUsd: 5, now: NOW }),
        ).toMatchObject({ ok: false, reason: 'over_rolling_7d' });
        expect(
            evaluateGateBudget({ caps: tight, records, estimateUsd: 2, now: NOW }),
        ).toMatchObject({ ok: true, rollingUsd: 20 });
        // And the wide cap admits the same run, so the refusal above is the
        // window talking and not the estimate.
        expect(evaluateGateBudget({ caps, records, estimateUsd: 5, now: NOW })).toMatchObject({
            ok: true,
            rollingUsd: 20,
        });
    });
});
