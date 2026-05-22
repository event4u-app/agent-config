/**
 * Tests for src/server/token.ts — per-process bearer token contract.
 *
 * Roadmap Phase 3 + council security mandate:
 *   - 32 bytes entropy (64 hex chars).
 *   - File mode 0600 (POSIX only — Windows mode bits are unreliable).
 *   - Constant-time compare on `tokensMatch`.
 *   - Fresh token per process; previous file overwritten.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, statSync, readFileSync, rmSync } from 'node:fs';
import {
    defaultTokenDir,
    defaultTokenPath,
    mintToken,
    tokensMatch,
} from '../../src/server/token.js';

describe('mintToken', () => {
    it('returns 64 hex chars (32 bytes of entropy)', () => {
        const { token } = mintToken();
        expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('persists the token under ~/.event4u/agent-config/local-server.token', () => {
        const { path } = mintToken();
        expect(path).toBe(defaultTokenPath());
        expect(path).not.toBeNull();
        const persistedPath = path as string;
        expect(persistedPath).toContain('.event4u');
        expect(persistedPath).toContain('agent-config');
        const onDisk = readFileSync(persistedPath, 'utf8').trim();
        expect(onDisk).toMatch(/^[0-9a-f]{64}$/);
    });

    it('writes the token file with mode 0600 on POSIX', () => {
        if (process.platform === 'win32') return;
        const { path } = mintToken();
        expect(path).not.toBeNull();
        const mode = statSync(path as string).mode & 0o777;
        expect(mode).toBe(0o600);
    });

    it('mints a fresh token on every call (overwrites the file)', () => {
        const a = mintToken();
        const b = mintToken();
        expect(a.token).not.toBe(b.token);
        expect(a.path).toBe(b.path);
        expect(b.path).not.toBeNull();
        const onDisk = readFileSync(b.path as string, 'utf8').trim();
        expect(onDisk).toBe(b.token);
    });

    it('exposes a stable default token directory', () => {
        expect(defaultTokenDir()).toContain('.event4u');
        expect(defaultTokenDir()).toContain('agent-config');
    });

    describe('with { persist: false } (dry-run)', () => {
        it('returns 64 hex chars and a null path', () => {
            const { token, path } = mintToken({ persist: false });
            expect(token).toMatch(/^[0-9a-f]{64}$/);
            expect(path).toBeNull();
        });

        it('does not create or touch the on-disk token file', () => {
            // Remove any token left by earlier tests so this assertion
            // measures only the dry-run mint, not pre-existing state.
            const existing = defaultTokenPath();
            if (existsSync(existing)) rmSync(existing, { force: true });

            const { path } = mintToken({ persist: false });
            expect(path).toBeNull();
            expect(existsSync(existing)).toBe(false);
        });

        it('persist: true (default) still writes the file', () => {
            const { path } = mintToken({ persist: true });
            expect(path).toBe(defaultTokenPath());
            expect(existsSync(path as string)).toBe(true);
        });
    });
});

describe('tokensMatch', () => {
    it('returns true for identical tokens', () => {
        const a = 'a'.repeat(64);
        expect(tokensMatch(a, a)).toBe(true);
    });

    it('returns false for tokens of different length (early-exit by length is OK)', () => {
        expect(tokensMatch('a'.repeat(64), 'a'.repeat(63))).toBe(false);
    });

    it('returns false when any character differs', () => {
        const a = 'a'.repeat(64);
        const b = 'a'.repeat(63) + 'b';
        expect(tokensMatch(a, b)).toBe(false);
    });

    it('handles empty strings without throwing', () => {
        expect(tokensMatch('', '')).toBe(true);
        expect(tokensMatch('', 'x')).toBe(false);
    });
});
