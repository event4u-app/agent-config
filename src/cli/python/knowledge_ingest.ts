#!/usr/bin/env -S node --import tsx
/**
 * Local knowledge ingestion — file walk, redaction, chunking, manifest.
 *
 * TypeScript twin of `src/cli/python/knowledge_ingest.py` (ADR-200, py2ts
 * Phase 1). Byte-for-byte behavioral mirror of the public surface used by the
 * `/knowledge:*` command family: `uuid7` / `uuid7_ts`, `redact`, `chunk_text`,
 * `ingest`, `list_ingests`, `forget`, `set_pin`, and the
 * `ingest|list|forget` CLI.
 *
 * Implements `docs/contracts/local-knowledge-ingestion.md` (Phase 2,
 * `road-to-employee-product-and-external-proof.md`).
 *
 * Local-only by design. No network calls. Inputs must resolve to local
 * paths; remote URLs are rejected at command entry. Binary formats (PDF,
 * DOCX, XLSX, EPUB, PPTX, images) are routed through the peer-side
 * `markitdown` MCP server — this module never embeds the converter.
 *
 * Sibling import: the Python module does `sys.path.insert` then
 * `import workspace_secrets`. A `.ts` MUST NOT import a `.py`, so this twin
 * imports the already-written `./workspace_secrets` twin
 * (`scrub(text, {include_fuzzy})` → `[clean, count]`, `[SECRET]` placeholder).
 * The `.js` specifier is the repo's ESM+TS sibling-import convention (matches
 * `workspace_crypto.ts`'s `../_lib/*.js` imports); TypeScript resolves it to the
 * `.ts` source and tsx resolves it at runtime — never a `.py`.
 *
 * Storage::
 *
 *     agents/memory/knowledge/
 *         <ingest-id>/
 *             manifest.json   # source, counts, timestamps, redactions
 *             chunks/<n>.md   # 2 KB markdown chunks (post-redaction)
 *
 * CLI::
 *
 *     knowledge_ingest.ts ingest <path> [--no-redact] [--markitdown=<bin>]
 *     knowledge_ingest.ts list [--format=json|table] [--pin <id>]
 *     knowledge_ingest.ts forget <ingest-id-prefix>
 *     knowledge_ingest.ts unpin <ingest-id-prefix>
 *
 * Bounds (non-negotiable — hard reject on cross)::
 *
 *     Document count        ≤ 1000 per call
 *     Per-file size         ≤ 20 MB
 *     Namespace footprint   ≤ 500 MB (LRU eviction by last_touched)
 *     Traversal depth       ≤ 10 directories
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns an exit code; the CLI entry guard sets `process.exitCode`
 *   (never `process.exit()`). argparse usage errors (unknown subcommand,
 *   missing positional, bad `--format` choice) throw `ArgparseExit(2)`.
 * - uuid7 uses `crypto.randomBytes` for `secrets.randbits` via `BigInt`; the
 *   value is random so it is NOT byte-comparable (tests normalise it), but the
 *   layout regex `^[0-9a-f]{8}-...-7...-[89ab]...$` validates.
 * - PII regexes are ported with the `g` flag for `subn`-equivalent counting.
 *   Node V8 supports the Python `(?<=\s)|(?<=^)` lookbehind in `_RE_PHONE`.
 * - `chunk_text` measures bytes with `Buffer.byteLength(s, 'utf-8')`; the
 *   hard-split slices a `Buffer` and `.toString('utf-8')` (Node's lenient
 *   decode ≈ Python `decode(errors="ignore")` for whole-codepoint boundaries).
 * - `mimetypes.guess_type(name)[0] or "application/octet-stream"` → a small map
 *   over the relevant extensions, values matched against the system `python3`
 *   `mimetypes` on this box (`.md`/`.markdown` → octet-stream here).
 * - `_walk` replicates `os.walk(followlinks=False)` top-down with the same
 *   hidden-dir / hidden-file skip + MAX_DEPTH prune; the caller sorts the
 *   collected paths (`sorted()` over absolute path strings).
 * - manifest JSON is dumped `indent=2, sort_keys=True` (ensure_ascii=True).
 * - `IngestError` ↔ Python `IngestError(RuntimeError)`; the CLI catches it,
 *   prints `error: <e>` to stderr, returns 2.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import * as workspace_secrets from './workspace_secrets.js';

// --- Bounds (contract §Bounds) ---------------------------------------------

export const KNOWLEDGE_ROOT = path.join('agents', 'memory', 'knowledge');

export const MAX_DOCS = 1000;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_NAMESPACE_BYTES = 500 * 1024 * 1024;
export const MAX_DEPTH = 10;
export const CHUNK_BYTES = 2 * 1024;
export const OCR_CONFIDENCE_FLOOR = 0.7;

export const REMOTE_SCHEMES = [
    'http://',
    'https://',
    's3://',
    'gs://',
    'azure://',
    'ftp://',
] as const;

// --- MIME routing (contract §Supported MIME types) -------------------------

export const PASSTHROUGH_EXT: ReadonlySet<string> = new Set(['.md', '.markdown', '.txt']);
export const MARKITDOWN_EXT: ReadonlySet<string> = new Set([
    '.pdf',
    '.docx',
    '.xlsx',
    '.pptx',
    '.epub',
    '.png',
    '.jpg',
    '.jpeg',
]);

// `mimetypes.guess_type(name)[0]` for the extensions that matter, matched
// against the system `python3` `mimetypes` on this box. `.md` / `.markdown`
// resolve to `None` here → fall through to `application/octet-stream`.
const _MIME_MAP: Record<string, string> = {
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.epub': 'application/epub+zip',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
};

/** `mimetypes.guess_type(name)[0] or "application/octet-stream"`. */
function _guess_mime(name: string): string {
    const ext = _suffix(name).toLowerCase();
    return _MIME_MAP[ext] ?? 'application/octet-stream';
}

