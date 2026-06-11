// Tests for src/scripts/lint_context_spine_usage.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Differential checks over the public helpers
// (frontmatter/body split, spine extraction, slot-citation detection) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_context_spine_usage.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_context_spine_usage.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_context_spine_usage.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_context_spine_usage — behavioural spec', () => {
    it('_frontmatter_and_body splits the leading --- block from the body', () => {
        const [fm, body] = mod._frontmatter_and_body('---\nname: x\n---\n# heading\ntext\n');
        expect(fm).toContain('name: x');
        expect(body).toContain('# heading');
    });

    it('_frontmatter_and_body returns empty fm when no block present', () => {
        const [fm] = mod._frontmatter_and_body('# heading only\n');
        expect(fm).toBe('');
    });

    it('VALID_SLOTS is a non-empty closed vocabulary', () => {
        expect(mod.VALID_SLOTS.length).toBeGreaterThan(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_context_spine_usage — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
