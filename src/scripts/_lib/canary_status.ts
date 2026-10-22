/**
 * The cross-model canary's status line: present only while three or more
 * scheduled runs in a row are red. The reader is kept apart from
 * `canary_liveness.ts`, which shells out to `gh`, because the session-start
 * concern that surfaces the line sits in the hook bundle.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const CANARY_RED_STREAK = 3;

/** Gitignored runtime state; written by `canary_liveness.ts`. */
export const CANARY_LIVENESS_RELPATH = path.join('agents', 'runtime', 'state', 'canary-liveness.json');

/** The line, or null when the canary is not on a red streak or nothing was recorded. */
export function readCanaryStatusLine(repoRoot: string): string | null {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, CANARY_LIVENESS_RELPATH), 'utf8')) as { line?: unknown };
        return typeof raw.line === 'string' && raw.line !== '' ? raw.line : null;
    } catch {
        return null;
    }
}
