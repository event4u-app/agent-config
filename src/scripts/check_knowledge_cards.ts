#!/usr/bin/env tsx
/**
 * Pointer-CI + size + multi-evidence-consistency gate for committed knowledge cards.
 *
 * TypeScript twin of `src/scripts/check_knowledge_cards.py` (ADR-200). The
 * CLI contract mirrors the Python original EXACTLY — same flags (`--dir`,
 * `--strict`, `--check-urls`, `--freshness-days`), same exit codes
 * (0 / 1 / 3), same stdout/stderr split, byte-identical finding strings,
 * the same `sorted(glob("*.md"))` ordering, the same frontmatter parsing,
 * and the same git-ancestry / observed_at-span / URL-HEAD checks. No
 * behaviour changes — latent bugs are replicated and flagged in the
 * porting report, not fixed.
 *
 * Committed cards live at agents/knowledge/<source>.md (one file per source).
 * README.md in that directory is skipped.
 *
 * Checks enforced:
 *   C1  Size ≤ 150 lines.
 *   C2  Mandatory authoritative pointer (frontmatter links.authoritative).
 *   C3  Pointer resolution (local path exists; URL well-formed; --check-urls for live check).
 *   C4  Trust tagging (frontmatter trust field present; type must be anti-hallucination).
 *   C5  Multi-evidence git-ancestry consistency (distinct source_version values; if git
 *       refs/SHAs, verifies ancestry chain; flags observed_at spanning > 7 days).
 *   C6  Strict mode (--strict): for positive-structure lines with source=<path:line>,
 *       verifies file exists and is non-empty via HEAD or disk.
 *
 * Exit codes: 0 = clean, 1 = violations, 3 = internal error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Global-store helpers (ADR-100). The Python original imports these lazily and
// tolerantly (try/except → None) so the project-local linter still runs if the
// _lib package layout shifts; the TS twins always exist, so a static import is
// byte-faithful for behaviour (the only observable effect is the --global path).
import * as _kg from './_lib/knowledge_global.js';
import * as _kgr from './_lib/knowledge_global_redaction.js';

// ROOT = Path(__file__).resolve().parent.parent.parent — src/scripts/ → repo root.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// First line of the module docstring — argparse `description`.
const DESCRIPTION = 'Pointer-CI + size + multi-evidence-consistency gate for committed knowledge cards.';
// argparse derives `prog` from sys.argv[0] basename → `check_knowledge_cards.py`.
const PROG = 'check_knowledge_cards.py';

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
const SOURCE_VERSION_RE = /source_version:\s*"?([^\s",]+)/g;
const OBSERVED_AT_RE = /observed_at:\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})/g;
const SOURCE_LINE_RE = /source=([^:\s]+):(\d+)/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;

// ---------------------------------------------------------------------------
// Tiny frontmatter parser (no pyyaml required — cards use simple scalar fields)
// ---------------------------------------------------------------------------

/** Extract YAML-like frontmatter as a flat dict (scalar values only). */
function _parse_frontmatter(text: string): Record<string, string> {
    const m = FRONTMATTER_RE.exec(text);
    if (!m) {
        return {};
    }
    const out: Record<string, string> = {};
    for (const line of _splitlines(m[1] as string)) {
        if (!line.includes(':') || line.startsWith('#')) {
            continue;
        }
        const idx = line.indexOf(':');
        let key = line.slice(0, idx);
        let val = line.slice(idx + 1);
        key = _lstrip(key.trim(), '-').trim();
        val = _strip(_strip(val.trim(), '"'), "'");
        if (key) {
            out[key] = val;
        }
    }
    return out;
}

