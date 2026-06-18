#!/usr/bin/env tsx
/**
 * Local workspace document store — Phase 5 of `road-to-employee-product`
 * (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_documents.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same slug /
 * dedupe rules, same frontmatter shape, same `.md` / `.md.enc` whole-file
 * encryption + per-record `.history.jsonl` (ADR-062 Part B / ADR-064), same
 * secret-leak refusal (exit 3), same `json.dumps(..., sort_keys=True)` output,
 * same mtime-sorted listing with the `updated_at` ISO-millis shape, same
 * pandoc export. No behaviour changes — latent quirks are replicated, not fixed.
 *
 * Implements `docs/contracts/workspace-documents.md`. Per-user, local-only.
 * Documents live under
 * `~/.event4u/agent-config/workspace/documents/<type>/<slug>.md`; each has an
 * append-only `<slug>.history.jsonl` revision log.
 *
 * CLI:
 *
 *     workspace_documents.ts create --type <t> --title <s> --body-file <p>
 *                                   [--role <r>] [--session <id>] [--prompt <p>]
 *     workspace_documents.ts save <type> <slug> --body-file <p> [--actor user|host]
 *     workspace_documents.ts list [--type <t>] [--role <r>] [--limit 20] [--json]
 *     workspace_documents.ts read <type> <slug>
 *     workspace_documents.ts export <type> <slug> --to <dir> --format md|pdf|docx
 *     workspace_documents.ts migrate [--root <p>]      # plaintext -> .enc, non-destructive
 *     workspace_documents.ts decrypt-all [--root <p>]  # kill-switch: .enc -> plaintext
 *     workspace_documents.ts rekey [--root <p>]        # rotate master key, re-encrypt
 */

import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Sibling twins (TS imports the .ts twins, never the .py originals).
import { scan, type Finding } from './workspace_secrets.js';
import {
    decryptBytes,
    decryptLine,
    encryptBytes,
    encryptLine,
    isEnabled,
    rotateKey,
} from './workspace_crypto.js';

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

const WORKSPACE_HOME = path.join(
    os.homedir(),
    '.event4u',
    'agent-config',
    'workspace',
    'documents',
);
const SCHEMA = 'workspace-document/v0';
const ALLOWED_TYPES: ReadonlySet<string> = new Set([
    'offer',
    'mail-draft',
    'memo',
    'brief',
    'video-script',
]);
const ENC_SUFFIX = '.enc';

/**
 * Raised when a high-confidence secret is found in a document write.
 *
 * Carries only the field name and pattern label — never the matched value —
 * so the message is safe to print to a terminal or log.
 */
class SecretLeakError extends Error {
    constructor(public readonly field: string, public readonly patternName: string) {
        super(
            `high-confidence secret (${patternName}) detected in ${field}; ` +
                `redact it before saving — the document was NOT written`,
        );
    }
}

// --- JSON byte-parity (compact: ensure_ascii=True, sort_keys=True) ----------

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

function _dumpSorted(value: unknown): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _dumpSorted(v)).join(', ') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return '{' + keys.map((k) => `${_jsonStrAscii(k)}: ${_dumpSorted(obj[k])}`).join(', ') + '}';
    }
    return _jsonStrAscii(String(value));
}

function jsonDumpsSorted(value: unknown): string {
    return _dumpSorted(value);
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

function eprint(line = ''): void {
    process.stderr.write(line + '\n');
}

function pathExists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

// --- Python string helpers --------------------------------------------------

/** `str.splitlines()` — universal newline boundaries, no trailing empty. */
function pySplitlines(text: string): string[] {
    if (text === '') return [];
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        const isBoundary =
            ch === '\n' ||
            ch === '\r' ||
            ch === '\v' ||
            ch === '\f' ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029;
        if (isBoundary) {
            out.push(cur);
            cur = '';
            if (ch === '\r' && text[i + 1] === '\n') i += 1;
        } else {
            cur += ch;
        }
    }
    if (cur !== '') out.push(cur);
    return out;
}

/** `str.splitlines()` count — code-point newline-bounded line count. */
function pyLineCount(text: string): number {
    return pySplitlines(text).length;
}

const _WS = '[ \\t\\n\\r\\f\\v\\x1c\\x1d\\x1e\\x1f\\x85]';
function pyStrip(s: string): string {
    return s.replace(new RegExp(`^${_WS}+`, 'u'), '').replace(new RegExp(`${_WS}+$`, 'u'), '');
}
function pyStripEmpty(s: string): boolean {
    return pyStrip(s) === '';
}
function pyLstrip(s: string): string {
    return s.replace(new RegExp(`^${_WS}+`, 'u'), '');
}
function pyStripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) start += 1;
    while (end > start && chars.includes(s[end - 1] as string)) end -= 1;
    return s.slice(start, end);
}
/** `str.lstrip("\n")`. */
function pyLstripNewlines(s: string): string {
    let i = 0;
    while (i < s.length && s[i] === '\n') i += 1;
    return s.slice(i);
}
/** Code-point slice `s[:n]` (Python str indexing is by code point). */
function pyHead(s: string, n: number): string {
    return Array.from(s).slice(0, n).join('');
}

