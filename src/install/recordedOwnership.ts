/**
 * Recorded-ownership classification — road-to-a-conformance-check-that-can-fail
 * Phase 5.
 *
 * The install conflict matrix decided ownership by **path-set membership**:
 * `policy.knownPaths.has(targetPath)`. That answers "did we ever write here",
 * which collapses two materially different trees into one row — a managed file
 * still carrying the bytes we wrote, and a managed file the user has since
 * edited. The second is a data-loss surface and the first is not, and the
 * matrix could not tell them apart because a path set carries no content.
 *
 * This module is the plumbing half: read the per-file SHA-256 the install
 * manifest already records, and compare it against a digest the caller
 * computed. It changes no install behaviour on its own — the matrix wiring
 * lands separately (Phase 5.2), so the behaviour change is reviewable as a
 * diff that contains no hash computation.
 *
 * Why a local YAML read rather than `installed_tools.read_manifest()`: that
 * reader is a hand-rolled parser with no YAML dependency, and it drops nested
 * `files[]` entries by design (documented degraded read, ADR-200
 * § intentional-divergence). It therefore cannot supply a recorded hash at
 * all. Reading the same file with the `yaml` package — already a runtime
 * dependency — is additive and leaves that reader's byte-exact golden tests
 * untouched.
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import * as YAML from 'yaml';

/**
 * How the install matrix owns a target on disk.
 *
 * - `recorded-unchanged` — the manifest records this path and the bytes on
 *   disk still match the digest it recorded. Ours, untouched.
 * - `recorded-modified`  — the manifest records this path and the bytes have
 *   changed since. Ours, edited by someone. Overwriting loses their work.
 * - `unknown`            — the manifest does not record this path, or records
 *   it without a digest (bridges carry `sha256: null`), or the bytes could not
 *   be read. Not an assertion that the file is foreign — an assertion that
 *   this tree cannot say.
 */
export type RecordedOwnership = 'recorded-unchanged' | 'recorded-modified' | 'unknown';

/** Absolute target path → the SHA-256 the manifest recorded (`null` for bridges). */
export type RecordedHashes = ReadonlyMap<string, string | null>;

/** The empty answer — "nothing is recorded", used whenever no manifest resolves. */
export const NO_RECORDED_HASHES: RecordedHashes = new Map<string, string | null>();

/**
 * Classify one target from the recorded digest and the on-disk digest.
 *
 * Pure — the caller supplies both digests. `undefined` for `recordedSha256`
 * means the path is not recorded at all; `null` means recorded without a
 * digest. Both answer `unknown`, because neither supports a comparison.
 */
export function classifyOwnership(
    recordedSha256: string | null | undefined,
    onDiskSha256: string | null,
): RecordedOwnership {
    if (recordedSha256 === undefined || recordedSha256 === null) return 'unknown';
    if (onDiskSha256 === null) return 'unknown';
    return recordedSha256 === onDiskSha256 ? 'recorded-unchanged' : 'recorded-modified';
}

/**
 * Read `tools[].files[]` out of an installed-tools manifest into a
 * path → digest map.
 *
 * Relative paths resolve against `projectRoot` (the manifest stores
 * user-scope entries absolute and project-scope entries relative, mirroring
 * `cmd_doctor._collect_manifest_entries`). A missing, unreadable or
 * malformed manifest yields the empty map rather than throwing — an install
 * plan must never fail because a lockfile is corrupt.
 */
export function readRecordedHashes(manifestPath: string, projectRoot: string): RecordedHashes {
    if (!existsSync(manifestPath)) return NO_RECORDED_HASHES;
    let doc: unknown;
    try {
        doc = YAML.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
        return NO_RECORDED_HASHES;
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return NO_RECORDED_HASHES;
    const tools = (doc as Record<string, unknown>)['tools'];
    if (!Array.isArray(tools)) return NO_RECORDED_HASHES;

    const out = new Map<string, string | null>();
    for (const tool of tools) {
        if (tool === null || typeof tool !== 'object' || Array.isArray(tool)) continue;
        const files = (tool as Record<string, unknown>)['files'];
        if (!Array.isArray(files)) continue;
        for (const entry of files) {
            if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
            const rec = entry as Record<string, unknown>;
            const raw = rec['path'];
            if (typeof raw !== 'string' || raw.length === 0) continue;
            const sha = rec['sha256'];
            const target = isAbsolute(raw) ? resolve(raw) : resolve(projectRoot, raw);
            out.set(target, typeof sha === 'string' && sha.length > 0 ? sha : null);
        }
    }
    return out;
}

/** Manifest location relative to a tree root (mirrors `installed_tools`). */
export const MANIFEST_RELATIVE = join('agents', 'installed-tools.lock');

/** {@link readRecordedHashes} for a tree root, resolving the manifest itself. */
export function recordedHashesForRoot(root: string): RecordedHashes {
    return readRecordedHashes(join(root, MANIFEST_RELATIVE), root);
}
