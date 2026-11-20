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

let active: Scope | null = null;

/** Make `process.env` equal `target`: drop keys it lacks, set the ones that differ. */
function replaceEnv(target: NodeJS.ProcessEnv): void {
    for (const k of Object.keys(process.env)) {
        if (!(k in target)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(target)) {
        if (v !== undefined && process.env[k] !== v) process.env[k] = v;
    }
}

function drifted(target: NodeJS.ProcessEnv): boolean {
    const keys = Object.keys(process.env);
    if (keys.length !== Object.keys(target).length) return true;
    for (const k of keys) {
        if (process.env[k] !== target[k]) return true;
    }
    return false;
}

/**
 * Open the dispatch-wide scope. Returns the close function, which restores the
 * environment the dispatch started with. A nested open is a no-op.
 */
export function openConcernEnvScope(packageRoot: string): () => void {
    if (active !== null) return () => undefined;
    const prev = { ...process.env };
    const hardened = hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: packageRoot });
    replaceEnv(hardened);
    const scope: Scope = { prev, hardened };
    active = scope;
    return () => {
        if (active !== scope) return;
        replaceEnv(scope.prev);
        active = null;
    };
}

/** Enter the environment for one concern; call the returned function when it has run. */
export function enterConcernEnv(packageRoot: string): () => void {
    const scope = active;
    if (scope === null) return openConcernEnvScope(packageRoot);
    return () => {
        if (drifted(scope.hardened)) replaceEnv(scope.hardened);
    };
}
