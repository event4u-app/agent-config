/**
 * The owner's goal sentence for this session — "bis zum merge", "until merged" —
 * recorded verbatim the moment it is typed and carried into every later prompt
 * and every subagent start.
 *
 * A goal the owner named in turn 3 used to be invisible by turn 30 and absent
 * from every subagent, so the owner typed the same order again for each PR. The
 * record makes the owner's own words visible; it does not decide what they
 * authorise. That stays with `commit-policy` and the Hard Floor as written: the
 * council ruled on 2026-11-21 that reading the record as a standing instruction
 * needs the kernel text first.
 *
 * - **Recognition:** {@link goalSentenceIn} / {@link revocationIn} over the
 *   owner's prose only; no model, so agent text can never populate the record.
 * - **Store:** `goal_mandate_store.ts`; one writer (the `session-register`
 *   concern); goal writes are atomic under the record's generation lock, stops
 *   are files of their own beside it.
 * - **Lifetime:** a later goal sentence replaces the record; a stop suppresses
 *   every goal at or before its stamp, and a revoked record renders nothing.
 * - **Failure:** never throws; an unreadable store reads as no record.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { acquire, release, type Held } from './generation_lock.js';
import { goal_mandate_line, goal_store_file, read_goal, stop_fallback_file, type GoalRecord } from './goal_mandate_store.js';
import { goalSentenceIn, revocationIn } from './goal_phrases.js';

function write_goal(root: string, session_id: string, record: GoalRecord): void {
    const file = goal_store_file(root, session_id);
    if (file === null) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    write_atomic(file, `${JSON.stringify(record, null, 2)}\n`);
    // The stop slot exists from the first goal on, so a later stop can be appended
    // to it even where the store refuses new files. `a` never truncates.
    fs.writeFileSync(`${file}.stop`, '', { flag: 'a' });
}

/**
 * Store a stop as a file of its own beside the record, named by its stamp, so
 * no goal write can overwrite it and concurrent stops keep the latest; lower
 * stops are then pruned. A store that refuses the new file takes the stop in the
 * slot `<record>.stop`, one appended line per stop; no goal write touches either.
 * A store that refuses the slot too appends to the user-level fallback both
 * readers consult. Throws when none can be written.
 */
export function write_stop(file: string, revoke: string, now: Date): void {
    const stamp = String(now.getTime()).padStart(13, '0');
    const prefix = `${path.basename(file)}.stop-`;
    const own = `${prefix}${stamp}`;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(path.join(path.dirname(file), own), revoke);
    } catch {
        // One append per stop, never an overwrite, so a paused older stop cannot
        // erase a newer one; `a` adds no directory entry to an existing slot.
        const line = `${stamp} ${revoke.replace(/\n/g, ' ')}\n`;
        try {
            fs.writeFileSync(`${file}.stop`, line, { flag: 'a' });
        } catch {
            const fallback = stop_fallback_file(file);
            fs.mkdirSync(path.dirname(fallback), { recursive: true });
            fs.writeFileSync(fallback, line, { flag: 'a' });
        }
        return;
    }
    for (const n of fs.readdirSync(path.dirname(file))) {
        if (n.startsWith(prefix) && n < own) fs.rmSync(path.join(path.dirname(file), n), { force: true });
    }
}

/** Record a goal or a revocation from one owner prompt; return the record after it. Never throws. */
export function observe_prompt(root: string, session_id: string, prompt: string, now: Date = new Date()): GoalRecord | null {
    let held: Held | null | false = null;
    try {
        const revoke = revocationIn(prompt);
        const goal = revoke === null ? goalSentenceIn(prompt) : null;
        const file = goal_store_file(root, session_id);
        if ((revoke === null && goal === null) || file === null) return read_goal(root, session_id);
        // A goal write is a read-compare-write and runs under the record's lock, so
        // two goal beats of one session cannot interleave; one that cannot take the
        // lock writes nothing. A stop takes no lock: it is its own file, which a
        // goal write cannot overwrite, and readers suppress every goal at or before
        // the latest stop, so a goal writer that read before a stop and writes
        // after it is suppressed too.
        // The store directory is created on the goal path only; a stop creates it
        // inside `write_stop`, so a failure there still reaches its fallbacks.
        if (revoke === null) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            try {
                held = acquire(`${file}.lock`, { staleMs: 5_000, waitMs: 250 });
            } catch {
                held = null;
            }
        }
        const current = read_goal(root, session_id);
        if (revoke === null && !held) return current;
        // A prompt older than the stored stamp lost a race with a later one (beats
        // of one session are not guaranteed to finish in submission order); the
        // later owner turn stands. On equal stamps a stop wins over a goal.
        const stored = current === null ? Number.NEGATIVE_INFINITY : Date.parse(current.revoked_at ?? current.recorded_at);
        if (now.getTime() < stored) return current;
        if (now.getTime() === stored && revoke === null && current?.revoked_by !== undefined) return current;
        const at = now.toISOString();
        if (revoke !== null) {
            const revoked: GoalRecord = { ...(current ?? { sentence: '', recorded_at: at }), revoked_by: revoke, revoked_at: at };
            try {
                write_stop(file, revoke, now);
            } catch {
                return { ...revoked, unsaved: true };
            }
            return revoked;
        }
        write_goal(root, session_id, { sentence: goal as string, recorded_at: at });
        // Render what a fresh read shows, so a stop saved between the read above
        // and this write wins on this turn too, not only on the next one.
        return read_goal(root, session_id);
    } catch {
        return null;
    } finally {
        if (held) release(held);
    }
}

/** Observe the prompt, then render the live record as a block; null when no goal stands. */
export function goal_mandate_block(root: string, session_id: string, prompt: string, now: Date = new Date()): string | null {
    const record = observe_prompt(root, session_id, prompt, now);
    if (record?.unsaved === true) {
        const said = JSON.stringify(record.revoked_by).replace(/</g, '\\u003c');
        return `<session-goal>\nThe owner's stop ${said} could not be saved anywhere, so later turns and subagents may still show the earlier goal: treat it as revoked for the rest of this session, and tell subagents so.\n</session-goal>`;
    }
    const line = goal_mandate_line(record);
    return line === null ? null : `<session-goal>\n${line}\n</session-goal>`;
}
