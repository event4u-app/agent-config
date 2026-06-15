#!/usr/bin/env tsx
/**
 * check_reply_consistency.ts — enforce user-interaction.md Iron Laws.
 *
 * TypeScript twin of `src/scripts/check_reply_consistency.py` (ADR-096,
 * Phase 4 / Wave 4c). CLI contract mirrored EXACTLY — `--stdin` /
 * `--file` / `--scan-dir` mutually-exclusive required group, `--strict`,
 * `-v`/`--verbose`, `--quiet`; exit codes (0 ok · 2 inline tag · 3 multi-rec ·
 * 4 rec-not-in-options · 5 options-without-rec strict · 6 scan-dir found ·
 * 9 usage error); byte-identical messages; stdout/stderr split.
 *
 * Single-Source Recommendation Line: a reply with numbered options must
 * have ONE bolded `Recommendation: N` / `Empfehlung: N` line, no inline
 * `(recommended)` / `(rec)` / `(empfohlen)` tag next to options, and the
 * recommended number must appear in the option block.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const QUIET = process.argv.slice(2).includes('--quiet');

const OPTION_LINE_RE = /^\s*>?\s*(\d+)\.\s+\S/;
// Python re.IGNORECASE on (?:Recommendation|Empfehlung)\s*:\s*(\d+)\b
const REC_LINE_RE = /(?:Recommendation|Empfehlung)\s*:\s*(\d+)\b/gi;
const TAG_RE = /\((?:recommended|rec|empfohlen)\)/i;
const CODESPAN_RE = /`[^`\n]*`/g;

function _strip_codespans(line: string): string {
    return line.replace(CODESPAN_RE, '``');
}

/** Mirror Python `str.splitlines()` — splits on \n / \r\n / \r, drops trailing. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/**
 * Return [line_no, raw_line] of the first numbered-option line carrying an
 * inline (recommended)-class tag outside code spans, or null.
 */
function find_inline_tag(text: string): [number, string] | null {
    const lines = _splitlines(text);
    for (let idx = 0; idx < lines.length; idx++) {
        const raw = lines[idx]!;
        const stripped = _strip_codespans(raw);
        if (!OPTION_LINE_RE.test(stripped)) {
            continue;
        }
        if (TAG_RE.test(stripped)) {
            return [idx + 1, raw.trim()];
        }
    }
    return null;
}

/**
 * Group consecutive numbered-option lines into blocks; return list of blocks,
 * each a list of the numbers found in that block.
 */
function find_option_blocks(text: string): number[][] {
    const blocks: number[][] = [];
    let current: number[] = [];
    for (const raw of _splitlines(text)) {
        const m = OPTION_LINE_RE.exec(raw);
        if (m) {
            current.push(parseInt(m[1]!, 10));
        } else {
            if (current.length >= 2) {
                blocks.push(current);
            }
            current = [];
        }
    }
    if (current.length >= 2) {
        blocks.push(current);
    }
    return blocks;
}

/** Run rules. Returns [exit_code, human_message]. */
function validate(text: string, strict = false): [number, string] {
    const tag = find_inline_tag(text);
    if (tag) {
        const [line_no, snippet] = tag;
        return [2, `line ${line_no}: inline tag on numbered option — ${_pyRepr(snippet)}`];
    }

    const blocks = find_option_blocks(text);
    const rec_numbers: number[] = [];
    REC_LINE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REC_LINE_RE.exec(text)) !== null) {
        rec_numbers.push(parseInt(m[1]!, 10));
    }

    if (blocks.length === 0) {
        return [0, 'ok (no numbered options block)'];
    }

    if (rec_numbers.length === 0) {
        if (strict) {
            return [5, 'numbered options without Recommendation:/Empfehlung: line'];
        }
        return [0, 'ok (options without recommendation; non-strict)'];
    }

    const distinct = [...new Set(rec_numbers)].sort((a, b) => a - b);
    if (distinct.length > 1) {
        return [3, `multiple distinct recommendation numbers: [${distinct.join(', ')}]`];
    }

    const rec_num = distinct[0]!;
    for (const block of blocks) {
        if (block.includes(rec_num)) {
            return [0, `ok (recommendation ${rec_num} matches option block)`];
        }
    }
    return [4, `recommendation ${rec_num} not present in any option block`];
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _rglobMdSorted(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(current, ent.name);
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            } else if (ent.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort();
    return out;
}

function _relToPosixOrAbs(child: string, root: string): string {
    const rel = path.relative(root, child);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return child.split(path.sep).join('/');
    }
    return rel.split(path.sep).join('/');
}

