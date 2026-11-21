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
 * - **Store:** `<git-common-dir>/agent-session-mandates/<session>.json`, one file
 *   per session and one writer (the `session-register` concern), atomic writes.
 * - **Lifetime:** a later goal sentence replaces the record; a revoke sentence
 *   keeps it with `revoked_by` set, and a revoked record renders nothing.
 * - **Failure:** never throws; an unreadable store reads as no record.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { git_common_dir } from './git_common_dir.js';
import { goalSentenceIn, revocationIn } from './goal_phrases.js';
import { safe_stem } from './session_register.js';

const STORE_DIRNAME = 'agent-session-mandates';

export interface GoalRecord {
    /** The owner's prose line carrying the goal phrase, verbatim. */
    sentence: string;
    recorded_at: string;
    /** The owner's revoke line, verbatim; absent while the goal stands. */
    revoked_by?: string;
    revoked_at?: string;
}

function store_file(root: string, session_id: string): string | null {
    if (session_id === '') return null;
    const common = git_common_dir(root);
    return common === null ? null : path.join(common, STORE_DIRNAME, `${safe_stem(session_id)}.json`);
}

export function read_goal(root: string, session_id: string): GoalRecord | null {
    try {
        const file = store_file(root, session_id);
        if (file === null) return null;
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<GoalRecord>;
        if (typeof o.sentence !== 'string' || typeof o.recorded_at !== 'string') return null;
        return o as GoalRecord;
    } catch {
        return null;
    }
}

function write_goal(root: string, session_id: string, record: GoalRecord): void {
    const file = store_file(root, session_id);
    if (file === null) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    write_atomic(file, `${JSON.stringify(record, null, 2)}\n`);
}

/** Record a goal or a revocation from one owner prompt; return the record after it. Never throws. */
export function observe_prompt(root: string, session_id: string, prompt: string, now: Date = new Date()): GoalRecord | null {
    try {
        const current = read_goal(root, session_id);
        const revoke = revocationIn(prompt);
        if (revoke !== null) {
            if (current === null || current.revoked_by !== undefined) return current;
            const revoked: GoalRecord = { ...current, revoked_by: revoke, revoked_at: now.toISOString() };
            write_goal(root, session_id, revoked);
            return revoked;
        }
        const goal = goalSentenceIn(prompt);
        if (goal === null) return current;
        const record: GoalRecord = { sentence: goal, recorded_at: now.toISOString() };
        write_goal(root, session_id, record);
        return record;
    } catch {
        return null;
    }
}

/** The one line a later prompt or a subagent sees; null when no goal stands. */
export function goal_mandate_line(record: GoalRecord | null): string | null {
    if (record === null || record.revoked_by !== undefined) return null;
    const when = `${record.recorded_at.slice(0, 10)} ${record.recorded_at.slice(11, 16)} UTC`;
    return (
        `Owner goal for this session, recorded ${when} from the owner's own words: "${record.sentence}". ` +
        'Work that serves it: commits, PR open/update, follow-up fix PRs, CI waits, cleanup. ' +
        'What each step may do without a fresh go-ahead is still decided by commit-policy as written; ' +
        'Hard-Floor reach: per blocker goal-scope-hard-floor-reach (pushes and merges keep their own confirmation).'
    );
}

/** Observe the prompt, then render the live record as a block; null when no goal stands. */
export function goal_mandate_block(root: string, session_id: string, prompt: string, now: Date = new Date()): string | null {
    const line = goal_mandate_line(observe_prompt(root, session_id, prompt, now));
    return line === null ? null : `<session-goal>\n${line}\n</session-goal>`;
}

/** The parent session's live goal line for a subagent start, or null. */
export function goal_mandate_for_subagent(root: string, session_id: string): string | null {
    const line = goal_mandate_line(read_goal(root, session_id));
    return line === null ? null : `<session-goal>\nThe session that started you carries this goal. ${line}\n</session-goal>`;
}
