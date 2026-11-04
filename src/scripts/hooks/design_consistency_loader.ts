/**
 * Loads the consistency check (`_lib/design_consistency_pass.ts`) for a UI
 * write — the conditional-chunk pattern of `svg_rules_loader.ts`, whose header
 * carries the reasons: synchronous `require` because a concern is synchronous,
 * a computed specifier so esbuild does not inline the module, the bundle's
 * integrity check on the chunk, and null instead of a throw so a missing chunk
 * costs the finding and never the dispatch.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ConsistencyNotice } from '../_lib/design_consistency_pass.js';
import { isBundled, loadChunkExport } from './svg_rules_loader.js';

export type ConsistencyPass = (root: string, file: string, content: string) => ConsistencyNotice[];

export const CONSISTENCY_CHUNK = 'design_consistency.chunk.cjs';

export function consistencySpecifier(selfUrl: string, bundled: boolean): string {
    const self = fileURLToPath(selfUrl);
    const dir = path.dirname(self);
    if (bundled) return path.join(dir, CONSISTENCY_CHUNK);
    return path.join(dir, '..', '_lib', `design_consistency_pass${self.endsWith('.ts') ? '.ts' : '.js'}`);
}

export function loadConsistencyPass(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): ConsistencyPass | null {
    let specifier: string;
    try {
        specifier = consistencySpecifier(selfUrl, bundled);
    } catch {
        return null;
    }
    return loadChunkExport<ConsistencyPass>(selfUrl, specifier, 'consistencyPass', bundled);
}
