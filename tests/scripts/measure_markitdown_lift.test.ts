// Tests for src/scripts/measure_markitdown_lift.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists → focused differential suite. The script is a
// read-only reporter over tests/fixtures/markitdown-corpus/; it never mutates
// the repo. Golden parity: python3 vs tsx on the REAL repo across the baseline
// (default) shape — byte-exact stdout/stderr/exit. The --convert path needs
// the `markitdown` CLI on PATH; when absent, both emit exit 3 with the same
// message (also asserted). Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_markitdown_lift.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_markitdown_lift.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function hasMarkitdown(): boolean {
    return spawnSync(process.platform === 'win32' ? 'where' : 'which', ['markitdown'], {
        encoding: 'utf8',
    }).status === 0;
}
function runPy(args: string[]) {
    return spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}
function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe.runIf(hasPython3())('measure_markitdown_lift — golden parity (python3 vs tsx)', () => {
    it('baseline-only (default) is byte-identical', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it.skipIf(hasMarkitdown())('--convert without the binary → exit 3, identical error text', () => {
        const py = runPy(['--convert']);
        const ts = runTs(['--convert']);
        expect(py.status).toBe(3);
        expect(ts.status).toBe(3);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it.runIf(hasMarkitdown())('--convert with the binary present is byte-identical', () => {
        const py = runPy(['--convert']);
        const ts = runTs(['--convert']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('bad flag → exit code parity (argparse banner prose not compared)', () => {
        const py = runPy(['--bogus']);
        const ts = runTs(['--bogus']);
        expect(ts.status).toBe(py.status);
    });
});
