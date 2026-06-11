// Tests for src/scripts/lint_discovery_manifest.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_discovery_manifest.py exists (tests/test_build_discovery_
// manifest.py covers the *builder*, not this validator). This is a focused
// differential suite over the exported `_serialize` (canonical JSON used in
// the checksum) and `_check_checksum`, plus a golden-parity layer running
// python3 vs tsx on the REAL REPO manifest — the linter's real CI invocation
// (`./scripts-run src/scripts/lint_discovery_manifest --quiet`), skipped
// without python3.
//
// DOCUMENTED DIVERGENCE (from the .ts header): the Python original imports
// `jsonschema`; the TS twin ships a Draft-2020-12 subset validator, so the
// `schema error: <msg>` wording on an INVALID manifest may differ. The
// checksum/vocab checks and the exit codes are byte-identical, and the OK
// path (the committed, valid manifest) is asserted byte-for-byte below.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as dm from '../../src/scripts/lint_discovery_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_discovery_manifest.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_discovery_manifest.py');
const MANIFEST = path.join(REPO_ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
function manifestExists(): boolean {
    try {
        fs.statSync(MANIFEST);
        return true;
    } catch {
        return false;
    }
}

describe('lint_discovery_manifest._serialize', () => {
    it('produces sorted-key, 2-space-indented JSON + trailing newline', () => {
        const out = dm._serialize({ b: 2, a: [1, 2], c: { z: 1, y: 2 } });
        expect(out).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": 2,\n  "c": {\n    "y": 2,\n    "z": 1\n  }\n}\n');
    });
});

describe('lint_discovery_manifest._check_checksum', () => {
    it('flags a malformed checksum value', () => {
        const err = dm._check_checksum({ checksum: 'not-a-hash' });
        expect(err).not.toBeNull();
        expect(err).toContain('checksum: malformed value');
    });
    it('flags a checksum mismatch', () => {
        const err = dm._check_checksum({ checksum: 'sha256:' + '0'.repeat(64) });
        expect(err).not.toBeNull();
        expect(err).toContain('checksum mismatch');
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const canParity = hasPython3() && manifestExists();

describe.skipIf(!canParity)('lint_discovery_manifest — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function same(args: readonly string[]): void {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('--quiet (real CI invocation) matches byte-for-byte', () => same(['--quiet']));
    it('default run matches byte-for-byte', () => same([]));
});
