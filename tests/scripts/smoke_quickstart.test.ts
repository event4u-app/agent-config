// CLI intent test for smoke_quickstart (py2ts Phase 8 / Wave 8h).
// No pytest suite exists — the tsx CLI runs against the real repo. Each run
// spawns the TypeScript installer (`install.ts`) into its OWN tmpdir (cleaned
// up by the script) and imports the work_engine decision_engine TS module
// in-process — fully python-free.
//
// The green path is fully deterministic: exit 0 + the fixed ✅ stdout line.
// (The installer writes only inside its private tmpdir; nothing in the live
// repo is mutated.)
import { describe, expect, it } from 'vitest';

import { runTs } from './_wave8h.js';

describe('smoke_quickstart — CLI (real repo, tsx)', () => {
    it('install → settings → decision_engine is green', () => {
        const r = runTs('smoke_quickstart', []);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        expect(r.stdout).toBe('✅  smoke-quickstart: install → settings → decision_engine green\n');
    });
});
