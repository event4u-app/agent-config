#!/usr/bin/env node
/**
 * Emit `cost-summary/v1` JSON per `docs/contracts/cost-summary-schema.md`.
 *
 * TypeScript twin of `src/scripts/cost_summary.py` (ADR-090 — Python→TS
 * migration, Phase 8 / Wave 8e). The CLI contract is mirrored EXACTLY:
 * same flags (`--input`, `--format json`), same exit code (0), same
 * byte-identical JSON output (json.dumps indent=2; PyFloat-aware so
 * `total_cost_usd` renders with a trailing `.0` like Python). The
 * `generated_at` field is a wall-clock timestamp — non-deterministic, so
 * golden parity excludes it. No behaviour changes.
 *
 * Reads `agents/cost-tracking/sessions.jsonl` (or `--input`), aggregates by
 * session, conversation, and model. Honors the telegraph suspended-multiplier
 * contract (delta = 0 while suspended; see `telegraph-telemetry.md`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/cost_summary.ts → parents[2] is the repo root (mirrors
// `Path(__file__).resolve().parent.parent.parent` in the .py).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_JSONL = path.join(REPO_ROOT, 'agents', 'cost-tracking', 'sessions.jsonl');
const SCHEMA = 'cost-summary/v1';
const MULTIPLIER_VERSION = 'v1';
const MULTIPLIER_ACTIVE = false;

/** A raw JSONL row — arbitrary JSON object. */
type Row = Record<string, unknown>;

function _load(p: string): Row[] {
    if (!_isFile(p)) {
        return [];
    }
    const out: Row[] = [];
    const text = fs.readFileSync(p, 'utf-8');
    for (const line of _splitlines(text)) {
        const s = line.trim();
        if (!s || s.startsWith('#')) {
            continue;
        }
        try {
            out.push(JSON.parse(s) as Row);
        } catch {
            // json.JSONDecodeError → skip the line.
            continue;
        }
    }
    return out;
}

function _delta(row: Row): number {
    if (!MULTIPLIER_ACTIVE) {
        return 0;
    }
    return _int(row['telegraph_delta_tokens']);
}

/** Per-session / per-conversation / totals accumulator (key order matters). */
interface KvBucket {
    sessions: number;
    total_cost_usd: number;
    input_tokens: number;
    output_tokens: number;
    telegraph_delta_tokens: number;
}

function _zero_kv(): KvBucket {
    return {
        sessions: 0,
        total_cost_usd: 0.0,
        input_tokens: 0,
        output_tokens: 0,
        telegraph_delta_tokens: 0,
    };
}

/** Per-model accumulator (no telegraph_delta_tokens; key order matters). */
interface ModelBucket {
    sessions: number;
    total_cost_usd: number;
    input_tokens: number;
    output_tokens: number;
}

function _zero_model(): ModelBucket {
    return { sessions: 0, total_cost_usd: 0.0, input_tokens: 0, output_tokens: 0 };
}

/** Aggregate rows into the cost-summary structure (PyFloat-aware output). */
export function aggregate(rows: Row[]): Json {
    // Insertion-ordered maps to mirror Python's dict ordering + sorted().
    const by_sess = new Map<string, KvBucket>();
    const by_conv = new Map<string, KvBucket>();
    const by_model = new Map<string, ModelBucket>();
    const totals = _zero_kv();

    for (const row of rows) {
        const sid = _str(row['sessionId'] ?? row['session_id'] ?? 'unknown');
        const cid = _str(row['conversation_id'] ?? 'unknown');
        const model = _str(row['model'] ?? 'unknown');
        const cost = _float(row['total_cost_usd']);
        const itok = _int(row['input_tokens']);
        const otok = _int(row['output_tokens']);
        const delta = _delta(row);

        const sessBucket = _getOr(by_sess, sid, _zero_kv);
        const convBucket = _getOr(by_conv, cid, _zero_kv);
        for (const bucket of [sessBucket, convBucket, totals]) {
            bucket.sessions += 1;
            bucket.total_cost_usd += cost;
            bucket.input_tokens += itok;
            bucket.output_tokens += otok;
            bucket.telegraph_delta_tokens += delta;
        }
        const m = _getOr(by_model, model, _zero_model);
        m.sessions += 1;
        m.total_cost_usd += cost;
        m.input_tokens += itok;
        m.output_tokens += otok;
    }

    return {
        schema_version: SCHEMA,
        generated_at: _utcNow(),
        totals: {
            sessions: totals.sessions,
            total_cost_usd: new PyFloat(totals.total_cost_usd),
            input_tokens: totals.input_tokens,
            output_tokens: totals.output_tokens,
            telegraph_delta_tokens: totals.telegraph_delta_tokens,
            telegraph_multiplier_version: MULTIPLIER_VERSION,
            telegraph_multiplier_active: MULTIPLIER_ACTIVE,
        },
        by_session: _sortedEntries(by_sess).map(([k, v]) => ({
            key: k,
            sessions: v.sessions,
            total_cost_usd: new PyFloat(v.total_cost_usd),
            input_tokens: v.input_tokens,
            output_tokens: v.output_tokens,
            telegraph_delta_tokens: v.telegraph_delta_tokens,
        })),
        by_conversation: _sortedEntries(by_conv).map(([k, v]) => ({
            key: k,
            sessions: v.sessions,
            total_cost_usd: new PyFloat(v.total_cost_usd),
            input_tokens: v.input_tokens,
            output_tokens: v.output_tokens,
            telegraph_delta_tokens: v.telegraph_delta_tokens,
        })),
        by_model: _sortedEntries(by_model).map(([k, v]) => ({
            model: k,
            sessions: v.sessions,
            total_cost_usd: new PyFloat(v.total_cost_usd),
            input_tokens: v.input_tokens,
            output_tokens: v.output_tokens,
        })),
    };
}

