/**
 * One-time GUI notice on the first interactive CLI invocation
 * (road-to-feedback-9.8.0-followups § Phase 0, install-time side-effect
 * honesty).
 *
 * The package deliberately has NO install-time side effect (no postinstall,
 * no GUI auto-launch — removal owned by road-to-credible-install Phase 0).
 * The discoverability that a postinstall banner would have provided moves
 * here instead: the FIRST interactive invocation prints one stderr line
 * pointing at the browser GUI and naming the suppress variable, then never
 * again (marker file under the user-global root).
 *
 * Silent by construction for every machine surface: requires a stderr TTY,
 * no `CI`, no `AGENT_CONFIG_NO_UI` — hooks, MCP serving, pipes, and CI runs
 * never see it. Failures (unwritable root, races) degrade to silence; the
 * notice is informational, never load-bearing.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { event4u_root } from '../scripts/_lib/user_global_paths.js';

const MARKER_BASENAME = 'first-run-notice-shown';

export const FIRST_RUN_NOTICE =
    'agent-config has a browser GUI — run `agent-config setup` to open it. ' +
    '(Set AGENT_CONFIG_NO_UI=1 to suppress GUI launches; this notice prints once.)\n';

/** Commands that already ARE the GUI — mark as seen without printing. */
const GUI_COMMANDS: ReadonlySet<string> = new Set([
    'setup', 'install', 'init', 'config', 'settings', 'ui:serve',
]);

export interface FirstRunNoticeIo {
    env?: NodeJS.ProcessEnv;
    isStderrTty?: boolean;
    root?: string;
    write?: (text: string) => void;
}

/**
 * Print the one-time GUI notice when appropriate. Returns true when the
 * notice was printed this call (test seam); marker is written on both the
 * printed and the GUI-command path so the notice fires at most once ever.
 */
export function maybePrintFirstRunNotice(
    head: string | undefined,
    io: FirstRunNoticeIo = {},
): boolean {
    const env = io.env ?? process.env;
    const ci = (env['CI'] ?? '').trim();
    if (ci && ci !== '0') return false;
    const noUi = (env['AGENT_CONFIG_NO_UI'] ?? '').trim();
    if (noUi && noUi !== '0') return false;
    const tty = io.isStderrTty ?? process.stderr.isTTY === true;
    if (!tty) return false;

    let root: string;
    try {
        root = io.root ?? event4u_root(env);
    } catch {
        return false;
    }
    const marker = join(root, MARKER_BASENAME);
    try {
        if (existsSync(marker)) return false;
        mkdirSync(root, { recursive: true });
        writeFileSync(marker, `${new Date().toISOString()}\n`, { flag: 'wx' });
    } catch {
        // Race (another invocation won `wx`) or unwritable root → stay silent.
        return false;
    }

    if (head !== undefined && GUI_COMMANDS.has(head)) {
        // The user is already opening the GUI — notice would be noise.
        return false;
    }
    const write = io.write ?? ((text: string) => process.stderr.write(text));
    write(FIRST_RUN_NOTICE);
    return true;
}
