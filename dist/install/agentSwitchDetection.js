/**
 * agent-switch detection — passive wizard recommendation (S0.1 honest-null
 * council verdict, 2026-07-28: PASSIVE ROW ONLY, never a proactive card).
 *
 * agent-switch (https://github.com/event4u-app/agent-switch,
 * `@event4u/agent-switch` on npm) isolates multiple agent accounts into
 * per-account profiles (`CLAUDE_CONFIG_DIR`) so switching accounts never
 * requires a re-login. Unlike rtk, the install command is npm-global and
 * identical on every OS — no per-OS command map, no name collision to
 * disambiguate.
 *
 * Two independent installed-signals, either is sufficient:
 *   - the `agent-switch` binary is resolvable on PATH (the documented
 *     npm-global install), OR
 *   - `~/.agent-switch/` exists — a user who installed it another way must
 *     never be told to install it again.
 *
 * Version is only probed when the binary is on PATH (the directory-only
 * signal carries no version information — reported as `null`). There is
 * deliberately NO version-currency check and NO network call here — the
 * wizard only ever answers "installed or not", never "up to date" (roadmap
 * acceptance criterion: this module does not report on agent-switch's
 * version currency).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveBinaryOnPath } from './rtkDetection.js';
export const AGENT_SWITCH_REPO = 'event4u-app/agent-switch';
export const AGENT_SWITCH_NPM = '@event4u/agent-switch';
export const AGENT_SWITCH_INSTALL_COMMAND = 'npm install -g @event4u/agent-switch';
const PROBE_TIMEOUT_MS = 2000;
/** First dotted-number token in `output`, or `null` when none is present. */
export function parseVersionOutput(output) {
    const m = /(\d+\.\d+(?:\.\d+)?)/.exec(output);
    return m?.[1] ?? null;
}
function defaultProbeVersion(bin) {
    try {
        const res = spawnSync(bin, ['--version'], {
            timeout: PROBE_TIMEOUT_MS,
            encoding: 'utf-8',
            windowsHide: true,
        });
        if (res.error !== undefined || res.signal !== null)
            return null;
        return parseVersionOutput(`${res.stdout ?? ''}\n${res.stderr ?? ''}`);
    }
    catch {
        return null;
    }
}
/**
 * Detect agent-switch installation. Never throws — every failure mode
 * (spawn error, timeout, unparsable output) collapses to `version: null`.
 */
export function detectAgentSwitch(options = {}) {
    const binPath = resolveBinaryOnPath('agent-switch', options.pathEnv);
    if (binPath !== null) {
        const probe = options.probeVersion ?? defaultProbeVersion;
        let version;
        try {
            version = probe(binPath);
        }
        catch {
            version = null;
        }
        return { installed: true, version };
    }
    const home = options.home ?? homedir();
    const dirInstalled = existsSync(join(home, '.agent-switch'));
    return { installed: dirInstalled, version: null };
}
//# sourceMappingURL=agentSwitchDetection.js.map