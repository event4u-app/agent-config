// Tests for src/scripts/backfill_model_tier.ts (py2ts Phase 8 / Wave 8e).
//
// backfill_model_tier is a one-shot migration WRITER: a live run rewrites
// `model_tier` frontmatter across every source skill/command AND its
// `dist/agent-src` copy. There is no injectable ROOT/CONDENSED seam (both are
// derived from the script location), so we cannot exercise the live write
// path without mutating the tracked tree.
//
// `--dry-run` is the safe surface: it performs NO writes and emits a plan to
// stdout. The plan's counts depend on the current tree, so the assertions are
// structural (exit code, no tracked-file drift, stable report shape) rather
// than a byte snapshot. Converted from the retired python3-vs-tsx golden
// parity block (the Python original was deleted).
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT, runTs } from './_wave8e.js';

function trackedDirty(): string {
    // Ignore untracked files (the wave's not-yet-committed .ts twins); only
    // surface modifications/deletions to tracked files.
    return execSync('git status --porcelain --untracked-files=no', {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    }).trim();
}

describe('backfill_model_tier — CLI dry-run (tsx)', () => {
    it('--dry-run emits the plan and writes nothing', () => {
        // The working tree may already carry (unrelated) tracked drift — the
        // invariant is that the dry-run adds none.
        const before = trackedDirty();

        const ts = runTs('backfill_model_tier', ['--dry-run']);
        expect(trackedDirty(), 'tsx --dry-run must not mutate tracked files').toBe(before);
        expect(ts.status).toBe(0);
        expect(ts.stderr).toBe('');

        // Structural shape of the plan (counts vary with the tree — never
        // snapshot them): header line, one count line per tier, summary line.
        expect(ts.stdout).toMatch(/^model_tier backfill \(dry-run\):\n/);
        for (const tier of ['lite', 'medium', 'high', 'inherit']) {
            expect(ts.stdout).toMatch(new RegExp(`^ {2}${tier}\\s*: \\d+$`, 'm'));
        }
        expect(ts.stdout).toMatch(/context:large on \d+ skills · would set \d+ newly · total \d+/);
    });
});
