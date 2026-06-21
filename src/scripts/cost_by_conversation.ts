#!/usr/bin/env node
/**
 * Group cost-tracking sessions by conversation_id (the external runtime `conversation.mjs` `5b71c7a` ref).
 *
 * TypeScript twin of `src/scripts/cost_by_conversation.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8e). Public surface mirrors the Python
 * module exactly: same CLI flags (`--input`, `--format`), same exit code (0),
 * same stdout, and byte-identical `json.dumps(..., indent=2)` output.
 *
 * `defaultdict`-ordered aggregation is replicated with insertion-order Maps so
 * the `by_model` blocks stay in first-seen order before the `sorted()` render;
 * the JSON emitter walks keys in insertion order (matching CPython dict order).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/cost_by_conversation.ts → parents[2] is the package root
// (mirrors the Python module's parent.parent.parent resolution).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_JSONL = path.join(REPO_ROOT, 'agents', 'cost-tracking', 'sessions.jsonl');

/**
 * Marker for a Python `float`. `json.dumps` renders an integral float as
 * `0.0` (not `0`); plain JS numbers render via `String`. The cost / cost_usd
 * fields are summed floats in Python, so they must carry this marker to match
 * byte-for-byte.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

type Json =
    | null
    | boolean
    | number
    | string
    | PyFloat
    | Json[]
    | { [k: string]: Json };

interface ModelBucket {
    sessions: number;
    cost_usd: number;
}

interface ConvBucket {
    sessions: number;
    total_cost_usd: number;
    input_tokens: number;
    output_tokens: number;
    telegraph_delta_tokens: number;
    by_model: Map<string, ModelBucket>;
}

// --- Python int()/float() coercion -----------------------------------------

/** Python `int(row.get(k) or 0)` — `or 0` triggers on falsy (None, 0, "", 0.0). */
function _pyInt(value: unknown): number {
    if (value === null || value === undefined || value === false || value === '' || value === 0) {
        return 0;
    }
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    // Python int("...") on a string; cost-tracking rows store numbers, but a
    // numeric string still coerces. Non-numeric → NaN (Python would raise; the
    // real data never hits this path).
    const n = Number(value);
    return Number.isNaN(n) ? 0 : Math.trunc(n);
}

/** Python `float(row.get(k) or 0)`. */
function _pyFloat(value: unknown): number {
    if (value === null || value === undefined || value === false || value === '' || value === 0) {
        return 0.0;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 1.0 : 0.0;
    }
    const n = Number(value);
    return Number.isNaN(n) ? 0.0 : n;
}

/** Python `str(row.get(a) or row.get(b) or "fallback")`. */
function _pyStr(value: unknown): string {
    return String(value);
}

function _isTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === '' || value === 0) {
        return false;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
}

function _load(p: string): Record<string, unknown>[] {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
        return [];
    }
    const out: Record<string, unknown>[] = [];
    const text = fs.readFileSync(p, 'utf-8');
    for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s || s.startsWith('#')) {
            continue;
        }
        try {
            out.push(JSON.parse(s) as Record<string, unknown>);
        } catch {
            continue;
        }
    }
    return out;
}

function _newConvBucket(): ConvBucket {
    return {
        sessions: 0,
        total_cost_usd: 0.0,
        input_tokens: 0,
        output_tokens: 0,
        telegraph_delta_tokens: 0,
        by_model: new Map(),
    };
}

export function group(rows: Record<string, unknown>[]): Map<string, ConvBucket> {
    const byConv: Map<string, ConvBucket> = new Map();
    for (const row of rows) {
        const cid = _isTruthy(row['conversation_id']) ? _pyStr(row['conversation_id']) : 'unknown';
        let b = byConv.get(cid);
        if (b === undefined) {
            b = _newConvBucket();
            byConv.set(cid, b);
        }
        const cost = _pyFloat(row['total_cost_usd']);
        b.sessions += 1;
        b.total_cost_usd += cost;
        b.input_tokens += _pyInt(row['input_tokens']);
        b.output_tokens += _pyInt(row['output_tokens']);
        b.telegraph_delta_tokens += _pyInt(row['telegraph_delta_tokens']);
        const modelKey = _isTruthy(row['model']) ? _pyStr(row['model']) : 'unknown';
        let m = b.by_model.get(modelKey);
        if (m === undefined) {
            m = { sessions: 0, cost_usd: 0.0 };
            b.by_model.set(modelKey, m);
        }
        m.sessions += 1;
        m.cost_usd += cost;
    }
    return byConv;
}

// --- Python f-string number formatting -------------------------------------

/** Python `f"{n:,}"` — thousands grouping, no forced sign. */
function _pyComma(n: number): string {
    const neg = n < 0;
    const digits = Math.abs(Math.trunc(n)).toString();
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return neg ? `-${grouped}` : grouped;
}

