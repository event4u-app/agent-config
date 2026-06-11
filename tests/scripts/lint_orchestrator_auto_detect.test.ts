// Tests for src/scripts/lint_orchestrator_auto_detect.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists, so this is a focused differential suite over the
// public helpers (_split_frontmatter, check) plus a golden-parity layer that
// runs python3 vs tsx on the REAL REPO (default + --quiet), asserting
// byte-identical stdout/stderr/exit. Golden parity is skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_orchestrator_auto_detect.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_orchestrator_auto_detect.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_orchestrator_auto_detect.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_orchestrator_auto_detect — behavioural spec', () => {
    // --- _split_frontmatter ---
    it('splits a frontmatter block from the body', () => {
        const [fm, body] = mod._split_frontmatter('---\ntype: orchestrator\nauto_detect: true\n---\nbody\n');
        expect(fm).toBe('type: orchestrator\nauto_detect: true');
        expect(body).toBe('body\n');
    });

    it('returns ["", text] when no opening fence', () => {
        const [fm, body] = mod._split_frontmatter('no fence\n');
        expect(fm).toBe('');
        expect(body).toBe('no fence\n');
    });

    it('returns ["", text] when no closing fence', () => {
        const [fm, body] = mod._split_frontmatter('---\ntype: x\nstill open\n');
        expect(fm).toBe('');
        expect(body).toBe('---\ntype: x\nstill open\n');
    });

    // --- check against the real repo ---
    it('check() returns an array of violations on the real repo', () => {
        const v = mod.check();
        expect(Array.isArray(v)).toBe(true);
        for (const item of v) {
            expect(typeof item.file).toBe('string');
            expect(typeof item.reason).toBe('string');
        }
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_orchestrator_auto_detect — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches the --quiet run byte-for-byte', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--help exits 0 and prints a usage line (not a parity contract)', () => {
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('usage:');
    });
});
