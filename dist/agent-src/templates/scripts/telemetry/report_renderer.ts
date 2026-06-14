/**
 * Engagement report renderer (Phase 4 Step 2).
 *
 * TypeScript twin of `report_renderer.py` (ADR-096). Byte-for-byte parity on
 * both formats: same quartile bucketing, same markdown table, same JSON
 * (`json.dumps(sort_keys=True, indent=2)`), same redaction re-validation,
 * same Python float / fixed-decimal rendering (round-half-to-even).
 */
import {
    type ArtefactStat,
    type AggregateResult,
    rank_artefacts,
} from './aggregator.js';
import { ALLOWED_OUTCOMES, check_id_redaction } from './engagement.js';

export const QUARTILE_TOP_RATIO = 0.20;
export const QUARTILE_BOTTOM_RATIO = 0.20;

export const BUCKET_TOP = 'essential';
export const BUCKET_MID = 'useful';
export const BUCKET_BOTTOM = 'retirement_candidate';

export interface BucketedStat {
    stat: ArtefactStat;
    bucket: string;
}

/** Assign each stat to a quartile bucket. Ranking from rank_artefacts assumed. */
export function bucketise(stats: ArtefactStat[]): BucketedStat[] {
    const n = stats.length;
    if (n === 0) {
        return [];
    }
    if (n <= 1) {
        return [{ stat: stats[0] as ArtefactStat, bucket: BUCKET_TOP }];
    }
    const top_cut = Math.max(1, _intRound(n * QUARTILE_TOP_RATIO));
    let bottom_cut = n >= 5 ? n - Math.max(1, _intRound(n * QUARTILE_BOTTOM_RATIO)) : n;
    if (bottom_cut <= top_cut) {
        bottom_cut = n; // mid takes the rest, no retirement bucket
    }
    const out: BucketedStat[] = [];
    for (let idx = 0; idx < n; idx += 1) {
        let bucket: string;
        if (idx < top_cut) {
            bucket = BUCKET_TOP;
        } else if (idx < bottom_cut) {
            bucket = BUCKET_MID;
        } else {
            bucket = BUCKET_BOTTOM;
        }
        out.push({ stat: stats[idx] as ArtefactStat, bucket });
    }
    return out;
}

export interface RenderOptions {
    top?: number | null;
    since_label?: string | null;
}

/** Render a markdown report. `top` truncates each bucket; null keeps all. */
export function render_markdown(aggregate: AggregateResult, opts: RenderOptions = {}): string {
    const top = opts.top ?? null;
    const since_label = opts.since_label ?? null;
    const ranked = rank_artefacts(aggregate.stats());
    const bucketed = bucketise(ranked);
    const grouped: Record<string, BucketedStat[]> = {
        [BUCKET_TOP]: [],
        [BUCKET_MID]: [],
        [BUCKET_BOTTOM]: [],
    };
    for (const entry of bucketed) {
        (grouped[entry.bucket] as BucketedStat[]).push(entry);
    }

    const lines: string[] = [];
    lines.push('# Artefact Engagement Report');
    lines.push('');
    lines.push(`- events parsed: **${aggregate.parsed_events}**`);
    lines.push(`- events skipped (malformed): **${aggregate.skipped_lines}**`);
    if (since_label) {
        lines.push(`- window: **${since_label}**`);
    }
    if (aggregate.earliest_ts && aggregate.latest_ts) {
        lines.push(`- ts range: \`${aggregate.earliest_ts}\` → \`${aggregate.latest_ts}\``);
    }
    lines.push('');

    const outcomes_total = _sumValues(aggregate.outcomes);
    if (outcomes_total) {
        lines.push('## Outcomes');
        lines.push('');
        lines.push('| outcome | count | share |');
        lines.push('|---|---:|---:|');
        for (const label of ALLOWED_OUTCOMES) {
            const count = aggregate.outcomes.get(label) ?? 0;
            if (!count) {
                continue;
            }
            const share = count / outcomes_total;
            lines.push(`| ${label} | ${count} | ${_pyFixed(share, 2)} |`);
        }
        lines.push('');
    }

    const titles: Record<string, string> = {
        [BUCKET_TOP]: 'Essential (top 20 %)',
        [BUCKET_MID]: 'Useful (mid 60 %)',
        [BUCKET_BOTTOM]: 'Retirement candidates (bottom 20 %)',
    };
    for (const bucket of [BUCKET_TOP, BUCKET_MID, BUCKET_BOTTOM]) {
        let rows = grouped[bucket] as BucketedStat[];
        if (top !== null) {
            rows = rows.slice(0, top);
        }
        lines.push(`## ${titles[bucket]}`);
        lines.push('');
        if (rows.length === 0) {
            lines.push('_(none)_');
            lines.push('');
            continue;
        }
        lines.push('| kind | id | consulted | applied | applied/consulted | last seen |');
        lines.push('|---|---|---:|---:|---:|---|');
        for (const entry of rows) {
            const s = entry.stat;
            check_id_redaction(`buckets.${s.kind}.id`, s.artefact_id);
            lines.push(
                `| ${s.kind} | \`${s.artefact_id}\` | ${s.consulted} | ${s.applied} `
                + `| ${_pyFixed(s.applied_ratio, 2)} | \`${s.last_seen_ts}\` |`,
            );
        }
        lines.push('');
    }
    return `${_pyRStrip(lines.join('\n'))}\n`;
}

