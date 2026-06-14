#!/usr/bin/env node
/**
 * Telegraph per-session / per-conversation / lifetime token-delta lens.
 *
 * TypeScript twin of `src/scripts/telegraph_stats.py` (ADR-096 — Python→TS
 * migration, Phase 8 / Wave 8e). Public surface mirrors the Python module
 * exactly: same CLI flags (`--input`, `--format`), same exit code (0), same
 * stdout, and byte-identical `json.dumps(..., indent=2)` output.
 *
 * Reads sessions.jsonl, groups by sessionId + conversation_id, emits per-row
 * telegraph delta tokens. Honors the suspended-multiplier contract in
 * `docs/contracts/telegraph-telemetry.md` (delta = 0 while suspended).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_JSONL = path.join(REPO_ROOT, 'agents', 'cost-tracking', 'sessions.jsonl');

// Mirrors `docs/contracts/telegraph-telemetry.md` `v1` constants.
const MULTIPLIER_VERSION = 'v1';
const MULTIPLIER_VALUE = 0.9155;
const MULTIPLIER_ACTIVE = false; // suspended pending v2

/**
 * Marker for a Python `float` so `json.dumps` renders an integral float as
 * `0.0` (the `multiplier_value` field).
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

interface Bucket {
    sessions: number;
    delta_tokens: number;
    condensed_tokens: number;
}

interface Report {
    schema_version: string;
    multiplier_version: string;
    multiplier_value: number;
    multiplier_active: boolean;
    lifetime: Bucket;
    by_session: Map<string, Bucket>;
    by_conversation: Map<string, Bucket>;
}

function _isTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === '' || value === 0) {
        return false;
    }
    return true;
}

/** Python `str(row.get(a) or row.get(b) or "unknown")`. */
function _pyStr(value: unknown): string {
    return String(value);
}

/** Python `int(row.get("...") or 0)`. */
function _pyInt(value: unknown): number {
    if (!_isTruthy(value)) {
        return 0;
    }
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    const n = Number(value);
    return Number.isNaN(n) ? 0 : Math.trunc(n);
}

function _load(p: string): Record<string, unknown>[] {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
        return [];
    }
    const rows: Record<string, unknown>[] = [];
    const text = fs.readFileSync(p, 'utf-8');
    for (let line of text.split('\n')) {
        line = line.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        try {
            rows.push(JSON.parse(line) as Record<string, unknown>);
        } catch {
            continue;
        }
    }
    return rows;
}

/** Per-row delta with suspended-multiplier guard. */
function _delta(row: Record<string, unknown>): number {
    if (!MULTIPLIER_ACTIVE) {
        return 0;
    }
    const explicit = row['telegraph_delta_tokens'];
    if (typeof explicit === 'number') {
        return Math.trunc(explicit);
    }
    const condensed = row['telegraph_condensed_tokens'];
    if (typeof condensed === 'number' && condensed > 0) {
        return Math.trunc(condensed * MULTIPLIER_VALUE - condensed);
    }
    return 0;
}

function _zero(): Bucket {
    return { sessions: 0, delta_tokens: 0, condensed_tokens: 0 };
}

export function aggregate(rows: Record<string, unknown>[]): Report {
    const bySession: Map<string, Bucket> = new Map();
    const byConv: Map<string, Bucket> = new Map();
    const lifetime = _zero();
    for (const row of rows) {
        const sid = _isTruthy(row['sessionId'])
            ? _pyStr(row['sessionId'])
            : _isTruthy(row['session_id'])
              ? _pyStr(row['session_id'])
              : 'unknown';
        const cid = _isTruthy(row['conversation_id']) ? _pyStr(row['conversation_id']) : 'unknown';
        const delta = _delta(row);
        const comp = _pyInt(row['telegraph_condensed_tokens']);
        let s = bySession.get(sid);
        if (s === undefined) {
            s = _zero();
            bySession.set(sid, s);
        }
        let c = byConv.get(cid);
        if (c === undefined) {
            c = _zero();
            byConv.set(cid, c);
        }
        for (const bucket of [s, c, lifetime]) {
            bucket.sessions += 1;
            bucket.delta_tokens += delta;
            bucket.condensed_tokens += comp;
        }
    }
    return {
        schema_version: 'telegraph-stats/v1',
        multiplier_version: MULTIPLIER_VERSION,
        multiplier_value: MULTIPLIER_VALUE,
        multiplier_active: MULTIPLIER_ACTIVE,
        lifetime,
        by_session: bySession,
        by_conversation: byConv,
    };
}

