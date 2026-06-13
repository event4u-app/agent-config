#!/usr/bin/env tsx
/**
 * link_crypto — encrypt/decrypt stored third-party package links.
 *
 * TypeScript twin of `src/scripts/_lib/link_crypto.py` (ADR-094). The public
 * API is mirrored EXACTLY — `encrypt`, `decrypt`, `is_token`, `project_key`,
 * `global_key`, `resolve_keys`, plus the CLI (`encrypt` / `decrypt` / `keygen`
 * / `keystatus`). The crypto scheme is replicated byte-for-byte against the
 * Python original so that a token produced by either runtime round-trips
 * identically under the other: PBKDF2-HMAC-SHA256 (200 000 iters, dklen 64) key
 * derivation, an HMAC-SHA256 counter-mode keystream, encrypt-then-MAC with
 * HMAC-SHA256, standard base64, constant-time tag compare. Every primitive has
 * an identical `node:crypto` counterpart, so encrypt-then-decrypt and the token
 * bytes are cross-runtime identical (no divergence doc needed).
 *
 * Why this exists
 * ---------------
 * This package never stores a *readable* link to, or name of, an external
 * source that inspired an idea (see the source-confidentiality sweep). Where a
 * source link genuinely has to be retained — e.g. the upstream URL + pin in
 * `agents/settings/contexts/skills-provenance.yml` for license / refresh
 * bookkeeping — it is stored **encrypted**, never in plaintext.
 *
 * Key resolution (per the maintainer's contract)
 * ----------------------------------------------
 * The symmetric key lives in `.agent-settings.yml` under
 * `secrets.link_encryption_key` and is **never committed** (the file is
 * gitignored). It is read in this order:
 *
 *   1. Project — `<project-root>/.agent-settings.yml`.
 *   2. User-global — `~/.event4u/agent-config/agent-settings.yml`
 *      (with the legacy-path fallback used by the rest of the suite).
 *
 * `encrypt` uses the first key it finds (project preferred). `decrypt` tries
 * the project key first and, only if that fails to authenticate, falls back to
 * the user-global key — matching "try the project key, if it doesn't work use
 * the global one".
 *
 * Threat model
 * ------------
 * The goal is **repo confidentiality**: someone browsing the committed tree (or
 * the published npm tarball / plugin mirror) must not be able to read which
 * external packages were used. It is authenticated symmetric encryption built
 * from standard-library primitives only (PBKDF2-HMAC-SHA256 key derivation, an
 * HMAC-SHA256 counter-mode keystream, encrypt-then-MAC with HMAC-SHA256). No
 * third-party crypto dependency is added (scope-control). This is not intended
 * to withstand an offline attacker who already holds the key file.
 *
 * Token format
 * ------------
 * `ENC1:<base64( salt[16] || nonce[16] || ciphertext || tag[32] )>`
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const MAGIC = 'ENC1';
const _SALT_LEN = 16;
const _NONCE_LEN = 16;
const _TAG_LEN = 32;
const _PBKDF2_ITERS = 200_000;
// `_KEY_PATH = "secrets.link_encryption_key"` — kept for documentation parity.
const _USER_GLOBAL = path.join(os.homedir(), '.event4u', 'agent-config', 'agent-settings.yml');
// Legacy user-global location kept readable for older installs.
const _USER_GLOBAL_LEGACY = path.join(os.homedir(), '.agent-config', 'agent-settings.yml');

// --------------------------------------------------------------------------- //
// Core crypto (stdlib only)
// --------------------------------------------------------------------------- //

/** Mirror `_derive` — PBKDF2-HMAC-SHA256, dklen 64, split into (enc_key, mac_key). */
function _derive(key: string, salt: Buffer): [Buffer, Buffer] {
    const dk = crypto.pbkdf2Sync(Buffer.from(key, 'utf-8'), salt, _PBKDF2_ITERS, 64, 'sha256');
    return [dk.subarray(0, 32), dk.subarray(32)]; // (enc_key, mac_key)
}

