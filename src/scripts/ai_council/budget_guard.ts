/**
 * Per-day rolling cost-budget guard for the council (D3).
 *
 * Ported from the retired Python `src/scripts/ai_council/budget_guard.py` (ADR-200 —
 * Python→TS migration, Phase 1; ai_council FOUNDATION wave). Mirrors the
 * Python public surface exactly (snake_case kept deliberately):
 * `LEDGER_FILENAME`, `LEDGER_PATH`, `ROLLING_WINDOW_HOURS`, `SpendEntry`,
 * `read_entries`, `today_spend_usd`, `would_exceed`, `record_spend`.
 *
 * Adds a 24h-rolling-window USD limit on top of the per-session caps. The
 * ledger lives in `~/.event4u/agent-config/council-spend.jsonl` (mode 0600,
 * same permission discipline as the API keys). The legacy
 * `~/.config/agent-config/council-spend.jsonl` is read as a fallback.
 *
 * Contract (verbatim from the Python module, plus the additive TS-only
 * cache extension below):
 * - The ledger is **append-only**. Each line is `{"ts": ISO-8601 UTC,
 *   "usd": float, "provider": str, "model": str}`, optionally followed by
 *   `"cache_read_input_tokens": int, "cache_creation_input_tokens": int,
 *   "cache_ttl": "5m"|"1h"` when the caller reports cache activity — absent
 *   on every entry recorded before this extension shipped. A billable call
 *   with no price row is written as `"usd": null, …, "unpriced": true,
 *   "input_tokens": int, "output_tokens": int` (TS-only; reads as 0 in the sum).
 *   With a daily ceiling set, rows also carry `"state"`, `"reservation_id"`,
 *   `"run_id"` (and `"expires_at"` on `reserved`); see `reserve_spend`.
 * - `today_spend_usd()` sums entries within the last 24h from "now".
 * - `would_exceed(limit_usd, next_call_usd)` returns true iff the next call
 *   would push the rolling window past the limit.
 * - `record_spend(usd, provider, model)` appends one entry; never raises on
 *   disk failure (logs to stderr, returns false).
 *
 * PARITY NOTES
 * - The JSONL line is emitted with `json.dumps(...)` default separators
 *   (`", "` and `": "`), insertion order (NOT sorted) — see `_dumpEntry`.
 * - `round(usd, 6)` is a Python float; rendered via `pyFloatRepr` so small
 *   values keep Python's scientific notation (`1e-06`, `5e-07`) and
 *   integral values keep the trailing `.0` (`1.0`). JS `String()` diverges
 *   on both — see `pyFloatRepr`.
 * - `datetime.fromisoformat` / `.isoformat()` round-trip is mirrored by
 *   `parseIso` / `nowUtcIso`; the rolling-window comparison is done on the
 *   epoch-millisecond value so DST / tz offsets behave like Python's
 *   tz-aware comparison.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as user_global_paths from '../_lib/user_global_paths.js';

export const LEDGER_FILENAME = 'council-spend.jsonl';

/**
 * Canonical write target under the new namespace. Reads route via
 * `_resolveLedgerPath` so a ledger still sitting in the legacy
 * `~/.config/agent-config/` tree keeps contributing to the rolling window
 * until the user migrates.
 */
export const LEDGER_PATH = user_global_paths.write_target(LEDGER_FILENAME);
export const ROLLING_WINDOW_HOURS = 24;

/**
 * Return the active ledger path, preferring the new namespace.
 *
 * A caller-supplied `path` always wins (tests pin a tmp file). When no
 * override is given we prefer the new namespace, then fall back to the
 * legacy location if a ledger file already exists there. New writes always
 * target the new namespace via `LEDGER_PATH`.
 */
function _resolveLedgerPath(p: string | null): string {
    if (p !== null) {
        return p;
    }
    const found = user_global_paths.resolve_with_fallback(LEDGER_FILENAME);
    if (found !== null) {
        return found;
    }
    return LEDGER_PATH;
}