/** Walk a dotted key path through the raw frontmatter block (leaf key match). */
function _frontmatter_get(text: string, ...keys: string[]): string {
    const m = FRONTMATTER_RE.exec(text);
    if (!m) {
        return '';
    }
    const block = m[1] as string;
    const leaf = keys[keys.length - 1] as string;
    for (const line of _splitlines(block)) {
        const stripped = line.trim();
        if (stripped.startsWith(`${leaf}:`)) {
            let val = stripped.slice(leaf.length + 1).trim();
            val = _strip(_strip(val, '"'), "'");
            return val;
        }
    }
    return '';
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/**
 * Global-store-only checks (ADR-100): tier validity, provenance footer,
 * and a redaction-clean assertion (the secret/PII patterns must have been
 * halted/cleaned before the card was written — never present in a global card).
 */
function _check_global_card(rel: string, text: string, fm: Record<string, string>): string[] {
    const errors: string[] = [];
    const valid_tiers = _kg !== null ? _kg.TIERS : ['public', 'vendor', 'proprietary'];

    // G1 — tier present and valid
    const tier = (fm['tier'] ?? '').trim();
    if (!tier) {
        errors.push(`${rel}:0 — G1: global card missing 'tier' in frontmatter`);
    } else if (!valid_tiers.includes(tier)) {
        errors.push(`${rel}:0 — G1: tier '${tier}' not in ${_pyReprList(_sorted(valid_tiers))}`);
    }

    // G2 — provenance footer present with all fields
    if (_kg !== null) {
        const prov = _kg.parse_provenance_footer(text);
        if (!_pyTruthyObj(prov)) {
            errors.push(`${rel}:0 — G2: missing provenance footer (audit trail)`);
        } else {
            for (const field of ['first_seen', 'promoted_at', 'last_verified', 'tier', 'seen_in']) {
                if (!prov[field]) {
                    errors.push(`${rel}:0 — G2: provenance footer missing '${field}'`);
                }
            }
        }
    }

    // G3 — redaction must have fired: a global card MUST be clean of confidential
    // patterns (secrets, emails, internal hostnames, external-source names, …).
    // A vendor card carrying a secret means redaction did not halt → hard fail.
    if (_kgr !== null) {
        for (const v of _kgr.redaction_scan(text)) {
            errors.push(
                `${rel}:0 — G3: confidential pattern in global card ` +
                    `(${v.category}: ${_pyRepr(v.snippet)}) — redaction must have fired before sharing`,
            );
        }
    }
    return errors;
}

function _check_card(
    p: string,
    strict: boolean,
    check_urls: boolean,
    global_mode = false,
): string[] {
    const errors: string[] = [];
    let rel: string;
    if (_isRelativeTo(p, ROOT)) {
        rel = _relTo(ROOT, p);
    } else {
        rel = p;
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch (exc) {
        return [`${rel}:0 — cannot read file: ${_osErrorStr(exc, p)}`];
    }

    const lines = _splitlines(text);

    // C1 — size
    if (lines.length > 150) {
        errors.push(`${rel}:${lines.length} — C1: card exceeds 150 lines (${lines.length})`);
    }

    const fm = _parse_frontmatter(text);

    // C4 — trust tagging
    if (!fm['trust']) {
        errors.push(`${rel}:0 — C4: missing 'trust' field in frontmatter`);
    }
    const card_type = fm['type'] ?? '';
    if (card_type && card_type !== 'anti-hallucination') {
        errors.push(`${rel}:0 — C4: type must be 'anti-hallucination', got '${card_type}'`);
    }
    if (!card_type) {
        errors.push(`${rel}:0 — C4: missing 'type' field in frontmatter`);
    }

    // C2 — authoritative pointer
    const pointer = _frontmatter_get(text, 'links', 'authoritative');
    if (!pointer) {
        errors.push(`${rel}:0 — C2: missing links.authoritative pointer in frontmatter`);
    } else {
        // C3 — pointer resolution
        if (pointer.startsWith('http://') || pointer.startsWith('https://')) {
            if (check_urls) {
                const res = _headStatus(pointer);
                if (res.ok) {
                    if (res.status >= 400) {
                        errors.push(`${rel}:0 — C3: URL returned ${res.status}: ${pointer}`);
                    }
                } else {
                    errors.push(`${rel}:0 — C3: URL unreachable (${res.error}): ${pointer}`);
                }
            }
        } else {
            // local path
            const local = path.isAbsolute(pointer) ? pointer : path.join(ROOT, pointer);
            if (!fs.existsSync(local)) {
                errors.push(`${rel}:0 — C3: local pointer not found: ${pointer}`);
            }
        }
    }

    // C5 — multi-evidence consistency
    const versions = _findall1(SOURCE_VERSION_RE, text);
    const dates_str = _findall1(OBSERVED_AT_RE, text);
    const distinct_versions = _dedupPreserveOrder(versions); // dict.fromkeys
    if (distinct_versions.length > 1) {
        // Check ancestry if they look like git SHAs
        if (distinct_versions.every((v) => SHA_RE.test(v))) {
            for (let idx = 0; idx < distinct_versions.length - 1; idx += 1) {
                const a = distinct_versions[idx] as string;
                const b = distinct_versions[idx + 1] as string;
                try {
                    const result = _git(['git', 'merge-base', '--is-ancestor', a, b]);
                    if (result.code !== 0) {
                        const result2 = _git(['git', 'merge-base', '--is-ancestor', b, a]);
                        if (result2.code !== 0) {
                            errors.push(
                                `${rel}:0 — C5: source_versions '${a}' and '${b}' ` +
                                    'are not in a linear ancestry chain (Frankenstein card)',
                            );
                        }
                    }
                } catch {
                    // git unavailable — skip ancestry check
                }
            }
        }
    }

    if (dates_str.length >= 2) {
        const parsed = _parseDatesStrict(dates_str);
        if (parsed !== null) {
            const span_days = _maxMinSpanDays(parsed);
            if (span_days > 7) {
                errors.push(
                    `${rel}:0 — C5: observed_at timestamps span ${span_days} days ` +
                        '(> 7 day threshold — possible Frankenstein card)',
                );
            }
        }
    }

    // C6 — strict mode: verify source=<path:line> references exist
    if (strict) {
        lines.forEach((line, n0) => {
            const n = n0 + 1;
            const m = SOURCE_LINE_RE.exec(line);
            if (!m) {
                return;
            }
            const src_path = path.join(ROOT, m[1] as string);
            if (!fs.existsSync(src_path) || _fileSize(src_path) === 0) {
                errors.push(`${rel}:${n} — C6: source path not found or empty: ${m[1]}`);
            }
        });
    }

    // Global-store-only checks (ADR-100).
    if (global_mode) {
        errors.push(..._check_global_card(rel, text, fm));
    }

    return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Honest freshness signal (NOT a failure). A card whose newest observed_at
 * is older than `days` is 'lead-only': negative facts + pointers stay usable,
 * positive structure must be re-confirmed. No content_hash theater.
 */
function _freshness_warnings(p: string, days: number): string[] {
    if (days <= 0) {
        return [];
    }
    const text = _readTextReplace(p);
    const dates = _findall1(OBSERVED_AT_RE, text);
    if (dates.length === 0) {
        return [];
    }
    const parsed = _parseDatesStrict(dates);
    if (parsed === null) {
        return [];
    }
    const newest = _maxDate(parsed);
    const today = _todayUtcDate();
    const age = _dateDiffDays(today, newest);
    if (age > days) {
        // Faithful replication of the Python original (ADR-200): it calls
        // `path.relative_to(ROOT)` when the card path is absolute. pathlib
        // raises ValueError (uncaught → process dies, exit 1) when the path is
        // NOT under ROOT — the documented latent crash for an absolute `--dir`
        // outside the repo. Replicated, not fixed.
        const rel = path.isAbsolute(p) ? _relativeToStrict(ROOT, p) : p;
        return [
            `⚠️  ${rel}: lead-only — newest observed_at is ${age}d old (>${days}d); ` +
                're-confirm positive structure before use (negative facts + pointers still valid).',
        ];
    }
    return [];
}

interface ParsedArgs {
    dir: string;
    strict: boolean;
    check_urls: boolean;
    freshness_days: number;
    global_mode: boolean;
}

function main(): number {
    const args = _parseArgs(process.argv.slice(2));

    const global_mode = args.global_mode;
    // In --global mode, default the dir to the global store unless the caller
    // overrode --dir explicitly.
    let card_dir = args.dir;
    if (global_mode && card_dir === path.join(ROOT, 'agents', 'knowledge') && _kg !== null) {
        card_dir = _kg.global_store_dir();
    }
    if (!fs.existsSync(card_dir)) {
        process.stdout.write(`No cards directory found at ${card_dir} — nothing to check.\n`);
        return 0;
    }

    const cards = _sortedGlobMd(card_dir).filter((p) => path.basename(p).toLowerCase() !== 'readme.md');
    if (cards.length === 0) {
        process.stdout.write('No knowledge cards found — nothing to check.\n');
        return 0;
    }

    const all_errors: string[] = [];
    const all_warnings: string[] = [];
    for (const card of cards) {
        all_errors.push(..._check_card(card, args.strict, args.check_urls, global_mode));
        all_warnings.push(..._freshness_warnings(card, args.freshness_days));
    }

    for (const warn of all_warnings) {
        process.stdout.write(`${warn}\n`);
    }

    if (all_errors.length === 0) {
        process.stdout.write(`✅  ${cards.length} knowledge card(s) passed all checks.\n`);
        return 0;
    }

    for (const err of all_errors) {
        process.stdout.write(`${err}\n`);
    }
    process.stdout.write(`\n${all_errors.length} violation(s) across ${cards.length} card(s).\n`);
    return 1;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PyDate {
    year: number;
    month: number;
    day: number;
}

/** Mirror datetime.strptime(d, "%Y-%m-%d") for the YYYY-MM-DD findall hits. */
function _parseDatesStrict(dates: string[]): PyDate[] | null {
    const out: PyDate[] = [];
    for (const d of dates) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
        if (!m) {
            return null; // mirror ValueError → caller treats as no parse
        }
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        // strptime validates the calendar date; replicate (raises ValueError → null).
        if (!_validCalendarDate(year, month, day)) {
            return null;
        }
        out.push({ year, month, day });
    }
    return out;
}

function _validCalendarDate(y: number, mo: number, d: number): boolean {
    if (mo < 1 || mo > 12 || d < 1) {
        return false;
    }
    const dim = [31, _isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= (dim[mo - 1] as number);
}

function _isLeap(y: number): boolean {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function _toEpochDay(d: PyDate): number {
    return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 86_400_000);
}

function _maxMinSpanDays(parsed: PyDate[]): number {
    let max = parsed[0] as PyDate;
    let min = parsed[0] as PyDate;
    for (const d of parsed) {
        if (_toEpochDay(d) > _toEpochDay(max)) {
            max = d;
        }
        if (_toEpochDay(d) < _toEpochDay(min)) {
            min = d;
        }
    }
    return _toEpochDay(max) - _toEpochDay(min);
}

function _maxDate(parsed: PyDate[]): PyDate {
    let max = parsed[0] as PyDate;
    for (const d of parsed) {
        if (_toEpochDay(d) > _toEpochDay(max)) {
            max = d;
        }
    }
    return max;
}

function _todayUtcDate(): PyDate {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
}

/** Days between two PyDate values, mirroring (today - newest).days. */
function _dateDiffDays(a: PyDate, b: PyDate): number {
    return _toEpochDay(a) - _toEpochDay(b);
}

interface GitResult {
    code: number;
}

function _git(cmd: string[]): GitResult {
    const result = spawnSync(cmd[0] as string, cmd.slice(1), {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
    });
    if (result.error) {
        throw result.error; // ENOENT etc. → caller's catch skips the check
    }
    return { code: result.status ?? 1 };
}

interface HeadResult {
    ok: boolean;
    status: number;
    error: string;
}

/** Live HTTP HEAD with a 5s timeout, mirroring urllib.request HEAD. */
function _headStatus(url: string): HeadResult {
    const buf = spawnSync(
        process.execPath,
        ['-e', _HEAD_PROBE, url],
        { encoding: 'utf-8', timeout: 15000 },
    );
    const out = (buf.stdout || '').trim();
    if (out.startsWith('OK ')) {
        return { ok: true, status: parseInt(out.slice(3), 10), error: '' };
    }
    if (out.startsWith('ERR ')) {
        return { ok: false, status: 0, error: out.slice(4) };
    }
    return { ok: false, status: 0, error: 'unknown error' };
}

// Inline child probe so the network call has a hard 5s budget like the
// Python urlopen(timeout=5). Prints "OK <status>" or "ERR <message>".
const _HEAD_PROBE = `
const u = process.argv[1];
const lib = u.startsWith('https://') ? require('node:https') : require('node:http');
const req = lib.request(u, { method: 'HEAD', timeout: 5000 }, (res) => {
  process.stdout.write('OK ' + res.statusCode);
  res.resume();
  process.exit(0);
});
req.on('timeout', () => { req.destroy(new Error('timed out')); });
req.on('error', (e) => { process.stdout.write('ERR ' + e.message); process.exit(0); });
req.end();
`;

void http;
void https;

/** Mirror re.findall with a single capture group — list of group(1). */
function _findall1(re: RegExp, text: string): string[] {
    const out: string[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push(m[1] as string);
        if (m.index === re.lastIndex) {
            re.lastIndex += 1;
        }
    }
    return out;
}

/** Mirror list(dict.fromkeys(seq)) — dedup preserving first-seen order. */
function _dedupPreserveOrder(seq: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of seq) {
        if (!seen.has(v)) {
            seen.add(v);
            out.push(v);
        }
    }
    return out;
}

/** Mirror str.splitlines(): split on \n, \r, \r\n; drop a single trailing terminator. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

/** Mirror str.strip(chars) for a single char class (both ends). */
function _strip(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) {
        start += 1;
    }
    while (end > start && s[end - 1] === ch) {
        end -= 1;
    }
    return s.slice(start, end);
}

/** Mirror str.lstrip(chars) for a single char class (left only). */
function _lstrip(s: string, ch: string): string {
    let start = 0;
    while (start < s.length && s[start] === ch) {
        start += 1;
    }
    return s.slice(start);
}

function _isRelativeTo(p: string, base: string): boolean {
    const rel = path.relative(base, p);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function _relTo(base: string, p: string): string {
    const rel = path.relative(base, p);
    return rel.split(path.sep).join('/');
}

/**
 * Mirror pathlib `Path.relative_to(base)`: returns the POSIX-style relative
 * path, but throws (like Python's `ValueError`) when `p` is not under `base` —
 * the documented latent-crash path of `_freshness_warnings`.
 */
function _relativeToStrict(base: string, p: string): string {
    if (!_isRelativeTo(p, base)) {
        throw new Error(`'${p}' is not in the subpath of '${base}' OR one path is relative and the other is absolute.`);
    }
    return _relTo(base, p);
}

function _readTextReplace(p: string): string {
    // Python read_text(errors="replace") — Node 'utf-8' already substitutes
    // U+FFFD for invalid sequences, matching the replace behaviour.
    return fs.readFileSync(p, 'utf-8');
}

function _fileSize(p: string): number {
    try {
        return fs.statSync(p).size;
    } catch {
        return 0;
    }
}

function _osErrorStr(exc: unknown, p: string): string {
    // Mirror Python's str(OSError) shape: "[Errno N] msg: 'path'".
    const e = exc as NodeJS.ErrnoException;
    const errno = typeof e.errno === 'number' ? Math.abs(e.errno) : '';
    const code = e.code ? _strerror(e.code) : e.message;
    return `[Errno ${errno}] ${code}: '${p}'`;
}

function _strerror(code: string): string {
    const map: Record<string, string> = {
        ENOENT: 'No such file or directory',
        EACCES: 'Permission denied',
        EISDIR: 'Is a directory',
    };
    return map[code] ?? code;
}

/** Mirror sorted(card_dir.glob("*.md")) — top-level *.md, sorted by Path string. */
function _sortedGlobMd(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const ent of entries) {
        if (ent.name.endsWith('.md') && (ent.isFile() || ent.isSymbolicLink())) {
            out.push(path.join(dir, ent.name));
        }
    }
    // pathlib sorts by the Path object → component-wise; for a single directory
    // this is a plain lexicographic sort of the joined path strings.
    out.sort();
    return out;
}

/** Python sorted() over a string sequence — lexicographic by code point. */
function _sorted(xs: readonly string[]): string[] {
    return [...xs].sort();
}

/** Python repr() for a string (single-quoted preference). */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === quote || ch === '\\') {
            out += `\\${ch}`;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else {
            out += ch;
        }
    }
    return out + quote;
}

