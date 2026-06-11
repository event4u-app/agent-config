// Tests for src/scripts/lint_readme_size.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Focused differential over the exported constants
// plus a golden-parity layer running python3 vs tsx on the REAL REPO
// (skipped without python3). README.md is resolved relative to cwd, so parity
// runs with cwd = REPO_ROOT.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as rs from '../../src/scripts/lint_readme_size.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_readme_size.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_readme_size.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_readme_size — constants', () => {
    it('targets README.md with a 750-line limit', () => {
        expect(String(rs.README)).toBe('README.md');
        expect(rs.LIMIT).toBe(750);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_readme_size — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function same(args: readonly string[]): void {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default run matches byte-for-byte', () => same([]));
    it('--quiet matches byte-for-byte', () => same(['--quiet']));
    it('missing README (cwd without it) matches exit 1', () => {
        const tmpCwd = path.join(REPO_ROOT, 'src'); // no README.md here
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: tmpCwd, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: tmpCwd, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
