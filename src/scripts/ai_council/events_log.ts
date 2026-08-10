/**
 * Persistent council events log (step-8 phase 3).
 *
 * Ported from the retired Python `src/scripts/ai_council/events_log.py` (ADR-200 —
 * Python→TS migration, Phase 1). Appends one JSON line per council event to
 * `<project_root>/agents/runtime/council/events.log`. Schema v1 carries the
 * minimum needed to answer the "why did the council skip / block this?"
 * question at retro time without leaking prompt content.
 *
 * Privacy floor:
 *     `original_ask` is never written verbatim — the caller passes the raw
 *     string, and `appendEvent` writes `sha256(value)[:12]` as
 *     `original_ask_hash`.
 *
 * Kill-switch:
 *     `AGENT_CONFIG_NO_EVENTS_LOG=1` short-circuits `appendEvent` to a no-op.
 *
 * Byte-parity:
 *     The JSON line is `json.dumps(record, ensure_ascii=False,
 *     separators=(",", ":"))` — no sort_keys (insertion order preserved),
 *     raw (non-escaped) non-ASCII, `,` / `:` separators.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isSoloConcluded, type QuorumResult } from './quorum.js';
import type { AbsentReason } from './transport_resolver.js';

/**
 * v2 adds the `quorum_result` action (and nothing else) — see
 * `appendQuorumEvent`. Every schema-v1 field keeps its name, type and
 * position, so a v1 reader parses a v2 necessity line unchanged; only the
 * action vocabulary widened.
 */
export const SCHEMA_VERSION = 2;

export type EventAction = 'proceed' | 'skip_necessity' | 'block_quota' | 'quorum_result';

const _VALID_ACTIONS: ReadonlySet<string> = new Set([
    'proceed',
    'skip_necessity',
    'block_quota',
    'quorum_result',
]);

/**
 * Environment-variable kill-switch. Truthy values disable all writes; the
 * function silently returns.
 */
const _KILL_SWITCH_ENV = 'AGENT_CONFIG_NO_EVENTS_LOG';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/ai_council/events_log.py → parents[3] == repo root.
const _REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');

/**
 * Default log path, resolved relative to the package root (two levels above
 * `scripts/ai_council/` — `parents[3]` in Python). Callers can override via
 * `logPath` for tests.
 */
const _DEFAULT_LOG_PATH = path.join(
    _REPO_ROOT,
    'agents',
    'runtime',
    'council',
    'events.log',
);

/**
 * Return sha256(original_ask)[:12] — the privacy-floor hash.
 *
 * Empty / missing input maps to a stable sentinel so the schema field is
 * always populated.
 */
function _hash_original_ask(originalAsk: string): string {
    if (!originalAsk) {
        return '0'.repeat(12);
    }
    // Python: original_ask.encode("utf-8", errors="replace"). Node's utf-8
    // encoding via Buffer matches for valid strings; lone surrogates map to
    // U+FFFD under both errors="replace" and Buffer's WHATWG-ish behavior.
    const bytes = Buffer.from(_encodeUtf8Replace(originalAsk), 'binary');
    return crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
}

/**
 * Encode a JS string to a UTF-8 byte string with `errors="replace"`
 * semantics: lone surrogates become U+FFFD (3 bytes EF BF BD). Returned as a
 * latin1/binary string so `Buffer.from(_, 'binary')` reproduces the bytes.
 */
function _encodeUtf8Replace(s: string): string {
    let out = '';
    for (let i = 0; i < s.length; i += 1) {
        const code = s.charCodeAt(i);
        let cp: number;
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
            if (next >= 0xdc00 && next <= 0xdfff) {
                cp = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
                i += 1;
            } else {
                cp = 0xfffd; // lone high surrogate → replacement
            }
        } else if (code >= 0xdc00 && code <= 0xdfff) {
            cp = 0xfffd; // lone low surrogate → replacement
        } else {
            cp = code;
        }
        out += _utf8Bytes(cp);
    }
    return out;
}