/** `Path.suffix` — the final `.ext` (with the dot), or '' when none. */
function _suffix(name: string): string {
    const base = path.basename(name);
    const idx = base.lastIndexOf('.');
    // pathlib: a leading-dot name (".bashrc") has no suffix.
    if (idx <= 0) {
        return '';
    }
    return base.slice(idx);
}

/** FileEntry dataclass — keys in declaration order. */
interface FileEntry {
    path: string;
    mime: string;
    bytes: number;
    chunks: number;
    adapter: string;
    ocr_low_confidence: boolean;
}

function _file_entry(
    p: string,
    mime: string,
    bytes: number,
    chunks: number,
    adapter: string,
): FileEntry {
    return {
        path: p,
        mime,
        bytes,
        chunks,
        adapter,
        ocr_low_confidence: false,
    };
}

/** IngestManifest dataclass — keys in declaration order. */
export interface IngestManifest {
    ingest_id: string;
    source: string;
    created_at: string;
    last_touched: string;
    documents: number;
    chunks: number;
    bytes_stored: number;
    redacted: boolean;
    pinned: boolean;
    pii_redacted: Record<string, number>;
    secrets_redacted: number;
    skipped: Array<Record<string, string>>;
    files: FileEntry[];
    contains_redactions: boolean;
}

// --- uuid7 (RFC 9562 §5.7 — time-ordered, 48-bit ms timestamp) -------------

/** `secrets.randbits(n)` → an n-bit unsigned BigInt from crypto-strong bytes. */
function _randbits(n: number): bigint {
    const byteLen = Math.ceil(n / 8);
    let v = 0n;
    const buf = crypto.randomBytes(byteLen);
    for (const b of buf) {
        v = (v << 8n) | BigInt(b);
    }
    // Mask to exactly n bits (Python secrets.randbits returns 0 ≤ x < 2**n).
    return v & ((1n << BigInt(n)) - 1n);
}

