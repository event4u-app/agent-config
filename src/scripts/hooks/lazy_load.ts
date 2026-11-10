/**
 * Loading one export of a chunk beside the running bundle, without the table of
 * lazy concerns (`lazy_concern.ts`). Its own module so a chunk that loads
 * another chunk (the agent-switch link from `quota_notice`) names only the
 * chunk it loads, not every module the table points at.
 *
 * WHY `require` AND A COMPUTED SPECIFIER — as in `svg_rules_loader.ts`: the
 * callers run synchronously, and a literal specifier would be inlined by
 * esbuild, which is the cost a chunk exists to avoid.
 */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBundle } from './bundle_digest.js';

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;

export function isBundled(): boolean {
    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
}

/**
 * From the source tree the module is TypeScript whose imports name `.js`
 * siblings, which a plain `require` cannot resolve outside a `tsx` process.
 * `tsx`'s own require resolves them; the specifier is computed so esbuild never
 * pulls `tsx` into the bundle, where this branch is not taken.
 */
function sourceRequire(req: NodeJS.Require): (id: string, from: string) => unknown {
    try {
        const api = req(['tsx', 'cjs', 'api'].join('/')) as { require?: (id: string, from: string) => unknown };
        if (typeof api.require === 'function') return api.require;
    } catch {
        // tsx absent: a plain require is the only reader left.
    }
    return (id: string) => req(id);
}

/** Where a chunk loads from: `chunk` beside `selfUrl` when bundled, the `source` module relative to it otherwise. */
export function chunkSpecifier(chunk: string, source: string, selfUrl: string, bundled: boolean): string {
    const selfPath = fileURLToPath(selfUrl);
    const dir = path.dirname(selfPath);
    if (bundled) return path.join(dir, chunk);
    return path.join(dir, `${source}${selfPath.endsWith('.ts') ? '.ts' : '.js'}`);
}

/**
 * The function `name` the chunk exports, or `null` when the chunk is absent,
 * does not match its digest sidecar (bundled only), fails to load or exports
 * no such function. Every failure is a value.
 */
export function loadChunkExport<T>(chunk: string, source: string, name: string, selfUrl: string, bundled: boolean = isBundled()): T | null {
    try {
        const specifier = chunkSpecifier(chunk, source, selfUrl, bundled);
        if (!fs.existsSync(specifier)) return null;
        // No sidecar, a malformed one or a mismatch: the chunk is not the one built.
        if (bundled && verifyBundle(specifier).state !== 'ok') return null;
        const req = createRequire(selfUrl);
        const mod = (bundled ? req(specifier) : sourceRequire(req)(specifier, fileURLToPath(selfUrl))) as Record<string, unknown>;
        const fn = mod[name];
        return typeof fn === 'function' ? (fn as T) : null;
    } catch {
        return null;
    }
}
