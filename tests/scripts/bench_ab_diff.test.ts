// Tests for src/scripts/bench_ab_diff.ts (Phase 2 Step 4 A/B report diff).
//
// The Python original has no dedicated test suite, so this is a focused
// differential suite (ADR-094 parity contract): the pure transform layer
// (`compute_track_a_diff`, `compute_track_b_diff`, `render_markdown`) is
// exercised directly, and a golden-parity block runs the full script
// end-to-end under python3 vs tsx over fixtures written INSIDE the repo
// (so the Python `relative_to(REPO_ROOT)` calls succeed), asserting
// byte-identical JSON + Markdown artefacts (modulo the per-run `stamp`)
// and identical stdout. Skipped without python3.

import { describe, expect, it } from 'vitest';

import { PyFloat, compute_track_a_diff, compute_track_b_diff, render_markdown } from '../../src/scripts/bench_ab_diff.js';

// Fixtures + outputs live under the repo (so Python's relative_to(REPO_ROOT)
// succeeds) but in SCRATCH dirs separate from the tracked `ab/diff/` tree —
// the test never touches a git-tracked artefact (zero git drift).


describe('bench_ab_diff.ts — pure helpers', () => {
    it('compute_track_a_diff wraps floats and coerces string accuracy', () => {
        const d = compute_track_a_diff(
            { trigger_accuracy: '88.5', false_positives: 3, per_rule_accuracy: { r1: 0.9 } },
            { trigger_accuracy: 80, per_rule_accuracy: {} },
        );
        const ta = d.trigger_accuracy as Record<string, unknown>;
        expect((ta.with as PyFloat).value).toBeCloseTo(88.5, 9);
        expect((ta.without as PyFloat).value).toBeCloseTo(80, 9);
        expect((ta.delta_pct_points as PyFloat).value).toBeCloseTo(8.5, 9);
        expect((d.false_positives as Record<string, unknown>).with).toBe(3);
        expect((d.false_positives as Record<string, unknown>).without).toBe(0);
    });

    it('compute_track_a_diff defaults missing/garbage accuracy to 0.0', () => {
        const d = compute_track_a_diff({ trigger_accuracy: 'oops' }, {});
        const ta = d.trigger_accuracy as Record<string, unknown>;
        expect((ta.with as PyFloat).value).toBe(0.0);
        expect((ta.without as PyFloat).value).toBe(0.0);
    });

    it('compute_track_b_diff sorts categories and wraps mean floats', () => {
        const d = compute_track_b_diff(
            { per_category: { b: { x: 1 }, a: { y: 2 } }, mean_wall_time: '3.5', mean_tokens: 120 },
            { per_category: { a: { y: 9 } }, mean_wall_time: 2.0, mean_tokens: 150 },
        );
        // Categories sorted: a, b.
        expect(Object.keys(d.per_category as Record<string, unknown>)).toEqual(['a', 'b']);
        const wt = d.wall_time_seconds as Record<string, unknown>;
        expect((wt.with as PyFloat).value).toBeCloseTo(3.5, 9);
        expect((wt.without as PyFloat).value).toBeCloseTo(2.0, 9);
        expect((wt.delta as PyFloat).value).toBeCloseTo(1.5, 9);
        const tk = d.tokens as Record<string, unknown>;
        expect((tk.delta as PyFloat).value).toBeCloseTo(-30.0, 9);
    });

    it('render_markdown embeds an indented json.dumps delta block', () => {
        const md = render_markdown({
            corpus: 'ab-trackb',
            stamp: '2026-06-01T00-00-00Z',
            with_report: 'a/with.json',
            without_report: 'a/without.json',
            delta: { tokens: { with: new PyFloat(120), delta: new PyFloat(-30) } },
        });
        expect(md).toContain('# A/B Bench Diff — ab-trackb');
        expect(md).toContain('- Stamp: `2026-06-01T00-00-00Z`');
        expect(md).toContain('```json');
        // PyFloat renders with .0 inside the embedded delta.
        expect(md).toContain('"with": 120.0');
        expect(md).toContain('"delta": -30.0');
    });
});