export interface SpendEntry {
    /** Epoch milliseconds (UTC). Mirrors Python's tz-aware datetime for the rolling-window comparison. */
    ts: number;
    usd: number;
    provider: string;
    model: string;
    // Prompt-cache accounting (additive — absent on entries recorded before
    // this field existed, and on calls with no cache activity to report).
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    /** Write-multiplier TTL tier in effect when this entry was recorded. */
    cache_ttl?: '5m' | '1h';
    /** A billable call with no price row: `usd` reads as 0, the row says it is unknown. */
    unpriced?: true;
    input_tokens?: number;
    output_tokens?: number;
    /**
     * Reservation rows (road-to-unknowns-that-say-so Phase 3), written only
     * while a daily ceiling is set. Absent on every plain spend row.
     */
    state?: SpendState;
    reservation_id?: string;
    run_id?: string;
    /** Epoch ms after which an open `reserved` row closes as `unreconciled`. */
    expires_at?: number;
}

/**
 * `reserved` → one of the three terminal states, never back. `unreconciled`
 * is a reservation whose outcome nobody learned — it keeps its estimate,
 * because an unknown is never a zero.
 */
export type SpendState = 'reserved' | 'completed' | 'released' | 'unreconciled';
export type TerminalSpendState = Exclude<SpendState, 'reserved'>;

function _nowUtcMs(): number {
    return Date.now();
}

/** Create the ledger's parent directory mode 0700 if missing. */
function _ensureLedgerDir(p: string): boolean {
    const parent = path.dirname(p);
    try {
        fs.mkdirSync(parent, { recursive: true });
        let mode: number;
        try {
            mode = fs.statSync(parent).mode & 0o777;
        } catch {
            mode = 0o700;
        }
        if (mode !== 0o700) {
            try {
                fs.chmodSync(parent, 0o700);
            } catch {
                // On macOS ~/.config may inherit umask perms; do not block.
            }
        }
        return true;
    } catch (exc) {
        // never block the orchestrator
        process.stderr.write(`[council:budget_guard] mkdir failed: ${_errStr(exc)}\n`);
        return false;
    }
}

/** Make sure an existing ledger file is mode 0600. Best-effort. */
function _ensureLedgerFileMode(p: string): void {
    if (!fs.existsSync(p)) {
        return;
    }
    let current: number;
    try {
        current = fs.statSync(p).mode & 0o777;
    } catch {
        return;
    }
    if (current !== 0o600) {
        try {
            fs.chmodSync(p, 0o600);
        } catch {
            // best-effort
        }
    }
}

/**
 * Parse an ISO-8601 timestamp like Python's `datetime.fromisoformat`.
 *
 * Returns epoch milliseconds (UTC) or `null` on failure. We only ever write
 * timestamps with an explicit `+00:00` (or offset) via `nowUtcIso`, so the
 * subset of ISO that `Date.parse` accepts after offset-normalisation is
 * sufficient. A bare (offset-less) timestamp is treated as naive — Python's
 * `fromisoformat` keeps it tz-naive, which would raise on comparison against
 * a tz-aware cutoff; we mirror that by rejecting offset-less strings (they
 * never appear in a ledger this module wrote).
 */
function parseIso(ts: string): number | null {
    if (ts === '') {
        return null;
    }
    // Python fromisoformat requires the 'T' separator on full datetimes; it
    // also accepts a space separator since 3.11. Be permissive here but keep
    // the offset requirement so naive timestamps are rejected (see docstring).
    const hasOffset = /([+-]\d{2}:\d{2}|[+-]\d{4}|Z)$/u.test(ts);
    if (!hasOffset) {
        return null;
    }
    const ms = Date.parse(ts);
    if (Number.isNaN(ms)) {
        return null;
    }
    return ms;
}

