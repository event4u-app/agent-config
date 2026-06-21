#!/usr/bin/env tsx
/**
 * Local-only workspace analytics — Phase 7 of `road-to-employee-product`
 * (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_analytics.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same opt-out
 * gate (env + `.agent-settings.yml` peek), same closed event set, same
 * per-record encryption (ADR-064), same `json.dumps(..., sort_keys=True)` /
 * `indent=2` outputs, same CSV (`\r\n` rows), same markdown report, same
 * round-half-to-even percentages. No behaviour changes — latent quirks are
 * replicated, not fixed.
 *
 * Implements `docs/contracts/local-analytics.md`. **Never** POSTs. Writes to
 * `~/.event4u/agent-config/workspace/analytics/events.jsonl` only.
 *
 * CLI:
 *
 *     workspace_analytics.ts emit <event> [--data k=v ...]
 *     workspace_analytics.ts show [--window 30d|7d|24h] [--event <name>]
 *                                  [--role <slug>] [--format markdown|csv|json]
 *     workspace_analytics.ts prune
 *
 * Opt-out (either short-circuits before any file is opened):
 *
 *     AGENT_CONFIG_NO_LOCAL_ANALYTICS=1     # env
 *     .agent-settings.yml -> analytics.local: off
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Sibling twins (TS imports the .ts twins, never the .py originals).
import { scrub_obj } from './workspace_secrets.js';
import { decryptLine, encryptLine, isEnabled, rotateKey } from './workspace_crypto.js';

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/** `raise SystemExit(str)` from `_parse_kv` — message to stderr, exit 1. */
class SystemExitError extends Error {
    constructor(public readonly detail: string) {
        super(detail);
    }
}

// --- Storage layout (contract §Storage) ------------------------------------

const WORKSPACE_HOME = path.join(
    os.homedir(),
    '.event4u',
    'agent-config',
    'workspace',
    'analytics',
);
const EVENTS_PATH = path.join(WORKSPACE_HOME, 'events.jsonl');
const RETENTION_LOCK = path.join(WORKSPACE_HOME, 'retention.lock');

const SCHEMA = 'workspace_event/v0';
const RETENTION_DAYS = 90;

// Closed event set per contract §Event vocabulary.
const ALLOWED_EVENTS: ReadonlySet<string> = new Set([
    'launcher.opened',
    'launcher.task_picked',
    'launcher.task_launched',
    'session.started',
    'session.host_turn',
    'session.completed',
    'document.created',
    'document.edited',
    'document.exported',
    'explain.opened',
    'explain.mode_toggled',
    'why.invoked',
    'knowledge.queried',
    'knowledge.source_clicked',
    'rule.tier2_loaded',
    'persona.cited',
    'skill.activated',
]);

const ENV_OPT_OUT = 'AGENT_CONFIG_NO_LOCAL_ANALYTICS';

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

/**
 * A JSON number that `json.loads` produced as a Python `float` — preserves the
 * float-vs-int distinction JS `JSON.parse` collapses, so a stored `2.0`
 * re-emits as `2.0` not `2` (matters for arbitrary event payloads).
 */
class PyFloat {
    constructor(public readonly value: number) {}
}

function _pyFloatRepr(n: number): string {
    if (Number.isNaN(n)) return 'NaN';
    if (n === Infinity) return 'Infinity';
    if (n === -Infinity) return '-Infinity';
    if (Number.isInteger(n)) return `${n}.0`;
    return String(n);
}