/** Python `f"{n:+,}"` — thousands grouping with an always-present sign. */
function _pyCommaSigned(n: number): string {
    const sign = n < 0 ? '-' : '+';
    const digits = Math.abs(Math.trunc(n)).toString();
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${grouped}`;
}

/** Python `f"{x:.4f}"` — round-half-to-even on the exact value, padded to 4 dp. */
function _pyFixed4(value: number): string {
    return _pyFixed(value, 4);
}

function _pyFixed(value: number, ndigits: number): string {
    if (!Number.isFinite(value)) {
        return String(value);
    }
    const neg = value < 0 && value !== 0;
    const abs = Math.abs(value);
    // Exact decimal expansion to far beyond double precision, then half-even
    // decimal rounding (matches CPython %.4f formatting on the exact value).
    const fixed = abs.toFixed(20);
    const dot = fixed.indexOf('.');
    const intPart = dot === -1 ? fixed : fixed.slice(0, dot);
    const fracPart = dot === -1 ? '' : fixed.slice(dot + 1);
    const keep = fracPart.slice(0, ndigits).padEnd(ndigits, '0');
    const rest = fracPart.slice(ndigits);
    const digits = (intPart + keep).split('');
    if (_decideRoundUp(digits, rest)) {
        _incrementDecimalDigits(digits);
    }
    const joined = digits.join('');
    const fracLen = ndigits;
    const intLen = joined.length - fracLen;
    const newInt = joined.slice(0, intLen) || '0';
    const newFrac = joined.slice(intLen);
    const body = ndigits > 0 ? `${newInt}.${newFrac}` : newInt;
    if (neg && Number(body) !== 0) {
        return `-${body}`;
    }
    return body;
}

function _decideRoundUp(keptDigits: string[], rest: string): boolean {
    if (rest.length === 0) {
        return false;
    }
    const firstDropped = rest.charCodeAt(0) - 48;
    if (firstDropped < 5) {
        return false;
    }
    if (firstDropped > 5) {
        return true;
    }
    for (let i = 1; i < rest.length; i += 1) {
        if (rest.charCodeAt(i) !== 48) {
            return true;
        }
    }
    // Exactly .5 → round to even.
    const last = keptDigits.length > 0 ? keptDigits[keptDigits.length - 1]!.charCodeAt(0) - 48 : 0;
    return last % 2 === 1;
}

function _incrementDecimalDigits(digits: string[]): void {
    let i = digits.length - 1;
    while (i >= 0) {
        const d = digits[i]!.charCodeAt(0) - 48 + 1;
        if (d < 10) {
            digits[i] = String(d);
            return;
        }
        digits[i] = '0';
        i -= 1;
    }
    digits.unshift('1');
}

export function render_text(byConv: Map<string, ConvBucket>): string {
    if (byConv.size === 0) {
        return 'cost-by-conversation: no rows.\n';
    }
    const lines: string[] = ['cost-by-conversation lens · grouped by conversation_id', ''];
    const cids = [...byConv.keys()].sort(_pyStrCmp);
    for (const cid of cids) {
        const b = byConv.get(cid)!;
        lines.push(
            `  ${cid}: ${b.sessions} sessions · $${_pyFixed4(b.total_cost_usd)} · ` +
                `in ${_pyComma(b.input_tokens)} · out ${_pyComma(b.output_tokens)} · ` +
                `telegraph_delta ${_pyCommaSigned(b.telegraph_delta_tokens)}`,
        );
        const models = [...b.by_model.keys()].sort(_pyStrCmp);
        for (const model of models) {
            const m = b.by_model.get(model)!;
            lines.push(`      ${model}: ${m.sessions} sessions · $${_pyFixed4(m.cost_usd)}`);
        }
    }
    return lines.join('\n') + '\n';
}

/** Python `sorted()` on strings — codepoint order. */
function _pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

// --- json.dumps(indent=2) emulation ----------------------------------------

function _pyJsonStr(s: string): string {
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
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

function pyJsonDumps(obj: Json, level = 0): string {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (obj instanceof PyFloat) {
        // Python repr(float): integral floats keep `.0`; otherwise shortest
        // round-trippable repr (JS `String` matches for these summed values).
        return Number.isInteger(obj.value) ? `${obj.value}.0` : String(obj.value);
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + pyJsonDumps(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumps((obj as Record<string, Json>)[k]!, level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

/** Build the JSON-serialisable report object in CPython dict insertion order. */
function _reportToJson(byConv: Map<string, ConvBucket>): Json {
    const byConvOut: Record<string, Json> = {};
    for (const [cid, b] of byConv) {
        const byModel: Record<string, Json> = {};
        for (const [model, m] of b.by_model) {
            byModel[model] = { sessions: m.sessions, cost_usd: new PyFloat(m.cost_usd) };
        }
        byConvOut[cid] = {
            sessions: b.sessions,
            total_cost_usd: new PyFloat(b.total_cost_usd),
            input_tokens: b.input_tokens,
            output_tokens: b.output_tokens,
            telegraph_delta_tokens: b.telegraph_delta_tokens,
            by_model: byModel,
        };
    }
    return { schema_version: 'cost-by-conversation/v1', by_conversation: byConvOut };
}

interface Args {
    input: string;
    format: 'text' | 'json';
}

function parse_args(argv: string[]): Args {
    const out: Args = { input: DEFAULT_JSONL, format: 'text' };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i]!;
        const takeValue = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                return a.slice(eq + 1);
            }
            i += 1;
            const v = argv[i];
            if (v === undefined) {
                process.stderr.write(`error: argument ${flag}: expected one argument\n`);
                process.exit(2);
            }
            return v;
        };
        if (a === '--input' || a.startsWith('--input=')) {
            out.input = takeValue('--input');
        } else if (a === '--format' || a.startsWith('--format=')) {
            const v = takeValue('--format');
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            out.format = v;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: cost_by_conversation [-h] [--input INPUT] [--format {text,json}]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const byConv = group(_load(args.input));
    if (args.format === 'json') {
        process.stdout.write(pyJsonDumps(_reportToJson(byConv)) + '\n');
    } else {
        // Python `print(render_text(...))` adds a trailing newline on top of the
        // string's own terminating "\n".
        process.stdout.write(render_text(byConv) + '\n');
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exit(main());
}
