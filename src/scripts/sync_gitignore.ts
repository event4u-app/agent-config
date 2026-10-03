#!/usr/bin/env tsx
/**
 * Sync the `event4u/agent-config` block in a project's `.gitignore`.
 *
 * Ported from the retired Python `src/scripts/sync_gitignore.py` (ADR-200). The
 * CLI contract is mirrored EXACTLY — every flag (`--path`, `--template`,
 * `--dry-run`, `--replace`, `--cleanup-legacy`, `--quiet`), exit codes
 * (0 = no change / changed / dry-run; 2 = invalid args / template missing),
 * the stdout/stderr split, byte-identical messages, AND byte-identical
 * rewritten `.gitignore` output (block layout, trailing-newline normalisation,
 * unified-diff format). Exported helpers keep their Python snake_case names so
 * the ported pytest suite can call them 1:1.
 *
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
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

export {
    SECTION_HEADER,
    SECTION_FOOTER,
    DEFAULT_GITIGNORE,
    DEFAULT_TEMPLATE,
    LEGACY_PATTERNS,
    TemplateNotFoundError,
    load_template,
    find_block,
    block_entries,
    template_entries,
    build_fresh_block,
    sync_block,
    cleanup_legacy,
    format_file,
} from './_lib/gitignore_block.js';
import {
    DEFAULT_GITIGNORE,
    DEFAULT_TEMPLATE,
    TemplateNotFoundError,
    load_template,
    cleanup_legacy,
    format_file,
    sync_block,
    template_entries,
    _isFile,
    _splitlines,
    _strip,
} from './_lib/gitignore_block.js';

const _HERE = fileURLToPath(import.meta.url);

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

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
