#!/usr/bin/env tsx
/**
 * Input-side memory condensation — Phase 2 of step-16-telegraph-substance.
 *
 * TypeScript twin of `src/scripts/condense_memory.py` (ADR-096, Phase 7 /
 * dev-side memory). The public API and CLI contract mirror the Python
 * original EXACTLY — same exported names (snake_case kept deliberately),
 * same exit codes, stdout/stderr split, byte-identical messages, and
 * byte-identical generated output (backup + injected frontmatter +
 * condensed body). No behaviour changes — latent Python bugs are
 * replicated (e.g. the literal "decondenseed:" success line) and flagged
 * as divergence candidates, not fixed.
 *
 * Rewrites memory files (AGENTS.md, CLAUDE.md, .cursorrules, ...) to
 * telegraph grammar (drop articles / auxiliaries) while preserving
 * carve-outs byte-for-byte (code blocks, numbered-options, status markers,
 * Iron-Law ALL-CAPS, backtick spans). Writes `.original.md` backup before
 * mutating. Gated by Phase 0 `validate_safe_paths.assert_safe`. Idempotency
 * guard: `original_sha256:` + `condensed_at:` frontmatter refuse
 * re-condensation on body-hash drift.
 *
 * CLI: `condense_memory <path> [--check|--decondense]`. Stdlib-only.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { SensitivePathError, assert_safe } from './validate_safe_paths.js';

/** Raised when the target is already condensed and body hash diverged. */
export class CondensationRefused extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CondensationRefused';
    }
}

// Carve-out region patterns — mirrors telegraph-speak.md § Carve-outs (1–7).
const RE_FENCE = /^```/;
const RE_NUMBERED = /^>?\s*\d+\.\s/;
const RE_STATUS = /^\s*(?:❌|⚠️|✅)/;
const RE_IRONLAW = /^[A-Z][A-Z0-9 ,.\-_/']{3,}$/;
// Spans frozen byte-for-byte inside prose lines. Backtick spans first so a
// slash-bearing span inside backticks is captured whole; then any
// non-whitespace run containing `/` or `\`.
const RE_PRESERVE_SPAN = /`[^`\n]+`|\S*[/\\]\S*/g;
const RE_FRONTMATTER = /^---\s*$/;
const WORD_RE = /\b[A-Za-z]+\b/g;
const DROP_TOKENS: ReadonlySet<string> = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'that',
    'which',
]);

function _condense_words(text: string): string {
    let out = text.replace(WORD_RE, (m) => (DROP_TOKENS.has(m.toLowerCase()) ? '' : m));
    out = out.replace(/[ \t]{2,}/g, ' ');
    return out.replace(/ +([,.;:!?])/g, '$1');
}

/**
 * Condense a prose line; preserve backtick spans, URLs, link targets, and
 * slash-bearing paths byte-for-byte (see RE_PRESERVE_SPAN).
 */
function _condense_prose_line(line: string): string {
    const parts: string[] = [];
    let last = 0;
    RE_PRESERVE_SPAN.lastIndex = 0;
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = RE_PRESERVE_SPAN.exec(line)) !== null) {
        parts.push(_condense_words(line.slice(last, m.index)));
        parts.push(m[0]);
        last = m.index + m[0].length;
        // Guard against zero-length matches (RE_PRESERVE_SPAN can match "" via
        // the `\S*[/\\]\S*` branch only when a separator exists, but be safe).
        if (m[0].length === 0) {
            RE_PRESERVE_SPAN.lastIndex += 1;
        }
    }
    parts.push(_condense_words(line.slice(last)));
    return parts.join('');
}

/** Condense a memory-file body. Idempotent on already-telegraph text. */
export function condense_text(body: string): string {
    const out: string[] = [];
    let in_fence = false;
    for (const raw of _splitlinesKeepends(body)) {
        const stripped = raw.replace(/[\r\n]+$/, '');
        if (RE_FENCE.test(stripped)) {
            in_fence = !in_fence;
            out.push(raw);
            continue;
        }
        if (
            in_fence ||
            RE_NUMBERED.test(stripped) ||
            RE_STATUS.test(stripped) ||
            RE_IRONLAW.test(stripped.trim())
        ) {
            out.push(raw);
            continue;
        }
        out.push(_condense_prose_line(raw));
    }
    return out.join('');
}

/** Mirror str.splitlines(keepends=True). */
function _splitlinesKeepends(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines: string[] = [];
    let buf = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        buf += ch;
        if (ch === '\n') {
            lines.push(buf);
            buf = '';
        } else if (ch === '\r') {
            if (text[i + 1] === '\n') {
                buf += '\n';
                i += 1;
            }
            lines.push(buf);
            buf = '';
        }
    }
    if (buf !== '') {
        lines.push(buf);
    }
    return lines;
}

