#!/usr/bin/env tsx
/**
 * Workspace encryption-at-rest — Phase 8 of `road-to-employee-product`
 * (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_crypto.py` (ADR-200, py2ts
 * migration). Byte-for-byte behavioral parity with the Python original — same
 * subcommands, same exit codes, same `json.dumps(..., sort_keys=True)` output,
 * same `AC1\0` envelope so a ciphertext written by one language decrypts in the
 * other. No behaviour changes — latent quirks are replicated, not fixed.
 *
 * Implements `docs/contracts/at-rest-encryption.md`. Local-only **AES-256-GCM**
 * with the contract's `AC1\0` envelope. Cipher choice + architecture locked in
 * `docs/decisions/ADR-062-encrypt-at-rest-store-architecture.md` (Part A: the
 * prior Fernet implementation drifted from the spec — this aligns the code to
 * the contract so the same envelope is byte-reproducible across Python's
 * `cryptography` and Node's `node:crypto`).
 *
 * The feature is **opt-in** via `.agent-settings.yml → workspace.encrypt_at_rest`.
 * When disabled, callers write plaintext; `decryptBytes` passes plaintext
 * through unchanged (no magic prefix), so reads stay back-compatible.
 *
 * DOCUMENTED DIVERGENCE — master-key resolution. Python's order is
 * override → env → keyring → file. Node has no OS-keyring binding, so the
 * keyring branch is unavailable here (treated as the Python `ImportError`
 * fall-through to the file path). With an explicit override or the
 * `AGENT_CONFIG_WORKSPACE_KEY` env var, both languages resolve the SAME key and
 * the envelopes interoperate; the divergence is confined to the no-key path
 * where Python may use the OS keyring while Node always uses the keyfile.
 *
 * Envelope (per the contract):
 *
 *     | 4 bytes  | magic    "AC1\0"  (0x41 0x43 0x31 0x00)
 *     | 1 byte   | version  0x01
 *     | 12 bytes | GCM nonce
 *     | 16 bytes | GCM auth tag
 *     | N bytes  | ciphertext
 *
 * Note: Node's `createCipheriv` returns the ciphertext via update+final and the
 * 16-byte tag separately via `getAuthTag()`; Python's `AESGCM.encrypt` returns
 * `ciphertext || tag`. Both produce the identical envelope `MAGIC + version +
 * nonce + tag + ciphertext` (tag BEFORE ciphertext, per the contract).
 *
 * CLI:
 *
 *     workspace_crypto.ts encrypt --in <p> --out <p>
 *     workspace_crypto.ts decrypt --in <p> --out <p>
 *     workspace_crypto.ts status
 *     workspace_crypto.ts rotate-key
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const WORKSPACE_HOME = path.join(os.homedir(), '.event4u', 'agent-config', 'workspace');
const KEYRING_SERVICE = 'event4u-agent-config-workspace';
const KEYRING_USER = 'master-key';
const ENV_OVERRIDE_KEY = 'AGENT_CONFIG_WORKSPACE_KEY';
const ENV_FORCE_DISABLE = 'AGENT_CONFIG_NO_ENCRYPTION';

// Reference the keyring identifiers so the (intentionally-unused under Node)
// constants stay in sync with the Python source without tripping noUnusedLocals.
void KEYRING_SERVICE;
void KEYRING_USER;

// Envelope constants (docs/contracts/at-rest-encryption.md).
const MAGIC = Buffer.from([0x41, 0x43, 0x31, 0x00]); // "AC1\0"
const VERSION = 1;
const _NONCE_LEN = 12;
const _TAG_LEN = 16;
const _KEY_LEN = 32;
const _HEADER_LEN = MAGIC.length + 1; // magic + version byte

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

// --- JSON byte-parity (compact, ensure_ascii=True, sort_keys=True) ----------
//
// `json.dumps(obj, sort_keys=True)` (no indent) → default separators
// `(", ", ": ")`, every non-ASCII code point escaped to `\uXXXX`, keys sorted.

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    const v = code - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out +=
                        '\\u' +
                        hi.toString(16).padStart(4, '0') +
                        '\\u' +
                        lo.toString(16).padStart(4, '0');
                }
        }
    }
    return out + '"';
}

function _jsonScalarSorted(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpSorted(value: unknown): string {
    const scalar = _jsonScalarSorted(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _dumpSorted(v)).join(', ') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return (
            '{' +
            keys.map((k) => `${_jsonStrAscii(k)}: ${_dumpSorted(obj[k])}`).join(', ') +
            '}'
        );
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(value, sort_keys=True)` (compact, ensure_ascii=True). */
function jsonDumpsSorted(value: unknown): string {
    return _dumpSorted(value);
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

// ---------------------------------------------------------------------------
// Module body (workspace_crypto.py).
// ---------------------------------------------------------------------------

/**
 * `str.rstrip()` — strip trailing ASCII whitespace (matches Python's default
 * whitespace set for the line scanner: space, \t, \n, \r, \f, \v).
 */
function _rstrip(s: string): string {
    return s.replace(/[ \t\n\r\f\v]+$/, '');
}

/** `str.lstrip()` — strip leading whitespace. */
function _lstrip(s: string): string {
    return s.replace(/^[ \t\n\r\f\v]+/, '');
}

/** `str.strip()` — strip both ends. */
function _strip(s: string): string {
    return s.replace(/^[ \t\n\r\f\v]+/, '').replace(/[ \t\n\r\f\v]+$/, '');
}

/** Default OFF in v0 — opt-in via `.agent-settings.yml`. */
export function isEnabled(settingsPath?: string): boolean {
    const forceDisable = _strip(process.env[ENV_FORCE_DISABLE] ?? '');
    if (forceDisable !== '' && forceDisable !== '0') {
        return false;
    }
    const p = settingsPath !== undefined ? settingsPath : '.agent-settings.yml';
    if (!fs.existsSync(p)) {
        return false;
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return false;
    }
    let inBlock = false;
    // Python `str.splitlines()` splits on universal newlines without a trailing
    // empty element. `\n`/`\r\n`/`\r` are handled; mirror it.
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = _rstrip(raw);
        if (!line || _lstrip(line).startsWith('#')) {
            continue;
        }
        if (!line.startsWith(' ') && line.endsWith(':')) {
            inBlock = _strip(line) === 'workspace:';
            continue;
        }
        if (inBlock && _lstrip(line).startsWith('encrypt_at_rest:')) {
            const idx = line.indexOf(':');
            const rawValue = line.slice(idx + 1);
            const value = _strip(_strip(rawValue).toLowerCase()).replace(/^['"]+|['"]+$/g, '');
            return value === 'on' || value === 'true' || value === 'yes' || value === '1';
        }
    }
    return false;
}

/**
 * Accept a raw 32-byte key or its base64 encoding; return raw 32 bytes.
 *
 * Mirrors `base64.b64decode(material, validate=True)` — STRICT base64: the
 * input must contain only the base64 alphabet (`A-Za-z0-9+/`) plus `=` padding.
 * Node's `Buffer.from(s, 'base64')` is lenient (silently drops invalid chars),
 * so we validate strictly first and raise the Python ValueError messages.
 */
function _coerceKey(material: Buffer): Buffer {
    if (material.length === _KEY_LEN) {
        return material;
    }
    let decoded: Buffer;
    try {
        decoded = _b64decodeStrict(material);
    } catch {
        throw new Error('workspace_crypto: master key is not 32 bytes or valid base64');
    }
    if (decoded.length !== _KEY_LEN) {
        throw new Error(
            `workspace_crypto: master key must be ${_KEY_LEN} bytes, got ${decoded.length}`,
        );
    }
    return decoded;
}

/**
 * Strict base64 decode matching `base64.b64decode(..., validate=True)`:
 * reject any byte outside the base64 alphabet, require a length that is a
 * multiple of 4 and valid padding. Operates on the latin-1 view of the bytes
 * (CPython rejects non-base64 chars before decoding).
 */
function _b64decodeStrict(material: Buffer): Buffer {
    const s = material.toString('latin1');
    // CPython's binascii rejects any character not in the standard alphabet
    // or padding. `=` may only appear as trailing padding.
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) {
        throw new Error('invalid base64');
    }
    if (s.length % 4 !== 0) {
        throw new Error('invalid base64 padding');
    }
    const decoded = Buffer.from(s, 'base64');
    // Round-trip guard: Node re-encodes canonically; if the canonical form
    // differs from the (validated) input, the input had non-canonical bytes.
    if (decoded.toString('base64') !== s) {
        throw new Error('non-canonical base64');
    }
    return decoded;
}

function _generateKeyB64(): string {
    return crypto.randomBytes(_KEY_LEN).toString('base64');
}

/**
 * Resolve the 32-byte master key. Order: override → env → keyring → file.
 *
 * The keyring branch is unavailable in Node (no OS-keyring binding) — treated
 * as the Python `ImportError` fall-through to the keyfile path.
 */
function _getOrCreateMasterKey(override?: string): Buffer {
    if (override !== undefined) {
        return _coerceKey(Buffer.from(override, 'ascii'));
    }
    const envKey = process.env[ENV_OVERRIDE_KEY];
    if (envKey) {
        return _coerceKey(Buffer.from(envKey, 'ascii'));
    }
    // No keyring backend in Node — fall back to a file under the workspace home,
    // mode 0o600. Documented in the contract as the recovery path.
    fs.mkdirSync(WORKSPACE_HOME, { recursive: true });
    const keyfile = path.join(WORKSPACE_HOME, '.master-key');
    if (fs.existsSync(keyfile)) {
        return _coerceKey(_stripBytes(fs.readFileSync(keyfile)));
    }
    const keyB64 = _generateKeyB64();
    fs.writeFileSync(keyfile, Buffer.from(keyB64, 'ascii'));
    try {
        fs.chmodSync(keyfile, 0o600);
    } catch {
        /* OSError → pass */
    }
    return _coerceKey(Buffer.from(keyB64, 'ascii'));
}

/** `bytes.strip()` — strip leading/trailing ASCII whitespace bytes. */
function _stripBytes(b: Buffer): Buffer {
    let start = 0;
    let end = b.length;
    const isWs = (c: number): boolean =>
        c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0b || c === 0x0c;
    while (start < end && isWs(b[start] as number)) start += 1;
    while (end > start && isWs(b[end - 1] as number)) end -= 1;
    return b.subarray(start, end);
}

/** AES-256-GCM encrypt. `key` is 32 raw bytes (or base64); undefined → master. */
export function encryptBytes(payload: Buffer, key?: Buffer): Buffer {
    const k = key !== undefined ? _coerceKey(key) : _getOrCreateMasterKey();
    const nonce = crypto.randomBytes(_NONCE_LEN);
    const cipher = crypto.createCipheriv('aes-256-gcm', k, nonce);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([MAGIC, Buffer.from([VERSION]), nonce, tag, ciphertext]);
}

export function decryptBytes(payload: Buffer, key?: Buffer): Buffer {
    if (!_startsWith(payload, MAGIC)) {
        // Plaintext payload — feature flag was off at write time.
        return payload;
    }
    const version = payload[MAGIC.length];
    if (version !== VERSION) {
        throw new Error(`workspace_crypto: unsupported envelope version ${version}`);
    }
    const body = payload.subarray(_HEADER_LEN);
    const nonce = body.subarray(0, _NONCE_LEN);
    const tag = body.subarray(_NONCE_LEN, _NONCE_LEN + _TAG_LEN);
    const ciphertext = body.subarray(_NONCE_LEN + _TAG_LEN);
    const k = key !== undefined ? _coerceKey(key) : _getOrCreateMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', k, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function _startsWith(buf: Buffer, prefix: Buffer): boolean {
    if (buf.length < prefix.length) return false;
    return buf.subarray(0, prefix.length).equals(prefix);
}

export function encryptFile(src: string, dst: string, key?: Buffer): void {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, encryptBytes(fs.readFileSync(src), key));
}

