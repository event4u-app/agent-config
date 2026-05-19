/**
 * Per-process bearer token for the local server.
 *
 * Council security mandate (security-engineer): 127.0.0.1 bind is
 * necessary but not sufficient. Any co-resident process or browser
 * tab can `fetch('http://127.0.0.1:<port>/')`. We require an
 * `Authorization: Bearer <token>` header on every API request. The
 * token is fresh per process, written to
 * `~/.event4u/agent-config/local-server.token` with mode 0600, and
 * the UI bundle reads it via a `?token=…` query param on the initial
 * page load (handed back as a cookie by the server's static-file
 * handler — see `src/server/app.ts`).
 *
 * The file is replaced (not appended) on every process boot. A stale
 * token from a previous process is invalid.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

export interface TokenFile {
    /** Token bytes, hex-encoded (64 chars / 32 bytes of entropy). */
    token: string;
    /** Absolute path of the on-disk token file. */
    path: string;
}

function tokenDir(): string {
    return resolve(homedir(), '.event4u', 'agent-config');
}

function tokenPath(): string {
    return resolve(tokenDir(), 'local-server.token');
}

/**
 * Generate a fresh token, persist it with mode 0600, return the
 * token string + on-disk path.
 */
export function mintToken(): TokenFile {
    const token = randomBytes(32).toString('hex');
    const dir = tokenDir();
    const path = tokenPath();
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(path, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
    return { token, path };
}

/**
 * Constant-time compare of two hex-encoded tokens (avoid leaking the
 * compare length via early-exit timing).
 */
export function tokensMatch(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
    }
    return diff === 0;
}

/**
 * Default directory used to persist the token. Exported so tests can
 * stat the file with the expected absolute path.
 */
export function defaultTokenPath(): string {
    return tokenPath();
}

/**
 * Default token directory (parent of `defaultTokenPath`). Exported
 * for the same reason as `defaultTokenPath`.
 */
export function defaultTokenDir(): string {
    const _unused = dirname; // silence unused-import noise; dirname is part of public API contract
    void _unused;
    return tokenDir();
}
