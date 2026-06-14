#!/usr/bin/env tsx
/**
 * Sync the `event4u/agent-config` block in a project's `.gitignore`.
 *
 * TypeScript twin of `src/scripts/sync_gitignore.py` (ADR-096, Phase 5). The
 * CLI contract is mirrored EXACTLY — every flag (`--path`, `--template`,
 * `--dry-run`, `--replace`, `--cleanup-legacy`, `--quiet`), exit codes
 * (0 = no change / changed / dry-run; 2 = invalid args / template missing),
 * the stdout/stderr split, byte-identical messages, AND byte-identical
 * rewritten `.gitignore` output (block layout, trailing-newline normalisation,
 * unified-diff format). Exported helpers keep their Python snake_case names so
 * the ported pytest suite can call them 1:1.
 *
 * No behaviour changes — latent Python quirks replicated.
 *
 * Reads the canonical block body from `src/config/gitignore-block.txt` and
 * ensures every managed entry is present in `.gitignore` between the
 * START and END markers.
 *
 * Idempotent. Append-only by default (user-added lines inside the block
 * are preserved). Call with `--replace` for a destructive full rewrite.
 *
 * `--cleanup-legacy` additionally scrubs legacy patterns (pre-/agents/ layout
 * runtime artefacts) from anywhere in the target file — inside the managed
 * block and outside, where older installers or hand-edits dropped them.
 * Runs before the regular sync, so a single invocation removes garbage and
 * re-adds the current canonical entries.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SECTION_HEADER = '# event4u/agent-config';
export const SECTION_FOOTER = '# event4u/agent-config — END';
export const DEFAULT_GITIGNORE = '.gitignore';

const _HERE = fileURLToPath(import.meta.url);
// _HERE === <repo>/src/scripts/sync_gitignore.ts ; parents[2] of the .py file
// is the repo root — two dirs up from src/scripts. The Python original derives
// DEFAULT_TEMPLATE = <file>.parent.parent.parent / "src" / "config" /
// "gitignore-block.txt".
export const DEFAULT_TEMPLATE = path.join(
    path.dirname(_HERE),
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

function _strip(ln: string): string {
    // Python: ln.rstrip("\n").rstrip() — strip a trailing newline, then strip
    // all trailing whitespace.
    return ln.replace(/\n+$/, '').replace(/\s+$/, '');
}

function _is_entry(ln: string): boolean {
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

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Python str.splitlines() — split on universal newlines, no trailing empty. */
function _splitlines(text: string): string[] {
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

/** Python difflib.unified_diff(..., n=3) over keepends-split lines. */
export function render_diff(old_text: string, new_text: string, p: string): string {
    return unified_diff(
        _splitlinesKeepends(old_text),
        _splitlinesKeepends(new_text),
        p,
        p,
        3,
    ).join('');
}

// --- difflib.unified_diff port (keepends inputs) ----------------------------

/** Python str.splitlines(keepends=True) for \n / \r\n inputs. */
function _splitlinesKeepends(text: string): string[] {
    if (text === '') return [];
    const out: string[] = [];
    let buf = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        buf += ch;
        if (ch === '\n') {
            out.push(buf);
            buf = '';
        } else if (ch === '\r') {
            if (text[i + 1] === '\n') {
                buf += '\n';
                i += 1;
            }
            out.push(buf);
            buf = '';
        }
    }
    if (buf !== '') out.push(buf);
    return out;
}

interface OpCode {
    tag: string;
    i1: number;
    i2: number;
    j1: number;
    j2: number;
}

// SequenceMatcher port (autojunk disabled — difflib's default popular-element
// heuristic only triggers for b longer than 200 elements; .gitignore blocks
// are far smaller, so a plain LCS-by-matching-blocks port is byte-faithful for
// these inputs).
function _matchingBlocks(a: readonly string[], b: readonly string[]): Array<[number, number, number]> {
    const b2j = new Map<string, number[]>();
    for (let i = 0; i < b.length; i += 1) {
        const el = b[i] as string;
        const arr = b2j.get(el);
        if (arr) arr.push(i);
        else b2j.set(el, [i]);
    }

    function findLongest(alo: number, ahi: number, blo: number, bhi: number): [number, number, number] {
        let besti = alo;
        let bestj = blo;
        let bestsize = 0;
        let j2len = new Map<number, number>();
        for (let i = alo; i < ahi; i += 1) {
            const newj2len = new Map<number, number>();
            const js = b2j.get(a[i] as string) ?? [];
            for (const j of js) {
                if (j < blo) continue;
                if (j >= bhi) break;
                const k = (j2len.get(j - 1) ?? 0) + 1;
                newj2len.set(j, k);
                if (k > bestsize) {
                    besti = i - k + 1;
                    bestj = j - k + 1;
                    bestsize = k;
                }
            }
            j2len = newj2len;
        }
        return [besti, bestj, bestsize];
    }

    const queue: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]];
    const blocks: Array<[number, number, number]> = [];
    while (queue.length > 0) {
        const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
        const [i, j, k] = findLongest(alo, ahi, blo, bhi);
        if (k > 0) {
            blocks.push([i, j, k]);
            if (alo < i && blo < j) queue.push([alo, i, blo, j]);
            if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
        }
    }
    blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    blocks.push([a.length, b.length, 0]);
    return blocks;
}