// --- helpers ---------------------------------------------------------------

function _getOr<T>(m: Map<string, T>, key: string, factory: () => T): T {
    let v = m.get(key);
    if (v === undefined) {
        v = factory();
        m.set(key, v);
    }
    return v;
}

/** Python `sorted(d.items())` — ascending key codepoint order. */
function _sortedEntries<T>(m: Map<string, T>): [string, T][] {
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Mirror `str(x)` for the JSONL field coercions used in the .py. */
function _str(value: unknown): string {
    if (value === null || value === undefined) {
        return String(value === undefined ? null : value);
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    return String(value);
}

/** Mirror `int(row.get(k) or 0)` — falsy → 0; numeric/string → truncated int. */
function _int(value: unknown): number {
    if (!_pyTruthy(value)) {
        return 0;
    }
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    if (typeof value === 'string') {
        return Math.trunc(Number(value));
    }
    return 0;
}

/** Mirror `float(row.get(k) or 0)` — falsy → 0.0; numeric/string → float. */
function _float(value: unknown): number {
    if (!_pyTruthy(value)) {
        return 0;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    if (typeof value === 'string') {
        return Number(value);
    }
    return 0;
}

function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/** `Path.is_file()`. */
function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Mirror `str.splitlines()` for the line classes JSONL uses (\n, \r\n, \r). */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    return text.split(/\r\n|\r|\n/);
}

/** `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")`. */
function _utcNow(): string {
    const d = new Date();
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

// --- json.dumps(indent=2) parity (PyFloat-aware) --------------------------

/**
 * Wrapper marking a value as a Python float, so an integer-valued float
 * (0.0, 5.0) renders with a trailing `.0` exactly as `json.dumps` does.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [k: string]: Json };

function _jsonDumpsIndent2(obj: Json): string {
    const pad = '  ';

    function enc(value: Json, depth: number): string {
        if (value === null) {
            return 'null';
        }
        if (value instanceof PyFloat) {
            return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) {
            return '{}';
        }
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k]!, depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }

    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }

    return enc(obj, 0);
}

interface ParsedArgs {
    input: string;
    format: string;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let input = DEFAULT_JSONL;
    let format = 'json';
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i]!;
        if (arg === '--input') {
            const value = argv[i + 1];
            if (value === undefined) {
                _argError('argument --input: expected one argument');
            }
            input = value as string;
            i += 2;
            continue;
        }
        if (arg.startsWith('--input=')) {
            input = arg.slice('--input='.length);
            i += 1;
            continue;
        }
        if (arg === '--format') {
            const value = argv[i + 1];
            if (value === undefined) {
                _argError('argument --format: expected one argument');
            }
            if (value !== 'json') {
                _argError(`argument --format: invalid choice: '${value}' (choose from 'json')`);
            }
            format = value as string;
            i += 2;
            continue;
        }
        if (arg.startsWith('--format=')) {
            const value = arg.slice('--format='.length);
            if (value !== 'json') {
                _argError(`argument --format: invalid choice: '${value}' (choose from 'json')`);
            }
            format = value;
            i += 1;
            continue;
        }
        _argError(`unrecognized arguments: ${arg}`);
    }
    return { input, format };
}

function _argError(message: string): never {
    process.stderr.write(`usage: cost_summary [-h] [--input INPUT] [--format {json}]\n`);
    process.stderr.write(`cost_summary: error: ${message}\n`);
    process.exit(2);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);
    process.stdout.write(_jsonDumpsIndent2(aggregate(_load(args.input))) + '\n');
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
