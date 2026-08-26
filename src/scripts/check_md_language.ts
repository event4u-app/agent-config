#!/usr/bin/env tsx
/**
 * Markdown language checker — enforces language-and-tone § ".md files are ALWAYS English".
 *
 * Ported from the retired Python `src/scripts/check_md_language.py` (ADR-200, Phase 4 /
 * Wave 4c). The CLI contract is pinned — positional `paths`,
 * `--format` / `--quiet` flags, exit codes (0 clean, 1 violations, 3
 * internal error), stdout/stderr split, byte-identical finding messages,
 * the same per-line skipping (frontmatter, fences, indented code, DE/EN
 * anchors, ignore marker), and the same umlaut + DE-word detection. No
 * behaviour changes — historical quirks preserved (consumers pin the exact behaviour).
 *
 * Scans .md files for German content (umlauts, function words, quoted DE phrases)
 * in body prose, skipping fenced/inline code, DE:/EN: anchors, and ignore markers.
 *
 * Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classifyMarkdownLines } from './_lib/md_prose_lines.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

// Umlauts and German-only characters.
const UMLAUT_RE = /[äöüÄÖÜß]/g;

// German function words that almost never appear in English technical prose.
const DE_WORDS = [
    'für', 'nicht', 'dass', 'wenn', 'sollte', 'werden', 'arbeite',
    'selbstständig', 'jetzt', 'einfach', 'weiter', 'lösche', 'frag',
    'schreib', 'mach', 'auch', 'hier', 'diese', 'dieser', 'dieses',
    'vermutlich', 'bitte', 'kannst', 'sollen', 'müssen', 'wäre',
];

// Python builds `\b(w1|w2|...)\b` with re.IGNORECASE over Unicode `str`, so the
// boundaries are Unicode word boundaries. JS `\b` is ASCII-only; emulate the
// Unicode boundary with lookarounds over the Unicode word-char class
// (`\p{L}\p{N}_`). The `g` flag mirrors `finditer`; `i` mirrors IGNORECASE; `u`
// enables `\p{...}`.
const DE_WORD_RE = new RegExp(
    '(?<![\\p{L}\\p{N}_])(?:' +
        DE_WORDS.map((w) => _escapeRegExp(w)).join('|') +
        ')(?![\\p{L}\\p{N}_])',
    'giu',
);

function _escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Labeled bilingual anchor: lines starting with "DE:" or "- DE:" (and EN).
const DE_ANCHOR_RE = /^\s*[-*]?\s*(DE|EN):\s/i;

// Per-line escape marker.
const IGNORE_RE = /<!--\s*md-language-check:\s*ignore\s*-->/i;

export interface Violation {
    file: string;
    line: number;
    kind: string; // "umlaut" | "de_word"
    match: string;
    context: string;
}

export function scan_file(p: string): Violation[] {
    const violations: Violation[] = [];
    let content: string;
    try {
        content = fs.readFileSync(p, 'utf-8');
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`\u26a0\ufe0f  Cannot read ${p}: ${msg}\n`);
        return violations;
    }

    // Frontmatter / fence / indented-code / marker skipping is shared with
    // `lint_canonical_terms` via `_lib/md_prose_lines` — see that module's
    // header for why a second copy was refused. The classification is the same
    // code this function used to carry inline; the DE:/EN: anchor and the
    // per-line ignore marker are passed in as this gate's own markers.
    for (const line of classifyMarkdownLines(content, { markers: [DE_ANCHOR_RE, IGNORE_RE] })) {
        if (line.kind !== 'prose') continue;
        const scan_text = line.text;
        const ctx = _rstrip(line.raw);

        for (const m of scan_text.matchAll(UMLAUT_RE)) {
            violations.push({ file: p, line: line.lineno, kind: 'umlaut', match: m[0], context: ctx });
        }

        for (const m of scan_text.matchAll(DE_WORD_RE)) {
            violations.push({ file: p, line: line.lineno, kind: 'de_word', match: m[0], context: ctx });
        }
    }

    return violations;
}

function _rstrip(s: string): string {
    return s.replace(/\s+$/, '');
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
                    `check_md_language: error: argument --format: invalid choice: '${v ?? ''}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            format = v;
        } else if (arg.startsWith('--format=')) {
            const v = arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `check_md_language: error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            format = v;
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_md_language [-h] [--format {text,json}] [--quiet] paths [paths ...]\n');
            process.exit(0);
        } else if (arg.startsWith('-') && arg !== '-') {
            process.stderr.write(`check_md_language: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        } else {
            paths.push(arg);
        }
        i++;
    }
    if (paths.length === 0) {
        // argparse nargs="+" requires at least one.
        process.stderr.write('check_md_language: error: the following arguments are required: paths\n');
        process.exit(2);
    }
    return { paths, format, quiet };
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const all_violations: Violation[] = [];
    let scanned = 0;
    for (const raw_path of args.paths) {
        if (!_exists(raw_path)) {
            process.stderr.write(`⚠️  Not found: ${raw_path}\n`);
            continue;
        }
        if (path.extname(raw_path) !== '.md') {
            process.stderr.write(`⚠️  Skipping non-.md: ${raw_path}\n`);
            continue;
        }
        scanned += 1;
        all_violations.push(...scan_file(raw_path));
    }

    // The caller expands the path list (`find docs -name '*.md' …`), so a moved
    // docs tree hands this gate paths that every skip above swallows into a
    // stderr warning while stdout still reports "No German content detected".
    // Exit 3 is the documented "internal error" code — the gate could not run;
    // 1 means it read files and found German in them.
    try {
        assertScanned({
            gate: 'check_md_language',
            scanned,
            units: '.md file(s)',
            roots: [`${String(args.paths.length)} caller-supplied path(s)`],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 3;
        }
        throw exc;
    }

    if (args.format === 'json') {
        process.stdout.write(JSON.stringify(all_violations, null, 2) + '\n');
    } else if (all_violations.length === 0) {
        if (!args.quiet) {
            process.stdout.write('✅  No German content detected.\n');
        }
    } else {
        process.stdout.write(`❌  ${all_violations.length} violation(s) found:\n\n`);
        for (const v of all_violations) {
            process.stdout.write(`  ${v.file}:${v.line} — ${v.kind} \`${v.match}\`\n`);
            process.stdout.write(`    │ ${v.context}\n`);
        }
    }

    return all_violations.length ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
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
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  Internal error: ${msg}\n`);
        process.exit(3);
    }
}
