/**
 * The read side of the session goal record — store path, reader and the rendered
 * line — kept apart from the recognizer in `goal_mandate.ts` so the
 * subagent-start chunk, which only reads, does not carry the phrase set or the
 * session register.
 *
 * Store: `<git-common-dir>/agent-session-mandates/<session>.json`, shared by every
 * worktree of the repository, one file per session.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { git_common_dir } from './git_common_dir.js';

export interface GoalRecord {
    /** The owner's prose line carrying the goal phrase, verbatim. */
    sentence: string;
    recorded_at: string;
    /** The owner's revoke line, verbatim; absent while the goal stands. */
    revoked_by?: string;
    revoked_at?: string;
    /** Set on the turn a stop could be saved nowhere; never stored. */
    unsaved?: boolean;
}

/**
 * A session id reduced to a file stem that cannot leave the store directory. An
 * id that is not already a lowercase stem gets a digest of the original
 * appended, so two ids that reduce alike (`ses:a`, `ses_a`) or differ only in
 * case on a case-insensitive filesystem never share a record.
 */
function stem(session_id: string): string {
    const s = session_id.toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/\.\./g, '_').slice(0, 128);
    if (s === session_id && /[a-z0-9]/.test(s)) return s;
    return `${s}~${createHash('sha256').update(session_id).digest('hex').slice(0, 16)}`;
}

export function goal_store_file(root: string, session_id: string): string | null {
    if (session_id === '') return null;
    const common = git_common_dir(root);
    return common === null ? null : path.join(common, 'agent-session-mandates', `${stem(session_id)}.json`);
}

/**
 * The latest stop beside a record: stops are files of their own,
 * `<record>.stop-<13-digit epoch ms>` holding the owner's revoke line, so a goal
 * write can never overwrite one and the latest is the highest name.
 */
export function latest_stop(file: string): { at: number; by: string } | null {
    const dir = path.dirname(file);
    const prefix = `${path.basename(file)}.stop-`;
    let best: string | null = null;
    for (const n of fs.readdirSync(dir)) {
        if (n.startsWith(prefix) && /^\d{13}$/.test(n.slice(prefix.length)) && (best === null || n > best)) best = n;
    }
    let found = best === null ? null : { at: Number(best.slice(prefix.length)), by: fs.readFileSync(path.join(dir, best), 'utf-8') };
    // The stop slot `<record>.stop`: created empty with the first goal and written
    // in place by a stop when the store refuses a new file. No goal write touches it.
    let slot = '';
    try {
        slot = fs.readFileSync(`${file}.stop`, 'utf-8');
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const m = /^(\d{13}) ([\s\S]*)$/.exec(slot);
    if (m !== null && (found === null || Number(m[1]) > found.at)) found = { at: Number(m[1]), by: m[2] as string };
    return found;
}

/** The record with the latest stop folded in: a goal at or before it reads as revoked. */
export function read_goal(root: string, session_id: string): GoalRecord | null {
    const file = goal_store_file(root, session_id);
    if (file === null) return null;
    let rec: GoalRecord | null = null;
    try {
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<GoalRecord>;
        if (typeof o.sentence === 'string' && typeof o.recorded_at === 'string') rec = o as GoalRecord;
    } catch {
        /* no record */
    }
    let stop: { at: number; by: string } | null;
    try {
        stop = latest_stop(file);
    } catch {
        // Stop state that cannot be read (a stop pruned between listing and
        // reading, an unreadable entry) suppresses the goal: fail closed.
        return rec === null ? null : { ...rec, revoked_by: '', revoked_at: rec.recorded_at };
    }
    if (stop === null) return rec;
    const at = new Date(stop.at).toISOString();
    if (rec === null) return { sentence: '', recorded_at: at, revoked_by: stop.by, revoked_at: at };
    if (Date.parse(rec.recorded_at) > stop.at || Date.parse(rec.revoked_at ?? '') >= stop.at) return rec;
    return { ...rec, revoked_by: stop.by, revoked_at: at };
}

/** The one line a later prompt or a subagent sees; null when no goal stands. */
export function goal_mandate_line(record: GoalRecord | null): string | null {
    if (record === null || record.revoked_by !== undefined) return null;
    const when = `${record.recorded_at.slice(0, 10)} ${record.recorded_at.slice(11, 16)} UTC`;
    // A JSON string literal with `<` escaped: the sentence can close neither its
    // quote nor the `<session-goal>` block it is shown in.
    const quoted = JSON.stringify(record.sentence).replace(/</g, '\\u003c');
    return (
        `Owner goal, recorded ${when} from the owner's own words: ${quoted}. ` +
        'Work that serves it: commits, PR open/update, follow-up fix PRs, CI waits, cleanup. ' +
        'What each step may do without a fresh go-ahead is still decided by commit-policy as written; ' +
        'Hard-Floor reach: per blocker goal-scope-hard-floor-reach.'
    );
}

/** The parent session's live goal for a subagent start, or null. */
export function goal_mandate_for_subagent(root: string, session_id: string): string | null {
    const line = goal_mandate_line(read_goal(root, session_id));
    return line === null ? null : `<session-goal>\nThe session that started you carries this goal. ${line}\n</session-goal>`;
}
