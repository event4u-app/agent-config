/**
 * Claude Code plugin detection helpers — shared by `cmd_upgrade`,
 * `cmd_doctor`, and the installer.
 *
 * Claude Code loads the FULL top-level command set (`/implement-ticket`,
 * `/work`, `/review-changes`, …) from the installed plugin
 * (`agent-config@event4u-agent-config`), NOT from the `~/.claude/commands/`
 * file projection. A file-only install therefore silently misses top-level
 * commands while namespaced subcommands (`/fix:pr-comments`, …) keep working
 * — and an installed plugin stays pinned to its install-time git SHA until
 * `claude plugin update` runs. These helpers detect both states so
 * upgrade / doctor / install can refresh the plugin or surface the gap.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';

export const CLAUDE_PLUGIN_ID = 'agent-config';
export const CLAUDE_MARKETPLACE_NAME = 'event4u-agent-config';
export const CLAUDE_MARKETPLACE_REPO = 'event4u-app/agent-config';

/** The one-time install commands surfaced when the plugin is missing. */
export const CLAUDE_PLUGIN_INSTALL_HINT: readonly string[] = [
    `claude plugin marketplace add ${CLAUDE_MARKETPLACE_REPO}`,
    `claude plugin install ${CLAUDE_PLUGIN_ID}@${CLAUDE_MARKETPLACE_NAME}`,
];

/** Claude Code config dir — `CLAUDE_CONFIG_DIR` env override, else `~/.claude`. */
export function claude_config_dir(): string {
    const env = (process.env['CLAUDE_CONFIG_DIR'] ?? '').trim();
    return env !== '' ? env : path.join(os.homedir(), '.claude');
}

/**
 * True when the agent-config plugin is recorded in Claude Code's
 * `plugins/installed_plugins.json` (any marketplace — matched by the
 * `agent-config@` id prefix). Unreadable / absent file → false.
 */
export function claude_plugin_installed(): boolean {
    const p = path.join(claude_config_dir(), 'plugins', 'installed_plugins.json');
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
        return false;
    }
    if (data === null || typeof data !== 'object') return false;
    const plugins = (data as { plugins?: unknown }).plugins;
    if (plugins === null || plugins === undefined || typeof plugins !== 'object') return false;
    return Object.keys(plugins as Record<string, unknown>).some((k) =>
        k.startsWith(`${CLAUDE_PLUGIN_ID}@`),
    );
}

/**
 * Version recorded in the installed marketplace snapshot's
 * `.claude-plugin/marketplace.json` (`metadata.version` — bumped per
 * release, so it tracks the package version the snapshot was taken from).
 * Null when the snapshot is absent or unreadable.
 */
export function claude_plugin_snapshot_version(): string | null {
    const p = path.join(
        claude_config_dir(),
        'plugins',
        'marketplaces',
        CLAUDE_MARKETPLACE_NAME,
        '.claude-plugin',
        'marketplace.json',
    );
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
        return null;
    }
    if (data === null || typeof data !== 'object') return null;
    const metadata = (data as { metadata?: unknown }).metadata;
    if (metadata === null || metadata === undefined || typeof metadata !== 'object') return null;
    const v = (metadata as { version?: unknown }).version;
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}
