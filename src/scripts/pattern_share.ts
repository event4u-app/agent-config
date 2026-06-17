#!/usr/bin/env tsx
/**
 * Maintainer dev script — export / import file-first patterns across projects.
 *
 * TypeScript twin of `src/scripts/pattern_share.py` (ADR-200). Mirrors the
 * Python CLI contract EXACTLY — the `export` / `import` subcommands, their
 * positional + flag args (`--out`, `--force`), exit codes (0 / 1 / 2),
 * stdout/stderr split, the byte-identical refusal/success lines (`❌  …` /
 * `✅  …`), the redaction summary string (`v.category: repr(v.snippet)`), and
 * the stdout passthrough of the pattern body on `export` with no `--out`. No
 * behaviour changes — the SAME `redact_low_impact_entry` primitive backs the
 * privacy floor, and `long_code_excerpt` is the one exempted category.
 *
 * NOT a user command. Patterns are reusable fix/refactor recipes under
 * `src/patterns/` (see `src/patterns/README.md` + `docs/decisions/ADR-099`).
 * This script moves a pattern between repos **through the same redactor** as
 * the `low-impact-corpus-privacy-floor` rule, so no secret / email / project
 * path / customer name / internal host / money / business-SQL / long-code
 * excerpt leaves the repo. It overlaps team-shared-memory only in governance
 * (redaction), not storage — patterns are recipes, not memory entries.
 *
 * Both gates redact:
 *   * `export` — refuse to emit a pattern that fails the floor.
 *   * `import` — refuse to ingest one that fails the floor (defense in depth).
 *
 * The redactor never auto-rewrites; it refuses and surfaces what to rephrase.
 *
 * Usage:
 *   python3 src/scripts/pattern_share.py export src/patterns/n-plus-one-eager-load.md
 *   python3 src/scripts/pattern_share.py export src/patterns/<slug>.md --out /tmp/share
 *   python3 src/scripts/pattern_share.py import /tmp/share/<slug>.md
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    redact_low_impact_entry,
    type RedactionViolation,
} from './ai_council/redact_low_impact_entry.js';

const _HERE = fileURLToPath(import.meta.url);
const _SCRIPTS = path.dirname(_HERE); // src/scripts
const _SRC = path.dirname(_SCRIPTS); // src

const REPO_ROOT = path.dirname(_SRC);
const PATTERNS_DIR = path.join(REPO_ROOT, 'src', 'patterns');
const _REQUIRED_FRONTMATTER = ['applies_to', 'reliability', 'last_verified'] as const;

// The low-impact-corpus redactor's `long_code_excerpt` class is a *corpus-bloat*
// control for prose decision entries — NOT a privacy control. Patterns are
// code recipes (Before/After), so long code is their essence, not a leak. We keep
// every PRIVACY class (secrets, emails, project paths, customer names, internal
// hosts, money, business-SQL) and exempt only `long_code_excerpt`.
const _EXEMPT_CATEGORIES: ReadonlySet<string> = new Set(['long_code_excerpt']);

/** Python `repr()` for a string snippet (mirrors `f"{v.snippet!r}"`). */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    body = body
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
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

/** Mirror Python `str.lstrip()` — strip leading ASCII + Unicode whitespace. */
function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}

/**
 * Run the privacy floor (minus the code-length bloat rule); return [ok, summary].
 */
export function _redact(text: string): [boolean, string] {
    const result = redact_low_impact_entry(text, { repoRoot: REPO_ROOT });
    const privacyViolations = result.violations.filter(
        (v: RedactionViolation) => !_EXEMPT_CATEGORIES.has(v.category),
    );
    if (privacyViolations.length === 0) {
        return [true, 'redaction: clean (code excerpts exempt — patterns are recipes)'];
    }
    const parts = privacyViolations.map((v) => `${v.category}: ${_pyRepr(v.snippet)}`);
    return [false, 'redaction REFUSED — ' + parts.join('; ')];
}

