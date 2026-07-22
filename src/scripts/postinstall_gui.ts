/**
 * npm `postinstall` entry — on a GLOBAL (re)install of this package, terminate a
 * running local GUI server (if one is live) and start a fresh one, so the GUI a
 * user has open picks up the just-installed version.
 *
 * Requested behaviour (2026-07-22): on `npm i -g @event4u/agent-config@latest`
 * in an interactive desktop context, restart the GUI — killing any running
 * instance first; and if none was running, still start it. In CI / headless /
 * non-global / opted-out contexts, do nothing.
 *
 * Safety contract (a postinstall must never break `npm install`):
 *   - Every path exits 0. Any error is swallowed. The package.json hook also
 *     appends `|| true` and silences stderr, so a not-yet-built dist during the
 *     repo's own `npm ci` (dist/scripts/postinstall_gui.js absent) is a no-op.
 *   - The GUI is spawned DETACHED + unref'd so npm does not hang on it.
 *   - Gated to GLOBAL installs only (`npm_config_global`), so installing this
 *     package as a transitive dependency never launches a browser.
 *   - TTY is deliberately NOT required: npm does not give lifecycle scripts a
 *     TTY, so requiring one would suppress the GUI on every real terminal
 *     install. The reliable non-interactive signals are CI / headless / opt-out.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { isHeadless } from '../cli/commands/uiServe.js';
import { readServerInfo, clearServerInfo } from '../server/serverInfo.js';

export interface LaunchEnv {
    npm_config_global?: string | undefined;
    CI?: string | undefined;
    AGENT_CONFIG_NO_UI?: string | undefined;
}

/**
 * Pure gate: should the postinstall (re)start the GUI? True only for a global
 * install on a non-CI, non-opted-out, non-headless host. `headless` is passed in
 * (from `isHeadless()`) to keep this unit-testable without env/platform mocking.
 */
export function shouldPostinstallLaunchGui(env: LaunchEnv, headless: boolean): boolean {
    const truthy = (v: string | undefined): boolean => v !== undefined && v.trim() !== '' && v.trim() !== '0';
    if (!truthy(env.npm_config_global)) return false; // only global installs
    if (truthy(env.CI)) return false; // never in CI
    if (truthy(env.AGENT_CONFIG_NO_UI)) return false; // explicit opt-out
    if (headless) return false; // SSH / no-DISPLAY
    return true;
}

/** Terminate a previously-recorded live server instance, if any. Best-effort. */
function terminatePreviousInstance(): void {
    const info = readServerInfo();
    if (!info) return;
    try {
        process.kill(info.pid, 0); // liveness probe — throws if the process is gone
    } catch {
        clearServerInfo(); // stale record — nothing to kill
        return;
    }
    try {
        process.kill(info.pid, 'SIGTERM');
    } catch {
        // already exiting / not ours — leave the record for the new instance to overwrite
        return;
    }
    clearServerInfo();
}

/** Spawn the config GUI detached so npm returns immediately. */
function launchGuiDetached(): void {
    const here = dirname(fileURLToPath(import.meta.url)); // dist/scripts
    const bin = resolve(here, '..', 'cli', 'agent-config.js'); // dist/cli/agent-config.js
    if (!existsSync(bin)) return; // built artefact missing (dev npm ci before build) — no-op
    const child = spawn(process.execPath, [bin, 'config'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });
    child.unref();
}

export function main(env: LaunchEnv = process.env): number {
    try {
        if (!shouldPostinstallLaunchGui(env, isHeadless())) return 0;
        terminatePreviousInstance();
        launchGuiDetached();
    } catch {
        // A postinstall must never fail the install.
    }
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
