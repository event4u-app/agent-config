#!/usr/bin/env tsx
/**
 * `InstructionsLoaded` observer — capture only.
 *
 * Appends one classified line per host load event to
 * `<machine root>/runtime/arrivals/<session>.jsonl`, the input of that
 * session's arrival record. It emits nothing to the model and returns 0 on
 * every path: an instrument that can fail a turn is a mechanism, and this is not
 * one. Lines carry a file basename, two enums and the host version — never a
 * path or a file's contents — and never leave the machine.
 *
 * ONE FILE PER SESSION, BECAUSE THE HOST RUNS THIS EVENT ASYNCHRONOUSLY. A
 * session start fires one event per loaded file and the hooks run in parallel,
 * so append order is scheduler order and the reader treats each session as a
 * set. Retention is the newest {@link KEEP_SESSIONS} session files, each capped
 * at {@link MAX_SESSION_BYTES}; old files are deleted whole, never rotated.
 *
 * THE BOUNDS, STATED AS WHAT THEY ARE. Every write prunes after it appends, so
 * the file count can exceed fifty only by the number of writers between their
 * append and their own prune — never cumulatively, because each of them prunes.
 * The byte cap is checked before the append, so a file can exceed it by one
 * line (under 1 KiB) per writer racing past the check at once. Neither bound is
 * a lock, and no lock is taken: a hook that can wait on another hook is a hook
 * that can stall a session.
 *
 * WHAT A RACE CAN AND CANNOT DO. Two processes pruning at once both succeed. A
 * prune can delete the file of an idle session older than fifty newer ones; if
 * that session loads a file later, it starts a new file without its start-up
 * loads, which the record reads as `unknown` — evidence is lost in the
 * direction that keeps the machine full, never invented.
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

export function arrivalsDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), 'runtime', 'arrivals');
}

/** Delete all but the newest {@link KEEP_SESSIONS} session files; ties broken by name. */
function prune(dir: string): void {
    const files = fs
        .readdirSync(dir)
        .filter(isSessionFile)
        .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t || (a.f < b.f ? -1 : 1));
    for (const { f } of files.slice(KEEP_SESSIONS)) fs.rmSync(path.join(dir, f), { force: true });
}

export function processEnvelope(raw: string, env: NodeJS.ProcessEnv = process.env): number {
    try {
        if (env[KILL_SWITCH_ENV] === 'off' || is_replay_mode()) return EXIT_ALLOW;
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
        const dir = arrivalsDir(env);
        const file = path.join(dir, `${line.session ?? '_'}.jsonl`);
        let size = -1;
        try {
            size = fs.statSync(file).size;
        } catch {
            // First line of this session.
        }
        if (size >= MAX_SESSION_BYTES) return EXIT_ALLOW;
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`);
        prune(dir);
    } catch {
        // An unwritable disk, or a file a parallel prune removed, loses one line; it never fails the session.
    }
    return EXIT_ALLOW;
}

export function main(): number {
    return processEnvelope(readHookStdin());
}
