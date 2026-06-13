// Tests for src/scripts/print_required_checks.ts (py2ts Phase 8 / Wave 8g).
//
// No pytest suite existed — focused differential (python3 vs tsx, byte-exact)
// over deterministic `--branch`/`--base` invocations covering the three PR
// shapes (feature / release / docs-only), the release-out-of-shape fallback,
// `=`-joined flags, and the argparse error paths. `--base HEAD` keeps the diff
// deterministic in any checkout. Read-only, no git drift. Skipped without
// python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'print_required_checks.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'print_required_checks.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py = hasPython3();
const runPy = (args: string[]) =>
    spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
const runTs = (args: string[]) =>
    spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

describe.skipIf(!py)('print_required_checks — golden parity (python3 vs tsx)', () => {
    const cases: string[][] = [
        ['--branch', 'feat/x', '--base', 'HEAD'],
        ['--branch', 'release/1.2.3', '--base', 'HEAD'],
        ['--branch', 'docs/x', '--base', 'HEAD'],
        ['--base', 'HEAD'],
        ['--branch=feat/y', '--base=HEAD'],
        ['--bogus'],
        ['--branch'],
    ];
    for (const args of cases) {
        it(`[${args.join(' ')}] matches`, () => {
            const p = runPy(args);
            const t = runTs(args);
            expect(t.status).toBe(p.status);
            expect(t.stdout).toBe(p.stdout);
            expect(t.stderr).toBe(p.stderr);
        });
    }
});
