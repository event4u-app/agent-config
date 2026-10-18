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
 * set. Bounding growth by deleting whole old session files needs no lock: two
 * processes pruning the same file both succeed, where two rotating one shared
 * file could each rename the other's fresh data away.
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
import { classifyInstructionsLoaded } from '../_lib/instructions_loaded_event.js';
import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

export const KILL_SWITCH_ENV = 'AGENT_CONFIG_INSTRUCTIONS_OBSERVER';
export const KEEP_SESSIONS = 50;

export function arrivalsDir(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), 'runtime', 'arrivals');
}

/** Delete all but the newest {@link KEEP_SESSIONS} session files. */
function prune(dir: string): void {
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
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
        // Bound to `instructions_loaded` alone, so the envelope's event is not re-checked here.
        const envelope = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
        const inner = envelope?.['payload'];
        const line = classifyInstructionsLoaded(typeof inner === 'object' && inner !== null ? inner : envelope, {
            ts: new Date().toISOString(),
            home: env['HOME'] ?? os.homedir(),
            env,
        });
        const dir = arrivalsDir(env);
        const file = path.join(dir, `${line.session ?? '_no-session'}.jsonl`);
        const fresh = !fs.existsSync(file);
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`);
        if (fresh) prune(dir);
    } catch {
        // An unwritable disk, or a file a parallel prune removed, loses one line; it never fails the session.
    }
    return EXIT_ALLOW;
}

export function main(): number {
    return processEnvelope(readHookStdin());
}
