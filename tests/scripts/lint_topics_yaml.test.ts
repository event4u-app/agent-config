// Tests for src/scripts/lint_topics_yaml.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Differential check over the exported slug regex
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3). The
// linter runs bare (and with --quiet) in CI + the visibility-drift workflow.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_topics_yaml.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_topics_yaml.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_topics_yaml.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_topics_yaml — slug regex', () => {
    it('SLUG_RE mirrors ^[a-z0-9][a-z0-9-]*$', () => {
        expect(mod.SLUG_RE.test('mcp-server')).toBe(true);
        expect(mod.SLUG_RE.test('ai')).toBe(true);
        expect(mod.SLUG_RE.test('-leading-dash')).toBe(false);
        expect(mod.SLUG_RE.test('Upper')).toBe(false);
        expect(mod.SLUG_RE.test('has space')).toBe(false);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_topics_yaml — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte (workflow invocation)', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet byte-for-byte (ci-fast invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