function _getOpcodes(a: readonly string[], b: readonly string[]): OpCode[] {
    let i = 0;
    let j = 0;
    const answer: OpCode[] = [];
    for (const [ai, bj, size] of _matchingBlocks(a, b)) {
        let tag = '';
        if (i < ai && j < bj) tag = 'replace';
        else if (i < ai) tag = 'delete';
        else if (j < bj) tag = 'insert';
        if (tag) answer.push({ tag, i1: i, i2: ai, j1: j, j2: bj });
        i = ai + size;
        j = bj + size;
        if (size > 0) answer.push({ tag: 'equal', i1: ai, i2: i, j1: bj, j2: j });
    }
    return answer;
}

function _getGroupedOpcodes(a: readonly string[], b: readonly string[], n: number): OpCode[][] {
    let codes = _getOpcodes(a, b);
    if (codes.length === 0) {
        codes = [{ tag: 'equal', i1: 0, i2: 1, j1: 0, j2: 1 }];
    }
    // Fixup leading and trailing equal blocks.
    if (codes[0]!.tag === 'equal') {
        const c = codes[0]!;
        codes[0] = {
            tag: c.tag,
            i1: Math.max(c.i1, c.i2 - n),
            i2: c.i2,
            j1: Math.max(c.j1, c.j2 - n),
            j2: c.j2,
        };
    }
    const last = codes[codes.length - 1]!;
    if (last.tag === 'equal') {
        codes[codes.length - 1] = {
            tag: last.tag,
            i1: last.i1,
            i2: Math.min(last.i2, last.i1 + n),
            j1: last.j1,
            j2: Math.min(last.j2, last.j1 + n),
        };
    }
    const nn = n + n;
    const groups: OpCode[][] = [];
    let group: OpCode[] = [];
    for (const code of codes) {
        let { i1, j1 } = code;
        const { tag, i2, j2 } = code;
        if (tag === 'equal' && i2 - i1 > nn) {
            group.push({ tag, i1, i2: Math.min(i2, i1 + n), j1, j2: Math.min(j2, j1 + n) });
            groups.push(group);
            group = [];
            i1 = Math.max(i1, i2 - n);
            j1 = Math.max(j1, j2 - n);
        }
        group.push({ tag, i1, i2, j1, j2 });
    }
    if (group.length > 0 && !(group.length === 1 && group[0]!.tag === 'equal')) {
        groups.push(group);
    }
    return groups;
}

function _formatRangeUnified(start: number, stop: number): string {
    let beginning = start + 1; // lines start numbering with one
    const length = stop - start;
    if (length === 1) return `${beginning}`;
    if (length === 0) beginning -= 1; // empty ranges begin at line just before
    return `${beginning},${length}`;
}

/** Port of Python difflib.unified_diff(a, b, fromfile, tofile, n=3). */
export function unified_diff(
    a: readonly string[],
    b: readonly string[],
    fromfile: string,
    tofile: string,
    n: number,
): string[] {
    const out: string[] = [];
    let started = false;
    for (const group of _getGroupedOpcodes(a, b, n)) {
        if (!started) {
            started = true;
            out.push(`--- ${fromfile}\n`);
            out.push(`+++ ${tofile}\n`);
        }
        const first = group[0]!;
        const last = group[group.length - 1]!;
        const file1Range = _formatRangeUnified(first.i1, last.i2);
        const file2Range = _formatRangeUnified(first.j1, last.j2);
        out.push(`@@ -${file1Range} +${file2Range} @@\n`);
        for (const { tag, i1, i2, j1, j2 } of group) {
            if (tag === 'equal') {
                for (const line of a.slice(i1, i2)) out.push(' ' + line);
                continue;
            }
            if (tag === 'replace' || tag === 'delete') {
                for (const line of a.slice(i1, i2)) out.push('-' + line);
            }
            if (tag === 'replace' || tag === 'insert') {
                for (const line of b.slice(j1, j2)) out.push('+' + line);
            }
        }
    }
    return out;
}

