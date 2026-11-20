/**
 * concern_env — the hardened environment in-process concerns run under, built
 * ONCE per dispatch instead of once per concern.
 *
 * In-process concerns may spawn their own children (git, dashboard regen), which
 * inherit `process.env`, so they run under the same hardened copy the spawn path
 * applies (`hardenedSpawnEnv`). The dispatcher used to copy the environment,
 * rebuild the hardened copy, delete and reassign, then restore — per concern.
 * Measured 0.2 ms per concern at 40 variables and up to 2 ms at 235, with 15 to
 * 20 concerns on a tool event (road-to-a-hook-system-that-pays-for-what-it-does
 * 2.3).
 *
 * Now: the dispatch opens one scope before its concern loop (saved environment
 * plus hardened copy, applied once) and closes it after. Each concern leaves
 * through {@link enterConcernEnv}'s release, which compares the environment
 * against the hardened copy and resets it only when the concern changed it —
 * so a variable one concern sets never reaches the next, which is the isolation
 * the per-concern rebuild bought.
 *
 * Outside an open scope (a direct call, a test) `enterConcernEnv` falls back to
 * the old per-concern save, harden and restore, so no caller depends on the
 * scope existing.
 */
import { hardenedSpawnEnv } from '../_lib/spawn_env.js';

interface Scope {
    readonly prev: NodeJS.ProcessEnv;
    readonly hardened: NodeJS.ProcessEnv;
}

/** Innermost last. A nested dispatch (a re-entry from inside a concern) pushes its own scope. */
const stack: Scope[] = [];

/** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
function replaceEnv(target: NodeJS.ProcessEnv): void {
    for (const k of Object.keys(process.env)) {
        if (!Object.hasOwn(target, k)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(target)) {
        if (v !== undefined && process.env[k] !== v) process.env[k] = v;
    }
}

function drifted(target: NodeJS.ProcessEnv): boolean {
    const keys = Object.keys(process.env);
    if (keys.length !== Object.keys(target).length) return true;
    for (const k of keys) {
        if (!Object.hasOwn(target, k) || process.env[k] !== target[k]) return true;
    }
    return false;
}

/**
 * Open a dispatch scope: save the environment as it is now, apply its hardened
 * copy. Returns the close function, which restores the saved environment and
 * never throws (a failed restore is reported on stderr, so a `finally` that
 * calls it cannot replace the dispatch's own outcome). The caller closes it in a
 * `finally`, so a dispatch that throws still restores and leaves no scope open.
 *
 * A nested open — a synchronous re-entry into dispatch from inside a concern —
 * is a scope of its own: it saves the outer concern's environment as it stands,
 * hardens THAT, and its close puts it back. Inner concerns are reset to the inner
 * hardened copy between each other; the outer concern gets its own environment
 * back when the inner dispatch returns, and is reset on leaving as usual.
 */
export function openConcernEnvScope(packageRoot: string): () => void {
    const scope: Scope = { prev: { ...process.env }, hardened: hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot }) };
    replaceEnv(scope.hardened);
    stack.push(scope);
    let closed = false;
    return () => {
        if (closed) return;
        closed = true;
        const at = stack.lastIndexOf(scope);
        // Already ended by an enclosing scope's close: that close restored an
        // older environment, which this one must not overwrite.
        if (at < 0) return;
        stack.splice(at);
        try {
            replaceEnv(scope.prev);
        } catch (err) {
            process.stderr.write(`concern_env: environment restore failed: ${err instanceof Error ? err.message : String(err)}\n`);
        }
    };
}

/** Enter the environment for one concern; call the returned function when it has run. */
export function enterConcernEnv(packageRoot: string): () => void {
    const scope = stack[stack.length - 1];
    if (scope === undefined) return openConcernEnvScope(packageRoot);
    return () => {
        if (drifted(scope.hardened)) replaceEnv(scope.hardened);
    };
}
