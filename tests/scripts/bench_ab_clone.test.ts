// Tests for src/scripts/bench_ab_clone.ts (Phase 1 Step 2 A/B clone builder).
//
// The Python original has no dedicated test suite, so this is a focused
// differential suite (ADR-092 parity contract). The script hardcodes the
// gitignored clones path `internal/bench/ab/clones/`; the golden-parity
// blocks build there under python3 vs tsx and assert:
//   - `--print-shape-hash` is byte-identical (validates json.dumps of the
//     surface tuple + the pathlib-sorted fixture hashing);
//   - the `without` clone tree is byte-identical (fixture copy fidelity +
//     manifest);
//   - the `with` clone manifest is byte-identical (surface-layer hash).
// Every block removes the clones dir afterwards so the working tree is left
// exactly as found (the dir is gitignored, so this is zero git drift).
// Skipped without python3.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    CLONES,
    FIXTURE,
    REPO_ROOT,
    TSX_BIN,
    acquireClonesLock,
    hashTree,
    pythonAvailable,
    releaseClonesLock,
    removeClones,
    runScript,
} from './_bench_ab.js';
import { target_shape_hash } from '../../src/scripts/bench_ab_clone.js';

const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_clone.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_clone.py');
const HAVE_PYTHON = pythonAvailable();
const HAVE_FIXTURE = existsSync(FIXTURE);

describe('bench_ab_clone.ts — pure layer', () => {
    it('target_shape_hash is a 16-hex-char digest of the fixture', () => {
        if (!HAVE_FIXTURE) {
            return;
        }
        const h = target_shape_hash();
        expect(h).toMatch(/^[0-9a-f]{16}$/);
        // Stable across calls (pure function of the fixture tree).
        expect(target_shape_hash()).toBe(h);
    });
});

describe.skipIf(!HAVE_PYTHON || !HAVE_FIXTURE)('bench_ab_clone — golden parity', () => {
    beforeAll(() => acquireClonesLock());
    afterAll(() => releaseClonesLock());
    beforeEach(() => removeClones());
    afterEach(() => removeClones());

    it('--print-shape-hash is byte-identical (py vs tsx)', () => {
        const py = runScript('python3', PY_SCRIPT, ['--print-shape-hash']);
        const ts = runScript(TSX_BIN, TS_SCRIPT, ['--print-shape-hash']);
        expect(py.status, py.stderr).toBe(0);
        expect(ts.status, ts.stderr).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
        // and matches the in-process pure function.
        expect(ts.stdout.trim()).toBe(target_shape_hash());
    });

    it('without clone: tree + manifest byte-identical', () => {
        const py = runScript('python3', PY_SCRIPT, ['--variant', 'without']);
        expect(py.status, py.stderr).toBe(0);
        const pyManifest = readFileSync(join(CLONES, 'without', '.bench-ab-manifest.json'), 'utf-8');
        const pyTree = hashTree(join(CLONES, 'without'));
        removeClones();

        const ts = runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'without']);
        expect(ts.status, ts.stderr).toBe(0);
        const tsManifest = readFileSync(join(CLONES, 'without', '.bench-ab-manifest.json'), 'utf-8');
        const tsTree = hashTree(join(CLONES, 'without'));

        expect(tsManifest).toBe(pyManifest);
        expect(tsTree).toEqual(pyTree);
        // stdout: absolute clone path is identical between runtimes.
        expect(ts.stdout).toBe(py.stdout);
    });

    it('with clone: manifest byte-identical (surface-layer hash)', () => {
        const py = runScript('python3', PY_SCRIPT, ['--variant', 'with']);
        expect(py.status, py.stderr).toBe(0);
        const pyManifest = readFileSync(join(CLONES, 'with', '.bench-ab-manifest.json'), 'utf-8');
        removeClones();

        const ts = runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'with']);
        expect(ts.status, ts.stderr).toBe(0);
        const tsManifest = readFileSync(join(CLONES, 'with', '.bench-ab-manifest.json'), 'utf-8');

        expect(tsManifest).toBe(pyManifest);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('idempotent: re-running without --refresh leaves the clone (identical notice)', () => {
        runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'without']);
        const py = runScript('python3', PY_SCRIPT, ['--variant', 'without']);
        const ts = runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'without']);
        // Both report "already present" with the same absolute path.
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stdout).toContain('already present');
    });
});
