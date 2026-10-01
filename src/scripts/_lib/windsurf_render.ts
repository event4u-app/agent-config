/**
 * The windsurf single-file surface, rendered — one renderer, two callers.
 *
 * `road-to-a-hook-bundle-with-one-yaml-reader` 3.1. `condense.generate_windsurfrules`
 * WRITES `.windsurfrules`; the standing-payload census needs the same bytes to
 * report windsurf's figure without reading that file, because it is an untracked
 * generated projection and reading it published a number that tracked when the
 * checkout last ran `task generate-tools` rather than anything about the tree.
 *
 * Both callers share THIS function. A second renderer living in the census would
 * have measured a file nobody receives, which is Risk 3 of that roadmap.
 *
 * WHY A SEPARATE MODULE rather than an export from `condense.ts`: that file sits
 * 1,228 lines over the 1,500-line cap `check_source_size_budget` ratchets, so
 * every line added there is a new violation. Splitting the renderer out moves
 * `condense.ts` DOWN. The file is small on purpose and carries only what the
 * render needs.
 *
 * `strip_frontmatter` moved here with it — it is the render's one non-trivial
 * dependency, it has exactly one caller left inside `condense.ts`, and leaving it
 * behind would have meant either an import cycle or a second copy.
 * `condense.ts` re-exports it, so `src/install/emit_host_rules_cli.ts` and every
 * other importer keeps its path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Python `str.lstrip("\n")` — strip only leading newlines. Mirrors `condense._lstripNewlines`. */
function lstripNewlines(s: string): string {
    return s.replace(/^\n+/, '');
}

/** Python `str.strip()` with no args — strip leading/trailing Unicode whitespace. Mirrors `condense._strip`. */
function strip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Drop a leading `---` frontmatter block, if the content opens with one. */
export function strip_frontmatter(content: string): string {
    if (content.startsWith('---')) {
        const end = content.indexOf('---', 3);
        if (end !== -1) {
            content = lstripNewlines(content.slice(end + 3));
        }
    }
    return content;
}

/**
 * The exact bytes `generate_windsurfrules` writes, for a given rule set.
 *
 * `rulesSource` is a parameter rather than `condense.MODULE_STATE.RULES_SOURCE`
 * so a caller can render a tree it names — the census renders the projection
 * source directly, with no module state to set up.
 */
export function render_windsurfrules(rulesSource: string, rules: readonly string[]): string {
    const parts = ['# Auto-generated from dist/agent-src/rules/ — do not edit directly\n'];
    for (const rule of rules) {
        const content = strip_frontmatter(fs.readFileSync(path.join(rulesSource, rule), 'utf-8'));
        parts.push(`---\n\n${strip(content)}\n`);
    }
    return parts.join('\n') + '\n';
}
