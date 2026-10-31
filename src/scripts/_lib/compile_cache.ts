/**
 * compile_cache — node's on-disk compile cache for the per-event entries.
 *
 * Every hook event and every MCP start is a fresh node process that compiles
 * the same JavaScript again. `module.enableCompileCache` (node ≥ 22.1, the
 * package floor is 22.6) keeps the compiled code on disk between those
 * processes. It covers modules loaded AFTER the call — the lazy concern chunks
 * and dynamic imports — not the entry file that makes it.
 *
 * Fail-open by construction: a node without the API, an unwritable directory
 * or a throwing call all leave the process exactly as it was without the cache.
 * `NODE_DISABLE_COMPILE_CACHE` is honoured by node itself.
 */
import * as nodeModule from 'node:module';
import * as path from 'node:path';

import { event4u_root } from './user_global_paths.js';

export const COMPILE_CACHE_DIRNAME = 'compile-cache';

/** The cache directory, beside the staged runtime under the user-global root. */
export function compileCacheDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), 'runtime', COMPILE_CACHE_DIRNAME);
}

export interface CompileCacheApi {
    enableCompileCache?: (dir?: string) => unknown;
}

/** True when the cache was requested; false when the API is absent or failed. */
export function enableCompileCacheFailOpen(
    env: NodeJS.ProcessEnv = process.env,
    api: CompileCacheApi = nodeModule as unknown as CompileCacheApi,
): boolean {
    try {
        if (typeof api.enableCompileCache !== 'function') return false;
        api.enableCompileCache(compileCacheDir(env));
        return true;
    } catch {
        return false;
    }
}