/** Cheap check that the pattern carries the required frontmatter keys. */
export function _validate_frontmatter(text: string): string[] {
    const missing: string[] = [];
    if (!_lstrip(text).startsWith('---')) {
        return ['no frontmatter block'];
    }
    // Python: head = text.split("---", 2); block = head[1] if len(head) >= 3 else ""
    const head = _splitMax(text, '---', 2);
    const block = head.length >= 3 ? (head[1] as string) : '';
    for (const key of _REQUIRED_FRONTMATTER) {
        if (!block.includes(`${key}:`)) {
            missing.push(key);
        }
    }
    return missing;
}

/** Mirror Python `str.split(sep, maxsplit)` — at most `maxsplit` splits. */
function _splitMax(s: string, sep: string, maxsplit: number): string[] {
    const out: string[] = [];
    let rest = s;
    let count = 0;
    while (count < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) {
            break;
        }
        out.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        count += 1;
    }
    out.push(rest);
    return out;
}

interface ExportArgs {
    pattern: string;
    out: string | null;
}

interface ImportArgs {
    file: string;
    force: boolean;
}

export function cmd_export(args: ExportArgs): number {
    const src = args.pattern;
    if (!_isFile(src)) {
        process.stderr.write(`❌  not a file: ${src}\n`);
        return 2;
    }
    const text = fs.readFileSync(src, 'utf-8');
    const [ok, summary] = _redact(text);
    if (!ok) {
        process.stderr.write(`❌  export refused — ${summary}\n`);
        process.stderr.write('    Rephrase the offending content and retry.\n');
        return 1;
    }
    if (args.out) {
        const outDir = args.out;
        fs.mkdirSync(outDir, { recursive: true });
        const dest = path.join(outDir, path.basename(src));
        fs.writeFileSync(dest, text, 'utf-8');
        process.stdout.write(`✅  exported (redaction clean) → ${dest}\n`);
    } else {
        process.stdout.write(text);
    }
    return 0;
}

export function cmd_import(args: ImportArgs): number {
    const src = args.file;
    if (!_isFile(src)) {
        process.stderr.write(`❌  not a file: ${src}\n`);
        return 2;
    }
    const text = fs.readFileSync(src, 'utf-8');
    const [ok, summary] = _redact(text);
    if (!ok) {
        process.stderr.write(`❌  import refused — ${summary}\n`);
        return 1;
    }
    const missing = _validate_frontmatter(text);
    if (missing.length > 0) {
        process.stderr.write(`❌  import refused — missing frontmatter: ${missing.join(', ')}\n`);
        return 1;
    }
    fs.mkdirSync(PATTERNS_DIR, { recursive: true });
    const dest = path.join(PATTERNS_DIR, path.basename(src));
    if (_exists(dest) && !args.force) {
        process.stderr.write(`❌  ${dest} exists — pass --force to overwrite\n`);
        return 1;
    }
    fs.writeFileSync(dest, text, 'utf-8');
    process.stdout.write(`✅  imported (redaction clean) → ${dest}\n`);
    return 0;
}

// --- argparse emulation ------------------------------------------------------
//
// Mirrors `argparse` with a single required subcommand (`export` / `import`),
// each with positional + flag args. The usage/error strings and exit code 2 on
// a parse error reproduce the argparse surface byte-for-byte (the `--help`
// prose itself is not part of the parity contract).

const _PROG = 'pattern_share.py';
const _TOP_USAGE = `usage: ${_PROG} [-h] {export,import} ...\n`;
const _EXPORT_USAGE = `usage: ${_PROG} export [-h] [--out OUT] pattern\n`;
const _IMPORT_USAGE = `usage: ${_PROG} import [-h] [--force] file\n`;

class _ArgExit extends Error {}