export function uuid7(): string {
    // Return a uuid7 string. Timestamp recoverable from the first 48 bits.
    const ms = BigInt(Date.now()) & ((1n << 48n) - 1n);
    const rand_a = _randbits(12);
    const rand_b = _randbits(62);
    // Layout: <48-bit-ts>-<ver=7|12-bit rand_a>-<var=10|62-bit rand_b>
    const hi = (ms << 16n) | (0x7n << 12n) | rand_a;
    const lo = (0b10n << 62n) | rand_b;
    const s = hi.toString(16).padStart(16, '0') + lo.toString(16).padStart(16, '0');
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export function uuid7_ts(value: string): number {
    // Recover the 48-bit ms timestamp from a uuid7 string.
    const hex_str = value.replace(/-/g, '');
    return Number.parseInt(hex_str.slice(0, 12), 16);
}

// --- Redaction (contract §Redaction defaults) -------------------------------

const _RE_EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const _RE_PHONE = new RegExp(
    '(?:(?<=\\s)|(?<=^))' +
        '(?:\\+?\\d{1,3}[\\s.\\-]?)?' +
        '(?:\\(\\d{2,4}\\)[\\s.\\-]?|\\d{2,4}[\\s.\\-])' +
        '\\d{2,4}[\\s.\\-]?\\d{2,4}(?:[\\s.\\-]?\\d{2,4})?',
    'gm',
);
const _RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const _RE_CC = /\b(?:\d[ \-]?){13,19}\b/g;
const _RE_SSN = /\b\d{3}-\d{2}-\d{4}\b/g;

// Secret patterns live in the shared leaf module ``workspace_secrets`` so the
// ingestion redactor and the per-store pre-write guard stay in lock-step.

/** `pat.subn(repl, text)` → `[clean, count]` (non-overlapping, left-to-right). */
function _subn(pat: RegExp, repl: string, text: string): [string, number] {
    let count = 0;
    const clean = text.replace(pat, () => {
        count += 1;
        return repl;
    });
    return [clean, count];
}

/**
 * Replace PII and secret patterns with class placeholders.
 *
 * Returns `[redacted_text, secrets_count]`. Counter keys are the placeholder
 * names without brackets so the manifest can sum them.
 */
export function redact(text: string, counters: Record<string, number>): [string, number] {
    const _bump = (name: string, n = 1): void => {
        counters[name] = (counters[name] ?? 0) + n;
    };

    // Secrets first — never stored, manifest counter incremented. The shared
    // module replaces every match with ``[SECRET]`` (both tiers).
    let [out, secrets_count] = workspace_secrets.scrub(text) as [string, number];
    // PII placeholders.
    const patterns: ReadonlyArray<[RegExp, string]> = [
        [_RE_IBAN, 'IBAN'],
        [_RE_CC, 'CC'],
        [_RE_SSN, 'SSN'],
        [_RE_EMAIL, 'EMAIL'],
        [_RE_PHONE, 'PHONE'],
    ];
    for (const [pat, tag] of patterns) {
        const [next, n] = _subn(pat, `[${tag}]`, out);
        out = next;
        if (n) {
            _bump(tag, n);
        }
    }
    return [out, secrets_count];
}

// --- Chunking ---------------------------------------------------------------

/** Python `len(s.encode("utf-8"))`. */
function _utf8Len(s: string): number {
    return Buffer.byteLength(s, 'utf-8');
}

/**
 * Split `text` at paragraph boundaries into ~`target_bytes` chunks.
 *
 * A paragraph larger than `target_bytes` is hard-split. Trailing whitespace is
 * stripped. Empty chunks are dropped.
 */
export function chunk_text(text: string, target_bytes: number = CHUNK_BYTES): string[] {
    const paras = text.split(/\n\s*\n/);
    const out: string[] = [];
    let buf = '';
    for (let p of paras) {
        p = _strip(p);
        if (!p) {
            continue;
        }
        const candidate = buf ? `${buf}\n\n${p}` : p;
        if (_utf8Len(candidate) > target_bytes && buf) {
            out.push(buf);
            buf = p;
        } else {
            buf = candidate;
        }
    }
    if (buf) {
        out.push(buf);
    }
    // Hard-split oversized chunks.
    const final: string[] = [];
    for (const c of out) {
        const b = Buffer.from(c, 'utf-8');
        if (b.length <= target_bytes * 2) {
            final.push(c);
            continue;
        }
        for (let i = 0; i < b.length; i += target_bytes) {
            final.push(b.subarray(i, i + target_bytes).toString('utf-8'));
        }
    }
    return final.filter((c) => _strip(c));
}

/**
 * Python `str.strip()` — strip leading/trailing whitespace. Python strips a
 * broader Unicode whitespace set than JS `String.prototype.trim`; the `\s`
 * Unicode class plus the chars Python adds covers the ASCII fixtures here.
 */
function _strip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

// --- Input validation -------------------------------------------------------

/** Raised on contract violation. Message names the bound + observed value. */
export class IngestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IngestError';
    }
}

