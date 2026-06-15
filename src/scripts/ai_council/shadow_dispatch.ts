/**
 * Shadow-mode dispatch for low-impact solo-member decisions (step-9 P10).
 *
 * TypeScript twin of `src/scripts/ai_council/shadow_dispatch.py`
 * (ADR-200 — Python→TS migration, Phase 1).
 *
 * When `low_impact.dispatch: single` is active, a Bernoulli-sampled subset
 * of decisions is shadowed through the full council so disagreement between
 * the solo verdict and the council verdict can be measured. The shadow log
 * lives at `agents/runtime/council/shadow-log.jsonl` and is subject to the same
 * privacy floor as the low-impact corpus: redactor-refused entries are
 * dropped, not softened.
 *
 * The flip from `single` back to `full` is a user decision; this module
 * emits data and an SLO banner, nothing else.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { PyRandom } from '../_lib/py_random.js';
import { redact } from './bundler.js';
import { createHash } from 'node:crypto';

export const SHADOW_LOG_PATH = 'agents/runtime/council/shadow-log.jsonl';

export const SLO_THRESHOLD_WARN = 0.05;
export const SLO_THRESHOLD_BREACH = 0.08;

/**
 * One shadow decision row. `escalated` / `escalation_reason` come from the
 * step-9 P13 confidence gate; `escalated=True` distinguishes "gate-caught"
 * from "silent disagreement".
 */
export interface ShadowDecision {
    readonly timestamp: string;
    readonly query_hash: string;
    readonly solo_verdict: string;
    readonly full_verdict: string;
    readonly agreed: boolean;
    readonly escalated: boolean;
    readonly escalation_reason: string;
}

/** A random source exposing Python `random.random()` semantics. */
interface RandomLike {
    random(): number;
}

export interface ShouldShadowOptions {
    rng?: RandomLike | PyRandom | null;
}

export function should_shadow(sampleRate: number, opts: ShouldShadowOptions = {}): boolean {
    const rate = Math.max(0.0, Math.min(1.0, sampleRate));
    const rng = opts.rng ?? null;
    const r = rng !== null ? (rng as RandomLike) : _defaultRandom;
    return r.random() < rate;
}

/**
 * Module-default random source. Python uses the global `random` module when
 * no `rng` is passed — non-deterministic, never used in parity paths.
 */
const _defaultRandom: RandomLike = {
    random(): number {
        return Math.random();
    },
};

function _hashQuery(query: string): string {
    const redacted = redact(query);
    return createHash('sha256').update(Buffer.from(redacted, 'utf-8')).digest('hex').slice(0, 16);
}

function _privacyDropped(redacted: string): boolean {
    const stripped = _strip(redacted);
    if (!stripped) {
        return true;
    }
    return stripped.startsWith('[redacted');
}

export interface RecordShadowDecisionOptions {
    query: string;
    soloVerdict: string;
    fullVerdict: string;
    escalated?: boolean;
    escalationReason?: string;
}

/**
 * Append one JSONL row. Returns `null` when redaction would drop the entry
 * (privacy floor — do not soften).
 *
 * `escalated` / `escalationReason` come from the confidence gate (step-9 P13).
 * When true, `soloVerdict` is the rejected solo response and `fullVerdict` is
 * the council's verdict that actually answered the user.
 */
export function record_shadow_decision(
    logPath: string,
    opts: RecordShadowDecisionOptions,
): ShadowDecision | null {
    const query = opts.query;
    const soloVerdict = opts.soloVerdict;
    const fullVerdict = opts.fullVerdict;
    const escalated = opts.escalated ?? false;
    const escalationReason = opts.escalationReason ?? 'ok';

    const redactedQ = redact(query);
    if (_privacyDropped(redactedQ)) {
        return null;
    }

    const decision: ShadowDecision = {
        timestamp: _isoNowSeconds(),
        query_hash: _hashQuery(query),
        solo_verdict: soloVerdict,
        full_verdict: fullVerdict,
        agreed: soloVerdict === fullVerdict,
        escalated,
        escalation_reason: escalationReason,
    };
    fs.mkdirSync(_dirname(logPath), { recursive: true });
    const row =
        _pyJsonDumps({
            timestamp: decision.timestamp,
            query_hash: decision.query_hash,
            solo_verdict: decision.solo_verdict,
            full_verdict: decision.full_verdict,
            agreed: decision.agreed,
            escalated: decision.escalated,
            escalation_reason: decision.escalation_reason,
        }) + '\n';
    fs.appendFileSync(logPath, row, { encoding: 'utf-8' });
    return decision;
}

/** Mirror `datetime.now(timezone.utc).isoformat(timespec="seconds")`. */
function _isoNowSeconds(): string {
    const d = new Date();
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
    );
}

