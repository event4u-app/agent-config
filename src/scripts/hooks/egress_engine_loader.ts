/**
 * Loads the egress engine (`_lib/egress_engine.ts`) on demand.
 *
 * WHY A CHUNK. The engine is about 19 KB of `dist/hooks/dispatch.js`, the one
 * bundle every hook event loads, while the egress stage's shipped mode is `off`
 * and never touches it. With 3 KB of headroom under the bundle ceiling and
 * 12–15 KB of engine growth queued, an AI council of two providers chose on
 * 2026-10-18 to emit the engine as `egress_engine.chunk.cjs` beside the bundle
 * rather than raise the ceiling — the shape `svg_rules_loader.ts` set.
 *
 * WHY THIS ONE IS STRICTER THAN THE SVG LOADER. A missing SVG rule set costs a
 * lint finding; a missing egress engine would let content through unscanned.
 * So a chunk is refused when its digest does not match its sidecar, when there
 * is no sidecar to match, and when its `ENGINE_SCHEMA` is not the one this
 * loader was built against — a correctly digested chunk of another release is
 * a load failure, never stale rules. Every failure is a value, never a throw,
 * and each caller decides what an unavailable engine means for it: the stage
 * withholds bodies in `protect` and `strict` and records the miss in
 * `observe`; the subagent capsule rejects the envelope.
 *
 * WHY `require` AND THE COMPUTED SPECIFIER — see `svg_rules_loader.ts`: a
 * concern is synchronous, and a literal specifier would be inlined by esbuild,
 * which is the cost this exists to avoid.
 */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as Engine from '../_lib/egress_engine.js';
import { verifyBundle } from './bundle_integrity.js';

/** The engine's exports. Type-only, so no engine byte reaches the bundle. */
export type EgressEngine = typeof Engine;

/** The schema this loader accepts. Must equal `ENGINE_SCHEMA` in the engine. */
export const EXPECTED_ENGINE_SCHEMA = 2;

export const ENGINE_CHUNK_BASENAME = 'egress_engine.chunk.cjs';

export type EngineLoad =
    | { readonly ok: true; readonly engine: EgressEngine }
    | { readonly ok: false; readonly reason: 'missing' | 'digest' | 'schema' | 'invalid' };

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;

function isBundled(): boolean {
    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
}

/** Where the engine loads from: the sibling chunk when bundled, the source module otherwise. */
export function engineSpecifier(selfUrl: string, bundled: boolean): string {
    const selfPath = fileURLToPath(selfUrl);
    const dir = path.dirname(selfPath);
    if (bundled) return path.join(dir, ENGINE_CHUNK_BASENAME);
    const ext = selfPath.endsWith('.ts') ? '.ts' : '.js';
    return path.join(dir, '..', '_lib', `egress_engine${ext}`);
}

/**
 * From source the engine is TypeScript whose imports name `.js` siblings, which
 * a plain `require` cannot resolve outside a `tsx` process (a test runner, for
 * one). `tsx`'s own require resolves them; the specifier is computed so esbuild
 * never pulls `tsx` into the bundle, where this branch is not taken. Without
 * `tsx` the plain require fails on such a module, which is `invalid`: the
 * source path is a development path, and it fails closed like every other.
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
 * The uncached load; `bundled` is a test seam, the hook path never passes it.
 *
 * Every step — resolving the specifier, the existence check, the digest, the
 * load, the export check — runs inside one conversion boundary, so the function
 * returns a value on every path. `missing` means the chunk file itself is
 * absent; once it exists, anything its load throws (a dependency it cannot
 * resolve included) is `invalid`.
 */
export function loadEgressEngineUncached(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): EngineLoad {
    try {
        const specifier = engineSpecifier(selfUrl, bundled);
        if (!fs.existsSync(specifier)) return { ok: false, reason: 'missing' };
        // No sidecar, a malformed one or a mismatch: the chunk is not the one built.
        if (bundled && verifyBundle(specifier).state !== 'ok') return { ok: false, reason: 'digest' };
        let mod: Record<string, unknown>;
        try {
            const req = createRequire(selfUrl);
            mod = (bundled ? req(specifier) : sourceRequire(req)(specifier, fileURLToPath(selfUrl))) as Record<string, unknown>;
        } catch {
            return { ok: false, reason: 'invalid' };
        }
        if (mod['ENGINE_SCHEMA'] !== EXPECTED_ENGINE_SCHEMA) return { ok: false, reason: 'schema' };
        for (const name of ['detect', 'replaceValues', 'scanText', 'TokenScope', 'EgressRefusedError', 'planStage']) {
            if (typeof mod[name] !== 'function') return { ok: false, reason: 'invalid' };
        }
        if (!Array.isArray(mod['EGRESS_RULES'])) return { ok: false, reason: 'invalid' };
        return { ok: true, engine: mod as unknown as EgressEngine };
    } catch {
        return { ok: false, reason: 'invalid' };
    }
}

const cache = new Map<string, EngineLoad>();

/** The engine or why it is unavailable; cached per process, failures included. */
export function loadEgressEngine(selfUrl: string = import.meta.url): EngineLoad {
    const hit = cache.get(selfUrl);
    if (hit !== undefined) return hit;
    const load = loadEgressEngineUncached(selfUrl);
    cache.set(selfUrl, load);
    return load;
}

/** Test seam: forget every cached load. Never called by the hook path. */
export function _resetEgressEngineCache(): void {
    cache.clear();
}