/** Python repr() of a list[str] → `['a', 'b']`. */
function _pyReprList(xs: readonly string[]): string {
    return `[${xs.map((x) => _pyRepr(x)).join(', ')}]`;
}

/** Python truthiness for a parsed dict — empty dict is falsy. */
function _pyTruthyObj(obj: Record<string, string>): boolean {
    return Object.keys(obj).length > 0;
}

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = {
        dir: path.join(ROOT, 'agents', 'knowledge'),
        strict: false,
        check_urls: false,
        freshness_days: 0,
        global_mode: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--dir') {
            args.dir = _expect(argv[++i], '--dir');
        } else if (a.startsWith('--dir=')) {
            args.dir = a.slice('--dir='.length);
        } else if (a === '--strict') {
            args.strict = true;
        } else if (a === '--check-urls') {
            args.check_urls = true;
        } else if (a === '--freshness-days') {
            args.freshness_days = _parseInt(_expect(argv[++i], '--freshness-days'), '--freshness-days');
        } else if (a.startsWith('--freshness-days=')) {
            args.freshness_days = _parseInt(a.slice('--freshness-days='.length), '--freshness-days');
        } else if (a === '--global') {
            args.global_mode = true;
        } else if (a === '-h' || a === '--help') {
            _printHelp();
            process.exit(0);
        } else {
            _topError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

function _expect(v: string | undefined, flag: string): string {
    if (v === undefined) {
        _topError(`argument ${flag}: expected one argument`);
    }
    return v;
}

function _parseInt(v: string, flag: string): number {
    // argparse type=int: reject non-integer with exit 2.
    if (!/^[+-]?\d+$/.test(v)) {
        _topError(`argument ${flag}: invalid int value: '${v}'`);
    }
    return parseInt(v, 10);
}

const TOP_USAGE =
    `usage: ${PROG} [-h] [--dir DIR] [--strict] [--check-urls]\n` +
    `                                [--freshness-days FRESHNESS_DAYS] [--global]\n`;

function _topError(message: string): never {
    process.stderr.write(TOP_USAGE);
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exit(2);
}

function _printHelp(): void {
    // Help prose is excluded from the byte-parity contract; emit the usage line.
    process.stdout.write(TOP_USAGE);
    process.stdout.write('\n');
    process.stdout.write(`${DESCRIPTION}\n`);
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (_isMain) {
    process.exit(main());
}

export { main };
