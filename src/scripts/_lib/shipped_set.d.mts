/** Types for `shipped_set.mjs` — the npm package's shipped set, from package.json `files`. */
export interface ShippedSet {
    readonly prefixes: string[];
    isShipped(posixPath: string): boolean;
}
export function shippedSet(files: readonly string[]): ShippedSet;
