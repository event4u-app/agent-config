// Pure-TS behaviour test for the pricing twin (`src/scripts/ai_council/pricing.ts`).
//
// Ports `tests/ai_council/test_pricing.py` faithfully against the TS twin so the
// Python spec can be retired. Covers: `estimate_input_tokens` (chars/4 heuristic),
// `bootstrap_from_defaults` + `load_prices` round-trip, `estimate_cost`,
// `last_monday_utc`, and `is_stale` (UTC Monday boundary + invalid-date path).
//
// API note: the Python `PriceTable.lookup(provider, model)` method is a free
// function `lookup(table, provider, model)` in the twin; this test asserts the
// same lookup behaviour through it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_PRICES } from '../../../src/scripts/ai_council/_default_prices.js';
import {
    CACHE_READ_MULTIPLIER,
    CACHE_WRITE_MULTIPLIER_1H,
    CACHE_WRITE_MULTIPLIER_5M,
    bootstrap_from_defaults,
    downgrade_coupling,
    estimate_cost,
    estimate_input_tokens,
    is_stale,
    last_monday_utc,
    load_prices,
    lookup,
    reprice_with_cache,
} from '../../../src/scripts/ai_council/pricing.js';

const _tmpDirs: string[] = [];

function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pricing-'));
    _tmpDirs.push(d);
    return d;
}

afterEach(() => {
    while (_tmpDirs.length > 0) {
        const d = _tmpDirs.pop();
        if (d) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

// ── chars/4 heuristic ────────────────────────────────────────────────

describe('estimate_input_tokens', () => {
    it('empty string returns zero', () => {
        expect(estimate_input_tokens('')).toBe(0);
    });

    it('short string returns at least one', () => {
        expect(estimate_input_tokens('ab')).toBe(1);
        expect(estimate_input_tokens('a')).toBe(1);
    });

    it('uses chars / 4', () => {
        expect(estimate_input_tokens('x'.repeat(100))).toBe(25);
        expect(estimate_input_tokens('x'.repeat(4001))).toBe(1000);
    });
});

// ── bootstrap + parser round-trip ────────────────────────────────────

describe('bootstrap + load_prices', () => {
    it('bootstrap creates a file with frontmatter and table', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const text = fs.readFileSync(p, 'utf-8');
        expect(text.startsWith('---\n')).toBe(true);
        expect(text).toContain('currency: USD');
        expect(text).toContain('unit: per_1M_tokens');
        expect(text).toContain('source: shipped-default');
        expect(text).toContain('| provider');
    });

    it('load_prices bootstraps when the file is missing', () => {
        const p = path.join(mkTmp(), 'prices.md');
        const table = load_prices(p);
        expect(fs.existsSync(p)).toBe(true);
        expect(table.source).toBe('shipped-default');
        expect(table.prices.has('anthropic claude-sonnet-4-5')).toBe(true);
    });

    it('round-trips every default entry', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const table = load_prices(p);
        for (const key of DEFAULT_PRICES.keys()) {
            expect(table.prices.has(key), `missing ${key}`).toBe(true);
        }
        // key is "provider model"; split into the two components for lookup().
        for (const [key, [inp, outp]] of DEFAULT_PRICES) {
            const sep = key.indexOf(' ');
            const provider = key.slice(0, sep);
            const model = key.slice(sep + 1);
            const price = lookup(table, provider, model);
            expect(price).not.toBeNull();
            expect(price?.input_per_1m_usd).toBe(inp);
            expect(price?.output_per_1m_usd).toBe(outp);
        }
    });

    it('user edit wins over defaults', () => {
        const p = path.join(mkTmp(), 'prices.md');
        fs.writeFileSync(
            p,
            '---\nlast_updated: 2026-04-29\ncurrency: USD\nunit: per_1M_tokens\nsource: user-curated\n---\n\n' +
                '| provider | model | input | output |\n' +
                '|---|---|---|---|\n' +
                '| anthropic | claude-sonnet-4-5 | 99.99 | 100.00 |\n',
            'utf-8',
        );
        const table = load_prices(p);
        const price = lookup(table, 'anthropic', 'claude-sonnet-4-5');
        expect(price).not.toBeNull();
        expect(price?.input_per_1m_usd).toBe(99.99);
        expect(price?.output_per_1m_usd).toBe(100.0);
        expect(table.source).toBe('user-curated');
    });
});

// ── cost estimation ──────────────────────────────────────────────────

describe('estimate_cost', () => {
    it('known model', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const table = load_prices(p);
        const e = estimate_cost('anthropic', 'claude-sonnet-4-5', 1_000_000, 1_000_000, table);
        expect(e.input_usd).toBe(3.0);
        expect(e.output_usd).toBe(15.0);
        // Python asserts total_usd == 18.0; the twin's CostEstimate has no
        // total field, so assert the equivalent sum.
        expect(e.input_usd + e.output_usd).toBe(18.0);
    });

    it('unknown model returns zero', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const table = load_prices(p);
        const e = estimate_cost('anthropic', 'no-such-model', 100, 100, table);
        expect(e.input_usd).toBe(0.0);
        expect(e.output_usd).toBe(0.0);
    });
});

