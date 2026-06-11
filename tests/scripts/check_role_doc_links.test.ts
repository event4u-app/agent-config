// Tests for src/scripts/check_role_doc_links.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused differential suite over resolve() (external
// vs relative, #anchor stripping) plus golden parity on the REAL REPO
// (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_role_doc_links.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_role_doc_links.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_role_doc_links.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const DOC = path.join(mod.DOCS_DIR, 'getting-started-by-role.md');

describe('check_role_doc_links — resolve', () => {
    it('external URLs resolve to null', () => {
        expect(mod.resolve('https://example.com', DOC)).toBeNull();
        expect(mod.resolve('http://x', DOC)).toBeNull();
        expect(mod.resolve('mailto:a@b', DOC)).toBeNull();
    });

    it('empty / anchor-only links resolve to null', () => {
        expect(mod.resolve('#frag', DOC)).toBeNull();
    });

    it('relative links resolve under the doc dir', () => {
        const got = mod.resolve('contracts/foo.md', DOC);
        expect(got).toBe(path.join(mod.DOCS_DIR, 'contracts', 'foo.md'));
    });

    it('#anchor fragments are stripped before resolving', () => {
        const got = mod.resolve('contracts/foo.md#bar', DOC);
        expect(got).toBe(path.join(mod.DOCS_DIR, 'contracts', 'foo.md'));
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_role_doc_links — golden parity (python3 vs tsx)', () => {
    for (const args of [[], ['--quiet']] as const) {
        it(`matches byte-for-byte: ${args.join(' ') || '(no args)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