function _jsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof PyFloat) return _pyFloatRepr(value.value);
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : _pyFloatRepr(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

/** `json.dumps(value, sort_keys=True)` (compact, default separators). */
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

/** `json.dumps(value, indent=2)` — keys in INSERTION order (NOT sorted). */
function jsonDumpsIndent2(value: unknown): string {
    return _dumpIndent(value, 0);
}

function _dumpIndent(value: unknown, depth: number): string {
    const scalar = _jsonScalar(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat((depth + 1) * 2);
    const padClose = ' '.repeat(depth * 2);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndent(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + padClose + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj); // insertion order
        if (keys.length === 0) return '{}';
        const items = keys.map((k) => `${pad}${_jsonStrAscii(k)}: ${_dumpIndent(obj[k], depth + 1)}`);
        return '{\n' + items.join(',\n') + '\n' + padClose + '}';
    }
    return _jsonStrAscii(String(value));
}

/**
 * `json.loads` float-aware parse for round-trip parity. A number token with a
 * `.`/`e`/`E` (or Python's accepted Infinity/NaN) becomes {@link PyFloat}.
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
        }
        return out;
    }
    private str(): string {
        const start = this.i;
        this.i += 1;
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

const _WS = '[ \\t\\n\\r\\f\\v\\x1c\\x1d\\x1e\\x1f\\x85]';
function pyStrip(s: string): string {
    return s.replace(new RegExp(`^${_WS}+`, 'u'), '').replace(new RegExp(`${_WS}+$`, 'u'), '');
}
function pyLstrip(s: string): string {
    return s.replace(new RegExp(`^${_WS}+`, 'u'), '');
}
function pyRstrip(s: string): string {
    return s.replace(new RegExp(`${_WS}+$`, 'u'), '');
}
function pyStripEmpty(s: string): boolean {
    return pyStrip(s) === '';
}

// --- Opt-out gate ----------------------------------------------------------

/**
 * Return True when env or settings opt-out is in effect.
 *
 * `settingsPath` defaults to `.agent-settings.yml` at CWD. Missing or
 * malformed settings → emitter stays ON (default per contract §Opt-out).
 */
export function isDisabled(settingsPath?: string | null): boolean {
    const env = (process.env[ENV_OPT_OUT] ?? '').trim();
    if (env !== '' && env !== '0') {
        return true;
    }
    const p = settingsPath !== undefined && settingsPath !== null ? settingsPath : '.agent-settings.yml';
    if (!pathExists(p)) {
        return false;
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return false;
    }
    let inBlock = false;
    for (const raw of pySplitlines(text)) {
        const line = pyRstrip(raw);
        if (line === '' || pyLstrip(line).startsWith('#')) {
            continue;
        }
        if (!line.startsWith(' ') && line.endsWith(':')) {
            inBlock = pyStrip(line) === 'analytics:';
            continue;
        }
        if (inBlock && pyLstrip(line).startsWith('local:')) {
            const idx = line.indexOf(':');
            let value = pyStrip(line.slice(idx + 1)).toLowerCase();
            value = _pyStripChars(value, "'\"");
            return ['off', 'false', 'no', '0'].includes(value);
        }
    }
    return false;
}

/** `str.strip(chars)` — strip any of `chars` from both ends. */
function _pyStripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) start += 1;
    while (end > start && chars.includes(s[end - 1] as string)) end -= 1;
    return s.slice(start, end);
}

// --- Emitter ---------------------------------------------------------------

interface EventRec {
    ts: string;
    schema: string;
    event: string;
    data: Record<string, unknown>;
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

/**
 * Append one `workspace_event/v0` record.
 *
 * Returns True on write, False on opt-out / disk-full / unknown event. Never
 * raises — UI threads call this on the hot path.
 */
export function emit(
    event: string,
    data?: Record<string, unknown> | null,
    opts?: { settingsPath?: string | null },
): boolean {
    const settingsPath = opts?.settingsPath ?? null;
    if (!ALLOWED_EVENTS.has(event)) {
        eprint(`workspace_analytics: rejecting unknown event ${pyRepr(event)}`);
        return false;
    }
    if (isDisabled(settingsPath)) {
        return false;
    }
    let safeData: unknown;
    try {
        [safeData] = scrub_obj(data ?? {});
    } catch (err) {
        eprint(`workspace_analytics: drop event ${pyRepr(event)} (scrub failed: ${_errStr(err)})`);
        return false;
    }
    const record: EventRec = {
        ts: _nowIso(),
        schema: SCHEMA,
        event,
        data: safeData as Record<string, unknown>,
    };
    try {
        let line = jsonDumpsSorted(record);
        // Per-record encryption (ADR-064): one base64 envelope line per event,
        // appended atomically. On any crypto error, DROP the event.
        if (isEnabled()) {
            line = encryptLine(line);
        }
        fs.mkdirSync(WORKSPACE_HOME, { recursive: true });
        fs.appendFileSync(EVENTS_PATH, line + '\n', { encoding: 'utf-8' });
    } catch (err) {
        if (_isOsError(err)) {
            eprint(`workspace_analytics: drop event ${pyRepr(event)} (${_errStr(err)})`);
            return false;
        }
        eprint(`workspace_analytics: drop event ${pyRepr(event)} (encrypt failed: ${_errStr(err)})`);
        return false;
    }
    return true;
}

function _errStr(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}
function _isOsError(err: unknown): boolean {
    return err instanceof Error && typeof (err as NodeJS.ErrnoException).code === 'string';
}

interface Event {
    ts: string;
    schema: string;
    event: string;
    data: Record<string, unknown>;
}

export function readEvents(p?: string | null): Event[] {
    const pth = p !== undefined && p !== null ? p : EVENTS_PATH;
    if (!pathExists(pth)) {
        return [];
    }
    const out: Event[] = [];
    for (const line of pySplitlines(fs.readFileSync(pth, 'utf-8'))) {
        if (pyStripEmpty(line)) {
            continue;
        }
        try {
            const rec = pyJsonParse(decryptLine(line)) as Record<string, unknown>;
            out.push({
                ts: rec['ts'] as string,
                schema: rec['schema'] as string,
                event: rec['event'] as string,
                data: (rec['data'] ?? {}) as Record<string, unknown>,
            });
        } catch {
            // best-effort telemetry — skip a malformed / undecryptable line.
            continue;
        }
    }
    return out;
}

/** `datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")` → epoch ms (UTC), or NaN. */
function _parseTsMs(ts: string): number {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(ts);
    if (m === null) return NaN;
    return Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
    );
}

