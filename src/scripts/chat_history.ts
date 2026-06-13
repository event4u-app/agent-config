// Persistent chat-history log for crash recovery.
//
// TypeScript twin of `src/scripts/chat_history.py` (ADR-094 — Python→TS
// migration). Public API mirrors the Python module exactly (snake_case kept
// deliberately) so callers — including the MCP tools layer
// (`src/scripts/mcp_server/tools.ts`) — depend on one source of truth.
//
// Maintains `agents/runtime/.agent-chat-history` — a JSONL file whose
// first line is a header (schema version, started timestamp, cadence
// frequency) and whose remaining lines are append-only entries (user
// messages, phases, tool calls, questions, answers, decisions, commits).
//
// Sessions are identified per-entry via the `s` field — a deterministic
// 16-char prefix derived from the platform's `session_id`. Multiple
// sessions coexist in one file; each entry self-identifies. No ownership
// layer, no sidecar, no auto-adopt — every hook invocation simply appends
// with its own session tag.
//
// File path defaults to `agents/runtime/.agent-chat-history` (relative to CWD)
// and can be overridden via `$AGENT_CHAT_HISTORY_FILE` (used by tests).
//
// Byte-parity contract: every on-disk JSONL line is rendered with the
// Python `json.dumps(obj, ensure_ascii=False)` separators (`", "` / `": "`,
// non-ASCII kept verbatim, integer-valued floats via the PyFloat marker).
// `status`/`read`/`sessions --json` emit `json.dumps(..., indent=2,
// ensure_ascii=False)`. The CLI mirrors argparse exit codes (0 ok, 2 bad
// args) and the exercised argparse error/usage strings.
//
// Usage:
//     ./scripts-run src/scripts/chat_history init [--freq per_phase]
//     ./scripts-run src/scripts/chat_history append --type phase --json '{...}'
//     ./scripts-run src/scripts/chat_history status
//     ./scripts-run src/scripts/chat_history reset --entries-json '[...]' [--freq per_phase]
//     ./scripts-run src/scripts/chat_history prepend --entries-json '[...]'
//     ./scripts-run src/scripts/chat_history read [--last N | --all] [--session <id>]
//     ./scripts-run src/scripts/chat_history sessions [--limit N] [--json]
//     ./scripts-run src/scripts/chat_history prune-sessions [--max N] [--dry-run]
//     ./scripts-run src/scripts/chat_history clear
//     ./scripts-run src/scripts/chat_history rotate --max-kb 256 --mode rotate

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { load_agent_settings } from './_lib/agent_settings.js';

export const DEFAULT_FILE = 'agents/runtime/.agent-chat-history';
export const DEFAULT_SETTINGS_FILE = '.agent-settings.yml';
export const SCHEMA_VERSION = 4;
export const DEFAULT_MAX_SESSIONS = 5;
export const VALID_FREQS: ReadonlySet<string> = new Set(['per_turn', 'per_phase', 'per_tool']);
export const VALID_OVERFLOW: ReadonlySet<string> = new Set(['rotate', 'condense']);

// Replay-mode signal — when set, every write to the on-disk transcript
// is a no-op. Honoured per `docs/contracts/hook-architecture-v1.md`
// § Replay mode so fixture dispatches never mutate real session state.
export const REPLAY_ENV_VAR = 'AGENT_CONFIG_REPLAY';

function _is_replay_mode(): boolean {
    return (process.env[REPLAY_ENV_VAR] ?? '').trim() === '1';
}

const _WS_RE = /\s+/g;
export const SESSION_ID_LEN = 16;
export const SESSION_ID_UNKNOWN = '<unknown>';
export const SESSION_ID_LEGACY = '<legacy>';
// Sentinel for entries without an `agent` field — legacy rows or
// direct `append` calls that bypassed the platform-hook surface.
export const AGENT_UNKNOWN = '<unknown>';

// Per-entry-type text-length caps. 0 = full text, no whitespace collapse,
// verbatim. N > 0 = collapse whitespace then slice to N chars and append a
// "… [+K chars]" suffix so the log self-reports truncation. Overridable via
// chat_history.text_limits.{user,agent,tool,phase} in .agent-settings.yml.
export const DEFAULT_TEXT_LIMITS: Readonly<Record<string, number>> = {
    user: 0,
    agent: 5000,
    tool: 200,
    phase: 200,
};

// Exit codes for the CLI. Distinct codes let shell callers branch on state.
export const EXIT_OK = 0;
export const EXIT_BAD_ARGS = 2;

export type Entry = Record<string, unknown>;

// ---------------------------------------------------------------------
// Python-faithful JSON serialization (json.dumps parity)
// ---------------------------------------------------------------------

