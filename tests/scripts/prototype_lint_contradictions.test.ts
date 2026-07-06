// Tests for src/scripts/prototype_lint_contradictions.ts (py2ts Phase 8 / 8g).
//
// CLI intent tests. The script has NO injectable SRC seam
// (SRC = REPO/.agent-src.uncondensed is derived from the script location), so
// the tests run against whatever that live tree contains and assert the
// tree-independent invariants of the CLI contract:
//   - exit code ⇔ flag count (0 when no flags, 1 when any),
//   - the report JSON shape (insertion-ordered keys, acceptance block,
//     python-float ".0" repr for max_seconds),
//   - well-formed flag records when any are present.
// `elapsed_seconds` is intrinsically non-deterministic wall-clock and is only
// type-checked, never value-asserted.
import { describe, expect, it } from 'vitest';

import { runTs } from './_wave8g.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse(out: string): any {
    return JSON.parse(out);
}

describe('prototype_lint_contradictions — CLI (tsx)', () => {
    it('exit code is consistent with the emitted flag count', () => {
        const r = runTs('prototype_lint_contradictions', []);
        const report = parse(r.stdout);
        expect(typeof report.artifacts_scanned).toBe('number');
        expect(report.artifacts_scanned).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(report.flags)).toBe(true);
        // Exit code ⇔ flag count.
        expect(r.status).toBe(report.flags.length === 0 ? 0 : 1);
        // Every emitted flag is a well-formed record.
        for (const f of report.flags as Array<Record<string, unknown>>) {
            expect(typeof f.type).toBe('string');
            expect(typeof f.artifact_a).toBe('string');
            expect(typeof f.artifact_b).toBe('string');
            expect(typeof f.evidence).toBe('string');
        }
    });

    it('report shape: keys, acceptance block, float ".0" repr', () => {
        const ts = runTs('prototype_lint_contradictions', []);
        const tj = parse(ts.stdout);
        // Insertion-ordered keys (json.dump, NO sort_keys).
        expect(Object.keys(tj)).toEqual(['artifacts_scanned', 'elapsed_seconds', 'flags', 'acceptance']);
        expect(Object.keys(tj.acceptance)).toEqual(['min_flags', 'max_seconds', 'passed']);
        expect(tj.acceptance.min_flags).toBe(3);
        // max_seconds is a Python float 5.0 → must serialize with the ".0".
        expect(ts.stdout).toContain('"max_seconds": 5.0');
        expect(typeof tj.acceptance.passed).toBe('boolean');
        // elapsed_seconds is a float → always a number (possibly 0.0).
        expect(typeof tj.elapsed_seconds).toBe('number');
    });
});