// --- Python f-string number formatting -------------------------------------

/** Python `f"{n:,}"`. */
function _pyComma(n: number): string {
    const neg = n < 0;
    const digits = Math.abs(Math.trunc(n)).toString();
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return neg ? `-${grouped}` : grouped;
}

/** Python `f"{n:+,}"`. */
function _pyCommaSigned(n: number): string {
    const sign = n < 0 ? '-' : '+';
    const digits = Math.abs(Math.trunc(n)).toString();
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${grouped}`;
}

/** Python `f"{x:.4f}"` — round-half-to-even, padded to 4 decimals. */
function _pyFixed4(value: number): string {
    if (!Number.isFinite(value)) {
        return String(value);
    }
    const neg = value < 0 && value !== 0;
    const abs = Math.abs(value);
    const fixed = abs.toFixed(20);
    const dot = fixed.indexOf('.');
    const intPart = dot === -1 ? fixed : fixed.slice(0, dot);
    const fracPart = dot === -1 ? '' : fixed.slice(dot + 1);
    const keep = fracPart.slice(0, 4).padEnd(4, '0');
    const rest = fracPart.slice(4);
    const digits = (intPart + keep).split('');
    if (_decideRoundUp(digits, rest)) {
        _incrementDecimalDigits(digits);
    }
    const joined = digits.join('');
    const intLen = joined.length - 4;
    const newInt = joined.slice(0, intLen) || '0';
    const newFrac = joined.slice(intLen);
    const body = `${newInt}.${newFrac}`;
    return neg && Number(body) !== 0 ? `-${body}` : body;
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

function _pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export function render_text(report: Report): string {
    const lines: string[] = [
        `telegraph-stats ${report.schema_version} · multiplier ${report.multiplier_version}` +
            ` (${report.multiplier_active ? 'ACTIVE' : 'SUSPENDED'}) · ` +
            `value ${_pyFixed4(report.multiplier_value)}`,
        '',
        `  lifetime: ${report.lifetime.sessions} sessions · ` +
            `delta_tokens = ${_pyCommaSigned(report.lifetime.delta_tokens)} · ` +
            `condensed_tokens = ${_pyComma(report.lifetime.condensed_tokens)}`,
        '',
        '  by conversation:',
    ];
    const cids = [...report.by_conversation.keys()].sort(_pyStrCmp);
    for (const cid of cids) {
        const b = report.by_conversation.get(cid)!;
        lines.push(
            `    ${cid}: ${b.sessions} sessions · ` +
                `delta = ${_pyCommaSigned(b.delta_tokens)} · condensed = ${_pyComma(b.condensed_tokens)}`,
        );
    }
    if (!report.multiplier_active) {
        lines.push(
            '',
            '  Note: multiplier suspended — see docs/contracts/telegraph-telemetry.md',
            '  (delta_tokens = 0 until kill-criterion satisfied in telegraph-v2).',
        );
    }
    return lines.join('\n') + '\n';
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

function _bucketToJson(b: Bucket): Json {
    return {
        sessions: b.sessions,
        delta_tokens: b.delta_tokens,
        condensed_tokens: b.condensed_tokens,
    };
}

/** Build the JSON-serialisable report in CPython dict insertion order. */
function _reportToJson(report: Report): Json {
    const bySession: Record<string, Json> = {};
    for (const [sid, b] of report.by_session) {
        bySession[sid] = _bucketToJson(b);
    }
    const byConv: Record<string, Json> = {};
    for (const [cid, b] of report.by_conversation) {
        byConv[cid] = _bucketToJson(b);
    }
    return {
        schema_version: report.schema_version,
        multiplier_version: report.multiplier_version,
        multiplier_value: new PyFloat(report.multiplier_value),
        multiplier_active: report.multiplier_active,
        lifetime: _bucketToJson(report.lifetime),
        by_session: bySession,
        by_conversation: byConv,
    };
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
            process.stdout.write('usage: telegraph_stats [-h] [--input INPUT] [--format {text,json}]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const rows = _load(args.input);
    const report = aggregate(rows);
    if (args.format === 'json') {
        process.stdout.write(pyJsonDumps(_reportToJson(report)) + '\n');
    } else {
        // Python `print(render_text(...))` adds a trailing newline on top of the
        // string's own terminating "\n".
        process.stdout.write(render_text(report) + '\n');
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exit(main());
}
