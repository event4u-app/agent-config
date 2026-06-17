#!/usr/bin/env tsx
/**
 * Local workspace session store — Phase 4 of `road-to-employee-product`
 * (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_sessions.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same id /
 * timestamp formats, same day-dir layout, same per-record encryption (ADR-064),
 * same `json.dumps(..., sort_keys=True)` output, same mtime-sorted listing,
 * same `--root` validation, same kind allow-list. No behaviour changes — latent
 * quirks are replicated, not fixed.
 *
 * Implements `docs/contracts/daily-workspace.md` §Session JSONL schema.
 * Per-user, local-only. One JSONL file per session under
 * `~/.event4u/agent-config/workspace/sessions/<yyyy-mm-dd>/<session-id>.jsonl`.
 *
 * CLI:
 *
 *     workspace_sessions.ts start --role <slug> --task <slug>
 *     workspace_sessions.ts append <session-id> --kind <kind> --data k=v ...
 *     workspace_sessions.ts list [--limit 20]
 *     workspace_sessions.ts read <session-id>
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Sibling twins (TS imports the .ts twins, never the .py originals).
import { scrub } from './workspace_secrets.js';
import { decryptLine, encryptLine, isEnabled, rotateKey } from './workspace_crypto.js';

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** A `raise SystemExit(str)` — prints the message to stderr, exits 1. */
class SystemExitError extends Error {
    constructor(public readonly detail: string) {
        super(detail);
    }
}

const WORKSPACE_HOME = path.join(
    os.homedir(),
    '.event4u',
    'agent-config',
    'workspace',
    'sessions',
);

/**
 * One session record as a storable line — per-record encrypted (ADR-064)
 * when the flag is on, plaintext JSON otherwise. Sessions are append-JSONL,
 * so they use per-record encryption, not whole-file `.enc`.
 */
function _lineOut(text: string): string {
    return isEnabled() ? encryptLine(text) : text;
}

// Event kinds per contract §Session JSONL schema.
const ALLOWED_KINDS: ReadonlySet<string> = new Set([
    'launcher.input',
    'host.turn',
    'host.output',
    'host.tool',
    'host.error',
    'inbox.handoff',
    'explain.rendered',
    'document.created',
    'document.edited',
]);

// --- JSON byte-parity (ensure_ascii=True, sort_keys=True) -------------------

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

/**
 * A JSON number that `json.loads` produced as a Python `float` — i.e. the
 * source token had a `.`, `e`/`E`, or was `Infinity`/`NaN`. `json.dumps`
 * re-emits an integer-valued float with a trailing `.0` (`2.0`, not `2`), so
 * round-tripping `--data-json` must preserve the float-ness JS `JSON.parse`
 * would otherwise collapse into a plain integer.
 */
class PyFloat {
    constructor(public readonly value: number) {}
}

