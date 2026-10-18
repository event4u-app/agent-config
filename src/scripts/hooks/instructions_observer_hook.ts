#!/usr/bin/env tsx
/**
 * `InstructionsLoaded` observer — capture only.
 *
 * Appends one classified line per host load event to
 * `<machine root>/runtime/arrivals.jsonl`, the input of the per-session arrival
 * record. It emits nothing to the model and returns 0 on every path: an
 * instrument that can fail a turn is a mechanism, and this is not one.
 *
 * KILL SWITCH. `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off` makes it a no-op without
 * a reinstall; removing the one `instructions_loaded` binding in
 * `hook_manifest.yaml` removes it entirely. Either is the response to hook
 * failures, duplicate events, a session-start regression or an unexplained
 * test break.
 *
 * Machine-level, not per project: the installed rule layer it observes belongs
 * to the machine. The file is rotated once at {@link MAX_BYTES} so it cannot
 * grow without bound.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { event4u_root } from '../_lib/user_global_paths.js';
import { classifyInstructionsLoaded } from '../_lib/instructions_loaded_event.js';
import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

export const ARRIVALS_FILE = path.join('runtime', 'arrivals.jsonl');
export const KILL_SWITCH_ENV = 'AGENT_CONFIG_INSTRUCTIONS_OBSERVER';
export const MAX_BYTES = 512 * 1024;

export function arrivalsPath(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(event4u_root(env), ARRIVALS_FILE);
}

export function processEnvelope(raw: string, env: NodeJS.ProcessEnv = process.env): number {
    try {
        if (env[KILL_SWITCH_ENV] === 'off') return EXIT_ALLOW;
        if (is_replay_mode()) return EXIT_ALLOW;
        let parsed: unknown = null;
        try {
            parsed = raw.trim() ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }
        const envelope = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
        if (envelope !== null && envelope['event'] !== undefined && envelope['event'] !== 'instructions_loaded') {
            return EXIT_ALLOW;
        }
        const inner = envelope?.['payload'];
        const payload = typeof inner === 'object' && inner !== null ? inner : envelope;
        const line = classifyInstructionsLoaded(payload, {
            ts: new Date().toISOString(),
            home: env['HOME'] ?? os.homedir(),
            env,
        });
        const file = arrivalsPath(env);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        try {
            if (fs.statSync(file).size >= MAX_BYTES) fs.renameSync(file, `${file}.1`);
        } catch {
            // No file yet.
        }
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`);
    } catch {
        // An unwritable disk loses one line; it never fails the session.
    }
    return EXIT_ALLOW;
}

export function main(): number {
    return processEnvelope(readHookStdin());
}
