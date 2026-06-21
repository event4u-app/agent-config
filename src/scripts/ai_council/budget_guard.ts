/**
 * Per-day rolling cost-budget guard for the council (D3).
 *
 * TypeScript twin of `src/scripts/ai_council/budget_guard.py` (ADR-200 —
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
 * Contract (verbatim from the Python module):
 * - The ledger is **append-only**. Each line is `{"ts": ISO-8601 UTC,
 *   "usd": float, "provider": str, "model": str}`.
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
}

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
 */
function _dumpEntry(ts: string, usd: number, provider: string, model: string): string {
    return (
        `{${_pyJsonString('ts')}: ${_pyJsonString(ts)}, ` +
        `${_pyJsonString('usd')}: ${pyFloatRepr(usd)}, ` +
        `${_pyJsonString('provider')}: ${_pyJsonString(provider)}, ` +
        `${_pyJsonString('model')}: ${_pyJsonString(model)}}`
    );
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
        out.push({
            ts,
            usd,
            provider: _toStr(record.provider, ''),
            model: _toStr(record.model, ''),
        });
    }
    return out;
}

/** `str(obj.get("ts", ""))` — the timestamp is read as a string before parsing. */
function _rawStr(v: unknown): string {
    if (v === undefined) {
        return '';
    }
    return _toStr(v, '');
}

/** Sum of USD spent in the last `windowHours` (rolling window). */
export function today_spend_usd(
    options: { path?: string | null; now?: number | null; windowHours?: number } = {},
): number {
    const path_ = options.path ?? null;
    const nowMs = options.now ?? _nowUtcMs();
    const windowHours = options.windowHours ?? ROLLING_WINDOW_HOURS;
    const cutoff = nowMs - windowHours * 3600 * 1000;
    let total = 0;
    for (const e of read_entries(path_)) {
        if (e.ts >= cutoff) {
            total += e.usd;
        }
    }
    return total;
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
    options: { path?: string | null; now?: number | null } = {},
): boolean {
    if (usd <= 0) {
        return true; // zero-cost calls (manual mode) skip the ledger
    }
    const p = options.path ?? LEDGER_PATH;
    if (!_ensureLedgerDir(p)) {
        return false;
    }
    const nowMs = options.now ?? _nowUtcMs();
    const ts = nowUtcIso(nowMs);
    const entry = `${_dumpEntry(ts, _pyRound6(usd), provider, model)}\n`;
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
