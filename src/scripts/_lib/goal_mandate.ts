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
 *   concern), atomic writes.
 * - **Lifetime:** a later goal sentence replaces the record; a revoke sentence
 *   keeps it with `revoked_by` set, and a revoked record renders nothing.
 * - **Failure:** never throws; an unreadable store reads as no record.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { goal_mandate_line, goal_store_file, read_goal, type GoalRecord } from './goal_mandate_store.js';
import { goalSentenceIn, revocationIn } from './goal_phrases.js';


function write_goal(root: string, session_id: string, record: GoalRecord): void {
    const file = goal_store_file(root, session_id);
    if (file === null) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    write_atomic(file, `${JSON.stringify(record, null, 2)}\n`);
}

/**
 * Write a revocation so that no reader can see the earlier goal as current: the
 * atomic write, else an in-place overwrite (a directory that refuses a new file
 * may still allow it), else removing the record.
 */
function write_revocation(root: string, session_id: string, record: GoalRecord): void {
    try {
        write_goal(root, session_id, record);
        return;
    } catch {
        /* fall through */
    }
    const file = goal_store_file(root, session_id);
    if (file === null) return;
    try {
        fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
    } catch {
        fs.rmSync(file, { force: true });
    }
}

/** Record a goal or a revocation from one owner prompt; return the record after it. Never throws. */
export function observe_prompt(root: string, session_id: string, prompt: string, now: Date = new Date()): GoalRecord | null {
    try {
        const current = read_goal(root, session_id);
        // A prompt older than what is stored lost a race with a later one (hooks
        // of one session are not guaranteed to finish in submission order); the
        // later owner turn stands.
        const stored = current === null ? Number.NEGATIVE_INFINITY : Date.parse(current.revoked_at ?? current.recorded_at);
        if (now.getTime() < stored) return current;
        const at = now.toISOString();
        const revoke = revocationIn(prompt);
        if (revoke !== null) {
            if (current?.revoked_by !== undefined) return current;
            // With no goal stored the marker is still written, so a goal write
            // from an earlier prompt that lands after it is dropped above.
            const revoked: GoalRecord = { ...(current ?? { sentence: '', recorded_at: at }), revoked_by: revoke, revoked_at: at };
            write_revocation(root, session_id, revoked);
            return revoked;
        }
        const goal = goalSentenceIn(prompt);
        if (goal === null) return current;
        const record: GoalRecord = { sentence: goal, recorded_at: at };
        write_goal(root, session_id, record);
        return record;
    } catch {
        return null;
    }
}

/** Observe the prompt, then render the live record as a block; null when no goal stands. */
export function goal_mandate_block(root: string, session_id: string, prompt: string, now: Date = new Date()): string | null {
    const line = goal_mandate_line(observe_prompt(root, session_id, prompt, now));
    return line === null ? null : `<session-goal>\n${line}\n</session-goal>`;
}
