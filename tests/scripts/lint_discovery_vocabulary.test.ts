// Tests for src/scripts/lint_discovery_vocabulary.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module. This is a focused differential
// suite over the public helpers (requires-edge resolution, cycle detection)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_discovery_vocabulary.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_discovery_vocabulary.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_discovery_vocabulary.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_discovery_vocabulary — behavioural spec', () => {
    it('_requires_of prefers requires, falls back to requires_hint, else []', () => {
        expect(mod._requires_of({ requires: ['a', 'b'] })).toEqual(['a', 'b']);
        expect(mod._requires_of({ requires_hint: ['c'] })).toEqual(['c']);
        expect(mod._requires_of({ requires: [], requires_hint: ['d'] })).toEqual(['d']);
        expect(mod._requires_of({})).toEqual([]);
    });

    it('_detect_requires_cycle returns null for an acyclic graph', () => {
        const packs = [
            { id: 'a', requires: ['b'] },
            { id: 'b', requires: [] },
        ];
        expect(mod._detect_requires_cycle(packs)).toBeNull();
    });

    it('_detect_requires_cycle finds a 2-node cycle', () => {
        const packs = [
            { id: 'a', requires: ['b'] },
            { id: 'b', requires: ['a'] },
        ];
        expect(mod._detect_requires_cycle(packs)).toEqual(['a', 'b', 'a']);
    });

    it('_detect_requires_cycle ignores dangling edges (reported elsewhere)', () => {
        const packs = [{ id: 'a', requires: ['nope'] }];
        expect(mod._detect_requires_cycle(packs)).toBeNull();
    });

    it('frozen ADR vocab sets are non-empty', () => {
        expect(mod.ADR_WORKSPACES.size).toBeGreaterThan(0);
        expect(mod.ADR_PACKS.size).toBeGreaterThan(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_discovery_vocabulary — golden parity (python3 vs tsx)', () => {
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
