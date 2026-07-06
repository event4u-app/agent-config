// CLI intent test for smoke_path_resolution (py2ts Phase 8 / Wave 8h).
// No pytest suite exists for this module — the tsx CLI runs against the real
// repo. The script is fully deterministic (sorted glob over
// `.augment/rules/*.md`, pure path resolution), but its counts are
// repo-content-dependent, so the assertion is structural (exit code + the
// ✅ summary line shape), not byte-exact. Read-only against the live tree —
// never mutates the repo.
import { describe, expect, it } from 'vitest';

import { runTs } from './_wave8h.js';

describe('smoke_path_resolution — CLI (real repo, tsx)', () => {
    it('resolves every load_context entry and reports the clean summary', () => {
        const r = runTs('smoke_path_resolution', []);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        expect(r.stdout).toMatch(
            /^✅ {2}smoke-path-resolution clean \(\d+ rules, \d+ load_context entr\(y\/ies\) resolved\)\n$/,
        );
    });
});
