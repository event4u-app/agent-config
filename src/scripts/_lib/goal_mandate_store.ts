/**
 * The read side of the session goal record — store path, reader and the rendered
 * line — kept apart from the recognizer in `goal_mandate.ts` so the
 * subagent-start chunk, which only reads, does not carry the phrase set or the
 * session register.
 *
 * Store: `<git-common-dir>/agent-session-mandates/<session>.json`, shared by every
 * worktree of the repository, one file per session.
 */

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
}

/** A session id reduced to a file stem that cannot leave the store directory. */
function stem(session_id: string): string {
    const s = session_id.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.\./g, '_').slice(0, 128);
    return /[A-Za-z0-9]/.test(s) ? s : 'unknown-session';
}

export function goal_store_file(root: string, session_id: string): string | null {
    if (session_id === '') return null;
    const common = git_common_dir(root);
    return common === null ? null : path.join(common, 'agent-session-mandates', `${stem(session_id)}.json`);
}

export function read_goal(root: string, session_id: string): GoalRecord | null {
    try {
        const file = goal_store_file(root, session_id);
        if (file === null) return null;
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<GoalRecord>;
        if (typeof o.sentence !== 'string' || typeof o.recorded_at !== 'string') return null;
        return o as GoalRecord;
    } catch {
        return null;
    }
}

/** The one line a later prompt or a subagent sees; null when no goal stands. */
export function goal_mandate_line(record: GoalRecord | null): string | null {
    if (record === null || record.revoked_by !== undefined) return null;
    const when = `${record.recorded_at.slice(0, 10)} ${record.recorded_at.slice(11, 16)} UTC`;
    return (
        `Owner goal, recorded ${when} from the owner's own words: "${record.sentence}". ` +
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
