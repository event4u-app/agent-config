// Tests for src/scripts/lint_ghostwriter_source.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Light behavioural spec over exported pure helpers
// (validate_alias, is_latin_or_allowed) plus the golden-parity layer that runs
// python3 vs tsx on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as lgs from '../../src/scripts/lint_ghostwriter_source.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_ghostwriter_source.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_ghostwriter_source.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_ghostwriter_source — validate_alias', () => {
    it('accepts a plain Latin alias', () => {
        expect(lgs.validate_alias('Alex')).toBeNull();
    });

    it('rejects a non-string alias with the Python type name', () => {
        expect(lgs.validate_alias(42)).toBe('alias must be a string, got int');
        expect(lgs.validate_alias(true)).toBe('alias must be a string, got bool');
    });

    it('rejects an alias shorter than ALIAS_MIN_LEN', () => {
        expect(lgs.ALIAS_MIN_LEN).toBe(2);
        expect(lgs.validate_alias('x')).toBe("alias 'x' is shorter than 2 characters");
    });

    it('rejects an alias containing a non-Latin character', () => {
        const err = lgs.validate_alias('Аlex'); // Cyrillic А (homoglyph)
        expect(err).not.toBeNull();
        expect(err).toContain('non-Latin or homoglyph-prone');
    });
});

describe('lint_ghostwriter_source — is_latin_or_allowed', () => {
    it('accepts ASCII letters and digits', () => {
        expect(lgs.is_latin_or_allowed('A')).toBe(true);
        expect(lgs.is_latin_or_allowed('z')).toBe(true);
        expect(lgs.is_latin_or_allowed('7')).toBe(true);
    });
    it('rejects a Cyrillic homoglyph', () => {
        expect(lgs.is_latin_or_allowed('А')).toBe(false); // U+0410
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_ghostwriter_source — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches the --quiet run byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
