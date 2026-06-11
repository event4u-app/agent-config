// Tests for src/scripts/check_discovery_determinism.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module. It shells out to the Python
// scanner (build_discovery_manifest.py — no TS twin yet), so the test is a
// golden-parity layer that runs python3 vs tsx on the REAL REPO (the scanner
// runs twice each). Skipped when python3 or the scanner is unavailable.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_discovery_determinism.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_discovery_determinism.py');
const SCANNER = path.join(REPO_ROOT, 'src', 'scripts', 'build_discovery_manifest.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const runnable = hasPython3() && fs.existsSync(SCANNER);

describe.skipIf(!runnable)('check_discovery_determinism — golden parity (python3 vs tsx)', () => {
    it('OK line matches except the (run-stable) checksum prefix', () => {
        const py = spawnSync('python3', [PY_SCRIPT], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
        });
        // The scanner is deterministic, so both runs of both implementations
        // print the identical "OK: deterministic..." line (same checksum), and
        // exit 0. Full byte-parity on stdout/stderr/exit.
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
    });
});
