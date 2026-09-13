/**
 * Settings keys this package has RENAMED, old path -> new path.
 *
 * Distinct from `REMOVED_KEYS` in the one way that matters to a user: a
 * removed key's value is DISCARDED, and a renamed key's value is CARRIED.
 * Putting a rename in the removed map would silently return an installed
 * `false` to the shipped default, which is the opposite of accepting the old
 * key — so the two maps stay separate even though both warn once.
 *
 * An entry is dropped one minor after it lands. The new key always wins when
 * one layer carries both: a reader who has already migrated is not overridden
 * by a stale line they forgot to delete.
 *
 * Its own module rather than more lines in `agent_settings.ts`, which sits
 * three lines under the 1500-line source ceiling — a sixty-line addition there
 * is sixty units of ratchet, and here it is none.
 */

export type SettingsLayer = Record<string, unknown>;

export const RENAMED_KEYS: ReadonlyMap<string, string> = new Map([
    ['planning.challenge_on_create', 'planning.closure_pass'],
]);

/** Keys already warned about in THIS process — the "once per run" dedupe. */
const _warned = new Set<string>();

/** Read a dotted path out of a settings tree. `undefined` when absent. */
function _read(tree: SettingsLayer, dotted: string): unknown {
    let cur: unknown = tree;
    for (const part of dotted.split('.')) {
        if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
        cur = (cur as SettingsLayer)[part];
    }
    return cur;
}

/** Write a dotted path into a settings tree, creating the intermediate maps. */
function _write(tree: SettingsLayer, dotted: string, value: unknown): void {
    const parts = dotted.split('.');
    let cur: SettingsLayer = tree;
    for (const part of parts.slice(0, -1)) {
        const next = cur[part];
        if (next === null || typeof next !== 'object' || Array.isArray(next)) cur[part] = {};
        cur = cur[part] as SettingsLayer;
    }
    cur[parts[parts.length - 1] as string] = value;
}

/**
 * Carry every renamed key's value onto its new path within ONE layer, and
 * return that layer.
 *
 * Per LAYER, before the merge, and that ordering is the whole contract: the
 * shipped template already carries the new key, so a rename applied to the
 * MERGED tree would always find the target "already set" and drop the user's
 * value on the floor. Applied per layer, the old key becomes the new key
 * inside the layer that wrote it, and ordinary precedence does the rest.
 *
 * Mutates and returns `layer` so it can wrap an existing merge call without
 * adding a statement. Never throws: a layer that cannot be walked is a layer
 * with nothing to migrate.
 */
export function applyRenamedKeys<T extends SettingsLayer>(layer: T): T {
    for (const [oldKey, newKey] of RENAMED_KEYS) {
        const oldValue = _read(layer, oldKey);
        if (oldValue === undefined) continue;
        if (_read(layer, newKey) === undefined) _write(layer, newKey, oldValue);
        if (_warned.has(oldKey)) continue;
        _warned.add(oldKey);
        process.stderr.write(
            `⚠️  settings: \`${oldKey}\` was renamed to \`${newKey}\`. The old key still ` +
                `works for one minor; rename it in your .agent-settings.yml.\n`,
        );
    }
    return layer;
}

/** Test seam — the once-per-process warning dedupe is process state. */
export function _resetRenameWarnings(): void {
    _warned.clear();
}
