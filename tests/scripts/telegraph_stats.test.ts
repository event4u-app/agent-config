// Tests for src/scripts/telegraph_stats.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed, so this is a focused differential suite:
//   1. In-process unit checks of the pure functions (aggregate, render_text)
//      with crafted rows — exercises the suspended-multiplier guard (delta=0),
//      multi-session / multi-conversation bucketing, and the SUSPENDED note.
//   2. A golden-parity layer (python3 vs tsx) on the real sessions.jsonl:
//      stdout, stderr, exit code byte-identical for text + json. Read-only — the
//      script never writes, so no snapshot/restore is needed. Skipped without
//      python3. Measured/aggregated counts come from real data, but the script
//      excludes timing entirely (delta is a deterministic 0 while suspended),
//      so byte-comparison is sound here.
import { describe, expect, it } from 'vitest';

import { aggregate, render_text } from '../../src/scripts/telegraph_stats.js';
import { hasPython3, runPy, runTs } from './_wave8e.js';

describe('telegraph_stats — in-process units', () => {
    it('aggregate buckets by session + conversation; delta=0 while suspended', () => {
        const rows = [
            { sessionId: 's1', conversation_id: 'c1', telegraph_condensed_tokens: 100, telegraph_delta_tokens: 42 },
            { sessionId: 's1', conversation_id: 'c2', telegraph_condensed_tokens: 50 },
            { session_id: 's2', conversation_id: 'c1', telegraph_condensed_tokens: 10 },
        ];
        const r = aggregate(rows);
        // MULTIPLIER_ACTIVE is false → every delta is 0 regardless of explicit field.
        expect(r.lifetime.sessions).toBe(3);
        expect(r.lifetime.delta_tokens).toBe(0);
        expect(r.lifetime.condensed_tokens).toBe(160);
        expect(r.by_session.get('s1')!.sessions).toBe(2);
        expect(r.by_session.get('s1')!.condensed_tokens).toBe(150);
        expect(r.by_session.get('s2')!.condensed_tokens).toBe(10);
        expect(r.by_conversation.get('c1')!.sessions).toBe(2);
        expect(r.by_conversation.get('c1')!.condensed_tokens).toBe(110);
        expect(r.multiplier_active).toBe(false);
    });

    it('missing ids fall back to "unknown"', () => {
        const r = aggregate([{ telegraph_condensed_tokens: 7 }]);
        expect(r.by_session.get('unknown')!.condensed_tokens).toBe(7);
        expect(r.by_conversation.get('unknown')!.condensed_tokens).toBe(7);
    });

    it('render_text carries the suspended note + header shape', () => {
        const r = aggregate([{ sessionId: 's1', conversation_id: 'c1', telegraph_condensed_tokens: 1234 }]);
        const out = render_text(r);
        expect(out).toContain('telegraph-stats telegraph-stats/v1 · multiplier v1 (SUSPENDED) · value 0.9155');
        expect(out).toContain('condensed_tokens = 1,234');
        expect(out).toContain('multiplier suspended');
        expect(out.endsWith('\n')).toBe(true);
    });

    it('signed delta renders +0 while suspended', () => {
        const r = aggregate([{ conversation_id: 'cX', telegraph_condensed_tokens: 5 }]);
        const out = render_text(r);
        expect(out).toContain('delta = +0 · condensed = 5');
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('telegraph_stats — golden parity (python3 vs tsx)', () => {
    const cases: Array<{ name: string; args: string[] }> = [
        { name: 'text', args: [] },
        { name: 'json', args: ['--format', 'json'] },
    ];
    it.each(cases)('byte-identical on the real repo ($name)', ({ args }) => {
        const p = runPy('telegraph_stats', args);
        const t = runTs('telegraph_stats', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(0);
    });
});
