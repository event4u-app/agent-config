// Tests for src/scripts/bench_ab_integrity.ts (Phase 1 Step 3 A/B clone check).
//
// The Python original is deleted, so this is a python-free intent suite. The
// script hardcodes the gitignored clones path `internal/bench/ab/clones/`. We:
//   - exercise the pure `is_under_allowed_path` predicate directly;
//   - exercise the missing-clone error path (no clones present) for
//     exit 1 + actionable stderr;
//   - exercise the clean PASS path over real clones (built via the tsx clone
//     twin) for exit 0 + verdict line, both plain and --verbose.
// Every block removes the clones dir afterwards (gitignored → zero git
// drift). Skipped without the fixture.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    CLONES,
    FIXTURE,
    REPO_ROOT,
    TSX_BIN,
    acquireClonesLock,
    releaseClonesLock,
    removeClones,
    runScript,
} from './_bench_ab.js';
import { is_under_allowed_path } from '../../src/scripts/bench_ab_integrity.js';

const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_integrity.ts');
const CLONE_TS = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_clone.ts');
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

describe.skipIf(!HAVE_FIXTURE)('bench_ab_integrity — CLI (tsx)', () => {
    beforeAll(() => acquireClonesLock());
    afterAll(() => releaseClonesLock());
    beforeEach(() => removeClones());
    afterEach(() => removeClones());

    it('missing clones: exit 1 + actionable stderr', () => {
        // No clones present.
        const ts = runScript(TSX_BIN, TS_SCRIPT, []);
        expect(ts.status).toBe(1);
        expect(ts.stderr).toContain('clone missing');
        expect(ts.stderr).toContain('bench_ab_clone');
    });

    it('clean clones: exit 0 + surface-only verdict (plain and --verbose)', () => {
        // Build both clones once via the clone twin.
        const build = runScript(TSX_BIN, CLONE_TS, ['--variant', 'both']);
        expect(build.status, build.stderr).toBe(0);
        expect(existsSync(join(CLONES, 'with'))).toBe(true);
        expect(existsSync(join(CLONES, 'without'))).toBe(true);

        const ts = runScript(TSX_BIN, TS_SCRIPT, []);
        expect(ts.status, ts.stderr).toBe(0);
        expect(ts.stdout).toContain('clones differ only at the allowed surface');

        const tsV = runScript(TSX_BIN, TS_SCRIPT, ['--verbose']);
        expect(tsV.status, tsV.stderr).toBe(0);
        expect(tsV.stdout).toMatch(/with=\d+ files, without=\d+ files, shared=\d+/);
        expect(tsV.stdout).toContain('clones differ only at the allowed surface');
    });
});
