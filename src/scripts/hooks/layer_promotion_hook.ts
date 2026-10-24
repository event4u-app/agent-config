#!/usr/bin/env tsx
/**
 * `layer-promote` — the session half of road-to-a-setup-that-decides-itself
 * step 3.3. On `session_start` it runs {@link sessionLayerStep}: demote a
 * thinned claude rule layer that the latest arrival record contradicts, or
 * promote a full one for the FOLLOWING sessions when the layer-form decision
 * returns `thinned`. Promotion is off until step 5.3 flips the shipped switch.
 *
 * Silent, exit 0 on every path, never blocks a session start. Loaded from its
 * own chunk, never inlined into the dispatch bundle.
 * Kill switch: `AGENT_CONFIG_LAYER_PROMOTE=off`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { sessionLayerStep, type SessionLayerOutcome } from '../../install/layerPromotion.js';
import { EXIT_ALLOW } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';
import { is_replay_mode } from './state_io.js';

export const KILL_SWITCH_ENV = 'AGENT_CONFIG_LAYER_PROMOTE';

export function runLayerPromotion(env: NodeJS.ProcessEnv = process.env, startedAt = performance.now()): SessionLayerOutcome {
    if (env[KILL_SWITCH_ENV] === 'off') return { action: 'none', reason: 'kill-switch' };
    if (is_replay_mode()) return { action: 'none', reason: 'replay' };
    return sessionLayerStep({ env, startedAt });
}

export function main(): number {
    const startedAt = performance.now();
    try {
        readHookStdin();
        runLayerPromotion(process.env, startedAt);
    } catch {
        // A layer step never breaks a session start.
    }
    return EXIT_ALLOW;
}

// The spawn fallback runs this file as a script, so it needs an entry; inside a
// bundle or chunk every module shares one `import.meta.url`, so it must never fire there.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (isCliEntry()) process.exit(main());
