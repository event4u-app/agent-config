#!/usr/bin/env tsx
/**
 * check_reply_consistency.ts — enforce user-interaction.md Iron Laws.
 *
 * Full rewrite (council 2026-08, "fix/extraction-threshold-consistency"):
 * the previous version was a 1:1 port of a retired Python prototype whose
 * lax-by-default, whole-reply semantics contradicted the spec it cites
 * (`src/rules/user-interaction.md` Iron Law 1 +
 * `src/agent-src/contexts/communication/rules-auto/user-interaction-mechanics.md`
 * § Pre-send self-check).
 *
 * Semantics (strict is the DEFAULT — the documented invocation
 * `./scripts-run src/scripts/check_reply_consistency --stdin < draft.md`
 * IS the strict behavior; there is no --strict/--lax flag):
 *
 * 1. Per-block validation. EVERY numbered-options block (>= 2 consecutive
 *    numbered lines, optionally blockquoted) must carry exactly ONE
 *    `Recommendation:`/`Empfehlung:` line DIRECTLY under it — within the
 *    trailing 2 non-blank lines after the block, before any new heading or
 *    new options block.
 * 2. Multi-block replies: each block gets its own recommendation line. Two
 *    blocks with two (different) recommendation numbers is VALID (mechanics
 *    § self-check rule 5); a block without one is a finding.
 * 3. The recommendation number must be within its block's option range.
 * 4. No inline `(recommended)` / `(rec)` / `(empfohlen)` tag on an option
 *    line (Iron Law 1 — the option block stays neutral).
 *
 * Known limit — wrong-language label: Iron Law 1 says a wrong-language label
 * (`Recommendation:` for a German user, or vice versa) counts as NO
 * recommendation, but this script cannot know the user's language from the
 * draft alone. Both `Recommendation:` and `Empfehlung:` are therefore
 * accepted in either context; the language match stays a model-side check.
 *
 * `--scan-dir` keeps the legacy-pattern sweep over `.md` trees (inline
 * `(recommended)` tags only — docs legitimately contain numbered lists
 * without recommendation lines, so per-block validation does not apply
 * there).
 *
 * Exit: 0 clean · 1 usage/IO error · 2 findings (consistent with sibling
 * lints, e.g. lint_abstraction_thresholds).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const QUIET = process.argv.slice(2).includes('--quiet');

export const OPTION_LINE_RE = /^\s*>?\s*(\d+)\.\s+\S/;
export const REC_LINE_RE = /(?:Recommendation|Empfehlung)\s*:\s*(\d+)\b/i;
export const TAG_RE = /\((?:recommended|rec|empfohlen)\)/i;
const CODESPAN_RE = /`[^`\n]*`/g;
const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^\s*(```|~~~)/;

/** How many non-blank lines after a block may separate it from its recommendation line. */
export const REC_ADJACENCY_WINDOW = 2;

export interface OptionBlock {
    /** 1-based line of the first option line. */
    startLine: number;
    /** 1-based line of the last option line. */
    endLine: number;
    /** Option numbers in order of appearance. */
    numbers: number[];
}

export interface Finding {
    /** 1-based line the finding anchors to. */
    line: number;
    message: string;
}

function _strip_codespans(line: string): string {
    return line.replace(CODESPAN_RE, '``');
}

/** Split on \n / \r\n / \r, dropping a single trailing empty element. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/**
 * Lines with fenced code blocks blanked out — an example options block quoted
 * inside ``` / ~~~ is illustration, not a live options block.
 */
export function mask_fences(lines: readonly string[]): string[] {
    const out: string[] = [];
    let fence: string | null = null;
    for (const raw of lines) {
        const m = FENCE_RE.exec(raw);
        if (m) {
            const marker = m[1]!;
            if (fence === null) {
                fence = marker;
            } else if (fence === marker) {
                fence = null;
            }
            out.push('');
            continue;
        }
        out.push(fence === null ? raw : '');
    }
    return out;
}

/** Consecutive numbered-option lines (>= 2) grouped into blocks. */
export function find_option_blocks(text: string): OptionBlock[] {
    const lines = mask_fences(_splitlines(text));
    const blocks: OptionBlock[] = [];
    let current: OptionBlock | null = null;
    for (let idx = 0; idx < lines.length; idx++) {
        const m = OPTION_LINE_RE.exec(lines[idx]!);
        if (m) {
            const num = parseInt(m[1]!, 10);
            if (current === null) {
                current = { startLine: idx + 1, endLine: idx + 1, numbers: [num] };
            } else {
                current.endLine = idx + 1;
                current.numbers.push(num);
            }
        } else {
            if (current !== null && current.numbers.length >= 2) {
                blocks.push(current);
            }
            current = null;
        }
    }
    if (current !== null && current.numbers.length >= 2) {
        blocks.push(current);
    }
    return blocks;
}

/**
 * Core check — the exported function tests drive. Returns all findings for
 * one reply draft; empty array = the draft is consistent.
 */