/** `os.path.expanduser` — expand a leading `~`. */
function expanduser(p: string): string {
    if (p === '~') return os.homedir();
    if (p.startsWith('~/') || p.startsWith('~\\')) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}

/** `Path.resolve()` — absolute, symlink-resolved where possible. */
function _resolve(p: string): string {
    try {
        return fs.realpathSync(path.resolve(p));
    } catch {
        return path.resolve(p);
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

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _resolve_input(spec: string): string {
    if (REMOTE_SCHEMES.some((s) => spec.startsWith(s))) {
        throw new IngestError(
            `remote scheme rejected: ${spec} — /knowledge:ingest is local-only by design`,
        );
    }
    const p = expanduser(spec);
    if (!_exists(p)) {
        throw new IngestError(`path does not exist: ${spec}`);
    }
    return _resolve(p);
}

/** Return `[adapter, mime]`. `adapter` is null when unsupported. */
function _classify(p: string): [string | null, string] {
    const ext = _suffix(p).toLowerCase();
    const mime = _guess_mime(p);
    if (PASSTHROUGH_EXT.has(ext)) {
        return ['passthrough', mime];
    }
    if (MARKITDOWN_EXT.has(ext)) {
        return ['markitdown', mime];
    }
    return [null, mime];
}

/**
 * Yield files under `root` up to MAX_DEPTH. Symlinks not followed.
 *
 * Mirrors `os.walk(root, followlinks=False)`: top-down, hidden dirs/files
 * skipped, depth measured in path components relative to `root`.
 */
function _walk(root: string): string[] {
    if (_isFile(root)) {
        return [root];
    }
    const root_parts = _pathParts(root).length;
    const out: string[] = [];

    // os.walk emits directories top-down; the order does not matter because the
    // caller sorts. We collect via an explicit stack to honour followlinks=False
    // (a symlinked subdir is reported but not descended) and the MAX_DEPTH prune.
    const stack: string[] = [root];
    while (stack.length > 0) {
        const dirpath = stack.shift() as string;
        const depth = _pathParts(dirpath).length - root_parts;
        if (depth > MAX_DEPTH) {
            // os.walk: clearing dirnames prunes descent but the current dir's
            // files are skipped too (the body `continue`s before yielding).
            continue;
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dirpath, { withFileTypes: true });
        } catch {
            continue;
        }
        const dirnames: string[] = [];
        const filenames: string[] = [];
        for (const ent of entries) {
            let isDirEntry: boolean;
            if (ent.isSymbolicLink()) {
                // os.walk(followlinks=False): a symlink to a dir is reported in
                // dirnames but never descended; a symlink to a file is a file.
                isDirEntry = _isDir(path.join(dirpath, ent.name));
            } else {
                isDirEntry = ent.isDirectory();
            }
            if (isDirEntry) {
                dirnames.push(ent.name);
            } else {
                filenames.push(ent.name);
            }
        }
        // Skip hidden dirs by convention; do not descend into symlinked dirs.
        for (const d of dirnames) {
            if (d.startsWith('.')) {
                continue;
            }
            const full = path.join(dirpath, d);
            // followlinks=False — never descend a symlink.
            let isLink = false;
            try {
                isLink = fs.lstatSync(full).isSymbolicLink();
            } catch {
                isLink = false;
            }
            if (isLink) {
                continue;
            }
            stack.push(full);
        }
        for (const name of filenames) {
            if (name.startsWith('.')) {
                continue;
            }
            out.push(path.join(dirpath, name));
        }
    }
    return out;
}

/** Path component tuple length, mirroring `len(Path(p).parts)`. */
function _pathParts(p: string): string[] {
    // Normalise then split; an absolute POSIX path's first part is '/'.
    const norm = path.resolve(p);
    const segments = norm.split(path.sep).filter((s) => s !== '');
    return path.isAbsolute(norm) ? [path.sep, ...segments] : segments;
}

function _check_bounds(files: string[]): void {
    if (files.length > MAX_DOCS) {
        throw new IngestError(`document count exceeds bound: ${files.length} > ${MAX_DOCS}`);
    }
    for (const f of files) {
        const size = fs.statSync(f).size;
        if (size > MAX_FILE_BYTES) {
            throw new IngestError(
                `per-file size exceeds bound: ${f} = ${size} bytes > ${MAX_FILE_BYTES}`,
            );
        }
    }
}

// --- Conversion -------------------------------------------------------------

/** UTF-8 only. Other encodings are rejected per contract §MIME. */
function _read_text(p: string): string {
    let buf: Buffer;
    try {
        buf = fs.readFileSync(p);
    } catch (e) {
        // Surfaced like Python's read failure path; non-UTF-8 handled below.
        throw e;
    }
    // Node's utf-8 decode is lenient (replaces bad bytes with U+FFFD); Python
    // raises UnicodeDecodeError. Detect invalid UTF-8 explicitly to mirror the
    // IngestError raise.
    if (!_isValidUtf8(buf)) {
        throw new IngestError(`non-UTF-8 file rejected: ${p} — invalid continuation byte`);
    }
    return buf.toString('utf-8');
}

/** True when `buf` is valid UTF-8 (mirrors a successful Python decode). */
function _isValidUtf8(buf: Buffer): boolean {
    try {
        const dec = new TextDecoder('utf-8', { fatal: true });
        dec.decode(buf);
        return true;
    } catch {
        return false;
    }
}

/** `shutil.which(name)` — first PATH hit. */
function _which(name: string): string | null {
    if (name.includes('/') || name.includes('\\')) {
        return _isExecutable(name) ? name : null;
    }
    const pathEnv = process.env['PATH'] || '';
    const sep = process.platform === 'win32' ? ';' : ':';
    const seen = new Set<string>();
    for (const dir of pathEnv.split(sep)) {
        const d = dir === '' ? '.' : dir;
        if (seen.has(d)) continue;
        seen.add(d);
        const candidate = path.join(d, name);
        if (_isExecutable(candidate)) {
            return candidate;
        }
    }
    return null;
}

function _isExecutable(p: string): boolean {
    try {
        const st = fs.statSync(p);
        if (!st.isFile()) return false;
        if (process.platform === 'win32') return true;
        fs.accessSync(p, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Invoke peer-side `markitdown` CLI. Returns markdown.
 *
 * If `markitdown` is not on PATH, the file is reported as skipped.
 */
function _convert_via_markitdown(p: string, markitdown_bin: string | null): string {
    const binary = markitdown_bin || _which('markitdown');
    if (!binary) {
        throw new IngestError(
            `markitdown not installed peer-side; cannot convert ${p} — ` +
                'see skills/markitdown for install recipes',
        );
    }
    const proc = spawnSync(binary, [p], {
        encoding: 'utf8',
        timeout: 120_000,
    });
    if (proc.error) {
        // Python `subprocess.run` raises (e.g. FileNotFoundError when the binary
        // does not exist); it is NOT an IngestError, so it is not caught at the
        // skip site — it propagates to the CLI and crashes (exit 1). Mirror that
        // by re-throwing a non-IngestError.
        throw proc.error;
    }
    if (proc.status !== 0) {
        const stderr = (proc.stderr ?? '').toString();
        throw new IngestError(`markitdown failed for ${p}: ${_strip(stderr).slice(0, 200)}`);
    }
    return (proc.stdout ?? '').toString();
}

// --- Ingest -----------------------------------------------------------------

/** `time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())`. */
function _utc_now(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

function _namespace_bytes(): number {
    if (!_exists(KNOWLEDGE_ROOT)) {
        return 0;
    }
    let total = 0;
    for (const p of _rglob(KNOWLEDGE_ROOT)) {
        if (_isFile(p)) {
            total += fs.statSync(p).size;
        }
    }
    return total;
}

/** `Path.rglob("*")` — every descendant path (dirs + files), recursively. */
function _rglob(root: string): string[] {
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
            out.push(full);
            let dirLike = ent.isDirectory();
            if (ent.isSymbolicLink()) {
                dirLike = _isDir(full);
            }
            if (dirLike) {
                walk(full);
            }
        }
    };
    walk(root);
    return out;
}

/** `sorted(...)` over path strings (component-wise == string compare here). */
function _sortPaths(items: string[]): string[] {
    return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function _evict_lru(target_bytes: number): number {
    // Drop oldest non-pinned ingests until below `target_bytes`. Returns count.
    if (!_exists(KNOWLEDGE_ROOT)) {
        return 0;
    }
    const ingests: Array<[string, string]> = [];
    for (const d of _iterdir(KNOWLEDGE_ROOT)) {
        const manifest = path.join(d, 'manifest.json');
        if (!_exists(manifest)) {
            continue;
        }
        let m: Record<string, unknown>;
        try {
            m = JSON.parse(fs.readFileSync(manifest, 'utf-8')) as Record<string, unknown>;
        } catch {
            continue;
        }
        if (m['pinned']) {
            continue;
        }
        ingests.push([(m['last_touched'] as string) ?? '', d]);
    }
    // Python `list.sort()` over (str, Path) tuples → sort by last_touched, then
    // path string. Stable, ascending.
    ingests.sort((a, b) => {
        if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
        return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });
    let evicted = 0;
    while (_namespace_bytes() > target_bytes && ingests.length > 0) {
        const [, d] = ingests.shift() as [string, string];
        fs.rmSync(d, { recursive: true, force: true });
        evicted += 1;
    }
    return evicted;
}

/** `Path.iterdir()` — direct children as full paths; [] on read failure. */
function _iterdir(base: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(base);
    } catch {
        return [];
    }
    return names.map((n) => path.join(base, n));
}

/** `Path.iterdir()` that propagates the read error (FileNotFoundError parity). */
function _iterdirStrict(base: string): string[] {
    const names = fs.readdirSync(base);
    return names.map((n) => path.join(base, n));
}

export interface IngestOpts {
    redact_pii?: boolean;
    markitdown_bin?: string | null;
    root?: string | null;
}

/** Ingest a file or directory. Returns the persisted manifest. */
export function ingest(spec: string, opts: IngestOpts = {}): IngestManifest {
    const redact_pii = opts.redact_pii ?? true;
    const markitdown_bin = opts.markitdown_bin ?? null;
    const base = opts.root ?? KNOWLEDGE_ROOT;
    const source = _resolve_input(spec);
    const files = _sortPaths(_walk(source));
    _check_bounds(files);

    const ingest_id = uuid7();
    const now = _utc_now();
    const target = path.join(base, ingest_id);
    const chunks_dir = path.join(target, 'chunks');
    fs.mkdirSync(chunks_dir, { recursive: true });

    const manifest: IngestManifest = {
        ingest_id,
        source: source,
        created_at: now,
        last_touched: now,
        documents: 0,
        chunks: 0,
        bytes_stored: 0,
        redacted: redact_pii,
        pinned: false,
        pii_redacted: {},
        secrets_redacted: 0,
        skipped: [],
        files: [],
        contains_redactions: false,
    };

    let chunk_counter = 0;
    let bytes_stored = 0;
    const pii_counters: Record<string, number> = {};

    for (const f of files) {
        const [adapter, mime] = _classify(f);
        if (adapter === null) {
            manifest.skipped.push({ path: f, reason: `unsupported:${mime}` });
            continue;
        }
        let text: string;
        try {
            if (adapter === 'passthrough') {
                text = _read_text(f);
            } else {
                text = _convert_via_markitdown(f, markitdown_bin);
            }
        } catch (e) {
            if (e instanceof IngestError) {
                manifest.skipped.push({ path: f, reason: String(e.message).slice(0, 120) });
                continue;
            }
            throw e;
        }

        let secrets_for_file = 0;
        if (redact_pii) {
            [text, secrets_for_file] = redact(text, pii_counters);
            manifest.secrets_redacted += secrets_for_file;
        }

        const pieces = chunk_text(text);
        for (const piece of pieces) {
            chunk_counter += 1;
            const chunk_path = path.join(chunks_dir, `${String(chunk_counter).padStart(4, '0')}.md`);
            fs.writeFileSync(chunk_path, Buffer.from(piece, 'utf-8'));
            bytes_stored += _utf8Len(piece);
        }

        manifest.files.push(
            _file_entry(f, mime, fs.statSync(f).size, pieces.length, adapter),
        );
        manifest.documents += 1;
    }

    manifest.chunks = chunk_counter;
    manifest.bytes_stored = bytes_stored;
    manifest.pii_redacted = pii_counters;
    manifest.contains_redactions =
        Object.keys(pii_counters).length > 0 || manifest.secrets_redacted > 0;

    fs.writeFileSync(
        path.join(target, 'manifest.json'),
        Buffer.from(_jsonDumpsIndentSorted(manifest, 2), 'utf-8'),
    );

    if (base === KNOWLEDGE_ROOT) {
        _evict_lru(MAX_NAMESPACE_BYTES);
    }

    return manifest;
}

// --- List / forget / pin ----------------------------------------------------

function _load_manifests(root: string | null = null): Array<Record<string, unknown>> {
    const base = root ?? KNOWLEDGE_ROOT;
    if (!_exists(base)) {
        return [];
    }
    const out: Array<Record<string, unknown>> = [];
    for (const d of _sortPaths(_iterdir(base))) {
        const manifest = path.join(d, 'manifest.json');
        if (!_exists(manifest)) {
            continue;
        }
        try {
            const m = JSON.parse(fs.readFileSync(manifest, 'utf-8')) as Record<string, unknown>;
            out.push(m);
        } catch {
            continue;
        }
    }
    return out;
}

/** Return all ingest manifests sorted by `created_at` ascending. */
export function list_ingests(root: string | null = null): Array<Record<string, unknown>> {
    const manifests = _load_manifests(root);
    // Stable sort by created_at (Python sorted is stable).
    return manifests
        .map((m, i) => [m, i] as [Record<string, unknown>, number])
        .sort((a, b) => {
            const ka = (a[0]['created_at'] as string) ?? '';
            const kb = (b[0]['created_at'] as string) ?? '';
            if (ka !== kb) return ka < kb ? -1 : 1;
            return a[1] - b[1];
        })
        .map((pair) => pair[0]);
}

function _find_by_prefix(prefix: string, root: string | null = null): string {
    const base = root ?? KNOWLEDGE_ROOT;
    // Python `base.iterdir()` raises FileNotFoundError when `base` is absent;
    // that error is NOT an IngestError, so it is not caught at the CLI skip site
    // and crashes (exit 1). Use a throwing iterdir to mirror that.
    const matches: string[] = [];
    for (const d of _iterdirStrict(base)) {
        if (_isDir(d) && path.basename(d).startsWith(prefix)) {
            matches.push(d);
        }
    }
    if (matches.length === 0) {
        throw new IngestError(`no ingest matches prefix: ${prefix}`);
    }
    if (matches.length > 1) {
        throw new IngestError(
            `ambiguous prefix ${prefix} — matches ${matches.length} ingests; ` +
                'use a longer prefix',
        );
    }
    return matches[0] as string;
}

/** Drop the ingest matching `prefix`. Returns the ingest_id removed. */
export function forget(prefix: string, root: string | null = null): string {
    const target = _find_by_prefix(prefix, root);
    const ingest_id = path.basename(target);
    fs.rmSync(target, { recursive: true, force: false });
    return ingest_id;
}

/** Toggle the `pinned` flag on the ingest matching `prefix`. */
export function set_pin(prefix: string, pinned: boolean, root: string | null = null): string {
    const target = _find_by_prefix(prefix, root);
    const manifest_path = path.join(target, 'manifest.json');
    const m = JSON.parse(fs.readFileSync(manifest_path, 'utf-8')) as Record<string, unknown>;
    m['pinned'] = pinned;
    fs.writeFileSync(manifest_path, Buffer.from(_jsonDumpsIndentSorted(m, 2), 'utf-8'));
    return path.basename(target);
}

// --- JSON byte-parity: json.dumps(..., indent=2, sort_keys=True) (ensure_ascii) ---

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    const v = code - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out +=
                        '\\u' +
                        hi.toString(16).padStart(4, '0') +
                        '\\u' +
                        lo.toString(16).padStart(4, '0');
                }
        }
    }
    return out + '"';
}

