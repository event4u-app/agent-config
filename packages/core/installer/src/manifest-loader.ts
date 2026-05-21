/**
 * Discovery-manifest loader for `@event4u/installer`.
 *
 * Reads `dist/discovery/discovery-manifest.json` (locked by ADR-015) and
 * computes the manifest sha256 that the lockfile records per-file
 * (ADR-016 § 1). The installer treats absence as operator error and
 * surfaces a clear message — never silently proceeds.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sha256OfString } from './io/sha256.js';
import type { DiscoveryManifest } from './types.js';

export class ManifestNotFoundError extends Error {
    public readonly path: string;
    public constructor(path: string) {
        super(`discovery manifest not found at ${path}`);
        this.name = 'ManifestNotFoundError';
        this.path = path;
    }
}

export class ManifestParseError extends Error {
    public readonly path: string;
    public constructor(path: string, cause: unknown) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        super(`discovery manifest at ${path} is not valid JSON: ${reason}`);
        this.name = 'ManifestParseError';
        this.path = path;
    }
}

export class ManifestSchemaError extends Error {
    public readonly path: string;
    public readonly reason: string;
    public constructor(path: string, reason: string) {
        super(`discovery manifest at ${path} failed schema check: ${reason}`);
        this.name = 'ManifestSchemaError';
        this.path = path;
        this.reason = reason;
    }
}

/** Schema versions this loader understands. ADR-015 contract. */
export const SUPPORTED_MANIFEST_SCHEMA_VERSIONS: readonly number[] = [1];

export interface LoadedManifest {
    readonly manifest: DiscoveryManifest;
    readonly sha256: string;
    readonly path: string;
}

export interface LoadManifestOptions {
    /** Explicit path. Default: `dist/discovery/discovery-manifest.json` walked up from cwd. */
    readonly path?: string;
    /** Start directory for upward search. Defaults to `process.cwd()`. */
    readonly searchFrom?: string;
}

/** Walk upward from `start` looking for `dist/discovery/discovery-manifest.json`. */
export function findManifestPath(start: string): string | null {
    let dir = start;
    while (true) {
        const candidate = join(dir, 'dist', 'discovery', 'discovery-manifest.json');
        if (existsSync(candidate)) return candidate;
        const parent = dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

/**
 * Load + parse the discovery manifest and compute its sha256.
 *
 * The sha256 is computed over the raw bytes on disk (not the parsed
 * object) so the lockfile can record exactly what shipped, byte-for-byte.
 */
export function loadManifest(opts: LoadManifestOptions = {}): LoadedManifest {
    const path = resolveManifestPath(opts);
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    } catch (err) {
        if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new ManifestNotFoundError(path);
        }
        throw err;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new ManifestParseError(path, err);
    }
    assertManifestShape(parsed, path);
    return {
        manifest: parsed,
        sha256: sha256OfString(raw),
        path,
    };
}

function assertManifestShape(value: unknown, path: string): asserts value is DiscoveryManifest {
    if (typeof value !== 'object' || value === null) {
        throw new ManifestSchemaError(path, 'manifest is not an object');
    }
    const m = value as Record<string, unknown>;
    const version = m.version;
    if (typeof version !== 'number' || !SUPPORTED_MANIFEST_SCHEMA_VERSIONS.includes(version)) {
        throw new ManifestSchemaError(
            path,
            `unsupported manifest version ${String(version)} (supported: ${SUPPORTED_MANIFEST_SCHEMA_VERSIONS.join(', ')})`,
        );
    }
    for (const field of ['generated_at', 'scanner_version', 'checksum'] as const) {
        if (typeof m[field] !== 'string') {
            throw new ManifestSchemaError(path, `missing or non-string field: ${field}`);
        }
    }
    for (const field of ['workspaces', 'packs', 'artefacts', 'unassigned'] as const) {
        if (!Array.isArray(m[field])) {
            throw new ManifestSchemaError(path, `missing or non-array field: ${field}`);
        }
    }
}

function resolveManifestPath(opts: LoadManifestOptions): string {
    if (opts.path !== undefined) return opts.path;
    const start = opts.searchFrom ?? process.cwd();
    const found = findManifestPath(start);
    if (found !== null) return found;
    throw new ManifestNotFoundError(join(start, 'dist', 'discovery', 'discovery-manifest.json'));
}

/**
 * Look up a pack in the manifest by id. Returns undefined if absent.
 */
export function findPack(manifest: DiscoveryManifest, id: string): DiscoveryManifest['packs'][number] | undefined {
    return manifest.packs.find((p) => p.id === id);
}

/**
 * Look up a workspace in the manifest by id. Returns undefined if absent.
 */
export function findWorkspace(
    manifest: DiscoveryManifest,
    id: string,
): DiscoveryManifest['workspaces'][number] | undefined {
    return manifest.workspaces.find((w) => w.id === id);
}

/**
 * Return all artefacts whose `packs` list intersects the given set.
 * Deterministic order: sorted by `path` (matches manifest order).
 */
export function artefactsForPacks(
    manifest: DiscoveryManifest,
    packIds: readonly string[],
): readonly DiscoveryManifest['artefacts'][number][] {
    const set = new Set(packIds);
    return manifest.artefacts.filter((a) => a.packs.some((p) => set.has(p)));
}
