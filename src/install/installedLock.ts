/**
 * Read the global install lockfile written by `scripts/install.py`
 * (`scripts/_lib/installed_lock.py`) at
 * `~/.event4u/agent-config/installed.lock`. Its `tools:` list is the set of
 * tools agent-config was previously installed for — i.e. the user's prior
 * selection. The wizard uses it to pre-select the previously-chosen tools on
 * a repeat run instead of every installed tool.
 *
 * Format (line-oriented YAML-ish, mirrored from the Python writer):
 *
 *   schema_version: 1
 *   agent_config_version: "4.3.0"
 *   installed_at: "2026-05-27T06:19:22Z"
 *   tools:
 *     - cursor
 *     - claude-code
 *
 * We parse it directly rather than depending on a YAML lib (the server has
 * none) — the shape is fixed and the Python reader is equally forgiving.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

function lockfilePath(): string {
    const override = process.env['AGENT_CONFIG_INSTALLED_LOCK'];
    if (override !== undefined && override.length > 0) return override;
    return resolve(homedir(), '.event4u', 'agent-config', 'installed.lock');
}

/**
 * Return the tool ids recorded in the install lockfile, or `[]` when the
 * file is absent / unreadable / has no tools. Optionally intersect with a
 * set of known ids so a stale lockfile entry never surfaces an unknown tool.
 */
export function readConfiguredTools(knownIds?: ReadonlySet<string>): string[] {
    let text: string;
    try {
        text = readFileSync(lockfilePath(), 'utf8');
    } catch {
        return [];
    }
    const tools: string[] = [];
    let inTools = false;
    for (const line of text.split('\n')) {
        if (/^tools:\s*$/.test(line)) {
            inTools = true;
            continue;
        }
        if (!inTools) continue;
        const m = /^\s*-\s+(\S+)\s*$/.exec(line);
        if (m !== null) {
            const id = m[1]!;
            if (knownIds === undefined || knownIds.has(id)) tools.push(id);
        } else if (line.trim() !== '' && !/^\s/.test(line)) {
            // Dedented non-list line ends the tools block.
            inTools = false;
        }
    }
    return tools;
}