// --- encryption-aware IO (ADR-062 Part B) --------------------------------

function _encEnabled(): boolean {
    return isEnabled();
}

function _encPath(p: string): string {
    return p + ENC_SUFFIX;
}

/** The on-disk file backing logical path `p` (plaintext or .enc), or null. */
function _resolveExisting(p: string): string | null {
    if (pathExists(p)) {
        return p;
    }
    const enc = _encPath(p);
    return pathExists(enc) ? enc : null;
}

function _docExists(p: string): boolean {
    return _resolveExisting(p) !== null;
}

/** Read logical path `p`, decrypting if the backing file is `.enc`. */
function _readTextAny(p: string): string | null {
    const actual = _resolveExisting(p);
    if (actual === null) {
        return null;
    }
    let data: Buffer = fs.readFileSync(actual);
    if (actual.endsWith(ENC_SUFFIX)) {
        data = decryptBytes(data);
    }
    return data.toString('utf-8');
}

function _atomicWriteBytes(target: string, payload: Buffer): void {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = path.join(
        path.dirname(target),
        `.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`,
    );
    let fd: number | null = null;
    try {
        fd = fs.openSync(tmp, 'w');
        fs.writeFileSync(fd, payload);
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = null;
        fs.renameSync(tmp, target);
    } finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch {
                /* ignore */
            }
        }
        if (pathExists(tmp)) {
            try {
                fs.unlinkSync(tmp);
            } catch {
                /* ignore */
            }
        }
    }
}

/**
 * Write `text` to logical path `p` honoring the flag. Returns the actual path
 * written (`p` or its `.enc` sibling). The opposite plaintext form is removed
 * (when encrypting) so the slug has exactly one backing file.
 */
function _writeText(p: string, text: string): string {
    const payload = Buffer.from(text, 'utf-8');
    const enc = _encPath(p);
    if (_encEnabled()) {
        _atomicWriteBytes(enc, encryptBytes(payload));
        if (pathExists(p)) {
            fs.unlinkSync(p);
        }
        return enc;
    }
    _atomicWriteBytes(p, payload);
    // A stale .enc is NOT auto-deleted here — turning the flag off must not
    // silently destroy ciphertext. Use `decrypt-all` to convert deliberately.
    return p;
}

function _historyLine(text: string): string {
    return _encEnabled() ? encryptLine(text) : text;
}

/**
 * Apply `transform(line) -> line` to each record in a history log; atomic
 * temp+rename. Returns the number of records rewritten.
 */
function _rewriteHistory(hp: string, transform: (ln: string) => string): number {
    if (!pathExists(hp)) {
        return 0;
    }
    const out = pySplitlines(fs.readFileSync(hp, 'utf-8'))
        .filter((ln) => !pyStripEmpty(ln))
        .map((ln) => transform(ln));
    _atomicWriteBytes(hp, Buffer.from(out.join('\n') + (out.length ? '\n' : ''), 'utf-8'));
    return out.length;
}

/**
 * Pre-write secret-scan hook for user-authored documents (Phase 8 Step 5).
 *
 * High-confidence matches refuse the write outright; the fuzzy key/value
 * heuristic only warns.
 */
function _guardSecrets(fields: Record<string, string | null | undefined>): void {
    for (const [field, value] of Object.entries(fields)) {
        if (!value) {
            continue;
        }
        const findings = scan(value);
        const high = findings.filter((f: Finding) => f.confidence === 'high').map((f) => f.pattern);
        if (high.length > 0) {
            throw new SecretLeakError(field, high[0] as string);
        }
        const fuzzy = [...new Set(findings.filter((f) => f.confidence === 'fuzzy').map((f) => f.pattern))].sort(
            _pyStrCmp,
        );
        if (fuzzy.length > 0) {
            eprint(
                `workspace_documents: warning — possible secret ` +
                    `(${fuzzy.join(', ')}) in ${field}; review before sharing`,
            );
        }
    }
}

function _pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function _pad(n: number, w: number): string {
    return String(n).padStart(w, '0');
}

function _nowIso(): string {
    const d = new Date();
    return (
        `${_pad(d.getUTCFullYear(), 4)}-${_pad(d.getUTCMonth() + 1, 2)}-${_pad(
            d.getUTCDate(),
            2,
        )}T${_pad(d.getUTCHours(), 2)}:${_pad(d.getUTCMinutes(), 2)}:${_pad(d.getUTCSeconds(), 2)}Z`
    );
}

function _todayIso(): string {
    const d = new Date();
    return `${_pad(d.getUTCFullYear(), 4)}-${_pad(d.getUTCMonth() + 1, 2)}-${_pad(d.getUTCDate(), 2)}`;
}