export function render_json(aggregate: AggregateResult, opts: RenderOptions = {}): string {
    const top = opts.top ?? null;
    const since_label = opts.since_label ?? null;
    const ranked = rank_artefacts(aggregate.stats());
    const bucketed = bucketise(ranked);
    const grouped: Record<string, Array<Record<string, unknown>>> = {
        [BUCKET_TOP]: [],
        [BUCKET_MID]: [],
        [BUCKET_BOTTOM]: [],
    };
    for (const entry of bucketed) {
        (grouped[entry.bucket] as Array<Record<string, unknown>>).push(_stat_to_dict(entry.stat));
    }
    if (top !== null) {
        for (const bucket of Object.keys(grouped)) {
            grouped[bucket] = (grouped[bucket] as Array<Record<string, unknown>>).slice(0, top);
        }
    }
    const outcomes_total = _sumValues(aggregate.outcomes);
    const by_category: Record<string, number> = {};
    for (const label of ALLOWED_OUTCOMES) {
        const count = aggregate.outcomes.get(label) ?? 0;
        if (count) {
            by_category[label] = count;
        }
    }
    const outcomes_payload = { total: outcomes_total, by_category };
    const payload = {
        schema_version: 1,
        summary: {
            parsed_events: aggregate.parsed_events,
            skipped_lines: aggregate.skipped_lines,
            total_events: aggregate.total_events,
            earliest_ts: aggregate.earliest_ts,
            latest_ts: aggregate.latest_ts,
            since_label,
        },
        outcomes: outcomes_payload,
        buckets: grouped,
    };
    return `${_py_json_dumps_indent2_sorted(payload)}\n`;
}

function _stat_to_dict(stat: ArtefactStat): Record<string, unknown> {
    check_id_redaction(`buckets.${stat.kind}.id`, stat.artefact_id);
    return {
        kind: stat.kind,
        id: stat.artefact_id,
        consulted: stat.consulted,
        applied: stat.applied,
        applied_ratio: new PyFloat(_pyRound(stat.applied_ratio, 4)),
        last_seen_ts: stat.last_seen_ts,
    };
}

// ── Python-parity helpers ───────────────────────────────────────────────

function _sumValues(m: Map<string, number>): number {
    let total = 0;
    for (const v of m.values()) {
        total += v;
    }
    return total;
}

/** Python `str.rstrip()` — strip trailing whitespace. */
function _pyRStrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** `int(round(x))` with round-half-to-even on the exact IEEE value. */
function _intRound(x: number): number {
    return _pyRound(x, 0);
}

/**
 * CPython `round(x, ndigits)` — round-half-to-even on the exact decimal
 * expansion of the IEEE-754 double. Same algorithm as value_ladder.ts.
 */
export function _pyRound(value: number, ndigits = 0): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        const factor = 10 ** ndigits;
        return value > 0
            ? (Math.round(abs * factor) / factor) * sign
            : -Math.round(abs * factor) / factor;
    }
    const dot = str.indexOf('.');
    const intPart = dot === -1 ? str : str.slice(0, dot);
    let fracPart = dot === -1 ? '' : str.slice(dot + 1);
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keepFrac = fracPart.slice(0, ndigits);
    const deciderStr = fracPart.slice(ndigits);
    const scaledIntStr = intPart + keepFrac;
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
    return result === 0 ? 0 : result * sign;
}

/**
 * Python `format(x, '.Nf')` — fixed-point, N decimals, round-half-to-even on
 * the exact IEEE value. Always emits exactly N fractional digits.
 */
export function _pyFixed(value: number, ndigits: number): string {
    if (!Number.isFinite(value)) {
        return String(value);
    }
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    const str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        // Out-of-range magnitudes do not occur for ratio/share inputs.
        return sign + abs.toFixed(ndigits);
    }
    const dot = str.indexOf('.');
    const intPart = dot === -1 ? str : str.slice(0, dot);
    let fracPart = dot === -1 ? '' : str.slice(dot + 1);
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keepFrac = fracPart.slice(0, ndigits);
    const deciderStr = fracPart.slice(ndigits);
    let scaledInt = BigInt((intPart + keepFrac) || '0');
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
    let digits = scaledInt.toString();
    while (digits.length <= ndigits) {
        digits = `0${digits}`;
    }
    const outInt = ndigits === 0 ? digits : digits.slice(0, digits.length - ndigits);
    const outFrac = ndigits === 0 ? '' : digits.slice(digits.length - ndigits);
    const zeroValue = /^0*$/u.test(digits);
    return `${zeroValue ? '' : sign}${outInt}${ndigits > 0 ? `.${outFrac}` : ''}`;
}

// ── Python-parity JSON (indent=2, sorted keys) ──────────────────────────

/** Box a float so the serializer renders it as a Python float (`0.0`, …). */
class PyFloat {
    constructor(public readonly value: number) {}
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof PyFloat);
}

/** Mirror `json.dumps(obj, sort_keys=True, indent=2)` (+ ensure_ascii=True). */
function _py_json_dumps_indent2_sorted(value: unknown): string {
    return _dumpIndent2(value, 0);
}

function _dumpIndent2(value: unknown, depth: number): string {
    if (value instanceof PyFloat) {
        return _pyFloatRepr(value.value);
    }
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : _pyFloatRepr(value);
    }
    if (typeof value === 'string') {
        return _pyJsonStringAscii(value);
    }
    const pad = '  '.repeat(depth + 1);
    const closePad = '  '.repeat(depth);
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpIndent2(v, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
    if (keys.length === 0) {
        return '{}';
    }
    const items = keys.map(
        (k) => `${pad}${_pyJsonStringAscii(k)}: ${_dumpIndent2(obj[k], depth + 1)}`,
    );
    return `{\n${items.join(',\n')}\n${closePad}}`;
}

/** Python `repr(float)` — shortest round-trip; integers get a trailing `.0`. */
function _pyFloatRepr(n: number): string {
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

/** json.dumps default ensure_ascii=True string rendering. */
function _pyJsonStringAscii(s: string): string {
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
    return `${out}"`;
}