/**
 * Marker for a Python `float` so json.dumps renders integer-valued floats as
 * `0.0`, not `0`. JS has no int/float distinction; this preserves
 * `round()` outputs (e.g. `size_kb`) byte-for-byte.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof PyFloat);
}

/** Render a string the way CPython does with `ensure_ascii=False`. */
function _pyJsonStr(s: string): string {
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
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    // ensure_ascii=False — keep everything >= 0x20 verbatim.
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _pyJsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

function _pyJsonFloat(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

function _pyJsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (value instanceof PyFloat) {
        return _pyJsonFloat(value.value);
    }
    if (typeof value === 'number') {
        return _pyJsonNum(value);
    }
    if (typeof value === 'string') {
        return _pyJsonStr(value);
    }
    return null;
}

/** Mirror `json.dumps(obj, ensure_ascii=False)` — compact, default separators `", "` / `": "`. */
function _pyDumps(value: unknown): string {
    const scalar = _pyJsonScalar(value);
    if (scalar !== null) {
        return scalar;
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyDumps(v)).join(', ')}]`;
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value);
        const parts = keys.map((k) => `${_pyJsonStr(k)}: ${_pyDumps(value[k])}`);
        return `{${parts.join(', ')}}`;
    }
    return _pyJsonStr(String(value));
}

/** Mirror `json.dumps(obj, ensure_ascii=False, indent=2)`. */
function _pyDumpsIndent2(value: unknown, depth = 0): string {
    const scalar = _pyJsonScalar(value);
    if (scalar !== null) {
        return scalar;
    }
    const pad = ' '.repeat(2 * (depth + 1));
    const closePad = ' '.repeat(2 * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _pyDumpsIndent2(v, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map(
            (k) => `${pad}${_pyJsonStr(k)}: ${_pyDumpsIndent2(value[k], depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _pyJsonStr(String(value));
}

// ---------------------------------------------------------------------
// Small Python-shim helpers
// ---------------------------------------------------------------------

/** Mirror Python `str.strip()` over the ASCII + common Unicode whitespace set. */
function _strip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Code-point count, mirroring Python `len(str)`. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Code-point slice `s[:n]`, mirroring Python string slicing. */
function _pySliceTo(s: string, n: number): string {
    if (n <= 0) {
        return '';
    }
    let out = '';
    let i = 0;
    for (const ch of s) {
        if (i >= n) {
            break;
        }
        out += ch;
        i += 1;
    }
    return out;
}

/** Left-justify to `width` with spaces — mirror Python `str.ljust`. */
function _ljust(s: string, width: number): string {
    const pad = width - _pyLen(s);
    return pad > 0 ? s + ' '.repeat(pad) : s;
}

/** Mirror Python `int(x)` over the values that reach it here (int-or-float numerics). */
function _pyIntFromAny(value: unknown): number {
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

/** Mirror Python `round(value, ndigits)` (banker's rounding). */
function _pyRound(value: number, ndigits = 0): number {
    if (!Number.isFinite(value)) {
        return value;
    }
    const factor = 10 ** ndigits;
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const EPS = 1e-9;
    if (Math.abs(diff - 0.5) < EPS) {
        // Round half to even.
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

// ---------------------------------------------------------------------
// File-path resolution + timestamp
// ---------------------------------------------------------------------

export function file_path(): string {
    return process.env.AGENT_CHAT_HISTORY_FILE || DEFAULT_FILE;
}

function _now(): string {
    // Python: datetime.now(utc).isoformat(timespec="seconds") → "...+00:00".
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

export function fingerprint(value: string): string {
    const normalized = _strip((value || '').replace(_WS_RE, ' '));
    return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

export function derive_session_tag(session_id: string): string {
    if (!session_id) {
        return SESSION_ID_UNKNOWN;
    }
    return fingerprint(session_id).slice(0, SESSION_ID_LEN);
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _statSize(p: string): number {
    try {
        return fs.statSync(p).size;
    } catch {
        return -1;
    }
}

// ---------------------------------------------------------------------
// Preview / summary helpers
// ---------------------------------------------------------------------

function _preview(msg: string, n = 80): string {
    const flat = _strip((msg || '').replace(_WS_RE, ' '));
    return _pySliceTo(flat, n);
}

function _extract_text(obj: Entry): string {
    let text = obj.text;
    if (typeof text !== 'string' || !text) {
        const payload = obj.payload;
        if (_isPlainObject(payload)) {
            text = payload.text;
        }
    }
    return typeof text === 'string' ? text : '';
}

function _summarize_session(head: Entry[], tail: Entry[], total: number, n = 60): string {
    const seen = new Set<Entry>();
    const sample: Entry[] = [];
    for (const e of [...head, ...tail]) {
        if (seen.has(e)) {
            continue;
        }
        seen.add(e);
        sample.push(e);
    }

    const user_texts = sample
        .filter((e) => e.t === 'user' && _extract_text(e))
        .map((e) => _extract_text(e));
    if (user_texts.length > 0) {
        const first = _preview(user_texts[0] as string, n);
        if (user_texts.length > 1 && user_texts[user_texts.length - 1] !== user_texts[0]) {
            const last = _preview(user_texts[user_texts.length - 1] as string, n);
            return `${first} → ${last}`;
        }
        return first;
    }

    // Counter.most_common() order: by count desc, insertion order for ties.
    const counts = new Map<string, number>();
    for (const e of sample) {
        const k = typeof e.t === 'string' ? e.t : '?';
        counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const mix = ordered.map(([k, v]) => `${k}×${v}`).join(' ');
    return `(${total} entries — no user prompts; t-mix: ${mix})`;
}

function _session_tag_enabled(): boolean {
    return (process.env.AGENT_CHAT_HISTORY_SESSION_TAG ?? 'true').trim().toLowerCase() !== 'false';
}

function _readLines(p: string): string[] {
    // Mirror Python readlines() / readline semantics on \n-delimited files.
    const raw = fs.readFileSync(p, 'utf-8');
    if (raw === '') {
        return [];
    }
    const parts = raw.split('\n');
    // Python readlines keeps the trailing-newline split shape: a file ending
    // in "\n" yields no extra empty final element to iterate meaningfully —
    // but split('\n') on "a\n" gives ['a','']. We keep the empty tail so the
    // downstream `.strip() == ''` skip matches, and so index 0 is the header.
    return parts;
}

function _last_body_session_id(p?: string | null): string {
    const target = p ?? file_path();
    if (!_isFile(target) || _statSize(target) === 0) {
        return SESSION_ID_UNKNOWN;
    }
    let lines: string[];
    try {
        lines = _readLines(target);
    } catch {
        return SESSION_ID_UNKNOWN;
    }
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = _strip(lines[i] ?? '');
        if (!line) {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (!_isPlainObject(obj) || obj.t === 'header') {
            continue;
        }
        const sid = obj.s;
        if (typeof sid === 'string' && sid) {
            return sid;
        }
    }
    return SESSION_ID_UNKNOWN;
}

// ---------------------------------------------------------------------
// Header read / build / init / migrate
// ---------------------------------------------------------------------

export function read_header(p?: string | null): Entry | null {
    const target = p ?? file_path();
    if (!_isFile(target) || _statSize(target) === 0) {
        return null;
    }
    let first: string;
    try {
        const raw = fs.readFileSync(target, 'utf-8');
        // Python readline() → up to first '\n'.
        first = _strip(raw.split('\n', 1)[0] ?? '');
    } catch {
        return null;
    }
    if (!first) {
        return null;
    }
    try {
        const obj = JSON.parse(first) as unknown;
        if (!(_isPlainObject(obj) && obj.t === 'header')) {
            return null;
        }
        return obj;
    } catch {
        return null;
    }
}

function _build_header(freq: string): Entry {
    return { t: 'header', v: SCHEMA_VERSION, started: _now(), freq };
}

export function init(freq = 'per_phase', options: { path?: string | null } = {}): Entry {
    if (!VALID_FREQS.has(freq)) {
        throw new ValueError(`freq must be one of ${_pyReprSortedList(VALID_FREQS)}`);
    }
    const target = options.path ?? file_path();
    const header = _build_header(freq);
    if (_is_replay_mode()) {
        return header;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, _pyDumps(header) + '\n', { encoding: 'utf-8' });
    return header;
}

export function migrate_header(
    p?: string | null,
    options: { freq?: string | null } = {},
): Entry | null {
    const target = p ?? file_path();
    const existing = read_header(target);
    if (existing === null) {
        return null;
    }
    let current_v: number;
    try {
        current_v = _pyIntFromAny(existing.v ?? 0);
    } catch {
        current_v = 0;
    }
    if (current_v >= SCHEMA_VERSION) {
        return null;
    }
    let chosen_freq = options.freq || (typeof existing.freq === 'string' ? existing.freq : '') || 'per_phase';
    if (!VALID_FREQS.has(chosen_freq)) {
        chosen_freq = 'per_phase';
    }
    const new_header = _build_header(chosen_freq);
    if (typeof existing.started === 'string') {
        new_header.started = existing.started;
    }
    const raw = fs.readFileSync(target, 'utf-8');
    // splitlines() drops the trailing newline; rebuild it on write.
    const lines = _pySplitlines(raw);
    if (lines.length === 0) {
        return null;
    }
    lines[0] = _pyDumps(new_header);
    _atomic_write_text(target, lines.join('\n') + '\n');
    return new_header;
}

/** Mirror Python str.splitlines() for the subset of separators used here (\n, \r, \r\n). */
function _pySplitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\n') {
            out.push(cur);
            cur = '';
        } else if (ch === '\r') {
            out.push(cur);
            cur = '';
            if (text[i + 1] === '\n') {
                i += 1;
            }
        } else {
            cur += ch;
        }
    }
    if (cur !== '') {
        out.push(cur);
    }
    return out;
}

// ---------------------------------------------------------------------
// append / atomic write / normalize / reset / prepend / clear
// ---------------------------------------------------------------------

export function append(
    entry: Entry,
    options: { path?: string | null | undefined; session?: string | null | undefined } = {},
): void {
    if (!_isPlainObject(entry) || !entry.t) {
        throw new ValueError("entry must be a dict with non-empty 't' key");
    }
    if (entry.t === 'header') {
        throw new ValueError('use init() to write the header, not append()');
    }
    const target = options.path ?? file_path();
    if (!('ts' in entry)) {
        entry.ts = _now();
    }
    const session = options.session;
    if (session !== undefined && session !== null) {
        entry.s = session;
    } else if (!('s' in entry) && _session_tag_enabled()) {
        entry.s = _last_body_session_id(target);
    }
    if (_is_replay_mode()) {
        return;
    }
    fs.appendFileSync(target, _pyDumps(entry) + '\n', { encoding: 'utf-8' });
}

function _atomic_write_text(target: string, text: string): void {
    if (_is_replay_mode()) {
        return;
    }
    const suffix = path.extname(target);
    const uniq = `${process.pid}.${createHash('sha256')
        .update(`${process.pid}:${Date.now()}:${Math.random()}`)
        .digest('hex')
        .slice(0, 8)}`;
    const tmp = target.slice(0, target.length - suffix.length) + `${suffix}.${uniq}.tmp`;
    try {
        fs.writeFileSync(tmp, text, { encoding: 'utf-8' });
        fs.renameSync(tmp, target);
    } catch (exc) {
        try {
            fs.unlinkSync(tmp);
        } catch {
            /* ignore */
        }
        throw exc;
    }
}

function _normalize_entries(entries: Entry[]): Entry[] {
    const out: Entry[] = [];
    for (const raw of entries || []) {
        if (!_isPlainObject(raw) || !raw.t) {
            throw new ValueError("each entry must be a dict with non-empty 't' key");
        }
        if (raw.t === 'header') {
            throw new ValueError('entries must not contain headers');
        }
        const e: Entry = { ...raw };
        if (!('ts' in e)) {
            e.ts = _now();
        }
        out.push(e);
    }
    return out;
}

export function reset_with_entries(
    entries: Entry[],
    freq = 'per_phase',
    options: { path?: string | null } = {},
): Entry {
    if (!VALID_FREQS.has(freq)) {
        throw new ValueError(`freq must be one of ${_pyReprSortedList(VALID_FREQS)}`);
    }
    const target = options.path ?? file_path();
    const header = _build_header(freq);
    const body = _normalize_entries(entries);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const lines = [_pyDumps(header), ...body.map((e) => _pyDumps(e))];
    _atomic_write_text(target, lines.join('\n') + '\n');
    return header;
}

export function prepend_entries(entries: Entry[], options: { path?: string | null } = {}): number {
    const target = options.path ?? file_path();
    if (!_isFile(target)) {
        throw new FileNotFoundError(`no file at ${target}`);
    }
    const existing = _readLinesKeepNewline(target);
    if (existing.length === 0) {
        throw new ValueError(`empty file at ${target}`);
    }
    const header_line = existing[0] as string;
    const body = existing.slice(1);
    const new_lines = _normalize_entries(entries).map((e) => _pyDumps(e) + '\n');
    _atomic_write_text(target, header_line + new_lines.join('') + body.join(''));
    return new_lines.length;
}

/** Mirror Python readlines() — keep the trailing "\n" on each line. */
function _readLinesKeepNewline(p: string): string[] {
    const raw = fs.readFileSync(p, 'utf-8');
    if (raw === '') {
        return [];
    }
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '\n') {
            out.push(raw.slice(start, i + 1));
            start = i + 1;
        }
    }
    if (start < raw.length) {
        out.push(raw.slice(start));
    }
    return out;
}

export function clear(options: { path?: string | null } = {}): void {
    if (_is_replay_mode()) {
        return;
    }
    const target = options.path ?? file_path();
    if (fs.existsSync(target)) {
        fs.unlinkSync(target);
    }
}

// ---------------------------------------------------------------------
// read_entries / read_entries_for_current / list_sessions / status
// ---------------------------------------------------------------------

export function read_entries(
    options: {
        last?: number | null | undefined;
        path?: string | null | undefined;
        session?: string | null | undefined;
        agent?: string | null | undefined;
    } = {},
): Entry[] {
    const target = options.path ?? file_path();
    const last = options.last ?? null;
    const session = options.session ?? null;
    const agent = options.agent ?? null;
    if (!_isFile(target)) {
        return [];
    }
    let entries: Entry[] = [];
    const lines = _readLines(target);
    for (let i = 0; i < lines.length; i++) {
        const line = _strip(lines[i] ?? '');
        if (!line) {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (i === 0 && _isPlainObject(obj) && obj.t === 'header') {
            continue;
        }
        if (_isPlainObject(obj)) {
            entries.push(obj);
        }
    }
    if (session !== null) {
        entries = entries.filter((e) => e.s === session);
    }
    if (agent !== null) {
        if (agent === AGENT_UNKNOWN) {
            entries = entries.filter((e) => !e.agent);
        } else {
            entries = entries.filter((e) => e.agent === agent);
        }
    }
    if (last !== null && last >= 0) {
        entries = entries.slice(entries.length - last);
    }
    return entries;
}

export function read_entries_for_current(
    options: { path?: string | null; last?: number | null } = {},
): Entry[] {
    const target = options.path ?? file_path();
    const last = options.last ?? null;
    const kill = (process.env.AGENT_CHAT_HISTORY_SESSION_FILTER ?? 'true').trim().toLowerCase();
    if (kill === 'false') {
        return read_entries({ last, path: target, session: null });
    }
    return read_entries({ last, path: target, session: _last_body_session_id(target) });
}

interface SessionBucket extends Entry {
    id: string;
    count: number;
    first_ts: string | null;
    last_ts: string | null;
    preview: string;
    agents: string[];
    summary?: string;
    _head?: Entry[];
    _tail?: Entry[];
    _preview_from?: string;
}

export function list_sessions(
    options: { path?: string | null; summary?: boolean } = {},
): Entry[] {
    const target = options.path ?? file_path();
    const summary = options.summary ?? false;
    const buckets = new Map<string, SessionBucket>();

    const _bucket = (sid: string): SessionBucket => {
        let b = buckets.get(sid);
        if (b === undefined) {
            b = { id: sid, count: 0, first_ts: null, last_ts: null, preview: '', agents: [] };
            if (summary) {
                b._head = [];
                b._tail = [];
            }
            buckets.set(sid, b);
        }
        return b;
    };

    if (_isFile(target)) {
        const lines = _readLines(target);
        for (let i = 0; i < lines.length; i++) {
            const line = _strip(lines[i] ?? '');
            if (!line) {
                continue;
            }
            let obj: unknown;
            try {
                obj = JSON.parse(line);
            } catch {
                continue;
            }
            if (!_isPlainObject(obj)) {
                continue;
            }
            if (i === 0 && obj.t === 'header') {
                continue;
            }
            const rawSid = obj.s;
            const sid = typeof rawSid === 'string' && rawSid ? rawSid : SESSION_ID_LEGACY;
            const b = _bucket(sid);
            b.count += 1;
            const agent = typeof obj.agent === 'string' ? obj.agent : null;
            const tag = agent ? agent : AGENT_UNKNOWN;
            if (!b.agents.includes(tag)) {
                b.agents.push(tag);
            }
            const ts = obj.ts;
            if (typeof ts === 'string' && ts) {
                if (b.first_ts === null || ts < b.first_ts) {
                    b.first_ts = ts;
                }
                if (b.last_ts === null || ts > b.last_ts) {
                    b.last_ts = ts;
                }
            }
            if (summary) {
                if ((b._head as Entry[]).length < 5) {
                    (b._head as Entry[]).push(obj);
                }
                const tail = b._tail as Entry[];
                tail.push(obj);
                if (tail.length > 5) {
                    tail.shift();
                }
            }
            if (!b.preview || b._preview_from !== 'user') {
                if (obj.t === 'user') {
                    const payload = _isPlainObject(obj.payload) ? obj.payload : {};
                    const text = (obj.text || payload.text || '') as unknown;
                    if (typeof text === 'string' && text) {
                        b.preview = _preview(text);
                        b._preview_from = 'user';
                    }
                } else if (!b.preview) {
                    const text = (obj.text || '') as unknown;
                    if (typeof text === 'string' && text) {
                        b.preview = _preview(text);
                        b._preview_from = 'any';
                    }
                }
            }
        }
    }

    const out: SessionBucket[] = [];
    for (const b of buckets.values()) {
        delete b._preview_from;
        b.agents = [...b.agents].sort(_pyStrCompare);
        if (summary) {
            const head = (b._head as Entry[]) ?? [];
            const tail = (b._tail as Entry[]) ?? [];
            delete b._head;
            delete b._tail;
            b.summary = _summarize_session(head, tail, b.count);
        }
        out.push(b);
    }
    out.sort((a, b) => _pyStrCompare(b.last_ts || '', a.last_ts || ''));
    return out;
}

export function status(options: { path?: string | null } = {}): Entry {
    const target = options.path ?? file_path();
    if (!_isFile(target)) {
        return { exists: false, path: target };
    }
    const header = read_header(target);
    let entry_count = 0;
    const per_agent = new Map<string, number>();
    const lines = _readLines(target);
    for (let i = 0; i < lines.length; i++) {
        const line = _strip(lines[i] ?? '');
        if (!line) {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (!_isPlainObject(obj)) {
            continue;
        }
        if (i === 0 && obj.t === 'header') {
            continue;
        }
        entry_count += 1;
        const agent = typeof obj.agent === 'string' ? obj.agent : null;
        const tag = agent ? agent : AGENT_UNKNOWN;
        per_agent.set(tag, (per_agent.get(tag) ?? 0) + 1);
    }
    const size = _statSize(target);
    const sortedAgents = [...per_agent.entries()].sort((a, b) => _pyStrCompare(a[0], b[0]));
    const per_agent_obj: Record<string, number> = {};
    for (const [k, v] of sortedAgents) {
        per_agent_obj[k] = v;
    }
    const agents = { total: per_agent.size, per_agent: per_agent_obj };
    return {
        exists: true,
        path: target,
        size_bytes: size,
        size_kb: new PyFloat(_pyRound(size / 1024, 1)),
        entries: entry_count,
        header,
        agents,
    };
}

/** Mirror Python string comparison (by Unicode code point, lexicographic). */
function _pyStrCompare(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

// ---------------------------------------------------------------------
// Settings access
// ---------------------------------------------------------------------

function _load_chat_history_section(settings_path: string): Record<string, unknown> | null {
    const data = load_agent_settings({ project_path: settings_path });
    const section = (data as Record<string, unknown>).chat_history;
    return _isPlainObject(section) ? section : null;
}

function _read_chat_history_enabled(settings_path: string): boolean {
    const section = _load_chat_history_section(settings_path);
    if (section === null) {
        return false;
    }
    return _pyBool(section.enabled ?? false);
}

function _pyBool(v: unknown): boolean {
    if (v === null || v === undefined || v === false) {
        return false;
    }
    if (v === true) {
        return true;
    }
    if (typeof v === 'number') {
        return v !== 0;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (_isPlainObject(v)) {
        return Object.keys(v).length > 0;
    }
    return true;
}

// Hook events that the platform-hook wrapper accepts.
export const VALID_HOOK_EVENTS: readonly string[] = [
    'session_start',
    'session_end',
    'user_prompt',
    'agent_response',
    'tool_use',
    'phase',
    'stop',
];
const VALID_HOOK_EVENTS_SET = new Set(VALID_HOOK_EVENTS);

export const HOOK_EVENT_ENTRY_TYPE: Readonly<Record<string, string>> = {
    user_prompt: 'user',
    agent_response: 'agent',
    tool_use: 'tool',
    phase: 'phase',
    stop: 'agent',
    session_end: 'phase',
};

export const CADENCE_EVENTS: Readonly<Record<string, ReadonlySet<string>>> = {
    per_turn: new Set(['stop', 'agent_response', 'user_prompt']),
    per_phase: new Set(['phase', 'stop', 'user_prompt']),
    per_tool: new Set(['tool_use']),
};

export const PLATFORM_EVENT_MAP: Readonly<Record<string, Record<string, string>>> = {
    claude: {
        SessionStart: 'session_start',
        UserPromptSubmit: 'user_prompt',
        PostToolUse: 'tool_use',
        Stop: 'stop',
        SessionEnd: 'session_end',
        PreCompact: 'phase',
    },
    cowork: {
        SessionStart: 'session_start',
        UserPromptSubmit: 'user_prompt',
        PostToolUse: 'tool_use',
        Stop: 'stop',
        SessionEnd: 'session_end',
        PreCompact: 'phase',
    },
    augment: {
        SessionStart: 'session_start',
        Stop: 'stop',
        PostToolUse: 'tool_use',
        SessionEnd: 'session_end',
    },
    cursor: {
        sessionStart: 'session_start',
        sessionEnd: 'session_end',
        afterAgentResponse: 'agent_response',
        stop: 'stop',
        postToolUse: 'tool_use',
        beforeSubmitPrompt: 'user_prompt',
    },
    cline: {
        TaskStart: 'session_start',
        TaskComplete: 'session_end',
        UserPromptSubmit: 'user_prompt',
        PostToolUse: 'tool_use',
    },
    windsurf: {
        pre_user_prompt: 'user_prompt',
        post_cascade_response: 'agent_response',
        post_cascade_response_with_transcript: 'agent_response',
        post_setup_worktree: 'phase',
    },
    gemini: {
        SessionStart: 'session_start',
        AfterAgent: 'agent_response',
        AfterTool: 'tool_use',
        SessionEnd: 'session_end',
    },
    generic: Object.fromEntries(VALID_HOOK_EVENTS.map((ev) => [ev, ev])),
};
export const VALID_PLATFORMS: readonly string[] = Object.keys(PLATFORM_EVENT_MAP);

function _read_chat_history_frequency(settings_path: string): string {
    const section = _load_chat_history_section(settings_path);
    if (section === null) {
        return 'per_phase';
    }
    const val = String(section.frequency ?? 'per_phase').toLowerCase();
    return VALID_FREQS.has(val) ? val : 'per_phase';
}

function _read_chat_history_max_sessions(settings_path: string): number {
    const section = _load_chat_history_section(settings_path);
    if (section === null) {
        return DEFAULT_MAX_SESSIONS;
    }
    const rawN = section.max_sessions ?? DEFAULT_MAX_SESSIONS;
    let n: number;
    if (typeof rawN === 'number' && Number.isFinite(rawN)) {
        n = Math.trunc(rawN);
    } else if (typeof rawN === 'string') {
        const parsed = Number.parseInt(rawN, 10);
        if (Number.isNaN(parsed)) {
            return DEFAULT_MAX_SESSIONS;
        }
        n = parsed;
    } else {
        return DEFAULT_MAX_SESSIONS;
    }
    return Math.max(1, n);
}

function _read_text_limits(settings_path: string): Record<string, number> {
    const out: Record<string, number> = { ...DEFAULT_TEXT_LIMITS };
    const section = _load_chat_history_section(settings_path);
    if (section === null) {
        return out;
    }
    const overrides = section.text_limits;
    if (!_isPlainObject(overrides)) {
        return out;
    }
    for (const [kind, val] of Object.entries(overrides)) {
        let n: number;
        if (typeof val === 'number' && Number.isFinite(val)) {
            n = Math.trunc(val);
        } else if (typeof val === 'string') {
            const parsed = Number.parseInt(val, 10);
            if (Number.isNaN(parsed)) {
                continue;
            }
            n = parsed;
        } else {
            continue;
        }
        out[kind] = Math.max(0, n);
    }
    return out;
}

function _apply_text_limit(text: string, kind: string, limits: Record<string, number>): string {
    if (!text) {
        return '';
    }
    const n = limits[kind] ?? DEFAULT_TEXT_LIMITS[kind] ?? 0;
    if (n <= 0) {
        return text;
    }
    const flat = _strip(text.replace(_WS_RE, ' '));
    if (_pyLen(flat) <= n) {
        return flat;
    }
    return `${_pySliceTo(flat, n)} … [+${_pyLen(flat) - n} chars]`;
}

// ---------------------------------------------------------------------
// prune_sessions / overflow_handle
// ---------------------------------------------------------------------

export function prune_sessions(
    max_sessions = DEFAULT_MAX_SESSIONS,
    options: { path?: string | null } = {},
): Entry {
    if (max_sessions < 1) {
        max_sessions = 1;
    }
    const target = options.path ?? file_path();
    if (!_isFile(target)) {
        return { action: 'noop', kept_sessions: 0, dropped_sessions: 0, dropped_entries: 0 };
    }
    const lines = _readLinesKeepNewline(target);
    if (lines.length <= 1) {
        return { action: 'noop', kept_sessions: 0, dropped_sessions: 0, dropped_entries: 0 };
    }
    const header_line = lines[0] as string;
    const body = lines.slice(1);
    const last_pos = new Map<string, number>();
    const parsed: Array<[string, string]> = [];
    for (let idx = 0; idx < body.length; idx++) {
        const line = body[idx] as string;
        const stripped = _strip(line);
        if (!stripped) {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(stripped);
        } catch {
            parsed.push([SESSION_ID_LEGACY, line]);
            last_pos.set(SESSION_ID_LEGACY, idx);
            continue;
        }
        if (!_isPlainObject(obj)) {
            continue;
        }
        const sid = typeof obj.s === 'string' ? obj.s : SESSION_ID_LEGACY;
        parsed.push([sid, line]);
        last_pos.set(sid, idx);
    }
    if (last_pos.size <= max_sessions) {
        return {
            action: 'noop',
            kept_sessions: last_pos.size,
            dropped_sessions: 0,
            dropped_entries: 0,
        };
    }
    const ranked = [...last_pos.entries()].sort((a, b) => b[1] - a[1]);
    const keep_set = new Set(ranked.slice(0, max_sessions).map(([sid]) => sid));
    const drop_set = new Set(ranked.slice(max_sessions).map(([sid]) => sid));
    const kept_lines = parsed.filter(([sid]) => keep_set.has(sid)).map(([, line]) => line);
    const dropped_entries = parsed.length - kept_lines.length;
    _atomic_write_text(target, header_line + kept_lines.join(''));
    return {
        action: 'pruned',
        kept_sessions: keep_set.size,
        dropped_sessions: drop_set.size,
        dropped_entries,
    };
}

export function overflow_handle(
    max_kb: number,
    mode = 'rotate',
    options: { path?: string | null } = {},
): Entry {
    if (!VALID_OVERFLOW.has(mode)) {
        throw new ValueError(`mode must be one of ${_pyReprSortedList(VALID_OVERFLOW)}`);
    }
    const target = options.path ?? file_path();
    if (!_isFile(target) || _statSize(target) <= max_kb * 1024) {
        return { action: 'noop', kept: null, dropped: 0 };
    }
    const lines = _readLinesKeepNewline(target);
    if (lines.length === 0) {
        return { action: 'noop', kept: 0, dropped: 0 };
    }
    const header_line = lines[0] as string;
    const entries = lines.slice(1);
    if (mode === 'rotate') {
        const budget = max_kb * 1024 - Buffer.byteLength(header_line, 'utf-8');
        const kept: string[] = [];
        let total = 0;
        for (let i = entries.length - 1; i >= 0; i--) {
            const line = entries[i] as string;
            const size = Buffer.byteLength(line, 'utf-8');
            if (total + size > budget) {
                break;
            }
            kept.push(line);
            total += size;
        }
        kept.reverse();
        const dropped = entries.length - kept.length;
        _atomic_write_text(target, header_line + kept.join(''));
        return { action: 'rotate', kept: kept.length, dropped };
    }
    const marker: Entry = {
        t: 'needs_condense',
        ts: _now(),
        reason: `file exceeded ${max_kb} KB, condense-mode requested`,
    };
    append(marker, { path: target });
    return { action: 'condense_marked', kept: entries.length, dropped: 0 };
}

// ---------------------------------------------------------------------
// hook_append / hook_dispatch + per-platform extractors
// ---------------------------------------------------------------------

export function hook_append(
    event: string,
    options: {
        session_id?: string | null | undefined;
        payload?: Entry | null | undefined;
        path?: string | null | undefined;
        settings_path?: string | null | undefined;
        dry_run?: boolean | undefined;
    } = {},
): Entry {
    if (!VALID_HOOK_EVENTS_SET.has(event)) {
        throw new ValueError(`event must be one of ${_pyReprSortedListArr(VALID_HOOK_EVENTS)}`);
    }
    const dry_run = options.dry_run ?? false;
    const sp = options.settings_path ?? DEFAULT_SETTINGS_FILE;
    if (!_read_chat_history_enabled(sp)) {
        const out: Entry = { action: 'disabled', event };
        if (dry_run) {
            out.dry_run = true;
        }
        return out;
    }
    const target = options.path ?? file_path();
    const payload = options.payload ?? {};
    const session_id = options.session_id ?? null;
    const s_tag = session_id ? derive_session_tag(session_id) : SESSION_ID_UNKNOWN;

    const prior_s = _isFile(target) ? _last_body_session_id(target) : SESSION_ID_UNKNOWN;
    const is_new_session =
        s_tag !== SESSION_ID_UNKNOWN && prior_s !== SESSION_ID_UNKNOWN && prior_s !== s_tag;
    if (is_new_session) {
        process.stderr.write(
            `chat-history session_rotation event=${event} prior_s=${prior_s} new_s=${s_tag}\n`,
        );
    }

    if (!dry_run) {
        if (!_isFile(target) || read_header(target) === null) {
            const freq = _read_chat_history_frequency(sp);
            init(freq, { path: target });
        } else {
            migrate_header(target, { freq: _read_chat_history_frequency(sp) });
        }
    }

    const _maybe_prune = (): void => {
        if (dry_run || !is_new_session) {
            return;
        }
        const max_n = _read_chat_history_max_sessions(sp);
        try {
            prune_sessions(max_n, { path: target });
        } catch (exc) {
            process.stderr.write(`chat-history prune_failed: ${_excStr(exc)}\n`);
        }
    };

    if (event === 'session_start') {
        _maybe_prune();
        const action = 'session_start_noop';
        const out: Entry = { action: dry_run ? 'dry_run' : action, event, s: s_tag };
        if (dry_run) {
            out.would_action = action;
            out.dry_run = true;
        }
        return out;
    }
    if (event === 'session_end') {
        _maybe_prune();
        const action = 'session_end_noop';
        const out: Entry = { action: dry_run ? 'dry_run' : action, event, s: s_tag };
        if (dry_run) {
            out.would_action = action;
            out.dry_run = true;
        }
        return out;
    }

    const freq = _read_chat_history_frequency(sp);
    if (!(CADENCE_EVENTS[freq] ?? new Set<string>()).has(event)) {
        const out: Entry = { action: 'skipped_cadence', event, frequency: freq };
        if (dry_run) {
            out.dry_run = true;
        }
        return out;
    }

    const entry_type = HOOK_EVENT_ENTRY_TYPE[event] ?? 'agent';
    const limits = _read_text_limits(sp);
    const entry: Entry = { t: entry_type };
    const text = String((payload as Entry).text ?? '');
    if (text) {
        const sliced = _apply_text_limit(text, entry_type, limits);
        if (sliced) {
            entry.text = sliced;
        }
    }
    if (event === 'tool_use') {
        const tool = (payload as Entry).tool;
        if (tool) {
            entry.tool = String(tool);
        }
    }
    for (const k of ['agent', 'source', 'phase', 'decision']) {
        const v = (payload as Entry)[k];
        if (v) {
            entry[k] = String(v);
        }
    }
    if (dry_run) {
        const preview: Entry = { ...entry };
        preview.s = s_tag;
        return {
            action: 'dry_run',
            would_action: 'appended',
            event,
            type: entry_type,
            s: s_tag,
            entry_preview: preview,
            dry_run: true,
        };
    }
    append(entry, { path: target, session: s_tag });
    _maybe_prune();
    return { action: 'appended', event, type: entry_type, s: s_tag };
}

function _extract_augment_conversation(payload: Entry): [string, string] {
    const conv = payload.conversation;
    if (!_isPlainObject(conv)) {
        return ['', ''];
    }
    const user = conv.userPrompt;
    const agent = conv.agentTextResponse;
    const user_s = typeof user === 'string' ? _strip(user) : '';
    const agent_s = typeof agent === 'string' ? _strip(agent) : '';
    return [user_s, agent_s];
}

function _extract_claude_transcript_response(transcript_path: string): string {
    if (!transcript_path) {
        return '';
    }
    if (!_isFile(transcript_path)) {
        return '';
    }
    let last_text = '';
    let lines: string[];
    try {
        lines = _readLines(transcript_path);
    } catch {
        return '';
    }
    for (const rawLine of lines) {
        const line = _strip(rawLine);
        if (!line) {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (!_isPlainObject(obj)) {
            continue;
        }
        if (obj.type !== 'assistant') {
            continue;
        }
        const msg = obj.message;
        if (!_isPlainObject(msg)) {
            continue;
        }
        const content = msg.content;
        if (typeof content === 'string') {
            last_text = content;
        } else if (Array.isArray(content)) {
            const parts: string[] = [];
            for (const blk of content) {
                if (_isPlainObject(blk) && blk.type === 'text') {
                    const t = blk.text ?? '';
                    if (typeof t === 'string') {
                        parts.push(t);
                    }
                }
            }
            if (parts.length > 0) {
                last_text = parts.join('\n');
            }
        }
    }
    return _strip(last_text);
}

function _extract_cursor_text(payload: Entry, event: string | null): string {
    if (event === 'stop' || event === 'agent_response') {
        const tp = payload.transcript_path ?? payload.transcriptPath;
        if (typeof tp === 'string') {
            const txt = _extract_claude_transcript_response(tp);
            if (txt) {
                return txt;
            }
        }
    }
    return '';
}

function _extract_cline_text(payload: Entry, event: string | null): string {
    if (event === 'user_prompt') {
        const v = payload.prompt ?? payload.userPrompt;
        if (typeof v === 'string' && _strip(v)) {
            return _strip(v);
        }
    }
    return '';
}

function _extract_gemini_text(payload: Entry, event: string | null): string {
    if (event === 'agent_response' || event === 'stop') {
        const v = payload.prompt_response ?? payload.promptResponse;
        if (typeof v === 'string' && _strip(v)) {
            return _strip(v);
        }
        const tp = payload.transcript_path ?? payload.transcriptPath;
        if (typeof tp === 'string') {
            const txt = _extract_claude_transcript_response(tp);
            if (txt) {
                return txt;
            }
        }
    }
    return '';
}

function _extract_windsurf_text(payload: Entry, event: string | null): string {
    if (event === 'agent_response' || event === 'stop') {
        const info = payload.tool_info ?? payload.toolInfo;
        if (_isPlainObject(info)) {
            const v = info.response ?? info.text;
            if (typeof v === 'string' && _strip(v)) {
                return _strip(v);
            }
        }
        const tp = payload.transcript_path ?? payload.transcriptPath;
        if (typeof tp === 'string') {
            const txt = _extract_claude_transcript_response(tp);
            if (txt) {
                return txt;
            }
        }
    }
    return '';
}

function _extract_hook_text(
    payload: Entry,
    options: { platform?: string | null; event?: string | null } = {},
): string {
    const platform = options.platform ?? null;
    const event = options.event ?? null;
    if (platform === 'augment') {
        const [user, agent] = _extract_augment_conversation(payload);
        if (event === 'user_prompt' && user) {
            return user;
        }
        if ((event === 'stop' || event === 'agent_response') && agent) {
            return agent;
        }
        if (agent) {
            return agent;
        }
        if (user) {
            return user;
        }
    }
    if ((platform === 'claude' || platform === 'cowork') && (event === 'stop' || event === 'agent_response')) {
        const tp = payload.transcript_path ?? payload.transcriptPath;
        if (typeof tp === 'string') {
            const txt = _extract_claude_transcript_response(tp);
            if (txt) {
                return txt;
            }
        }
    }
    if (platform === 'cursor') {
        const txt = _extract_cursor_text(payload, event);
        if (txt) {
            return txt;
        }
    }
    if (platform === 'cline') {
        const txt = _extract_cline_text(payload, event);
        if (txt) {
            return txt;
        }
    }
    if (platform === 'gemini') {
        const txt = _extract_gemini_text(payload, event);
        if (txt) {
            return txt;
        }
    }
    if (platform === 'windsurf') {
        const txt = _extract_windsurf_text(payload, event);
        if (txt) {
            return txt;
        }
    }
    for (const key of [
        'prompt',
        'user_prompt',
        'first_user_msg',
        'firstUserMsg',
        'userMessage',
        'user_message',
        'text',
        'response',
        'message',
        'content',
    ]) {
        const v = payload[key];
        if (typeof v === 'string' && _strip(v)) {
            return _strip(v);
        }
    }
    const tr = payload.tool_response ?? payload.toolResponse;
    if (_isPlainObject(tr)) {
        for (const key of ['output', 'stdout', 'result', 'text']) {
            const v = tr[key];
            if (typeof v === 'string' && _strip(v)) {
                return _strip(v);
            }
        }
    }
    return '';
}

function _extract_hook_tool(payload: Entry): string {
    for (const key of ['tool_name', 'toolName', 'tool']) {
        const v = payload[key];
        if (typeof v === 'string' && _strip(v)) {
            return _strip(v);
        }
    }
    return '';
}

function _extract_hook_event(payload: Entry): string {
    for (const key of ['hook_event_name', 'event', 'eventName', 'event_name']) {
        const v = payload[key];
        if (typeof v === 'string' && _strip(v)) {
            return _strip(v);
        }
    }
    return '';
}

function _extract_session_id(payload: Entry): string {
    for (const key of ['session_id', 'sessionId', 'task_id', 'taskId', 'conversation_id', 'conversationId']) {
        const v = payload[key];
        if (typeof v === 'string' && _strip(v)) {
            return _strip(v);
        }
    }
    return '';
}

export function hook_dispatch(
    platform: string,
    raw_json: string,
    options: {
        event_override?: string | null;
        path?: string | null;
        settings_path?: string | null;
        dry_run?: boolean;
    } = {},
): Entry {
    if (!(platform in PLATFORM_EVENT_MAP)) {
        throw new ValueError(
            `unknown platform: ${_pyRepr(platform)}; expected one of ${_pyReprSortedListArr(VALID_PLATFORMS)}`,
        );
    }
    const event_override = options.event_override ?? null;
    const dry_run = options.dry_run ?? false;
    const raw = _strip(raw_json || '');
    let payload: Entry;
    if (!raw) {
        payload = {};
    } else {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (exc) {
            throw new ValueError(`invalid JSON on stdin: ${_excStr(exc)}`);
        }
        if (!_isPlainObject(parsed)) {
            throw new ValueError('stdin JSON must decode to an object');
        }
        payload = parsed;
    }

    let envelope_event = '';
    if (['schema_version', 'platform', 'event', 'payload'].every((k) => k in payload)) {
        envelope_event = _strip(
            String((payload.native_event as unknown) || (payload.event as unknown) || ''),
        );
        const inner = payload.payload;
        payload = _isPlainObject(inner) ? inner : {};
    }

    const raw_event = _strip(
        String(event_override || envelope_event || _extract_hook_event(payload) || ''),
    );
    const event = (PLATFORM_EVENT_MAP[platform] as Record<string, string>)[raw_event];
    if (!event) {
        return { action: 'skipped_unmapped_event', platform, raw_event };
    }

    const text = _extract_hook_text(payload, { platform, event });
    const tool = _extract_hook_tool(payload);
    const session_id = _extract_session_id(payload);

    let augment_user_prompt = '';
    if (platform === 'augment' && event === 'stop') {
        const [u] = _extract_augment_conversation(payload);
        augment_user_prompt = u;
    }

    const hook_payload: Entry = {
        source: `hook:${platform}:${raw_event}`,
        agent: platform,
    };
    if (text && event !== 'session_start') {
        hook_payload.text = text;
    }
    if (tool) {
        hook_payload.tool = tool;
    }

    if (augment_user_prompt) {
        hook_append('user_prompt', {
            session_id,
            payload: {
                text: augment_user_prompt,
                source: `hook:${platform}:${raw_event}:user`,
                agent: platform,
            },
            path: options.path,
            settings_path: options.settings_path,
            dry_run,
        });
    }

    return hook_append(event, {
        session_id,
        payload: hook_payload,
        path: options.path,
        settings_path: options.settings_path,
        dry_run,
    });
}

// ---------------------------------------------------------------------
// Errors mirroring Python exceptions
// ---------------------------------------------------------------------

/** Mirror Python's `ValueError`. */
export class ValueError extends Error {}
/** Mirror Python's `FileNotFoundError`. */
export class FileNotFoundError extends Error {}

function _excStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/** Mirror Python `repr(str)` for simple single-quoted strings (sufficient for the choices used here). */
function _pyRepr(s: string): string {
    if (!s.includes("'") || s.includes('"')) {
        return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return `'${s}'`;
}

function _pyReprSortedList(set: ReadonlySet<string>): string {
    const items = [...set].sort(_pyStrCompare);
    return `[${items.map((i) => _pyRepr(i)).join(', ')}]`;
}

function _pyReprSortedListArr(arr: readonly string[]): string {
    const items = [...arr].sort(_pyStrCompare);
    return `[${items.map((i) => _pyRepr(i)).join(', ')}]`;
}

// ---------------------------------------------------------------------
// CLI — argparse-faithful for the exercised surface
// ---------------------------------------------------------------------

const PROG = 'chat_history.py';
const SUBCMDS = [
    'init',
    'append',
    'status',
    'reset',
    'prune-sessions',
    'prepend',
    'clear',
    'read',
    'sessions',
    'rotate',
    'hook-append',
    'hook-dispatch',
];

function _print(line: string): void {
    process.stdout.write(line + '\n');
}

function _eprint(line: string): void {
    process.stderr.write(line + '\n');
}

/** argparse top-level usage block (80-col wrap, deterministic). */
const _TOP_USAGE =
    `usage: ${PROG} [-h]\n` +
    `                       {${SUBCMDS.join(',')}}\n` +
    `                       ...\n`;

function _argError(usage: string, prog: string, message: string): number {
    process.stderr.write(usage);
    process.stderr.write(`${prog}: error: ${message}\n`);
    return EXIT_BAD_ARGS;
}

function _cmd_init(argv: string[]): number {
    let freq = 'per_phase';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--freq') {
            freq = (argv[i + 1] as string) ?? freq;
            i += 1;
        } else if (a.startsWith('--freq=')) {
            freq = a.slice('--freq='.length);
        }
    }
    if (!VALID_FREQS.has(freq)) {
        return _argError(
            `usage: ${PROG} init [-h] [--freq {per_phase,per_tool,per_turn}]\n`,
            `${PROG} init`,
            `argument --freq: invalid choice: ${_pyRepr(freq)} (choose from 'per_phase', 'per_tool', 'per_turn')`,
        );
    }
    const h = init(freq);
    _print(_pyDumps(h));
    return 0;
}

function _cmd_hook_append(argv: string[]): number {
    let event: string | null = null;
    let session_id: string | null = null;
    let payloadRaw: string | null = null;
    let settings: string | null = null;
    let dry_run = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--event') {
            event = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--event=')) {
            event = a.slice('--event='.length);
        } else if (a === '--session-id') {
            session_id = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--session-id=')) {
            session_id = a.slice('--session-id='.length);
        } else if (a === '--payload') {
            payloadRaw = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--payload=')) {
            payloadRaw = a.slice('--payload='.length);
        } else if (a === '--settings') {
            settings = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--settings=')) {
            settings = a.slice('--settings='.length);
        } else if (a === '--dry-run') {
            dry_run = true;
        }
    }
    // argparse: --event is required + choices-validated before the handler.
    const _hookAppendUsage =
        `usage: ${PROG} hook-append [-h] --event\n` +
        `                                {agent_response,phase,session_end,session_start,stop,tool_use,user_prompt}\n` +
        `                                [--session-id SESSION_ID]\n` +
        `                                [--payload PAYLOAD] [--settings SETTINGS]\n` +
        `                                [--dry-run]\n`;
    if (event === null) {
        return _argError(_hookAppendUsage, `${PROG} hook-append`, 'the following arguments are required: --event');
    }
    if (!VALID_HOOK_EVENTS_SET.has(event)) {
        const choices = [...VALID_HOOK_EVENTS].sort(_pyStrCompare).map((c) => _pyRepr(c)).join(', ');
        return _argError(
            _hookAppendUsage,
            `${PROG} hook-append`,
            `argument --event: invalid choice: ${_pyRepr(event)} (choose from ${choices})`,
        );
    }
    let payload: Entry = {};
    if (payloadRaw) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(payloadRaw);
        } catch (exc) {
            _eprint(`error: --payload must be valid JSON: ${_excStr(exc)}`);
            return EXIT_BAD_ARGS;
        }
        if (!_isPlainObject(parsed)) {
            _eprint('error: --payload must decode to a JSON object');
            return EXIT_BAD_ARGS;
        }
        payload = parsed;
    }
    try {
        const result = hook_append(event, {
            session_id,
            payload,
            settings_path: settings,
            dry_run,
        });
        _print(_pyDumps(result));
    } catch (exc) {
        if (exc instanceof ValueError) {
            _eprint(`error: ${exc.message}`);
            return EXIT_BAD_ARGS;
        }
        throw exc;
    }
    return EXIT_OK;
}

function _cmd_hook_dispatch(argv: string[]): number {
    let platform: string | null = null;
    let event: string | null = null;
    let settings: string | null = null;
    let dry_run = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--platform') {
            platform = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--platform=')) {
            platform = a.slice('--platform='.length);
        } else if (a === '--event') {
            event = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--event=')) {
            event = a.slice('--event='.length);
        } else if (a === '--settings') {
            settings = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--settings=')) {
            settings = a.slice('--settings='.length);
        } else if (a === '--dry-run') {
            dry_run = true;
        }
    }
    // argparse: --platform is required + choices-validated before the handler.
    const _hookDispatchUsage =
        `usage: ${PROG} hook-dispatch [-h] --platform\n` +
        `                                     {augment,claude,cline,cowork,cursor,gemini,generic,windsurf}\n` +
        `                                     [--event EVENT] [--settings SETTINGS]\n` +
        `                                     [--dry-run]\n`;
    if (platform === null) {
        return _argError(
            _hookDispatchUsage,
            `${PROG} hook-dispatch`,
            'the following arguments are required: --platform',
        );
    }
    if (!(platform in PLATFORM_EVENT_MAP)) {
        const choices = [...VALID_PLATFORMS].sort(_pyStrCompare).map((c) => _pyRepr(c)).join(', ');
        return _argError(
            _hookDispatchUsage,
            `${PROG} hook-dispatch`,
            `argument --platform: invalid choice: ${_pyRepr(platform)} (choose from ${choices})`,
        );
    }
    const raw = _readStdin();
    try {
        const result = hook_dispatch(platform, raw, {
            event_override: event,
            settings_path: settings,
            dry_run,
        });
        _print(_pyDumps(result));
    } catch (exc) {
        if (exc instanceof ValueError) {
            _eprint(`error: ${exc.message}`);
            return EXIT_BAD_ARGS;
        }
        throw exc;
    }
    return EXIT_OK;
}

function _cmd_append(argv: string[]): number {
    let type_: string | null = null;
    let jsonRaw: string | null = null;
    let session_id: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--type') {
            type_ = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--type=')) {
            type_ = a.slice('--type='.length);
        } else if (a === '--json') {
            jsonRaw = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--json=')) {
            jsonRaw = a.slice('--json='.length);
        } else if (a === '--session-id') {
            session_id = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--session-id=')) {
            session_id = a.slice('--session-id='.length);
        }
    }
    const entry: Entry = jsonRaw ? (JSON.parse(jsonRaw) as Entry) : {};
    if (!('t' in entry)) {
        entry.t = type_;
    }
    if (!entry.t) {
        _eprint("error: --type or a 't' key in --json is required");
        return EXIT_BAD_ARGS;
    }
    const session = session_id ? derive_session_tag(session_id) : null;
    append(entry, { session });
    return EXIT_OK;
}

