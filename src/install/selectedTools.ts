/**
 * Persisted record of the AI tools AND capability packs the user actually
 * selected in the wizard, at `~/.event4u/agent-config/wizard-tools.json`.
 * This is the user's prior *selection* — distinct from `installed.lock`
 * (every tool agent-config was deployed to, which for an `--tools=all`
 * install is the full set) and from machine tool *detection*.
 *
 * Written by the apply route on a real (non-dry-run) wizard-v2 apply, and
 * read by `detect-tools` / the manifest endpoint so a repeat run pre-selects
 * exactly the prior selection. Empty / missing → first run → Step 1 falls
 * back to pre-selecting every installed tool.
 *
 * `packs` was added by road-to-setup-experience (council 2026-07-08,
 * lockfile-extension over settings-YAML surgery): the `packs:` list in
 * `.agent-settings.yml` is only rendered into FRESH settings files, so on
 * machines with an existing file the selection was never persisted anywhere
 * — the wizard forgot installed packs between runs.
 *
 * `AGENT_CONFIG_WIZARD_TOOLS` overrides the path (tests only).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';

function selectedToolsPath(): string {
    const override = process.env['AGENT_CONFIG_WIZARD_TOOLS'];
    if (override !== undefined && override.length > 0) return override;
    return resolve(homedir(), '.event4u', 'agent-config', 'wizard-tools.json');
}

export function writeSelectedTools(tools: string[], packs?: string[]): void {
    try {
        const path = selectedToolsPath();
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        // Preserve a previously recorded packs list when the caller does not
        // pass one (older call sites) — never silently drop the selection.
        const record: { tools: string[]; packs?: string[] } = { tools };
        const packsToWrite = packs ?? readSelectedPacks();
        if (packsToWrite.length > 0 || packs !== undefined) record.packs = packsToWrite;
        writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    } catch {
        // Best-effort: a failed write just means the next run falls back to
        // pre-selecting installed tools.
    }
}

/**
 * Return the recorded pack selection, or `[]` when absent / unreadable.
 * Optionally intersect with the known-pack set so a stale id never surfaces.
 */
export function readSelectedPacks(knownIds?: ReadonlySet<string>): string[] {
    try {
        const raw = readFileSync(selectedToolsPath(), 'utf8');
        const parsed = JSON.parse(raw) as { packs?: unknown };
        const packs = Array.isArray(parsed.packs)
            ? parsed.packs.filter((p): p is string => typeof p === 'string')
            : [];
        return knownIds === undefined ? packs : packs.filter((p) => knownIds.has(p));
    } catch {
        return [];
    }
}

/**
 * Return the recorded selection, or `[]` when absent / unreadable. Optionally
 * intersect with the known-tool set so a stale id never surfaces.
 */
export function readSelectedTools(knownIds?: ReadonlySet<string>): string[] {
    try {
        const raw = readFileSync(selectedToolsPath(), 'utf8');
        const parsed = JSON.parse(raw) as { tools?: unknown };
        const tools = Array.isArray(parsed.tools)
            ? parsed.tools.filter((t): t is string => typeof t === 'string')
            : [];
        return knownIds === undefined ? tools : tools.filter((t) => knownIds.has(t));
    } catch {
        return [];
    }
}
