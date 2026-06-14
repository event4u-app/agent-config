/**
 * Engagement event schema and JSONL appender (Phase 1).
 *
 * TypeScript twin of `engagement.py` (ADR-094). Byte-for-byte parity:
 * same schema, same validation messages, same JSONL serialization
 * (`json.dumps(sort_keys=True, separators=(",",":"))`), same redaction
 * floor, same `EngagementSchemaError` semantics.
 *
 * Stdlib-only on the Python side. The contract:
 *
 *     {
 *       "schema_version": 1,
 *       "ts": "<ISO-8601 UTC>",
 *       "task_id": "<repo-internal id>",
 *       "boundary_kind": "task" | "phase-step" | "tool-call",
 *       "consulted": {"skills": [...], "rules": [...], ...},
 *       "applied":   {"skills": [...], "rules": [...], ...},
 *       "outcomes":  ["blocked", "verification_failed", ...]  # optional
 *       "tokens_estimate": {"consulted_load": <int>}   # optional
 *     }
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const SCHEMA_VERSION = 1;
export const MAX_ID_LEN = 200;

export const ALLOWED_KINDS = [
    'skills',
    'rules',
    'commands',
    'guidelines',
    'personas',
] as const;

export const ALLOWED_BOUNDARY_KINDS = [
    'task',
    'phase-step',
    'tool-call',
] as const;

// Outcome categories — see module docstring for semantics. The set is
// intentionally small; widening requires an explicit follow-up roadmap
// step. Reports group by these labels, so renaming is breaking.
export const ALLOWED_OUTCOMES = [
    'blocked',
    'partial',
    'memory_influenced_decision',
    'verification_failed',
    'stop_rule_triggered',
] as const;
export const MAX_OUTCOMES_PER_EVENT = ALLOWED_OUTCOMES.length;

// Phase 5 redaction validator — keep id fields from leaking paths,
// free-text, or filenames.
const _FORBIDDEN_ID_CHARS = ['/', '\\', '\n', '\r', '\t'] as const;
// Trailing alphabetic extension (`.md`, `.py`, `.json`, …). 1-8 alpha chars.
const _FILE_EXTENSION_RE = /\.[A-Za-z]{1,8}$/u;

export class EngagementSchemaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EngagementSchemaError';
    }
}

/** Mirror Python `repr()` for a single character — used in error text. */
function _reprChar(ch: string): string {
    const map: Record<string, string> = {
        '\n': "'\\n'",
        '\r': "'\\r'",
        '\t': "'\\t'",
        '\\': "'\\\\'",
        "'": '"\'"',
    };
    if (map[ch] !== undefined) {
        return map[ch] as string;
    }
    return `'${ch}'`;
}

/** Mirror Python `repr()` of the ALLOWED tuples used in error text. */
function _reprTuple(items: readonly string[]): string {
    const inner = items.map((s) => `'${s}'`).join(', ');
    return items.length === 1 ? `(${inner},)` : `(${inner})`;
}

/**
 * Phase 5 redaction validator — reject path- and free-text-shaped ids.
 */
export function check_id_redaction(label: string, value: unknown): void {
    if (typeof value !== 'string') {
        throw new EngagementSchemaError(`${label} must be a string`);
    }
    if (!value) {
        throw new EngagementSchemaError(`${label} must be non-empty`);
    }
    if (_pyLen(value) > MAX_ID_LEN) {
        throw new EngagementSchemaError(`${label} exceeds ${MAX_ID_LEN} chars`);
    }
    for (const ch of _FORBIDDEN_ID_CHARS) {
        if (value.includes(ch)) {
            throw new EngagementSchemaError(
                `${label} contains forbidden character ${_reprChar(ch)}; `
                + 'id fields must be repository-internal artefact ids only '
                + '(no paths, no free-text)',
            );
        }
    }
    if (value !== _pyStrip(value)) {
        throw new EngagementSchemaError(
            `${label} must not start or end with whitespace`,
        );
    }
    if (_FILE_EXTENSION_RE.test(value)) {
        throw new EngagementSchemaError(
            `${label} ends in a file extension; `
            + 'id fields must be repository-internal artefact ids only '
            + '(strip path + extension before recording)',
        );
    }
}

export interface EngagementEventInit {
    ts: string;
    task_id: string;
    boundary_kind: string;
    consulted?: Record<string, string[]>;
    applied?: Record<string, string[]>;
    outcomes?: string[] | null;
    tokens_estimate?: Record<string, number> | null;
    schema_version?: number;
}

export class EngagementEvent {
    ts: string;
    task_id: string;
    boundary_kind: string;
    consulted: Record<string, string[]>;
    applied: Record<string, string[]>;
    outcomes: string[] | null;
    tokens_estimate: Record<string, number> | null;
    schema_version: number;