/** `SLUG_RE.sub("-", title.lower()).strip("-")[:60] or "document"`. */
export function slugify(title: string): string {
    // SLUG_RE = /[^a-z0-9]+/g applied to the lowercased title.
    const lowered = title.toLowerCase();
    const replaced = lowered.replace(/[^a-z0-9]+/g, '-');
    const stripped = pyStripChars(replaced, '-');
    const head = pyHead(stripped, 60);
    return head || 'document';
}

function _dedupe(target: string, slug: string, ext: string): string {
    let cand = slug;
    let n = 2;
    while (_docExists(path.join(target, `${cand}${ext}`))) {
        cand = `${slug}-${n}`;
        n += 1;
    }
    return cand;
}

function _bodySha(body: string): string {
    return crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');
}

function _buildFrontmatter(meta: Record<string, unknown>): string {
    const keys = [
        'type',
        'title',
        'created_at',
        'last_edited_at',
        'source_prompt',
        'source_session',
        'role',
        'tags',
        'schema',
        'quarantine',
    ];
    const lines = ['---'];
    for (const k of keys) {
        if (!(k in meta)) continue;
        const v = meta[k];
        // skip None / "" / []
        if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
            continue;
        }
        if (Array.isArray(v)) {
            lines.push(`${k}: [${(v as unknown[]).map((x) => String(x)).join(', ')}]`);
        } else if (typeof v === 'boolean') {
            lines.push(`${k}: ${v ? 'true' : 'false'}`);
        } else {
            lines.push(`${k}: ${v}`);
        }
    }
    lines.push('---');
    return lines.join('\n') + '\n\n';
}

interface Document {
    type: string;
    slug: string;
    title: string;
    body: string;
    path: string;
    history_path: string;
}

export function create(args: {
    type: string;
    title: string;
    body: string;
    role?: string | null;
    source_prompt?: string | null;
    source_session?: string | null;
    tags?: string[] | null;
    quarantine?: boolean;
    root?: string | null;
}): Document {
    const {
        type,
        title,
        body,
        role = null,
        source_prompt = null,
        source_session = null,
        tags = null,
        quarantine = false,
        root = null,
    } = args;
    if (!ALLOWED_TYPES.has(type)) {
        throw new RuntimeError(`unknown document type: ${pyRepr(type)}`);
    }
    // Refuse high-confidence secrets before any byte is written.
    _guardSecrets({ body, title, source_prompt });
    const base = path.join(root !== null ? root : WORKSPACE_HOME, type);
    fs.mkdirSync(base, { recursive: true });
    const slug = _dedupe(base, `${slugify(title)}-${_todayIso()}`, '.md');
    const now = _nowIso();
    const meta: Record<string, unknown> = {
        type,
        title,
        created_at: now,
        last_edited_at: now,
        source_prompt,
        source_session,
        role,
        tags: tags ?? [],
        schema: SCHEMA,
        quarantine: quarantine ? quarantine : null,
    };
    const bodyText = _buildFrontmatter(meta) + body;
    const logical = path.join(base, `${slug}.md`);
    const written = _writeText(logical, bodyText);
    const hp = path.join(base, `${slug}.history.jsonl`);
    const entry = {
        ts: now,
        actor: 'host',
        kind: 'save',
        delta: { added: pyLineCount(body), removed: 0 },
        body_sha256: _bodySha(body),
    };
    fs.writeFileSync(hp, _historyLine(jsonDumpsSorted(entry)) + '\n', { encoding: 'utf-8' });
    return { type, slug, title, body, path: written, history_path: hp };
}

export function save(
    type: string,
    slug: string,
    body: string,
    opts?: { actor?: string; root?: string | null },
): Record<string, unknown> {
    const actor = opts?.actor ?? 'user';
    const root = opts?.root ?? null;
    // Refuse high-confidence secrets before the edited body overwrites the file.
    _guardSecrets({ body });
    const base = path.join(root !== null ? root : WORKSPACE_HOME, type);
    const logical = path.join(base, `${slug}.md`);
    const raw = _readTextAny(logical);
    if (raw === null) {
        throw new FileNotFoundError(`no such document: ${type}/${slug}`);
    }
    const end = raw.indexOf('\n---', 4);
    let head: string;
    let oldBody: string;
    if (end !== -1) {
        head = raw.slice(0, end + 4);
        oldBody = pyLstripNewlines(raw.slice(end + 4));
    } else {
        head = '';
        oldBody = raw;
    }
    const now = _nowIso();
    // re.sub(r"last_edited_at: .*", ...) — `.` excludes newline by default.
    head = head.replace(/last_edited_at: .*/g, `last_edited_at: ${now}`);
    _writeText(logical, head ? head + '\n' + body : body);
    const oldLines = pySplitlines(oldBody);
    const newLines = pySplitlines(body);
    const entry = {
        ts: now,
        actor,
        kind: 'save',
        delta: {
            added: Math.max(0, newLines.length - oldLines.length),
            removed: Math.max(0, oldLines.length - newLines.length),
        },
        body_sha256: _bodySha(body),
    };
    const hp = path.join(base, `${slug}.history.jsonl`);
    fs.appendFileSync(hp, _historyLine(jsonDumpsSorted(entry)) + '\n', { encoding: 'utf-8' });
    return entry;
}

