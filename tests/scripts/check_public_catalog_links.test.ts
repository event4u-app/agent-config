// Tests for src/scripts/check_public_catalog_links.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused spec over _shipped_roots / _resolve /
// _under_shipped_surface plus golden parity (python3 vs tsx) on the REAL
// REPO for the default and --quiet invocations.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as cpcl from '../../src/scripts/check_public_catalog_links.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_public_catalog_links.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_public_catalog_links.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('check_public_catalog_links — helpers', () => {
    it('_shipped_roots splits dirs and files from package.json#files', () => {
        const [dirs, files] = cpcl._shipped_roots();
        expect(dirs instanceof Set).toBe(true);
        expect(files instanceof Set).toBe(true);
        // No trailing slashes retained on dir entries.
        for (const d of dirs) {
            expect(d.endsWith('/')).toBe(false);
        }
    });

    it('_resolve returns null for external / out-of-root hrefs', () => {
        expect(cpcl._resolve('https://example.com')).toBeNull();
        expect(cpcl._resolve('mailto:x@y.z')).toBeNull();
        expect(cpcl._resolve('')).toBeNull();
        expect(cpcl._resolve('#anchor-only')).toBeNull();
    });

    it('_under_shipped_surface matches exact files and dir prefixes', () => {
        const dirs = new Set(['docs', 'dist/agent-src']);
        const files = new Set(['README.md']);
        expect(cpcl._under_shipped_surface('README.md', dirs, files)).toBe(true);
        expect(cpcl._under_shipped_surface('docs', dirs, files)).toBe(true);
        expect(cpcl._under_shipped_surface('docs/catalog.md', dirs, files)).toBe(true);
        expect(cpcl._under_shipped_surface('src/x.ts', dirs, files)).toBe(false);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_public_catalog_links — golden parity (python3 vs tsx)', () => {
    function expectMatch(args: readonly string[]) {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default matches byte-for-byte', () => {
        expectMatch([]);
    });

    it('--quiet matches byte-for-byte', () => {
        expectMatch(['--quiet']);
    });
});
