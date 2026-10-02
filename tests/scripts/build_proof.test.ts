/**
 * Tests for src/scripts/build_proof.ts — the generated proof page (B4).
 *
 * Non-mutating: exercises the pure `render()` (reads the real docs/CLAIMS.md)
 * for determinism + required structure, and asserts the committed docs/proof.md
 * is in sync (the drift guard `--check` enforces the same in CI).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { render, OUT_REL, PREVENTED_FAILURES, renderPreventedFailures } from '../../src/scripts/build_proof.js';
import { load_ledger } from '../../src/scripts/check_claims.js';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

// `render()` costs ~54s (measured 2026-08-11): it walks the whole claims
// ledger, and this file called it five times. That made it the single slowest
// test file in the suite — 290s in a 977-file pass, 8.7x the next-slowest file
// in that same pass (33.5s), and ~269s when run alone. Enough on its own to
// push one vitest shard over the CI per-job ceiling. After the change: 103s
// wall-clock standalone, i.e. the two `render()` calls determinism needs.
//
// Rendering ONCE and reusing the string is sound precisely because the first
// test below asserts determinism: if `render()` ever stopped returning the
// same output, that test fails and the cache cannot mask it. The determinism
// test keeps two independent invocations — two calls IS what it measures.
// Do not "simplify" the other tests back to calling `render()` themselves.
//
// Memoised lazily rather than at module scope on purpose: `render()` can throw
// (via `renderPreventedFailures`, on a claim with no ledger entry or one
// downgraded to unbacked), and a module-scope throw aborts collection of the
// whole file — taking out the very tests further down that diagnose that
// cause. Deferring the call keeps the saving and keeps the diagnosis.
let _proof: string | undefined;
const proof = (): string => (_proof ??= render());

describe('build_proof — render()', () => {
    // 300 s. The history behind the number matters more than the number.
    //
    // It was 10 s and unenforceable. Vitest 2 could not apply a timeout to a
    // synchronous CPU-bound body — the deadline fires when the event loop gets
    // control and `render()` never yields — so main's own CI reported this test
    // GREEN at 566,662 ms on ubuntu shard 3/4 (run 36699591543) and 442,648 ms
    // on macOS. Nine and seven minutes, under a ten-second budget, for months.
    //
    // Vitest 5 enforces it, which is how the cost became visible at all. The
    // cause was not this file: `reachable_scripts` in check_enforcement_coverage
    // re-scanned every reached body on every round of its fixed point, and
    // worklisting it took the gate 240 s -> 63 s and `render()` 241 s -> 62 s,
    // measured under plain `tsx` with no test runner involved. That is back at
    // the ~54 s a call this file's header recorded on 2026-08-11, so the two
    // calls this determinism check needs cost ~124 s locally end to end.
    //
    // 300 s was that measurement plus room for a macOS runner read at about
    // 1.45x ubuntu on this shard. RAISED to 600 s on 2026-10-02, because the
    // macOS factor is not 1.45x: this test timed out at 300,000 ms on macos
    // shard 3/4 while measuring 129,786 ms locally the same day — in line with
    // the ~124 s the paragraph above records, so `render()` has NOT regressed
    // and the runner is simply slower than the factor assumed. The observed
    // factor is therefore >=2.3x rather than 1.45x.
    //
    // The purpose is unchanged and is why raising is the right move rather than
    // a loosening: this timeout exists to catch a HANG, which is unbounded, not
    // to assert a wall-clock the ci-cost-budget contract governs. 600 s is ~4.6x
    // the local reading and still fails a hang on any runner. Lower it again if
    // `render()` gets faster — the number tracks the measurement, not the other
    // way round.
    it('is deterministic (no timestamp / stable ordering)', () => {
        expect(render()).toBe(proof());
    }, 600_000);

    it('emits the required proof structure', () => {
        const out = proof();
        expect(out).toContain('# Proof — verify our claims yourself');
        expect(out).toContain('## See it run (< 60s, real output)');
        expect(out).toContain('](media/proof-demo.gif)');
        expect(out).toContain('## 1. Every public claim binds to evidence');
        expect(out).toContain('## 2. We publish honest nulls');
        expect(out).toContain('## 3. Known limits (published, witness-tested)');
        expect(out).toContain('## 4. What is checkable — us vs. the category');
        expect(out).toContain('## 5. Verify it yourself');
        expect(out).toContain('| Claim | Kind | Evidence | Resolves |');
        expect(out).toContain('| Claim | Our evidence | The category | Checkable? |');
        expect(out).toContain('task check-claims');
        expect(out).toContain('task check-skill-gaps');
        expect(out).toContain('task check-comparison');
    });

    it('carries the do-not-hand-edit generated marker', () => {
        expect(proof()).toMatch(/GENERATED by build_proof/);
    });

    it('the committed docs/proof.md is in sync (drift guard)', () => {
        const committed = readFileSync(join(REPO_ROOT, OUT_REL), 'utf8');
        expect(committed).toBe(proof());
    });
});

describe('build_proof — the prevented-failure table may not outlive its evidence', () => {
    it('renders a row per declared failure mode', () => {
        const out = renderPreventedFailures(load_ledger());
        expect(out).toContain('## What this prevents');
        for (const row of PREVENTED_FAILURES) {
            expect(out).toContain(`[\`${row.backs}\`](CLAIMS.md)`);
        }
    });

    it('every declared row cites a claim that is actually backed today', () => {
        const ledger = load_ledger();
        for (const row of PREVENTED_FAILURES) {
            expect(ledger.get(row.backs)?.status, `row cites ${row.backs}`).toBe('backed');
        }
    });

    it('THROWS when a cited claim has no ledger entry — the anti-marketing gate', () => {
        // The failure this table exists to avoid: a cell whose number resolves
        // nowhere. If a claim is renamed or dropped, generation must break
        // rather than silently ship a stale row.
        const ledger = load_ledger();
        ledger.delete(PREVENTED_FAILURES[0]!.backs);
        expect(() => renderPreventedFailures(ledger)).toThrow(/no ledger entry/);
    });

    it('THROWS when a cited claim is downgraded to unbacked', () => {
        const ledger = load_ledger();
        const id = PREVENTED_FAILURES[0]!.backs;
        const entry = ledger.get(id)!;
        ledger.set(id, { ...entry, status: 'unbacked' });
        expect(() => renderPreventedFailures(ledger)).toThrow(/not 'backed'/);
    });
});
