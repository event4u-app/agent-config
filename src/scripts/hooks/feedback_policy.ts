/**
 * feedback_policy — which concern outcomes get their own feedback file.
 *
 * The dispatcher's per-session `summary.json` carries every concern's entry.
 * A per-concern `<concern>.json` used to be written for every concern on every
 * dispatch: about 16 locked atomic writes per tool event, each overwritten by
 * the next dispatch (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
 * Only an outcome worth looking at on its own keeps a file now; `hooks_doctor`
 * falls back to the summary for the rest.
 */
import * as fs from 'node:fs';

import { EXIT_ALLOW } from './exit_codes.js';

/** An entry that allowed, was not resolved from a crash, and gave no reason. */
export function isQuietAllow(entry: Readonly<Record<string, unknown>>): boolean {
    return (
        entry['exit_code'] === EXIT_ALLOW &&
        entry['raw_exit_code'] === EXIT_ALLOW &&
        entry['decision'] === 'allow' &&
        (entry['reason'] ?? null) === null
    );
}

/**
 * After a quiet allow, remove the concern's per-concern file if an earlier
 * non-quiet run left one: the file means "this concern's latest outcome", and a
 * warning the concern no longer gives must not stand as that. One `unlink` that
 * usually finds nothing (ENOENT), never a locked write.
 */
export function dropStaleFeedback(file: string): void {
    try {
        fs.rmSync(file, { force: true });
    } catch {
        /* a file we cannot remove is reported by nothing: the summary stays the record */
    }
}
