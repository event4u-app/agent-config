// Focused differential for smoke_quickstart (py2ts Phase 8 / Wave 8h).
// No pytest suite exists — golden parity on the real repo. Each run spawns the
// still-Python installer into its OWN tmpdir (cleaned up by the script) and
// imports the still-Python work_engine decision_engine module via a python3
// shim — so the test is gated on a `python3` interpreter being present.
//
// The green path is fully deterministic: exit 0 + the fixed ✅ stdout line.
// (The installer writes only inside its private tmpdir; nothing in the live
// repo is mutated.)
import { describe, expect, it } from 'vitest';

import { hasPython3, runPy, runTs } from './_wave8h.js';

describe('smoke_quickstart — golden parity (real repo)', () => {
    it.skipIf(!hasPython3())('byte-identical stdout/stderr/exit python3 vs tsx', () => {
        const py = runPy('smoke_quickstart', []);
        const ts = runTs('smoke_quickstart', []);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});
