/**
 * Load `token_count` on first use, from source and from a bundle alike.
 *
 * Callers on hot import paths (`memory_lookup`, reached by the MCP server) must
 * not pay the js-tiktoken load that `token_count` does at module evaluation, so
 * they defer it with a synchronous require. `createRequire(import.meta.url)` with
 * a relative path resolves only beside the source file: inside a
 * `dist/cli-delegate/` chunk that path names nothing, the load threw, and the
 * caller silently fell back to its chars/4 proxy. A literal `require(...)` is
 * what esbuild inlines — still evaluated lazily, on this call.
 */
import { createRequire } from 'node:module';

import type * as TokenCount from './token_count.js';

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;

/** The `token_count` module, or throws when it cannot be loaded. */
export function loadTokenCount(): typeof TokenCount {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- the literal require IS the bundling mechanism (header)
        return require('./token_count.js') as typeof TokenCount;
    }
    return createRequire(import.meta.url)('./token_count.js') as typeof TokenCount;
}
