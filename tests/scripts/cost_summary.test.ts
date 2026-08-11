// Tests for src/scripts/cost_summary.ts (py2ts Phase 8 / Wave 8e).
//
// No Python pytest suite exists for cost_summary, so this is a focused
// suite: a direct test of aggregate() shape + float rendering, plus a CLI
// layer (tsx subprocess) over temp-fixture JSONL inputs — converted from the
// retired python3-vs-tsx golden parity block (the Python original was
// deleted). `generated_at` is a wall-clock timestamp (non-deterministic) —
// CLI assertions parse the JSON and check fields structurally instead of
// byte-comparing it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { aggregate } from '../../src/scripts/cost_summary.js';
import { runTs } from './_wave8e.js';

let tmpDir: string;
beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-summary-'));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

const SAMPLE_ROWS = [
    {
        sessionId: 's1',
        conversation_id: 'c1',
        model: 'opus',
        total_cost_usd: 1.5,
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 40,
        cache_creation_input_tokens: 10,
    },
    {
        session_id: 's1',
        conversation_id: 'c2',
        model: 'sonnet',
        total_cost_usd: 0.5,
        input_tokens: 20,
        output_tokens: 10,
        cache_read_input_tokens: 5,
    },
    {
        // Legacy-shaped row (no cache fields) — must aggregate as 0, not throw.
        sessionId: 's2',
        model: 'opus',
        total_cost_usd: 2,
        input_tokens: 30,
        output_tokens: 5,
    },
];

function writeJsonl(rows: object[]): string {
    const p = path.join(tmpDir, 'sessions.jsonl');
    fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
    return p;
}

describe('cost_summary — aggregate() differential', () => {
    it('schema + totals + grouping shape', () => {
        const out = aggregate(SAMPLE_ROWS) as Record<string, unknown>;
        expect(out.schema_version).toBe('cost-summary/v1');
        const totals = out.totals as Record<string, unknown>;
        expect(totals.sessions).toBe(3);
        // 1.5 + 0.5 + 2 = 4.0 — PyFloat-wrapped (rendered as 4.0).
        expect((totals.total_cost_usd as { value: number }).value).toBeCloseTo(4.0);
        expect(totals.input_tokens).toBe(150);
        expect(totals.output_tokens).toBe(65);
        // cache fields: 40+5+0=45 read, 10+0+0=10 creation (additive; the
        // third, legacy-shaped row contributes 0 for both, same as a row
        // missing input_tokens contributes 0 there).
        expect(totals.cache_read_input_tokens).toBe(45);
        expect(totals.cache_creation_input_tokens).toBe(10);
        expect(totals.telegraph_delta_tokens).toBe(0);
        expect(totals.telegraph_multiplier_version).toBe('v1');
        expect(totals.telegraph_multiplier_active).toBe(false);

        const bySess = out.by_session as Array<Record<string, unknown>>;
        // sorted by session key: s1 (2 rows), s2 (1 row)
        expect(bySess.map((s) => s.key)).toEqual(['s1', 's2']);
        expect(bySess[0]!.sessions).toBe(2);
        expect(bySess[0]!.cache_read_input_tokens).toBe(45); // 40 + 5, both s1 rows
        expect(bySess[1]!.cache_read_input_tokens).toBe(0); // s2 row is legacy-shaped

        const byModel = out.by_model as Array<Record<string, unknown>>;
        expect(byModel.map((m) => m.model)).toEqual(['opus', 'sonnet']);
        expect(byModel[0]!.sessions).toBe(2); // opus appears twice
        // opus: row1 (read 40, write 10) + row3 (legacy, 0/0) = 40/10.
        expect(byModel[0]!.cache_read_input_tokens).toBe(40);
        expect(byModel[0]!.cache_creation_input_tokens).toBe(10);
        // sonnet: row2 only — read 5, write absent → 0.
        expect(byModel[1]!.cache_read_input_tokens).toBe(5);
        expect(byModel[1]!.cache_creation_input_tokens).toBe(0);
    });

    it('empty input → zero totals', () => {
        const out = aggregate([]) as Record<string, unknown>;
        const totals = out.totals as Record<string, unknown>;
        expect(totals.sessions).toBe(0);
        expect((totals.total_cost_usd as { value: number }).value).toBe(0);
        expect(out.by_session).toEqual([]);
        expect(out.by_conversation).toEqual([]);
        expect(out.by_model).toEqual([]);
    });

    it('missing fields default to unknown / 0', () => {
        const out = aggregate([{ total_cost_usd: 0 }]) as Record<string, unknown>;
        const bySess = out.by_session as Array<Record<string, unknown>>;
        expect(bySess[0]!.key).toBe('unknown');
        const byModel = out.by_model as Array<Record<string, unknown>>;
        expect(byModel[0]!.model).toBe('unknown');
    });
});

