// Tests for src/scripts/check_overlay_cascade_subdirs.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (ROW_RE, _parse_doc_table) plus a golden-parity layer
// (python3 vs tsx) on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ROW_RE, _parse_doc_table } from '../../src/scripts/check_overlay_cascade_subdirs.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_overlay_cascade_subdirs.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_overlay_cascade_subdirs.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_overlay_cascade_subdirs — table parse', () => {
    it('captures the final path segment as the kind, with markers', () => {
        const text = [
            '| `agents/overrides/` | ✅ yes | ✅ yes |',
            '| `agents/settings/contexts/` | ✅ | ❌ |',
            '| `agents/runtime/state/` | ❌ | ❌ |',
            'not a row',
        ].join('\n');
        const { all_kinds, cascade_yes, user_global_yes } = _parse_doc_table(text);
        expect([...all_kinds].sort()).toEqual(['contexts', 'overrides', 'state']);
        expect([...cascade_yes].sort()).toEqual(['contexts', 'overrides']);
        expect([...user_global_yes].sort()).toEqual(['overrides']);
    });

    it('ROW_RE only matches a backtick-fenced agents/.../<kind>/ first column', () => {
        expect(ROW_RE.test('| `agents/overrides/` | ✅ | ❌ |')).toBe(true);
        expect(ROW_RE.test('| agents/overrides/ | ✅ | ❌ |')).toBe(false);
        expect(ROW_RE.test('plain text agents/overrides/')).toBe(false);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_overlay_cascade_subdirs — golden parity (python3 vs tsx)', () => {
    it('matches byte-for-byte on the real repo', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