export function query(
    opts?: {
        since?: number | null;
        event?: string | null;
        role?: string | null;
        path?: string | null;
    },
): Event[] {
    const since = opts?.since ?? null;
    const event = opts?.event ?? null;
    const role = opts?.role ?? null;
    const out: Event[] = [];
    for (const rec of readEvents(opts?.path ?? null)) {
        if (since !== null && _parseTsMs(rec.ts) < since) {
            continue;
        }
        if (event !== null && rec.event !== event) {
            continue;
        }
        if (role !== null && rec.data['role'] !== role) {
            continue;
        }
        out.push(rec);
    }
    return out;
}

// --- Prune (contract §Storage: 90-day rolling, cheap fs lock) -------------

export function prune(opts?: { path?: string | null; retentionDays?: number }): number {
    const p = opts?.path ?? null;
    const retentionDays = opts?.retentionDays ?? RETENTION_DAYS;
    const pth = p !== null ? p : EVENTS_PATH;
    if (!pathExists(pth)) {
        return 0;
    }
    const lock = p === null ? RETENTION_LOCK : path.join(path.dirname(pth), 'retention.lock');
    try {
        fs.mkdirSync(path.dirname(lock), { recursive: true });
        // os.open(O_CREAT | O_EXCL | O_WRONLY) — fail if it already exists.
        const fd = fs.openSync(lock, 'wx');
        fs.closeSync(fd);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
            return 0; // another prune pass holds the lock
        }
        throw err;
    }
    try {
        const cutoff = Date.now() - retentionDays * 86400 * 1000;
        const keep: string[] = [];
        let dropped = 0;
        for (const line of pySplitlines(fs.readFileSync(pth, 'utf-8'))) {
            if (pyStripEmpty(line)) {
                continue;
            }
            try {
                const rec = pyJsonParse(decryptLine(line)) as Record<string, unknown>;
                if (_parseTsMs(rec['ts'] as string) < cutoff) {
                    dropped += 1;
                    continue;
                }
            } catch {
                // undecryptable/malformed → keep
            }
            keep.push(line);
        }
        const tmp = _withSuffix(pth, '.jsonl.tmp');
        fs.writeFileSync(tmp, keep.join('\n') + (keep.length ? '\n' : ''), { encoding: 'utf-8' });
        fs.renameSync(tmp, pth);
        return dropped;
    } finally {
        try {
            fs.unlinkSync(lock);
        } catch {
            /* FileNotFoundError → ignore */
        }
    }
}

// --- encryption-at-rest ops (ADR-064: per-record, append-JSONL) -----------

function _rewriteLines(p: string, transform: (ln: string) => string): number {
    if (!pathExists(p)) {
        return 0;
    }
    const out: string[] = [];
    for (const line of pySplitlines(fs.readFileSync(p, 'utf-8'))) {
        if (pyStripEmpty(line)) {
            continue;
        }
        out.push(transform(line));
    }
    const tmp = _withSuffix(p, '.jsonl.tmp');
    fs.writeFileSync(tmp, out.join('\n') + (out.length ? '\n' : ''), { encoding: 'utf-8' });
    fs.renameSync(tmp, p);
    return out.length;
}

