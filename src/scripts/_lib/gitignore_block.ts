/**
 * The `.gitignore` managed-block logic, with no CLI entry.
 *
 * WHY IT IS NOT IN `sync_gitignore.ts` ANY MORE. That file ends in a
 * `process.exit(main(...))` behind a CLI-entry guard, and `check_installer_import_purity`
 * refuses any module-level exit reachable from `install.ts`: esbuild inlines the
 * whole closure into `dist/install/install.mjs`, where the guard comparing
 * `import.meta.url` to `process.argv[1]` evaluates TRUE because the bundle IS
 * argv[1]. A consumer install would then exit after writing its payload.
 *
 * So the pure half lives here, with no entry and no exit, and `sync_gitignore.ts`
 * re-exports every name it used to own — the CLI contract and the ported
 * pytest suite's snake_case call sites are unchanged.
 *
 * Everything below is byte-for-byte the behaviour it had in that file,
 * including the historical quirks downstream consumers pin.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECTION_HEADER = '# event4u/agent-config';
export const SECTION_FOOTER = '# event4u/agent-config — END';
export const DEFAULT_GITIGNORE = '.gitignore';

const _HERE = fileURLToPath(import.meta.url);
// _HERE === <repo>/src/scripts/_lib/gitignore_block.ts, so the repo root is
// three directories up. The retired Python implementation derived
// DEFAULT_TEMPLATE = <file>.parent.parent.parent / "src" / "config" /
// "gitignore-block.txt" from one level higher; the extra `..` here is that
// same root reached from one level deeper.
export const DEFAULT_TEMPLATE = path.join(
    path.dirname(_HERE),
    '..',
    '..',
    '..',
    'src',
    'config',
    'gitignore-block.txt',
);

// Legacy patterns that lived in older versions of src/config/gitignore-block.txt
// before runtime artefacts moved under /agents/runtime/ (May 2026). They get
// stripped wherever they appear in the consumer's .gitignore — inside the
// managed block or outside (older installers / hand-edits). Current canonical
// equivalents (e.g. /agents/runtime/.agent-prices.md) come from the template
// and are NOT affected. Leading-slash variants are matched defensively.
//
// Authoritative source: src/config/agents-paths.yml entries with `legacy: true`.
// Manual sync until the generation step from the manifest is implemented
// (road-to-agents-dir-and-gitignore-hygiene Phase 3.2 follow-on).
export const LEGACY_PATTERNS: readonly string[] = [
    '.agent-chat-history',
    '.agent-chat-history.bak',
    '.agent-chat-history.*.bak',
    '.agent-prices.md',
    '.council-tmp/',
    // 2.x intermediate: prices cache lived directly under agents/ before
    // consolidating under agents/runtime/.
    'agents/.agent-prices.md',
    // Budget history JSONLs — previously listed explicitly at project
    // root or under agents/; now covered by the /agents/runtime/
    // catch-all in the managed block.
    '.augment-budget-history.jsonl',
    '.rule-budget-history.jsonl',
    'agents/.augment-budget-history.jsonl',
    'agents/.rule-budget-history.jsonl',
];

export function _strip(ln: string): string {
    // Python: ln.rstrip("\n").rstrip() — strip a trailing newline, then strip
    // all trailing whitespace.
    return ln.replace(/\n+$/, '').replace(/\s+$/, '');
}

export function _is_entry(ln: string): boolean {
    // Non-empty, non-comment line = a path/pattern entry.
    const s = _strip(ln).replace(/^\s+/, '');
    return Boolean(s) && !s.startsWith('#');
}

/** Error raised when the template file is missing (→ exit 2 in main). */
export class TemplateNotFoundError extends Error {
    constructor(p: string) {
        super(`template not found: ${p}`);
        this.name = 'TemplateNotFoundError';
    }
}

export function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Python str.splitlines() — split on universal newlines, no trailing empty. */
export function _splitlines(text: string): string[] {
    if (text === '') return [];
    // str.splitlines() splits on \n, \r, \r\n (and more) and does NOT keep a
    // trailing empty element. The targets here only ever contain \n / \r\n.
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    return parts;
}

export function load_template(p: string): string[] {
    if (!_isFile(p)) {
        throw new TemplateNotFoundError(p);
    }
    const text = fs.readFileSync(p, 'utf-8');
    // Keep trailing newlines stripped; we splice explicit newlines.
    return _splitlines(text).map(_strip);
}

/**
 * Locate the managed block; return [start_idx, end_idx_exclusive] or null.
 *
 * `start_idx` points at the SECTION_HEADER line.
 * `end_idx_exclusive` points one past the last line of the block.
 * Honors explicit SECTION_FOOTER when present; otherwise treats the
 * block as extending to EOF or to the next non-managed section.
 */