function _cmd_status(): number {
    _print(_pyDumpsIndent2(status()));
    return 0;
}

function _loadEntriesArg(entriesJson: string | null, entriesStdin: boolean): Entry[] {
    const raw = entriesStdin ? _readStdin() : entriesJson || '[]';
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch (exc) {
        throw new ValueError(`invalid JSON for entries: ${_excStr(exc)}`);
    }
    if (!Array.isArray(data)) {
        throw new ValueError('entries must be a JSON array');
    }
    return data as Entry[];
}

function _cmd_reset(argv: string[]): number {
    let freq = 'per_phase';
    let entriesJson: string | null = null;
    let entriesStdin = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--freq') {
            freq = (argv[++i] as string) ?? freq;
        } else if (a.startsWith('--freq=')) {
            freq = a.slice('--freq='.length);
        } else if (a === '--entries-json') {
            entriesJson = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--entries-json=')) {
            entriesJson = a.slice('--entries-json='.length);
        } else if (a === '--entries-stdin') {
            entriesStdin = true;
        }
    }
    if (!VALID_FREQS.has(freq)) {
        return _argError(
            `usage: ${PROG} reset [-h] [--freq {per_phase,per_tool,per_turn}]\n` +
                `                            (--entries-json ENTRIES_JSON | --entries-stdin)\n`,
            `${PROG} reset`,
            `argument --freq: invalid choice: ${_pyRepr(freq)} (choose from 'per_phase', 'per_tool', 'per_turn')`,
        );
    }
    if (entriesJson === null && !entriesStdin) {
        return _argError(
            `usage: ${PROG} reset [-h] [--freq {per_phase,per_tool,per_turn}]\n` +
                `                            (--entries-json ENTRIES_JSON | --entries-stdin)\n`,
            `${PROG} reset`,
            'one of the arguments --entries-json --entries-stdin is required',
        );
    }
    const entries = _loadEntriesArg(entriesJson, entriesStdin);
    const h = reset_with_entries(entries, freq);
    _print(_pyDumps(h));
    return 0;
}