export function migrate(opts?: { path?: string | null }): Record<string, unknown> {
    const p = opts?.path ?? null;
    if (!isEnabled()) {
        throw new Error('workspace.encrypt_at_rest is off — enable it before migrate');
    }
    const pth = p !== null ? p : EVENTS_PATH;
    const n = _rewriteLines(pth, (ln) => encryptLine(decryptLine(ln)));
    return { migrated: n };
}

export function decryptAll(opts?: { path?: string | null }): Record<string, unknown> {
    const p = opts?.path ?? null;
    const pth = p !== null ? p : EVENTS_PATH;
    const n = _rewriteLines(pth, (ln) => decryptLine(ln));
    return { decrypted: n };
}

export function rekey(opts?: { path?: string | null }): Record<string, unknown> {
    const p = opts?.path ?? null;
    const pth = p !== null ? p : EVENTS_PATH;
    if (!pathExists(pth)) {
        rotateKey();
        return { rekeyed: 0 };
    }
    const cleartext = pySplitlines(fs.readFileSync(pth, 'utf-8'))
        .filter((ln) => !pyStripEmpty(ln))
        .map((ln) => decryptLine(ln));
    const newKey = rotateKey();
    const out = cleartext.map((c) => encryptLine(c, newKey));
    const tmp = _withSuffix(pth, '.jsonl.tmp');
    fs.writeFileSync(tmp, out.join('\n') + (out.length ? '\n' : ''), { encoding: 'utf-8' });
    fs.renameSync(tmp, pth);
    return { rekeyed: out.length };
}

/** `pathlib.Path.with_suffix(suffix)` — replace the final `.ext` segment. */
function _withSuffix(p: string, suffix: string): string {
    const dir = path.dirname(p);
    const name = path.basename(p);
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    return path.join(dir, stem + suffix);
}

// --- /analytics:show renderer ---------------------------------------------

const WINDOWS_MS: Record<string, number> = {
    '24h': 24 * 3600 * 1000,
    '7d': 7 * 86400 * 1000,
    '30d': 30 * 86400 * 1000,
};
// sorted(WINDOWS) — alphabetical: 24h, 30d, 7d.
const WINDOWS_SORTED = ['24h', '30d', '7d'];

function _windowSince(window: string): number {
    if (!(window in WINDOWS_MS)) {
        throw new Error(`unknown window ${pyRepr(window)}; choose from ${_pyListRepr(WINDOWS_SORTED)}`);
    }
    return Date.now() - (WINDOWS_MS[window] as number);
}

export function show(
    window = '30d',
    eventFilter: string | null = null,
    roleFilter: string | null = null,
    fmt = 'markdown',
    opts?: { path?: string | null },
): string {
    const since = _windowSince(window);
    const events = query({ since, event: eventFilter, role: roleFilter, path: opts?.path ?? null });
    if (fmt === 'json') {
        return jsonDumpsIndent2(events.map((e) => ({ ts: e.ts, event: e.event, data: e.data })));
    }
    if (fmt === 'csv') {
        const rows: string[] = [];
        rows.push(_csvRow(['ts', 'event', 'role', 'task', 'host_tier', 'duration_ms']));
        for (const e of events) {
            const d = e.data;
            rows.push(
                _csvRow([
                    e.ts,
                    e.event,
                    _csvScalar(d['role']),
                    _csvScalar(d['task']),
                    _csvScalar(d['host_tier']),
                    _csvScalar(d['duration_ms']),
                ]),
            );
        }
        return rows.join('');
    }
    return _renderMarkdown(events, window);
}

/** csv.writer field stringification: missing → "", else str(value). */
function _csvScalar(v: unknown): string {
    if (v === undefined || v === null) return '';
    if (v instanceof PyFloat) return _pyFloatRepr(v.value);
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : _pyFloatRepr(v);
    return String(v);
}

/** csv.writer row: QUOTE_MINIMAL, `\r\n` terminator. */
function _csvRow(fields: string[]): string {
    return fields.map((f) => _csvField(f)).join(',') + '\r\n';
}

