/**
 * Guards for a harness-enforced bounded loop.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 5, Steps 2-4, written for
 * the stop-event loop of `run_continuation_hook.ts`. That concern was withdrawn
 * on its pre-registered kill date, and on 2026-10-14 the owner decided to remove
 * its termination ladder and the guards only it called — the whole-line marker
 * match and the unavailable-dependency scan. What remains here has callers or a
 * dated exemption of its own in `src/config/loop-surfaces.yaml`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Write JSON atomically: temp file in the same directory, then rename.
 *
 * WHY THIS IS NOT A STYLE CHOICE. The file being written is the loop's
 * ITERATION BUDGET. A direct `writeFileSync` that is interrupted — a crash, a
 * full disk, a killed process — leaves a truncated file, the parser rejects it,
 * and the loop reads "no state": the counter restarts at zero and **the cap
 * stops bounding anything**. The failure mode of a non-atomic budget write is an
 * unbounded loop, which is the exact thing the budget exists to prevent.
 *
 * Same directory for the temp file because `rename` is only atomic within a
 * filesystem; a temp in `/tmp` can land on another one and degrade to copy+unlink.
 *
 * Never throws — a budget writer that throws turns an observability concern into
 * a turn-end failure. Returns whether the write landed, and that return is
 * load-bearing: a loop that could not persist its counter must not BLOCK,
 * because there nothing can bound it.
 */
export function atomicWriteJson(file: string, value: unknown): boolean {
    const tmp = `${file}.${String(process.pid)}.tmp`;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(tmp, `${JSON.stringify(value)}\n`, 'utf8');
        fs.renameSync(tmp, file);
        return true;
    } catch {
        try {
            fs.unlinkSync(tmp);
        } catch {
            /* the temp may never have been created; nothing to clean */
        }
        return false;
    }
}

/**
 * The machine-readable stall signal, derived from a run's open-step history.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 6 Step 6, and it is what
 * makes Phase 4's progress-primary ordering usable rather than aspirational: a
 * consumer asking "is this run still making progress" had to re-derive the
 * answer from a history array and a window constant, so every reader could
 * derive it differently.
 *
 * Three levels rather than a boolean, because the ordering they enable is
 * different:
 *
 *   `progressing` — the newest reading is a NEW MINIMUM. This is the primary
 *     signal Phase 4 names: the budget may keep running.
 *   `flat`        — no new minimum, but the window is not yet full or not yet
 *     uniform. Not stalled; simply not evidence of progress either.
 *   `stalled`     — a full window of IDENTICAL readings. More of the same will
 *     not help, and raising the budget is the WRONG response — which is exactly
 *     what separates `stagnated` from `exhausted` in the terminal-state
 *     vocabulary.
 *
 * Pure over the history array, so two readers cannot disagree.
 */
export type StallLevel = 'progressing' | 'flat' | 'stalled';

export interface StallSignal {
    level: StallLevel;
    /** How many of the most recent readings are identical. */
    flatRun: number;
    /** The lowest reading seen, i.e. the best progress this run has made. */
    minimum: number | null;
    /** True when the LAST reading equals the minimum and is strictly below the one before it. */
    newMinimum: boolean;
}

export function stallSignal(history: readonly number[], window = 3): StallSignal {
    if (history.length === 0) {
        return { level: 'flat', flatRun: 0, minimum: null, newMinimum: false };
    }
    const last = history[history.length - 1] as number;
    const minimum = Math.min(...history);
    // Strictly below every EARLIER reading — not merely below the one before it.
    // The weaker form calls a return to an already-reached minimum progress, so an
    // oscillating run (5, 9, 5, 9, …) would look like it was advancing forever
    // while closing nothing.
    const earlier = history.slice(0, -1);
    const newMinimum = earlier.length > 0 && last < Math.min(...earlier);

    let flatRun = 1;
    for (let i = history.length - 2; i >= 0; i -= 1) {
        if (history[i] !== last) break;
        flatRun += 1;
    }
    if (newMinimum) return { level: 'progressing', flatRun, minimum, newMinimum };
    if (flatRun >= window) return { level: 'stalled', flatRun, minimum, newMinimum };
    return { level: 'flat', flatRun, minimum, newMinimum };
}

// ---------------------------------------------------------------------------
// Rejected-tactic repetition
// ---------------------------------------------------------------------------

/**
 * Window and threshold for the repetition guard.
 *
 * Named constants, NOT a settings block. A configurable strategy preset is the
 * shape this roadmap kills by name: presets multiply the states a reader has to
 * reason about while the underlying question — "is this run going in circles?" —
 * has one answer. Two numbers with a stated meaning are auditable; a tuning
 * surface is not.
 */
export const SUPPRESSION_WINDOW = 8;
export const SUPPRESSION_REPEATS = 3;

/**
 * One attempt the run has already made, reduced to what a detector may see.
 *
 * `tactic_id` is ID-SHAPED and that is the load-bearing property. `stallSignal`
 * above keys on a NUMBER (the open-step count); this keys on an identity. The
 * failure it catches is one the numeric detector cannot see at all: an agent
 * that retries the same rejected approach while the surrounding prose changes
 * every time. The open-step count moves, the wording moves, and the tactic is
 * identical.
 */
export interface TacticAttempt {
    /** Stable id for the approach tried. Lowercase alnum + hyphens; never prose. */
    tactic_id: string;
    /** Whether this attempt was rejected (by a gate, a test, a review, a human). */
    rejected: boolean;
}

export interface RepetitionSignal {
    /** True when a rejected tactic has recurred at or above the threshold in-window. */
    suppress: boolean;
    /** The tactic that tripped it, or `null`. */
    tactic_id: string | null;
    /** How many rejected attempts of that tactic are in the window. */
    repeats: number;
}

/**
 * Has the run repeated a tactic that was already rejected?
 *
 * Counts only REJECTED attempts. A tactic tried three times and accepted twice
 * is not a loop, it is a tactic that works — counting every attempt would fire
 * on productive repetition, which is the false positive that gets a guard
 * switched off.
 *
 * Deliberately blind to any signal string. The verify line this satisfies asks
 * for suppression "even when the signal string differs", which is only
 * achievable by keying on something else — so this function is given no text to
 * read, rather than being trusted to ignore it.
 */
export function rejectedTacticRepeat(
    history: readonly TacticAttempt[],
    window: number = SUPPRESSION_WINDOW,
    threshold: number = SUPPRESSION_REPEATS,
): RepetitionSignal {
    const recent = history.slice(-window);
    const counts = new Map<string, number>();
    for (const a of recent) {
        if (!a.rejected) continue;
        counts.set(a.tactic_id, (counts.get(a.tactic_id) ?? 0) + 1);
    }

    let worst: string | null = null;
    let worstCount = 0;
    for (const [id, n] of counts) {
        if (n > worstCount) {
            worst = id;
            worstCount = n;
        }
    }

    if (worst !== null && worstCount >= threshold) {
        return { suppress: true, tactic_id: worst, repeats: worstCount };
    }
    return { suppress: false, tactic_id: null, repeats: worstCount };
}
