// Tests for src/scripts/plan_physical_move.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists. plan_physical_move's --apply path mutates the tree
// via `git mv`, so it is NEVER exercised against the live repo here. The tsx
// twin is the source of truth (the python original was deleted in the
// teardown); only the default DRY-RUN (writes the plan JSON, no FS moves) is
// asserted. The plan file is written to an in-tree temp path and removed
// afterwards, so the test leaves zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'plan_physical_move.ts');
const TMP_DIR = path.join(REPO_ROOT, 'dist', 'migration');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

// The tsx twin is the source of truth (the python original was deleted in the
// teardown). --apply mutates the tree via `git mv` → NEVER exercised; only the
// dry-run (writes plan JSON, no FS moves) is asserted, structurally: exit in
// {0 clean, 1 conflicts} (repo-state), valid plan JSON, deterministic. The
// plan file is written to an in-tree temp path + removed (zero git drift).
describe('plan_physical_move — dry-run contract', () => {
    const tsOut = path.join(TMP_DIR, '_plan.ts.test.json');

    afterEach(() => {
        if (fs.existsSync(tsOut)) {
            fs.rmSync(tsOut);
        }
    });

    it('dry-run writes a valid plan JSON, deterministically', () => {
        fs.mkdirSync(TMP_DIR, { recursive: true });
        const runTs = () =>
            spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut], { encoding: 'utf8', cwd: REPO_ROOT });
        const a = runTs();
        // 0 = clean, 1 = conflicts — both are valid dry-run verdicts (repo state).
        expect([0, 1]).toContain(a.status);
        const plan = fs.readFileSync(tsOut, 'utf-8');
        expect(() => JSON.parse(plan)).not.toThrow();
        // Deterministic: a second dry-run reproduces the same plan + verdict.
        const b = runTs();
        expect(b.status).toBe(a.status);
        expect(fs.readFileSync(tsOut, 'utf-8')).toBe(plan);
    });
});
