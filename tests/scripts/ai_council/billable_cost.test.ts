/**
 * A subscription-CLI answer costs nothing, and the artefact must say so.
 *
 * Regression cover for the defect found 2026-08-27: `council_cli.ts` computed
 * `cost_usd_actual` by running `estimate_cost` over EVERY non-errored response
 * with no `billable` check, so two `claude-pro` / `chatgpt-plus` answers that
 * were billed nothing were recorded at API rates. The same run printed
 * `TOTAL: $0.0000` from the pre-run path — which does filter on `billable` —
 * and `actual $0.1055` from the post-run path, two lines apart and two orders
 * of magnitude apart, with the misleading one labelled "actual".
 *
 * Second half of the same defect, and the reason the coercion is tested
 * explicitly: `_serialise_responses` stringifies every metadata value with
 * `String(v)`, so a persisted artefact carries `"billable": "false"`. In
 * JavaScript `Boolean("false") === true`, so any consumer reading the field
 * back with a bare `Boolean()` sees a NON-billable seat as billable.
 */
import { describe, expect, it } from 'vitest';

import {
    allSeatsNonBillable,
    isBillableResponse,
    sumBillableCost,
    type BillableCostInput,
    type PriceTable,
} from '../../../src/scripts/ai_council/pricing.js';
import { priceKey } from '../../../src/scripts/ai_council/_default_prices.js';

/**
 * An inline table charging $1 per 1M in and $1 per 1M out, so one million
 * tokens each way costs exactly $2 and the assertions read as arithmetic.
 * Built as a literal rather than via `load_prices`, which writes a file on a
 * cache miss — a test must not write into the tracked tree.
 */
function table(): PriceTable {
    const prices = new Map();
    for (const [provider, model] of [
        ['anthropic', 'claude-sonnet-4-5'],
        ['openai', 'codex-default'],
    ] as const) {
        prices.set(priceKey(provider, model), {
            provider,
            model,
            input_per_1m_usd: 1.0,
            output_per_1m_usd: 1.0,
        });
    }
    return {
        last_updated: '2026-08-27',
        currency: 'USD',
        unit: 'per_1M_tokens',
        source: 'test-literal',
        prices,
    };
}

function resp(over: Partial<BillableCostInput> = {}): BillableCostInput {
    return {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        input_tokens: 1_000_000,
        output_tokens: 1_000_000,
        error: null,
        metadata: {},
        ...over,
    };
}

describe('isBillableResponse', () => {
    it('defaults to billable when the field is absent — a missing flag never buys a free pass', () => {
        expect(isBillableResponse(resp({ metadata: {} }))).toBe(true);
    });

    it('reads a real boolean false as non-billable', () => {
        expect(isBillableResponse(resp({ metadata: { billable: false } }))).toBe(false);
    });

    it('reads the STRING "false" as non-billable — Boolean("false") is true in JS', () => {
        expect(isBillableResponse(resp({ metadata: { billable: 'false' } }))).toBe(false);
    });

    it('reads the string "true" as billable', () => {
        expect(isBillableResponse(resp({ metadata: { billable: 'true' } }))).toBe(true);
    });

    // Council review (2/2, 2026-08-27) medium finding: the first draft ended
    // `return Boolean(raw)` while promising a conservative default. Boolean(0)
    // and Boolean([]) are false, so a numeric or empty-array value would have
    // zeroed a billable seat.
    it.each([
        ['numeric 0', 0],
        ['numeric 1', 1],
        ['empty array', []],
        ['non-empty array', ['x']],
        ['empty object', {}],
        ['an unrecognised string', 'maybe'],
    ])('treats %s as BILLABLE — unknown types never buy a free pass', (_label, value) => {
        expect(isBillableResponse(resp({ metadata: { billable: value } }))).toBe(true);
    });
});

describe('allSeatsNonBillable', () => {
    it('true when every answered seat is non-billable', () => {
        const a = resp({ metadata: { billable: 'false' } });
        const b = resp({ provider: 'openai', model: 'codex-default', metadata: { billable: false } });
        expect(allSeatsNonBillable([a, b])).toBe(true);
    });

    it('false when one answered seat is billable', () => {
        const sub = resp({ metadata: { billable: 'false' } });
        const billed = resp({ provider: 'openai', model: 'codex-default', metadata: { billable: true } });
        expect(allSeatsNonBillable([sub, billed])).toBe(false);
    });

    // The council's HIGHEST-severity finding, as an executable case. The first
    // draft inferred this label from `actual_total === 0`, and estimate_cost
    // returns 0 for a model with no price row — so an unpriced BILLABLE seat
    // produced a zero total and would have printed "all subscription-authed".
    it('false for a billable seat whose model has no price row — zero cost is not zero billability', () => {
        const t = table();
        const unpriced = resp({ model: 'model-nobody-priced', metadata: { billable: true } });
        expect(sumBillableCost([unpriced], t)).toBe(0);
        expect(allSeatsNonBillable([unpriced])).toBe(false);
    });

    it('false for a billable seat reporting zero tokens — the same trap from another angle', () => {
        const t = table();
        const empty = resp({ input_tokens: 0, output_tokens: 0, metadata: { billable: true } });
        expect(sumBillableCost([empty], t)).toBe(0);
        expect(allSeatsNonBillable([empty])).toBe(false);
    });

    it('errored seats are ignored, and a billable error does not make the set non-billable', () => {
        const sub = resp({ metadata: { billable: 'false' } });
        const brokenBillable = resp({ metadata: { billable: true }, error: 'timeout' });
        expect(allSeatsNonBillable([sub, brokenBillable])).toBe(true);
    });

    it('false on an empty set and on an all-errored set — no transport, no claim', () => {
        expect(allSeatsNonBillable([])).toBe(false);
        expect(allSeatsNonBillable([resp({ error: 'timeout' })])).toBe(false);
    });
});

describe('sumBillableCost', () => {
    it('a subscription-CLI seat contributes zero', () => {
        const t = table();
        const sub = resp({ metadata: { billable: false, subscription_label: 'claude-pro' } });
        expect(sumBillableCost([sub], t)).toBe(0);
    });

    it('the persisted string form also contributes zero — this is the replay path', () => {
        const t = table();
        const sub = resp({ metadata: { billable: 'false', subscription_label: 'claude-pro' } });
        expect(sumBillableCost([sub], t)).toBe(0);
    });

    it('two subscription seats — the shape of the runs that produced this defect — total zero', () => {
        const t = table();
        const a = resp({
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            metadata: { billable: 'false', subscription_label: 'claude-pro' },
        });
        const o = resp({
            provider: 'openai',
            model: 'codex-default',
            metadata: { billable: 'false', subscription_label: 'chatgpt-plus' },
        });
        expect(sumBillableCost([a, o], t)).toBe(0);
    });

    it('a billable seat still contributes its estimate — the filter must not zero everything', () => {
        const t = table();
        const billed = resp({ metadata: { billable: true } });
        expect(sumBillableCost([billed], t)).toBeGreaterThan(0);
    });

    it('mixes correctly: the billable seat alone sets the total', () => {
        const t = table();
        const billed = resp({ metadata: { billable: true } });
        const sub = resp({ metadata: { billable: false } });
        expect(sumBillableCost([billed, sub], t)).toBe(sumBillableCost([billed], t));
    });

    it('an errored response contributes nothing regardless of billability', () => {
        const t = table();
        const broken = resp({ metadata: { billable: true }, error: 'timeout' });
        expect(sumBillableCost([broken], t)).toBe(0);
    });
});
