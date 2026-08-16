// Tests for src/scripts/cost/backfill_rates.mjs — the re-pricing pass for rows
// `track.mjs` flagged `rate_missing` (inbox-harvest-2026-08-b-ledger-truth 2.5).
//
// 2.4 keeps the token counts of an unpriced model precisely so the cost can be
// repaired later; this is that repair. The fixtures below are the shape of a
// REAL flagged row, read off this repo's own transcripts on 2026-08-16 — the
// per-model tally with `tier: "unknown"` and `cost_usd: 0`, a second unpriced
// id carrying zero billable tokens (`<synthetic>`, which the producer
// deliberately does not flag), and a priced model alongside it.
//
// Unlike track.mjs this module exports its core and guards its own entry, so
// the unit half imports directly; the CLI half still runs as a subprocess,
// because the dry-run-vs-`--apply` contract is only observable there.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// @ts-expect-error — plain .mjs module, no type declarations by design.
import { backfillRow } from '../../src/scripts/cost/backfill_rates.mjs';

const SCRIPT = path.resolve(__dirname, '../../src/scripts/cost/backfill_rates.mjs');
const tmps: string[] = [];

afterEach(() => {
    for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-backfill-'));
    tmps.push(d);
    return d;
}

interface ModelEntry {
    tier: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    messages: number;
    cost_usd: number;
}

interface LedgerRow {
    sessionId: string;
    byModel: Record<string, ModelEntry>;
    byTier: Record<string, number>;
    byBucket: Record<string, Record<string, number>>;
    total_cost_usd: number;
    rate_missing: boolean;
    rate_missing_models: string[];
    rate_backfill?: Record<string, unknown>[];
}

/** The observed flagged-row shape, reduced to round numbers. */
function flaggedRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
    return {
        sessionId: 'sess-fixture',
        byModel: {
            'claude-fable-5': {
                tier: 'unknown',
                input_tokens: 1_000_000,
                output_tokens: 1_000_000,
                cache_creation_input_tokens: 1_000_000,
                cache_read_input_tokens: 1_000_000,
                messages: 10,
                cost_usd: 0,
            },
            '<synthetic>': {
                tier: 'unknown',
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
                messages: 4,
                cost_usd: 0,
            },
            'claude-opus-5': {
                tier: 'opus',
                input_tokens: 0,
                output_tokens: 100_000,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
                messages: 5,
                cost_usd: 7.5,
            },
        },
        byTier: { haiku: 0, sonnet: 0, opus: 7.5, unknown: 0 },
        byBucket: {
            main: { messages: 10, input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cost_usd: 0 },
            subagent: { messages: 9, input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cost_usd: 7.5 },
        },
        total_cost_usd: 7.5,
        rate_missing: true,
        rate_missing_models: ['claude-fable-5'],
        ...overrides,
    };
}

/** opus rates: input 15, output 75, cache_write_5m 18.75, cache_read 1.5 — 1M each. */
const OPUS_ALIAS = { 'claude-fable-5': { tier: 'opus', rates: { input: 15, output: 75, cache_write_5m: 18.75, cache_write_1h: 30, cache_read: 1.5 } } };

describe('backfillRow', () => {
    it('re-prices a flagged model from the token counts the row kept', () => {
        const row = flaggedRow();
        const repairs = backfillRow(row, OPUS_ALIAS);

        // Derived from the fixture, not hardcoded from a previous run:
        // 1M each at 15 + 75 + 18.75 + 1.5.
        const expected = 15 + 75 + 18.75 + 1.5;
        expect(repairs).toHaveLength(1);
        expect(row.byModel['claude-fable-5']!.cost_usd).toBeCloseTo(expected, 6);
        expect(row.total_cost_usd).toBeCloseTo(7.5 + expected, 6);
        expect(row.byTier.opus).toBeCloseTo(7.5 + expected, 6);
        expect(row.byModel['claude-fable-5']!.tier).toBe('opus');
    });

    it('clears the flag only when nothing unpriced remains', () => {
        const row = flaggedRow();
        backfillRow(row, OPUS_ALIAS);
        expect(row.rate_missing).toBe(false);
        expect(row.rate_missing_models).toEqual([]);
    });

    it('keeps the flag for a second unpriced id no rate was supplied for', () => {
        const row = flaggedRow({ rate_missing_models: ['claude-fable-5', 'some-other-model'] });
        row.byModel['some-other-model'] = { tier: 'unknown', input_tokens: 500, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, messages: 1, cost_usd: 0 };

        backfillRow(row, OPUS_ALIAS);

        // A row re-priced for one model and not another is still understated.
        expect(row.rate_missing).toBe(true);
        expect(row.rate_missing_models).toEqual(['some-other-model']);
    });

    it('leaves an unflagged row untouched', () => {
        const row = flaggedRow({ rate_missing: false, rate_missing_models: [] });
        const before = JSON.stringify(row);
        expect(backfillRow(row, OPUS_ALIAS)).toEqual([]);
        expect(JSON.stringify(row)).toBe(before);
    });

    it('does not re-price a flagged id with zero billable tokens', () => {
        // `<synthetic>` is the observed shape: tier unknown, no tokens. The
        // producer does not flag it; if it ever appeared in the list, pricing
        // it would claim an understatement that is not there.
        const row = flaggedRow({ rate_missing_models: ['<synthetic>'] });
        const rates = { '<synthetic>': OPUS_ALIAS['claude-fable-5'] };

        expect(backfillRow(row, rates)).toEqual([]);
        expect(row.byModel['<synthetic>']!.cost_usd).toBe(0);
        expect(row.total_cost_usd).toBe(7.5);
    });

    it('is idempotent — a second pass over an already-backfilled row adds nothing', () => {
        const row = flaggedRow();
        backfillRow(row, OPUS_ALIAS);
        const afterFirst = { total: row.total_cost_usd, tier: row.byTier.opus };

        // Force the flag back on with the same model still listed: without the
        // rate_backfill guard this double-counts.
        row.rate_missing = true;
        row.rate_missing_models = ['claude-fable-5'];
        expect(backfillRow(row, OPUS_ALIAS)).toEqual([]);

        expect(row.total_cost_usd).toBe(afterFirst.total);
        expect(row.byTier.opus).toBe(afterFirst.tier);
        expect(row.rate_backfill).toHaveLength(1);
    });

    it('records the two honest limits as provenance on the row', () => {
        const row = flaggedRow();
        backfillRow(row, OPUS_ALIAS);
        const entry = row.rate_backfill![0]!;

        expect(entry.model).toBe('claude-fable-5');
        expect(entry.cache_ttl_assumed).toBe('5m');
        expect(entry.bucket_split_repaired).toBe(false);
        expect(typeof entry.at).toBe('string');
    });

    it('does not touch byBucket — the row carries no per-bucket-per-model tokens', () => {
        const row = flaggedRow();
        const before = JSON.stringify(row.byBucket);
        backfillRow(row, OPUS_ALIAS);
        expect(JSON.stringify(row.byBucket)).toBe(before);
    });
});

