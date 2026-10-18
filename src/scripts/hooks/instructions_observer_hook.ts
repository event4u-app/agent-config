#!/usr/bin/env tsx
/**
 * `InstructionsLoaded` observer — capture only.
 *
 * Appends one classified line per host load event to
 * `<machine root>/runtime/arrivals/<session>.jsonl`, the input of that
 * session's arrival record. It emits nothing to the model and returns 0 on
 * every path: an instrument that can fail a turn is a mechanism, and this is not
 * one. Lines carry a file basename, two enums and the host version — never a
 * path or a file's contents — and never leave the machine. The directory is
 * this observer's alone; nothing else in the package writes there.
 *
 * ONE FILE PER SESSION, BECAUSE THE HOST RUNS THIS EVENT ASYNCHRONOUSLY. A
 * session start fires one event per loaded file and the hooks run in parallel,
 * so append order is scheduler order and the reader treats each session as a
 * set. Retention is the newest {@link KEEP_SESSIONS} session files, each capped
 * at {@link MAX_SESSION_BYTES}; old files are deleted whole, never rotated.
 * A line without a session id could never form a record, so it is not written.
 *
 * ONE DESCRIPTOR, NO PATH CHECK. The file is opened once with `O_NOFOLLOW` and
 * `O_NONBLOCK`; the descriptor must be a regular file readable by its owner
 * alone, and the line is written through it whole or the write is a failure —
 * so no symlink swapped in between a check and a write can redirect the line,
 * no FIFO planted at the path can stall the open, and no torn line passes
 * silently.
 *
 * THE BOUNDS, STATED AS WHAT THEY ARE. Every write prunes after it appends, so
 * the file count can exceed fifty by the writers between their append and their
 * own prune, and by any writer killed in that gap — until the next write, which
 * prunes again. The byte cap is checked on the descriptor before the write, so a
 * file can exceed it by one line (under 2 KiB, every field being a token of at
 * most 128 characters) per writer racing past the check at once. Neither bound
 * is a lock, and no lock is taken: a hook that can wait on another hook is a
 * hook that can stall a session.
 *
 * WHAT A RACE CAN AND CANNOT DO. Two processes pruning at once both succeed. A
 * prune can delete the file of an idle session older than fifty newer ones; if
 * that session loads a file later, it starts a new file without its start-up
 * loads, which the record reads as `unknown` — evidence is lost in the
 * direction that keeps the machine full, never invented.
 *
 * A FAILURE LEAVES A DATED MARK, WHERE IT CAN. A write stopped by permissions,
 * a full disk, a refused symlink or file, or a short write records its date and
 * error code in `arrivals.last-error` beside the directory. It is the LAST
 * failure, not a current state: a date older than the newest session file means
 * the observer has written since. A failure that also prevents writing the mark
 * — the machine root itself unwritable — leaves none.
 *
 * NOT YET BOUND. No manifest row runs this concern, and it is not in the
 * dispatcher's concern registry, so it adds nothing to the hook bundle until
 * its binding lands; the binding needs bundle headroom it does not have today.
 *
 * KILL SWITCH. `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off` makes it a no-op without
 * a reinstall; removing the one `instructions_loaded` binding in
 * `hook_manifest.yaml` and reinstalling removes it entirely. Either is the
 * response to hook failures, duplicate events, a session-start regression or an
 * unexplained test break.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { event4u_root } from '../_lib/user_global_paths.js';
import { captureInstructionsLoaded, isSessionFile } from '../_lib/instructions_loaded_event.js';
import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

export const KILL_SWITCH_ENV = 'AGENT_CONFIG_INSTRUCTIONS_OBSERVER';
export const KEEP_SESSIONS = 50;
/** A session file stops growing here (see the header for the overshoot under racing writers). */
export const MAX_SESSION_BYTES = 256 * 1024;

const C = fs.constants;
/** `O_NOFOLLOW` is POSIX; where the platform has none the flag is simply absent. */
const NOFOLLOW = C.O_NOFOLLOW ?? 0;
/** `O_NONBLOCK` so a FIFO planted at the path cannot stall the open waiting for a reader. */
const APPEND_NOFOLLOW = C.O_WRONLY | C.O_APPEND | C.O_CREAT | C.O_NONBLOCK | NOFOLLOW;
const TRUNC_NOFOLLOW = C.O_WRONLY | C.O_TRUNC | C.O_CREAT | NOFOLLOW;

export function arrivalsDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), 'runtime', 'arrivals');
}

/** Delete all but the newest {@link KEEP_SESSIONS} regular session files; ties broken by name. */
function prune(dir: string): void {
    const files: { f: string; t: number }[] = [];
    for (const f of fs.readdirSync(dir)) {
        if (!isSessionFile(f)) continue;
        try {
            const st = fs.lstatSync(path.join(dir, f));
            if (st.isFile()) files.push({ f, t: st.mtimeMs });
        } catch {
            // Removed by a parallel prune since the listing.
        }
    }
    files.sort((a, b) => b.t - a.t || (a.f < b.f ? -1 : 1));
    for (const { f } of files.slice(KEEP_SESSIONS)) fs.rmSync(path.join(dir, f), { force: true });
}

export function processEnvelope(raw: string, env: NodeJS.ProcessEnv = process.env): number {
    let dir = '';
    try {
        if (env[KILL_SWITCH_ENV] === 'off' || is_replay_mode()) return EXIT_ALLOW;
        dir = arrivalsDir(env);
        let parsed: unknown = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // An unreadable envelope carries no session to file a line under.
        }
        const envelope = (parsed ?? {}) as Record<string, unknown>;
        const inner = envelope['payload'];
        // Without HOME no load reads as user-layer, which can only keep the machine full.
        const cap = captureInstructionsLoaded(typeof inner === 'object' && inner !== null ? inner : envelope, new Date().toISOString(), env['HOME'] ?? '', env);
        // A line with no session id can never form a record, so it is not written.
        if (cap.session === null) return EXIT_ALLOW;
        // Every captured field is an ASCII id or boolean, so the line's length is its byte count.
        const text = `${JSON.stringify(cap)}\n`;
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        const fd = fs.openSync(path.join(dir, `${cap.session}.jsonl`), APPEND_NOFOLLOW, 0o600);
        try {
            const st = fs.fstatSync(fd);
            // Only a regular file nobody else can read is written to.
            if (!st.isFile() || (st.mode & 0o077) !== 0) throw new Error('EREFUSED');
            if (st.size < MAX_SESSION_BYTES && fs.writeSync(fd, text) !== text.length) throw new Error('ESHORT');
        } finally {
            fs.closeSync(fd);
        }
        prune(dir);
    } catch (e) {
        try {
            const code = String((e as NodeJS.ErrnoException).code ?? (e as Error).message);
            if (dir) fs.writeFileSync(`${dir}.last-error`, `${new Date().toISOString()} ${code}\n`, { flag: TRUNC_NOFOLLOW });
        } catch {
            // Nowhere to record it either; the session is still never failed.
        }
    }
    return EXIT_ALLOW;
}

export function main(): number {
    try {
        return processEnvelope(readHookStdin());
    } catch {
        return EXIT_ALLOW;
    }
}