export function read(type: string, slug: string, opts?: { root?: string | null }): Document | null {
    const root = opts?.root ?? null;
    const base = path.join(root !== null ? root : WORKSPACE_HOME, type);
    const logical = path.join(base, `${slug}.md`);
    const raw = _readTextAny(logical);
    if (raw === null) {
        return null;
    }
    const end = raw.indexOf('\n---', 4);
    const body = end !== -1 ? pyLstripNewlines(raw.slice(end + 4)) : raw;
    let title = '';
    if (raw.startsWith('---') && end !== -1) {
        for (const line of pySplitlines(raw.slice(3, end))) {
            if (line.startsWith('title:')) {
                title = pyStripChars(pyStrip(line.split(':').slice(1).join(':')), "'\"");
                break;
            }
        }
    }
    const hp = path.join(base, `${slug}.history.jsonl`);
    const actual = _resolveExisting(logical) ?? logical;
    return { type, slug, title, body, path: actual, history_path: hp };
}

/**
 * Yield [slug, backingPath] for each document in a type dir, plaintext or
 * .enc, de-duplicated by slug (a slug never has both forms).
 */
function* _iterDocFiles(tdir: string): Generator<[string, string]> {
    const seen = new Set<string>();
    const mds = _glob(tdir, '*.md');
    const encs = _glob(tdir, '*.md' + ENC_SUFFIX);
    for (const p of [...mds, ...encs]) {
        const name = path.basename(p);
        const slug = name.endsWith(ENC_SUFFIX)
            ? name.slice(0, name.length - ('.md' + ENC_SUFFIX).length)
            : name.slice(0, name.length - '.md'.length);
        if (seen.has(slug)) {
            continue;
        }
        seen.add(slug);
        yield [slug, p];
    }
}

export function listDocuments(opts?: {
    type?: string | null;
    role?: string | null;
    limit?: number;
    root?: string | null;
}): Record<string, unknown>[] {
    const type = opts?.type ?? null;
    const role = opts?.role ?? null;
    const limit = opts?.limit ?? 20;
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    if (!pathExists(base)) {
        return [];
    }
    let types: string[];
    if (type) {
        types = [type];
    } else {
        // [p.name for p in base.iterdir() if p.is_dir()] — readdir order.
        types = fs
            .readdirSync(base)
            .filter((n) => {
                try {
                    return fs.statSync(path.join(base, n)).isDirectory();
                } catch {
                    return false;
                }
            });
    }
    const docs: Array<[number, Record<string, unknown>, number]> = [];
    let idx = 0;
    for (const t of types) {
        const tdir = path.join(base, t);
        if (!pathExists(tdir)) {
            continue;
        }
        for (const [slug, backing] of _iterDocFiles(tdir)) {
            const meta = _readFrontmatter(path.join(base, t, `${slug}.md`));
            if (role && meta['role'] !== role) {
                continue;
            }
            const mtime = fs.statSync(backing).mtimeMs / 1000;
            docs.push([
                mtime,
                {
                    type: t,
                    slug,
                    title: meta['title'] ?? slug,
                    role: meta['role'] ?? null,
                    last_edited_at: meta['last_edited_at'] ?? null,
                    updated_at: _isoMillis(mtime),
                    path: backing,
                },
                idx,
            ]);
            idx += 1;
        }
    }
    // docs.sort(key=lambda r: r[0], reverse=True) — stable on insertion order.
    docs.sort((a, b) => {
        if (a[0] !== b[0]) return b[0] - a[0];
        return a[2] - b[2]; // stable
    });
    return docs.slice(0, limit).map(([, d]) => d);
}

/** `datetime.fromtimestamp(mtime, utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")`. */
function _isoMillis(epochSeconds: number): string {
    const d = new Date(Math.floor(epochSeconds) * 1000);
    return (
        `${_pad(d.getUTCFullYear(), 4)}-${_pad(d.getUTCMonth() + 1, 2)}-${_pad(
            d.getUTCDate(),
            2,
        )}T${_pad(d.getUTCHours(), 2)}:${_pad(d.getUTCMinutes(), 2)}:${_pad(
            d.getUTCSeconds(),
            2,
        )}.000Z`
    );
}

function _readFrontmatter(p: string): Record<string, unknown> {
    const raw = _readTextAny(p);
    if (raw === null || !raw.startsWith('---')) {
        return {};
    }
    const end = raw.indexOf('\n---', 4);
    if (end === -1) {
        return {};
    }
    const out: Record<string, unknown> = {};
    for (const line of pySplitlines(raw.slice(3, end))) {
        if (pyStripEmpty(line) || !line.includes(':')) {
            continue;
        }
        const idx = line.indexOf(':');
        const k = line.slice(0, idx);
        const v = line.slice(idx + 1);
        out[pyStrip(k)] = pyStripChars(pyStrip(v), "'\"");
    }
    return out;
}

