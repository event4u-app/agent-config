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
    bootstrap_from_defaults,
    estimate_cost,
    estimate_input_tokens,
    is_stale,
    last_monday_utc,
    load_prices,
    lookup,
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
