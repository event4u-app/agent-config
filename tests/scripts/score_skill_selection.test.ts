// Tests for src/scripts/score_skill_selection.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists → focused differential suite. The script reads
// tests/fixtures/skill_selection/fixtures.yml + agents/reports/
// skill-collision-clusters.json and writes a JSON report (default
// agents/reports/skill-selection-accuracy.json).
//
// Real-repo realities the contract makes us replicate-and-flag:
//
//   A. With NO selection flag, the .py prints "❌  Specify ..." to stderr and
//      exits 2 BEFORE reading any input. Byte-identical (stderr + exit).
//
//   B. `--baseline` (and `--predictions`) read the clusters JSON, which does
//      NOT exist on the current layout → uncaught FileNotFoundError →
//      traceback → exit 1, EMPTY stdout, NO file written. The TS twin
//      reproduces the crash (throwing on read ENOENT → exit 1). Traceback
//      prose is interpreter-specific; only exit code + empty stdout + no-write
//      are compared.
//
//   C. The happy path (both inputs present) is gated on clusters existing;
//      when it does, the written report + stdout are byte-identical. The shared
//      output path is snapshotted/restored under the global-state lock.
//
// Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { acquireGlobalStateLock } from './_global_state_lock.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'score_skill_selection.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'score_skill_selection.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const CLUSTERS = path.join(REPO_ROOT, 'agents', 'reports', 'skill-collision-clusters.json');
const DEFAULT_OUT = path.join(REPO_ROOT, 'agents', 'reports', 'skill-selection-accuracy.json');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function clustersPresent(): boolean {
    return fs.existsSync(CLUSTERS);
}
function runPy(args: string[]) {
    return spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}
function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe.runIf(hasPython3())('score_skill_selection — golden parity (python3 vs tsx)', () => {
    it('no selection flag → exit 2 + identical stderr, no write', () => {
        const before = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
        const py = runPy([]);
        const ts = runTs([]);
        expect(py.status).toBe(2);
        expect(ts.status).toBe(2);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        const after = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
        expect(after).toBe(before);
    });

    it.skipIf(clustersPresent())(
        '--baseline without clusters JSON → both crash exit 1, empty stdout, no write',
        () => {
            const before = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
            const py = runPy(['--baseline']);
            const ts = runTs(['--baseline']);
            expect(py.status).toBe(1);
            expect(ts.status).toBe(1);
            expect(ts.stdout).toBe('');
            expect(py.stdout).toBe('');
            const after = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
            expect(after).toBe(before);
        },
    );

    describe.runIf(clustersPresent())('happy path (clusters present)', () => {
        let snap: string | null = null;
        let release: (() => void) | null = null;
        beforeEach(() => {
            release = acquireGlobalStateLock();
            snap = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
        });
        afterEach(() => {
            if (snap !== null) fs.writeFileSync(DEFAULT_OUT, snap, 'utf-8');
            else if (fs.existsSync(DEFAULT_OUT)) fs.rmSync(DEFAULT_OUT);
            snap = null;
            if (release) {
                release();
                release = null;
            }
        });

        it('--baseline → byte-identical stdout + written report', () => {
            const py = runPy(['--baseline']);
            const pyReport = fs.readFileSync(DEFAULT_OUT, 'utf-8');
            const ts = runTs(['--baseline']);
            const tsReport = fs.readFileSync(DEFAULT_OUT, 'utf-8');
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(tsReport).toBe(pyReport);
        });
    });

    it('bad flag → exit code parity (argparse banner prose not compared)', () => {
        const py = runPy(['--bogus']);
        const ts = runTs(['--bogus']);
        expect(ts.status).toBe(py.status);
    });
});