export function exportDoc(
    type: string,
    slug: string,
    destDir: string,
    opts?: { format?: string; root?: string | null },
): string {
    const format = opts?.format ?? 'md';
    const root = opts?.root ?? null;
    const doc = read(type, slug, { root });
    if (doc === null) {
        throw new FileNotFoundError(`no such document: ${type}/${slug}`);
    }
    fs.mkdirSync(destDir, { recursive: true });
    const target = path.join(destDir, `${slug}.${format}`);
    // Always materialise cleartext for export — the backing file may be .enc.
    const base = path.join(root !== null ? root : WORKSPACE_HOME, type);
    const cleartext = _readTextAny(path.join(base, `${slug}.md`)) ?? '';
    if (format === 'md') {
        fs.writeFileSync(target, cleartext, { encoding: 'utf-8' });
        return target;
    }
    if (format === 'pdf' || format === 'docx') {
        const pandoc = _which('pandoc');
        if (!pandoc) {
            throw new RuntimeError('pandoc not on PATH — install it for pdf/docx export');
        }
        const tf = path.join(
            os.tmpdir(),
            `wsdoc-${process.pid}-${crypto.randomBytes(6).toString('hex')}.md`,
        );
        fs.writeFileSync(tf, cleartext, { encoding: 'utf-8' });
        try {
            const r = spawnSync(pandoc, [tf, '-o', target], { stdio: 'inherit' });
            if (r.status !== 0) {
                throw new RuntimeError(
                    `Command '${[pandoc, tf, '-o', target].join(' ')}' returned non-zero exit status ${
                        r.status ?? '?'
                    }.`,
                );
            }
        } finally {
            try {
                fs.unlinkSync(tf);
            } catch {
                /* ignore */
            }
        }
        return target;
    }
    throw new RuntimeError(`unsupported format: ${pyRepr(format)}`);
}

/** `shutil.which(cmd)` — first hit on PATH, or null. */
function _which(cmd: string): string | null {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout) {
        const first = r.stdout.split('\n')[0]?.trim();
        return first || null;
    }
    return null;
}

export function migrate(opts?: { root?: string | null }): Record<string, unknown> {
    const root = opts?.root ?? null;
    if (!_encEnabled()) {
        throw new RuntimeError('workspace.encrypt_at_rest is off — enable it before migrate');
    }
    const base = root !== null ? root : WORKSPACE_HOME;
    let migrated = 0;
    let skipped = 0;
    if (!pathExists(base)) {
        return { migrated: 0, skipped: 0 };
    }
    for (const tdir of _sortedDirs(base)) {
        for (const p of _glob(tdir, '*.md')) {
            const enc = _encPath(p);
            if (pathExists(enc)) {
                skipped += 1;
                continue;
            }
            const original = fs.readFileSync(p);
            _atomicWriteBytes(enc, encryptBytes(original));
            if (!decryptBytes(fs.readFileSync(enc)).equals(original)) {
                fs.unlinkSync(enc); // rollback this file; leave plaintext intact
                throw new RuntimeError(`migrate: verify failed for ${p}, rolled back`);
            }
            fs.unlinkSync(p);
            migrated += 1;
        }
        for (const hp of _glob(tdir, '*.history.jsonl')) {
            const hadPlaintext = pySplitlines(fs.readFileSync(hp, 'utf-8')).some(
                (ln) => !pyStripEmpty(ln) && '{['.includes((pyLstrip(ln)[0] as string) ?? '\0'),
            );
            _rewriteHistory(hp, (ln) => encryptLine(decryptLine(ln)));
            if (hadPlaintext) {
                migrated += 1;
            }
        }
    }
    return { migrated, skipped };
}

export function decryptAll(opts?: { root?: string | null }): Record<string, unknown> {
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    let decrypted = 0;
    if (!pathExists(base)) {
        return { decrypted: 0 };
    }
    for (const tdir of _sortedDirs(base)) {
        for (const enc of _glob(tdir, '*.md' + ENC_SUFFIX)) {
            const plaintext = decryptBytes(fs.readFileSync(enc));
            const target = enc.slice(0, enc.length - ENC_SUFFIX.length);
            _atomicWriteBytes(target, plaintext);
            fs.unlinkSync(enc);
            decrypted += 1;
        }
        for (const hp of _glob(tdir, '*.history.jsonl')) {
            const hadEncrypted = pySplitlines(fs.readFileSync(hp, 'utf-8')).some(
                (ln) => !pyStripEmpty(ln) && !'{['.includes((pyLstrip(ln)[0] as string) ?? '\0'),
            );
            _rewriteHistory(hp, (ln) => decryptLine(ln));
            if (hadEncrypted) {
                decrypted += 1;
            }
        }
    }
    return { decrypted };
}

