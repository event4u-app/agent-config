/**
 * Tests for the GUI security primitives: host/origin allowlists, CSRF
 * token generation + constant-time equality (Phase 6 § Security).
 */

import { describe, expect, it } from 'vitest';

import {
    buildAllowedHosts,
    buildAllowedOrigins,
    CSP_HEADER,
    csrfEquals,
    generateCsrfToken,
    isHostAllowed,
    isOriginAllowed,
} from '../src/gui/security.js';

describe('buildAllowedHosts / buildAllowedOrigins', () => {
    it('only emits loopback variants', () => {
        expect(buildAllowedHosts(54321)).toEqual(['127.0.0.1:54321', 'localhost:54321']);
        expect(buildAllowedOrigins(54321)).toEqual([
            'http://127.0.0.1:54321',
            'http://localhost:54321',
        ]);
    });
});

describe('isHostAllowed', () => {
    const allowed = buildAllowedHosts(9999);

    it('accepts exact loopback host:port', () => {
        expect(isHostAllowed('127.0.0.1:9999', allowed)).toBe(true);
        expect(isHostAllowed('localhost:9999', allowed)).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isHostAllowed('LOCALHOST:9999', allowed)).toBe(true);
    });

    it('rejects missing or empty host', () => {
        expect(isHostAllowed(undefined, allowed)).toBe(false);
        expect(isHostAllowed('', allowed)).toBe(false);
    });

    it('rejects wrong port (DNS-rebinding shape)', () => {
        expect(isHostAllowed('127.0.0.1:9998', allowed)).toBe(false);
    });

    it('rejects non-loopback hostnames', () => {
        expect(isHostAllowed('evil.example.com:9999', allowed)).toBe(false);
        expect(isHostAllowed('127.0.0.2:9999', allowed)).toBe(false);
    });
});

describe('isOriginAllowed', () => {
    const allowed = buildAllowedOrigins(9999);

    it('accepts exact loopback origins', () => {
        expect(isOriginAllowed('http://127.0.0.1:9999', allowed)).toBe(true);
        expect(isOriginAllowed('http://localhost:9999', allowed)).toBe(true);
    });

    it('rejects https scheme (we bind http only)', () => {
        expect(isOriginAllowed('https://127.0.0.1:9999', allowed)).toBe(false);
    });

    it('rejects missing or empty origin', () => {
        expect(isOriginAllowed(undefined, allowed)).toBe(false);
        expect(isOriginAllowed('', allowed)).toBe(false);
    });
});

describe('generateCsrfToken / csrfEquals', () => {
    it('emits 64 hex chars (32 random bytes)', () => {
        const tok = generateCsrfToken();
        expect(tok).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different tokens across calls', () => {
        expect(generateCsrfToken()).not.toBe(generateCsrfToken());
    });

    it('csrfEquals: matches identical tokens, rejects others', () => {
        const t = generateCsrfToken();
        expect(csrfEquals(t, t)).toBe(true);
        expect(csrfEquals(undefined, t)).toBe(false);
        expect(csrfEquals('', t)).toBe(false);
        const differentLast = t.endsWith('0') ? '1' : '0';
        expect(csrfEquals(t.slice(0, -1) + differentLast, t)).toBe(false);
    });

    it('csrfEquals: rejects length mismatches without timingSafeEqual throw', () => {
        expect(csrfEquals('short', generateCsrfToken())).toBe(false);
    });
});

describe('CSP_HEADER', () => {
    it('restricts to self for default + script + connect', () => {
        expect(CSP_HEADER).toContain("default-src 'self'");
        expect(CSP_HEADER).toContain("script-src 'self'");
        expect(CSP_HEADER).toContain("connect-src 'self'");
    });
});
