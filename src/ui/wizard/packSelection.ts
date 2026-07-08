/**
 * Pure pack-selection helpers for the wizard packs step
 * (road-to-setup-experience § Phase 2).
 *
 * Seeding order: installed packs (the top-level `packs:` manifest a prior
 * install wrote) first, then role-recommended packs, then auto-detected
 * project packs. Installed packs also pull their language cluster tile on
 * so a framework child (e.g. `laravel` under `php`) renders enabled.
 *
 * Removal detection compares the installed manifest against the resolved
 * final pack set — the review step flags every removal as destructive and
 * requires an explicit confirm before Finish.
 */

export interface PackSeedInput {
    /** Installed packs from the settings `packs:` manifest. */
    installed: readonly string[];
    /** Union of `default_packs` from the selected role workspaces. */
    roleDefaults: readonly string[];
    /** Auto-detected project packs (already filtered upstream). */
    detected: readonly string[];
    /** Pack id → language cluster id (framework children only). */
    clusterOf: ReadonlyMap<string, string>;
}

export function seedPackSelection(input: PackSeedInput): Record<string, boolean> {
    const seed: Record<string, boolean> = {};
    const add = (id: string): void => {
        seed[id] = true;
        const cluster = input.clusterOf.get(id);
        if (cluster !== undefined) seed[cluster] = true;
    };
    for (const id of input.installed) add(id);
    for (const id of input.roleDefaults) add(id);
    for (const id of input.detected) add(id);
    return seed;
}

/**
 * Installed packs missing from the resolved final selection — the set the
 * review step must flag as removals. `engineering-base` is excluded: it is
 * an auto-included dependency, never a user-facing tile, and re-enters the
 * final set via the requires-closure whenever any pack needs it.
 */
export function computePackRemovals(
    installed: readonly string[],
    finalPacks: readonly string[],
): string[] {
    const final = new Set(finalPacks);
    return installed
        .filter((id) => id !== 'engineering-base' && !final.has(id))
        .sort();
}
