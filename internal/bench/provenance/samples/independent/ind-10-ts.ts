/**
 * Caches the result of `fn` keyed by a JSON-stringified argument
 * tuple. Suitable for pure functions with serializable inputs.
 */
export function memoize<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R {
    const cache = new Map<string, R>();

    return (...args: Args): R => {
        const key = JSON.stringify(args);
        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
}
