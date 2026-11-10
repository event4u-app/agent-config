/**
 * The digest check of a built bundle or chunk against its sidecar, apart from
 * the dispatcher's integrity gate (`bundle_integrity.ts`, which re-exports it).
 * Split out so a lazily loaded chunk can verify a chunk it loads without
 * pulling the gate's host tables, and their YAML reader, into its own bytes.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** What a verification produced. */
export type IntegrityVerdict =
    | { state: 'ok'; sha: string }
    | { state: 'mismatch'; expected: string; actual: string }
    | { state: 'unverifiable'; reason: string };

/** Read the expected digest out of a `shasum -a 256` style sidecar. */
export function parseSidecar(text: string): string | null {
    // `<64 hex>  <filename>` — the two-space form `shasum` emits. Tolerant of
    // any run of whitespace and of a trailing newline, because an operator who
    // regenerates the file by hand should not be punished for one space.
    const m = /^([0-9a-f]{64})\s/u.exec(text.trim());
    return m === null ? null : (m[1] as string);
}

/** Where the sidecar for a given bundle lives. */
export function sidecarPathFor(bundlePath: string): string {
    return bundlePath.replace(/\.js$/u, '') + '.sha256';
}

/** SHA-256 of a file's bytes, or null when it cannot be read. */
export function hashFile(p: string): string | null {
    try {
        return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    } catch {
        return null;
    }
}

/**
 * Compare a bundle against its sidecar.
 *
 * Pure apart from the two reads, so the caller's caching and the verdict logic
 * can be tested without a dispatch.
 */
export function verifyBundle(bundlePath: string): IntegrityVerdict {
    const sidecar = sidecarPathFor(bundlePath);
    let expected: string | null;
    try {
        expected = parseSidecar(fs.readFileSync(sidecar, 'utf-8'));
    } catch {
        return { state: 'unverifiable', reason: `no sidecar at ${path.basename(sidecar)}` };
    }
    if (expected === null) {
        return { state: 'unverifiable', reason: `sidecar at ${path.basename(sidecar)} is malformed` };
    }
    const actual = hashFile(bundlePath);
    if (actual === null) {
        return { state: 'unverifiable', reason: `bundle at ${path.basename(bundlePath)} is unreadable` };
    }
    return actual === expected ? { state: 'ok', sha: actual } : { state: 'mismatch', expected, actual };
}