export function decryptFile(src: string, dst: string, key?: Buffer): void {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, decryptBytes(fs.readFileSync(src), key));
}

// --- per-record encryption for append-JSONL stores (ADR-064) -------------
//
// AES-GCM can't append to a blob, so each JSONL record becomes its own
// self-contained envelope, base64-encoded as one line. Each line carries a
// fresh random 96-bit nonce in its own `AC1\0` envelope. A torn final line
// fails base64/GCM and is skipped by the reader.

/** Encrypt one record's text → a single base64 line (no trailing newline). */
export function encryptLine(text: string, key?: Buffer): string {
    return encryptBytes(Buffer.from(text, 'utf-8'), key).toString('base64');
}

/**
 * Decrypt a base64 record line; pass a plaintext JSON line through.
 *
 * A plaintext record (flag was off at write) is raw JSON starting with `{`/`[`;
 * an encrypted record is base64 of the `AC1\0` envelope. The first-char check
 * distinguishes them without ambiguity.
 */
export function decryptLine(line: string, key?: Buffer): string {
    const s = _strip(line);
    if (!s || s[0] === '{' || s[0] === '[') {
        return s;
    }
    const raw = _b64decodeStrict(Buffer.from(s, 'latin1'));
    return decryptBytes(raw, key).toString('utf-8');
}