// ── prompt-cache repricing (realized cost) ───────────────────────────

describe('reprice_with_cache', () => {
    it('cache reads bill at 0.1x, writes at 1.25x (5m) / 2x (1h) of input', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const table = load_prices(p); // sonnet-4-5 input = $3/1M
        const rd = reprice_with_cache(
            'anthropic',
            'claude-sonnet-4-5',
            { input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 0 },
            table,
        );
        expect(rd.input_usd).toBeCloseTo(0.3, 10); // 3.0 × 0.1
        const w5 = reprice_with_cache(
            'anthropic',
            'claude-sonnet-4-5',
            { input_tokens: 0, cache_creation_input_tokens: 1_000_000, output_tokens: 0 },
            table,
            '5m',
        );
        expect(w5.input_usd).toBeCloseTo(3.75, 10); // 3.0 × 1.25
        const w1 = reprice_with_cache(
            'anthropic',
            'claude-sonnet-4-5',
            { input_tokens: 0, cache_creation_input_tokens: 1_000_000, output_tokens: 0 },
            table,
            '1h',
        );
        expect(w1.input_usd).toBeCloseTo(6.0, 10); // 3.0 × 2
    });

    it('mixed uncached + read + write + output; input_tokens sums all three', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const table = load_prices(p);
        const e = reprice_with_cache(
            'anthropic',
            'claude-sonnet-4-5',
            {
                input_tokens: 1_000_000,
                cache_read_input_tokens: 1_000_000,
                cache_creation_input_tokens: 1_000_000,
                output_tokens: 1_000_000,
            },
            table,
            '5m',
        );
        expect(e.input_usd).toBeCloseTo(7.05, 10); // 3.0 + 0.30 + 3.75
        expect(e.output_usd).toBe(15.0);
        expect(e.input_tokens).toBe(3_000_000);
    });

    it('conservative pre-flight: estimate_cost applies no cache discount', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const table = load_prices(p);
        // Pre-flight bills full input up-front (0% cache-hit assumed) so the
        // budget gate can never under-predict; the realized cost is the lower
        // actual once cache reads are observed.
        const est = estimate_cost('anthropic', 'claude-sonnet-4-5', 1_000_000, 0, table);
        const actual = reprice_with_cache(
            'anthropic',
            'claude-sonnet-4-5',
            { input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 0 },
            table,
        );
        expect(est.input_usd).toBe(3.0);
        expect(actual.input_usd).toBeLessThan(est.input_usd);
    });

    it('unknown model returns zero but still sums input tokens', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const table = load_prices(p);
        const e = reprice_with_cache(
            'anthropic',
            'no-such-model',
            { input_tokens: 10, cache_read_input_tokens: 20, output_tokens: 5 },
            table,
        );
        expect(e.input_usd).toBe(0.0);
        expect(e.input_tokens).toBe(30);
    });
});

