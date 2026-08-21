#!/usr/bin/env tsx
/**
 * Session-end Class-A flush (road-to-org-telemetry Phase 2, step 2.1).
 *
 * WHAT THIS CONCERN DOES, IN ONE SENTENCE: it checks whether the outbound
 * spool has bytes and, if so, spawns a detached sender and returns. It makes
 * no network call of its own, in this process, ever.
 *
 * THAT SHAPE IS MEASURED, NOT PREFERRED. Phase 0's second spike
 * pre-registered "added latency at or below one second at p95" for an INLINE
 * session-end flush and measured it failing: 0.4 ms against a healthy sink,
 * 0.3 ms against a refused connection, and **1002 ms against a blackhole** —
 * a socket that accepts and never answers, which is the shape a wedged sink
 * actually takes. Against the same blackhole the detached spool measured
 * 20.5 ms p95, dominated by process spawn. The step's own text defers to that
 * result, so this concern is the spool half of it.
 *
 * DEFAULT-OFF, AND `enabled` IS NOT THE SWITCH. `read_remote_settings`
 * resolves `active` only when `enabled` is true AND the org pack supplied an
 * endpoint, an org id and a salt — none of which has a default and none of
 * which this public repository ships a value for. A clone therefore cannot
 * reach the spawn path. `flush: never` (the value an org sets to keep records
 * local) short-circuits before the spool is even stat-ed.
 *
 * ZERO FILE OPERATIONS WHEN INACTIVE, and the spool `stat` is the only one
 * when active-but-idle: most sessions invoke no skill, so there is no spool
 * to drain and the concern costs one `stat` and returns.
 *
 * EXIT CODE IS ALWAYS 0 and stdout is always empty. A hook `warn` (exit 2) is
 * read as a hard BLOCK on the verified host, and a telemetry concern has
 * nothing to say to the model — least of all at session end, where a message
 * would arrive after the last thing the user reads.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    DEFAULT_FLUSH_TIMEOUT_MS,
    FLUSH_SESSION_END,
    spawn_detached_sender,
    spool_has_work,
    spool_path_for,
} from '../../agent-src/templates/scripts/telemetry/transport.js';
import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { _resolveRoot, readSettingsFor } from './telemetry_usage_hook.js';

const EXIT_ALLOW = 0;

/**
 * Where `flush_sender.mjs` lives, relative to this module.
 *
 * Resolved from `import.meta.url` and then existence-checked, rather than
 * assumed: under an esbuild bundle every module shares the bundle's own URL,
 * so this path can be wrong. A wrong path must degrade to "no flush this
 * session" (the records stay spooled and go out next time) and never to a
 * spawn of something that is not the sender.
 */
export const SENDER_REL = '../../agent-src/templates/scripts/telemetry/flush_sender.mjs';

export function resolveSenderScript(): string | null {
    try {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const candidate = path.resolve(here, SENDER_REL);
        return fs.statSync(candidate).isFile() ? candidate : null;
    } catch {
        return null;
    }
}

export interface FlushOutcome {
    /** `spawned` is the only outcome that starts a process. */
    readonly result: 'inactive' | 'flush-never' | 'empty-spool' | 'no-sender' | 'replay' | 'spawned';
}

export function flushFor(consumer_root: string, sender: string | null = resolveSenderScript()): FlushOutcome {
    try {
        const { settings, root } = readSettingsFor(consumer_root);
        if (!settings.active) return { result: 'inactive' };
        if (settings.flush !== FLUSH_SESSION_END) return { result: 'flush-never' };
        if (is_replay_mode()) return { result: 'replay' };

        // Relative to the PROJECT root, matching the appender exactly — a
        // flush that resolved the log against the session cwd would drain a
        // spool nobody writes.
        const logPath = path.isAbsolute(settings.log_path)
            ? settings.log_path
            : path.join(root, settings.log_path);
        const spool = spool_path_for(logPath);
        if (!spool_has_work(spool)) return { result: 'empty-spool' };
        if (sender === null) return { result: 'no-sender' };

        const ok = spawn_detached_sender({
            sender_script: sender,
            spool_path: spool,
            endpoint: settings.endpoint,
            timeout_ms: DEFAULT_FLUSH_TIMEOUT_MS,
        });
        return { result: ok ? 'spawned' : 'no-sender' };
    } catch {
        return { result: 'inactive' };
    }
}

export function run(stdin_text: string, options: { consumer_root: string }): number {
    flushFor(options.consumer_root);
    return EXIT_ALLOW;
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: unknown = {};
    try {
        envelope = raw.trim() ? JSON.parse(raw) : {};
    } catch {
        envelope = {};
    }
    flushFor(_resolveRoot(envelope as never));
    return EXIT_ALLOW;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());
