/**
 * Path mapping between manifest entries, source-tree files in the
 * shipped package, and destinations in the consumer project.
 *
 * The discovery manifest (ADR-015) records canonical paths anchored on
 * the `.agent-src.uncompressed/` source root. Two layouts coexist:
 *
 *   - root layout (npm tarball):  `.agent-src.uncompressed/rules/foo.md`
 *   - monorepo layout (dev mode): `packages/core/.agent-src.uncompressed/rules/foo.md`
 *
 * In both cases the segment **after** the marker is the artefact-relative
 * path, which the installer materializes into the consumer's `.augment/`
 * tree so Augment, Claude, Cursor, and the multi-tool layer read a
 * single surface.
 *
 * Pure functions; no I/O. The caller passes `packageRoot` (where the
 * shipped source lives) and `projectRoot` (the consumer).
 */

import { join } from 'node:path';

/**
 * Manifest-recorded prefix for canonical source files (ADR-015).
 *
 * Retained as the root-layout shape for downstream consumers that
 * compose paths. The actual detection in this module uses
 * {@link MANIFEST_SOURCE_MARKER} so both root and monorepo layouts work.
 */
export const MANIFEST_SOURCE_PREFIX = '.agent-src.uncompressed/';

/** Marker that splits any manifest path into pack-prefix + artefact-rest. */
export const MANIFEST_SOURCE_MARKER = '.agent-src.uncompressed/';

/** Consumer-side destination root for materialized artefacts. */
export const CONSUMER_DEST_PREFIX = '.augment/';

export class UnknownManifestPathError extends Error {
    public readonly path: string;
    public constructor(path: string) {
        super(`manifest path does not contain '${MANIFEST_SOURCE_MARKER}': ${path}`);
        this.name = 'UnknownManifestPathError';
        this.path = path;
    }
}

/**
 * Extract the artefact-relative path (everything after the source
 * marker). Accepts both root-layout and monorepo-layout manifest paths.
 * Returns `null` when the marker is absent or appears mid-segment.
 */
function extractArtefactRest(manifestPath: string): string | null {
    const idx = manifestPath.indexOf(MANIFEST_SOURCE_MARKER);
    if (idx === -1) {
        return null;
    }
    // The marker must either start the path or be preceded by '/', so
    // an accidental substring inside an artefact name cannot match.
    if (idx > 0 && manifestPath.charAt(idx - 1) !== '/') {
        return null;
    }
    return manifestPath.slice(idx + MANIFEST_SOURCE_MARKER.length);
}

/**
 * Strip the manifest prefix and return the path the installer writes
 * into the consumer's project, relative to `projectRoot`. Always
 * `.augment/<rest>`.
 */
export function manifestToConsumerRelative(manifestPath: string): string {
    const rest = extractArtefactRest(manifestPath);
    if (rest === null) {
        throw new UnknownManifestPathError(manifestPath);
    }
    return `${CONSUMER_DEST_PREFIX}${rest}`;
}

/**
 * Absolute path in the consumer project where the artefact will land.
 */
export function manifestToConsumerAbsolute(projectRoot: string, manifestPath: string): string {
    return join(projectRoot, manifestToConsumerRelative(manifestPath));
}

/**
 * Absolute path inside the shipped package where the source file lives.
 * In the monorepo `packageRoot` is the repo root and the manifest path
 * carries the `packages/<pack>/` prefix; in an installed npm tarball
 * `packageRoot` is the tarball root and the manifest path starts with
 * `.agent-src.uncompressed/` directly. `join` handles both shapes.
 */
export function manifestToPackageSource(packageRoot: string, manifestPath: string): string {
    if (extractArtefactRest(manifestPath) === null) {
        throw new UnknownManifestPathError(manifestPath);
    }
    return join(packageRoot, manifestPath);
}

export interface ResolvedArtefactPaths {
    /** Original path as recorded in the manifest. */
    readonly manifestPath: string;
    /** Absolute path of the source file inside the package. */
    readonly sourceAbsolute: string;
    /** Absolute path where the file will be written in the consumer. */
    readonly destAbsolute: string;
    /** Path relative to `projectRoot`, e.g. `.augment/rules/foo.md`. */
    readonly destRelative: string;
}

export function resolveArtefactPaths(
    packageRoot: string,
    projectRoot: string,
    manifestPath: string,
): ResolvedArtefactPaths {
    const destRelative = manifestToConsumerRelative(manifestPath);
    return {
        manifestPath,
        sourceAbsolute: manifestToPackageSource(packageRoot, manifestPath),
        destAbsolute: join(projectRoot, destRelative),
        destRelative,
    };
}