/** Current time as an ISO-8601 string with explicit `+00:00`, matching Python's `.isoformat()`. */
function nowUtcIso(nowMs: number): string {
    const d = new Date(nowMs);
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const mi = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    const us = d.getUTCMilliseconds();
    // Python isoformat omits the fractional part when microseconds == 0, and
    // emits 6-digit microseconds otherwise. JS only has millisecond
    // resolution; render as 6 digits (ms * 1000) to stay shape-compatible.
    const frac = us === 0 ? '' : `.${pad(us, 3)}000`;
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${frac}+00:00`;
}

/** Stringify a thrown value for the stderr breadcrumb. */
function _errStr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/**
 * Render a number like Python's `repr(float)` (the encoder json.dumps uses).
 *
 * - `0` → `"0.0"`.
 * - `abs(x)` in `[1e-4, 1e16)` → fixed notation via `String(x)`, with a
 *   trailing `.0` appended for integral values (Python floats keep it).
 * - otherwise → scientific notation with Python's exponent format
 *   (explicit sign, ≥2 exponent digits): `1e-06`, `5e-07`, `1e+16`.
 *
 * JS `String()` diverges from Python on both the small-value scientific
 * boundary (`0.000001` vs `1e-06`) and integral floats (`1` vs `1.0`).
 */
function pyFloatRepr(x: number): string {
    if (!Number.isFinite(x)) {
        if (Number.isNaN(x)) {
            return 'NaN';
        }
        return x > 0 ? 'Infinity' : '-Infinity';
    }
    if (x === 0) {
        // Python repr(0.0) == "0.0"; repr(-0.0) == "-0.0".
        return Object.is(x, -0) ? '-0.0' : '0.0';
    }
    const abs = Math.abs(x);
    if (abs >= 1e-4 && abs < 1e16) {
        const s = String(x);
        return Number.isInteger(x) ? `${s}.0` : s;
    }
    // Scientific notation. toExponential() yields the shortest mantissa.
    const exp = x.toExponential();
    const m = exp.match(/^(-?)(\d(?:\.\d+)?)e([+-])(\d+)$/u);
    if (m === null) {
        return exp;
    }
    const [, sign, mant, esign, edig] = m as unknown as [string, string, string, string, string];
    const padded = edig.length < 2 ? `0${edig}` : edig;
    return `${sign}${mant}e${esign}${padded}`;
}

/**
 * Escape a string like Python's `json.dumps` with `ensure_ascii=True`:
 * short escapes for `"`, `\`, control chars; `\uXXXX` for every UTF-16 code
 * unit outside 0x20–0x7E.
 */
function _pyJsonString(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i += 1) {
        const code = s.charCodeAt(i);
        const ch = s[i] as string;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (code >= 0x20 && code <= 0x7e) {
            out += ch;
        } else {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        }
    }
    return `${out}"`;
}

/**
 * Serialise one ledger entry the way Python's
 * `json.dumps({"ts": ts, "usd": round(usd, 6), "provider": provider,
 * "model": model})` does: default separators (`", "`, `": "`), insertion
 * order (NOT sorted). `usd` is a float (`pyFloatRepr`); the rest are strings.
 *
 * The three cache params are appended only when the CALLER passed them
 * (`!== undefined`) — a call with none of the three reproduces the original
 * 4-key line byte-for-byte, which is what keeps every pre-existing caller
 * (and the python3 byte-parity test, which has no Python-side cache
 * counterpart) unaffected by this additive extension.
 */