/** Mirror `_keystream` — HMAC-SHA256(enc_key, nonce || counter.to_bytes(8,"big")), counter from 0. */
function _keystream(encKey: Buffer, nonce: Buffer, n: number): Buffer {
    const chunks: Buffer[] = [];
    let total = 0;
    let counter = 0;
    while (total < n) {
        const ctr = Buffer.alloc(8);
        // Python `counter.to_bytes(8, "big")` — big-endian unsigned 64-bit.
        ctr.writeBigUInt64BE(BigInt(counter));
        const block = crypto.createHmac('sha256', encKey).update(nonce).update(ctr).digest();
        chunks.push(block);
        total += block.length;
        counter += 1;
    }
    return Buffer.concat(chunks).subarray(0, n);
}

/** Byte-wise XOR of two equal-length buffers (mirrors the Python zip-XOR). */
function _xor(a: Buffer, b: Buffer): Buffer {
    const out = Buffer.alloc(a.length);
    for (let i = 0; i < a.length; i += 1) {
        out[i] = (a[i] as number) ^ (b[i] as number);
    }
    return out;
}

/** Encrypt `plaintext` with `key` → an `ENC1:` token. Mirrors `encrypt`. */
export function encrypt(plaintext: string, key: string): string {
    if (!key) {
        throw new ValueError('empty encryption key');
    }
    const salt = crypto.randomBytes(_SALT_LEN);
    const nonce = crypto.randomBytes(_NONCE_LEN);
    const [encKey, macKey] = _derive(key, salt);
    const pt = Buffer.from(plaintext, 'utf-8');
    const ct = _xor(pt, _keystream(encKey, nonce, pt.length));
    const tag = crypto.createHmac('sha256', macKey).update(Buffer.concat([salt, nonce, ct])).digest();
    return `${MAGIC}:` + Buffer.concat([salt, nonce, ct, tag]).toString('base64');
}

/** Mirror `is_token`. */
export function is_token(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(`${MAGIC}:`);
}

/** Mirror `_decrypt_one`. */
function _decrypt_one(token: string, key: string): string {
    const raw = Buffer.from(token.slice(MAGIC.length + 1), 'base64');
    const salt = raw.subarray(0, _SALT_LEN);
    const nonce = raw.subarray(_SALT_LEN, _SALT_LEN + _NONCE_LEN);
    const rest = raw.subarray(_SALT_LEN + _NONCE_LEN);
    // Python `rest[:-_TAG_LEN]` / `rest[-_TAG_LEN:]`.
    const ct = rest.subarray(0, rest.length - _TAG_LEN);
    const tag = rest.subarray(rest.length - _TAG_LEN);
    const [encKey, macKey] = _derive(key, salt);
    const expected = crypto.createHmac('sha256', macKey).update(Buffer.concat([salt, nonce, ct])).digest();
    // Mirror `hmac.compare_digest` — constant-time, and length-mismatch-safe.
    if (expected.length !== tag.length || !crypto.timingSafeEqual(expected, tag)) {
        throw new ValueError('authentication failed (wrong key or corrupt token)');
    }
    return _xor(ct, _keystream(encKey, nonce, ct.length)).toString('utf-8');
}

/** Decrypt `token`, trying each key in order (project first, then global). Mirrors `decrypt`. */
export function decrypt(token: string, keys: string | string[]): string {
    if (!is_token(token)) {
        throw new ValueError('not an ENC1 token');
    }
    let candidates = typeof keys === 'string' ? [keys] : [...keys];
    candidates = candidates.filter((k) => k);
    if (candidates.length === 0) {
        throw new ValueError('no decryption key available');
    }
    let last: Error | null = null;
    for (const k of candidates) {
        try {
            return _decrypt_one(token, k);
        } catch (exc) {
            last = exc as Error; // try next key
        }
    }
    throw new ValueError(`decryption failed with all configured keys: ${last?.message ?? last}`);
}

// --------------------------------------------------------------------------- //
// Key resolution from .agent-settings.yml (project → user-global)
// --------------------------------------------------------------------------- //

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Minimal, dependency-free scalar read so this works even where a YAML parser
 * is absent. Matches `link_encryption_key:` at any indentation. Mirrors
 * `_read_key_from`.
 */