/** Code point → UTF-8 bytes, as a binary string. */
function _utf8Bytes(cp: number): string {
    if (cp <= 0x7f) {
        return String.fromCharCode(cp);
    }
    if (cp <= 0x7ff) {
        return String.fromCharCode(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    }
    if (cp <= 0xffff) {
        return String.fromCharCode(
            0xe0 | (cp >> 12),
            0x80 | ((cp >> 6) & 0x3f),
            0x80 | (cp & 0x3f),
        );
    }
    return String.fromCharCode(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
    );
}

function _kill_switch_active(): boolean {
    const value = process.env[_KILL_SWITCH_ENV] ?? '';
    return !(value === '' || value === '0' || value === 'false' || value === 'False');
}

export interface AppendEventOptions {
    /** Override for tests. Defaults to the canonical events-log path. */
    logPath?: string | null;
    /** Override the wall-clock timestamp (tests). Defaults to `new Date()`. */
    now?: Date;
}

/**
 * Append a single JSON event line to the council events log.
 *
 * Returns `true` when a line was written; `false` when the kill-switch
 * suppressed the write. Never raises on missing parent dir — the function
 * creates it on demand.
 *
 * Throws `Error` (Python `ValueError`) when `action` is not in the valid set.
 *
 * NOTE: mutates `event` (pops `original_ask`) — matches the Python
 * `event.pop("original_ask", ...)` side effect.
 */
export function appendEvent(
    event: Record<string, unknown>,
    opts: AppendEventOptions = {},
): boolean {
    if (_kill_switch_active()) {
        return false;
    }

    const action = event['action'];
    if (typeof action !== 'string' || !_VALID_ACTIONS.has(action)) {
        throw new Error(
            `events_log: action=${_pyRepr(action)} not in ` +
                `${_pyReprList(Array.from(_VALID_ACTIONS).sort())}.`,
        );
    }

    // Python: event.pop("original_ask", "") if "original_ask" in event else ""
    // The schema documents original_ask as a string; non-string / null is not
    // a documented input — treat null/undefined as "" and coerce otherwise.
    let rawAsk = '';
    if ('original_ask' in event) {
        const popped = event['original_ask'];
        if (typeof popped === 'string') {
            rawAsk = popped;
        } else if (popped === undefined || popped === null) {
            rawAsk = '';
        } else {
            rawAsk = String(popped);
        }
        delete event['original_ask'];
    }

    const now = opts.now ?? new Date();
    const record: Record<string, unknown> = {
        schema_version: SCHEMA_VERSION,
        ts_utc: _isoSecondsZ(now),
        lens: 'lens' in event ? event['lens'] : '',
        invocation: 'invocation' in event ? event['invocation'] : '',
        action,
        verdict: 'verdict' in event ? event['verdict'] : '',
        provider_caps: 'provider_caps' in event ? event['provider_caps'] : {},
        original_ask_hash: _hash_original_ask(rawAsk),
    };
    // Pass-through for any caller-supplied diagnostic fields that are not in
    // the schema-v1 reserved set. The schema-v1 fields above always win on
    // collision.
    const reserved = new Set([...Object.keys(record), 'original_ask']);
    for (const [k, v] of Object.entries(event)) {
        if (!reserved.has(k)) {
            record[k] = v;
        }
    }

    const target = opts.logPath != null ? opts.logPath : _DEFAULT_LOG_PATH;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const line = _pyJsonDumpsCompact(record);
    fs.appendFileSync(target, line + '\n', { encoding: 'utf-8' });
    return true;
}

/** Return the canonical events-log path (callers / tests). */
export function defaultLogPath(): string {
    return _DEFAULT_LOG_PATH;
}

// ── quorum attendance (schema v2) ───────────────────────────────────

/**
 * Which of the two `evaluateQuorum` call sites produced the record.
 *
 * `pre_run` is `build_members`' construction-time reading — who could be
 * built at all. `post_run` is `_postRunQuorum`'s re-derivation over what
 * actually returned a usable response. One pass emits BOTH, and they
 * disagree whenever a member constructs and then fails mid-flight, so a
 * consumer that counts attendance without splitting on this field
 * double-counts every pass.
 */
export type QuorumEventPhase = 'pre_run' | 'post_run';

/**
 * One absent member, in the vocabulary the tree actually uses:
 * `AbsentReason` plus the two runtime fallbacks the CLI writes directly —
 * `'unavailable'` (transport resolved to ∅) and `'binary_missing'` (a CLI
 * client refused to construct).
 */
export type QuorumAbsentReason = AbsentReason | 'unavailable' | 'binary_missing';

export interface QuorumAbsence {
    readonly member: string;
    readonly reason: QuorumAbsentReason;
}

/**
 * Which CLI path produced the line. `estimate` spends nothing — it is a cost
 * preview — so every rate computed over these lines must exclude it, and it
 * is recorded rather than suppressed so the exclusion is the consumer's
 * explicit act instead of an invisible one.
 */
export type QuorumCommand = 'run' | 'estimate' | 'debate';

/**
 * `single` means `--single` filtered the roster down to one member BEFORE
 * the pass ran. Without this field a deliberate solo dispatch is byte-identical
 * to a configured one-member council, and the solo-conclusion rate cannot tell
 * the two apart — which is the one distinction it exists to make.
 */
export type QuorumDispatch = 'full' | 'single';

export interface QuorumEventInput {
    readonly lens: string;
    readonly invocation: string;
    readonly phase: QuorumEventPhase;
    readonly command: QuorumCommand;
    readonly dispatch: QuorumDispatch;
    /**
     * Enabled members in the config, BEFORE `--single` / `--siblings`
     * filtering and before construction failures. `result.total` is the
     * roster that survived; when the two differ, the gap is exactly the
     * "council degraded by configuration" case a post_run-only reading is
     * otherwise blind to.
     */
    readonly configuredTotal: number;
    readonly result: QuorumResult;
    readonly absent: readonly QuorumAbsence[];
}

/**
 * Append one `quorum_result` line — the attendance record that makes a
 * solo-concluded pass distinguishable from a full-attendance one.
 *
 * Privacy floor, by construction: `QuorumAbsence` carries a member name and
 * a closed-vocabulary reason and has **no field able to hold free-form
 * content**. The CLI's own absent entries carry a `detail` string built from
 * provider error text (which can embed paths and prompts); it is dropped
 * here rather than scrubbed, so there is no scrubber to fail.
 *
 * Fail-open: attendance telemetry must never be able to kill a council
 * pass, so every error — an unwritable log dir, a full disk — is swallowed
 * and reported as `false`. `appendEvent` itself throws only on an invalid
 * action, which this function cannot produce.
 */
export function appendQuorumEvent(
    input: QuorumEventInput,
    opts: AppendEventOptions = {},
): boolean {
    try {
        return appendEvent(
            {
                lens: input.lens,
                invocation: input.invocation,
                action: 'quorum_result',
                verdict: input.result.status,
                phase: input.phase,
                command: input.command,
                dispatch: input.dispatch,
                threshold: input.result.threshold,
                configured_total: input.configuredTotal,
                total: input.result.total,
                present: input.result.present,
                // Written by the predicate, never re-derived from the numbers
                // downstream: one definition of "concluded on a single voice",
                // in `quorum.ts`, so a change to it cannot leave a consumer's
                // copy silently stale.
                solo: isSoloConcluded(input.result),
                absent: input.absent.map((a) => ({ member: a.member, reason: a.reason })),
            },
            opts,
        );
    } catch {
        return false;
    }
}

// ── helpers ─────────────────────────────────────────────────────────

/**
 * Mirror Python `datetime.now(timezone.utc).isoformat(timespec="seconds")`
 * with `+00:00` replaced by `Z`. → `YYYY-MM-DDTHH:MM:SSZ`.
 */
function _isoSecondsZ(d: Date): string {
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

/** Python repr() for an arbitrary scalar used in error messages. */
function _pyRepr(v: unknown): string {
    if (typeof v === 'string') {
        return `'${v}'`;
    }
    if (v === null) {
        return 'None';
    }
    if (v === undefined) {
        // event.get("action") on a missing key → None in Python.
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    return String(v);
}

/** Python repr() for a list of strings: ['a', 'b']. */
function _pyReprList(items: string[]): string {
    return `[${items.map((i) => `'${i}'`).join(', ')}]`;
}

/**
 * Mirror Python `json.dumps(obj, ensure_ascii=False, separators=(",", ":"))`:
 * insertion-order keys, no whitespace, raw (non-escaped) non-ASCII.
 */
function _pyJsonDumpsCompact(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            return _pyJsonNumber(value);
        case 'string':
            return _pyJsonStringRaw(value);
        case 'object':
            break;
        default:
            throw new TypeError(`Object of type ${typeof value} is not JSON serializable`);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyJsonDumpsCompact(v)).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const k of Object.keys(obj)) {
        parts.push(`${_pyJsonStringRaw(k)}:${_pyJsonDumpsCompact(obj[k])}`);
    }
    return `{${parts.join(',')}}`;
}

/** Render a number like Python `json.dumps` (int vs float; JS has one type). */
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
 * Escape a string like Python `json.dumps(..., ensure_ascii=False)`:
 * short escapes for `"` `\` and the C0 control chars, but non-ASCII passes
 * through raw (not `\uXXXX`).
 */
function _pyJsonStringRaw(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
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
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            out += ch;
        }
    }
    return out + '"';
}
