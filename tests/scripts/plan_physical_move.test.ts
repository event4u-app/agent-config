// Tests for src/scripts/plan_physical_move.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists. plan_physical_move's --apply path mutates the tree
// via `git mv`, so it is NEVER exercised against the live repo here. The
// golden-parity layer runs only the default DRY-RUN (writes the plan JSON,
// no FS moves) of python3 vs tsx and compares stdout/stderr/exit + the written
// move-plan.json byte-for-byte. The plan file is written to an absolute
// in-tree temp path and removed afterwards, so the test leaves zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'plan_physical_move.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'plan_physical_move.py');
const TMP_DIR = path.join(REPO_ROOT, 'dist', 'migration');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe.runIf(hasPython3())('plan_physical_move — golden parity (dry-run only)', () => {
    const pyOut = path.join(TMP_DIR, '_plan.py.test.json');
    const tsOut = path.join(TMP_DIR, '_plan.ts.test.json');

    afterEach(() => {
        for (const f of [pyOut, tsOut]) {
            if (fs.existsSync(f)) {
                fs.rmSync(f);
            }
        }
    });

    it('stdout + written move-plan.json match for an absolute in-tree --out', () => {
        fs.mkdirSync(TMP_DIR, { recursive: true });
        const py = spawnSync('python3', [PY_SCRIPT, '--out', pyOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
        // "Plan: <rel>" line differs only in the temp filename stem.
        expect(ts.stdout.replace('_plan.ts.test', '_plan')).toBe(
            py.stdout.replace('_plan.py.test', '_plan'),
        );
        expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
    });

    it('exits 0 on a clean dry-run (no conflicts) — both implementations agree', () => {
        fs.mkdirSync(TMP_DIR, { recursive: true });
        const py = spawnSync('python3', [PY_SCRIPT, '--out', pyOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        // The repo's real plan determines the exit code (0 clean / 1 conflicts);
        // both implementations must produce the identical verdict.
        expect(ts.status).toBe(py.status);
    });
});
