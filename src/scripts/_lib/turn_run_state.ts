/**
 * The `verify-before-complete` state file's path and its consumer-side reader.
 *
 * The writer is `before_complete_hook.ts`; the turn-end gate and the
 * `update-auto-invite` concern read what it wrote. All three agree on the path
 * and on the shape through this module, so a layout or shape change is a type
 * error in one place rather than a silent disagreement across three.
 *
 * Why it is a module of its own rather than a section of the writer: the writer
 * imports `_lib/touched_file_quality.ts`, which spawns processes. A reader that
 * lived beside it put `node:child_process` into the runtime import graph of
 * every consumer — including `update_invite_hook`, whose ratification rests on
 * it never reaching a child process (finding 791c7f052d01). This module imports
 * only `node:fs`, `node:path` and the state-io helpers.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { has_stable_session_id, owns_session_state, session_state_file } from '../hooks/state_io.js';

export const STATE_DIR = path.join('agents', 'state', 'verify-before-complete');

/** Path of one session's state file. */
export function statePathFor(session_id: string): string {
    return session_state_file(STATE_DIR, session_id);
}

export interface TurnRunState {
  readonly runs: readonly unknown[];
  readonly edits_this_turn: number;
  /** Absent when the recorder that wrote the file predates the field. */
  readonly asset_renders?: readonly unknown[];
}

/**
 * The turn's recorded verification runs, or `null` when the recorder is not live.
 *
 * WHY THE LIVENESS TEST IS `edits_this_turn >= 1` AND NOT "the file exists".
 * The obvious predicate — a state file with a `verification_runs` key — is
 * wrong in a way that would refuse honest work on entire platforms. That key is
 * present in the recorder's EMPTY state, so a host whose `post_tool_use` slot
 * the manifest does not bind still has a file carrying `[]`, written by the
 * prompt and stop events alone. Reading that as "this turn ran nothing" would
 * refuse every editing turn on such a host, whatever the operator actually ran.
 *
 * `edits_this_turn` is the one field only a `post_tool_use` event can raise. The
 * detector reaches here having already found an edit in the transcript, so a
 * recorder that saw none of this turn's tool events is exactly the case this
 * returns `null` for — and `null` means the transcript path answers, which is
 * the behavior that predates the record path.
 *
 * The ownership check is the same one detector D applies to `ci_last`, for the
 * same reason: a FOREIGN file's passing record would vouch for a run this
 * session never made.
 */
export function readTurnRunState(
    workspaceRoot: string,
    session_id: string,
): TurnRunState | null {
    if (!has_stable_session_id(session_id)) return null;
    try {
        const raw = fs.readFileSync(path.join(workspaceRoot, statePathFor(session_id)), 'utf-8');
        const decoded: unknown = JSON.parse(raw);
        if (!owns_session_state(decoded, session_id)) return null;
        if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null;
        const state = decoded as Record<string, unknown>;
        const runs = state['verification_runs'];
        const edits = state['edits_this_turn'];
        if (!Array.isArray(runs)) return null;
        if (typeof edits !== 'number' || !Number.isFinite(edits) || edits < 1) return null;
        const renders = state['asset_renders'];
        return {
            runs: runs as readonly unknown[],
            edits_this_turn: edits,
            // Absent rather than empty when the writer predates the field, so
            // the SVG obligation falls back instead of reading "no render".
            ...(Array.isArray(renders) ? { asset_renders: renders as readonly unknown[] } : {}),
        };
    } catch {
        // Absent, unreadable or malformed — the recorder said nothing, so the
        // transcript answers. Never a refusal of its own.
        return null;
    }
}
