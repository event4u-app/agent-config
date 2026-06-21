/**
 * Persisted record of the AI tools the user actually selected in the wizard,
 * at `~/.event4u/agent-config/wizard-tools.json`. This is the user's prior
 * *selection* — distinct from `installed.lock` (every tool agent-config was
 * deployed to, which for an `--tools=all` install is the full set) and from
 * machine tool *detection*.
 *
 * Written by the apply route on a real (non-dry-run) wizard-v2 apply, and
 * read by `detect-tools` so Step 1 pre-selects exactly the prior selection on
 * a repeat run. Empty / missing → first run → Step 1 falls back to
 * pre-selecting every installed tool.
 *
 * `AGENT_CONFIG_WIZARD_TOOLS` overrides the path (tests only).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
function selectedToolsPath() {
    const override = process.env['AGENT_CONFIG_WIZARD_TOOLS'];
    if (override !== undefined && override.length > 0)
        return override;
    return resolve(homedir(), '.event4u', 'agent-config', 'wizard-tools.json');
}
export function writeSelectedTools(tools) {
    try {
        const path = selectedToolsPath();
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        writeFileSync(path, `${JSON.stringify({ tools }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    }
    catch {
        // Best-effort: a failed write just means the next run falls back to
        // pre-selecting installed tools.
    }
}
/**
 * Return the recorded selection, or `[]` when absent / unreadable. Optionally
 * intersect with the known-tool set so a stale id never surfaces.
 */
export function readSelectedTools(knownIds) {
    try {
        const raw = readFileSync(selectedToolsPath(), 'utf8');
        const parsed = JSON.parse(raw);
        const tools = Array.isArray(parsed.tools)
            ? parsed.tools.filter((t) => typeof t === 'string')
            : [];
        return knownIds === undefined ? tools : tools.filter((t) => knownIds.has(t));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=selectedTools.js.map