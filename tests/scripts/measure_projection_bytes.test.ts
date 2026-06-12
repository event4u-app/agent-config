// Tests for src/scripts/measure_projection_bytes.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists → focused differential suite. The script is a
// read-only reporter (without --regenerate); it walks per-tool projection
// surfaces and prints a table (default) or JSON (--json). Golden parity:
// python3 vs tsx on the REAL repo across the default + --json shapes —
// byte-exact stdout/stderr/exit. The --regenerate path is NOT exercised
// (it shells out to `task clean-tools && task generate-tools`, mutating the
// whole tool tree — out of scope for a read-only parity suite). Skipped
// without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_projection_bytes.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_projection_bytes.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function runPy(args: string[]) {
    return spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}
function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe.runIf(hasPython3())('measure_projection_bytes — golden parity (python3 vs tsx)', () => {
    for (const args of [[], ['--json']]) {
        it(`byte-identical for: ${args.join(' ') || '(default)'}`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }

    it('bad flag → exit code parity (argparse banner prose not compared)', () => {
        const py = runPy(['--nope']);
        const ts = runTs(['--nope']);
        expect(ts.status).toBe(py.status);
    });
});