export function find_block(lines: readonly string[]): [number, number] | null {
    for (let i = 0; i < lines.length; i += 1) {
        if (_strip(lines[i] as string) === SECTION_HEADER) {
            const start = i;
            // Explicit footer?
            for (let j = i + 1; j < lines.length; j += 1) {
                if (_strip(lines[j] as string) === SECTION_FOOTER) {
                    return [start, j + 1];
                }
            }
            // Legacy: extend to EOF or next non-managed section break.
            let end = lines.length;
            for (let j = i + 1; j < lines.length; j += 1) {
                const s = _strip(lines[j] as string).replace(/^\s+/, '');
                if (
                    s.startsWith('#') &&
                    !s.startsWith('# Agent config') &&
                    s !== SECTION_HEADER
                ) {
                    end = j;
                    while (end > i + 1 && _strip(lines[end - 1] as string) === '') {
                        end -= 1;
                    }
                    break;
                }
            }
            return [start, end];
        }
    }
    return null;
}

/** Return entries (paths/patterns) present in the given block. */
export function block_entries(block_lines: readonly string[]): string[] {
    return block_lines
        .filter((ln) => _is_entry(ln))
        .map((ln) => _strip(ln).replace(/^\s+/, ''));
}

export function template_entries(template_lines: readonly string[]): string[] {
    return template_lines.filter((ln) => _is_entry(ln)).map((ln) => ln.replace(/^\s+/, ''));
}

/** Return a fresh, fully-managed block with START + body + END. */
export function build_fresh_block(template_lines: readonly string[]): string[] {
    return [SECTION_HEADER, ...template_lines, SECTION_FOOTER];
}

/**
 * Return [new_lines, added_entries].
 *
 * - If block missing: append fresh block (preceded by a blank line if the
 *   file's last line is not already empty).
 * - If block present and replace=true: rewrite block in full.
 * - If block present and replace=false: append any missing managed entries
 *   before the END marker (adding END if absent). User-added lines inside the
 *   block are preserved.
 */
export function sync_block(
    existing_lines: readonly string[],
    template_lines: readonly string[],
    options: { replace?: boolean } = {},
): [string[], string[]] {
    const replace = options.replace ?? false;
    const loc = find_block(existing_lines);
    const fresh = build_fresh_block(template_lines);

    // Missing block → append with leading blank if needed.
    if (loc === null) {
        const newLines = [...existing_lines];
        if (newLines.length > 0 && _strip(newLines[newLines.length - 1] as string) !== '') {
            newLines.push('');
        }
        newLines.push(...fresh);
        return [newLines, template_entries(template_lines)];
    }

    const [start, end] = loc;
    const head = existing_lines.slice(0, start);
    let block = existing_lines.slice(start, end);
    const tail = existing_lines.slice(end);

    if (replace) {
        const existing = new Set(block_entries(block));
        const added = template_entries(template_lines).filter((e) => !existing.has(e));
        return [[...head, ...fresh, ...tail], added];
    }

    // Append-only mode.
    const existing_entries = new Set(block_entries(block));
    const missing = template_entries(template_lines).filter((e) => !existing_entries.has(e));
    if (missing.length === 0) {
        return [[...existing_lines], []];
    }

    // Ensure block ends with SECTION_FOOTER; insert missing entries right
    // before it.
    let insert_at: number;
    if (block.length > 0 && _strip(block[block.length - 1] as string) === SECTION_FOOTER) {
        insert_at = block.length - 1;
    } else {
        block = [...block, SECTION_FOOTER];
        insert_at = block.length - 1;
    }
    const new_block = [...block.slice(0, insert_at), ...missing, ...block.slice(insert_at)];
    return [[...head, ...new_block, ...tail], missing];
}

/**
 * Strip legacy entries from anywhere in the file.
 *
 * A line is legacy when its stripped, leading-whitespace-trimmed content
 * matches a `LEGACY_PATTERNS` entry — with or without a leading slash.
 * Comments and blank lines are untouched; current managed entries (e.g.
 * `/agents/.agent-chat-history`) are not in the legacy set and survive.
 */
export function cleanup_legacy(lines: readonly string[]): [string[], string[]] {
    const legacy = new Set(LEGACY_PATTERNS);
    const kept: string[] = [];
    const removed: string[] = [];
    for (const ln of lines) {
        const s = _strip(ln).replace(/^\s+/, '');
        if (legacy.has(s) || (s.startsWith('/') && legacy.has(s.slice(1)))) {
            removed.push(s);
            continue;
        }
        kept.push(ln);
    }
    return [kept, removed];
}

/** Join lines with newlines and enforce exactly one trailing newline. */
export function format_file(lines: readonly string[]): string {
    const text = lines.join('\n');
    return text.replace(/\n+$/, '') + '\n';
}
