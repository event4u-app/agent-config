// Tests for src/scripts/lint_hook_manifest.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: a lint() unit check on a missing manifest
// path (exit 2), plus a golden-parity layer (python3 vs tsx on the REAL REPO
// across the real CI args: default + --strict) asserting byte-identical
// stdout/stderr/exit. Skipped without python3. CI invokes `lint_hook_manifest`.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_hook_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_hook_manifest.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_hook_manifest.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_hook_manifest — lint', () => {
    it('returns exit 2 for a missing manifest file', () => {
        expect(mod.lint(path.join(REPO_ROOT, 'does', 'not', 'exist.yaml'), false)).toBe(2);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('lint_hook_manifest — golden parity (python3 vs tsx)', () => {
    const runPy = (args: readonly string[]) =>
        spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    const runTs = (args: readonly string[]) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

    for (const args of [[], ['--strict']]) {
        it(`matches \`${args.join(' ') || '(default)'}\` byte-for-byte`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
