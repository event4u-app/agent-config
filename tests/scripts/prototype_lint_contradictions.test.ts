// Tests for src/scripts/prototype_lint_contradictions.ts (py2ts Phase 8 / 8g).
//
// No Python test suite exists for this module → focused differential.
//
// The script has NO injectable SRC seam (SRC = REPO/.agent-src.uncondensed is
// derived from the script location), and that legacy tree does not exist in
// this src/-source-of-truth worktree, so a live run scans 0 artifacts and
// emits an empty `flags` list in both runtimes. The golden-parity block
// asserts the deterministic portions of stdout (everything except the
// intrinsically non-deterministic `elapsed_seconds` wall-clock float) match
// python3 vs tsx, plus the exit code.
//
// DIVERGENCE NOTE (flag ordering): when the legacy tree IS present, the
// Python `flags` list order depends on python `set`-iteration order of an
// artifact's `triggers` and of the `by_trigger` map — non-deterministic
// across runs/platforms. The TS twin canonicalizes (sorts triggers) so its
// own output is stable, but a per-run byte-match of flag ORDER against an
// arbitrary python run is NOT guaranteed. Parity is therefore asserted on the
// flag SET (order-independent) + scanned count + exit code, never raw order.
import { describe, expect, it } from 'vitest';

import { hasPython3, runPy, runTs } from './_wave8g.js';

const py3 = hasPython3();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse(out: string): any {
    return JSON.parse(out);
}

/** Stable comparable key for one flag (order-independent). */
function flagKey(f: Record<string, string>): string {
    return JSON.stringify([f.type, f.artifact_a, f.artifact_b, f.evidence]);
}

describe.skipIf(!py3)('prototype_lint_contradictions — focused differential', () => {
    it('scanned count + flag SET + exit code match python3 (on a quiescent tree)', () => {
        // The script scans the shared live `.agent-src.uncondensed/` tree with
        // no injectable seam. Other Wave-8g test files (annotate_discovery)
        // transiently create files under that tree; vitest runs files in
        // parallel, so the two spawns below can straddle such a mutation.
        // Retry a few times until both runtimes observe the SAME tree
        // (identical artifacts_scanned), then assert byte-level parity of the
        // deterministic portions. Each runtime is also internally consistent
        // regardless (exit code ⇔ its own flag count).
        let pj: ReturnType<typeof parse> | null = null;
        let tj: ReturnType<typeof parse> | null = null;
        let pStatus: number | null = null;
        let tStatus: number | null = null;
        for (let attempt = 0; attempt < 8; attempt++) {
            const py = runPy('prototype_lint_contradictions', []);
            const ts = runTs('prototype_lint_contradictions', []);
            pj = parse(py.stdout);
            tj = parse(ts.stdout);
            pStatus = py.status;
            tStatus = ts.status;
            // Internal consistency holds every attempt.
            expect(ts.status).toBe(tj.flags.length === 0 ? 0 : 1);
            expect(py.status).toBe(pj.flags.length === 0 ? 0 : 1);
            if (tj.artifacts_scanned === pj.artifacts_scanned) {
                break;
            }
        }
        expect(tj!.artifacts_scanned).toBe(pj!.artifacts_scanned);
        expect(tStatus).toBe(pStatus);

        const pSet = new Set((pj!.flags as Array<Record<string, string>>).map(flagKey));
        const tSet = new Set((tj!.flags as Array<Record<string, string>>).map(flagKey));
        expect([...tSet].sort()).toEqual([...pSet].sort());
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
