// Focused differential for smoke_path_resolution (py2ts Phase 8 / Wave 8h).
// No pytest suite exists for this module — golden parity on the real repo.
// The script is fully deterministic (sorted glob over `.augment/rules/*.md`,
// pure path resolution), so python3 vs tsx stdout/stderr/exit are compared
// byte-for-byte. Read-only against the live tree — never mutates the repo.
import { describe, expect, it } from 'vitest';

import { hasPython3, runPy, runTs } from './_wave8h.js';

describe('smoke_path_resolution — golden parity (real repo)', () => {
    it.skipIf(!hasPython3())('byte-identical python3 vs tsx', () => {
        const py = runPy('smoke_path_resolution', []);
        const ts = runTs('smoke_path_resolution', []);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});