function _jsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof PyFloat) return _pyFloatRepr(value.value);
    if (typeof value === 'number') return _jsonNumber(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

/** `json.dumps` number rendering for an int (JS integer-valued number). */
function _jsonNumber(n: number): string {
    if (Number.isInteger(n)) return String(n);
    return _pyFloatRepr(n);
}

/** `repr(float)` as `json.dumps` emits it — integer floats carry `.0`. */
function _pyFloatRepr(n: number): string {
    if (Number.isNaN(n)) return 'NaN';
    if (n === Infinity) return 'Infinity';
    if (n === -Infinity) return '-Infinity';
    if (Number.isInteger(n)) return `${n}.0`;
    return String(n);
}

/**
 * Parse JSON the way `json.loads` does for round-trip parity: number tokens
 * with a `.`/`e`/`E` (or the JSON5-ish Infinity/NaN Python accepts) become
 * {@link PyFloat}, integer tokens stay plain numbers. Only the float/int
 * distinction matters here; everything else mirrors `JSON.parse`.
 */
function pyJsonParse(text: string): unknown {
    return new _PyJsonParser(text).parse();
}

class _PyJsonParser {
    private i = 0;
    constructor(private readonly s: string) {}
    parse(): unknown {
        this.ws();
        const v = this.value();
        this.ws();
        if (this.i !== this.s.length) {
            throw new SyntaxError('Extra data');
        }
        return v;
    }
    private ws(): void {
        while (this.i < this.s.length && ' \t\n\r'.includes(this.s[this.i] as string)) this.i += 1;
    }
    private value(): unknown {
        const c = this.s[this.i];
        if (c === '{') return this.obj();
        if (c === '[') return this.arr();
        if (c === '"') return this.str();
        if (c === 't' || c === 'f') return this.bool();
        if (c === 'n') return this.nul();
        if (c === 'I' || c === 'N') return this.constFloat();
        return this.num();
    }
    private obj(): Record<string, unknown> {
        const out: Record<string, unknown> = {};
        this.i += 1;
        this.ws();
        if (this.s[this.i] === '}') {
            this.i += 1;
            return out;
        }
        for (;;) {
            this.ws();
            const k = this.str();
            this.ws();
            this.i += 1; // ':'
            this.ws();
            out[k] = this.value();
            this.ws();
            const ch = this.s[this.i];
            this.i += 1;
            if (ch === '}') break;
            // ch === ','
        }
        return out;
    }
    private arr(): unknown[] {
        const out: unknown[] = [];
        this.i += 1;
        this.ws();
        if (this.s[this.i] === ']') {
            this.i += 1;
            return out;
        }
        for (;;) {
            this.ws();
            out.push(this.value());
            this.ws();
            const ch = this.s[this.i];
            this.i += 1;
            if (ch === ']') break;
            // ch === ','
        }
        return out;
    }
    private str(): string {
        // delegate to JSON.parse for escape handling on the matched span.
        const start = this.i;
        this.i += 1; // opening quote
        while (this.i < this.s.length) {
            const ch = this.s[this.i];
            if (ch === '\\') {
                this.i += 2;
                continue;
            }
            if (ch === '"') {
                this.i += 1;
                break;
            }
            this.i += 1;
        }
        return JSON.parse(this.s.slice(start, this.i)) as string;
    }
    private bool(): boolean {
        if (this.s.startsWith('true', this.i)) {
            this.i += 4;
            return true;
        }
        this.i += 5;
        return false;
    }
    private nul(): null {
        this.i += 4;
        return null;
    }
    private constFloat(): PyFloat {
        if (this.s.startsWith('Infinity', this.i)) {
            this.i += 8;
            return new PyFloat(Infinity);
        }
        // NaN
        this.i += 3;
        return new PyFloat(NaN);
    }
    private num(): number | PyFloat {
        const start = this.i;
        if (this.s[this.i] === '-') {
            this.i += 1;
            if (this.s.startsWith('Infinity', this.i)) {
                this.i += 8;
                return new PyFloat(-Infinity);
            }
        }
        let isFloat = false;
        while (this.i < this.s.length) {
            const ch = this.s[this.i] as string;
            if (ch >= '0' && ch <= '9') {
                this.i += 1;
            } else if (ch === '.' || ch === 'e' || ch === 'E') {
                isFloat = true;
                this.i += 1;
            } else if (ch === '+' || ch === '-') {
                this.i += 1;
            } else {
                break;
            }
        }
        const token = this.s.slice(start, this.i);
        return isFloat ? new PyFloat(Number(token)) : Number(token);
    }
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

/** `str.strip()` whitespace test — mirrors Python `str.strip()` emptiness. */
function pyStripEmpty(s: string): boolean {
    return pyStrip(s) === '';
}

/** `str.strip()` — Python str.strip() default whitespace set. */
function pyStrip(s: string): string {
    return s.replace(/^[\s\x1c\x1d\x1e\x1f\x85]+/u, '').replace(/[\s\x1c\x1d\x1e\x1f\x85]+$/u, '');
}

// ---------------------------------------------------------------------------
// Module body (workspace_sessions.py).
// ---------------------------------------------------------------------------

function _pad(n: number, w: number): string {
    return String(n).padStart(w, '0');
}

/** `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")`. */
function _nowIso(): string {
    const d = new Date();
    return (
        `${_pad(d.getUTCFullYear(), 4)}-${_pad(d.getUTCMonth() + 1, 2)}-${_pad(
            d.getUTCDate(),
            2,
        )}T${_pad(d.getUTCHours(), 2)}:${_pad(d.getUTCMinutes(), 2)}:${_pad(d.getUTCSeconds(), 2)}Z`
    );
}

/** `<YYYYMMDDTHHMMSSZ>-<8-hex>` (secrets.token_hex(4) → 4 bytes → 8 hex). */
function _newSessionId(): string {
    const d = new Date();
    const stamp =
        `${_pad(d.getUTCFullYear(), 4)}${_pad(d.getUTCMonth() + 1, 2)}${_pad(
            d.getUTCDate(),
            2,
        )}T${_pad(d.getUTCHours(), 2)}${_pad(d.getUTCMinutes(), 2)}${_pad(d.getUTCSeconds(), 2)}Z`;
    return `${stamp}-${crypto.randomBytes(4).toString('hex')}`;
}

function _sessionPath(sessionId: string, opts?: { root?: string | null }): string {
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    const day = sessionId.split('T', 1)[0] as string;
    // day is YYYYMMDD; expand to YYYY-MM-DD per contract layout.
    const dayIso = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
    return path.join(base, dayIso, `${sessionId}.jsonl`);
}

interface SessionMeta {
    session_id: string;
    path: string;
    role: unknown;
    task: unknown;
    mtime: number;
    started_at: unknown;
}

/**
 * Create a new session file and write the opening `launcher.input` line.
 *
 * When `host` is given the launcher.input data carries `host_tier` +
 * `host_id` (the shape the Node GUI server writes); omitted → the bare
 * `{role, task}` shape.
 */
export function start(
    role: string,
    task: string,
    opts?: { host?: string | null; root?: string | null },
): string {
    const host = opts?.host ?? null;
    const root = opts?.root ?? null;
    const sid = _newSessionId();
    const p = _sessionPath(sid, { root });
    fs.mkdirSync(path.dirname(p), { recursive: true });
    // Pre-write secret-scan hook (Phase 8 Step 5): a pasted credential in the
    // opening task lands at rest. Telemetry is disposable → scrub silently.
    const [safeTask] = scrub(task);
    const data: Record<string, unknown> = { role, task: safeTask };
    if (host !== null) {
        data['host_tier'] = 'tier-1';
        data['host_id'] = host;
    }
    const rec = { ts: _nowIso(), kind: 'launcher.input', data };
    fs.appendFileSync(p, _lineOut(jsonDumpsSorted(rec)) + '\n', { encoding: 'utf-8' });
    return sid;
}

/** Append one event to an existing session. Rejects unknown kinds. */
export function append(
    sessionId: string,
    kind: string,
    data?: Record<string, unknown> | null,
    opts?: { root?: string | null },
): boolean {
    const root = opts?.root ?? null;
    if (!ALLOWED_KINDS.has(kind)) {
        eprint(`workspace_sessions: rejecting unknown kind ${pyRepr(kind)}`);
        return false;
    }
    const p = _sessionPath(sessionId, { root });
    if (!pathExists(p)) {
        eprint(`workspace_sessions: no session ${sessionId}`);
        return false;
    }
    // Pre-write secret-scan hook (Phase 8 Step 5): scrub the event payload —
    // prompts, tool args, and outputs can carry pasted credentials. Telemetry
    // is disposable, so scrub silently rather than refuse the append.
    // `_scrubData` preserves any PyFloat markers from a `--data-json` parse so
    // float-vs-int round-trips byte-identically; for the flat `--data k=v`
    // path (all strings) it is equivalent to `scrub_obj`.
    const safeData = _scrubData(data ?? {});
    const rec = { ts: _nowIso(), kind, data: safeData };
    fs.appendFileSync(p, _lineOut(jsonDumpsSorted(rec)) + '\n', { encoding: 'utf-8' });
    return true;
}

export function read(sessionId: string, opts?: { root?: string | null }): unknown[] {
    const root = opts?.root ?? null;
    const p = _sessionPath(sessionId, { root });
    if (!pathExists(p)) {
        return [];
    }
    const out: unknown[] = [];
    for (const line of pySplitlines(fs.readFileSync(p, 'utf-8'))) {
        if (pyStripEmpty(line)) {
            continue;
        }
        try {
            // decryptLine passes a plaintext JSON line through; skip a torn /
            // undecryptable line (sessions are an append-only event log —
            // best-effort, like analytics, per ADR-064 §N3). pyJsonParse keeps
            // float-vs-int so a re-dump of a stored `2.0` byte-matches Python.
            out.push(pyJsonParse(decryptLine(line)));
        } catch {
            continue;
        }
    }
    return out;
}

export function listSessions(opts?: { limit?: number; root?: string | null }): SessionMeta[] {
    const limit = opts?.limit ?? 20;
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    if (!pathExists(base)) {
        return [];
    }
    const files = _glob(base, '*/*.jsonl').filter((p) => {
        try {
            return fs.statSync(p).isFile();
        } catch {
            return false;
        }
    });
    // files.sort(key=mtime, reverse=True). Python's sort is stable; ties keep
    // the pre-sort order (the glob order, which is sorted component-wise).
    const withMtime = files.map((p, i) => ({ p, mtime: fs.statSync(p).mtimeMs, i }));
    withMtime.sort((a, b) => {
        if (a.mtime !== b.mtime) return b.mtime - a.mtime;
        return a.i - b.i; // stable
    });
    const out: SessionMeta[] = [];
    for (const { p } of withMtime.slice(0, limit)) {
        const first = _peekFirstRecord(p);
        const data = (first !== null ? ((first as Record<string, unknown>)['data'] ?? {}) : {}) as Record<
            string,
            unknown
        >;
        out.push({
            session_id: path.basename(p, '.jsonl'),
            path: p,
            role: data['role'] ?? null,
            task: data['task'] ?? null,
            mtime: fs.statSync(p).mtimeMs / 1000,
            started_at: first !== null ? ((first as Record<string, unknown>)['ts'] ?? null) : null,
        });
    }
    return out;
}

function _peekFirstRecord(p: string): unknown | null {
    let line: string;
    try {
        const raw = fs.readFileSync(p, 'utf-8');
        // f.readline() returns the first physical line including its newline;
        // pySplitlines drops it. Mirror readline: up to and excluding \n.
        const nl = raw.indexOf('\n');
        line = nl === -1 ? raw : raw.slice(0, nl + 1);
    } catch {
        return null;
    }
    if (pyStripEmpty(line)) {
        return null;
    }
    try {
        // Decrypt just the first line for the meta (role/task) — cheap, no
        // whole-file read (ADR-064 §S3).
        return pyJsonParse(decryptLine(line));
    } catch {
        return null;
    }
}

// --- encryption-at-rest ops (ADR-064: per-record, across the day-dir tree) ---

function _rewriteSession(p: string, transform: (ln: string) => string): number {
    const out: string[] = [];
    for (const ln of pySplitlines(fs.readFileSync(p, 'utf-8'))) {
        if (pyStripEmpty(ln)) continue;
        out.push(transform(ln));
    }
    const tmp = _withSuffix(p, '.jsonl.tmp');
    fs.writeFileSync(tmp, out.join('\n') + (out.length ? '\n' : ''), { encoding: 'utf-8' });
    fs.renameSync(tmp, p);
    return out.length;
}

export function migrate(opts?: { root?: string | null }): Record<string, unknown> {
    const root = opts?.root ?? null;
    if (!isEnabled()) {
        throw new SystemError('workspace.encrypt_at_rest is off — enable it before migrate');
    }
    const base = root !== null ? root : WORKSPACE_HOME;
    let n = 0;
    if (pathExists(base)) {
        for (const p of _glob(base, '*/*.jsonl')) {
            const hadPlaintext = pySplitlines(fs.readFileSync(p, 'utf-8')).some(
                (ln) => !pyStripEmpty(ln) && '{['.includes((pyLstrip(ln)[0] as string) ?? '\0'),
            );
            _rewriteSession(p, (ln) => encryptLine(decryptLine(ln)));
            if (hadPlaintext) {
                n += 1;
            }
        }
    }
    return { migrated: n };
}

export function decryptAll(opts?: { root?: string | null }): Record<string, unknown> {
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    let n = 0;
    if (pathExists(base)) {
        for (const p of _glob(base, '*/*.jsonl')) {
            const hadEncrypted = pySplitlines(fs.readFileSync(p, 'utf-8')).some(
                (ln) => !pyStripEmpty(ln) && !'{['.includes((pyLstrip(ln)[0] as string) ?? '\0'),
            );
            _rewriteSession(p, (ln) => decryptLine(ln));
            if (hadEncrypted) {
                n += 1;
            }
        }
    }
    return { decrypted: n };
}

export function rekey(opts?: { root?: string | null }): Record<string, unknown> {
    const root = opts?.root ?? null;
    const base = root !== null ? root : WORKSPACE_HOME;
    const pending: Array<[string, Array<[boolean, string]>]> = [];
    if (pathExists(base)) {
        for (const p of _glob(base, '*/*.jsonl')) {
            const rows: Array<[boolean, string]> = [];
            for (const ln of pySplitlines(fs.readFileSync(p, 'utf-8'))) {
                if (pyStripEmpty(ln)) {
                    continue;
                }
                const wasEnc = !'{['.includes((pyLstrip(ln)[0] as string) ?? '\0');
                rows.push([wasEnc, decryptLine(ln)]);
            }
            pending.push([p, rows]);
        }
    }
    const newKey = rotateKey();
    let n = 0;
    for (const [p, rows] of pending) {
        if (!rows.some(([wasEnc]) => wasEnc)) {
            continue;
        }
        const out = rows.map(([wasEnc, c]) => (wasEnc ? encryptLine(c, newKey) : c));
        const tmp = _withSuffix(p, '.jsonl.tmp');
        fs.writeFileSync(tmp, out.join('\n') + (out.length ? '\n' : ''), { encoding: 'utf-8' });
        fs.renameSync(tmp, p);
        n += 1;
    }
    return { rekeyed: n };
}

/** `raise RuntimeError(...)` — uncaught, surfaces as a non-zero traceback exit. */
class SystemError extends Error {}

/** `str.lstrip()` — Python str.lstrip() default whitespace set. */
function pyLstrip(s: string): string {
    return s.replace(/^[\s\x1c\x1d\x1e\x1f\x85]+/u, '');
}

/** `pathlib.Path.with_suffix(suffix)` — replace the final `.ext` segment. */
function _withSuffix(p: string, suffix: string): string {
    const dir = path.dirname(p);
    const name = path.basename(p);
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    return path.join(dir, stem + suffix);
}

// `sorted(base.glob("*/*.jsonl"))` — two-level glob (one dir, one file),
// returned in pathlib's component-wise sorted order.
function _glob(base: string, _pattern: string): string[] {
    // pattern is fixed "*/*.jsonl": match files one directory deep ending .jsonl.
    let dirs: string[];
    try {
        dirs = fs.readdirSync(base);
    } catch {
        return [];
    }
    const matches: Array<[string[], string]> = [];
    for (const d of dirs) {
        const sub = path.join(base, d);
        let st: fs.Stats;
        try {
            st = fs.statSync(sub);
        } catch {
            continue;
        }
        if (!st.isDirectory()) continue;
        let files: string[];
        try {
            files = fs.readdirSync(sub);
        } catch {
            continue;
        }
        for (const f of files) {
            if (!f.endsWith('.jsonl')) continue;
            matches.push([[d, f], path.join(sub, f)]);
        }
    }
    // pathlib sorts the resulting PosixPath objects: component-wise tuple sort.
    matches.sort((a, b) => _cmpComponents(a[0], b[0]));
    return matches.map(([, full]) => full);
}

function _cmpComponents(a: string[], b: string[]): number {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i += 1) {
        const ai = a[i] as string;
        const bi = b[i] as string;
        if (ai < bi) return -1;
        if (ai > bi) return 1;
    }
    return a.length - b.length;
}

/**
 * Reject a --root that is not a `…/workspace/sessions` dir.
 *
 * The Node GUI server passes `<writeRoot>/workspace/sessions`; this guards
 * against a refactor accidentally passing the workspace root (which would
 * list/rewrite the whole tree) or a traversal path (ADR-064 §S2).
 */
function _validateCliRoot(raw: string): string {
    const abs = path.resolve(raw);
    let p = abs;
    try {
        p = fs.realpathSync(abs);
    } catch {
        p = abs;
    }
    if (path.basename(p) !== 'sessions' || path.basename(path.dirname(p)) !== 'workspace') {
        throw new SystemExitError(
            `workspace_sessions: --root must be a .../workspace/sessions dir, got ${pyRepr(raw)}`,
        );
    }
    return p;
}

/** Python `repr(str)` for `{x!r}` error messages. */
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

/**
 * `workspace_secrets.scrub_obj`-equivalent that treats a {@link PyFloat} as a
 * scalar leaf (so float markers survive). Same depth cap (50) + cycle guard as
 * the shared scrubber; string leaves route through the shared `scrub`. For the
 * flat `--data k=v` path (no PyFloat) this is behaviourally identical to
 * `scrub_obj`, which the CLI no longer calls directly here.
 */
const _MAX_SCRUB_DEPTH = 50;
function _scrubData(obj: unknown, depth = 0, seen?: Set<unknown>): unknown {
    const _seen = seen ?? new Set<unknown>();
    if (depth > _MAX_SCRUB_DEPTH) {
        return obj;
    }
    if (obj instanceof PyFloat) {
        return obj;
    }
    if (typeof obj === 'string') {
        const [clean] = scrub(obj);
        return clean;
    }
    if (Array.isArray(obj)) {
        if (_seen.has(obj)) return obj;
        _seen.add(obj);
        return obj.map((v) => _scrubData(v, depth + 1, _seen));
    }
    if (obj !== null && typeof obj === 'object') {
        if (_seen.has(obj)) return obj;
        _seen.add(obj);
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            clean[k] = _scrubData(v, depth + 1, _seen);
        }
        return clean;
    }
    return obj;
}

