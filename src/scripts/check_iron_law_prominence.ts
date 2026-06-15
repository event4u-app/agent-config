#!/usr/bin/env tsx
/**
 * Iron Law prominence checker — enforces that any rule file declaring an
 * "Iron Law" places it at the top of the file at H2 level.
 *
 * TypeScript twin of `src/scripts/check_iron_law_prominence.py` (ADR-200,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — positional
 * paths (default `.agent-src.uncondensed/rules`), `--format` / `--quiet`
 * flags, exit codes (0 clean, 1 violations, 3 internal error),
 * stdout/stderr split, byte-identical finding messages, and the same
 * heading parse / code-fence skipping. No behaviour changes — latent bugs
 * replicated.
 *
 * Rules:
 *   1. No heading at H3 or deeper may match "Iron Law(s)" — Iron Laws must
 *      be H2 sections, never sub-sections.
 *   2. If a file declares one or more Iron-Law H2 sections, at least one
 *      of them must be among the first two H2 headings of the file.
 *
 * Files with no Iron-Law heading at all are exempt.
 *
 * Code blocks are skipped to avoid false positives on quoted text.
 *
 * Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const IRON_LAW_RE = /\biron\s+laws?\b/i;
const FENCE_RE = /^\s*```/;

export interface Violation {
    file: string;
    line: number;
    kind: string; // "deep_iron_law" | "buried_iron_law"
    detail: string;
}

/** Python `str.splitlines()` — universal-newline split, no trailing empty element. */
function splitlines(text: string): string[] {
    if (text === '') return [];
    const lines: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (ch === '\r') {
            lines.push(current);
            current = '';
            if (text[i + 1] === '\n') i += 1; // \r\n consumed as one
            continue;
        }
        if (
            ch === '\n' ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            lines.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current !== '') lines.push(current);
    return lines;
}

/** Return [line_no, depth, title] for each heading outside code fences. */
function _parse_headings(text: string): Array<[number, number, string]> {
    const headings: Array<[number, number, string]> = [];
    let in_fence = false;
    const lines = splitlines(text);
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] as string;
        const lineno = i + 1;
        if (FENCE_RE.test(raw)) {
            in_fence = !in_fence;
            continue;
        }
        if (in_fence) {
            continue;
        }
        const m = HEADING_RE.exec(raw);
        if (!m) {
            continue;
        }
        const depth = (m[1] as string).length;
        const title = (m[2] as string).trim();
        headings.push([lineno, depth, title]);
    }
    return headings;
}

export function scan_file(p: string): Violation[] {
    const text = fs.readFileSync(p, 'utf-8');
    const headings = _parse_headings(text);

    const violations: Violation[] = [];

    // Rule 1: no Iron Law at H3 or deeper.
    for (const [lineno, depth, title] of headings) {
        if (depth >= 3 && IRON_LAW_RE.test(title)) {
            violations.push({
                file: p,
                line: lineno,
                kind: 'deep_iron_law',
                detail: `H${depth} heading \`${title}\` — promote to H2`,
            });
        }
    }

    // Rule 2: if any H2 Iron Law exists, it must be in first 2 H2 positions.
    const h2: Array<[number, string]> = headings
        .filter(([, d]) => d === 2)
        .map(([ln, , t]) => [ln, t]);
    const iron_h2 = h2.filter(([, t]) => IRON_LAW_RE.test(t));
    if (iron_h2.length) {
        const first_two_lines = new Set(h2.slice(0, 2).map(([ln]) => ln));
        if (!iron_h2.some(([ln]) => first_two_lines.has(ln))) {
            const [first_iron_ln, first_iron_title] = iron_h2[0] as [number, string];
            const preceding = h2.filter(([ln]) => ln < first_iron_ln).map(([, t]) => t);
            violations.push({
                file: p,
                line: first_iron_ln,
                kind: 'buried_iron_law',
                detail:
                    `Iron Law H2 \`${first_iron_title}\` at line ${first_iron_ln} ` +
                    `is preceded by ${preceding.length} non-Iron-Law H2 section(s): ` +
                    `${_pyList(preceding)}. Move Iron Law into the first 2 H2 positions.`,
            });
        }
    }

    return violations;
}

/** Python repr of a str list: ['a', 'b']. */
function _pyList(items: readonly string[]): string {
    return '[' + items.map((s) => `'${s}'`).join(', ') + ']';
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Sorted recursive `*.md` glob (mirrors `p.rglob("*.md")` sorted by POSIX path). */
function _rglobMdSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith('.md')) {
                out.push(full);
            }
            if (ent.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

function _resolve_targets(paths: readonly string[]): string[] {
    const out: string[] = [];
    for (const raw of paths) {
        if (_isDir(raw)) {
            out.push(..._rglobMdSorted(raw));
        } else if (raw.endsWith('.md')) {
            out.push(raw);
        }
    }
    return out;
}

interface Args {
    paths: string[];
    format: 'text' | 'json';
    quiet: boolean;
}

function parse_args(argv: readonly string[]): Args {
    const paths: string[] = [];
    let format: 'text' | 'json' = 'text';
    let quiet = false;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--format') {
            const v = argv[++i] as string | undefined;
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `check_iron_law_prominence: error: argument --format: invalid choice: '${v ?? ''}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            format = v;
        } else if (arg.startsWith('--format=')) {
            const v = arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `check_iron_law_prominence: error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            format = v;
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_iron_law_prominence [-h] [--format {text,json}] [--quiet] [paths ...]\n');
            process.exit(0);
        } else if (arg.startsWith('-') && arg !== '-') {
            process.stderr.write(`check_iron_law_prominence: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        } else {
            paths.push(arg);
        }
        i++;
    }
    return {
        paths: paths.length ? paths : ['.agent-src.uncondensed/rules'],
        format,
        quiet,
    };
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const targets = _resolve_targets(args.paths);
    const all_violations: Violation[] = [];
    for (const p of targets) {
        if (!_exists(p)) {
            process.stderr.write(`⚠️  Not found: ${p}\n`);
            continue;
        }
        all_violations.push(...scan_file(p));
    }

    if (args.format === 'json') {
        process.stdout.write(JSON.stringify(all_violations, null, 2) + '\n');
    } else if (all_violations.length === 0) {
        if (!args.quiet) {
            process.stdout.write(`✅  Iron Law prominence clean (${targets.length} file(s) scanned).\n`);
        }
    } else {
        process.stdout.write(`❌  ${all_violations.length} Iron-Law prominence violation(s):\n\n`);
        for (const v of all_violations) {
            process.stdout.write(`  ${v.file}:${v.line} — ${v.kind}\n`);
            process.stdout.write(`    │ ${v.detail}\n`);
        }
    }

    return all_violations.length ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  Internal error: ${msg}\n`);
        process.exit(3);
    }
}
