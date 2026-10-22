import { describe, expect, it } from 'vitest';

import {
    ESCALATION_KILL,
    MIN_PAIRS,
    QUALITY_MARGIN_PP,
    kindTierAfter,
    tierDownshiftVerdict,
    type LegResult,
} from '../../src/scripts/_lib/tier_downshift_verdict.js';
import type { PriceRow } from '../../src/scripts/_lib/price_freshness.js';

const AS_OF = new Date('2026-10-23T00:00:00Z');
const PRICES: PriceRow[] = [
    { tier: 'claude-haiku-5-5', model: 'claude-haiku-5-5', sourced_on: '2026-10-23', input: 0.1, output: 0.5, cache_write: 0.125, cache_read: 0.01 },
    { tier: 'claude-sonnet-5-5', model: 'claude-sonnet-5-5', sourced_on: '2026-10-23', input: 2, output: 10, cache_write: 2.5, cache_read: 0.1 },
];
const USAGE = { input: 10, cache_read: 5000, cache_write: 6000, output: 300 };

function pairs(n: number, liteOk: (i: number) => boolean, inheritOk: (i: number) => boolean, liteEscalates = (_i: number) => false): LegResult[] {
    const rows: LegResult[] = [];
    for (let i = 0; i < n; i++) {
        const esc = liteEscalates(i);
        rows.push({
            slice_id: `s${i}`,
            arm: 'lite',
            verified: liteOk(i),
            escalated: esc,
            served_model: 'claude-haiku-5-5',
            usage: USAGE,
            ...(esc ? { rerun: { served_model: 'claude-sonnet-5-5', usage: USAGE, verified: true } } : {}),
        });
        rows.push({ slice_id: `s${i}`, arm: 'inherit', verified: inheritOk(i), escalated: false, served_model: 'claude-sonnet-5-5', usage: USAGE });
    }
    return rows;
}

describe('tierDownshiftVerdict', () => {
    it('backs nothing below the pair floor', () => {
        const v = tierDownshiftVerdict(pairs(MIN_PAIRS - 1, () => true, () => true), PRICES, AS_OF);
        expect(v.quality).toBe('underpowered');
        expect(v.cost).toBe('underpowered');
        expect(v.flip).toBe(false);
    });

    it('holds and flips when lite verifies as often and costs less per verified slice', () => {
        const v = tierDownshiftVerdict(pairs(60, () => true, () => true), PRICES, AS_OF);
        expect(v.quality).toBe('held');
        expect(v.cost).toBe('relief');
        expect(v.flip).toBe(true);
    });

    it('breaches at the escalation kill whatever the difference', () => {
        const v = tierDownshiftVerdict(pairs(40, () => true, () => true, (i) => i < 40 * ESCALATION_KILL), PRICES, AS_OF);
        expect(v.escalation_rate_lite).toBeGreaterThanOrEqual(ESCALATION_KILL);
        expect(v.quality).toBe('breached');
        expect(v.flip).toBe(false);
    });

    it('charges an escalated re-run to the lite arm', () => {
        const plain = tierDownshiftVerdict(pairs(60, () => true, () => true), PRICES, AS_OF);
        const withRerun = tierDownshiftVerdict(pairs(60, () => true, () => true, (i) => i === 0), PRICES, AS_OF);
        expect(withRerun.lite.cost_usd).toBeGreaterThan(plain.lite.cost_usd);
    });

    it('a one-armed slice is left out, never counted as a pair', () => {
        const rows = pairs(40, () => true, () => true).filter((r) => !(r.slice_id === 's0' && r.arm === 'inherit'));
        expect(tierDownshiftVerdict(rows, PRICES, AS_OF).pairs).toBe(39);
    });

    it('a seeded breach above the kill reverts a kind already on lite', () => {
        const breach = tierDownshiftVerdict(pairs(40, () => true, () => true, (i) => i < 13), PRICES, AS_OF);
        expect(kindTierAfter('lite', breach)).toBe('inherit');
        const ok = tierDownshiftVerdict(pairs(60, () => true, () => true), PRICES, AS_OF);
        expect(kindTierAfter('lite', ok)).toBe('lite');
        expect(kindTierAfter('inherit', ok)).toBe('lite');
        const under = tierDownshiftVerdict(pairs(5, () => true, () => true), PRICES, AS_OF);
        expect(kindTierAfter('inherit', under)).toBe('inherit');
    });
});

