#!/usr/bin/env tsx
/**
 * Sync the `event4u/agent-config` managed memory-merge-safety block into a
 * project's root `.gitattributes`.
 *
 * Sibling of `sync_gitignore.ts` (same SECTION_HEADER/FOOTER marker shape,
 * same append-only idempotent behaviour: missing block → append fresh;
 * block present → add only the managed lines that are missing; never touch
 * unrelated lines). Unlike `sync_gitignore.ts` this script has no retired
 * Python predecessor to byte-match, so it skips that file's unified-diff /
 * legacy-cleanup machinery and keeps only what this task needs: idempotent
 * append + a `--check` drift probe.
 *
 * Canonical body: `src/agent-src/templates/agents/.gitattributes.fragment`
 * (road-to-reachable-code-memory.md Phase 5) — union-merge attributes for
 * the memory intake JSONL + curated flat/directory YAML layouts.
 *
 * Idempotent. Append-only: a second run on an already-synced file is a
 * no-op (exit 0, no write). `--check` reports drift without writing —
 * exit 0 (in sync) or 1 (missing entries) — for CI / doctor use.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SECTION_HEADER = '# --- BEGIN agent-config managed: memory merge attributes ---';
export const SECTION_FOOTER = '# --- END agent-config managed: memory merge attributes ---';
export const DEFAULT_GITATTRIBUTES = '.gitattributes';

const _HERE = fileURLToPath(import.meta.url);
// _HERE === <repo>/src/scripts/sync_gitattributes.ts ; the canonical fragment
// lives at <repo>/src/agent-src/templates/agents/.gitattributes.fragment —
// two dirs up from src/scripts, then into src/agent-src/templates/agents.
export const DEFAULT_TEMPLATE = path.join(
    path.dirname(_HERE),
    '..',
    'agent-src',
    'templates',
    'agents',
    '.gitattributes.fragment',
);

function _strip(ln: string): string {
    return ln.replace(/\n+$/, '').replace(/\s+$/, '');
}

function _is_entry(ln: string): boolean {
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

function _splitlines(text: string): string[] {
    if (text === '') return [];
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    return parts;
}

export function load_template(p: string): string[] {
    if (!_isFile(p)) {
        throw new TemplateNotFoundError(p);
    }
    const text = fs.readFileSync(p, 'utf-8');
    return _splitlines(text).map(_strip);
}

/**
 * Locate the managed block; return [start_idx, end_idx_exclusive] or null.
 *
 * `start_idx` points at the SECTION_HEADER line; `end_idx_exclusive` points
 * one past SECTION_FOOTER. A header with no matching footer is treated as
 * extending to EOF (defensive — normal writes always pair header + footer).
 */
export function find_block(lines: readonly string[]): [number, number] | null {
    for (let i = 0; i < lines.length; i += 1) {
        if (_strip(lines[i] as string) === SECTION_HEADER) {
            for (let j = i + 1; j < lines.length; j += 1) {
                if (_strip(lines[j] as string) === SECTION_FOOTER) {
                    return [i, j + 1];
                }
            }
            return [i, lines.length];
        }
    }
    return null;
}

/** Return entries (attribute lines) present in the given block. */
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
 * - If block present: append any missing managed entries before the END
 *   marker (adding END if somehow absent). User-added lines inside the
 *   block are preserved — this is append-only, never a destructive rewrite.
 */
export function sync_block(
    existing_lines: readonly string[],
    template_lines: readonly string[],
): [string[], string[]] {
    const loc = find_block(existing_lines);
    const fresh = build_fresh_block(template_lines);

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

    const existing_entries = new Set(block_entries(block));
    const missing = template_entries(template_lines).filter((e) => !existing_entries.has(e));
    if (missing.length === 0) {
        return [[...existing_lines], []];
    }

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

/** Join lines with newlines and enforce exactly one trailing newline. */
export function format_file(lines: readonly string[]): string {
    const text = lines.join('\n');
    return text.replace(/\n+$/, '') + '\n';
}

// --- CLI ---------------------------------------------------------------------

interface ParsedArgs {
    path: string;
    template: string;
    check: boolean;
    quiet: boolean;
}

const _PROG = 'sync_gitattributes';

function _argError(usage: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = {
        path: DEFAULT_GITATTRIBUTES,
        template: DEFAULT_TEMPLATE,
        check: false,
        quiet: false,
    };
    const usage = 'usage: sync_gitattributes [-h] [--path PATH] [--template TEMPLATE] [--check] [--quiet]\n';
    const valueFlags: Record<string, 'path' | 'template'> = {
        '--path': 'path',
        '--template': 'template',
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usage);
            process.exit(0);
        } else if (arg === '--check') {
            args.check = true;
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

    const [new_lines, added] = sync_block(existing_lines, template_lines);
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

    if (args.check) {
        if (!args.quiet) {
            process.stderr.write(
                `⚠️  ${target}: missing ${added.length} managed entr` +
                    `${added.length === 1 ? 'y' : 'ies'} — run without --check to apply\n`,
            );
        }
        return 1;
    }

    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
    fs.writeFileSync(target, new_text, 'utf-8');
    if (!args.quiet) {
        process.stdout.write(
            `✅  ${target}: updated block ` +
                `(${added.length} entr${added.length === 1 ? 'y' : 'ies'} added)\n`,
        );
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