export function rekey(opts?: { root?: string | null }): Record<string, unknown> {
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    const pending: Array<[string, Buffer]> = [];
    const histPending: Array<[string, Array<[boolean, string]>]> = [];
    if (pathExists(base)) {
        for (const tdir of _sortedDirs(base)) {
            for (const enc of _glob(tdir, '*.md' + ENC_SUFFIX)) {
                pending.push([enc, decryptBytes(fs.readFileSync(enc))]);
            }
            for (const hp of _glob(tdir, '*.history.jsonl')) {
                const rows: Array<[boolean, string]> = [];
                for (const ln of pySplitlines(fs.readFileSync(hp, 'utf-8'))) {
                    if (pyStripEmpty(ln)) {
                        continue;
                    }
                    const wasEnc = !'{['.includes((pyLstrip(ln)[0] as string) ?? '\0');
                    rows.push([wasEnc, decryptLine(ln)]);
                }
                histPending.push([hp, rows]);
            }
        }
    }
    const newKey = rotateKey();
    for (const [enc, cleartext] of pending) {
        _atomicWriteBytes(enc, encryptBytes(cleartext, newKey));
    }
    let rekeyedHist = 0;
    for (const [hp, rows] of histPending) {
        if (!rows.some(([wasEnc]) => wasEnc)) {
            continue; // all-plaintext history: nothing to rotate
        }
        const out = rows.map(([wasEnc, c]) => (wasEnc ? encryptLine(c, newKey) : c));
        _atomicWriteBytes(hp, Buffer.from(out.join('\n') + (out.length ? '\n' : ''), 'utf-8'));
        rekeyedHist += 1;
    }
    return { rekeyed: pending.length, rekeyed_history: rekeyedHist };
}

// --- glob + dir helpers (pathlib component-wise sorted) --------------------

/** `sorted(p for p in base.iterdir() if p.is_dir())` — sorted dir paths. */
function _sortedDirs(base: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(base);
    } catch {
        return [];
    }
    const dirs = names.filter((n) => {
        try {
            return fs.statSync(path.join(base, n)).isDirectory();
        } catch {
            return false;
        }
    });
    dirs.sort(_pyStrCmp);
    return dirs.map((n) => path.join(base, n));
}

/**
 * `sorted(dir.glob(pattern))` for a single-level pattern. Supported patterns:
 * `*.md`, `*.md.enc`, `*.history.jsonl` — suffix match, sorted by name.
 */
function _glob(dir: string, pattern: string): string[] {
    const suffix = pattern.slice(1); // drop leading '*'
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const matched = names.filter((n) => {
        if (!n.endsWith(suffix)) return false;
        // `*.md` must NOT also match `*.md.enc` (Python glob "*.md" excludes it).
        if (pattern === '*.md' && n.endsWith('.md' + ENC_SUFFIX)) return false;
        // `*.md` must NOT match `*.history.jsonl` etc — suffix already handles.
        return true;
    });
    matched.sort(_pyStrCmp);
    return matched.map((n) => path.join(dir, n));
}

// --- error classes mirroring Python exceptions -----------------------------

/** `raise RuntimeError(...)` / `ValueError(...)` — uncaught traceback, exit 1. */
class RuntimeError_ extends Error {}
// Alias so `new RuntimeError(...)` reads naturally below.
const RuntimeError = RuntimeError_;
/** `raise FileNotFoundError(...)` — uncaught traceback, exit 1. */
class FileNotFoundError extends Error {}

/** Python `repr(str)` for `{x!r}` messages. */
function pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + quote;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code < 0x20 || code === 0x7f) out += '\\x' + code.toString(16).padStart(2, '0');
        else out += ch;
    }
    return out + quote;
}

// --- CLI -------------------------------------------------------------------

interface ParsedArgs {
    cmd: string;
    type?: string;
    title?: string;
    body_file?: string;
    role?: string | null;
    session?: string | null;
    prompt?: string | null;
    slug?: string;
    actor: string;
    filterType?: string | null;
    limit: number;
    json: boolean;
    to?: string;
    format: string;
    root?: string | null;
}

const PROG = 'workspace_documents';
const USAGE =
    `usage: ${PROG} [-h]\n` +
    `                           {create,save,list,read,export,migrate,decrypt-all,rekey}\n` +
    `                           ...\n`;
const SUB_CHOICES =
    "'create', 'save', 'list', 'read', 'export', 'migrate', 'decrypt-all', 'rekey'";

// continuation indents align under the first token after `usage: `.
const _C_CREATE = ' '.repeat(34); // `usage: workspace_documents create `
const _C_SAVE = ' '.repeat(32); // `usage: workspace_documents save `
const _C_LIST = ' '.repeat(32); // `usage: workspace_documents list `
const SUB_USAGE: Record<string, string> = {
    create:
        `usage: ${PROG} create [-h] --type TYPE --title TITLE --body-file\n` +
        `${_C_CREATE}BODY_FILE [--role ROLE] [--session SESSION]\n` +
        `${_C_CREATE}[--prompt PROMPT]\n`,
    save:
        `usage: ${PROG} save [-h] --body-file BODY_FILE [--actor ACTOR]\n` +
        `${_C_SAVE}type slug\n`,
    list:
        `usage: ${PROG} list [-h] [--type TYPE] [--role ROLE]\n` +
        `${_C_LIST}[--limit LIMIT] [--root ROOT] [--json]\n`,
    read: `usage: ${PROG} read [-h] type slug\n`,
    export: `usage: ${PROG} export [-h] --to TO [--format FORMAT] type slug\n`,
    migrate: `usage: ${PROG} migrate [-h] [--root ROOT]\n`,
    'decrypt-all': `usage: ${PROG} decrypt-all [-h] [--root ROOT]\n`,
    rekey: `usage: ${PROG} rekey [-h] [--root ROOT]\n`,
};

