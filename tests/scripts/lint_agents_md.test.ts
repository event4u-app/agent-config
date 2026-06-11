// Tests for src/scripts/lint_agents_md.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. This is a light behavioural spec over the exported
// pure helper plus the golden-parity layer that runs python3 vs tsx on the
// REAL REPO (skipped without python3). Golden parity is the binding contract.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as lam from '../../src/scripts/lint_agents_md.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_agents_md.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_agents_md.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_agents_md — behavioural spec', () => {
    it('exposes the path-enumeration threshold constant', () => {
        expect(lam.PATH_ENUM_THRESHOLD).toBe(3);
    });

    it('_is_path_enumeration: bullet + backtick path, no link → true', () => {
        expect(lam._is_path_enumeration('- `src/scripts/foo.ts`')).toBe(true);
    });

    it('_is_path_enumeration: a markdown link line → false', () => {
        // A bullet whose backtick span is a link is a pointer, not enumeration.
        expect(lam._is_path_enumeration('- [foo](src/foo.md) — why')).toBe(false);
    });

    it('_is_path_enumeration: a non-bullet line → false', () => {
        expect(lam._is_path_enumeration('plain `path/here.md` prose')).toBe(false);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_agents_md — golden parity (python3 vs tsx)', () => {
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