// --- CLI ---------------------------------------------------------------------

interface ParsedArgs {
    path: string;
    template: string;
    dry_run: boolean;
    replace: boolean;
    cleanup_legacy: boolean;
    quiet: boolean;
}

const _PROG = 'sync_gitignore.py';

function _argError(usage: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = {
        path: DEFAULT_GITIGNORE,
        template: DEFAULT_TEMPLATE,
        dry_run: false,
        replace: false,
        cleanup_legacy: false,
        quiet: false,
    };
    const usage =
        'usage: sync_gitignore.py [-h] [--path PATH] [--template TEMPLATE]\n' +
        '                         [--dry-run] [--replace] [--cleanup-legacy]\n' +
        '                         [--quiet]\n';
    const valueFlags: Record<string, 'path' | 'template'> = {
        '--path': 'path',
        '--template': 'template',
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usage);
            process.exit(0);
        } else if (arg === '--dry-run') {
            args.dry_run = true;
        } else if (arg === '--replace') {
            args.replace = true;
        } else if (arg === '--cleanup-legacy') {
            args.cleanup_legacy = true;
        } else if (arg === '--quiet') {
            args.quiet = true;
        } else if (valueFlags[arg] !== undefined) {
            const next = argv[i + 1];
            if (next === undefined) {
                _argError(usage, `argument ${arg}: expected one argument`);
            }
            args[valueFlags[arg] as 'path' | 'template'] = next;
            i += 1;
        } else {
            const eq = arg.indexOf('=');
            const flag = eq === -1 ? arg : arg.slice(0, eq);
            if (eq !== -1 && valueFlags[flag] !== undefined) {
                args[valueFlags[flag] as 'path' | 'template'] = arg.slice(eq + 1);
            } else {
                _argError(usage, `unrecognized arguments: ${arg}`);
            }
        }
    }
    return args;
}

export function main(argv: readonly string[]): number {
    const args = parse_args(argv);

    let template_lines: string[];
    try {
        template_lines = load_template(args.template);
    } catch (exc) {
        if (exc instanceof TemplateNotFoundError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    const target = args.path;
    let existing_text: string;
    let existing_lines: string[];
    if (_isFile(target)) {
        existing_text = fs.readFileSync(target, 'utf-8');
        existing_lines = _splitlines(existing_text).map(_strip);
    } else {
        existing_text = '';
        existing_lines = [];
    }

    let removed_legacy: string[] = [];
    if (args.cleanup_legacy) {
        [existing_lines, removed_legacy] = cleanup_legacy(existing_lines);
    }

    const [new_lines, added] = sync_block(existing_lines, template_lines, { replace: args.replace });
    const new_text = format_file(new_lines);

    if (new_text === existing_text) {
        if (!args.quiet) {
            process.stdout.write(
                `✅  ${target}: block already in sync ` +
                    `(${template_entries(template_lines).length} entries)\n`,
            );
        }
        return 0;
    }

    if (args.dry_run) {
        const diff = render_diff(existing_text, new_text, target);
        process.stdout.write(diff);
        if (!args.quiet) {
            process.stderr.write(
                `\n(dry-run) would add ${added.length} entr` +
                    `${added.length === 1 ? 'y' : 'ies'} to ${target}\n`,
            );
            if (removed_legacy.length > 0) {
                process.stderr.write(
                    `(dry-run) would remove ${removed_legacy.length} legacy ` +
                        `entr${removed_legacy.length === 1 ? 'y' : 'ies'}: ` +
                        `${removed_legacy.join(', ')}\n`,
                );
            }
        }
        return 0;
    }

    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
    fs.writeFileSync(target, new_text, 'utf-8');
    if (!args.quiet) {
        const action = args.replace ? 'replaced' : 'updated';
        process.stdout.write(
            `✅  ${target}: ${action} block ` +
                `(${added.length} entr${added.length === 1 ? 'y' : 'ies'} added)\n`,
        );
        if (removed_legacy.length > 0) {
            process.stdout.write(
                `   removed ${removed_legacy.length} legacy ` +
                    `entr${removed_legacy.length === 1 ? 'y' : 'ies'}: ` +
                    `${removed_legacy.join(', ')}\n`,
            );
        }
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
