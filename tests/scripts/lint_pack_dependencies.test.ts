// Tests for src/scripts/lint_pack_dependencies.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists, and the module exposes only `main()` (it leans on a
// generate_pack_manifests twin for artefact discovery). The behavioural oracle
// is therefore the golden-parity layer: python3 vs tsx on the REAL REPO,
// byte-identical stdout/stderr/exit (skipped without python3). The CI
// invocation is the bare `lint_pack_dependencies` (no flags), via
// `task generate-pack-manifests` lint cadence.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_pack_dependencies.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_pack_dependencies.py');
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

describe.skipIf(!py3)('lint_pack_dependencies — golden parity (python3 vs tsx)', () => {
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

    // The real CI invocation — bare, no flags.
    it('default run matches byte-for-byte', () => same([]));
});
