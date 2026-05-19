/**
 * Discovery-manifest loader — single source of truth for reading
 * `dist/discovery/discovery-manifest.json` from both the CLI and the
 * Fastify server route.
 *
 * The manifest is a release-time artefact (see ADR-013 and
 * `agents/roadmaps/archive/automated-pack-workspace-and-skill-discovery.md`,
 * archived at status: completed).
 * Absence at runtime is operator error, not a crash — callers either
 * print a clear CLI message or surface HTTP 503.
 */

import { readFileSync } from 'node:fs';
import { DISCOVERY_MANIFEST } from '../paths.js';

/** Thrown when the manifest file is not on disk. */
export class ManifestNotFoundError extends Error {
    public readonly path: string;
    public constructor(path: string) {
        super(`discovery manifest not found at ${path}`);
        this.name = 'ManifestNotFoundError';
        this.path = path;
    }
}

/** Thrown when the manifest exists but is unparseable / malformed. */
export class ManifestParseError extends Error {
    public readonly path: string;
    public constructor(path: string, cause: unknown) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        super(`discovery manifest at ${path} is not valid JSON: ${reason}`);
        this.name = 'ManifestParseError';
        this.path = path;
    }
}

export interface DiscoveryWorkspace {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly default_packs: readonly string[];
    readonly optional_packs?: readonly string[];
}

export interface DiscoveryPack {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly workspaces: readonly string[];
    readonly requires_hint?: readonly string[];
    readonly trust_level_default: string;
    readonly artefact_count: number;
}

export interface DiscoveryArtefactTrust {
    readonly level: string;
    readonly confidence: string;
    readonly human_review_required: boolean;
}

export interface DiscoveryArtefactInstall {
    readonly default: boolean;
    readonly removable: boolean;
}

export interface DiscoveryArtefact {
    readonly path: string;
    readonly category: 'skill' | 'rule' | 'command' | 'template';
    readonly name?: string;
    readonly workspaces: readonly string[];
    readonly packs: readonly string[];
    readonly lifecycle: string;
    readonly trust: DiscoveryArtefactTrust;
    readonly install: DiscoveryArtefactInstall;
}

export interface DiscoveryUnassigned {
    readonly path: string;
    readonly category: string;
    readonly reason: string;
}

export interface DiscoveryManifest {
    readonly version: number;
    readonly generated_at: string;
    readonly scanner_version: string;
    readonly checksum: string;
    readonly workspaces: readonly DiscoveryWorkspace[];
    readonly packs: readonly DiscoveryPack[];
    readonly artefacts: readonly DiscoveryArtefact[];
    readonly unassigned: readonly DiscoveryUnassigned[];
}

export interface LoadManifestOptions {
    /** Override the on-disk path (tests only). */
    readonly path?: string;
}

/**
 * Load and parse the discovery manifest.
 *
 * Throws `ManifestNotFoundError` if the file is missing, or
 * `ManifestParseError` if the file is present but cannot be parsed.
 * Callers handle these distinctly: CLI prints a helpful message and
 * exits non-zero; the server route returns HTTP 503.
 */
export function loadManifest(opts: LoadManifestOptions = {}): DiscoveryManifest {
    const path = opts.path ?? DISCOVERY_MANIFEST;
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
    return parsed as DiscoveryManifest;
}
