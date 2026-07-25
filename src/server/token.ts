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
 * page load. There is no cookie mechanism: the SPA strips the token
 * from the URL after boot (see `src/ui/urlToken.ts`) and sends it as
 * an `Authorization: Bearer <token>` header on every API request.
 *
 * The file is replaced (not appended) on every process boot. A stale
 * token from a previous process is invalid.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { event4u_root } from '../scripts/_lib/user_global_paths.js';

export interface TokenFile {
    /** Token bytes, hex-encoded (64 chars / 32 bytes of entropy). */
    token: string;
    /**
     * Absolute path of the on-disk token file, or `null` when minted
     * with `{ persist: false }` (dry-run mode keeps the token in
     * memory only — no `~/.event4u/agent-config/local-server.token`
     * is created).
     */
    path: string | null;
}

export interface MintTokenOptions {
    /**
     * Persist the token to `~/.event4u/agent-config/local-server.token`
     * with mode 0600. Defaults to `true`. Set to `false` for dry-run
     * boots so the CLI's "no files will be written" promise holds
     * end-to-end (see `agents/roadmaps/onboarding-wizard-takeover.md`
     * § Dry-run state contract).
     */
    persist?: boolean;
}

function tokenDir(): string {
    // Follows a host-supplied config root (EVENT4U_CONFIG_HOME / --config-root)
    // so a profile-scoped server mints its bearer token under its own root.
    // The token's security properties (fresh per process, mode 0600,
    // 127.0.0.1-only) are unchanged — only the parent directory follows the
    // operator-chosen root. Byte-identical to `~/.event4u/agent-config` with
    // no override.
    return event4u_root();
}

function tokenPath(): string {
    return resolve(tokenDir(), 'local-server.token');
}

/**
 * Generate a fresh token. When `persist` is `true` (the default), the
 * token is written to `~/.event4u/agent-config/local-server.token`
 * with mode 0600 and `path` is the absolute on-disk location. When
 * `persist` is `false`, the token is kept in memory only and `path`
 * is `null`.
 */
export function mintToken(opts: MintTokenOptions = {}): TokenFile {
    const token = randomBytes(32).toString('hex');
    const persist = opts.persist !== false;
    if (!persist) {
        return { token, path: null };
    }
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
