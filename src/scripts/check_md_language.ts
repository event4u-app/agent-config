#!/usr/bin/env tsx
/**
 * Markdown language checker — enforces language-and-tone § ".md files are ALWAYS English".
 *
 * TypeScript twin of `src/scripts/check_md_language.py` (ADR-092, Phase 4 /
 * Wave 4c). The CLI contract is mirrored EXACTLY — positional `paths`,
 * `--format` / `--quiet` flags, exit codes (0 clean, 1 violations, 3
 * internal error), stdout/stderr split, byte-identical finding messages,
 * the same per-line skipping (frontmatter, fences, indented code, DE/EN
 * anchors, ignore marker), and the same umlaut + DE-word detection. No
 * behaviour changes — latent bugs replicated.
 *
 * Scans .md files for German content (umlauts, function words, quoted DE phrases)
 * in body prose, skipping fenced/inline code, DE:/EN: anchors, and ignore markers.
 *
 * Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// Inline code spans.
const INLINE_CODE_RE = /`[^`]*`/g;

// Per-line escape marker.
const IGNORE_RE = /<!--\s*md-language-check:\s*ignore\s*-->/i;

export interface Violation {
    file: string;
    line: number;
    kind: string; // "umlaut" | "de_word"
    match: string;
    context: string;
}

function _strip_inline_code(text: string): string {
    return text.replace(INLINE_CODE_RE, '');
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

export function scan_file(p: string): Violation[] {
    const violations: Violation[] = [];
    let lines: string[];
    try {
        lines = splitlines(fs.readFileSync(p, 'utf-8'));
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`⚠️  Cannot read ${p}: ${msg}\n`);
        return violations;
    }

    let in_fence = false;
    let in_frontmatter = false;
    for (let idx = 0; idx < lines.length; idx++) {
        const raw = lines[idx] as string;
        const lineno = idx + 1;
        const stripped = _lstrip(raw);

        // YAML frontmatter at top of file.
        if (lineno === 1 && stripped === '---') {
            in_frontmatter = true;
            continue;
        }
        if (in_frontmatter) {
            if (stripped === '---') {
                in_frontmatter = false;
            }
            continue;
        }

        // Fenced code blocks.
        if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
            in_fence = !in_fence;
            continue;
        }
        if (in_fence) {
            continue;
        }

        // Indented code blocks (4+ leading spaces, non-list).
        const listStarts = ['-', '*', '+', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        if (raw.startsWith('    ') && !listStarts.some((c) => stripped.startsWith(c))) {
            continue;
        }

        // Labeled bilingual anchor.
        if (DE_ANCHOR_RE.test(raw)) {
            continue;
        }

        // Per-line opt-out marker.
        if (IGNORE_RE.test(raw)) {
            continue;
        }

        // Strip inline code spans before scanning.
        const scan_text = _strip_inline_code(raw);
        const ctx = _rstrip(raw);

        for (const m of scan_text.matchAll(UMLAUT_RE)) {
            violations.push({ file: p, line: lineno, kind: 'umlaut', match: m[0], context: ctx });
        }

        for (const m of scan_text.matchAll(DE_WORD_RE)) {
            violations.push({ file: p, line: lineno, kind: 'de_word', match: m[0], context: ctx });
        }
    }

    return violations;
}

function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
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
    for (const raw_path of args.paths) {
        if (!_exists(raw_path)) {
            process.stderr.write(`⚠️  Not found: ${raw_path}\n`);
            continue;
        }
        if (path.extname(raw_path) !== '.md') {
            process.stderr.write(`⚠️  Skipping non-.md: ${raw_path}\n`);
            continue;
        }
        all_violations.push(...scan_file(raw_path));
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