function _jsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpIndentSorted(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndentSorted(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrAscii(k)}: ${_dumpIndentSorted(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(data, indent=N, sort_keys=True)` (ensure_ascii=True). */
function _jsonDumpsIndentSorted(value: unknown, indent: number): string {
    return _dumpIndentSorted(value, indent, 0);
}

// --- CLI --------------------------------------------------------------------

/** argparse usage exit (code 2). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** `print(...)` — line to stdout. */
function print(line = ''): void {
    process.stdout.write(line + '\n');
}

/** `print(..., file=sys.stderr)`. */
function eprint(line = ''): void {
    process.stderr.write(line + '\n');
}

/** Python `str.ljust(width)`. */
function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function _format_table(manifests: Array<Record<string, unknown>>): string {
    if (manifests.length === 0) {
        return '(no ingests)';
    }
    const rows: string[][] = [
        ['ID', 'DOCS', 'CHUNKS', 'BYTES', 'PINNED', 'REDACTED', 'CREATED', 'SOURCE'],
    ];
    for (const m of manifests) {
        rows.push([
            String((m['ingest_id'] as string) ?? '').slice(0, 8),
            String((m['documents'] as number) ?? 0),
            String((m['chunks'] as number) ?? 0),
            String((m['bytes_stored'] as number) ?? 0),
            m['pinned'] ? 'yes' : 'no',
            m['redacted'] ? 'yes' : 'no',
            String((m['created_at'] as string) ?? ''),
            String((m['source'] as string) ?? '').slice(0, 60),
        ]);
    }
    const ncols = (rows[0] as string[]).length;
    const widths: number[] = [];
    for (let i = 0; i < ncols; i++) {
        widths.push(Math.max(...rows.map((r) => (r[i] as string).length)));
    }
    const lines: string[] = [];
    for (const r of rows) {
        lines.push(r.map((cell, i) => _ljust(cell, widths[i] as number)).join('  '));
    }
    return lines.join('\n');
}

export function _cli(argv: string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    const cmd = args[0];
    if (cmd === undefined || !['ingest', 'list', 'forget'].includes(cmd)) {
        // argparse: required subcommand missing / unknown → exit 2.
        throw new ArgparseExit(2);
    }
    const rest = args.slice(1);

    const hasFlag = (name: string): boolean => rest.includes(name);
    const flagVal = (name: string): string | undefined => {
        // Support `--flag value` and `--flag=value`.
        for (let i = 0; i < rest.length; i++) {
            const a = rest[i] as string;
            if (a === name) {
                return i + 1 < rest.length ? rest[i + 1] : undefined;
            }
            if (a.startsWith(name + '=')) {
                return a.slice(name.length + 1);
            }
        }
        return undefined;
    };
    /** First non-flag token (argparse positional). */
    const positional = (): string | undefined => {
        for (let i = 0; i < rest.length; i++) {
            const a = rest[i] as string;
            if (a.startsWith('--')) {
                // `--markitdown <v>` consumes the next token.
                if (a === '--markitdown' || a === '--format' || a === '--pin' || a === '--unpin') {
                    i += 1;
                }
                continue;
            }
            return a;
        }
        return undefined;
    };

    try {
        if (cmd === 'ingest') {
            const p = positional();
            if (p === undefined) {
                throw new ArgparseExit(2);
            }
            const m = ingest(p, {
                redact_pii: !hasFlag('--no-redact'),
                markitdown_bin: flagVal('--markitdown') ?? null,
            });
            print(_jsonDumpsIndentSorted(m, 2));
            return 0;
        }
        if (cmd === 'list') {
            const fmt = flagVal('--format') ?? 'table';
            if (fmt !== 'json' && fmt !== 'table') {
                throw new ArgparseExit(2);
            }
            const pin = flagVal('--pin');
            const unpin = flagVal('--unpin');
            if (pin) {
                const pid = set_pin(pin, true);
                print(`pinned ${pid}`);
                return 0;
            }
            if (unpin) {
                const pid = set_pin(unpin, false);
                print(`unpinned ${pid}`);
                return 0;
            }
            const manifests = list_ingests();
            if (fmt === 'json') {
                print(_jsonDumpsIndentSorted(manifests, 2));
            } else {
                print(_format_table(manifests));
            }
            return 0;
        }
        if (cmd === 'forget') {
            const p = positional();
            if (p === undefined) {
                throw new ArgparseExit(2);
            }
            const removed = forget(p);
            print(`forgot ${removed}`);
            return 0;
        }
    } catch (e) {
        if (e instanceof ArgparseExit) {
            throw e;
        }
        if (e instanceof IngestError) {
            eprint(`error: ${e.message}`);
            return 2;
        }
        throw e;
    }
    return 1;
}

const _isMain =
    typeof process.argv[1] === 'string' &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_isMain) {
    try {
        process.exitCode = _cli();
    } catch (err) {
        if (err instanceof ArgparseExit) {
            process.exitCode = err.code;
        } else {
            throw err;
        }
    }
}
