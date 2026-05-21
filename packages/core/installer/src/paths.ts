/**
 * Path mapping between manifest entries, source-tree files in the
 * shipped package, and destinations in the consumer project.
 *
 * The discovery manifest (ADR-015) records canonical paths rooted at
 * `.agent-src.uncompressed/` — those are the editable sources. The
 * installer materializes them into the consumer's `.augment/` tree so
 * Augment, Claude, Cursor, and the multi-tool layer can read a single
 * surface (matches the legacy `scripts/install.sh` payload sync, which
 * also writes into `.augment/`).
 *
 * Pure functions; no I/O. The caller passes `packageRoot` (where the
 * shipped source lives) and `projectRoot` (the consumer).
 */

import { join } from 'node:path';

/** Manifest-recorded prefix for canonical source files (ADR-015). */
export const MANIFEST_SOURCE_PREFIX = '.agent-src.uncompressed/';

/** Consumer-side destination root for materialized artefacts. */
export const CONSUMER_DEST_PREFIX = '.augment/';

export class UnknownManifestPathError extends Error {
    public readonly path: string;
    public constructor(path: string) {
        super(`manifest path does not start with '${MANIFEST_SOURCE_PREFIX}': ${path}`);
        this.name = 'UnknownManifestPathError';
        this.path = path;
    }
}

/**
 * Strip the manifest prefix and return the path the installer writes
 * into the consumer's project, relative to `projectRoot`. Always
 * `.augment/<rest>`.
 */
export function manifestToConsumerRelative(manifestPath: string): string {
    if (!manifestPath.startsWith(MANIFEST_SOURCE_PREFIX)) {
        throw new UnknownManifestPathError(manifestPath);
    }
    const rest = manifestPath.slice(MANIFEST_SOURCE_PREFIX.length);
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
 * In the monorepo this is the working tree; in an installed npm tarball
 * it is `<node_modules>/@event4u/agent-config/.agent-src.uncompressed/...`.
 */
export function manifestToPackageSource(packageRoot: string, manifestPath: string): string {
    if (!manifestPath.startsWith(MANIFEST_SOURCE_PREFIX)) {
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
