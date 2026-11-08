/**
 * Loads the reference-duty logic for `reread-guard`: from its conditional chunk
 * beside the dispatch bundle when bundled, from the source module otherwise. The
 * duty runs on file writes and on bound shell acts only, so the router walk, the
 * frontmatter parse and the shell recogniser stay out of the bytes every hook
 * event loads. A failed load is counted by the hook as a duty error.
 */
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as Duty from '../_lib/reference_duty.js';
import { verifyBundle } from './bundle_integrity.js';

export type ReferenceDuty = Pick<typeof Duty, 'scanDuties' | 'scanActDuties' | 'dutyStates'>;

export const REFERENCE_DUTY_CHUNK = 'reference_duty.chunk.cjs';
export const EXPECTED_REFERENCE_DUTY_SCHEMA = 1;

/**
 * Whether a command could run a bound act, so loading the chunk is worth it. A
 * superset of the lexer: quotes and backslashes are removed before matching, and
 * no word boundary is required, so a form the lexer would match is never skipped.
 * A test holds this in step with `src/config/act-references.json`.
 */
export const ACT_WORDS = /commit|push|pr/;

export function actWordsMayMatch(command: string): boolean {
    return ACT_WORDS.test(command.replace(/[\\'"]/g, ''));
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;

function isBundled(): boolean {
    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
}

function sourceRequire(req: NodeJS.Require): (id: string, from: string) => unknown {
    try {
        const api = req(['tsx', 'cjs', 'api'].join('/')) as { require?: (id: string, from: string) => unknown };
        if (typeof api.require === 'function') return api.require;
    } catch {
        // tsx absent: a plain require is the only reader left.
    }
    return (id: string) => req(id);
}

let cached: ReferenceDuty | null | undefined;

export function loadReferenceDuty(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): ReferenceDuty | null {
    if (cached !== undefined) return cached;
    cached = null;
    try {
        const self = fileURLToPath(selfUrl);
        const dir = path.dirname(self);
        const req = createRequire(selfUrl);
        let mod: Record<string, unknown>;
        if (bundled) {
            const specifier = path.join(dir, REFERENCE_DUTY_CHUNK);
            // Only a chunk whose digest sidecar verifies is executed.
            if (verifyBundle(specifier).state !== 'ok') return null;
            mod = req(specifier) as Record<string, unknown>;
        } else {
            const ext = self.endsWith('.ts') ? '.ts' : '.js';
            mod = sourceRequire(req)(path.join(dir, '..', '_lib', `reference_duty${ext}`), self) as Record<string, unknown>;
        }
        if (mod['REFERENCE_DUTY_SCHEMA'] !== EXPECTED_REFERENCE_DUTY_SCHEMA) return null;
        for (const name of ['scanDuties', 'scanActDuties', 'dutyStates']) if (typeof mod[name] !== 'function') return null;
        cached = mod as unknown as ReferenceDuty;
    } catch {
        cached = null;
    }
    return cached;
}

/** Test seam: forget the cached load. Never called by the hook path. */
export function _resetReferenceDutyCache(): void {
    cached = undefined;
}
