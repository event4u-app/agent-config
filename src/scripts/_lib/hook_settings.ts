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
 * Raw `lean_projection.mode` string out of `.agent-settings.yml`, or `''`.
 *
 * Same indentation-shaped discipline as `hookSectionEnabled` above and for the
 * same reason — no YAML parser in a hook — but a top-level two-level key rather
 * than a `hooks.<section>.enabled` flag. Interpretation is NOT done here:
 * `_lib/lean_projection_mode.ts` owns it, so the projector and the concern
 * cannot disagree about what the string means.
 */
export function leanProjectionModeRaw(root: string): string {
    const file = path.join(root, SETTINGS_FILE);
    let text: string;
    try {
        if (!fs.statSync(file).isFile()) return '';
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return '';
    }
    let inSection = false;
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.replace(/^\s+/, '').startsWith('#')) continue;
        if (!(line.startsWith(' ') || line.startsWith('\t'))) {
            inSection = /^lean_projection\s*:\s*$/.test(line);
            continue;
        }
        if (!inSection) continue;
        const m = /^\s+mode\s*:\s*(.+)$/.exec(line);
        if (m) return (m[1] ?? '').trim().replace(/^["']|["']$/g, '');
    }
    return '';
}
