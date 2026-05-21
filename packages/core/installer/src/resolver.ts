/**
 * Pack dependency resolver.
 *
 * Manifest packs declare `requires_hint` — an advisory edge that the
 * installer treats as a hard requirement when auto-selection is in play.
 * Phase 3.2 § "Resolve `requires` edges transitively" of the Phase 3
 * roadmap. The resolver is pure: takes a manifest + a user-selected set,
 * returns the transitive closure with provenance so the TUI can show
 * "auto-added: pack.X (required by pack.Y)" before confirming.
 */

import type { DiscoveryManifest, ManifestPack } from './types.js';

export interface ResolvedPack {
    readonly id: string;
    readonly autoSelected: boolean;
    /** Packs that pulled this in via `requires_hint`. Empty for user-selected. */
    readonly requiredBy: readonly string[];
}

export interface ResolveResult {
    /** Deterministic order: user-selected first (in input order), then auto-added (BFS order). */
    readonly packs: readonly ResolvedPack[];
    /** Pack ids requested but not in the manifest. */
    readonly missing: readonly string[];
}

/**
 * Compute transitive closure of `requires_hint` starting from `selected`.
 *
 * - `selected` order is preserved for user-selected packs.
 * - Auto-added packs follow BFS discovery order for stability.
 * - `requiredBy` lists every pack that pulled this one in (sorted).
 * - Missing pack ids are returned separately; the caller decides whether
 *   to surface them as a hard error or a soft warning.
 */
export function resolvePacks(
    manifest: DiscoveryManifest,
    selected: readonly string[],
): ResolveResult {
    const byId = new Map<string, ManifestPack>();
    for (const p of manifest.packs) byId.set(p.id, p);

    const missing: string[] = [];
    const userSet = new Set<string>();
    const orderedUser: string[] = [];
    for (const id of selected) {
        if (!byId.has(id)) {
            if (!missing.includes(id)) missing.push(id);
            continue;
        }
        if (!userSet.has(id)) {
            userSet.add(id);
            orderedUser.push(id);
        }
    }

    // BFS over requires_hint, recording every parent edge per node.
    const requiredByMap = new Map<string, Set<string>>();
    const autoOrder: string[] = [];
    const queue: string[] = [...orderedUser];
    const visited = new Set<string>(orderedUser);

    while (queue.length > 0) {
        const current = queue.shift() as string;
        const pack = byId.get(current);
        if (pack === undefined) continue;
        for (const depId of pack.requires_hint ?? []) {
            if (!byId.has(depId)) {
                if (!missing.includes(depId)) missing.push(depId);
                continue;
            }
            if (!userSet.has(depId)) {
                let parents = requiredByMap.get(depId);
                if (parents === undefined) {
                    parents = new Set<string>();
                    requiredByMap.set(depId, parents);
                }
                parents.add(current);
            }
            if (!visited.has(depId)) {
                visited.add(depId);
                if (!userSet.has(depId)) autoOrder.push(depId);
                queue.push(depId);
            }
        }
    }

    const packs: ResolvedPack[] = [];
    for (const id of orderedUser) {
        packs.push({ id, autoSelected: false, requiredBy: [] });
    }
    for (const id of autoOrder) {
        const parents = requiredByMap.get(id);
        const sorted = parents === undefined ? [] : [...parents].sort();
        packs.push({ id, autoSelected: true, requiredBy: sorted });
    }
    return { packs, missing };
}

/**
 * Convenience: just the resolved pack ids, in deterministic order.
 */
export function resolvedPackIds(result: ResolveResult): readonly string[] {
    return result.packs.map((p) => p.id);
}
