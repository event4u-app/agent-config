/**
 * HMAC-SHA256 validation for `x-install-sig`. Per-channel secret is
 * chosen by the `entry_path` claimed in the request body.
 *
 * Constant-time comparison via `crypto.subtle.verify` — does not leak
 * the secret through timing.
 */

import type { EntryPath, WorkerEnv } from './types.js';

const encoder = new TextEncoder();

export async function verifySignature(
    env: WorkerEnv,
    entryPath: EntryPath,
    body: string,
    signatureHex: string,
): Promise<boolean> {
    const secret = secretFor(env, entryPath);
    if (secret.length === 0) return false;

    const expected = decodeHex(signatureHex);
    if (expected === null) return false;

    // `crypto.subtle.{importKey,verify}` types want plain `BufferSource`.
    // `Uint8Array.buffer` is typed `ArrayBufferLike` (includes
    // `SharedArrayBuffer`), so copy into fresh `ArrayBuffer` instances
    // via `toArrayBuffer` to satisfy the stricter lib definitions.
    const key = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(encoder.encode(secret)),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
    );

    return crypto.subtle.verify(
        'HMAC',
        key,
        toArrayBuffer(expected),
        toArrayBuffer(encoder.encode(body)),
    );
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(view.byteLength);
    new Uint8Array(out).set(view);
    return out;
}

function secretFor(env: WorkerEnv, entryPath: EntryPath): string {
    if (entryPath === 'npx') return env.HMAC_NPX;
    if (entryPath === 'curl') return env.HMAC_CURL;
    if (entryPath === 'gui') return env.HMAC_GUI;
    return '';
}

function decodeHex(hex: string): Uint8Array | null {
    if (hex.length === 0 || hex.length % 2 !== 0) return null;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i += 1) {
        const byte = Number.parseInt(hex.substr(i * 2, 2), 16);
        if (Number.isNaN(byte)) return null;
        out[i] = byte;
    }
    return out;
}
