/**
 * Contract + cross-runtime crypto-parity tests for
 * `src/scripts/_lib/link_crypto.ts`.
 *
 * Part A — in-process behavior contract: round-trip, tamper detection,
 * wrong-key rejection, token shape, multi-key fallback, `is_token`,
 * `ValueError` on empty key / non-token / no-key.
 *
 * Part B — cross-runtime crypto parity (ADR-092): a token produced by the
 * Python original (`src/scripts/_lib/link_crypto.py`) decrypts under the TS
 * twin and vice versa, proving the PBKDF2 + HMAC-keystream + encrypt-then-MAC
 * scheme is byte-for-byte identical across runtimes. Skipped when python3 is
 * unavailable.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    MAGIC,
    ValueError,
    decrypt,
    encrypt,
    is_token,
    resolve_keys,
} from '../../src/scripts/_lib/link_crypto.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PY_LIB = path.join(REPO_ROOT, 'src', 'scripts', '_lib');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

const KEY = 'test-key-abc123';
const KEY2 = 'second-key-xyz789';
const SECRET = 'https://example.com/path?to=secret#frag — üñïçödé';

// --- Part A: in-process contract --------------------------------------------

describe('link_crypto — contract', () => {
    it('round-trips plaintext', () => {
        const tok = encrypt(SECRET, KEY);
        expect(is_token(tok)).toBe(true);
        expect(tok.startsWith(`${MAGIC}:`)).toBe(true);
        expect(decrypt(tok, KEY)).toBe(SECRET);
    });

    it('each encryption is non-deterministic (fresh salt + nonce)', () => {
        expect(encrypt(SECRET, KEY)).not.toBe(encrypt(SECRET, KEY));
    });

    it('rejects the wrong key', () => {
        const tok = encrypt(SECRET, KEY);
        expect(() => decrypt(tok, KEY2)).toThrow(/decryption failed/);
    });

    it('detects tampering (authentication failure)', () => {
        const tok = encrypt(SECRET, KEY);
        // Flip a byte in the base64 body.
        const body = tok.slice(MAGIC.length + 1);
        const buf = Buffer.from(body, 'base64');
        buf[buf.length - 1] = (buf[buf.length - 1] as number) ^ 0xff;
        const tampered = `${MAGIC}:` + buf.toString('base64');
        expect(() => decrypt(tampered, KEY)).toThrow(/decryption failed/);
    });

    it('multi-key fallback tries each key in order', () => {
        const tok = encrypt(SECRET, KEY2);
        // Project key (KEY) fails → falls back to global (KEY2).
        expect(decrypt(tok, [KEY, KEY2])).toBe(SECRET);
    });

    it('empty key → ValueError', () => {
        expect(() => encrypt('x', '')).toThrow(ValueError);
    });

    it('non-token → ValueError', () => {
        expect(() => decrypt('not-a-token', KEY)).toThrow(ValueError);
        expect(() => decrypt('not-a-token', KEY)).toThrow(/not an ENC1 token/);
    });

    it('no key available → ValueError', () => {
        const tok = encrypt(SECRET, KEY);
        expect(() => decrypt(tok, [])).toThrow(/no decryption key available/);
    });

    it('is_token is type-safe on non-strings', () => {
        expect(is_token(123 as unknown as string)).toBe(false);
        expect(is_token('plain')).toBe(false);
        expect(is_token(`${MAGIC}:abc`)).toBe(true);
    });

    it('resolve_keys returns an array (no key file in tmp cwd)', () => {
        // Smoke: callable, returns deduped string[]. Real key resolution is
        // environment-dependent; we only assert the shape here.
        expect(Array.isArray(resolve_keys('/nonexistent-root'))).toBe(true);
    });
});

// --- Part B: cross-runtime crypto parity (python3 ↔ tsx) --------------------

const PY_ENCRYPT = [
    'import sys',
    'sys.path.insert(0, sys.argv[1])',
    'import link_crypto as m',
    'sys.stdout.write(m.encrypt(sys.argv[2], sys.argv[3]))',
].join('\n');

const PY_DECRYPT = [
    'import sys',
    'sys.path.insert(0, sys.argv[1])',
    'import link_crypto as m',
    'sys.stdout.write(m.decrypt(sys.argv[2], sys.argv[3]))',
].join('\n');

describe.skipIf(!py3)('link_crypto — cross-runtime crypto parity', () => {
    it('python3-encrypted token decrypts under the TS twin', () => {
        const py = spawnSync('python3', ['-c', PY_ENCRYPT, PY_LIB, SECRET, KEY], { encoding: 'utf8' });
        expect(py.status).toBe(0);
        const token = py.stdout;
        expect(is_token(token)).toBe(true);
        expect(decrypt(token, KEY)).toBe(SECRET);
    });

    it('TS-encrypted token decrypts under the Python original', () => {
        const token = encrypt(SECRET, KEY);
        const py = spawnSync('python3', ['-c', PY_DECRYPT, PY_LIB, token, KEY], { encoding: 'utf8' });
        expect(py.stderr).toBe('');
        expect(py.status).toBe(0);
        expect(py.stdout).toBe(SECRET);
    });

    it('Python rejects a TS token under the wrong key (same failure surface)', () => {
        const token = encrypt(SECRET, KEY);
        const py = spawnSync('python3', ['-c', PY_DECRYPT, PY_LIB, token, KEY2], { encoding: 'utf8' });
        expect(py.status).not.toBe(0);
    });
});
