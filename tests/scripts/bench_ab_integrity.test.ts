// Tests for src/scripts/bench_ab_integrity.ts (Phase 1 Step 3 A/B clone check).
//
// The Python original has no dedicated test suite, so this is a focused
// differential suite (ADR-090 parity contract). The script hardcodes the
// gitignored clones path `internal/bench/ab/clones/`. We:
//   - exercise the pure `is_under_allowed_path` predicate directly;
//   - golden-test the missing-clone error path (no clones present) for
//     identical exit + stderr;
//   - golden-test the clean PASS path over real clones (built once via the
//     ts clone twin) for identical exit + stdout, both plain and --verbose.
// Every block removes the clones dir afterwards (gitignored → zero git
// drift). Skipped without python3 or the fixture.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    CLONES,
    FIXTURE,
    REPO_ROOT,
    TSX_BIN,
    acquireClonesLock,
    pythonAvailable,
    releaseClonesLock,
    removeClones,
    runScript,
} from './_bench_ab.js';
import { is_under_allowed_path } from '../../src/scripts/bench_ab_integrity.js';

const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_integrity.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_integrity.py');
const CLONE_TS = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_clone.ts');
const HAVE_PYTHON = pythonAvailable();
const HAVE_FIXTURE = existsSync(FIXTURE);

describe('bench_ab_integrity.ts — is_under_allowed_path', () => {
    it('allows the surface dirs + manifest, rejects task-target files', () => {
        expect(is_under_allowed_path('.claude/skills/x/SKILL.md')).toBe(true);
        expect(is_under_allowed_path('.augment/rules/foo.md')).toBe(true);
        expect(is_under_allowed_path('AGENTS.md')).toBe(true);
        expect(is_under_allowed_path('CLAUDE.md')).toBe(true);
        expect(is_under_allowed_path('.bench-ab-manifest.json')).toBe(true);
        // A task-target file is NOT allowed to diverge.
        expect(is_under_allowed_path('src/parser.ts')).toBe(false);
        expect(is_under_allowed_path('package.json')).toBe(false);
        // AGENTS.md is only allowed at the head component, not nested.
        expect(is_under_allowed_path('sub/AGENTS.md')).toBe(false);
        expect(is_under_allowed_path('')).toBe(false);
    });
});

describe.skipIf(!HAVE_PYTHON || !HAVE_FIXTURE)('bench_ab_integrity — golden parity', () => {
    beforeAll(() => acquireClonesLock());
    afterAll(() => releaseClonesLock());
    beforeEach(() => removeClones());
    afterEach(() => removeClones());

    it('missing clones: identical exit + stderr', () => {
        // No clones present.
        const py = runScript('python3', PY_SCRIPT, []);
        const ts = runScript(TSX_BIN, TS_SCRIPT, []);
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
        expect(py.status).toBe(1);
    });

    it('clean clones: identical exit + stdout (plain and --verbose)', () => {
        // Build both clones once (ts twin is byte-identical to the python one).
        const build = runScript(TSX_BIN, CLONE_TS, ['--variant', 'both']);
        expect(build.status, build.stderr).toBe(0);
        expect(existsSync(join(CLONES, 'with'))).toBe(true);
        expect(existsSync(join(CLONES, 'without'))).toBe(true);

        const py = runScript('python3', PY_SCRIPT, []);
        const ts = runScript(TSX_BIN, TS_SCRIPT, []);
        expect(ts.status, ts.stderr).toBe(0);
        expect(py.status, py.stderr).toBe(0);
        expect(ts.stdout).toBe(py.stdout);

        const pyV = runScript('python3', PY_SCRIPT, ['--verbose']);
        const tsV = runScript(TSX_BIN, TS_SCRIPT, ['--verbose']);
        expect(tsV.status, tsV.stderr).toBe(0);
        expect(tsV.stdout).toBe(pyV.stdout);
    });
});
