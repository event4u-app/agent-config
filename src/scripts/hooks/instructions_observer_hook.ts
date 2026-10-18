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
 * Lines without a session id go to `_.jsonl`, which is capped the same way, is
 * outside the session count, and never forms a record.
 *
 * ONE DESCRIPTOR, NO PATH CHECK. The file is opened once with `O_NOFOLLOW`, the
 * opened descriptor is checked to be a regular file under the cap, and the line
 * is written through it — so no symlink swapped in between a check and a write
 * can redirect the line.
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
 * A FAILURE LEAVES A MARK. Whatever stops a write — permissions, a full disk,
 * a symlink refused — is recorded as its error code in `arrivals.last-error`
 * beside the directory, so an observer that has gone quiet can be told apart
 * from one that saw nothing.
 *
 * KILL SWITCH. `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off` makes it a no-op without
 * a reinstall; removing the one `instructions_loaded` binding in
 * `hook_manifest.yaml` and reinstalling removes it entirely. Either is the
 * response to hook failures, duplicate events, a session-start regression or an
 * unexplained test break.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
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
const APPEND_NOFOLLOW = C.O_WRONLY | C.O_APPEND | C.O_CREAT | NOFOLLOW;
const TRUNC_NOFOLLOW = C.O_WRONLY | C.O_TRUNC | C.O_CREAT | NOFOLLOW;

export function arrivalsDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), 'runtime', 'arrivals');
}

/** Delete all but the newest {@link KEEP_SESSIONS} regular session files; ties broken by name. */
function prune(dir: string): void {
    const files: { f: string; t: number }[] = [];
    for (const f of fs.readdirSync(dir)) {
        if (f === '_.jsonl' || !isSessionFile(f)) continue;
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
    if (env[KILL_SWITCH_ENV] === 'off' || is_replay_mode()) return EXIT_ALLOW;
    const dir = arrivalsDir(env);
    try {
        let parsed: unknown = null;
        try {
            parsed = raw.trim() ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }
        const envelope = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
        const inner = envelope?.['payload'];
        const payload = typeof inner === 'object' && inner !== null ? inner : envelope;
        const line = captureInstructionsLoaded(payload, new Date().toISOString(), env['HOME'] ?? os.homedir(), env);
        fs.mkdirSync(dir, { recursive: true });
        const fd = fs.openSync(path.join(dir, `${line.session ?? '_'}.jsonl`), APPEND_NOFOLLOW, 0o600);
        try {
            const st = fs.fstatSync(fd);
            if (st.isFile() && st.size < MAX_SESSION_BYTES) fs.writeSync(fd, `${JSON.stringify(line)}\n`);
        } finally {
            fs.closeSync(fd);
        }
        prune(dir);
    } catch (e) {
        try {
            const code = String((e as NodeJS.ErrnoException).code ?? 'error');
            fs.writeFileSync(`${dir}.last-error`, `${new Date().toISOString()} ${code}\n`, { flag: TRUNC_NOFOLLOW });
        } catch {
            // Nowhere to record it either; the session is still never failed.
        }
    }
    return EXIT_ALLOW;
}

export function main(): number {
    return processEnvelope(readHookStdin());
}