// ── realized (cache-aware) vs pre-flight (cache-blind) — orchestrator's
// realized-cost site (Step A) must actually diverge from the estimator, by
// exactly the multiplier arithmetic — never a hardcoded dollar literal. ──

describe('reprice_with_cache vs estimate_cost — realized cost diverges by the multiplier math', () => {
    it('a response with non-zero cache_read + cache_creation prices differently than the cache-blind estimate, by the exact multiplier delta', () => {
        const p = path.join(mkTmp(), 'prices.md');
        bootstrap_from_defaults(p);
        const table = load_prices(p);
        const price = lookup(table, 'anthropic', 'claude-sonnet-4-5');
        expect(price).not.toBeNull();
        const inputRate = (price as { input_per_1m_usd: number }).input_per_1m_usd;

        // Fixture token counts standing in for one real council-member call.
        const inputTokens = 200_000;
        const cacheReadTokens = 300_000;
        const cacheWriteTokens = 50_000;
        const outputTokens = 10_000;

        // Cache-blind pre-flight estimator: everything billed at the full
        // input rate (its deliberate 0%-cache-hit conservative prior).
        const blind = estimate_cost(
            'anthropic',
            'claude-sonnet-4-5',
            inputTokens + cacheReadTokens + cacheWriteTokens,
            outputTokens,
            table,
        );

        const realized5m = reprice_with_cache(
            'anthropic',
            'claude-sonnet-4-5',
            {
                input_tokens: inputTokens,
                cache_read_input_tokens: cacheReadTokens,
                cache_creation_input_tokens: cacheWriteTokens,
                output_tokens: outputTokens,
            },
            table,
            '5m',
        );

        // Expected value derived from the multipliers + fixture counts —
        // never a hardcoded dollar figure.
        const expected5mInputUsd =
            (inputTokens / 1_000_000) * inputRate +
            (cacheReadTokens / 1_000_000) * inputRate * CACHE_READ_MULTIPLIER +
            (cacheWriteTokens / 1_000_000) * inputRate * CACHE_WRITE_MULTIPLIER_5M;

        expect(realized5m.input_usd).toBeCloseTo(expected5mInputUsd, 10);
        expect(realized5m.input_usd).toBeLessThan(blind.input_usd);
        expect(realized5m.input_usd).not.toBeCloseTo(blind.input_usd, 6);

        // Swapping the TTL swaps only the write multiplier — also derived,
        // never a literal — and must move the price in the expected direction
        // (1h write multiplier > 5m write multiplier ⇒ realized1h > realized5m).
        const realized1h = reprice_with_cache(
            'anthropic',
            'claude-sonnet-4-5',
            {
                input_tokens: inputTokens,
                cache_read_input_tokens: cacheReadTokens,
                cache_creation_input_tokens: cacheWriteTokens,
                output_tokens: outputTokens,
            },
            table,
            '1h',
        );
        const expected1hInputUsd =
            (inputTokens / 1_000_000) * inputRate +
            (cacheReadTokens / 1_000_000) * inputRate * CACHE_READ_MULTIPLIER +
            (cacheWriteTokens / 1_000_000) * inputRate * CACHE_WRITE_MULTIPLIER_1H;

        expect(realized1h.input_usd).toBeCloseTo(expected1hInputUsd, 10);
        expect(realized1h.input_usd).toBeGreaterThan(realized5m.input_usd);
    });
});

// ── staleness (UTC Monday boundary) ──────────────────────────────────

