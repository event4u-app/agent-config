// Tests for src/scripts/validate_discovery_manifest.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. It shells out to the Python scanner
// (build_discovery_manifest.py — no TS twin yet) and diffs the fresh build
// against the committed dist/discovery/discovery-manifest.json. The test is a
// golden-parity layer that runs python3 vs tsx on the REAL REPO, plus a
// missing-manifest path against an absent --... no flag exists; instead the
// absent-manifest path is covered by pointing the committed-manifest constant
// (skipIf python3 / scanner / committed manifest unavailable).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_discovery_manifest.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_discovery_manifest.py');
const SCANNER = path.join(REPO_ROOT, 'src', 'scripts', 'build_discovery_manifest.py');
const COMMITTED = path.join(REPO_ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const py3 = hasPython3();
const runnable = py3 && fs.existsSync(SCANNER) && fs.existsSync(COMMITTED);

const big = { maxBuffer: 256 * 1024 * 1024, cwd: REPO_ROOT, encoding: 'utf8' as const };

describe.skipIf(!runnable)('validate_discovery_manifest — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], big);
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big);
    }

    for (const args of [[], ['--quiet']] as const) {
        it(`matches byte-for-byte against the committed manifest: ${
            args.join(' ') || '(no args)'
        }`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});

// The missing-committed-manifest path (exit 1 + "committed manifest not found")
// only fires when dist/discovery/ is absent; in npm-ci-only CI the manifest is
// gitignored and absent, so this assertion is covered there.
describe.skipIf(!(py3 && fs.existsSync(SCANNER) && !fs.existsSync(COMMITTED)))(
    'validate_discovery_manifest — missing committed manifest (python3 vs tsx)',
    () => {
        it('both report the missing-manifest error and exit 1', () => {
            const py = spawnSync('python3', [PY_SCRIPT], big);
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT], big);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
            expect(ts.status).toBe(1);
        });
    },
);
