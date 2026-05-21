/**
 * Selection helpers — pure functions used by the interactive and
 * non-interactive `init` paths. The TUI calls `inquirer` for input;
 * the non-interactive path parses CSV flags. Both feed `resolvePacks`.
 */

import type { DiscoveryManifest, ManifestPack, ManifestWorkspace } from './types.js';

export class UnknownWorkspaceError extends Error {
    public readonly id: string;
    public constructor(id: string) {
        super(`unknown workspace id: ${id}`);
        this.name = 'UnknownWorkspaceError';
        this.id = id;
    }
}

export class UnknownPackError extends Error {
    public readonly id: string;
    public constructor(id: string) {
        super(`unknown pack id: ${id}`);
        this.name = 'UnknownPackError';
        this.id = id;
    }
}

/** Parse a comma-separated id list, trimming whitespace, dropping empties. */
export function parseCsv(value: string | undefined): readonly string[] {
    if (value === undefined || value.trim().length === 0) return [];
    return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Validate that every id is in the manifest's workspace list. */
export function validateWorkspaces(manifest: DiscoveryManifest, ids: readonly string[]): readonly string[] {
    const known = new Set(manifest.workspaces.map((w) => w.id));
    for (const id of ids) {
        if (!known.has(id)) throw new UnknownWorkspaceError(id);
    }
    return ids;
}

/** Validate that every id is in the manifest's pack list. */
export function validatePackIds(manifest: DiscoveryManifest, ids: readonly string[]): readonly string[] {
    const known = new Set(manifest.packs.map((p) => p.id));
    for (const id of ids) {
        if (!known.has(id)) throw new UnknownPackError(id);
    }
    return ids;
}

/** Packs whose `workspaces` list intersects the selected workspace set. */
export function packsForWorkspaces(
    manifest: DiscoveryManifest,
    workspaceIds: readonly string[],
): readonly ManifestPack[] {
    const set = new Set(workspaceIds);
    return manifest.packs.filter((p) => p.workspaces.some((w) => set.has(w)));
}

/**
 * Default pack ids for the given workspaces. Combines:
 *   - each workspace's `default_packs`
 *   - any pack inside those workspaces whose workspace lists it as a
 *     default_pack via the manifest's workspace block.
 * Deterministic order: workspace order, then pack order within workspace.
 */
export function defaultPacksFor(
    manifest: DiscoveryManifest,
    workspaceIds: readonly string[],
): readonly string[] {
    const wsById = new Map<string, ManifestWorkspace>();
    for (const w of manifest.workspaces) wsById.set(w.id, w);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of workspaceIds) {
        const ws = wsById.get(id);
        if (ws === undefined) continue;
        for (const packId of ws.default_packs) {
            if (!seen.has(packId)) {
                seen.add(packId);
                out.push(packId);
            }
        }
    }
    return out;
}

export interface SelectionInputs {
    readonly manifest: DiscoveryManifest;
    /** From `--workspaces=a,b`, validated. */
    readonly workspaces: readonly string[];
    /** From `--packs=x,y`. May be empty — caller falls back to defaults + detect. */
    readonly explicitPacks: readonly string[];
    /** Pack ids the user wants to exclude from auto-selection. */
    readonly excludePacks: readonly string[];
    /** Pack ids surfaced by `detectPacks(...)`. */
    readonly autoDetected: readonly string[];
}

/**
 * Merge sources into the candidate pack list (pre-resolution): explicit
 * picks plus workspace defaults plus auto-detect minus excludes.
 * Order: explicit first, then defaults, then auto-detect.
 */
export function mergePackCandidates(input: SelectionInputs): readonly string[] {
    const excludeSet = new Set(input.excludePacks);
    const explicit = input.explicitPacks.filter((id) => !excludeSet.has(id));
    const defaults = defaultPacksFor(input.manifest, input.workspaces).filter((id) => !excludeSet.has(id));
    const detected = input.autoDetected.filter((id) => !excludeSet.has(id));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of [...explicit, ...defaults, ...detected]) {
        if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}
