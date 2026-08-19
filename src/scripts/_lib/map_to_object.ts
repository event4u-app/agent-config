/**
 * map_to_object — a `ReadonlyMap` as a plain object.
 *
 * Relocated out of `council_cli.ts` unchanged so the settings-block
 * projection could move with it without importing back into that file (a
 * cycle). Both call sites now import it from here.
 */
export function _mapToObject<V>(m: ReadonlyMap<string, V>): Record<string, V> {
    const out: Record<string, V> = {};
    for (const [k, v] of m) {
        out[k] = v;
    }
    return out;
}

export { _mapToObject as mapToObject };
