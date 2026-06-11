// Tests for src/scripts/lint_readme_jargon.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Light behavioural spec over exported constants plus
// the golden-parity layer that runs python3 vs tsx on the REAL REPO (skipped
// without python3). Golden parity is the binding contract.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as lrj from '../../src/scripts/lint_readme_jargon.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_readme_jargon.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_readme_jargon.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_readme_jargon — exported config', () => {
    it('exposes the above-fold line budget and max-hits threshold', () => {
        expect(typeof lrj.ABOVE_FOLD_LINES).toBe('number');
        expect(typeof lrj.MAX_HITS).toBe('number');
        expect(lrj.ABOVE_FOLD_LINES).toBeGreaterThan(0);
        expect(lrj.MAX_HITS).toBeGreaterThanOrEqual(0);
    });

    it('exposes a non-empty jargon watchlist', () => {
        expect(Array.isArray(lrj.WATCHLIST)).toBe(true);
        expect(lrj.WATCHLIST.length).toBeGreaterThan(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_readme_jargon — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches the --quiet run byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
