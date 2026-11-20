/**
 * feedback_policy — which concern outcomes get their own feedback file.
 *
 * The dispatcher's per-session `summary.json` carries every concern's entry.
 * A per-concern `<concern>.json` used to be written for every concern on every
 * dispatch: about 16 locked atomic writes per tool event, each overwritten by
 * the next dispatch (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
 * Only an outcome worth looking at on its own keeps a file now, so a
 * `<concern>.json` means "this concern's latest NON-QUIET outcome", not its latest
 * outcome — except when the dispatch's summary write failed: then a quiet allow
 * is written too, so the file never shows an older block as the latest outcome
 * that no summary contradicts. Nothing deletes it: a delete would race a newer write from a parallel
 * dispatch in the same session. A write goes through the per-file lock and keeps
 * whichever outcome COMPLETED later ({@link keepNewerOutcome}), so two warnings
 * published in reverse completion order cannot leave the older one standing.
 * The one reader, `hooks_doctor`, ranks that file against the summary's runs by
 * recorded time, so a later quiet run still reads as the latest.
 */
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
 * The locked write's mutator: the incoming entry, unless the file already holds
 * an outcome that completed later (then `null`, a deliberate no-write).
 * Instants, not strings; an unreadable timestamp on either side lets the
 * incoming entry through, as the unconditional write did before. Equal instants
 * (millisecond resolution) also let the incoming entry through: the last write
 * under the lock wins, and no host verdict reads this file.
 */
export function keepNewerOutcome<T extends Readonly<Record<string, unknown>>>(loaded: Partial<Record<string, unknown>>, entry: T): T | null {
    const held = typeof loaded['completed_at'] === 'string' ? Date.parse(loaded['completed_at']) : Number.NaN;
    const incoming = typeof entry['completed_at'] === 'string' ? Date.parse(entry['completed_at'] as string) : Number.NaN;
    if (!Number.isNaN(held) && !Number.isNaN(incoming) && held > incoming) return null;
    return entry;
}
