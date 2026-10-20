/**
 * Concerns the dispatch bundle does NOT inline, and how to load one.
 *
 * WHY. Every concern in `concern_registry.ts` is statically imported, so
 * esbuild folds its whole transitive closure into `dist/hooks/dispatch.js` —
 * the one bundle every hook event loads. A concern bound on ONE event is then
 * paid for on every other one. Measured 2026-10-20 from the bundle's own
 * metafile: `src/scripts/chat_history.ts` and the modules reachable only
 * through it were 121,219 bytes of a 1,549,961-byte bundle, and `chat-history`
 * is bound on `session_start` alone.
 *
 * An AI council of two providers chose this mechanism on 2026-10-18 for the
 * egress engine — move the module out into a conditional chunk rather than
 * raise the byte ceiling, and give the chunk a measured budget of its own
 * (roadmap decision D9, `src/config/hook-bundle-budget.json`). This applies the
 * same mechanism to a CONCERN, which `hooks/egress_engine_loader.ts` does not
 * cover: a concern is reached through the registry and has a spawn fallback
 * behind it, so the failure shape is different and gets its own loader.
 *
 * WHAT HAPPENS WHEN THE CHUNK IS NOT THERE. Nothing silently stops working.
 * `_run_concern` tries the static registry, then this, then the historical
 * spawn-per-concern path — which is slower and still correct. A missing or
 * mis-digested chunk therefore costs latency, never the concern's effect. That
 * is the whole reason a concern may be moved out at all and an egress engine
 * may not: there is a correct path behind the fast one.
 *
 * WHY `require` AND A COMPUTED SPECIFIER — as in `svg_rules_loader.ts`: a
 * concern runs synchronously, and a literal specifier would be inlined by
 * esbuild, which is the cost this exists to avoid.
 */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBundle } from './bundle_integrity.js';
import type { ConcernMain } from './concern_registry_types.js';

/**
 * Manifest `script:` path → the chunk basename beside `dist/hooks/dispatch.js`,
 * and the source module to fall back to when running from the tree.
 */
export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; readonly source: string }>> =
    Object.freeze({
        'src/scripts/chat_history.ts': Object.freeze({
            chunk: 'chat_history.chunk.cjs',
            source: path.join('..', 'chat_history'),
        }),
    });

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;

function isBundled(): boolean {
    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
}

/** Where a lazy concern loads from: the sibling chunk when bundled, the source module otherwise. */
export function lazyConcernSpecifier(script: string, selfUrl: string, bundled: boolean): string | null {
    const entry = LAZY_CONCERNS[script];
    if (entry === undefined) return null;
    const selfPath = fileURLToPath(selfUrl);
    const dir = path.dirname(selfPath);
    if (bundled) return path.join(dir, entry.chunk);
    const ext = selfPath.endsWith('.ts') ? '.ts' : '.js';
    return path.join(dir, `${entry.source}${ext}`);
}

/**
 * From the source tree the concern is TypeScript whose imports name `.js`
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

/**
 * The concern's `main`, or `null` when the chunk is absent, mis-digested or
 * does not export one. Every failure is a value: the caller falls back to the
 * spawn path, which is what makes a missing chunk a latency cost rather than a
 * lost effect.
 */
export function loadLazyConcernUncached(
    script: string,
    selfUrl: string = import.meta.url,
    bundled: boolean = isBundled(),
): ConcernMain | null {
    try {
        const specifier = lazyConcernSpecifier(script, selfUrl, bundled);
        if (specifier === null || !fs.existsSync(specifier)) return null;
        // No sidecar, a malformed one or a mismatch: the chunk is not the one built.
        if (bundled && verifyBundle(specifier).state !== 'ok') return null;
        const req = createRequire(selfUrl);
        const mod = (bundled ? req(specifier) : sourceRequire(req)(specifier, fileURLToPath(selfUrl))) as Record<
            string,
            unknown
        >;
        const main = mod['main'];
        return typeof main === 'function' ? (main as ConcernMain) : null;
    } catch {
        return null;
    }
}

const cache = new Map<string, ConcernMain | null>();

/** The concern's `main` or `null`; cached per process, failures included. */
export function loadLazyConcern(script: string, selfUrl: string = import.meta.url): ConcernMain | null {
    const key = `${selfUrl}\u0000${script}`;
    if (cache.has(key)) return cache.get(key) ?? null;
    const loaded = loadLazyConcernUncached(script, selfUrl);
    cache.set(key, loaded);
    return loaded;
}

/** Test seam: forget every cached load. Never called by the hook path. */
export function _resetLazyConcernCache(): void {
    cache.clear();
}
