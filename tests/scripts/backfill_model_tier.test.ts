// Tests for src/scripts/backfill_model_tier.ts (py2ts Phase 8 / Wave 8e).
//
// backfill_model_tier is a one-shot migration WRITER: a live run rewrites
// `model_tier` frontmatter across every source skill/command AND its
// `dist/agent-src` copy. There is no injectable ROOT/CONDENSED seam (both are
// derived from the script location), so we cannot golden-diff the live write
// path against a temp fixture without mutating the tracked tree.
//
// `--dry-run` is the safe, deterministic surface: it performs NO writes and
// emits a fully deterministic plan to stdout (every untagged artefact it would
// tag, classified by the same content rules in both runtimes). This golden
// parity asserts the dry-run plan is byte-identical between python3 and tsx,
// and that neither run leaves any tracked-file drift.
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT, hasPython3, runPy, runTs } from './_wave8e.js';

const py3 = hasPython3();

function trackedDirty(): string {
    // Ignore untracked files (the wave's not-yet-committed .ts twins); only
    // surface modifications/deletions to tracked files.
    return execSync('git status --porcelain --untracked-files=no', {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    }).trim();
}

describe.skipIf(!py3)('backfill_model_tier — golden parity (python3 vs tsx)', () => {
    it('--dry-run plan is byte-identical and writes nothing', () => {
        expect(trackedDirty()).toBe('');

        const py = runPy('backfill_model_tier', ['--dry-run']);
        expect(trackedDirty(), 'python3 --dry-run must not mutate tracked files').toBe('');
        expect(py.status).toBe(0);

        const ts = runTs('backfill_model_tier', ['--dry-run']);
        expect(trackedDirty(), 'tsx --dry-run must not mutate tracked files').toBe('');
        expect(ts.status).toBe(0);

        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
});