export function check_reply(text: string): Finding[] {
    const rawLines = _splitlines(text);
    const lines = mask_fences(rawLines);
    const findings: Finding[] = [];

    // Iron Law 1 — no inline tag on an option line (codespans exempt).
    for (let idx = 0; idx < lines.length; idx++) {
        const stripped = _strip_codespans(lines[idx]!);
        if (OPTION_LINE_RE.test(stripped) && TAG_RE.test(stripped)) {
            findings.push({
                line: idx + 1,
                message: `inline tag on numbered option — ${rawLines[idx]!.trim()}`,
            });
        }
    }

    // Per-block: exactly one adjacent recommendation line, number in range.
    const blocks = find_option_blocks(text);
    for (const block of blocks) {
        const recs: Array<{ line: number; num: number }> = [];
        let inspected = 0;
        for (let idx = block.endLine; idx < lines.length && inspected < REC_ADJACENCY_WINDOW; idx++) {
            const line = lines[idx]!;
            if (line.trim() === '') {
                continue; // blank lines do not consume the adjacency window
            }
            if (HEADING_RE.test(line) || OPTION_LINE_RE.test(line)) {
                break; // a new heading or a new options block ends this block's window
            }
            inspected += 1;
            const m = REC_LINE_RE.exec(line);
            if (m) {
                recs.push({ line: idx + 1, num: parseInt(m[1]!, 10) });
            }
        }
        if (recs.length === 0) {
            findings.push({
                line: block.startLine,
                message:
                    'numbered options block without a Recommendation:/Empfehlung: line directly under it',
            });
            continue;
        }
        if (recs.length > 1) {
            findings.push({
                line: recs[1]!.line,
                message: `multiple recommendation lines under one options block: [${recs.map((r) => r.num).join(', ')}]`,
            });
            continue;
        }
        const rec = recs[0]!;
        if (!block.numbers.includes(rec.num)) {
            findings.push({
                line: rec.line,
                message: `recommendation ${String(rec.num)} not present in the options block above it (options: [${block.numbers.join(', ')}])`,
            });
        }
    }

    findings.sort((a, b) => a.line - b.line);
    return findings;
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

/** Legacy-pattern sweep: inline (recommended)-class tags in `.md` trees. */
export function cmd_scan_dir(root: string): number {
    // If the requested root is the legacy ".agent-src.uncondensed" and it no
    // longer exists (post-monorepo-move), fall back to artefact_roots().
    let roots: string[];
    if (!_isDir(root)) {
        const legacy = path.join(ROOT, '.agent-src.uncondensed');
        if (path.resolve(root) === path.resolve(legacy)) {
            roots = artefact_roots();
            if (roots.length === 0) {
                process.stderr.write('error: no artefact roots found (legacy or packages/*)\n');
                return 1;
            }
        } else {
            process.stderr.write(`error: not a directory: ${root}\n`);
            return 1;
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
            process.stderr.write(`  🔴 ${p}:${String(line)} — inline-tag — ${snippet}\n`);
        }
        process.stderr.write(`\n❌  ${String(violations.length)} legacy-pattern violation(s)\n`);
        return 2;
    }
    if (!QUIET) {
        const scanned = roots.map((r) => _relToPosixOrAbs(r, ROOT)).join(', ');
        process.stdout.write(`✅  No legacy (recommended) tags found under ${scanned}\n`);
    }
    return 0;
}

interface ParsedArgs {
    stdin: boolean;
    file: string | null;
    scan_dir: string | null;
    verbose: boolean;
}

const USAGE =
    'usage: check_reply_consistency [-h] (--stdin | --file FILE | --scan-dir SCAN_DIR)\n' +
    '                              [-v] [--quiet]\n';

function _usage_error(message: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`check_reply_consistency: error: ${message}\n`);
    process.exit(1);
}

function _readStdin(): string {
    try {
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

export function parse_args(argv: readonly string[]): ParsedArgs {
    let stdin = false;
    let file: string | null = null;
    let scan_dir: string | null = null;
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
        } else if (arg === '-v' || arg === '--verbose') {
            verbose = true;
        } else if (arg === '--quiet') {
            // handled via module-level QUIET; still a valid flag
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(USAGE);
            process.exit(0);
        } else {
            _usage_error(`unrecognized arguments: ${arg}`);
        }
    }
    if (groupSeen.length === 0) {
        _usage_error('one of the arguments --stdin --file --scan-dir is required');
    }
    if (groupSeen.length > 1) {
        _usage_error(`argument ${groupSeen[1]!}: not allowed with argument ${groupSeen[0]!}`);
    }
    return { stdin, file, scan_dir, verbose };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);

    if (args.scan_dir !== null) {
        return cmd_scan_dir(args.scan_dir);
    }

    let text: string;
    try {
        text = args.stdin ? _readStdin() : fs.readFileSync(args.file!, 'utf-8');
    } catch (e) {
        process.stderr.write(`error: ${String(e)}\n`);
        return 1;
    }

    const findings = check_reply(text);
    if (findings.length === 0) {
        if (args.verbose && !QUIET) {
            process.stdout.write('✅  reply consistent (every options block carries one adjacent recommendation)\n');
        }
        return 0;
    }
    for (const f of findings) {
        process.stderr.write(`❌  line ${String(f.line)}: ${f.message}\n`);
    }
    return 2;
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
    // symlink path. Compare realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT };
