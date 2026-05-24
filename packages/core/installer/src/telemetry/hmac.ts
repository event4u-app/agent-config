/**
 * Per-channel HMAC signing. Each entry path (`npx`, `curl`, `gui`)
 * ships with its own pre-shared secret at build time. The worker
 * validates `x-install-sig: HMAC-SHA256(secret, body)` before parsing
 * the request body.
 *
 * Rotation: ship a new installer release with a new secret. The worker
 * accepts both old and new during the grace window.
 */

import { createHmac } from 'node:crypto';

export function signBody(secret: string, body: string): string {
    if (secret.length === 0) {
        throw new Error('telemetry: hmacSecret is empty; SDK should have refused to emit');
    }
    return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}
