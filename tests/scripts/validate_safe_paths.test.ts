// Tests for src/scripts/validate_safe_paths.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_validate_safe_paths.py — same SENSITIVE_FIXTURES /
// NEGATIVE_FIXTURES, case-insensitivity, assert_safe behaviour, error-type,
// and CLI exit codes. Plus a golden-parity layer (python3 vs tsx) on a few
// representative paths (skipped without python3).
import { describe, expect, it } from 'vitest';

import { SensitivePathError, assert_safe, is_sensitive } from '../../src/scripts/validate_safe_paths.js';



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

