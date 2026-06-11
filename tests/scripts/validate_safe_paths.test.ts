// Tests for src/scripts/validate_safe_paths.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_validate_safe_paths.py — same SENSITIVE_FIXTURES /
// NEGATIVE_FIXTURES, case-insensitivity, assert_safe behaviour, error-type,
// and CLI exit codes. Plus a golden-parity layer (python3 vs tsx) on a few
// representative paths (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SensitivePathError, assert_safe, is_sensitive } from '../../src/scripts/validate_safe_paths.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_safe_paths.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_safe_paths.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// One positive fixture per denylist entry — covers SENSITIVE_BASENAME_REGEX,
// SENSITIVE_PATH_COMPONENTS, and the SENSITIVE_NAME_TOKENS substring fallback.
const SENSITIVE_FIXTURES = [
    '.env',
    '.env.local',
    '.env.production',
    '.netrc',
    'credentials',
    'credentials.json',
    'secret',
    'secrets.txt',
    'password.yaml',
    'passwords.csv',
    'id_rsa',
    'id_rsa.pub',
    'id_ed25519',
    'id_ecdsa.pub',
    'id_dsa',
    'authorized_keys',
    'known_hosts',
    'server.pem',
    'tls.key',
    'client.p12',
    'bundle.pfx',
    'cert.crt',
    'ca.cer',
    'trust.jks',
    'keystore.keystore',
    'signed.asc',
    'encrypted.gpg',
    '.ssh/known_hosts',
    '.aws/credentials',
    '.gnupg/private-keys-v1.d/foo.key',
    '.kube/config',
    '.docker/config.json',
    'prod-secret-token.txt',
    'my_api_key.yaml',
    'ApiKey.json',
    'user.password.txt',
    'private-key-backup.bin',
];

const NEGATIVE_FIXTURES = [
    'README.md',
    'docs/contracts/telegraph-speak.md',
    'templates/AGENTS.md',
    'src/scripts/condense.py',
    'tests/test_validate_safe_paths.py',
    'dist/agent-src/rules/commit-policy.md',
    'agents/roadmaps/step-16-telegraph-substance.md',
    'Taskfile.yml',
];

describe('is_sensitive', () => {
    it.each(SENSITIVE_FIXTURES)('flags sensitive: %s', (rel) => {
        expect(is_sensitive(rel)).toBe(true);
    });

    it.each(NEGATIVE_FIXTURES)('passes safe: %s', (rel) => {
        expect(is_sensitive(rel)).toBe(false);
    });

    it('is case-insensitive', () => {
        expect(is_sensitive('.ENV.LOCAL')).toBe(true);
        expect(is_sensitive('CREDENTIALS.json')).toBe(true);
        expect(is_sensitive('ID_RSA')).toBe(true);
    });
});

describe('assert_safe', () => {
    it('throws on sensitive', () => {
        expect(() => assert_safe('.env.local')).toThrow(SensitivePathError);
    });

    it('is silent on safe', () => {
        expect(assert_safe('README.md')).toBeUndefined();
    });

    it('error is an Error subclass (Python: subclass of ValueError)', () => {
        const err = new SensitivePathError('x');
        expect(err).toBeInstanceOf(Error);
    });
});

// --- Golden parity on representative paths ----------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('validate_safe_paths — golden parity (python3 vs tsx)', () => {
    function runPy(arg: string) {
        return spawnSync('python3', [PY_SCRIPT, arg], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(arg: string) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, arg], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('CLI rejects a sensitive path identically', () => {
        const py = runPy('.env.local');
        const ts = runTs('.env.local');
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('CLI accepts a safe path identically', () => {
        const py = runPy('README.md');
        const ts = runTs('README.md');
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
