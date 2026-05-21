/**
 * Stream-based sha256 helper for installer file hashing.
 *
 * Used by the lockfile writer (per-file `sha256`) and the manifest
 * verifier (`manifest_sha256` recorded per file in the lockfile, per
 * ADR-016 § 1).
 */

import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';

/** Compute sha256 hex of a UTF-8 string. */
export function sha256OfString(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Compute sha256 hex of a file's raw bytes (synchronous, small files). */
export function sha256OfFileSync(path: string): string {
    const buf = readFileSync(path);
    return createHash('sha256').update(buf).digest('hex');
}

/**
 * Compute sha256 hex of a file's raw bytes (streaming, any size).
 * Preferred for files > 1 MB or unknown size.
 */
export async function sha256OfFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(path);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => { resolve(hash.digest('hex')); });
        stream.on('error', reject);
    });
}