function _dumpEntry(
    ts: string,
    usd: number | null,
    provider: string,
    model: string,
    cacheRead?: number,
    cacheWrite?: number,
    cacheTtl?: '5m' | '1h',
    unpricedTokens?: { input: number; output: number },
    reservation?: { state: SpendState; id: string; run_id: string; expires_at?: number },
): string {
    let body =
        `${_pyJsonString('ts')}: ${_pyJsonString(ts)}, ` +
        `${_pyJsonString('usd')}: ${usd === null ? 'null' : pyFloatRepr(usd)}, ` +
        `${_pyJsonString('provider')}: ${_pyJsonString(provider)}, ` +
        `${_pyJsonString('model')}: ${_pyJsonString(model)}`;
    if (cacheRead !== undefined) {
        body += `, ${_pyJsonString('cache_read_input_tokens')}: ${Math.trunc(cacheRead)}`;
    }
    if (cacheWrite !== undefined) {
        body += `, ${_pyJsonString('cache_creation_input_tokens')}: ${Math.trunc(cacheWrite)}`;
    }
    if (cacheTtl !== undefined) {
        body += `, ${_pyJsonString('cache_ttl')}: ${_pyJsonString(cacheTtl)}`;
    }
    if (unpricedTokens !== undefined) {
        body +=
            `, ${_pyJsonString('unpriced')}: true` +
            `, ${_pyJsonString('input_tokens')}: ${Math.trunc(unpricedTokens.input)}` +
            `, ${_pyJsonString('output_tokens')}: ${Math.trunc(unpricedTokens.output)}`;
    }
    if (reservation !== undefined) {
        body +=
            `, ${_pyJsonString('state')}: ${_pyJsonString(reservation.state)}` +
            `, ${_pyJsonString('reservation_id')}: ${_pyJsonString(reservation.id)}` +
            `, ${_pyJsonString('run_id')}: ${_pyJsonString(reservation.run_id)}`;
        if (reservation.expires_at !== undefined) {
            body += `, ${_pyJsonString('expires_at')}: ${_pyJsonString(nowUtcIso(reservation.expires_at))}`;
        }
    }
    return `{${body}}`;
}

/** Coerce a parsed JSON value to a float like Python's `float(obj.get(...))`. */
function _toFloat(v: unknown): number | null {
    if (typeof v === 'number') {
        return v;
    }
    if (typeof v === 'boolean') {
        // Python float(True) == 1.0, float(False) == 0.0.
        return v ? 1.0 : 0.0;
    }
    if (typeof v === 'string') {
        const t = v.trim();
        if (t === '') {
            return null;
        }
        // Python float() accepts inf/nan spellings; the ledger only ever
        // holds plain decimals, but mirror the permissive cast.
        const lower = t.toLowerCase();
        if (lower === 'inf' || lower === 'infinity' || lower === '+inf' || lower === '+infinity') {
            return Infinity;
        }
        if (lower === '-inf' || lower === '-infinity') {
            return -Infinity;
        }
        if (lower === 'nan' || lower === '+nan' || lower === '-nan') {
            return NaN;
        }
        const n = Number(t);
        return Number.isNaN(n) ? null : n;
    }
    return null;
}

