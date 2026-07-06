// CLI intent test for smoke_path_resolution (py2ts Phase 8 / Wave 8h).
// No pytest suite exists for this module — the tsx CLI runs against the real
// repo. The script is fully deterministic (sorted glob over
// `.augment/rules/*.md`, pure path resolution), but its counts are
// repo-content-dependent, so the assertion is structural (exit code + the
// ✅ summary line shape), not byte-exact. Read-only against the live tree —
// never mutates the repo.
//
// Capability gate: the smoke resolves against the GENERATED `.augment/`
// projection (gitignored; produced by `task sync`). CI's Node Tests job runs
// vitest without a sync step, so the projection is absent there. Exactly one
// of the two tests below runs in any environment — the happy path where the
// projection exists (dev machines, post-sync), the exit-3 contract where it
// does not (clean CI checkout) — so the file always exercises one real
// branch of the CLI and never false-fails on a missing generated tree.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT, runTs } from './_wave8h.js';

const hasProjection = fs.existsSync(path.join(REPO_ROOT, '.augment', 'rules'));

describe('smoke_path_resolution — CLI (real repo, tsx)', () => {
    it.skipIf(!hasProjection)(
        'resolves every load_context entry and reports the clean summary',
        () => {
            const r = runTs('smoke_path_resolution', []);
            expect(r.status).toBe(0);
            expect(r.stderr).toBe('');
            expect(r.stdout).toMatch(
                /^✅ {2}smoke-path-resolution clean \(\d+ rules, \d+ load_context entr\(y\/ies\) resolved\)\n$/,
            );
        },
    );

    it.skipIf(hasProjection)(
        'without the generated projection: exit 3 + the run-task-sync hint',
        () => {
            const r = runTs('smoke_path_resolution', []);
            expect(r.status).toBe(3);
            expect(r.stderr).toContain('not found — run `task sync` first');
        },
    );
});
