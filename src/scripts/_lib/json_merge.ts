/**
 * JSON-shaped merge primitives shared by the installer's host-config writers.
 *
 * Moved verbatim out of `src/scripts/install.ts` (road-to-a-tree-that-keeps-its-
 * neighbours Phase 1.1). The behaviour is unchanged — this is a module boundary,
 * not a rewrite. Two reasons it earns its own file:
 *
 * - `install.ts` sits far above the `check_source_size_budget` ceiling, so every
 *   line added there raises the tree-wide excess. The hook-coexistence work needs
 *   to touch seven call sites in that file; paying for it with a MOVE keeps the
 *   ratchet green and leaves the file shorter than it was.
 * - `host_hook_merge.ts` needs `deepcopy` and `jsonEqual` too, and importing them
 *   from the installer would be a cycle.
 *
 * `deepMerge` REPLACES arrays wholesale. That is correct for scalar and object
 * keys and wrong for a host's `hooks.<event>` array, which is a shared list other
 * packages also append to — that case is `host_hook_merge.mergeHookEvents`, and
 * the installer routes `hooks` through it before calling this.
 */

/** True for a JSON object (not null, not an array). */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `copy.deepcopy` for JSON-shaped values. */
export function deepcopy<T>(v: T): T {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => deepcopy(x)) as unknown as T;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>)) {
        out[k] = deepcopy((v as Record<string, unknown>)[k]);
    }
    return out as unknown as T;
}

/**
 * Recursive object merge; `overlay` wins on every leaf.
 *
 * Arrays are replaced, never concatenated — see the module header for the one
 * case where that is the wrong answer and who handles it instead.
 */
export function deepMerge(
    base: Record<string, unknown>,
    overlay: Record<string, unknown>,
): Record<string, unknown> {
    const result = deepcopy(base);
    for (const key of Object.keys(overlay)) {
        const value = overlay[key];
        if (
            Object.prototype.hasOwnProperty.call(result, key) &&
            isPlainObject(result[key]) &&
            isPlainObject(value)
        ) {
            result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
        } else {
            result[key] = deepcopy(value);
        }
    }
    return result;
}

/** Deep structural equality for JSON-shaped values (Python dict `==`). */
export function jsonEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((v, i) => jsonEqual(v, b[i]));
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        return ka.every(
            (k) =>
                Object.prototype.hasOwnProperty.call(b, k) &&
                jsonEqual(a[k], (b as Record<string, unknown>)[k]),
        );
    }
    return false;
}
