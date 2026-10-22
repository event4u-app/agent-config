import { describe, expect, it } from 'vitest';

import {
    ESCALATION_KILL,
    MIN_PAIRS,
    kindTierAfter,
    tierDownshiftVerdict,
    type LegResult,
    type Price,
} from '../../src/scripts/_lib/tier_downshift_verdict.js';

const PRICES: Record<string, Price> = {
    haiku: { input: 0.25, output: 1.25, cache_write: 0.3, cache_read: 0.03 },
    sonnet: { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
};
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
        const v = tierDownshiftVerdict(pairs(MIN_PAIRS - 1, () => true, () => true), PRICES);
        expect(v.quality).toBe('underpowered');
        expect(v.cost).toBe('underpowered');
        expect(v.flip).toBe(false);
    });

    it('holds and flips when lite verifies as often and costs less per verified slice', () => {
        const v = tierDownshiftVerdict(pairs(40, () => true, () => true), PRICES);
        expect(v.quality).toBe('held');
        expect(v.cost).toBe('relief');
        expect(v.flip).toBe(true);
    });

    it('breaches at the escalation kill whatever the difference', () => {
        const v = tierDownshiftVerdict(pairs(40, () => true, () => true, (i) => i < 40 * ESCALATION_KILL), PRICES);
        expect(v.escalation_rate_lite).toBeGreaterThanOrEqual(ESCALATION_KILL);
        expect(v.quality).toBe('breached');
        expect(v.flip).toBe(false);
    });

    it('charges an escalated re-run to the lite arm', () => {
        const plain = tierDownshiftVerdict(pairs(40, () => true, () => true), PRICES);
        const withRerun = tierDownshiftVerdict(pairs(40, () => true, () => true, (i) => i === 0), PRICES);
        expect(withRerun.lite.cost_usd).toBeGreaterThan(plain.lite.cost_usd);
    });

    it('a one-armed slice is left out, never counted as a pair', () => {
        const rows = pairs(40, () => true, () => true).filter((r) => !(r.slice_id === 's0' && r.arm === 'inherit'));
        expect(tierDownshiftVerdict(rows, PRICES).pairs).toBe(39);
    });

    it('a seeded breach above the kill reverts a kind already on lite', () => {
        const breach = tierDownshiftVerdict(pairs(40, () => true, () => true, (i) => i < 13), PRICES);
        expect(kindTierAfter('lite', breach)).toBe('inherit');
        const ok = tierDownshiftVerdict(pairs(40, () => true, () => true), PRICES);
        expect(kindTierAfter('lite', ok)).toBe('lite');
        expect(kindTierAfter('inherit', ok)).toBe('lite');
        const under = tierDownshiftVerdict(pairs(5, () => true, () => true), PRICES);
        expect(kindTierAfter('inherit', under)).toBe('inherit');
    });
});
