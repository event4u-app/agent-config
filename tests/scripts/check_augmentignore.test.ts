// Tests for src/scripts/check_augmentignore.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused behavioural spec over check() (always
// exits 0; emits OK or advisory) plus a golden-parity layer running
// python3 vs tsx on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as ci from '../../src/scripts/check_augmentignore.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_augmentignore.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_augmentignore.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_augmentignore — behavioural spec', () => {
    it('always returns 0 (advisory, never a gate)', () => {
        expect(ci.check()).toBe(0);
    });

    it('exports the documented thresholds', () => {
        expect(ci.STALE_DAYS).toBe(90);
        expect(ci.MIN_USEFUL_LINES).toBe(5);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_augmentignore — golden parity (python3 vs tsx)', () => {
    function expectMatch(args: readonly string[]) {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default matches byte-for-byte', () => {
        expectMatch([]);
    });

    it('--quiet matches byte-for-byte', () => {
        expectMatch(['--quiet']);
    });
});
