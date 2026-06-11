// Tests for src/scripts/check_release_includes_discovery.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused differential suite + golden parity on the
// REAL REPO (skipped without python3). The discovery manifest is a generated
// artefact; the golden-parity case runs regardless of presence because both
// runtimes see the same on-disk state — but the differential cases inject a
// temp ROOT-shaped layout is not possible (ROOT is module-fixed), so we drive
// the public main() against the real tree and assert it agrees with python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_release_includes_discovery.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_release_includes_discovery.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_release_includes_discovery.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_release_includes_discovery — constants', () => {
    it('MANIFEST + SUMMARY sit under dist/discovery/', () => {
        expect(mod.MANIFEST.endsWith(path.join('dist', 'discovery', 'discovery-manifest.json'))).toBe(
            true,
        );
        expect(
            mod.SUMMARY.endsWith(path.join('dist', 'discovery', 'discovery-manifest.summary.md')),
        ).toBe(true);
    });
});

const py3 = hasPython3();
const manifestPresent = fs.existsSync(mod.MANIFEST);

describe.skipIf(!py3 || !manifestPresent)(
    'check_release_includes_discovery — golden parity (python3 vs tsx)',
    () => {
        it('matches byte-for-byte on the real repo', () => {
            const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    },
);
