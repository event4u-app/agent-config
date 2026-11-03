/**
 * stop_snapshot — one working-tree read per dispatch, shared across concerns.
 *
 * `end_review_nudge_hook` and `obligation_settle_hook` both run on Stop and
 * both read `git diff --numstat HEAD` plus `git ls-files --others` at the same
 * root, so a Stop used to pay four `git` starts for two answers.
 *
 * The memo exists only while a dispatch scope is open
 * (`withDispatchSnapshotScope`, opened by `dispatch_entry`). Outside one every
 * read is fresh, and each scope starts empty and is discarded on exit — so a
 * standalone concern run, or a later event in a long-lived process, can never
 * be answered from an earlier event's tree.
 *
 * The scope lives on `globalThis` under a registered symbol for the same reason
 * `hook_stdin`'s override does: a concern loaded from a lazy chunk is a second
 * module graph with its own copy of this file.
 */

const SCOPE_KEY = Symbol.for('agent-config.dispatchSnapshotScope');

interface ScopeHost {
    [SCOPE_KEY]?: Map<string, unknown> | null;
}

function host(): ScopeHost {
    return globalThis as unknown as ScopeHost;
}

/** Run `fn` with a fresh, empty snapshot scope; the scope is dropped afterwards. */
export function withDispatchSnapshotScope<T>(fn: () => T): T {
    const h = host();
    const outer = h[SCOPE_KEY] ?? null;
    h[SCOPE_KEY] = new Map();
    try {
        return fn();
    } finally {
        h[SCOPE_KEY] = outer;
    }
}

/** `compute()` once per key inside an open scope; uncached outside one. */
export function memoInDispatch<T>(key: string, compute: () => T): T {
    const scope = host()[SCOPE_KEY];
    if (!scope) return compute();
    if (scope.has(key)) return scope.get(key) as T;
    const value = compute();
    scope.set(key, value);
    return value;
}
