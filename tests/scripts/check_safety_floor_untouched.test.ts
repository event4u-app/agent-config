// Tests for src/scripts/check_safety_floor_untouched.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the constants plus a golden-parity layer that runs python3 vs
// tsx on the REAL REPO (skipped without python3). The worktree branch does
// not touch the four safety-floor rules, so vs. its merge-base the gate is
// clean — and `--skip-if-no-baseline` on a bogus ref is a deterministic skip.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as sf from '../../src/scripts/check_safety_floor_untouched.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_safety_floor_untouched.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_safety_floor_untouched.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_safety_floor_untouched — behavioural spec', () => {
    it('guards exactly the four safety-floor rules', () => {
        expect([...sf.SAFETY_FLOOR]).toEqual([
            'non-destructive-by-default.md',
            'commit-policy.md',
            'scope-control.md',
            'verify-before-complete.md',
        ]);
    });

    it('rules dir is the legacy uncondensed tree', () => {
        expect(sf.RULES_DIR_REL).toBe('.agent-src.uncondensed/rules');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('check_safety_floor_untouched — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('bogus baseline + --skip-if-no-baseline → identical skip', () => {
        const args = ['--baseline', '__no_such_ref_xyz__', '--skip-if-no-baseline'];
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('default baseline (origin/main → main fallback) → identical verdict', () => {
        // Whatever the resolved baseline yields (clean / breach / internal error
        // when neither ref exists), python and tsx must agree byte-for-byte.
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