    constructor(init: EngagementEventInit) {
        this.ts = init.ts;
        this.task_id = init.task_id;
        this.boundary_kind = init.boundary_kind;
        this.consulted = init.consulted ?? {};
        this.applied = init.applied ?? {};
        this.outcomes = init.outcomes ?? null;
        this.tokens_estimate = init.tokens_estimate ?? null;
        this.schema_version = init.schema_version ?? SCHEMA_VERSION;
    }

    validate(): void {
        if (typeof this.ts !== 'string' || !this.ts) {
            throw new EngagementSchemaError('ts must be a non-empty string');
        }
        if (typeof this.task_id !== 'string' || !this.task_id) {
            throw new EngagementSchemaError('task_id must be a non-empty string');
        }
        if (_pyLen(this.task_id) > MAX_ID_LEN) {
            throw new EngagementSchemaError(`task_id exceeds ${MAX_ID_LEN} chars`);
        }
        check_id_redaction('task_id', this.task_id);
        if (!(ALLOWED_BOUNDARY_KINDS as readonly string[]).includes(this.boundary_kind)) {
            throw new EngagementSchemaError(
                `boundary_kind must be one of ${_reprTuple(ALLOWED_BOUNDARY_KINDS)}`,
            );
        }
        _validate_artefact_dict('consulted', this.consulted);
        _validate_artefact_dict('applied', this.applied);
        if (this.outcomes !== null) {
            _validate_outcomes(this.outcomes);
        }
        if (this.tokens_estimate !== null) {
            if (!_isPlainObject(this.tokens_estimate)) {
                throw new EngagementSchemaError(
                    'tokens_estimate must be a dict[str,int] or None',
                );
            }
            for (const [k, v] of Object.entries(this.tokens_estimate)) {
                if (typeof k !== 'string' || !_isPyInt(v)) {
                    throw new EngagementSchemaError(
                        'tokens_estimate keys must be str, values int',
                    );
                }
            }
        }
        if (this.schema_version !== SCHEMA_VERSION) {
            throw new EngagementSchemaError(
                `schema_version must be ${SCHEMA_VERSION}, got `
                + `${_reprScalar(this.schema_version)}`,
            );
        }
    }

    to_dict(): Record<string, unknown> {
        this.validate();
        const out: Record<string, unknown> = {
            schema_version: this.schema_version,
            ts: this.ts,
            task_id: this.task_id,
            boundary_kind: this.boundary_kind,
            consulted: _normalise_artefact_dict(this.consulted),
            applied: _normalise_artefact_dict(this.applied),
        };
        if (this.outcomes && this.outcomes.length > 0) {
            out['outcomes'] = [...this.outcomes];
        }
        if (this.tokens_estimate && Object.keys(this.tokens_estimate).length > 0) {
            out['tokens_estimate'] = { ...this.tokens_estimate };
        }
        return out;
    }

    to_jsonl(): string {
        return `${py_json_dumps_compact_sorted(this.to_dict())}\n`;
    }
}

function _validate_artefact_dict(label: string, payload: unknown): void {
    if (!_isPlainObject(payload)) {
        throw new EngagementSchemaError(`${label} must be a dict[str,list[str]]`);
    }
    for (const [kind, ids] of Object.entries(payload)) {
        if (!(ALLOWED_KINDS as readonly string[]).includes(kind)) {
            throw new EngagementSchemaError(
                `${label}.${_reprScalar(kind)} is not an allowed artefact kind `
                + `(allowed: ${_reprTuple(ALLOWED_KINDS)})`,
            );
        }
        if (!Array.isArray(ids)) {
            throw new EngagementSchemaError(`${label}.${kind} must be a list of str`);
        }
        for (const art_id of ids) {
            if (typeof art_id !== 'string' || !art_id) {
                throw new EngagementSchemaError(
                    `${label}.${kind} must contain non-empty str ids`,
                );
            }
            if (_pyLen(art_id) > MAX_ID_LEN) {
                throw new EngagementSchemaError(
                    `${label}.${kind} id exceeds ${MAX_ID_LEN} chars`,
                );
            }
            check_id_redaction(`${label}.${kind}`, art_id);
        }
    }
}

function _normalise_artefact_dict(
    payload: Record<string, string[]>,
): Record<string, string[]> {
    // Stable shape: only non-empty kinds, ids preserved in declared order.
    const out: Record<string, string[]> = {};
    for (const kind of ALLOWED_KINDS) {
        const v = payload[kind];
        if (v && v.length > 0) {
            out[kind] = [...v];
        }
    }
    return out;
}

function _validate_outcomes(payload: unknown): void {
    if (!Array.isArray(payload)) {
        throw new EngagementSchemaError('outcomes must be a list of str or None');
    }
    if (payload.length > MAX_OUTCOMES_PER_EVENT) {
        throw new EngagementSchemaError(
            `outcomes exceeds ${MAX_OUTCOMES_PER_EVENT} entries`,
        );
    }
    const seen = new Set<string>();
    for (const label of payload) {
        if (typeof label !== 'string' || !label) {
            throw new EngagementSchemaError('outcomes must contain non-empty str labels');
        }
        if (!(ALLOWED_OUTCOMES as readonly string[]).includes(label)) {
            throw new EngagementSchemaError(
                `outcomes contains ${_reprScalar(label)}; allowed: ${_reprTuple(ALLOWED_OUTCOMES)}`,
            );
        }
        if (seen.has(label)) {
            throw new EngagementSchemaError(`outcomes contains duplicate ${_reprScalar(label)}`);
        }
        seen.add(label);
    }
}