/** Generate a new master key, replace the keyfile entry. Returns raw key. */
export function rotateKey(): Buffer {
    const keyB64 = _generateKeyB64();
    // No keyring backend in Node — fall through to the keyfile path (matches
    // the Python `except ImportError` branch).
    const keyfile = path.join(WORKSPACE_HOME, '.master-key');
    fs.mkdirSync(WORKSPACE_HOME, { recursive: true });
    fs.writeFileSync(keyfile, Buffer.from(keyB64, 'ascii'));
    try {
        fs.chmodSync(keyfile, 0o600);
    } catch {
        /* OSError → pass */
    }
    return _coerceKey(Buffer.from(keyB64, 'ascii'));
}

// --- CLI argument parsing ---

interface ParsedArgs {
    cmd: string;
    src?: string;
    dst?: string;
}

const PROG = 'workspace_crypto';

const USAGE = `usage: ${PROG} [-h] {encrypt,decrypt,status,rotate-key} ...\n`;
const USAGE_ENCRYPT = `usage: ${PROG} encrypt [-h] --in SRC --out DST\n`;
const USAGE_DECRYPT = `usage: ${PROG} decrypt [-h] --in SRC --out DST\n`;
const USAGE_STATUS = `usage: ${PROG} status [-h]\n`;
const USAGE_ROTATE = `usage: ${PROG} rotate-key [-h]\n`;

