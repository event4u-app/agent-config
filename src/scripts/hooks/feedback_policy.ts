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

/**
 * Runs one diagnostic write so that nothing it throws reaches the caller. The
 * dispatcher calls every feedback write after the verdict is computed; an
 * exception escaping one would stop that verdict reaching the host. A failure
 * is reported on stderr (itself guarded) and the write is skipped.
 */
export function containFeedback(label: string, write: () => void): void {
    try {
        write();
    } catch (exc) {
        try {
            const msg = exc instanceof Error ? exc.message : String(exc);
            process.stderr.write(`dispatch_hook: ${label} failed: ${msg}\n`);
        } catch {
            // stderr itself is gone; the verdict still matters more than the report
        }
    }
}

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
 * (millisecond resolution) are ordered by {@link compareRuns}, the same order
 * `hooks_doctor` reads with; a full tie lets the incoming entry through.
 */
export function keepNewerOutcome<T extends Readonly<Record<string, unknown>>>(loaded: Partial<Record<string, unknown>>, entry: T): T | null {
    const held = typeof loaded['completed_at'] === 'string' ? Date.parse(loaded['completed_at']) : Number.NaN;
    const incoming = typeof entry['completed_at'] === 'string' ? Date.parse(entry['completed_at'] as string) : Number.NaN;
    if (Number.isNaN(held) || Number.isNaN(incoming)) return entry;
    return compareRuns(held, loaded['invocation'], incoming, entry['invocation']) > 0 ? null : entry;
}

/**
 * The one order every reader and writer of these records uses, so they never
 * disagree on which run is the latest: by completion instant, then — at an
 * equal instant, where no real order exists — by `invocation` id as a string,
 * an id beating none. Positive when run A is later. Equal instants with equal
 * (or both absent) ids compare 0. Used by {@link keepNewerOutcome},
 * {@link withLatestRuns} and `hooks_doctor`.
 */
export function compareRuns(atA: number, invocationA: unknown, atB: number, invocationB: unknown): number {
    if (atA !== atB) return atA > atB ? 1 : -1;
    const a = typeof invocationA === 'string' ? invocationA : null;
    const b = typeof invocationB === 'string' ? invocationB : null;
    if (a === b) return 0;
    if (a === null) return -1;
    if (b === null) return 1;
    return a > b ? 1 : -1;
}

// A type alias, not an interface: it must stay assignable to JSON and record shapes.
export type LatestRun = {
    readonly invocation: string;
    readonly completed_at: string | null;
    /** The run's outcome, so the row still answers "what happened last" after the history rotated it out. */
    readonly exit_code: number | null;
    readonly decision: string | null;
};

/**
 * The summary's `latest` map (one row per concern, outside the capped history:
 * id, completion time and outcome) with this dispatch's runs folded in. Each row keeps whichever run COMPLETED
 * later, by the concern's own `completed_at` and {@link keepNewerOutcome}'s rule,
 * so a dispatch that publishes after a newer one cannot overwrite its row.
 */
export function withLatestRuns(
    held: unknown,
    entries: readonly Readonly<Record<string, unknown>>[],
    invocation: string,
): Record<string, LatestRun> {
    // No prototype: a concern named `__proto__` is an ordinary key here.
    const out = Object.create(null) as Record<string, LatestRun>;
    if (held !== null && typeof held === 'object' && !Array.isArray(held)) {
        for (const [k, v] of Object.entries(held as Record<string, unknown>)) {
            if (isLatestRun(v)) {
                const r = v as { exit_code?: unknown; decision?: unknown };
                out[k] = {
                    invocation: v.invocation,
                    completed_at: v.completed_at,
                    exit_code: typeof r.exit_code === 'number' ? r.exit_code : null,
                    decision: typeof r.decision === 'string' ? r.decision : null,
                };
            }
        }
    }
    for (const e of entries) {
        const name = String(e['concern']);
        const run: LatestRun = {
            invocation,
            completed_at: typeof e['completed_at'] === 'string' ? e['completed_at'] : null,
            exit_code: typeof e['exit_code'] === 'number' ? e['exit_code'] : null,
            decision: typeof e['decision'] === 'string' ? e['decision'] : null,
        };
        const prior = out[name];
        out[name] = prior === undefined ? run : (keepNewerOutcome(prior, run) ?? prior);
    }
    return out;
}

/**
 * A `latest` row that honours the contract: a string id and a readable
 * completion instant. The writer keeps only such rows, and `hooks_doctor` reads
 * only such rows, so the two never disagree on which row counts.
 */
export function isLatestRun(v: unknown): v is LatestRun & { completed_at: string } {
    if (v === null || typeof v !== 'object') return false;
    const r = v as { invocation?: unknown; completed_at?: unknown };
    return typeof r.invocation === 'string' && typeof r.completed_at === 'string' && !Number.isNaN(Date.parse(r.completed_at));
}