describe('cost_summary — CLI on fixtures (tsx)', () => {
    interface Summary {
        schema_version: string;
        generated_at: string;
        totals: Record<string, unknown>;
        by_session: Array<Record<string, unknown>>;
        by_conversation: Array<Record<string, unknown>>;
        by_model: Array<Record<string, unknown>>;
    }

    function runSummary(input: string): { doc: Summary; stdout: string } {
        const t = runTs('cost_summary', ['--input', input]);
        expect(t.status).toBe(0);
        expect(t.stderr).toBe('');
        return { doc: JSON.parse(t.stdout) as Summary, stdout: t.stdout };
    }

    it('populated JSONL → schema, totals, and grouping through the CLI', () => {
        const { doc } = runSummary(writeJsonl(SAMPLE_ROWS));
        expect(doc.schema_version).toBe('cost-summary/v1');
        // generated_at is wall-clock — assert shape only, never the value.
        expect(doc.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(doc.totals['sessions']).toBe(3);
        expect(doc.totals['total_cost_usd']).toBe(4.0);
        expect(doc.totals['input_tokens']).toBe(150);
        expect(doc.totals['output_tokens']).toBe(65);
        expect(doc.by_session.map((s) => s['key'])).toEqual(['s1', 's2']);
        expect(doc.by_conversation.map((c) => c['key'])).toEqual(['c1', 'c2', 'unknown']);
        expect(doc.by_model.map((m) => m['model'])).toEqual(['opus', 'sonnet']);
    });

    it('missing input file → empty summary, exit 0', () => {
        const { doc } = runSummary(path.join(tmpDir, 'does-not-exist.jsonl'));
        expect(doc.totals['sessions']).toBe(0);
        expect(doc.by_session).toEqual([]);
        expect(doc.by_conversation).toEqual([]);
        expect(doc.by_model).toEqual([]);
    });

    it('JSONL with blank lines, comments, and a bad line → bad rows skipped', () => {
        const p = path.join(tmpDir, 'messy.jsonl');
        fs.writeFileSync(
            p,
            [
                '# a comment',
                '',
                JSON.stringify({ sessionId: 'x', model: 'm', total_cost_usd: 0.1, input_tokens: 1 }),
                'not json at all',
                JSON.stringify({ sessionId: 'y', model: 'm', total_cost_usd: 0.2, output_tokens: 2 }),
                '   ',
            ].join('\n') + '\n',
            'utf-8',
        );
        const { doc } = runSummary(p);
        // only the two valid rows count
        expect(doc.totals['sessions']).toBe(2);
        expect(doc.by_session.map((s) => s['key'])).toEqual(['x', 'y']);
        expect(doc.totals['input_tokens']).toBe(1);
        expect(doc.totals['output_tokens']).toBe(2);
    });

    it('integer-valued cost renders with trailing .0 (PyFloat rendering)', () => {
        const p = writeJsonl([
            { sessionId: 's', model: 'm', total_cost_usd: 3, input_tokens: 0, output_tokens: 0 },
        ]);
        const { stdout } = runSummary(p);
        expect(stdout).toContain('"total_cost_usd": 3.0');
    });
});

// ── cache savings + by_date (ledger-truth 3.1 / 3.2) ──────────────────
//
// Both are additive v1 extensions per the schema's own rule: they add keys and
// change no existing one, so a consumer pinned to cost-summary/v1 keeps
// reading every field it read before.
describe('cost_summary — cache savings (3.1)', () => {
    it('nets the read discount against the write premium, in input-token equivalents', () => {
        // 45 read tokens billed at 0.1x saved 0.9 of an input token each;
        // 10 written tokens cost an extra 0.25 each. 40.5 - 2.5 = 38.
        const totals = (aggregate(SAMPLE_ROWS) as Record<string, Record<string, unknown>>)['totals']!;
        expect(totals['cache_savings_input_token_equivalents']).toBe(38);
    });

    it('goes NEGATIVE when a run writes cache it never reads back — the premium is real', () => {
        const rows = [{ sessionId: 's', model: 'opus', total_cost_usd: 0, cache_creation_input_tokens: 1000 }];
        const totals = (aggregate(rows) as Record<string, Record<string, unknown>>)['totals']!;
        expect(totals['cache_savings_input_token_equivalents']).toBe(-250);
    });

    it('is 0 on a corpus with no cache activity at all', () => {
        const rows = [{ sessionId: 's', model: 'opus', total_cost_usd: 1, input_tokens: 10 }];
        const totals = (aggregate(rows) as Record<string, Record<string, unknown>>)['totals']!;
        expect(totals['cache_savings_input_token_equivalents']).toBe(0);
    });
});

describe('cost_summary — by_date (3.2)', () => {
    const DATED = [
        { sessionId: 'a', model: 'opus', total_cost_usd: 1, input_tokens: 10, startedAt: '2026-08-09T23:30:00.000Z' },
        { sessionId: 'b', model: 'opus', total_cost_usd: 2, input_tokens: 20, startedAt: '2026-08-10T01:00:00.000Z' },
        { sessionId: 'c', model: 'opus', total_cost_usd: 4, input_tokens: 30, startedAt: '2026-08-10T22:00:00.000Z' },
    ];

    it('groups by UTC calendar day and orders ascending', () => {
        const out = aggregate(DATED) as Record<string, unknown>;
        const rows = out['by_date'] as Array<Record<string, unknown>>;
        expect(rows.map((r) => r['key'])).toEqual(['2026-08-09', '2026-08-10']);
        expect(rows[1]!['sessions']).toBe(2);
        expect(rows[1]!['input_tokens']).toBe(50);
        expect((rows[1]!['total_cost_usd'] as { value: number }).value).toBeCloseTo(6.0);
    });

    it("a row with no or unparseable timestamp lands in 'unknown', which sorts last", () => {
        const out = aggregate([
            ...DATED,
            { sessionId: 'd', model: 'opus', total_cost_usd: 1 },
            { sessionId: 'e', model: 'opus', total_cost_usd: 1, startedAt: 'not-a-date' },
        ]) as Record<string, unknown>;
        const keys = (out['by_date'] as Array<Record<string, unknown>>).map((r) => r['key']);
        expect(keys).toEqual(['2026-08-09', '2026-08-10', 'unknown']);
    });

    it('totals stay identical to the pre-extension aggregation — grouping never double-counts', () => {
        const out = aggregate(DATED) as Record<string, Record<string, unknown>>;
        const dateSum = (out['by_date'] as unknown as Array<Record<string, number>>).reduce(
            (s, r) => s + r['input_tokens']!,
            0,
        );
        expect(dateSum).toBe(out['totals']!['input_tokens']);
        expect(out['totals']!['sessions']).toBe(3);
    });
});

// ── rate_missing propagation (R2 review, finding 2) ───────────────────
//
// `cost/track.mjs` writes `rate_missing` into the very JSONL this schema
// describes. Aggregating past it would report an understated total_cost_usd
// unqualified — the same silent zero the row-level flag removes, one layer up.
describe('cost_summary — rate_missing qualification', () => {
    const FLAGGED = [
        {
            sessionId: 's1',
            conversation_id: 'c1',
            model: 'mystery-model',
            total_cost_usd: 0,
            input_tokens: 100,
            startedAt: '2026-08-10T10:00:00.000Z',
            rate_missing: true,
            rate_missing_models: ['mystery-model'],
        },
        {
            sessionId: 's2',
            conversation_id: 'c2',
            model: 'claude-sonnet-4-5',
            total_cost_usd: 3,
            input_tokens: 100,
            startedAt: '2026-08-10T11:00:00.000Z',
        },
    ];

    it('counts flagged rows and unions their unpriced ids on totals', () => {
        const totals = (aggregate(FLAGGED) as Record<string, Record<string, unknown>>)['totals']!;
        expect(totals['rate_missing_sessions']).toBe(1);
        expect(totals['rate_missing_models']).toEqual(['mystery-model']);
    });

    it('propagates the count into every grouping the flagged row lands in', () => {
        const out = aggregate(FLAGGED) as Record<string, unknown>;
        const pick = (arr: string, key: string) =>
            (out[arr] as Array<Record<string, unknown>>).find(
                (r) => r['key'] === key || r['model'] === key,
            )!;
        expect(pick('by_session', 's1')['rate_missing_sessions']).toBe(1);
        expect(pick('by_session', 's2')['rate_missing_sessions']).toBe(0);
        expect(pick('by_conversation', 'c1')['rate_missing_sessions']).toBe(1);
        expect(pick('by_model', 'mystery-model')['rate_missing_sessions']).toBe(1);
        // Both rows share a day, so the day bucket is qualified too.
        expect(pick('by_date', '2026-08-10')['rate_missing_sessions']).toBe(1);
    });

    it('an unflagged corpus reads 0 / [] — the same absent-reading as the cache fields', () => {
        const totals = (aggregate(SAMPLE_ROWS) as Record<string, Record<string, unknown>>)['totals']!;
        expect(totals['rate_missing_sessions']).toBe(0);
        expect(totals['rate_missing_models']).toEqual([]);
    });

    it('a malformed rate_missing_models field is skipped, never coerced or thrown on', () => {
        const rows = [
            { sessionId: 's', model: 'm', total_cost_usd: 0, rate_missing: true, rate_missing_models: 'not-a-list' },
            { sessionId: 't', model: 'm', total_cost_usd: 0, rate_missing: true, rate_missing_models: [42, '', 'real-id'] },
        ];
        const totals = (aggregate(rows) as Record<string, Record<string, unknown>>)['totals']!;
        expect(totals['rate_missing_sessions']).toBe(2);
        expect(totals['rate_missing_models']).toEqual(['real-id']);
    });
});
