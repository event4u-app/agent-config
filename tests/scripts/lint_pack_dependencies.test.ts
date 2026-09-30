// Tests for src/scripts/lint_pack_dependencies.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists, and the module exposes only `main()`. The tsx twin
// is the source of truth (the python original was deleted in the teardown).
// The CLI contract runs the bare `lint_pack_dependencies` (no flags) on the
// REAL REPO: exit 0 + deterministic. Invoked in CI via the
// `task generate-pack-manifests` lint cadence.
import { describe, expect, it } from 'vitest';
import { main } from '../../src/scripts/lint_pack_dependencies.js';
import { runInProc } from '../_lib/run_in_process.js';

function runTs() {
    return runInProc(main, []);
}

describe('lint_pack_dependencies — CLI contract', () => {
    // 60 s, not the 10 s default. This test runs the gate's `main()` over the
    // REAL repo IN-PROCESS — no subprocess, so the cost is the whole-tree walk
    // itself. Vitest 5 raised the default worker count the 10 s was calibrated
    // under, and every one of the 18 CI failures on that upgrade was a timeout,
    // never an assertion. Targeted rather than a global raise: the 10 s default
    // still guards ~24k fast tests, and a real hang here still fails.
    it('default run passes cleanly over the repo (exit 0, deterministic)', () => {
        const a = runTs();
        expect(a.status, a.stderr).toBe(0);
        expect(runTs().stdout).toBe(a.stdout);
    }, 60_000);
});