describe('tierDownshiftVerdict — no discordant pair is not certainty', () => {
    it('bounds a clean run by the exact binomial bound, not by zero', () => {
        const v = tierDownshiftVerdict(pairs(60, () => true, () => true), PRICES, AS_OF);
        // Clopper–Pearson, one-sided 95 %, 0 of 60: 1 - 0.05^(1/60).
        expect(v.upper_bound_pp).toBeCloseTo((1 - 0.05 ** (1 / 60)) * 100, 6);
        expect(v.quality).toBe('held');
        const small = tierDownshiftVerdict(pairs(40, () => true, () => true), PRICES, AS_OF);
        expect(small.upper_bound_pp).toBeCloseTo((1 - 0.05 ** (1 / 40)) * 100, 6);
        expect(small.quality).toBe('underpowered');
    });
});

describe('tierDownshiftVerdict — one more failure never reads as better evidence', () => {
    it('never holds 1 discordant failure where 0 is refused, at any pair count', () => {
        for (let n = MIN_PAIRS; n <= 120; n++) {
            const zero = tierDownshiftVerdict(pairs(n, () => true, () => true), PRICES, AS_OF);
            const one = tierDownshiftVerdict(pairs(n, (i) => i !== 0, () => true), PRICES, AS_OF);
            if (zero.quality !== 'held') expect(one.quality, `n=${n}`).not.toBe('held');
            expect(one.upper_bound_pp!, `n=${n}`).toBeGreaterThan(zero.upper_bound_pp!);
        }
    });

    it('holds only strictly below the margin', () => {
        for (let n = MIN_PAIRS; n <= 120; n++) {
            for (const fails of [0, 1, 2]) {
                const v = tierDownshiftVerdict(pairs(n, (i) => i >= fails, () => true), PRICES, AS_OF);
                if (v.quality === 'held') expect(v.upper_bound_pp!, `n=${n} fails=${fails}`).toBeLessThan(QUALITY_MARGIN_PP);
            }
        }
    });

    it('a failure of the inherit arm alone never makes lite look worse', () => {
        const base = tierDownshiftVerdict(pairs(80, () => true, () => true), PRICES, AS_OF);
        const inheritFails = tierDownshiftVerdict(pairs(80, () => true, (i) => i !== 0), PRICES, AS_OF);
        expect(inheritFails.upper_bound_pp!).toBeLessThanOrEqual(base.upper_bound_pp!);
    });
});

describe('tierDownshiftVerdict — usage a leg caused beyond itself', () => {
    it('charges an advisor consultation to the arm that consulted it', () => {
        const base = pairs(60, () => true, () => true);
        const withAdvisor = base.map((r) =>
            r.arm === 'lite' ? { ...r, extra: [{ served_model: 'claude-sonnet-5-5', usage: { input: 30000, cache_read: 0, cache_write: 0, output: 2000 } }] } : r,
        );
        const v = tierDownshiftVerdict(withAdvisor, PRICES, AS_OF);
        expect(v.lite.cost_usd).toBeGreaterThan(tierDownshiftVerdict(base, PRICES, AS_OF).lite.cost_usd);
        expect(v.cost).toBe('no-relief');
    });
});

describe('tierDownshiftVerdict — a stale price row prices nothing', () => {
    it('leaves cost underpowered when the only haiku row is the 2026-05-14 family row', () => {
        const stale: PriceRow[] = [
            { tier: 'haiku', sourced_on: '2026-05-14', input: 0.25, output: 1.25, cache_write: 0.3, cache_read: 0.03 },
            PRICES[1]!,
        ];
        const v = tierDownshiftVerdict(pairs(60, () => true, () => true), stale, AS_OF);
        expect(v.quality).toBe('held');
        expect(v.cost).toBe('underpowered');
        expect(v.flip).toBe(false);
        expect(v.notes.join('\n')).toMatch(/162 days old/);
    });
});
