// Tests for src/scripts/measure_patterns.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists → focused differential suite. The script is a
// read-only reporter over the legacy `.agent-src.uncondensed/skills` corpus.
//
// Real-repo reality the contract makes us replicate-and-flag: that legacy
// skills dir does NOT exist on the current src/-based layout, so the .py hits
// its `SKILLS_DIR.is_dir()` guard and exits 3 with a stable, byte-reproducible
// stderr line. The TS twin reproduces both the exit code and the exact stderr
// message. Golden parity covers the default, --json, and --tier shapes — all
// of which reach the exit-3 guard identically in this repo. Argparse error
// banners (bad flag / bad --tier choice) are Python-version-dependent prose,
// so for those only the exit code (2) is compared. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_patterns.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_patterns.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const SKILLS_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function skillsDirPresent(): boolean {
    return spawnSync('test', ['-d', SKILLS_DIR]).status === 0;
}
function runPy(args: string[]) {
    return spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}
function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe.runIf(hasPython3())('measure_patterns — golden parity (python3 vs tsx)', () => {
    // Every reporting shape reaches the same code path in this repo (skills dir
    // present → real scan; absent → exit-3 guard). Either way byte-identical.
    for (const args of [[], ['--json'], ['--tier', '1'], ['--tier', '3']]) {
        it(`byte-identical for: ${args.join(' ') || '(default)'}`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }

    it.skipIf(skillsDirPresent())('missing skills dir → exit 3 + identical stderr', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(py.status).toBe(3);
        expect(ts.status).toBe(3);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stdout).toBe('');
        expect(py.stdout).toBe('');
    });

    it('bad flag → exit code parity (argparse banner prose not compared)', () => {
        const py = runPy(['--bogus']);
        const ts = runTs(['--bogus']);
        expect(ts.status).toBe(py.status);
    });

    it('invalid --tier choice → exit code parity', () => {
        const py = runPy(['--tier', '9']);
        const ts = runTs(['--tier', '9']);
        expect(ts.status).toBe(py.status);
    });
});