function _cmd_prune_sessions(argv: string[]): number {
    let maxSessions: number | null = null;
    let settings: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--max-sessions') {
            maxSessions = _pyIntFromAny((argv[++i] as string) ?? '');
        } else if (a.startsWith('--max-sessions=')) {
            maxSessions = _pyIntFromAny(a.slice('--max-sessions='.length));
        } else if (a === '--settings') {
            settings = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--settings=')) {
            settings = a.slice('--settings='.length);
        }
    }
    let max_n: number;
    if (maxSessions !== null) {
        max_n = Math.max(1, maxSessions);
    } else {
        const sp = settings ?? DEFAULT_SETTINGS_FILE;
        max_n = _read_chat_history_max_sessions(sp);
    }
    const result = prune_sessions(max_n);
    _print(_pyDumps(result));
    return EXIT_OK;
}

function _cmd_prepend(argv: string[]): number {
    let entriesJson: string | null = null;
    let entriesStdin = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--entries-json') {
            entriesJson = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--entries-json=')) {
            entriesJson = a.slice('--entries-json='.length);
        } else if (a === '--entries-stdin') {
            entriesStdin = true;
        }
    }
    if (entriesJson === null && !entriesStdin) {
        return _argError(
            `usage: ${PROG} prepend [-h] (--entries-json ENTRIES_JSON | --entries-stdin)\n`,
            `${PROG} prepend`,
            'one of the arguments --entries-json --entries-stdin is required',
        );
    }
    const entries = _loadEntriesArg(entriesJson, entriesStdin);
    const n = prepend_entries(entries);
    _print(_pyDumps({ prepended: n }));
    return 0;
}

