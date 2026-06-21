// Tests for src/scripts/cost_summary.ts (py2ts Phase 8 / Wave 8e).
//
// No Python pytest suite exists for cost_summary, so this is a focused
// differential: a direct test of aggregate() shape + float rendering, plus
// a golden-parity layer (python3 vs tsx) over temp-fixture JSONL inputs.
// `generated_at` is a wall-clock timestamp (non-deterministic) — it is
// stripped before byte-comparison.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { aggregate } from '../../src/scripts/cost_summary.js';
import { hasPython3, runPy, runTs } from './_wave8e.js';

const py3 = hasPython3();

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
    },
    {
        session_id: 's1',
        conversation_id: 'c2',
        model: 'sonnet',
        total_cost_usd: 0.5,
        input_tokens: 20,
        output_tokens: 10,
    },
    {
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
        expect(totals.telegraph_delta_tokens).toBe(0);
        expect(totals.telegraph_multiplier_version).toBe('v1');
        expect(totals.telegraph_multiplier_active).toBe(false);

        const bySess = out.by_session as Array<Record<string, unknown>>;
        // sorted by session key: s1 (2 rows), s2 (1 row)
        expect(bySess.map((s) => s.key)).toEqual(['s1', 's2']);
        expect(bySess[0]!.sessions).toBe(2);

        const byModel = out.by_model as Array<Record<string, unknown>>;
        expect(byModel.map((m) => m.model)).toEqual(['opus', 'sonnet']);
        expect(byModel[0]!.sessions).toBe(2); // opus appears twice
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

describe.skipIf(!py3)('cost_summary — golden parity (python3 vs tsx)', () => {
    // generated_at is wall-clock — strip the line before comparison.
    function stripGeneratedAt(s: string): string {
        return s
            .split('\n')
            .filter((line) => !line.trimStart().startsWith('"generated_at"'))
            .join('\n');
    }

    function bothEqual(input: string): void {
        const p = runPy('cost_summary', ['--input', input]);
        const t = runTs('cost_summary', ['--input', input]);
        expect(stripGeneratedAt(t.stdout)).toBe(stripGeneratedAt(p.stdout));
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
    }

    it('populated JSONL → identical (generated_at excluded)', () => {
        bothEqual(writeJsonl(SAMPLE_ROWS));
    });

    it('missing input file → identical empty summary', () => {
        bothEqual(path.join(tmpDir, 'does-not-exist.jsonl'));
    });

    it('JSONL with blank lines, comments, and a bad line → identical', () => {
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
        bothEqual(p);
    });

    it('integer-valued cost renders with trailing .0 (PyFloat parity)', () => {
        const p = writeJsonl([
            { sessionId: 's', model: 'm', total_cost_usd: 3, input_tokens: 0, output_tokens: 0 },
        ]);
        const py = runPy('cost_summary', ['--input', p]);
        const ts = runTs('cost_summary', ['--input', p]);
        expect(ts.stdout).toContain('"total_cost_usd": 3.0');
        expect(stripGeneratedAt(ts.stdout)).toBe(stripGeneratedAt(py.stdout));
    });
});