const SUB_USAGE: Record<string, string> = {
    encrypt: USAGE_ENCRYPT,
    decrypt: USAGE_DECRYPT,
    status: USAGE_STATUS,
    'rotate-key': USAGE_ROTATE,
};

function _argError(usage: string, prog: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${prog}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): ParsedArgs {
    let i = 0;
    // Top-level -h/--help before the subcommand.
    if (i < argv.length && (argv[i] === '-h' || argv[i] === '--help')) {
        process.stdout.write(USAGE);
        throw new ArgparseExit(0);
    }
    if (i >= argv.length) {
        _argError(USAGE, PROG, 'the following arguments are required: cmd');
    }
    const cmd = argv[i] as string;
    i += 1;
    const choices = ['encrypt', 'decrypt', 'status', 'rotate-key'];
    if (!choices.includes(cmd)) {
        _argError(
            USAGE,
            PROG,
            `argument cmd: invalid choice: '${cmd}' (choose from 'encrypt', 'decrypt', 'status', 'rotate-key')`,
        );
    }
    const subUsage = SUB_USAGE[cmd] as string;
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = { cmd };
    const takesIo = cmd === 'encrypt' || cmd === 'decrypt';
    const positionals: string[] = [];
    // argparse collects every arg the subparser cannot consume and reports the
    // whole leftover list against the TOP-LEVEL parser as "unrecognized
    // arguments". Order is preserved.
    const unrecognized: string[] = [];
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        if (takesIo && (a === '--in' || a.startsWith('--in='))) {
            const [val, next] = _optValue(argv, i, a, '--in', subUsage, subProg);
            out.src = val;
            i = next;
            continue;
        }
        if (takesIo && (a === '--out' || a.startsWith('--out='))) {
            const [val, next] = _optValue(argv, i, a, '--out', subUsage, subProg);
            out.dst = val;
            i = next;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            unrecognized.push(a);
            i += 1;
            continue;
        }
        positionals.push(a);
        i += 1;
    }
    if (takesIo) {
        // argparse reports missing required options against the sub-parser,
        // before reporting unrecognized arguments to the top-level parser.
        const missing: string[] = [];
        if (out.src === undefined) missing.push('--in');
        if (out.dst === undefined) missing.push('--out');
        if (missing.length > 0) {
            _argError(
                subUsage,
                subProg,
                `the following arguments are required: ${missing.join(', ')}`,
            );
        }
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else {
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    }
    return out;
}

/**
 * Consume an option value for `--in`/`--out`. Supports `--opt val` and
 * `--opt=val`. Missing value → argparse sub-parser error.
 */
function _optValue(
    argv: string[],
    i: number,
    a: string,
    opt: string,
    subUsage: string,
    subProg: string,
): [string, number] {
    const eq = `${opt}=`;
    if (a.startsWith(eq)) {
        return [a.slice(eq.length), i + 1];
    }
    if (i + 1 >= argv.length) {
        _argError(subUsage, subProg, `argument ${opt}: expected one argument`);
    }
    return [argv[i + 1] as string, i + 2];
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    if (args.cmd === 'encrypt') {
        encryptFile(args.src as string, args.dst as string);
        return 0;
    }
    if (args.cmd === 'decrypt') {
        decryptFile(args.src as string, args.dst as string);
        return 0;
    }
    if (args.cmd === 'status') {
        print(jsonDumpsSorted({ enabled: isEnabled() }));
        return 0;
    }
    if (args.cmd === 'rotate-key') {
        rotateKey();
        print(jsonDumpsSorted({ rotated: true }));
        return 0;
    }
    return 2;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export { ArgparseExit, jsonDumpsSorted };