describe('backfill_rates.mjs CLI', () => {
    function run(args: string[], env: Record<string, string> = {}) {
        return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf-8', env: { ...process.env, ...env } });
    }

    function ledger(dir: string, rows: unknown[]): string {
        const p = path.join(dir, 'sessions.jsonl');
        fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
        return p;
    }

    function rates(dir: string, table: unknown): string {
        const p = path.join(dir, 'rates.json');
        fs.writeFileSync(p, JSON.stringify(table));
        return p;
    }

    it('dry-runs by default and does not write the ledger', () => {
        const d = tmpdir();
        const store = ledger(d, [flaggedRow()]);
        const before = fs.readFileSync(store, 'utf-8');

        const r = run(['--rates', rates(d, { 'claude-fable-5': 'opus' }), '--store', store]);

        expect(r.status).toBe(0);
        expect(r.stdout).toContain('DRY RUN');
        expect(fs.readFileSync(store, 'utf-8')).toBe(before);
    });

    it('writes the re-priced ledger under --apply', () => {
        const d = tmpdir();
        const store = ledger(d, [flaggedRow()]);

        const r = run(['--rates', rates(d, { 'claude-fable-5': 'opus' }), '--store', store, '--apply']);

        expect(r.status).toBe(0);
        expect(r.stdout).toContain('APPLIED');
        const written = JSON.parse(fs.readFileSync(store, 'utf-8').trim());
        expect(written.rate_missing).toBe(false);
        expect(written.total_cost_usd).toBeGreaterThan(7.5);
    });

    it('rejects an unknown tier alias by name instead of defaulting a rate', () => {
        const d = tmpdir();
        const store = ledger(d, [flaggedRow()]);

        const r = run(['--rates', rates(d, { 'claude-fable-5': 'platinum' }), '--store', store]);

        expect(r.status).toBe(2);
        expect(r.stderr).toContain('unknown tier alias');
        expect(r.stderr).toContain('platinum');
    });

    it('rejects an explicit rate table missing a key, naming the key', () => {
        const d = tmpdir();
        const store = ledger(d, [flaggedRow()]);
        const partial = { 'claude-fable-5': { input: 1, output: 2, cache_write_5m: 3, cache_read: 4 } };

        const r = run(['--rates', rates(d, partial), '--store', store]);

        expect(r.status).toBe(2);
        expect(r.stderr).toContain('cache_write_1h');
    });

    it('exits 2 when the ledger or the rates file is absent', () => {
        const d = tmpdir();
        const store = ledger(d, [flaggedRow()]);

        expect(run(['--rates', path.join(d, 'nope.json'), '--store', store]).status).toBe(2);
        expect(run(['--rates', rates(d, { x: 'opus' }), '--store', path.join(d, 'nope.jsonl')]).status).toBe(2);
    });

    it('preserves a malformed ledger line verbatim rather than dropping it', () => {
        const d = tmpdir();
        const store = path.join(d, 'sessions.jsonl');
        fs.writeFileSync(store, `not json\n${JSON.stringify(flaggedRow())}\n`);

        const r = run(['--rates', rates(d, { 'claude-fable-5': 'opus' }), '--store', store, '--apply']);

        expect(r.status).toBe(0);
        expect(fs.readFileSync(store, 'utf-8').split('\n')[0]).toBe('not json');
    });

    it('reports both honest limits in every run', () => {
        const d = tmpdir();
        const store = ledger(d, [flaggedRow()]);

        const r = run(['--rates', rates(d, { 'claude-fable-5': 'opus' }), '--store', store]);

        expect(r.stdout).toContain('5m');
        expect(r.stdout).toContain('byBucket');
    });
});