/** Coerce to string like Python's `str(obj.get(key, default))`. */
function _toStr(v: unknown, dflt: string): string {
    if (v === undefined) {
        return dflt;
    }
    if (v === null) {
        return 'None';
    }
    if (typeof v === 'string') {
        return v;
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    if (typeof v === 'number') {
        return pyNumToStr(v);
    }
    return String(v);
}

/** `str()` of a JSON number value (int → "1", float → repr). */
function pyNumToStr(n: number): string {
    return Number.isInteger(n) ? String(n) : pyFloatRepr(n);
}

/**
 * Read every well-formed entry from the ledger.
 *
 * Malformed lines are skipped silently. Empty/missing ledger → []. Reads
 * route through `_resolveLedgerPath` so a legacy ledger keeps contributing
 * to the rolling window until the user migrates.
 */
export function read_entries(p: string | null = null): SpendEntry[] {
    const resolved = _resolveLedgerPath(p);
    if (!fs.existsSync(resolved)) {
        return [];
    }
    const out: SpendEntry[] = [];
    const text = fs.readFileSync(resolved, 'utf-8');
    for (const rawLine of text.split(/\r\n|\r|\n/u)) {
        const line = rawLine.trim();
        if (line === '') {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            // `obj.get(...)` on a non-dict would raise → Python's broad guards
            // do not cover it, but a non-object JSON line never originates from
            // this writer; skip to stay robust (matches read-loop intent).
            continue;
        }
        const record = obj as Record<string, unknown>;
        const ts = parseIso(_rawStr(record.ts));
        if (ts === null) {
            continue;
        }
        const usd = _toFloat(record.usd ?? 0);
        if (usd === null) {
            continue;
        }
        const entry: SpendEntry = {
            ts,
            usd,
            provider: _toStr(record.provider, ''),
            model: _toStr(record.model, ''),
        };
        // exactOptionalPropertyTypes forbids `key: undefined` on an object
        // literal — assign conditionally so a legacy (or cache-less) line
        // leaves these keys absent rather than present-but-undefined.
        const cacheRead = _toOptionalNonNegInt(record.cache_read_input_tokens);
        if (cacheRead !== undefined) {
            entry.cache_read_input_tokens = cacheRead;
        }
        const cacheWrite = _toOptionalNonNegInt(record.cache_creation_input_tokens);
        if (cacheWrite !== undefined) {
            entry.cache_creation_input_tokens = cacheWrite;
        }
        const cacheTtl = _toOptionalTtl(record.cache_ttl);
        if (cacheTtl !== undefined) {
            entry.cache_ttl = cacheTtl;
        }
        if (record.unpriced === true) {
            entry.unpriced = true;
            const inTok = _toOptionalNonNegInt(record.input_tokens);
            if (inTok !== undefined) entry.input_tokens = inTok;
            const outTok = _toOptionalNonNegInt(record.output_tokens);
            if (outTok !== undefined) entry.output_tokens = outTok;
        }
        const state = _toSpendState(record.state);
        if (state !== undefined && typeof record.reservation_id === 'string') {
            entry.state = state;
            entry.reservation_id = record.reservation_id;
            entry.run_id = _toStr(record.run_id, '');
            const expires = parseIso(_rawStr(record.expires_at));
            if (expires !== null) entry.expires_at = expires;
        }
        out.push(entry);
    }
    return out;
}

/** A non-negative finite number, or `undefined` when absent/malformed. */
function _toOptionalNonNegInt(v: unknown): number | undefined {
    if (v === undefined || v === null) {
        return undefined;
    }
    const n = _toFloat(v);
    return n === null || n < 0 ? undefined : n;
}

function _toSpendState(v: unknown): SpendState | undefined {
    return v === 'reserved' || v === 'completed' || v === 'released' || v === 'unreconciled'
        ? v
        : undefined;
}

/** `'5m' | '1h'`, or `undefined` for anything else (including absent). */
function _toOptionalTtl(v: unknown): '5m' | '1h' | undefined {
    return v === '5m' || v === '1h' ? v : undefined;
}

/** `str(obj.get("ts", ""))` — the timestamp is read as a string before parsing. */
function _rawStr(v: unknown): string {
    if (v === undefined) {
        return '';
    }
    return _toStr(v, '');
}

/**
 * The rolling window's priced sum, with the count of unpriced billable calls
 * beside it. The sum alone would let an unknown read as nothing spent.
 */
export function today_spend_summary(
    options: { path?: string | null; now?: number | null; windowHours?: number } = {},
): { usd: number; unpriced_calls: number } {
    const path_ = options.path ?? null;
    const nowMs = options.now ?? _nowUtcMs();
    const windowHours = options.windowHours ?? ROLLING_WINDOW_HOURS;
    const cutoff = nowMs - windowHours * 3600 * 1000;
    let total = 0;
    let unpriced = 0;
    const entries = read_entries(path_);
    const closed = _terminalIds(entries);
    for (const e of entries) {
        // An open reservation counts at its estimate; once a terminal row
        // exists that row carries the amount, so the reservation drops out.
        if (e.ts >= cutoff && !(e.state === 'reserved' && closed.has(e.reservation_id ?? ''))) {
            total += e.usd;
            if (e.unpriced) unpriced += 1;
        }
    }
    return { usd: total, unpriced_calls: unpriced };
}

/** Sum of USD spent in the last `windowHours` (rolling window). */
export function today_spend_usd(
    options: { path?: string | null; now?: number | null; windowHours?: number } = {},
): number {
    return today_spend_summary(options).usd;
}

/**
 * True iff appending `nextCallUsd` would push the window past `limitUsd`.
 *
 * `limitUsd <= 0` disables the guard (returns false). Mirrors the
 * `CostBudget.max_total_usd` convention.
 */
export function would_exceed(
    limitUsd: number,
    nextCallUsd: number,
    options: { path?: string | null; now?: number | null; windowHours?: number } = {},
): boolean {
    if (limitUsd <= 0) {
        return false;
    }
    const spent = today_spend_usd(options);
    return spent + nextCallUsd > limitUsd;
}

/** Append one entry to the ledger. Returns true on success. */
export function record_spend(
    usd: number,
    provider: string,
    model: string,
    options: {
        path?: string | null;
        now?: number | null;
        // Additive prompt-cache accounting (Step B). Omitting all three
        // reproduces the original 4-field ledger line exactly.
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_ttl?: '5m' | '1h';
        // A BILLABLE call whose model has no price row (road-to-unknowns-that-
        // say-so 2.3). Its `usd` is not zero, it is unknown, so it is written
        // as `usd: null, unpriced: true` with the tokens it used — never
        // dropped beside the subscription calls the early return below skips.
        unpriced?: boolean;
        input_tokens?: number;
        output_tokens?: number;
    } = {},
): boolean {
    const unpriced = options.unpriced === true;
    if (usd <= 0 && !unpriced) {
        return true; // zero-cost calls (manual mode) skip the ledger
    }
    const p = options.path ?? LEDGER_PATH;
    if (!_ensureLedgerDir(p)) {
        return false;
    }
    const nowMs = options.now ?? _nowUtcMs();
    const ts = nowUtcIso(nowMs);
    const entry = `${_dumpEntry(
        ts,
        unpriced ? null : _pyRound6(usd),
        provider,
        model,
        options.cache_read_input_tokens,
        options.cache_creation_input_tokens,
        options.cache_ttl,
        unpriced ? { input: options.input_tokens ?? 0, output: options.output_tokens ?? 0 } : undefined,
    )}\n`;
    try {
        fs.appendFileSync(p, entry, { encoding: 'utf-8' });
    } catch (exc) {
        // never block the orchestrator
        process.stderr.write(`[council:budget_guard] write failed: ${_errStr(exc)}\n`);
        return false;
    }
    _ensureLedgerFileMode(p);
    return true;
}

/** Reservation ids that already have a terminal row. */
function _terminalIds(entries: readonly SpendEntry[]): Set<string> {
    const out = new Set<string>();
    for (const e of entries) {
        if (e.state !== undefined && e.state !== 'reserved' && e.reservation_id !== undefined) {
            out.add(e.reservation_id);
        }
    }
    return out;
}

/** How long a reservation lock is waited for, and when a held lock counts as crashed. */
export const RESERVATION_LOCK_WAIT_MS = 3000;
const RESERVATION_LOCK_STALE_MS = 10_000;

function _sleepMs(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run `fn` holding `<ledger>.lock`, created `O_EXCL`. Unlike the counter lock
 * in `cli_call_budget.ts`, a wait that runs out returns `null` instead of
 * proceeding unlocked: a ceiling checked without the lock is the race this
 * exists to close, so the caller refuses rather than guesses.
 */
function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
    if (!_ensureLedgerDir(p)) {
        return null;
    }
    const lockPath = `${p}.lock`;
    const started = Date.now();
    let fd: number | null = null;
    while (fd === null) {
        try {
            fd = fs.openSync(lockPath, 'wx', 0o600);
            break;
        } catch {
            try {
                if (Date.now() - fs.statSync(lockPath).mtimeMs > RESERVATION_LOCK_STALE_MS) {
                    fs.unlinkSync(lockPath);
                }
            } catch {
                // Released between the failed create and the stat — retry.
            }
        }
        if (Date.now() - started >= waitMs) {
            return null;
        }
        _sleepMs(15);
    }
    try {
        return fn();
    } finally {
        fs.closeSync(fd);
        try {
            fs.unlinkSync(lockPath);
        } catch {
            // Already gone is the end state wanted.
        }
    }
}

function _appendLine(p: string, line: string): boolean {
    try {
        fs.appendFileSync(p, `${line}\n`, { encoding: 'utf-8' });
    } catch (exc) {
        process.stderr.write(`[council:budget_guard] write failed: ${_errStr(exc)}\n`);
        return false;
    }
    _ensureLedgerFileMode(p);
    return true;
}

/**
 * Close every open reservation whose hold ran out as `unreconciled` at its
 * estimate (D8). Caller holds the lock. A killed run never reaches its own
 * close, so without this its reservation would hold budget forever.
 */
function _expireStale(p: string, entries: readonly SpendEntry[], nowMs: number): void {
    const closed = _terminalIds(entries);
    for (const e of entries) {
        if (
            e.state === 'reserved' &&
            e.reservation_id !== undefined &&
            !closed.has(e.reservation_id) &&
            e.expires_at !== undefined &&
            e.expires_at <= nowMs
        ) {
            closed.add(e.reservation_id);
            _appendLine(
                p,
                _dumpEntry(nowUtcIso(nowMs), _pyRound6(e.usd), e.provider, e.model,
                    undefined, undefined, undefined, undefined,
                    { state: 'unreconciled', id: e.reservation_id, run_id: e.run_id ?? '' }),
            );
        }
    }
}

/**
 * The effective state of every reservation in the ledger. An open one past
 * its hold reads `unreconciled` here even before a locked writer persists it.
 */
export function reservation_states(
    options: { path?: string | null; now?: number | null } = {},
): Map<string, SpendState> {
    const nowMs = options.now ?? _nowUtcMs();
    const out = new Map<string, SpendState>();
    for (const e of read_entries(options.path ?? null)) {
        if (e.state === undefined || e.reservation_id === undefined) continue;
        if (e.state !== 'reserved') {
            out.set(e.reservation_id, e.state);
        } else if (!out.has(e.reservation_id)) {
            const stale = e.expires_at !== undefined && e.expires_at <= nowMs;
            out.set(e.reservation_id, stale ? 'unreconciled' : 'reserved');
        }
    }
    return out;
}

export type ReserveResult = { ok: true; id: string } | { ok: false; reason: 'daily' | 'lock' };

/**
 * Check a daily ceiling and claim the estimate in ONE locked step.
 *
 * `would_exceed` reads the ledger and compares; two councils started together
 * both read the same remainder and both pass. Here the read, the comparison and
 * the `reserved` row happen under the ledger lock, and every later read counts
 * the open reservation at its estimate, so the second council sees the first.
 * Only meaningful with a ceiling set — the orchestrator never calls it otherwise.
 */
export function reserve_spend(
    limitUsd: number,
    estimateUsd: number,
    provider: string,
    model: string,
    options: {
        path?: string | null;
        now?: number | null;
        run_id: string;
        hold_ms: number;
        windowHours?: number;
        lock_wait_ms?: number;
    },
): ReserveResult {
    const p = options.path ?? LEDGER_PATH;
    const nowMs = options.now ?? _nowUtcMs();
    const verdict = _withLedgerLock(p, options.lock_wait_ms ?? RESERVATION_LOCK_WAIT_MS, (): ReserveResult => {
        _expireStale(p, read_entries(p), nowMs);
        const window = options.windowHours ?? ROLLING_WINDOW_HOURS;
        const spent = today_spend_usd({ path: p, now: nowMs, windowHours: window });
        if (limitUsd > 0 && spent + estimateUsd > limitUsd) {
            return { ok: false, reason: 'daily' };
        }
        const id = randomUUID();
        const line = _dumpEntry(nowUtcIso(nowMs), _pyRound6(estimateUsd), provider, model,
            undefined, undefined, undefined, undefined,
            { state: 'reserved', id, run_id: options.run_id, expires_at: nowMs + options.hold_ms });
        return _appendLine(p, line) ? { ok: true, id } : { ok: false, reason: 'lock' };
    });
    return verdict ?? { ok: false, reason: 'lock' };
}

/**
 * Append the terminal row for a reservation. `completed` carries the actual
 * amount, `released` zero, `unreconciled` the reservation's own estimate.
 * Returns false — and writes nothing — when the reservation is unknown or
 * already terminal: a terminal state never reopens.
 */
export function close_reservation(
    id: string,
    state: TerminalSpendState,
    options: {
        path?: string | null;
        now?: number | null;
        usd?: number;
        provider?: string;
        model?: string;
        lock_wait_ms?: number;
    } = {},
): boolean {
    const p = options.path ?? LEDGER_PATH;
    const nowMs = options.now ?? _nowUtcMs();
    const done = _withLedgerLock(p, options.lock_wait_ms ?? RESERVATION_LOCK_WAIT_MS, (): boolean => {
        _expireStale(p, read_entries(p), nowMs);
        const entries = read_entries(p);
        if (_terminalIds(entries).has(id)) return false;
        const reserved = entries.find((e) => e.state === 'reserved' && e.reservation_id === id);
        if (reserved === undefined) return false;
        const usd = state === 'completed' ? (options.usd ?? 0) : state === 'released' ? 0 : reserved.usd;
        return _appendLine(
            p,
            _dumpEntry(nowUtcIso(nowMs), _pyRound6(usd), options.provider ?? reserved.provider,
                options.model ?? reserved.model, undefined, undefined, undefined, undefined,
                { state, id, run_id: reserved.run_id ?? '' }),
        );
    });
    return done === true;
}

/**
 * `round(usd, 6)` with Python's round-half-to-even on the exact IEEE-754
 * value. Implemented via the 17-significant-digit decimal expansion so the
 * sub-half residue is judged faithfully (the naive `Math.round(x*1e6)/1e6`
 * snaps a sub-half residue up to an exact half on the multiply).
 */
function _pyRound6(value: number): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    const ndigits = 6;
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        const factor = 10 ** ndigits;
        return value > 0
            ? (Math.round(abs * factor) / factor) * sign
            : -Math.round(abs * factor) / factor;
    }
    const [intPart, fracPartRaw = ''] = str.split('.');
    let fracPart = fracPartRaw;
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keepFrac = fracPart.slice(0, ndigits);
    const deciderStr = fracPart.slice(ndigits);
    const scaledIntStr = (intPart ?? '') + keepFrac;
    let scaledInt = BigInt(scaledIntStr === '' ? '0' : scaledIntStr);
    const firstDecider = deciderStr.charAt(0);
    const restNonZero = /[1-9]/u.test(deciderStr.slice(1));
    let roundUp = false;
    if (firstDecider > '5' || (firstDecider === '5' && restNonZero)) {
        roundUp = true;
    } else if (firstDecider === '5' && !restNonZero) {
        roundUp = scaledInt % 2n === 1n;
    }
    if (roundUp) {
        scaledInt += 1n;
    }
    const result = Number(scaledInt) / 10 ** ndigits;
    return sign < 0 ? -result : result;
}
