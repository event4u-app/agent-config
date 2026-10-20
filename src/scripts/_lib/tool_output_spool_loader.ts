/**
 * The egress engine's door into the tool-output store (`tool_output_spool.ts`).
 *
 * The store is its own conditional chunk, `tool_output_spool.chunk.cjs`, loaded
 * from here only when a class is selected — so the engine chunk carries this
 * door and not the store, and with the shipped empty selection nothing loads.
 * The chunk is refused when its digest does not match its sidecar or its schema
 * is not the one this door expects; a refused or missing store means nothing is
 * stored, never that a body is withheld.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as Spool from './tool_output_spool.js';
import { SPOOL_SELECTED_CLASSES } from './tool_output_selection.js';

export const SPOOL_CHUNK_BASENAME = 'tool_output_spool.chunk.cjs';
export const EXPECTED_SPOOL_SCHEMA = 2;

let cached: typeof Spool | null | undefined;
let attempts = 0;

/** How often this process tried to load the store — zero while no class is selected. */
export function spoolLoadAttempts(): number {
    return attempts;
}

/**
 * The chunk against its `shasum` sidecar, the check `hooks/bundle_integrity.ts`
 * makes. Restated rather than imported: that module pulls the dispatcher's
 * issue log and host table into whatever bundles it, about 270 KB here.
 */
function digestMatches(spec: string): boolean {
    try {
        const expected = /^([0-9a-f]{64})\s/u.exec(fs.readFileSync(`${spec}.sha256`, 'utf-8').trim())?.[1];
        return expected !== undefined && createHash('sha256').update(fs.readFileSync(spec)).digest('hex') === expected;
    } catch {
        return false;
    }
}

function selfPath(): string {
    return typeof __filename === 'string' ? __filename : fileURLToPath(import.meta.url);
}

/** The store module, or null when it is missing, tampered with, or of another schema. Cached per process. */
export function loadSpool(self: string = selfPath()): typeof Spool | null {
    if (cached !== undefined) return cached;
    attempts += 1;
    cached = null;
    try {
        const req = createRequire(self);
        let mod: Record<string, unknown>;
        if (self.endsWith('.chunk.cjs')) {
            const spec = path.join(path.dirname(self), SPOOL_CHUNK_BASENAME);
            if (!digestMatches(spec)) return null;
            mod = req(spec) as Record<string, unknown>;
        } else {
            // From source the store is TypeScript; tsx's require resolves its `.js` imports.
            const spec = path.join(path.dirname(self), `tool_output_spool${path.extname(self)}`);
            const api = req(['tsx', 'cjs', 'api'].join('/')) as { require: (id: string, from: string) => unknown };
            mod = api.require(spec, self) as Record<string, unknown>;
        }
        if (mod['SPOOL_SCHEMA'] === EXPECTED_SPOOL_SCHEMA && typeof mod['spoolResult'] === 'function') {
            cached = mod as unknown as typeof Spool;
        }
    } catch {
        cached = null;
    }
    return cached;
}

/** What the stage calls. No selected class answers before anything loads. */
export function spoolResult(
    envelope: Record<string, unknown>,
    view: Spool.SpoolStageView,
    resultKeys: readonly string[],
    root: string,
    selected: typeof SPOOL_SELECTED_CLASSES = SPOOL_SELECTED_CLASSES,
    now: number = Date.now(),
    limits: Spool.SpoolLimits = {},
): Spool.SpoolOutcome {
    if (selected.size === 0) return { action: 'skip', reason: 'unselected' };
    const store = loadSpool();
    return store === null ? { action: 'skip', reason: 'store-unavailable' } : store.spoolResult(envelope, view, resultKeys, root, selected, now, limits);
}