function _split_frontmatter(text: string): [string, string] {
    const lines = _splitlinesKeepends(text);
    if (lines.length === 0 || !RE_FRONTMATTER.test((lines[0] as string).replace(/\s+$/, ''))) {
        return ['', text];
    }
    for (let idx = 1; idx < lines.length; idx += 1) {
        if (RE_FRONTMATTER.test((lines[idx] as string).replace(/\s+$/, ''))) {
            return [lines.slice(0, idx + 1).join(''), lines.slice(idx + 1).join('')];
        }
    }
    return ['', text];
}

function _sha256(text: string): string {
    return crypto.createHash('sha256').update(Buffer.from(text, 'utf-8')).digest('hex');
}

function _has_sha_marker(fm: string): boolean {
    return /^original_sha256:\s*[0-9a-f]{64}\s*$/m.test(fm);
}

function _inject_frontmatter(fm: string, sha: string, ts: string): string {
    let inner = '';
    if (fm) {
        // Mirror: drop.sub("", fm.strip().strip("-").strip()).strip()
        const stripped = _pyStripDashes(fm.trim());
        inner = stripped.trim().replace(/^(original_sha256|condensed_at):.*$/gm, '').trim();
    }
    const body = inner + (inner ? '\n' : '');
    return `---\n${body}original_sha256: ${sha}\ncondensed_at: ${ts}\n---\n`;
}

/** Mirror Python str.strip("-") — strip leading/trailing dash chars. */
function _pyStripDashes(s: string): string {
    return s.replace(/^-+/, '').replace(/-+$/, '');
}

function _backup_path(target: string): string {
    return path.join(path.dirname(target), `${path.basename(target)}.original.md`);
}

/** Mirror datetime.now(utc).strftime("%Y-%m-%dT%H:%M:%SZ"). */
function _nowUtcZ(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
    const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mo}-${day}T${hh}:${mi}:${ss}Z`;
}

export function condense_file(target: string): string {
    assert_safe(target);
    const text = fs.readFileSync(target, 'utf-8');
    const [fm, body] = _split_frontmatter(text);
    if (_has_sha_marker(fm)) {
        if (_sha256(condense_text(body)) !== _sha256(body)) {
            throw new CondensationRefused(
                `${target}: body hash diverged; decondense first ` +
                    `(\`scripts/condense_memory.py ${target} --decondense\`).`,
            );
        }
        return target;
    }
    const backup = _backup_path(target);
    fs.writeFileSync(backup, text, 'utf-8');
    const ts = _nowUtcZ();
    fs.writeFileSync(target, _inject_frontmatter(fm, _sha256(body), ts) + condense_text(body), 'utf-8');
    return backup;
}

export function decondense_file(target: string): string {
    assert_safe(target);
    const backup = _backup_path(target);
    if (!_isFile(backup)) {
        // Mirror FileNotFoundError(f"no backup at {backup}").
        const err = new Error(`no backup at ${backup}`) as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        err.name = 'FileNotFoundError';
        throw err;
    }
    fs.writeFileSync(target, fs.readFileSync(backup, 'utf-8'), 'utf-8');
    fs.unlinkSync(backup);
    return target;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

const _PROG = 'condense_memory.py';
const _USAGE = 'usage: condense_memory.py [-h] [--check | --decondense] path\n';

/** Mirror argparse error: print usage + "<prog>: error: <msg>" to stderr, exit 2. */
function _argError(msg: string): never {
    process.stderr.write(_USAGE);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exit(2);
}

interface ParsedArgs {
    path: string;
    check: boolean;
    decondense: boolean;
}

function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = { path: '', check: false, decondense: false };
    const positionals: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--check') {
            if (args.decondense) {
                _argError('argument --check: not allowed with argument --decondense');
            }
            args.check = true;
        } else if (a === '--decondense') {
            if (args.check) {
                _argError('argument --decondense: not allowed with argument --check');
            }
            args.decondense = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(_USAGE);
            process.exit(0);
        } else if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        } else {
            positionals.push(a);
        }
    }
    if (positionals.length === 0) {
        _argError('the following arguments are required: path');
    }
    if (positionals.length > 1) {
        _argError(`unrecognized arguments: ${positionals.slice(1).join(' ')}`);
    }
    args.path = positionals[0] as string;
    return args;
}

export function _main(argv: string[]): number {
    const args = _parseArgs(argv);
    try {
        if (args.check) {
            assert_safe(args.path);
            return 0;
        }
        if (args.decondense) {
            decondense_file(args.path);
            // NOTE: replicates the Python typo "decondenseed:" verbatim
            // (divergence candidate — do not "fix" without an upstream change).
            process.stdout.write(`decondenseed: ${args.path}\n`);
            return 0;
        }
        const backup = condense_file(args.path);
        process.stdout.write(`condensed: ${args.path}  (backup: ${backup})\n`);
        return 0;
    } catch (exc) {
        if (exc instanceof SensitivePathError) {
            process.stderr.write(`error: refused: ${exc.message}\n`);
            return 2;
        }
        if (exc instanceof CondensationRefused) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 3;
        }
        if (exc instanceof Error && (exc as NodeJS.ErrnoException).code === 'ENOENT') {
            process.stderr.write(`error: ${exc.message}\n`);
            return 4;
        }
        throw exc;
    }
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(_main(process.argv.slice(2)));
}
