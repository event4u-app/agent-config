// Tests for src/scripts/measure_density.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists. The script reads the whole artifact corpus and
// prints a report (default) or deterministic JSON (--json); --snapshot writes
// JSONL to the gitignored agents/runtime/density/snapshot.jsonl (no tracked
// drift). Golden parity: python3 vs tsx on the REAL repo across the default,
// --json, and --snapshot shapes — byte-exact stdout/stderr/exit + snapshot
// bytes. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_density.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_density.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const SNAPSHOT = path.join(REPO_ROOT, 'agents', 'runtime', 'density', 'snapshot.jsonl');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe.runIf(hasPython3())('measure_density — golden parity (python3 vs tsx)', () => {
    for (const args of [[], ['--json']]) {
        it(`byte-identical for: ${args.join(' ') || '(default)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }

    it('--snapshot writes byte-identical JSONL (gitignored path; restored)', () => {
        const existedBefore = fs.existsSync(SNAPSHOT);
        const before = existedBefore ? fs.readFileSync(SNAPSHOT) : null;
        try {
            const py = spawnSync('python3', [PY_SCRIPT, '--snapshot'], { encoding: 'utf8', cwd: REPO_ROOT });
            const pyBytes = fs.readFileSync(SNAPSHOT, 'utf-8');
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--snapshot'], { encoding: 'utf8', cwd: REPO_ROOT });
            const tsBytes = fs.readFileSync(SNAPSHOT, 'utf-8');
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(tsBytes).toBe(pyBytes);
        } finally {
            if (before !== null) {
                fs.writeFileSync(SNAPSHOT, before);
            } else if (fs.existsSync(SNAPSHOT)) {
                fs.rmSync(SNAPSHOT);
            }
        }
    });
});
