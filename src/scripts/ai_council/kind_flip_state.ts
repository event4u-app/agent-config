/**
 * Where a hand kind's flip is stored, and the one read the per-prompt nudge
 * needs. Apart from `kind_flip.ts`, whose shadow-report imports would put the
 * whole measurement path into the hook bundle.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const KIND_FLIPS_RELPATH = path.join('agents', 'runtime', 'state', 'hand-kind-flips.json');

/** Unreadable or absent state is "not flipped". */
export function isKindFlipped(stateRoot: string, kind: string): boolean {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(stateRoot, KIND_FLIPS_RELPATH), 'utf8')) as { kinds?: Record<string, { route?: unknown }> };
        return raw.kinds?.[kind]?.route === 'free';
    } catch {
        return false;
    }
}
