// Tests for src/scripts/cost_by_conversation.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed, so this is a focused differential suite:
//   1. In-process unit checks of group() + render_text() with crafted rows —
//      exercises conversation bucketing, per-model sub-buckets in first-seen
//      order, the empty-rows path, and the float (`$x.xxxx`) / thousands /
//      signed-delta formatting.
//   2. A CLI layer (tsx subprocess) on a deterministic temp-fixture JSONL —
//      exercises --input / --format arg parsing, the missing-input path, and
//      exit codes end-to-end. Converted from the retired python3-vs-tsx
//      golden parity block (the Python original was deleted); fixtures replace
//      the real sessions.jsonl so output is fully deterministic.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { group, render_text } from '../../src/scripts/cost_by_conversation.js';
import { runTs } from './_wave8e.js';

describe('cost_by_conversation — in-process units', () => {
    it('groups by conversation_id with per-model sub-buckets', () => {
        const rows = [
            { conversation_id: 'c1', total_cost_usd: 0.5, input_tokens: 100, output_tokens: 20, model: 'sonnet' },
            { conversation_id: 'c1', total_cost_usd: 0.25, input_tokens: 50, output_tokens: 10, model: 'opus', telegraph_delta_tokens: -3 },
            { conversation_id: 'c2', total_cost_usd: 1, model: 'sonnet' },
        ];
        const r = group(rows);
        expect([...r.keys()]).toEqual(['c1', 'c2']);
        const c1 = r.get('c1')!;
        expect(c1.sessions).toBe(2);
        expect(c1.total_cost_usd).toBeCloseTo(0.75, 10);
        expect(c1.input_tokens).toBe(150);
        expect(c1.output_tokens).toBe(30);
        expect(c1.telegraph_delta_tokens).toBe(-3);
        // first-seen model order preserved (sonnet before opus)
        expect([...c1.by_model.keys()]).toEqual(['sonnet', 'opus']);
        expect(c1.by_model.get('sonnet')!.cost_usd).toBeCloseTo(0.5, 10);
        expect(c1.by_model.get('opus')!.sessions).toBe(1);
    });

    it('missing conversation_id / model fall back to "unknown"', () => {
        const r = group([{ total_cost_usd: 0.1 }]);
        const c = r.get('unknown')!;
        expect(c.sessions).toBe(1);
        expect([...c.by_model.keys()]).toEqual(['unknown']);
    });

    it('render_text returns no-rows banner for empty input', () => {
        expect(render_text(group([]))).toBe('cost-by-conversation: no rows.\n');
    });

    it('render_text formats cost, thousands, signed delta, and sorts models', () => {
        const r = group([
            { conversation_id: 'c1', total_cost_usd: 1.2345, input_tokens: 1234, output_tokens: 5678, telegraph_delta_tokens: 7, model: 'zeta' },
            { conversation_id: 'c1', total_cost_usd: 0, model: 'alpha' },
        ]);
        const out = render_text(r);
        expect(out).toContain('c1: 2 sessions · $1.2345 · in 1,234 · out 5,678 · telegraph_delta +7');
        // models rendered in sorted order (alpha before zeta)
        const idxAlpha = out.indexOf('alpha:');
        const idxZeta = out.indexOf('zeta:');
        expect(idxAlpha).toBeGreaterThan(-1);
        expect(idxAlpha).toBeLessThan(idxZeta);
        expect(out.endsWith('\n')).toBe(true);
    });
});

describe('cost_by_conversation — CLI on a fixture (tsx)', () => {
    let tmpDir: string;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-by-conv-'));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFixture(): string {
        const p = path.join(tmpDir, 'sessions.jsonl');
        const rows = [
            { sessionId: 's1', conversation_id: 'c1', telegraph_delta_tokens: 42, total_cost_usd: 0.5, input_tokens: 100, output_tokens: 20, model: 'sonnet' },
            { session_id: 's2', conversation_id: 'c1', total_cost_usd: 1, model: 'opus' },
        ];
        fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
        return p;
    }

    it('text format renders the grouped lens deterministically', () => {
        const t = runTs('cost_by_conversation', ['--input', writeFixture()]);
        expect(t.status).toBe(0);
        expect(t.stderr).toBe('');
        expect(t.stdout).toContain('cost-by-conversation lens · grouped by conversation_id');
        expect(t.stdout).toContain('c1: 2 sessions · $1.5000 · in 100 · out 20 · telegraph_delta +42');
        // per-model sub-buckets render sorted (opus before sonnet)
        expect(t.stdout).toContain('opus: 1 sessions · $1.0000');
        expect(t.stdout).toContain('sonnet: 1 sessions · $0.5000');
        expect(t.stdout.indexOf('opus:')).toBeLessThan(t.stdout.indexOf('sonnet:'));
    });

    it('json format emits the schema-versioned structure', () => {
        const t = runTs('cost_by_conversation', ['--input', writeFixture(), '--format', 'json']);
        expect(t.status).toBe(0);
        expect(t.stderr).toBe('');
        const doc = JSON.parse(t.stdout) as {
            schema_version: string;
            by_conversation: Record<string, Record<string, unknown>>;
        };
        expect(doc.schema_version).toBe('cost-by-conversation/v1');
        expect(Object.keys(doc.by_conversation)).toEqual(['c1']);
        const c1 = doc.by_conversation['c1']!;
        expect(c1['sessions']).toBe(2);
        expect(c1['total_cost_usd']).toBe(1.5);
        expect(c1['telegraph_delta_tokens']).toBe(42);
        expect(Object.keys(c1['by_model'] as object)).toEqual(['sonnet', 'opus']);
    });

    it('missing input file → exit 0 + no-rows banner', () => {
        const t = runTs('cost_by_conversation', ['--input', path.join(tmpDir, 'nope.jsonl')]);
        expect(t.status).toBe(0);
        // render_text yields the banner + '\n'; the CLI print adds one more.
        expect(t.stdout).toBe('cost-by-conversation: no rows.\n\n');
    });
});