function _cmd_clear(): number {
    clear();
    return 0;
}

function _cmd_read(argv: string[]): number {
    let last = 5;
    let lastSeen = false;
    let all = false;
    let session: string | null = null;
    let agent: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--last') {
            last = _pyIntFromAny((argv[++i] as string) ?? '');
            lastSeen = true;
        } else if (a.startsWith('--last=')) {
            last = _pyIntFromAny(a.slice('--last='.length));
            lastSeen = true;
        } else if (a === '--all') {
            all = true;
        } else if (a === '--session') {
            session = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--session=')) {
            session = a.slice('--session='.length);
        } else if (a === '--agent') {
            agent = (argv[++i] as string) ?? null;
        } else if (a.startsWith('--agent=')) {
            agent = a.slice('--agent='.length);
        }
    }
    if (lastSeen && all) {
        return _argError(
            `usage: ${PROG} read [-h] [--last LAST | --all] [--session SESSION]\n` +
                `                            [--agent AGENT]\n`,
            `${PROG} read`,
            'argument --all: not allowed with argument --last',
        );
    }
    const lastArg = all ? null : last;
    let entries: Entry[];
    if (all) {
        entries = read_entries({ last: lastArg, session: null, agent });
    } else if (session !== null) {
        entries = read_entries({ last: lastArg, session, agent });
    } else if (agent !== null) {
        const sid = _last_body_session_id(file_path());
        entries = read_entries({ last: lastArg, session: sid, agent });
    } else {
        entries = read_entries_for_current({ last: lastArg });
    }
    _print(_pyDumpsIndent2(entries));
    return 0;
}