describe('last_monday_utc', () => {
    it('on a Wednesday returns the prior Monday', () => {
        // 2026-04-29 is a Wednesday.
        const wed = new Date(Date.UTC(2026, 3, 29, 12, 0, 0));
        expect(last_monday_utc(wed)).toBe('2026-04-27');
    });

    it('on a Monday returns the same date', () => {
        const mon = new Date(Date.UTC(2026, 3, 27, 0, 1, 0));
        expect(last_monday_utc(mon)).toBe('2026-04-27');
    });

    it('on a Sunday returns the previous Monday', () => {
        const sun = new Date(Date.UTC(2026, 4, 3, 23, 0, 0));
        expect(last_monday_utc(sun)).toBe('2026-04-27');
    });
});

describe('is_stale', () => {
    function writeTable(lastUpdated: string): string {
        const p = path.join(mkTmp(), 'prices.md');
        fs.writeFileSync(
            p,
            `---\nlast_updated: ${lastUpdated}\ncurrency: USD\nunit: per_1M_tokens\nsource: shipped-default\n---\n\n` +
                '| provider | model | input | output |\n|---|---|---|---|\n',
            'utf-8',
        );
        return p;
    }

    it('true when last_updated is before last Monday', () => {
        const table = load_prices(writeTable('2026-04-26'));
        const now = new Date(Date.UTC(2026, 3, 29, 12, 0, 0));
        expect(is_stale(table, now)).toBe(true);
    });

    it('false when last_updated is on or after last Monday', () => {
        const table = load_prices(writeTable('2026-04-27'));
        const now = new Date(Date.UTC(2026, 3, 29, 12, 0, 0));
        expect(is_stale(table, now)).toBe(false);
    });

    it('true when last_updated is an invalid date', () => {
        const p = path.join(mkTmp(), 'prices.md');
        fs.writeFileSync(
            p,
            '---\nlast_updated: not-a-date\ncurrency: USD\nunit: per_1M_tokens\nsource: shipped-default\n---\n\n',
            'utf-8',
        );
        const table = load_prices(p);
        expect(is_stale(table)).toBe(true);
    });
});

describe('downgrade_coupling — A1↔A3 cache-coupling gate', () => {
    const table = (() => {
        const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prices-')), '.agent-prices.md');
        bootstrap_from_defaults(p);
        return load_prices(p);
    })();

    it('no cache expected (one-shot) → any cheaper model is net-positive', () => {
        const c = downgrade_coupling(
            'anthropic', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001',
            10_000, 4096,
            { enabled: true, cacheable_prefix_tokens: 10_000, expected_reads: 0 },
            table,
        );
        expect(c.lost_cache_savings_usd).toBe(0);
        expect(c.downgrade_savings_usd).toBeGreaterThan(0);
        expect(c.net_positive).toBe(true);
    });

    it('cache disabled → lost term is 0 regardless of reads', () => {
        const c = downgrade_coupling(
            'anthropic', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001',
            10_000, 4096,
            { enabled: false, cacheable_prefix_tokens: 10_000, expected_reads: 3 },
            table,
        );
        expect(c.lost_cache_savings_usd).toBe(0);
        expect(c.net_positive).toBe(true);
    });

    it('massive cached prefix with many reads can outweigh a small model saving', () => {
        const c = downgrade_coupling(
            'anthropic', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001',
            1_000, 64, // tiny call: little to save by downgrading
            { enabled: true, cacheable_prefix_tokens: 5_000_000, expected_reads: 4 },
            table,
        );
        expect(c.lost_cache_savings_usd).toBeGreaterThan(c.downgrade_savings_usd);
        expect(c.net_positive).toBe(false);
    });

    it('same model both sides → zero savings, never net-positive', () => {
        const c = downgrade_coupling(
            'anthropic', 'claude-sonnet-4-5', 'claude-sonnet-4-5',
            10_000, 4096,
            { enabled: true, cacheable_prefix_tokens: 0, expected_reads: 0 },
            table,
        );
        expect(c.downgrade_savings_usd).toBe(0);
        expect(c.net_positive).toBe(false);
    });
});
