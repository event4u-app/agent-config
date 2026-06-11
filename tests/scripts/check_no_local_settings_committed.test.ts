// Tests for src/scripts/check_no_local_settings_committed.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module. Focused differential suite over the
// pure helper (tracked_local_settings basename match) plus a golden-parity
// layer that runs python3 vs tsx on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_no_local_settings_committed.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_local_settings_committed.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_local_settings_committed.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_no_local_settings_committed — constants', () => {
    it('LOCAL_FILE is the per-machine override file name', () => {
        expect(mod.LOCAL_FILE).toBe('.agent-settings.local.yml');
    });

    it('tracked_local_settings returns a list (real repo has none tracked)', () => {
        // The repo gitignores the local file; nested or absent → empty list.
        const out = mod.tracked_local_settings();
        expect(Array.isArray(out)).toBe(true);
        for (const p of out) {
            expect(p.split('/').pop()).toBe('.agent-settings.local.yml');
        }
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_no_local_settings_committed — golden parity (python3 vs tsx)', () => {
    it('matches byte-for-byte on the real repo', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