function _cmd_sessions(argv: string[]): number {
    let limit = 20;
    let includeEmpty = false;
    let json = false;
    let summary = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--limit') {
            limit = _pyIntFromAny((argv[++i] as string) ?? '');
        } else if (a.startsWith('--limit=')) {
            limit = _pyIntFromAny(a.slice('--limit='.length));
        } else if (a === '--include-empty') {
            includeEmpty = true;
        } else if (a === '--json') {
            json = true;
        } else if (a === '--summary') {
            summary = true;
        }
    }
    let sessions = list_sessions({ summary }) as SessionBucket[];
    if (!includeEmpty) {
        sessions = sessions.filter((s) => s.count > 0);
    }
    sessions = sessions.slice(0, limit);
    if (json) {
        _print(_pyDumpsIndent2(sessions));
        return 0;
    }
    if (sessions.length === 0) {
        _print('(no sessions)');
        return 0;
    }
    const lastCol = summary ? 'SUMMARY' : 'PREVIEW';
    const rows: string[][] = [['ID', 'COUNT', 'AGENTS', 'LAST_TS', lastCol]];
    for (const s of sessions) {
        const lastVal = summary ? s.summary : s.preview;
        const agentsVal = (s.agents || []).join(',') || '-';
        rows.push([s.id, String(s.count), agentsVal, s.last_ts || '-', lastVal || '-']);
    }
    const widths: number[] = [];
    for (let i = 0; i < 5; i++) {
        widths.push(Math.max(...rows.map((r) => _pyLen(r[i] as string))));
    }
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i] as string[];
        const line = r.map((c, j) => _ljust(c, widths[j] as number)).join('  ');
        _print(line);
        if (i === 0) {
            _print(widths.map((w) => '-'.repeat(w)).join('  '));
        }
    }
    return 0;
}

