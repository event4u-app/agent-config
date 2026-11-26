/**
 * hook_settings — read a `hooks.<section>.enabled` flag out of
 * `.agent-settings.yml` without dragging a YAML parser into a hook.
 *
 * Every default-OFF hook needs the same two-level lookup, and the tree already
 * carries two hand-rolled copies of it (`code_graph_context_hook (no flag)` and the
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

    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionPattern = new RegExp(`^(\\s+)${escaped}\\s*:\\s*$`);
    let inHooks = false;
    /** Indent width of the matched section header; null while outside it. */
    let sectionIndent: number | null = null;

    const indentOf = (line: string): number => line.length - line.replace(/^\s+/, '').length;

    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.replace(/^\s+/, '').startsWith('#')) continue;

        // A non-indented line closes both scopes and may open `hooks:`.
        if (!(line.startsWith(' ') || line.startsWith('\t'))) {
            inHooks = /^hooks\s*:\s*$/.test(line);
            sectionIndent = null;
            continue;
        }

        if (inHooks) {
            const opened = sectionPattern.exec(line);
            if (opened) {
                // Remember the ACTUAL indent rather than assuming two spaces.
                // The previous version closed the section on any line indented
                // <= 3, so on a 4-space file a sibling section never closed and
                // a default-OFF hook could read another section's enabled: true.
                sectionIndent = opened[1]!.length;
                continue;
            }
            // A key at or above the section header's own depth closes it.
            if (sectionIndent !== null && indentOf(line) <= sectionIndent) {
                sectionIndent = null;
            }
        }

        if (sectionIndent !== null && /^\s+enabled\s*:\s*true\b/.test(line)) return true;
    }

    return false;
}

/**
 * Raw scalar at `hooks.<section>.<key>` in `.agent-settings.yml`, or `''`.
 *
 * The `hookSectionEnabled` sibling above answers one boolean question and is
 * the right shape for a default-OFF switch. This one exists because
 * `hooks.verify_before_complete.touched_file_quality` is a three-valued mode
 * (`off | shadow | warn`), and collapsing it into a boolean would lose exactly
 * the distinction the roadmap's Phase 2 turns on — `shadow` records and says
 * nothing, `warn` records and emits one line.
 *
 * It reuses the section scoping of `hookSectionEnabled` verbatim, including the
 * ACTUAL-indent close that the 4-space-file defect produced: a reader that
 * closed the section on a fixed depth would read a sibling section's value under
 * this key's name, which for a mode string is worse than for a flag — the wrong
 * value is a legal one.
 *
 * Interpretation is NOT done here. `''` means "nothing was written", and the
 * caller decides what that defaults to.
 */
export function hookSectionValue(root: string, section: string, key: string): string {
    const file = path.join(root, SETTINGS_FILE);
    let text: string;
    try {
        if (!fs.statSync(file).isFile()) return '';
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return '';
    }

    const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionPattern = new RegExp(`^(\\s+)${esc(section)}\\s*:\\s*$`);
    const keyPattern = new RegExp(`^\\s+${esc(key)}\\s*:\\s*(.+)$`);
    let inHooks = false;
    let sectionIndent: number | null = null;

    const indentOf = (line: string): number => line.length - line.replace(/^\s+/, '').length;

    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.replace(/^\s+/, '').startsWith('#')) continue;

        if (!(line.startsWith(' ') || line.startsWith('\t'))) {
            inHooks = /^hooks\s*:\s*$/.test(line);
            sectionIndent = null;
            continue;
        }

        if (inHooks) {
            const opened = sectionPattern.exec(line);
            if (opened) {
                sectionIndent = opened[1]!.length;
                continue;
            }
            if (sectionIndent !== null && indentOf(line) <= sectionIndent) {
                sectionIndent = null;
            }
        }

        if (sectionIndent !== null) {
            const m = keyPattern.exec(line);
            if (m) {
                return (m[1] ?? '')
                    .replace(/\s+#.*$/, '')
                    .trim()
                    .replace(/^["']|["']$/g, '');
            }
        }
    }

    return '';
}