function* _iterLog(logPath: string): Generator<Record<string, unknown>> {
    if (!fs.existsSync(logPath)) {
        return;
    }
    const content = fs.readFileSync(logPath, { encoding: 'utf-8' });
    for (const rawLine of _splitlines(content)) {
        const line = _strip(rawLine);
        if (!line) {
            continue;
        }
        try {
            yield JSON.parse(line) as Record<string, unknown>;
        } catch {
            continue;
        }
    }
}

export interface ComputeRateOptions {
    windowDays?: number;
    now?: Date | null;
}

/**
 * `[disagreement_rate, sample_count]` over the rolling window.
 *
 * Counts a row as "disagreed" when `agreed=false` regardless of the
 * escalation flag — a gate-caught split is still a sign that solo mode was
 * wrong on that decision.
 */
export function compute_disagreement_rate(
    logPath: string,
    opts: ComputeRateOptions = {},
): [number, number] {
    const windowDays = opts.windowDays ?? 7;
    const nowMs = (opts.now ?? new Date()).getTime();
    const cutoff = nowMs - windowDays * 86400000;
    let total = 0;
    let disagreed = 0;
    for (const row of _iterLog(logPath)) {
        const rawTs = (row['timestamp'] as string) ?? '';
        const ts = _parseIsoUtcMs(rawTs);
        if (ts === null) {
            continue;
        }
        if (ts < cutoff) {
            continue;
        }
        total += 1;
        if (!_getBool(row['agreed'], true)) {
            disagreed += 1;
        }
    }
    if (total === 0) {
        return [0.0, 0];
    }
    return [disagreed / total, total];
}

/**
 * `[escalation_rate, sample_count]` — fraction with `escalated=true`.
 *
 * Step-9 P13 — separates gate-caught escalations from silent disagreement so
 * the banner can name the dominant failure mode.
 */
export function compute_escalation_rate(
    logPath: string,
    opts: ComputeRateOptions = {},
): [number, number] {
    const windowDays = opts.windowDays ?? 7;
    const nowMs = (opts.now ?? new Date()).getTime();
    const cutoff = nowMs - windowDays * 86400000;
    let total = 0;
    let escalated = 0;
    for (const row of _iterLog(logPath)) {
        const rawTs = (row['timestamp'] as string) ?? '';
        const ts = _parseIsoUtcMs(rawTs);
        if (ts === null) {
            continue;
        }
        if (ts < cutoff) {
            continue;
        }
        total += 1;
        if (_getBool(row['escalated'], false)) {
            escalated += 1;
        }
    }
    if (total === 0) {
        return [0.0, 0];
    }
    return [escalated / total, total];
}

export function slo_status(rate: number): string {
    if (rate < SLO_THRESHOLD_WARN) {
        return 'OK';
    }
    if (rate < SLO_THRESHOLD_BREACH) {
        return 'WARN';
    }
    return 'BREACH';
}

export interface SloBannerOptions {
    escalationRate?: number | null;
}

/**
 * One-line SLO banner. `escalationRate` is appended when given.
 *
 * Step-9 P13 — escalation tail surfaces the share of decisions the confidence
 * gate caught before they reached the user.
 */
export function slo_banner(rate: number, sampleCount: number, opts: SloBannerOptions = {}): string {
    const escalationRate = opts.escalationRate ?? null;
    const pct = rate * 100;
    const status = slo_status(rate);
    if (sampleCount === 0) {
        return '[shadow SLO] no samples yet';
    }
    let base: string;
    if (status === 'OK') {
        base =
            `[shadow SLO] OK · ${_fmt1(pct)}% disagreement over ` +
            `${sampleCount} samples (<5%)`;
    } else if (status === 'WARN') {
        base =
            `[shadow SLO] WARN · ${_fmt1(pct)}% disagreement over ` +
            `${sampleCount} samples (5–8% — consider reverting to ` +
            `low_impact.dispatch: full)`;
    } else {
        base =
            `[shadow SLO] BREACH · ${_fmt1(pct)}% disagreement over ` +
            `${sampleCount} samples (>8% — revert to ` +
            `low_impact.dispatch: full)`;
    }
    if (escalationRate !== null) {
        base += ` · ${_fmt1(escalationRate * 100)}% auto-escalated`;
    }
    return base;
}

// ── helpers ──────────────────────────────────────────────────────────────

/** Python f-string `{x:.1f}` — round-half-to-even to 1 decimal place. */
function _fmt1(x: number): string {
    return _pyFormatFixed(x, 1);
}

/**
 * Mirror Python `format(x, ".Nf")` (round-half-to-even). JS `toFixed` rounds
 * half-away-from-zero, so a manual banker's-rounding pass is required.
 */
