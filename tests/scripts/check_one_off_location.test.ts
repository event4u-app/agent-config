// Tests for src/scripts/check_one_off_location.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (find_violations, ARCHIVE_MONTH_RE) plus a golden-parity
// layer (python3 vs tsx) on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ARCHIVE_MONTH_RE, find_violations } from '../../src/scripts/check_one_off_location.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_one_off_location.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_one_off_location.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_one_off_location — behaviour', () => {
    it('the repo has no out-of-archive one-off scripts', () => {
        // The shipped tree must be clean (matches the CI invocation).
        expect(find_violations()).toEqual([]);
    });

    it('ARCHIVE_MONTH_RE matches YYYY-MM only', () => {
        expect(ARCHIVE_MONTH_RE.test('2026-06')).toBe(true);
        expect(ARCHIVE_MONTH_RE.test('2026-6')).toBe(false);
        expect(ARCHIVE_MONTH_RE.test('june')).toBe(false);
        expect(ARCHIVE_MONTH_RE.test('2026-06-01')).toBe(false);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_one_off_location — golden parity (python3 vs tsx)', () => {
    it.each([[[]], [['--quiet']]])('matches byte-for-byte for args %j', (args) => {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
