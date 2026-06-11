// Tests for src/scripts/check_release_trunk_sync.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the pure helpers (_parse_semver, _prior_release, _bootstrap_ok)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO
// (the current branch is a non-release class → both no-op exit 0).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as rts from '../../src/scripts/check_release_trunk_sync.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_release_trunk_sync.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_release_trunk_sync.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_release_trunk_sync — behavioural spec', () => {
    it('_parse_semver parses a valid tag', () => {
        expect(rts._parse_semver('6.0.0')).toEqual([6, 0, 0]);
        expect(rts._parse_semver('12.3.45')).toEqual([12, 3, 45]);
    });

    it('_parse_semver rejects non-semver', () => {
        expect(rts._parse_semver('v6.0.0')).toBeNull();
        expect(rts._parse_semver('6.0')).toBeNull();
        expect(rts._parse_semver('release/6.0.0')).toBeNull();
    });

    it('_prior_release picks the highest tag strictly below the target', () => {
        const tags: [number, number, number][] = [
            [5, 0, 0],
            [5, 9, 0],
            [6, 0, 0],
            [6, 1, 0],
        ];
        expect(rts._prior_release([6, 1, 0], tags)).toEqual([6, 0, 0]);
        expect(rts._prior_release([6, 0, 0], tags)).toEqual([5, 9, 0]);
    });

    it('_prior_release returns null when nothing is earlier', () => {
        expect(rts._prior_release([5, 0, 0], [[5, 0, 0], [6, 0, 0]])).toBeNull();
    });

    it('RELEASE_BRANCH_RE matches a release branch', () => {
        expect(rts.RELEASE_BRANCH_RE.test('release/6.0.0')).toBe(true);
        expect(rts.RELEASE_BRANCH_RE.test('feat/x')).toBe(false);
        expect(rts.RELEASE_BRANCH_RE.test('main')).toBe(false);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('check_release_trunk_sync — golden parity (python3 vs tsx)', () => {
    it('non-release branch class → identical no-op', () => {
        // The worktree branch is not `release/X.Y.Z`; both must no-op exit 0.
        // Clear the CI-override env vars so the gate reads the real branch.
        const env = { ...process.env };
        delete env['GITHUB_HEAD_REF'];
        delete env['GITHUB_REF_NAME'];
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8', env });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8', env });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('forced release-branch ref via GITHUB_REF_NAME → identical', () => {
        // Force a release-class branch; the gate then reads the real tag set.
        // Whatever the verdict (no tags / behind / ok), python and tsx agree.
        const env: NodeJS.ProcessEnv = { ...process.env, GITHUB_REF_NAME: 'release/99.0.0' };
        delete env['GITHUB_HEAD_REF'];
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8', env });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8', env });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
