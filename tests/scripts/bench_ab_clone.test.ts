// Tests for src/scripts/bench_ab_clone.ts (Phase 1 Step 2 A/B clone builder).
//
// The Python original is deleted, so this is a python-free intent suite over
// the tsx CLI. The script hardcodes the gitignored clones path
// `internal/bench/ab/clones/`; the CLI blocks build there and assert:
//   - `--print-shape-hash` matches the in-process pure function;
//   - the `without` clone build is deterministic (tree + manifest identical
//     across two independent rebuilds — fixture copy fidelity);
//   - the `with` clone manifest carries the surface-layer shape hash;
//   - re-running without --refresh is idempotent ("already present" notice).
// Every block removes the clones dir afterwards so the working tree is left
// exactly as found (the dir is gitignored, so this is zero git drift).

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
    releaseClonesLock,
    removeClones,
    runScript,
} from './_bench_ab.js';
import { target_shape_hash } from '../../src/scripts/bench_ab_clone.js';

const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_clone.ts');
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

describe.skipIf(!HAVE_FIXTURE)('bench_ab_clone — CLI (tsx)', () => {
    beforeAll(() => acquireClonesLock());
    afterAll(() => releaseClonesLock());
    beforeEach(() => removeClones());
    afterEach(() => removeClones());

    it('--print-shape-hash matches the in-process pure function', () => {
        const ts = runScript(TSX_BIN, TS_SCRIPT, ['--print-shape-hash']);
        expect(ts.status, ts.stderr).toBe(0);
        expect(ts.stdout.trim()).toBe(target_shape_hash());
    });

    it('without clone: build is deterministic (tree + manifest identical across rebuilds)', () => {
        const first = runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'without']);
        expect(first.status, first.stderr).toBe(0);
        expect(first.stdout).toContain('built without clone');
        const firstManifest = readFileSync(join(CLONES, 'without', '.bench-ab-manifest.json'), 'utf-8');
        const firstTree = hashTree(join(CLONES, 'without'));
        removeClones();

        const second = runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'without']);
        expect(second.status, second.stderr).toBe(0);
        const secondManifest = readFileSync(join(CLONES, 'without', '.bench-ab-manifest.json'), 'utf-8');
        const secondTree = hashTree(join(CLONES, 'without'));

        expect(secondManifest).toBe(firstManifest);
        expect(secondTree).toEqual(firstTree);
        expect(second.stdout).toBe(first.stdout);

        const manifest = JSON.parse(firstManifest) as Record<string, unknown>;
        expect(manifest['variant']).toBe('without');
        expect(manifest['reasoning_enabled']).toBe(false);
        expect(manifest['target_shape_hash']).toBe(target_shape_hash());
        expect(manifest['with_surfaces']).toEqual([]);
    });

    it('with clone: manifest carries the surface-layer shape hash', () => {
        const ts = runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'with']);
        expect(ts.status, ts.stderr).toBe(0);
        const manifest = JSON.parse(
            readFileSync(join(CLONES, 'with', '.bench-ab-manifest.json'), 'utf-8'),
        ) as Record<string, unknown>;
        expect(manifest['variant']).toBe('with');
        expect(manifest['target_shape_hash']).toBe(target_shape_hash());
    });

    it('idempotent: re-running without --refresh leaves the clone (notice printed)', () => {
        const build = runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'without']);
        expect(build.status, build.stderr).toBe(0);
        const rerun = runScript(TSX_BIN, TS_SCRIPT, ['--variant', 'without']);
        expect(rerun.status, rerun.stderr).toBe(0);
        expect(rerun.stdout).toContain('already present');
        expect(rerun.stdout).toContain('--refresh');
    });
});
