/**
 * Browser-wizard security primitives.
 *
 * Three independent layers, each pure-function so the unit tests can
 * cover them without booting the HTTP server:
 *
 *   1. Host-header allowlist — defends against DNS rebinding when a form
 *      POST omits `Origin`. Only `127.0.0.1:<port>` and
 *      `localhost:<port>` are accepted (ADR-016 + Phase 6 § Security).
 *   2. Origin check — every POST must carry an `Origin` header from the
 *      same loopback host:port (CORS belt-and-braces).
 *   3. CSRF token — issued once on `GET /`, required on every POST via
 *      `X-CSRF-Token`. 32 random bytes, hex-encoded.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

/** Compute the host:port pair we accept on the Host header. */
export function buildAllowedHosts(port: number): readonly string[] {
    return [`127.0.0.1:${port}`, `localhost:${port}`];
}

/** Compute the origins we accept on the Origin header (POST only). */
export function buildAllowedOrigins(port: number): readonly string[] {
    return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
}

/** True iff `host` matches one of the allowed `host:port` pairs. */
export function isHostAllowed(host: string | undefined, allowed: readonly string[]): boolean {
    if (host === undefined || host.length === 0) return false;
    const lower = host.toLowerCase();
    for (const a of allowed) {
        if (lower === a.toLowerCase()) return true;
    }
    return false;
}

/** True iff `origin` matches one of the allowed origins. */
export function isOriginAllowed(origin: string | undefined, allowed: readonly string[]): boolean {
    if (origin === undefined || origin.length === 0) return false;
    const lower = origin.toLowerCase();
    for (const a of allowed) {
        if (lower === a.toLowerCase()) return true;
    }
    return false;
}

/** Generate a 64-character hex CSRF token. */
export function generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
}

/** Constant-time string equality for CSRF comparisons. */
export function csrfEquals(a: string | undefined, b: string): boolean {
    if (a === undefined) return false;
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

/** Common CSP header value. */
export const CSP_HEADER = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'";
