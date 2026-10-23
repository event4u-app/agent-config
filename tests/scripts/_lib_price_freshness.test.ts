import { describe, expect, it } from 'vitest';

import {
    PRICE_MAX_AGE_DAYS,
    modelGeneration,
    parsePriceRows,
    priceRefusal,
    selectPrice,
    type PriceRow,
} from '../../src/scripts/_lib/price_freshness.js';

const AS_OF = new Date('2026-10-23T00:00:00Z');
const RATES = { input: 0.1, output: 0.5, cache_write: 0.125, cache_read: 0.01 };

const OLD_FAMILY_ROW: PriceRow = { tier: 'haiku', sourced_on: '2026-05-14', input: 0.25, output: 1.25, cache_write: 0.3, cache_read: 0.03 };
const FRESH_MODEL_ROW: PriceRow = { tier: 'claude-haiku-5-5', model: 'claude-haiku-5-5', sourced_on: '2026-10-23', ...RATES };

describe('modelGeneration', () => {
    it('reads major.minor from a model id and ignores a date suffix', () => {
        expect(modelGeneration('claude-haiku-5-5')).toBe(5.5);
        expect(modelGeneration('claude-haiku-4-5-20251001')).toBe(4.5);
        expect(modelGeneration('claude-fable-5')).toBe(5);
        expect(modelGeneration('claude-opus-4-8')).toBe(4.8);
        expect(modelGeneration('haiku')).toBeNull();
    });
});

describe('priceRefusal', () => {
    it('refuses the 2026-05-14 row against claude-haiku-5-5', () => {
        const reason = priceRefusal(OLD_FAMILY_ROW, 'claude-haiku-5-5', AS_OF);
        expect(reason).not.toBeNull();
        expect(reason).toMatch(/162 days old/);
    });

    it('refuses a fresh row whose source model is an older generation than the served one', () => {
        const row: PriceRow = { ...FRESH_MODEL_ROW, model: 'claude-haiku-4-5' };
        expect(priceRefusal(row, 'claude-haiku-5-5', AS_OF)).toMatch(/generation 4.5.*5.5/);
    });

    it('refuses a fresh row that names no source model, since nothing vouches for its generation', () => {
        const row: PriceRow = { ...OLD_FAMILY_ROW, sourced_on: '2026-10-01' };
        expect(priceRefusal(row, 'claude-haiku-5-5', AS_OF)).toMatch(/names no source model/);
    });

    it('refuses an unreadable date and a row for another family', () => {
        expect(priceRefusal({ ...FRESH_MODEL_ROW, sourced_on: 'soon' }, 'claude-haiku-5-5', AS_OF)).toMatch(/date/);
        expect(priceRefusal({ ...FRESH_MODEL_ROW }, 'claude-sonnet-5-5', AS_OF)).toMatch(/family/);
    });

    it('prices a fresh row of the served generation, up to the age bound and not one day past it', () => {
        expect(priceRefusal(FRESH_MODEL_ROW, 'claude-haiku-5-5', AS_OF)).toBeNull();
        const atBound = new Date(AS_OF.getTime() + PRICE_MAX_AGE_DAYS * 86_400_000);
        expect(priceRefusal(FRESH_MODEL_ROW, 'claude-haiku-5-5', atBound)).toBeNull();
        expect(priceRefusal(FRESH_MODEL_ROW, 'claude-haiku-5-5', new Date(atBound.getTime() + 86_400_000))).toMatch(/121 days old/);
    });
});

describe('selectPrice', () => {
    it('prefers the served model’s own row over the family row', () => {
        const pick = selectPrice([OLD_FAMILY_ROW, FRESH_MODEL_ROW], 'claude-haiku-5-5', AS_OF);
        expect(pick).toEqual({ price: RATES, row: FRESH_MODEL_ROW });
    });

    it('returns the refusal when only a stale family row exists', () => {
        const pick = selectPrice([OLD_FAMILY_ROW], 'claude-haiku-5-5', AS_OF);
        expect('refusal' in pick && pick.refusal).toMatch(/haiku/);
    });
});

describe('parsePriceRows', () => {
    it('reads the pricing.yaml shape, dates included', () => {
        const rows = parsePriceRows(
            'version: 1\nmodels:\n  - tier: claude-haiku-5-5\n    model: claude-haiku-5-5\n    sourced_on: 2026-10-23\n    source: https://example.com\n    input: 0.10\n    output: 0.50\n    cache_write: 0.125\n    cache_read: 0.01\n',
        );
        expect(rows).toEqual([{ tier: 'claude-haiku-5-5', model: 'claude-haiku-5-5', sourced_on: '2026-10-23', source: 'https://example.com', ...RATES }]);
    });
});
