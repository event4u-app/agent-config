/**
 * hook_settings — read a `hooks.<section>.enabled` flag out of
 * `.agent-settings.yml` without dragging a YAML parser into a hook.
 *
 * Every default-OFF hook needs the same two-level lookup, and the tree already
 * carries two hand-rolled copies of it (`code_graph_nudge_hook.enabled` and the
 * equivalent inside `design_slop_hook`). Adding a third copy for the route
 * nudge is what this file prevents; the two existing copies are pre-existing
 * duplication and are deliberately left alone — folding them in is a separate,
 * behaviour-neutral change, not something to smuggle into a feature diff.
 *
 * Fail-closed on the flag, fail-open on the read: an unreadable or malformed
 * settings file returns `false`, which keeps a default-OFF hook off. A hook
 * that turned itself ON because it could not read a file would be the worst
 * possible failure mode for an opt-in nudge.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const SETTINGS_FILE = '.agent-settings.yml';

/**
 * True when `.agent-settings.yml` under `root` carries
 * `hooks:\n  <section>:\n    enabled: true`.
 *
 * Deliberately indentation-shaped rather than a real parse: the same shape the
 * existing hooks rely on, and a hook must never fail a tool call because a
 * dependency could not load.
 */
export function hookSectionEnabled(root: string, section: string): boolean {
    const file = path.join(root, SETTINGS_FILE);
    let text: string;
    try {
        if (!fs.statSync(file).isFile()) return false;
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return false;
    }

    const sectionPattern = new RegExp(`^\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*$`);
    let inHooks = false;
    let inSection = false;

    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.replace(/^\s+/, '').startsWith('#')) continue;

        // A non-indented line closes both scopes and may open `hooks:`.
        if (!(line.startsWith(' ') || line.startsWith('\t'))) {
            inHooks = /^hooks\s*:\s*$/.test(line);
            inSection = false;
            continue;
        }

        if (inHooks) {
            if (sectionPattern.test(line)) {
                inSection = true;
                continue;
            }
            // A sibling key at the section's own depth closes the section.
            if (inSection && /^\s{0,3}\S/.test(line)) inSection = false;
        }

        if (inSection && /^\s+enabled\s*:\s*true\b/.test(line)) return true;
    }

    return false;
}