function _csvField(field: string): string {
    if (/[",\r\n]/.test(field)) {
        return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
}

function _renderMarkdown(events: Event[], window: string): string {
    const top = new Map<string, number>(); // key "role\x00task" preserving insertion
    const topRoleTask = new Map<string, [string, string]>();
    const launched = new Map<string, number>();
    const completed = new Map<string, number>();
    const durations: number[] = [];
    const sources: string[] = [];
    for (const e of events) {
        const d = e.data;
        const role = (d['role'] ?? '?') as string;
        const task = (d['task'] ?? '?') as string;
        if (e.event === 'launcher.task_launched') {
            const key = `${role}\x00${task}`;
            top.set(key, (top.get(key) ?? 0) + 1);
            topRoleTask.set(key, [String(role), String(task)]);
            launched.set(role, (launched.get(role) ?? 0) + 1);
        } else if (e.event === 'session.completed') {
            completed.set(role, (completed.get(role) ?? 0) + 1);
            // Python `isinstance(dur, int)` — a PyFloat marker (float) is NOT
            // an int; a plain integer-valued JS number is. bool is int in
            // Python, but the `--data k=v` path never yields a bool here.
            const dur = d['duration_ms'];
            if (typeof dur === 'number' && Number.isInteger(dur)) {
                durations.push(dur);
            }
        } else if (e.event === 'knowledge.source_clicked') {
            const src = d['source'];
            if (src) {
                sources.push(String(src));
            }
        }
    }
    const out: string[] = [`# Workspace analytics — last ${window}\n`];
    if (events.length === 0) {
        out.push('_No events recorded in this window._\n');
        return out.join('\n');
    }
    out.push('## Top prompts\n');
    // sorted(top.items(), key=lambda kv: -kv[1])[:10] — stable on insertion order.
    const topEntries = [...top.entries()].map(([k, n], i) => ({ k, n, i }));
    topEntries.sort((a, b) => {
        if (-a.n !== -b.n) return -a.n - -b.n;
        return a.i - b.i; // stable
    });
    for (const { k, n } of topEntries.slice(0, 10)) {
        const [role, task] = topRoleTask.get(k) as [string, string];
        out.push(`- \`${role}\` · \`${task}\` — ${n}`);
    }
    out.push('\n## Launcher → completion rate per role\n');
    // sorted(set(launched) | set(completed)) — union, sorted by role string.
    const roles = [...new Set([...launched.keys(), ...completed.keys()])].sort(_pyStrCmp);
    for (const role of roles) {
        const ln = launched.get(role) ?? 0;
        const cn = completed.get(role) ?? 0;
        const pct = ln ? _pyRoundInt((100 * cn) / ln) : 0;
        out.push(`- \`${role}\` — ${pct}% (${ln} launched · ${cn} completed)`);
    }
    if (durations.length > 0) {
        const sum = durations.reduce((a, b) => a + b, 0);
        const avg = _floorDiv(_floorDiv(sum, durations.length), 1000);
        const m = _floorDiv(avg, 60);
        const s = avg - m * 60;
        out.push(`\n**Average session length:** ${m}m ${s}s`);
    }
    out.push(`\n**Knowledge sources clicked:** ${sources.length}`);
    if (sources.length > 0) {
        const unique = [...new Set(sources)].sort(_pyStrCmp).slice(0, 5);
        out.push(`_(${unique.join(' · ')})_`);
    }
    return out.join('\n') + '\n';
}

/** Python str comparison (code-point order, like sorted() of plain strings). */
function _pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** Python integer floor-division `a // b`. */
function _floorDiv(a: number, b: number): number {
    return Math.floor(a / b);
}

/**
 * Python builtin `round(x)` → nearest int, ties to even (banker's rounding) on
 * the exact IEEE-754 value. `round(100*cn/ln)` is the percentage path.
 */
function _pyRoundInt(x: number): number {
    const floor = Math.floor(x);
    const diff = x - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // exact half → round to even
    return floor % 2 === 0 ? floor : floor + 1;
}

// --- CLI ------------------------------------------------------------------

function _parseKv(items: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const it of items) {
        if (!it.includes('=')) {
            throw new SystemExitError(`--data expects key=value, got ${pyRepr(it)}`);
        }
        const idx = it.indexOf('=');
        const k = it.slice(0, idx);
        const v = it.slice(idx + 1);
        // int coercion for duration_ms / counts; everything else stays str.
        const n = pyInt(v);
        out[k] = n !== null ? n : v;
    }
    return out;
}

/** Python `int(str)` semantics (base 10, leading/trailing ws + sign). null on fail. */
function pyInt(s: string): number | null {
    const t = pyStrip(s);
    if (!/^[+-]?\d+$/.test(t)) return null;
    const n = Number.parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
}

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

/** `repr(list_of_str)` — `['a', 'b']`. */
function _pyListRepr(items: string[]): string {
    return '[' + items.map((i) => pyRepr(i)).join(', ') + ']';
}

interface ParsedArgs {
    cmd: string;
    event?: string;
    data: string[];
    window: string;
    event_filter?: string | null;
    role?: string | null;
    format: string;
}

const PROG = 'workspace_analytics';
const USAGE =
    `usage: ${PROG} [-h]\n` +
    `                           {emit,show,prune,migrate,decrypt-all,rekey} ...\n`;
const SUB_CHOICES = "'emit', 'show', 'prune', 'migrate', 'decrypt-all', 'rekey'";

// `usage: workspace_analytics show ` = 32 cols → continuation indent 32.
const _C_SHOW = ' '.repeat(32);
const SUB_USAGE: Record<string, string> = {
    emit: `usage: ${PROG} emit [-h] [--data K=V] event\n`,
    show:
        `usage: ${PROG} show [-h] [--window {24h,30d,7d}] [--event EVENT]\n` +
        `${_C_SHOW}[--role ROLE] [--format {markdown,csv,json}]\n`,
    prune: `usage: ${PROG} prune [-h]\n`,
    migrate: `usage: ${PROG} migrate [-h]\n`,
    'decrypt-all': `usage: ${PROG} decrypt-all [-h]\n`,
    rekey: `usage: ${PROG} rekey [-h]\n`,
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
    const choices = ['emit', 'show', 'prune', 'migrate', 'decrypt-all', 'rekey'];
    if (!choices.includes(cmd)) {
        _argError(USAGE, PROG, `argument cmd: invalid choice: '${cmd}' (choose from ${SUB_CHOICES})`);
    }
    const subUsage = SUB_USAGE[cmd] as string;
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = {
        cmd,
        data: [],
        window: '30d',
        event_filter: null,
        role: null,
        format: 'markdown',
    };
    const positionals: string[] = [];
    const unrecognized: string[] = [];

    const windowChoices = ['24h', '30d', '7d'];
    const formatChoices = ['markdown', 'csv', 'json'];

    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
        const takeValue = (meta: string): string => {
            if (inlineVal !== null) return inlineVal;
            if (i + 1 >= argv.length) {
                _argError(subUsage, subProg, `argument ${meta}: expected one argument`);
            }
            i += 1;
            return argv[i] as string;
        };
        if (cmd === 'emit' && flag === '--data') {
            out.data.push(takeValue('--data'));
            i += 1;
            continue;
        }
        if (cmd === 'show' && flag === '--window') {
            const v = takeValue('--window');
            if (!windowChoices.includes(v)) {
                _argError(
                    subUsage,
                    subProg,
                    `argument --window: invalid choice: '${v}' (choose from '24h', '30d', '7d')`,
                );
            }
            out.window = v;
            i += 1;
            continue;
        }
        if (cmd === 'show' && flag === '--event') {
            out.event_filter = takeValue('--event');
            i += 1;
            continue;
        }
        if (cmd === 'show' && flag === '--role') {
            out.role = takeValue('--role');
            i += 1;
            continue;
        }
        if (cmd === 'show' && flag === '--format') {
            const v = takeValue('--format');
            if (!formatChoices.includes(v)) {
                _argError(
                    subUsage,
                    subProg,
                    `argument --format: invalid choice: '${v}' (choose from 'markdown', 'csv', 'json')`,
                );
            }
            out.format = v;
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

    if (cmd === 'emit') {
        if (positionals.length < 1) {
            _argError(subUsage, subProg, 'the following arguments are required: event');
        }
        out.event = positionals[0] as string;
        const extra = [...positionals.slice(1), ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else {
        // show / prune / migrate / decrypt-all / rekey — no positionals.
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    }
    return out;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    if (args.cmd === 'emit') {
        const ok = emit(args.event as string, _parseKv(args.data));
        return ok ? 0 : 1;
    }
    if (args.cmd === 'show') {
        process.stdout.write(show(args.window, args.event_filter ?? null, args.role ?? null, args.format));
        return 0;
    }
    if (args.cmd === 'prune') {
        const n = prune();
        process.stdout.write(`pruned ${n} event(s)\n`);
        return 0;
    }
    if (args.cmd === 'migrate') {
        process.stdout.write(jsonDumpsSorted(migrate()) + '\n');
        return 0;
    }
    if (args.cmd === 'decrypt-all') {
        process.stdout.write(jsonDumpsSorted(decryptAll()) + '\n');
        return 0;
    }
    if (args.cmd === 'rekey') {
        process.stdout.write(jsonDumpsSorted(rekey()) + '\n');
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