function _cmd_rotate(argv: string[]): number {
    let maxKb = 256;
    let mode = 'rotate';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--max-kb') {
            maxKb = _pyIntFromAny((argv[++i] as string) ?? '');
        } else if (a.startsWith('--max-kb=')) {
            maxKb = _pyIntFromAny(a.slice('--max-kb='.length));
        } else if (a === '--mode') {
            mode = (argv[++i] as string) ?? mode;
        } else if (a.startsWith('--mode=')) {
            mode = a.slice('--mode='.length);
        }
    }
    if (!VALID_OVERFLOW.has(mode)) {
        return _argError(
            `usage: ${PROG} rotate [-h] [--max-kb MAX_KB]\n` +
                `                              [--mode {condense,rotate}]\n`,
            `${PROG} rotate`,
            `argument --mode: invalid choice: ${_pyRepr(mode)} (choose from 'condense', 'rotate')`,
        );
    }
    const result = overflow_handle(maxKb, mode);
    _print(_pyDumps(result));
    return 0;
}

function _readStdin(): string {
    try {
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const cmd = argv[0];
    if (cmd === undefined) {
        return _argError(_TOP_USAGE, PROG, 'the following arguments are required: cmd');
    }
    if (!SUBCMDS.includes(cmd)) {
        const choices = SUBCMDS.map((c) => _pyRepr(c)).join(', ');
        return _argError(
            _TOP_USAGE,
            PROG,
            `argument cmd: invalid choice: ${_pyRepr(cmd)} (choose from ${choices})`,
        );
    }
    const rest = argv.slice(1);
    switch (cmd) {
        case 'init':
            return _cmd_init(rest);
        case 'append':
            return _cmd_append(rest);
        case 'status':
            return _cmd_status();
        case 'reset':
            return _cmd_reset(rest);
        case 'prune-sessions':
            return _cmd_prune_sessions(rest);
        case 'prepend':
            return _cmd_prepend(rest);
        case 'clear':
            return _cmd_clear();
        case 'read':
            return _cmd_read(rest);
        case 'sessions':
            return _cmd_sessions(rest);
        case 'rotate':
            return _cmd_rotate(rest);
        case 'hook-append':
            return _cmd_hook_append(rest);
        case 'hook-dispatch':
            return _cmd_hook_dispatch(rest);
        default:
            return EXIT_BAD_ARGS;
    }
}

const _invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_invokedDirectly) {
    try {
        process.exitCode = main();
    } catch (exc) {
        if (exc instanceof ValueError || exc instanceof FileNotFoundError) {
            // Python would surface an uncaught traceback (exit 1); mirror the
            // non-zero exit. The message goes to stderr like a traceback tail.
            process.stderr.write(`${exc.constructor.name}: ${exc.message}\n`);
            process.exitCode = 1;
        } else {
            throw exc;
        }
    }
}