export function parse_event(line: string): EngagementEvent {
    if (typeof line !== 'string' || !line.trim()) {
        throw new EngagementSchemaError('line must be a non-empty JSONL record');
    }
    let raw: unknown;
    try {
        raw = JSON.parse(line);
    } catch (exc) {
        throw new EngagementSchemaError(`line is not valid JSON: ${_jsonErr(exc)}`);
    }
    if (!_isPlainObject(raw)) {
        throw new EngagementSchemaError('event must be a JSON object');
    }
    const r = raw;
    const event = new EngagementEvent({
        ts: (r['ts'] as string) ?? '',
        task_id: (r['task_id'] as string) ?? '',
        boundary_kind: (r['boundary_kind'] as string) ?? '',
        consulted: _orEmptyDict(r['consulted']),
        applied: _orEmptyDict(r['applied']),
        outcomes: (r['outcomes'] as string[] | null | undefined) ?? null,
        tokens_estimate: (r['tokens_estimate'] as Record<string, number> | null | undefined) ?? null,
        schema_version: r['schema_version'] === undefined
            ? SCHEMA_VERSION
            : (r['schema_version'] as number),
    });
    event.validate();
    return event;
}

/** Mirror Python `raw.get(k, {}) or {}` — falsy → {}. */
function _orEmptyDict(v: unknown): Record<string, string[]> {
    if (v && _isPlainObject(v)) {
        return v as Record<string, string[]>;
    }
    return {};
}

export function append_event(log_path: string, event: EngagementEvent): void {
    const payload = event.to_jsonl();
    fs.mkdirSync(path.dirname(log_path) || '.', { recursive: true });
    fs.appendFileSync(log_path, payload, { encoding: 'utf-8' });
}

/** ISO-8601 UTC timestamp, second precision, `Z` suffix. */
export function now_utc_iso(): string {
    const d = new Date();
    const p = (n: number, w = 2): string => String(n).padStart(w, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
        + `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
}

// ── Python-parity helpers ───────────────────────────────────────────────

/** Python `len(str)` — code-point count, not UTF-16 unit count. */
export function _pyLen(s: string): number {
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of s) {
        count += 1;
    }
    return count;
}

/** Python `str.strip()` — strip ASCII + Unicode whitespace from both ends. */
function _pyStrip(s: string): string {
    // Python str.strip() with no arg strips a fixed whitespace set. JS \s in a
    // Unicode regex covers the same set used by the id contract (space, tab,
    // CR, LF, FF, VT, and Unicode spaces). The redaction floor only needs the
    // ASCII subset in practice.
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Python `isinstance(v, int)` — JSON ints arrive as integer-valued numbers. */
function _isPyInt(v: unknown): v is number {
    return typeof v === 'number' && Number.isInteger(v);
}

/** Mirror Python `repr()` for a scalar used in `{x!r}` error text. */
function _reprScalar(v: unknown): string {
    if (typeof v === 'string') {
        return `'${v}'`;
    }
    if (v === null) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    return String(v);
}

function _jsonErr(exc: unknown): string {
    return exc instanceof Error ? exc.message : String(exc);
}

// ── Python-parity JSON (compact, sorted) ────────────────────────────────

/**
 * Mirror `json.dumps(obj, sort_keys=True, separators=(",", ":"))`.
 *
 * ensure_ascii defaults to True → non-ASCII escaped as `\uXXXX`. Integers
 * render without a decimal point; the schema only ever serializes ints,
 * strings, lists, and dicts here.
 */
export function py_json_dumps_compact_sorted(value: unknown): string {
    return _dumpCompact(value);
}

function _dumpCompact(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _pyJsonNumber(value);
    }
    if (typeof value === 'string') {
        return _pyJsonStringAscii(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _dumpCompact(v)).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
    const parts = keys.map((k) => `${_pyJsonStringAscii(k)}:${_dumpCompact(obj[k])}`);
    return `{${parts.join(',')}}`;
}

/** json.dumps number rendering for the int-only payloads used here. */
function _pyJsonNumber(n: number): string {
    if (Number.isInteger(n)) {
        return String(n);
    }
    return _pyFloatRepr(n);
}

/** Python repr(float) — used only if a non-int ever reaches the serializer. */
export function _pyFloatRepr(n: number): string {
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

/** json.dumps default ensure_ascii=True string rendering (escape >= 0x7F). */
export function _pyJsonStringAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            // Surrogate pair, matching CPython's \uXXXX\uXXXX rendering.
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}`;
            out += `\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return `${out}"`;
}
