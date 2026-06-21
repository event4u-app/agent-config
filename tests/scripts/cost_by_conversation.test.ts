// Tests for src/scripts/cost_by_conversation.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed, so this is a focused differential suite:
//   1. In-process unit checks of group() + render_text() with crafted rows —
//      exercises conversation bucketing, per-model sub-buckets in first-seen
//      order, the empty-rows path, and the float (`$x.xxxx`) / thousands /
//      signed-delta formatting.
//   2. A golden-parity layer (python3 vs tsx) on the real sessions.jsonl:
//      stdout, stderr, exit code byte-identical for text + json. Read-only — no
//      snapshot/restore needed. Skipped without python3. Aggregated costs come
//      from real data but the script reports no timing/duration fields, so the
//      byte comparison is sound.
import { describe, expect, it } from 'vitest';

import { group, render_text } from '../../src/scripts/cost_by_conversation.js';
import { hasPython3, runPy, runTs } from './_wave8e.js';

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

const py3 = hasPython3();

describe.skipIf(!py3)('cost_by_conversation — golden parity (python3 vs tsx)', () => {
    const cases: Array<{ name: string; args: string[] }> = [
        { name: 'text', args: [] },
        { name: 'json', args: ['--format', 'json'] },
    ];
    it.each(cases)('byte-identical on the real repo ($name)', ({ args }) => {
        const p = runPy('cost_by_conversation', args);
        const t = runTs('cost_by_conversation', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(0);
    });
});