function _pyFormatFixed(value: number, ndigits: number): string {
    if (!Number.isFinite(value)) {
        if (Number.isNaN(value)) {
            return 'nan';
        }
        return value > 0 ? 'inf' : '-inf';
    }
    const neg = value < 0 || Object.is(value, -0);
    const abs = Math.abs(value);
    const factor = 10 ** ndigits;
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (diff > 0.5 + eps) {
        rounded = floor + 1;
    } else if (diff < 0.5 - eps) {
        rounded = floor;
    } else {
        // Exactly halfway → round to even.
        rounded = floor % 2 === 0 ? floor : floor + 1;
    }
    const intPart = Math.floor(rounded / factor);
    const fracPart = rounded - intPart * factor;
    let s: string;
    if (ndigits === 0) {
        s = String(intPart);
    } else {
        s = `${intPart}.${String(fracPart).padStart(ndigits, '0')}`;
    }
    return neg && rounded !== 0 ? `-${s}` : s;
}

/** Python truthiness for a JSON-loaded bool-ish value via `row.get(k, default)`. */
function _getBool(v: unknown, deflt: boolean): boolean {
    if (v === undefined) {
        return deflt;
    }
    return _pyTruthy(v);
}

function _pyTruthy(v: unknown): boolean {
    if (v === null || v === undefined) {
        return false;
    }
    if (typeof v === 'boolean') {
        return v;
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
    if (typeof v === 'object') {
        return Object.keys(v as object).length > 0;
    }
    return true;
}

/**
 * Parse an ISO-8601 timestamp the way the Python code does
 * (`datetime.fromisoformat(raw.replace("Z", "+00:00"))`, then assume UTC when
 * tz-naive). Returns epoch milliseconds in UTC, or `null` on ValueError.
 */
function _parseIsoUtcMs(raw: string): number | null {
    const s = raw.replace(/Z/gu, '+00:00');
    // Python fromisoformat accepts 'YYYY-MM-DD[ T]HH:MM:SS[.ffffff][+HH:MM]'.
    const m =
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$/u.exec(
            s,
        );
    if (!m) {
        // Date-only form 'YYYY-MM-DD' is also valid for fromisoformat.
        const d = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(s);
        if (!d) {
            return null;
        }
        return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]));
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6]);
    const fracStr = m[7] ?? '';
    const micros = fracStr ? Number(fracStr.padEnd(6, '0')) : 0;
    const ms = Math.floor(micros / 1000);
    let utc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    if (m[8]) {
        // Apply the explicit offset → convert to UTC instant.
        const sign = m[8] === '-' ? -1 : 1;
        const offMin = Number(m[9]) * 60 + Number(m[10]) + (m[11] ? Number(m[11]) / 60 : 0);
        utc -= sign * offMin * 60000;
    }
    return utc;
}

/** Python `Path(p).parent`. */
function _dirname(p: string): string {
    const i = p.lastIndexOf('/');
    if (i < 0) {
        return '.';
    }
    if (i === 0) {
        return '/';
    }
    return p.slice(0, i);
}

/** Python `str.strip()`. */
function _strip(s: string): string {
    return s.trim();
}

/**
 * Python `str.splitlines()` — split on universal newlines, drop a single
 * trailing newline (no empty final element).
 */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    const lines = s.split(/\r\n|\r|\n/u);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

// ── json.dumps (default args: ensure_ascii=True, separators=(", ", ": ")) ──

/** Mirror Python `json.dumps(obj)` with default arguments. */
function _pyJsonDumps(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            return _pyJsonNumber(value);
        case 'string':
            return _pyJsonStringAscii(value);
        case 'object':
            break;
        default:
            throw new TypeError(`Object of type ${typeof value} is not JSON serializable`);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyJsonDumps(v)).join(', ')}]`;
    }
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const k of Object.keys(obj)) {
        parts.push(`${_pyJsonStringAscii(k)}: ${_pyJsonDumps(obj[k])}`);
    }
    return `{${parts.join(', ')}}`;
}

function _pyJsonNumber(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

/**
 * Escape a string like Python `json.dumps(..., ensure_ascii=True)`:
 * short escapes for control chars, `\uXXXX` for every non-ASCII code point
 * (surrogate pairs for astral chars, matching CPython).
 */
function _pyJsonStringAscii(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i += 1) {
        // Iterate UTF-16 code units so astral chars emit surrogate-pair escapes.
        const ch = s[i] as string;
        const code = s.charCodeAt(i);
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
        } else if (code < 0x20 || code > 0x7e) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            out += ch;
        }
    }
    return out + '"';
}