function _read_key_from(p: string | null): string | null {
    if (!p || !_isFile(p)) {
        return null;
    }
    // Python: r'^\s*link_encryption_key:\s*["\']?([^"\'#\s]+)' — re.match anchors at start.
    const pat = /^\s*link_encryption_key:\s*["']?([^"'#\s]+)/;
    const text = fs.readFileSync(p, 'utf-8');
    for (const line of text.split('\n')) {
        const m = pat.exec(line);
        if (m) {
            return m[1] as string;
        }
    }
    return null;
}

/** Mirror `project_key`. */
export function project_key(projectRoot: string | null = null): string | null {
    const root = projectRoot ? projectRoot : process.cwd();
    return _read_key_from(path.join(root, '.agent-settings.yml'));
}

/** Mirror `global_key`. */
export function global_key(): string | null {
    return _read_key_from(_USER_GLOBAL) ?? _read_key_from(_USER_GLOBAL_LEGACY);
}

/**
 * Ordered, de-duplicated key list: project first, then user-global. An
 * `EVENT4U_LINK_KEY` environment variable, if set, is consulted last as a
 * CI/automation escape hatch. Mirrors `resolve_keys`.
 */
export function resolve_keys(projectRoot: string | null = null): string[] {
    const keys: string[] = [];
    for (const k of [project_key(projectRoot), global_key(), process.env.EVENT4U_LINK_KEY ?? null]) {
        if (k && !keys.includes(k)) {
            keys.push(k);
        }
    }
    return keys;
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

/** Thrown to mirror Python's `ValueError` / `raise SystemExit`. */
export class ValueError extends Error {}

/** Mirror `_cli`. */
export function _cli(argv: readonly string[]): number {
    const prog = 'link_crypto';
    const cmd = argv[0];
    const validCmds = new Set(['encrypt', 'decrypt', 'keygen', 'keystatus']);

    // argparse: subparser required → error when missing/invalid (exit 2).
    if (cmd === undefined || !validCmds.has(cmd)) {
        const choices = "'encrypt', 'decrypt', 'keygen', 'keystatus'";
        if (cmd === undefined) {
            process.stderr.write(
                `usage: ${prog} [-h] {encrypt,decrypt,keygen,keystatus} ...\n` +
                    `${prog}: error: the following arguments are required: cmd\n`,
            );
        } else {
            process.stderr.write(
                `usage: ${prog} [-h] {encrypt,decrypt,keygen,keystatus} ...\n` +
                    `${prog}: error: argument cmd: invalid choice: '${cmd}' (choose from ${choices})\n`,
            );
        }
        return 2;
    }

    // Parse the optional `--value` for encrypt/decrypt.
    let value: string | null = null;
    for (let i = 1; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--value') {
            value = argv[i + 1] ?? null;
            i += 1;
        } else if (a.startsWith('--value=')) {
            value = a.slice('--value='.length);
        }
    }

    if (cmd === 'keygen') {
        // Python: base64.urlsafe_b64encode(token_bytes(32)).rstrip("=").
        const out = crypto.randomBytes(32).toString('base64url'); // base64url drops padding already
        process.stdout.write(out.replace(/=+$/, '') + '\n');
        return 0;
    }

    if (cmd === 'keystatus') {
        process.stdout.write(`project key: ${project_key() ? 'present' : 'absent'}\n`);
        process.stdout.write(`user-global key: ${global_key() ? 'present' : 'absent'}\n`);
        process.stdout.write(
            `env EVENT4U_LINK_KEY: ${process.env.EVENT4U_LINK_KEY ? 'present' : 'absent'}\n`,
        );
        process.stdout.write(`resolved key count: ${resolve_keys().length}\n`);
        return 0;
    }

    // encrypt / decrypt: read stdin when --value absent (Python sys.stdin.read().strip()).
    const v = value !== null ? value : _readStdin().trim();
    const keys = resolve_keys();
    if (keys.length === 0) {
        process.stderr.write(
            'error: no link_encryption_key found in project or user-global ' +
                '.agent-settings.yml (secrets.link_encryption_key)\n',
        );
        return 2;
    }
    if (cmd === 'encrypt') {
        process.stdout.write(encrypt(v, keys[0] as string) + '\n');
    } else {
        process.stdout.write(decrypt(v, keys) + '\n');
    }
    return 0;
}

/** Blocking read of all of stdin (mirrors Python `sys.stdin.read()`). */
function _readStdin(): string {
    try {
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    try {
        process.exit(_cli(process.argv.slice(2)));
    } catch (exc) {
        if (exc instanceof ValueError) {
            // Mirror `raise SystemExit(...)` from a propagated ValueError — message
            // to stderr, exit 1.
            process.stderr.write(`${exc.message}\n`);
            process.exit(1);
        }
        throw exc;
    }
}
