/**
 * Guards for a harness-enforced bounded loop.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 5, Steps 2-4. Three
 * primitives the stop-event loop needs and did not have, each closing a failure
 * that is invisible while it happens.
 *
 * Extracted rather than added to `run_continuation_hook.ts`: that file is 1,504
 * lines and `check_source_size_budget` charges every line above 1,500, so the
 * same code there would cost a budget it does not cost here. The seam also makes
 * all three testable without a host payload.
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
 * because there the ladder cannot bound it.
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
 * Whole-LINE match against a marker — never a substring.
 *
 * The hazard is specific and cheap to hit: a transcript contains everything the
 * agent said, INCLUDING quoted examples of the marker. A substring match lets a
 * sentence like *"exit when you print RUN-COMPLETE"* terminate the run, and — the
 * worse direction — lets a quoted marker inside a code fence extend one.
 *
 * Trailing whitespace is trimmed because a terminal or a JSON round-trip adds it;
 * leading whitespace is trimmed for the same reason. Nothing ELSE on the line is
 * tolerated: `RUN-COMPLETE (probably)` is not the marker.
 */
export function matchesWholeLine(text: string, marker: string): boolean {
    if (marker === '') return false;
    for (const line of text.split('\n')) {
        if (line.trim() === marker) return true;
    }
    return false;
}

/** A dependency the loop cannot obtain, and therefore cannot iterate toward. */
export interface UnavailableDependency {
    kind: 'credential' | 'binary' | 'permission' | 'quota' | 'service';
    evidence: string;
}

/**
 * Patterns that name a dependency the loop CANNOT close by trying again.
 *
 * Every entry corresponds to a hard-blocker class the rules already name
 * (`context-hygiene` § hard-blocker classes). The list is deliberately short and
 * literal: a general "looks like an error" heuristic would end runs on ordinary
 * test failures, which is the opposite of the intent — those are exactly what a
 * loop SHOULD iterate on.
 */
const DEPENDENCY_PATTERNS: readonly { kind: UnavailableDependency['kind']; re: RegExp }[] = [
    { kind: 'binary', re: /\b(?:command not found|is not recognized as an internal or external command)\b/i },
    { kind: 'credential', re: /\b(?:not (?:authenticated|logged in)|authentication (?:failed|required)|no credentials found)\b/i },
    { kind: 'credential', re: /\b(?:missing|unset|not set)\b[^\n]{0,40}\b(?:credential|token|api[_ -]?key|secret)\b/i },
    { kind: 'permission', re: /\b(?:permission denied|forbidden|403 forbidden)\b/i },
    { kind: 'quota', re: /\b(?:rate limit(?:ed| exceeded| reached)?|quota exceeded|429 too many requests|spend (?:cap|limit) reached)\b/i },
    { kind: 'service', re: /\b(?:5\d\d (?:internal )?server error|service unavailable|connection refused)\b/i },
];

/**
 * How much of the transcript tail a caller should read before scanning it.
 *
 * The detector takes text, not a file, so the BYTE bound belongs to the read
 * and the LINE bound (`tailLines`) belongs to the scan. Both exist and they
 * bound different things: 64 KiB keeps an arbitrarily long transcript from
 * being loaded whole, and the line count then keeps a stale failure from
 * halting a run that already recovered.
 *
 * Exported rather than inlined at the one call site so the bound is visible
 * beside the detector it feeds. A caller that reads the whole file and then
 * passes it here is not wrong, only wasteful — the line bound still applies.
 */
export const DEPENDENCY_SCAN_BYTES = 64 * 1024;

/**
 * Find a dependency the run cannot obtain, from recent transcript text.
 *
 * Returns the FIRST match with the line that produced it, so a halt event can
 * name what is missing instead of saying "blocked". A halt with no named
 * dependency is a report the reader has to reconstruct.
 *
 * Scans the LAST `tailLines` lines only: an authentication failure from an hour
 * ago that was then fixed must not halt the run now, and a transcript is
 * append-only so recency is the whole signal.
 */
export function detectUnavailableDependency(
    transcriptTail: string,
    tailLines = 200,
): UnavailableDependency | null {
    const lines = transcriptTail.split('\n');
    const window = lines.slice(Math.max(0, lines.length - tailLines));
    for (const line of window) {
        for (const { kind, re } of DEPENDENCY_PATTERNS) {
            if (re.test(line)) {
                return { kind, evidence: line.trim().slice(0, 200) };
            }
        }
    }
    return null;
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
 * Pure over the history array, so a reader and the ladder cannot disagree.
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

/**
 * Read the transcript tail and name a dependency the run cannot obtain.
 *
 * Lives here rather than at the call site, beside the detector and the byte
 * bound it uses. EXPORTED so the wiring is testable,
 * which is the half that was actually broken: the inline version referenced a
 * constant that did not exist, and because the read sits inside a `catch`
 * that fail-opens to `null`, the ReferenceError was swallowed on every fire.
 * The rung was dead and every pure `ladder()` test stayed green — a test over
 * the decision function cannot see a caller that never computes the input.
 *
 * Fail-open is deliberate and unchanged: a detector that cannot read must not
 * manufacture a halt. What changed is that "cannot read" is now the only way
 * to reach `null` by accident.
 */
export function readUnavailableDependency(transcriptPath: string): UnavailableDependency | null {
    try {
        const raw = fs.readFileSync(transcriptPath, 'utf8');
        return detectUnavailableDependency(raw.slice(-DEPENDENCY_SCAN_BYTES));
    } catch {
        return null;
    }
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