function _parseKv(items: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const item of items ?? []) {
        if (!item.includes('=')) {
            continue;
        }
        const idx = item.indexOf('=');
        const k = item.slice(0, idx);
        const v = item.slice(idx + 1);
        out[pyStrip(k)] = pyStrip(v);
    }
    return out;
}

interface ParsedArgs {
    cmd: string;
    role?: string;
    task?: string;
    host?: string | null;
    session_id?: string;
    kind?: string;
    data: string[];
    data_json?: string | null;
    limit: number;
    json: boolean;
    root?: string | null;
}

const PROG = 'workspace_sessions';
const USAGE = `usage: ${PROG} [-h]\n` + `                          {start,append,list,read,migrate,decrypt-all,rekey}\n` + `                          ...\n`;
const SUB_CHOICES = "'start', 'append', 'list', 'read', 'migrate', 'decrypt-all', 'rekey'";

// argparse wraps each subcommand usage to the terminal width (80 in a pipe).
// Continuation lines align under the first token after `usage: ` (the prog).
// Tests force COLUMNS=80 for the Python runs so these byte-match the TS form.
// `usage: workspace_sessions start ` = 32 cols; `… append ` = 33 cols.
const _C_START = ' '.repeat(32);
const _C_APPEND = ' '.repeat(33);
const SUB_USAGE: Record<string, string> = {
    start:
        `usage: ${PROG} start [-h] --role ROLE --task TASK [--host HOST]\n` +
        `${_C_START}[--root ROOT]\n`,
    append:
        `usage: ${PROG} append [-h] --kind KIND [--data DATA]\n` +
        `${_C_APPEND}[--data-json DATA_JSON] [--root ROOT]\n` +
        `${_C_APPEND}session_id\n`,
    list: `usage: ${PROG} list [-h] [--limit LIMIT] [--root ROOT] [--json]\n`,
    read: `usage: ${PROG} read [-h] [--root ROOT] [--json] session_id\n`,
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
    const choices = ['start', 'append', 'list', 'read', 'migrate', 'decrypt-all', 'rekey'];
    if (!choices.includes(cmd)) {
        _argError(USAGE, PROG, `argument cmd: invalid choice: '${cmd}' (choose from ${SUB_CHOICES})`);
    }
    const subUsage = SUB_USAGE[cmd] as string;
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = {
        cmd,
        host: null,
        data: [],
        data_json: null,
        limit: 20,
        json: false,
        root: null,
    };
    const positionals: string[] = [];
    const unrecognized: string[] = [];

    const tables: Record<string, Record<string, { dest: keyof ParsedArgs; meta: string }>> = {
        start: {
            '--role': { dest: 'role', meta: '--role' },
            '--task': { dest: 'task', meta: '--task' },
            '--host': { dest: 'host', meta: '--host' },
            '--root': { dest: 'root', meta: '--root' },
        },
        append: {
            '--kind': { dest: 'kind', meta: '--kind' },
            '--data-json': { dest: 'data_json', meta: '--data-json' },
            '--root': { dest: 'root', meta: '--root' },
        },
        list: {
            '--limit': { dest: 'limit', meta: '--limit' },
            '--root': { dest: 'root', meta: '--root' },
        },
        read: { '--root': { dest: 'root', meta: '--root' } },
        migrate: { '--root': { dest: 'root', meta: '--root' } },
        'decrypt-all': { '--root': { dest: 'root', meta: '--root' } },
        rekey: { '--root': { dest: 'root', meta: '--root' } },
    };
    const storeTrue: Record<string, Record<string, keyof ParsedArgs>> = {
        list: { '--json': 'json' },
        read: { '--json': 'json' },
    };
    // --data is action="append" → collect into the data list.
    const appendFlags: Record<string, string> = { append: '--data' };
    const intFlags = new Set(['--limit']);
    const vf = (tables[cmd] ?? {}) as Record<string, { dest: keyof ParsedArgs; meta: string }>;
    const st = (storeTrue[cmd] ?? {}) as Record<string, keyof ParsedArgs>;
    const appendFlag = appendFlags[cmd];

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
        if (appendFlag !== undefined && flag === appendFlag) {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(subUsage, subProg, `argument ${appendFlag}: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            out.data.push(value);
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

    if (cmd === 'start') {
        const missing: string[] = [];
        if (out.role === undefined) missing.push('--role');
        if (out.task === undefined) missing.push('--task');
        if (missing.length > 0) {
            _argError(subUsage, subProg, `the following arguments are required: ${missing.join(', ')}`);
        }
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else if (cmd === 'append') {
        if (positionals.length < 1) {
            _argError(subUsage, subProg, 'the following arguments are required: session_id');
        }
        out.session_id = positionals[0] as string;
        if (out.kind === undefined) {
            _argError(subUsage, subProg, 'the following arguments are required: --kind');
        }
        const extra = [...positionals.slice(1), ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else if (cmd === 'read') {
        if (positionals.length < 1) {
            _argError(subUsage, subProg, 'the following arguments are required: session_id');
        }
        out.session_id = positionals[0] as string;
        const extra = [...positionals.slice(1), ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else {
        // list / migrate / decrypt-all / rekey — no positionals.
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    }
    return out;
}

/** Python `int(str)` semantics (base 10, leading/trailing ws + sign). null on fail. */
function pyInt(s: string): number | null {
    const t = s.trim();
    if (!/^[+-]?\d+$/.test(t)) return null;
    const n = Number.parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    if (args.cmd === 'start') {
        const root = args.root ? _validateCliRoot(args.root) : null;
        print(start(args.role as string, args.task as string, { host: args.host ?? null, root }));
        return 0;
    }
    if (args.cmd === 'append') {
        const root = args.root ? _validateCliRoot(args.root) : null;
        const data = args.data_json ? (pyJsonParse(args.data_json) as Record<string, unknown>) : _parseKv(args.data);
        const ok = append(args.session_id as string, args.kind as string, data, { root });
        return ok ? 0 : 1;
    }
    if (args.cmd === 'list') {
        const root = args.root ? _validateCliRoot(args.root) : null;
        const rows = listSessions({ limit: args.limit, root }).map((m) => ({
            session_id: m.session_id,
            role: m.role,
            task: m.task,
            mtime: m.mtime,
            started_at: m.started_at,
        }));
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
        const root = args.root ? _validateCliRoot(args.root) : null;
        const records = read(args.session_id as string, { root });
        if (args.json) {
            print(jsonDumpsSorted(records));
        } else {
            for (const rec of records) {
                print(jsonDumpsSorted(rec));
            }
        }
        return 0;
    }
    if (args.cmd === 'migrate') {
        print(jsonDumpsSorted(migrate({ root: args.root ? _validateCliRoot(args.root) : null })));
        return 0;
    }
    if (args.cmd === 'decrypt-all') {
        print(jsonDumpsSorted(decryptAll({ root: args.root ? _validateCliRoot(args.root) : null })));
        return 0;
    }
    if (args.cmd === 'rekey') {
        print(jsonDumpsSorted(rekey({ root: args.root ? _validateCliRoot(args.root) : null })));
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
        } else if (e instanceof SystemExitError) {
            process.stderr.write(e.detail + '\n');
            process.exitCode = 1;
        } else {
            throw e;
        }
    }
}

export { ArgparseExit, SystemExitError, jsonDumpsSorted };