function _argError(usage: string, prog: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${prog}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): ParsedArgs {
    let i = 0;
    if (i < argv.length && (argv[i] === '-h' || argv[i] === '--help')) {
        process.stdout.write(USAGE);
        throw new ArgparseExit(0);
    }
    if (i >= argv.length) {
        _argError(USAGE, PROG, 'the following arguments are required: cmd');
    }
    const cmd = argv[i] as string;
    i += 1;
    const choices = ['create', 'save', 'list', 'read', 'export', 'migrate', 'decrypt-all', 'rekey'];
    if (!choices.includes(cmd)) {
        _argError(USAGE, PROG, `argument cmd: invalid choice: '${cmd}' (choose from ${SUB_CHOICES})`);
    }
    const subUsage = SUB_USAGE[cmd] as string;
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = {
        cmd,
        role: null,
        session: null,
        prompt: null,
        actor: 'user',
        filterType: null,
        limit: 20,
        json: false,
        format: 'md',
        root: null,
    };
    const positionals: string[] = [];
    const unrecognized: string[] = [];

    // value-flag tables per subcommand (dest + metavar for error text).
    const tables: Record<string, Record<string, { dest: keyof ParsedArgs; meta: string }>> = {
        create: {
            '--type': { dest: 'type', meta: '--type' },
            '--title': { dest: 'title', meta: '--title' },
            '--body-file': { dest: 'body_file', meta: '--body-file' },
            '--role': { dest: 'role', meta: '--role' },
            '--session': { dest: 'session', meta: '--session' },
            '--prompt': { dest: 'prompt', meta: '--prompt' },
        },
        save: {
            '--body-file': { dest: 'body_file', meta: '--body-file' },
            '--actor': { dest: 'actor', meta: '--actor' },
        },
        list: {
            '--type': { dest: 'filterType', meta: '--type' },
            '--role': { dest: 'role', meta: '--role' },
            '--limit': { dest: 'limit', meta: '--limit' },
            '--root': { dest: 'root', meta: '--root' },
        },
        read: {},
        export: {
            '--to': { dest: 'to', meta: '--to' },
            '--format': { dest: 'format', meta: '--format' },
        },
        migrate: { '--root': { dest: 'root', meta: '--root' } },
        'decrypt-all': { '--root': { dest: 'root', meta: '--root' } },
        rekey: { '--root': { dest: 'root', meta: '--root' } },
    };
    const storeTrue: Record<string, Record<string, keyof ParsedArgs>> = {
        list: { '--json': 'json' },
    };
    const intFlags = new Set(['--limit']);
    const vf = (tables[cmd] ?? {}) as Record<string, { dest: keyof ParsedArgs; meta: string }>;
    const st = (storeTrue[cmd] ?? {}) as Record<string, keyof ParsedArgs>;
    // track which value-flags were seen (for required-flag validation).
    const seen = new Set<string>();

    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
        if (st[flag] !== undefined) {
            (out as unknown as Record<string, unknown>)[st[flag] as string] = true;
            i += 1;
            continue;
        }
        if (vf[flag] !== undefined) {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(subUsage, subProg, `argument ${vf[flag].meta}: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            if (intFlags.has(flag)) {
                const n = pyInt(value);
                if (n === null) {
                    _argError(
                        subUsage,
                        subProg,
                        `argument ${vf[flag].meta}: invalid int value: '${value}'`,
                    );
                }
                (out as unknown as Record<string, unknown>)[vf[flag].dest as string] = n;
            } else {
                (out as unknown as Record<string, unknown>)[vf[flag].dest as string] = value;
            }
            seen.add(flag);
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            unrecognized.push(a);
            i += 1;
            continue;
        }
        positionals.push(a);
        i += 1;
    }

    const requireFlags = (req: Array<[string, string]>): void => {
        const missing = req.filter(([f]) => !seen.has(f)).map(([, m]) => m);
        if (missing.length > 0) {
            _argError(subUsage, subProg, `the following arguments are required: ${missing.join(', ')}`);
        }
    };
    const requirePos = (names: string[]): void => {
        // argparse reports ALL missing required args (flags first already done);
        // here positionals are reported together.
        if (positionals.length < names.length) {
            const missing = names.slice(positionals.length);
            _argError(subUsage, subProg, `the following arguments are required: ${missing.join(', ')}`);
        }
    };
    const rejectExtra = (consumed: number): void => {
        const extra = [...positionals.slice(consumed), ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    };

    if (cmd === 'create') {
        // argparse reports missing required flags first; positionals: none.
        const missing: string[] = [];
        if (!seen.has('--type')) missing.push('--type');
        if (!seen.has('--title')) missing.push('--title');
        if (!seen.has('--body-file')) missing.push('--body-file');
        if (missing.length > 0) {
            _argError(subUsage, subProg, `the following arguments are required: ${missing.join(', ')}`);
        }
        rejectExtra(0);
    } else if (cmd === 'save') {
        // argparse groups all missing required into one message, POSITIONALS
        // first (declaration order), then required optionals: `type, slug,
        // --body-file`.
        const missing: string[] = [];
        if (positionals.length < 1) missing.push('type');
        if (positionals.length < 2) missing.push('slug');
        if (!seen.has('--body-file')) missing.push('--body-file');
        if (missing.length > 0) {
            _argError(subUsage, subProg, `the following arguments are required: ${missing.join(', ')}`);
        }
        out.type = positionals[0] as string;
        out.slug = positionals[1] as string;
        rejectExtra(2);
    } else if (cmd === 'read') {
        const missing: string[] = [];
        if (positionals.length < 1) missing.push('type');
        if (positionals.length < 2) missing.push('slug');
        if (missing.length > 0) {
            _argError(subUsage, subProg, `the following arguments are required: ${missing.join(', ')}`);
        }
        out.type = positionals[0] as string;
        out.slug = positionals[1] as string;
        rejectExtra(2);
    } else if (cmd === 'export') {
        // POSITIONALS first, then required optionals: `type, slug, --to`.
        const missing: string[] = [];
        if (positionals.length < 1) missing.push('type');
        if (positionals.length < 2) missing.push('slug');
        if (!seen.has('--to')) missing.push('--to');
        if (missing.length > 0) {
            _argError(subUsage, subProg, `the following arguments are required: ${missing.join(', ')}`);
        }
        out.type = positionals[0] as string;
        out.slug = positionals[1] as string;
        rejectExtra(2);
    } else {
        // list / migrate / decrypt-all / rekey — no positionals.
        rejectExtra(0);
    }
    void requireFlags;
    void requirePos;
    return out;
}

/** Python `int(str)` semantics. null on fail. */
function pyInt(s: string): number | null {
    const t = pyStrip(s);
    if (!/^[+-]?\d+$/.test(t)) return null;
    const n = Number.parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    if (args.cmd === 'create') {
        const body = fs.readFileSync(args.body_file as string, 'utf-8');
        let doc: Document;
        try {
            doc = create({
                type: args.type as string,
                title: args.title as string,
                body,
                role: args.role ?? null,
                source_prompt: args.prompt ?? null,
                source_session: args.session ?? null,
            });
        } catch (err) {
            if (err instanceof SecretLeakError) {
                eprint(`workspace_documents: refused — ${err.message}`);
                return 3;
            }
            throw err;
        }
        print(jsonDumpsSorted({ slug: doc.slug, path: doc.path }));
        return 0;
    }
    if (args.cmd === 'save') {
        const body = fs.readFileSync(args.body_file as string, 'utf-8');
        let entry: Record<string, unknown>;
        try {
            entry = save(args.type as string, args.slug as string, body, { actor: args.actor });
        } catch (err) {
            if (err instanceof SecretLeakError) {
                eprint(`workspace_documents: refused — ${err.message}`);
                return 3;
            }
            throw err;
        }
        print(jsonDumpsSorted(entry));
        return 0;
    }
    if (args.cmd === 'list') {
        const rows = listDocuments({
            type: args.filterType ?? null,
            role: args.role ?? null,
            limit: args.limit,
            root: args.root ? args.root : null,
        });
        if (args.json) {
            print(jsonDumpsSorted(rows));
        } else {
            for (const row of rows) {
                print(jsonDumpsSorted(row));
            }
        }
        return 0;
    }
    if (args.cmd === 'read') {
        const doc = read(args.type as string, args.slug as string);
        if (doc === null) {
            eprint(`no such document: ${args.type}/${args.slug}`);
            return 1;
        }
        print(doc.body);
        return 0;
    }
    if (args.cmd === 'export') {
        const target = exportDoc(args.type as string, args.slug as string, args.to as string, {
            format: args.format,
        });
        print(target);
        return 0;
    }
    if (args.cmd === 'migrate') {
        print(jsonDumpsSorted(migrate({ root: args.root ? args.root : null })));
        return 0;
    }
    if (args.cmd === 'decrypt-all') {
        print(jsonDumpsSorted(decryptAll({ root: args.root ? args.root : null })));
        return 0;
    }
    if (args.cmd === 'rekey') {
        print(jsonDumpsSorted(rekey({ root: args.root ? args.root : null })));
        return 0;
    }
    return 2;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export { ArgparseExit, jsonDumpsSorted };