function cmd_scan_dir(root: string): number {
    // If the requested root is the legacy ".agent-src.uncondensed" and it no
    // longer exists (post-monorepo-move), fall back to artefact_roots().
    let roots: string[];
    if (!_isDir(root)) {
        const legacy = path.join(ROOT, '.agent-src.uncondensed');
        if (path.resolve(root) === path.resolve(legacy)) {
            roots = artefact_roots();
            if (roots.length === 0) {
                process.stderr.write('error: no artefact roots found (legacy or packages/*)\n');
                return 9;
            }
        } else {
            process.stderr.write(`error: not a directory: ${root}\n`);
            return 9;
        }
    } else {
        roots = [root];
    }
    const violations: Array<[string, number, string]> = [];
    for (const r of roots) {
        for (const md of _rglobMdSorted(r)) {
            const text = fs.readFileSync(md, 'utf-8');
            const lines = _splitlines(text);
            for (let idx = 0; idx < lines.length; idx++) {
                const raw = lines[idx]!;
                const stripped = _strip_codespans(raw);
                if (OPTION_LINE_RE.test(stripped) && TAG_RE.test(stripped)) {
                    violations.push([md, idx + 1, raw.trim()]);
                }
            }
        }
    }
    if (violations.length > 0) {
        for (const [p, line, snippet] of violations) {
            process.stderr.write(`  🔴 ${p}:${line} — inline-tag — ${snippet}\n`);
        }
        process.stderr.write(`\n❌  ${violations.length} legacy-pattern violation(s)\n`);
        return 6;
    }
    if (!QUIET) {
        const scanned = roots.map((r) => _relToPosixOrAbs(r, ROOT)).join(', ');
        process.stdout.write(`✅  No legacy (recommended) tags found under ${scanned}\n`);
    }
    return 0;
}

/** Python repr() of a single string. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + ch;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else out += ch;
    }
    return out + quote;
}

interface ParsedArgs {
    stdin: boolean;
    file: string | null;
    scan_dir: string | null;
    strict: boolean;
    verbose: boolean;
}

function _usage_error(message: string): never {
    // argparse prints usage to stderr then "<prog>: error: <message>" and exits 2.
    process.stderr.write(
        'usage: check_reply_consistency [-h] (--stdin | --file FILE | --scan-dir SCAN_DIR)\n' +
            '                              [--strict] [-v] [--quiet]\n',
    );
    process.stderr.write(`check_reply_consistency: error: ${message}\n`);
    process.exit(2);
}

function _readStdin(): string {
    try {
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let stdin = false;
    let file: string | null = null;
    let scan_dir: string | null = null;
    let strict = false;
    let verbose = false;
    const groupSeen: string[] = [];
    const need = (i: number, name: string): string => {
        const v = argv[i];
        if (v === undefined) {
            _usage_error(`argument ${name}: expected one argument`);
        }
        return v;
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--stdin') {
            stdin = true;
            groupSeen.push('--stdin');
        } else if (arg === '--file') {
            file = need(++i, '--file');
            groupSeen.push('--file');
        } else if (arg.startsWith('--file=')) {
            file = arg.slice('--file='.length);
            groupSeen.push('--file');
        } else if (arg === '--scan-dir') {
            scan_dir = need(++i, '--scan-dir');
            groupSeen.push('--scan-dir');
        } else if (arg.startsWith('--scan-dir=')) {
            scan_dir = arg.slice('--scan-dir='.length);
            groupSeen.push('--scan-dir');
        } else if (arg === '--strict') {
            strict = true;
        } else if (arg === '-v' || arg === '--verbose') {
            verbose = true;
        } else if (arg === '--quiet') {
            // handled via module-level QUIET; still a valid flag
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_reply_consistency [-h] (--stdin | --file FILE | --scan-dir SCAN_DIR)\n' +
                    '                              [--strict] [-v] [--quiet]\n',
            );
            process.exit(0);
        } else {
            _usage_error(`unrecognized arguments: ${arg}`);
        }
    }
    if (groupSeen.length === 0) {
        _usage_error('one of the arguments --stdin --file --scan-dir is required');
    }
    if (groupSeen.length > 1) {
        const first = groupSeen[0]!;
        const second = groupSeen[1]!;
        _usage_error(`argument ${second}: not allowed with argument ${first}`);
    }
    return { stdin, file, scan_dir, strict, verbose };
}

function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);

    if (args.scan_dir !== null) {
        return cmd_scan_dir(args.scan_dir);
    }

    const text = args.stdin ? _readStdin() : fs.readFileSync(args.file!, 'utf-8');
    const [code, msg] = validate(text, args.strict);
    if (code === 0) {
        if (args.verbose) {
            if (!QUIET) {
                process.stdout.write(`✅  ${msg}\n`);
            }
        }
        return 0;
    }
    process.stderr.write(`❌  [exit ${code}] ${msg}\n`);
    return code;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    ROOT,
    OPTION_LINE_RE,
    REC_LINE_RE,
    TAG_RE,
    find_inline_tag,
    find_option_blocks,
    validate,
    cmd_scan_dir,
    parse_args,
    main,
};
