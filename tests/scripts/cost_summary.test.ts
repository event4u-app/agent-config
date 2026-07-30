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