function _topError(msg: string): never {
    process.stderr.write(_TOP_USAGE);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

function _subError(usage: string, sub: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${_PROG} ${sub}: error: ${msg}\n`);
    process.exitCode = 2;
    throw new _ArgExit();
}

type Parsed =
    | { cmd: 'export'; args: ExportArgs }
    | { cmd: 'import'; args: ImportArgs };

/** `true` when a token looks like an optional flag (argparse `-`-prefixed). */
function _isFlag(a: string): boolean {
    return a.startsWith('-') && a !== '-';
}

// argparse precedence (verified against the Python original):
//   1. an optional that needs a value but is missing it → SUB-level error
//      "argument --out: expected one argument" (during consumption).
//   2. a missing required positional → SUB-level error
//      "the following arguments are required: <name>".
//   3. surplus positionals + unknown optionals → TOP-level error
//      "unrecognized arguments: <extras joined by a single space>".
// Extras keep their original argv order; (1)/(2) fire before (3).

function _parseExport(rest: string[]): Parsed {
    let pattern: string | null = null;
    let out: string | null = null;
    const extras: string[] = [];
    for (let i = 0; i < rest.length; i += 1) {
        const a = rest[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_EXPORT_USAGE);
            process.exitCode = 0;
            throw new _ArgExit();
        } else if (a === '--out') {
            const next = rest[i + 1];
            if (next === undefined) {
                _subError(_EXPORT_USAGE, 'export', 'argument --out: expected one argument');
            }
            out = next as string;
            i += 1;
        } else if (a.startsWith('--out=')) {
            out = a.slice('--out='.length);
        } else if (_isFlag(a)) {
            extras.push(a);
        } else if (pattern === null) {
            pattern = a;
        } else {
            extras.push(a);
        }
    }
    if (pattern === null) {
        _subError(_EXPORT_USAGE, 'export', 'the following arguments are required: pattern');
    }
    if (extras.length > 0) {
        _topError(`unrecognized arguments: ${extras.join(' ')}`);
    }
    return { cmd: 'export', args: { pattern: pattern as string, out } };
}

function _parseImport(rest: string[]): Parsed {
    let file: string | null = null;
    let force = false;
    const extras: string[] = [];
    for (let i = 0; i < rest.length; i += 1) {
        const a = rest[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_IMPORT_USAGE);
            process.exitCode = 0;
            throw new _ArgExit();
        } else if (a === '--force') {
            force = true;
        } else if (_isFlag(a)) {
            extras.push(a);
        } else if (file === null) {
            file = a;
        } else {
            extras.push(a);
        }
    }
    if (file === null) {
        _subError(_IMPORT_USAGE, 'import', 'the following arguments are required: file');
    }
    if (extras.length > 0) {
        _topError(`unrecognized arguments: ${extras.join(' ')}`);
    }
    return { cmd: 'import', args: { file: file as string, force } };
}

function parse_args(argv: string[]): Parsed {
    if (argv.length > 0 && (argv[0] === '-h' || argv[0] === '--help')) {
        process.stdout.write(_TOP_USAGE);
        process.exitCode = 0;
        throw new _ArgExit();
    }
    const cmd = argv[0];
    if (cmd === undefined) {
        // argparse: required subparser with no command → exit 2.
        _topError('the following arguments are required: cmd');
    }
    if (cmd === 'export') {
        return _parseExport(argv.slice(1));
    }
    if (cmd === 'import') {
        return _parseImport(argv.slice(1));
    }
    _topError(`argument cmd: invalid choice: '${cmd}' (choose from 'export', 'import')`);
}

export function main(argv: string[] | null = null): number {
    let parsed: Parsed;
    try {
        parsed = parse_args(argv ?? process.argv.slice(2));
    } catch (e) {
        if (e instanceof _ArgExit) {
            return process.exitCode === undefined ? 0 : (process.exitCode as number);
        }
        throw e;
    }
    if (parsed.cmd === 'export') {
        return cmd_export(parsed.args);
    }
    return cmd_import(parsed.args);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
