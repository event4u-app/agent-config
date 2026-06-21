#!/usr/bin/env tsx
/**
 * Plain-mode renderer for the `explain-v1` envelope — Phase 6 (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_explain.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same
 * subcommands, same exit codes, same `json.dumps(out, sort_keys=True)` output,
 * same Markdown rendering, same band thresholds, same hand-rolled glossary
 * parser. No behaviour changes — latent quirks are replicated, not fixed.
 *
 * Implements `docs/contracts/explain-modes.md`. Pure function over the
 * envelope; no I/O. Per-role glossary YAMLs override the default labels +
 * band thresholds.
 *
 * Float parity note: Python f-strings (`f"{score:.2f}"`) format via the C
 * library's round-half-to-even on the EXACT IEEE-754 double — which JS
 * `Number.prototype.toFixed(2)` does NOT reproduce (e.g. `(0.125).toFixed(2)`
 * → "0.13" in JS but `f"{0.125:.2f}"` → "0.12" in Python). `_pyFixed2`
 * replicates `%.2f` exactly by expanding the double's exact decimal and
 * rounding half-to-even (validated against python3 across 5000+ values).
 *
 * Relative-time note: `_humanRelative` mirrors Python's
 * `datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")` + UTC delta. The CLI render
 * path does NOT thread `now`, so plain-mode `last_reviewed` is intentionally
 * non-deterministic (live clock) — same as the Python original.
 *
 * CLI:
 *
 *     workspace_explain.ts render --mode plain|technical [--role <slug>] \
 *                                 [--envelope-file <p>] [--glossary <p>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

// --- JSON byte-parity (compact, ensure_ascii=True, sort_keys=True) ----------
//
// `json.dumps(obj, sort_keys=True)` (no indent) → default separators
// `(", ", ": ")`, every non-ASCII code point escaped to `\uXXXX`, keys sorted.

function _jsonStrAscii(s: string): string {
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
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    const v = code - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out +=
                        '\\u' +
                        hi.toString(16).padStart(4, '0') +
                        '\\u' +
                        lo.toString(16).padStart(4, '0');
                }
        }
    }
    return out + '"';
}

function _jsonScalarSorted(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpSorted(value: unknown): string {
    const scalar = _jsonScalarSorted(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _dumpSorted(v)).join(', ') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return (
            '{' +
            keys.map((k) => `${_jsonStrAscii(k)}: ${_dumpSorted(obj[k])}`).join(', ') +
            '}'
        );
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(value, sort_keys=True)` (compact, ensure_ascii=True). */
function jsonDumpsSorted(value: unknown): string {
    return _dumpSorted(value);
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

// --- Python f-string `:.2f` parity ------------------------------------------
//
// CPython formats `:.2f` with round-half-to-even on the EXACT decimal value of
// the IEEE-754 double. `toFixed(2)` diverges on exact-half cases (0.125 → 0.13
// in JS vs 0.12 in Python). Expand the double's exact decimal (`toFixed(60)` is
// exact for any finite double here) and round at 2 dp half-to-even.
function _pyFixed2(x: number): string {
    const neg = x < 0 || Object.is(x, -0);
    const a = Math.abs(x);
    const s = a.toFixed(60);
    const dot = s.indexOf('.');
    const intPart = s.slice(0, dot);
    const frac = s.slice(dot + 1);
    const keep = frac.slice(0, 2).padEnd(2, '0');
    const rest = frac.slice(2);
    let roundUp = false;
    const firstRest = rest.length ? (rest[0] as string) : '0';
    if (firstRest > '5') {
        roundUp = true;
    } else if (firstRest < '5') {
        roundUp = false;
    } else {
        const after = rest.slice(1).replace(/0+$/, '');
        if (after.length > 0) {
            roundUp = true;
        } else {
            // Exact half → round to even.
            roundUp = parseInt(keep[1] as string, 10) % 2 === 1;
        }
    }
    let kept2 = parseInt(keep, 10);
    let carry = 0;
    if (roundUp) {
        kept2 += 1;
        if (kept2 === 100) {
            kept2 = 0;
            carry = 1;
        }
    }
    const intNum = BigInt(intPart) + BigInt(carry);
    const body = intNum.toString() + '.' + String(kept2).padStart(2, '0');
    return (neg ? '-' : '') + body;
}

// ---------------------------------------------------------------------------
// Module body (workspace_explain.py).
// ---------------------------------------------------------------------------

const DEFAULT_BANDS_CONFIDENCE: Record<string, number> = {
    very_high: 0.85,
    high: 0.65,
    medium: 0.4,
};
const DEFAULT_BANDS_FRESHNESS: Record<string, number> = { fresh: 0.8, aging: 0.5 };

const DEFAULT_LABELS_PLAIN: Record<string, string> = {
    confidence: 'How confident',
    sources: 'Where this came from',
    last_reviewed: 'When last reviewed',
    contradictions: "What's contested",
};

const LABELS_TECHNICAL: Record<string, string> = {
    confidence: 'Trust score',
    sources: 'Sources',
    last_reviewed: 'Last reviewed',
    contradictions: 'Unresolved contradictions',
};

interface Glossary {
    labels: Record<string, string>;
    bands_confidence: Record<string, number>;
    bands_freshness: Record<string, number>;
}

function glossaryDefault(): Glossary {
    return {
        labels: { ...DEFAULT_LABELS_PLAIN },
        bands_confidence: { ...DEFAULT_BANDS_CONFIDENCE },
        bands_freshness: { ...DEFAULT_BANDS_FRESHNESS },
    };
}

/** Python `str.rstrip()` — strip all trailing ASCII + Unicode whitespace. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Python `str.strip()` — strip leading + trailing whitespace. */
function _strip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Python `str.lstrip()`. */
function _lstrip(s: string): string {
    return s.replace(/^\s+/u, '');
}

/** Python `str.partition(sep)` → [before, sep|'', after|'']. */
function _partition(s: string, sep: string): [string, string, string] {
    const idx = s.indexOf(sep);
    if (idx === -1) return [s, '', ''];
    return [s.slice(0, idx), sep, s.slice(idx + sep.length)];
}

/** Python `v.strip("'\"")` — strip leading/trailing quote chars. */
function _stripQuotes(s: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && (s[start] === "'" || s[start] === '"')) start += 1;
    while (end > start && (s[end - 1] === "'" || s[end - 1] === '"')) end -= 1;
    return s.slice(start, end);
}

/** Python `float(str)` for the glossary band parser; throws on invalid. */
function _pyFloat(s: string): number {
    const t = _strip(s);
    if (t === '') throw new Error('ValueError');
    // Python float() accepts inf / nan / underscores in some forms; the band
    // parser only meaningfully sees plain decimals. Mirror the common surface.
    const lower = t.toLowerCase();
    if (lower === 'inf' || lower === '+inf' || lower === 'infinity' || lower === '+infinity') {
        return Infinity;
    }
    if (lower === '-inf' || lower === '-infinity') return -Infinity;
    if (lower === 'nan' || lower === '+nan' || lower === '-nan') return NaN;
    // Reject anything Number() would coerce but float() would reject.
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
        throw new Error('ValueError');
    }
    const n = Number(t);
    if (Number.isNaN(n)) throw new Error('ValueError');
    return n;
}

function loadGlossary(p: string): Glossary {
    const g = glossaryDefault();
    if (!fs.existsSync(p)) {
        return g;
    }
    let inLabels = false;
    let inBands = false;
    let inBc = false;
    let inBf = false;
    const text = fs.readFileSync(p, { encoding: 'utf-8' });
    for (const raw of _splitlines(text)) {
        const line = _rstrip(raw);
        if (!line || _lstrip(line).startsWith('#')) {
            continue;
        }
        if (line === 'labels:') {
            inLabels = true;
            inBands = false;
            inBc = false;
            inBf = false;
            continue;
        }
        if (line === 'bands:') {
            inLabels = false;
            inBands = true;
            continue;
        }
        if (inBands && _lstrip(line).startsWith('confidence:')) {
            inBc = true;
            inBf = false;
            continue;
        }
        if (inBands && _lstrip(line).startsWith('freshness:')) {
            inBc = false;
            inBf = true;
            continue;
        }
        if (inLabels && line.includes(':') && line.startsWith('  ')) {
            const [k, , v] = _partition(_strip(line), ':');
            g.labels[_strip(k)] = _stripQuotes(_strip(v));
        } else if ((inBc || inBf) && line.includes(':') && line.startsWith('    ')) {
            const [k, , v] = _partition(_strip(line), ':');
            let val: number;
            try {
                val = _pyFloat(_strip(v));
            } catch {
                continue;
            }
            if (inBc) {
                g.bands_confidence[_strip(k)] = val;
            } else {
                g.bands_freshness[_strip(k)] = val;
            }
        }
    }
    return g;
}

/** Python `str.splitlines()` — split on universal newlines, no trailing empty. */
function _splitlines(s: string): string[] {
    if (s === '') return [];
    // Python splitlines() splits on \n \r \r\n (and more); our YAML uses \n/\r\n.
    const lines = s.split(/\r\n|\r|\n/u);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

function _band(score: number, bands: Record<string, number>, plain: boolean): string {
    if (plain) {
        if (score >= (bands['very_high'] ?? 0.85)) {
            return 'Very High';
        }
        if (score >= (bands['high'] ?? 0.65)) {
            return 'High';
        }
        if (score >= (bands['medium'] ?? 0.4)) {
            return 'Medium';
        }
        return 'Low';
    }
    return _pyFixed2(score);
}

function _freshnessBand(score: number, bands: Record<string, number>): string {
    if (score >= (bands['fresh'] ?? 0.8)) {
        return 'Fresh';
    }
    if (score >= (bands['aging'] ?? 0.5)) {
        return 'Aging';
    }
    return 'Stale';
}

const _STRPTIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

/**
 * Parse `%Y-%m-%dT%H:%M:%SZ` as UTC → epoch ms, or null on parse failure
 * (mirrors the Python try/except over strptime). `datetime.strptime` validates
 * field ranges (month 1-12, etc.), so a syntactically-matching-but-invalid
 * string still raises ValueError → null here.
 */
function _pyStrptimeUtcMs(ts: string): number | null {
    const m = _STRPTIME_RE.exec(ts);
    if (m === null) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6]);
    // strptime range validation (ValueError otherwise).
    if (month < 1 || month > 12) return null;
    if (hour > 23 || minute > 59 || second > 61) return null;
    const dim = _daysInMonth(year, month);
    if (day < 1 || day > dim) return null;
    return Date.UTC(year, month - 1, day, hour, minute, second);
}

function _daysInMonth(year: number, month: number): number {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return lengths[month - 1] as number;
}

/** Python integer floor-division `a // b` for the day/hour computations. */
function _floorDiv(a: number, b: number): number {
    return Math.floor(a / b);
}

/**
 * Plain-language relative timestamp. Mirrors the Python `_human_relative`:
 * parse `%Y-%m-%dT%H:%M:%SZ` (UTC); on failure return `ts or "(unavailable)"`.
 * `now` defaults to the live UTC clock (non-deterministic, per the original).
 */
function _humanRelative(ts: string, now?: number): string {
    const whenMs = _pyStrptimeUtcMs(ts);
    if (whenMs === null) {
        return ts || '(unavailable)';
    }
    const refMs = now ?? Date.now();
    const deltaSeconds = (refMs - whenMs) / 1000;
    // Python timedelta.days is floor-divided whole days (can be negative).
    const days = _floorDiv(deltaSeconds, 86400);
    if (days < 1) {
        const h = Math.max(1, _floorDiv(deltaSeconds, 3600));
        return `${h} hour${h !== 1 ? 's' : ''} ago`;
    }
    if (days < 30) {
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    const months = _floorDiv(days, 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
}

/**
 * Python `", ".join(items)` — strict: every element must already be a `str`.
 * A non-string element raises TypeError in CPython (e.g. an int source), which
 * propagates to an exit-1 traceback. The twin throws so that path matches.
 */
function _pyStrJoin(items: unknown[]): string {
    const parts: string[] = [];
    for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        if (typeof it !== 'string') {
            throw new Error(
                `sequence item ${i}: expected str instance, ${typeof it} found`,
            );
        }
        parts.push(it);
    }
    return parts.join(', ');
}

/** Python truthiness for the values this module inspects. */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as object).length > 0;
    return true;
}

/** `float(envelope.get(...) or 0.0)` — coerce via Python float() semantics. */
function _floatOrZero(value: unknown): number {
    if (!_pyTruthy(value)) return 0.0;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1.0 : 0.0;
    if (typeof value === 'string') return _pyFloat(value);
    // Python float() on a dict/list raises TypeError; the source assumes JSON
    // numbers here, so this branch is unreachable in practice.
    return _pyFloat(String(value));
}

type Dict = Record<string, unknown>;

function render(
    envelope: Dict,
    opts?: { mode?: string; glossary?: Glossary | null; now?: number },
): Dict {
    const mode = opts?.mode ?? 'plain';
    const plain = mode !== 'technical';
    const g = opts?.glossary ?? glossaryDefault();
    const labels = plain ? g.labels : LABELS_TECHNICAL;
    const trust = _floatOrZero(envelope['trust_score']);
    const decay = (_pyTruthy(envelope['decay']) ? envelope['decay'] : {}) as Dict;
    const fresh = _floatOrZero(decay['applied_factor']);
    const evidence = (_pyTruthy(envelope['evidence']) ? envelope['evidence'] : {}) as Dict;
    const sources = (_pyTruthy(evidence['sources']) ? evidence['sources'] : []) as unknown[];
    const contradictions = (
        _pyTruthy(envelope['contradictions']) ? envelope['contradictions'] : []
    ) as unknown[];
    const last_reviewed = envelope['last_reviewed_at'];
    const lines: string[] = [];
    lines.push(`## ${labels['sources']}`);
    lines.push(
        `${sources.length} source(s)` +
            (_pyTruthy(sources) ? ' — ' + _pyStrJoin(sources.slice(0, 5)) : ''),
    );
    lines.push('');
    lines.push(`## ${labels['confidence']}`);
    lines.push(`${_band(trust, g.bands_confidence, plain)}` + (plain ? ` (${_pyFixed2(trust)})` : ''));
    lines.push('');
    lines.push(`## ${labels['last_reviewed']}`);
    if (plain) {
        lines.push(
            _humanRelative(
                _pyTruthy(last_reviewed) ? (last_reviewed as string) : '',
                opts?.now,
            ) + ` · ${_freshnessBand(fresh, g.bands_freshness)}`,
        );
    } else {
        lines.push(
            `${_pyTruthy(last_reviewed) ? (last_reviewed as string) : '(unavailable)'} · decay=${_pyFixed2(fresh)}`,
        );
    }
    lines.push('');
    lines.push(`## ${labels['contradictions']}`);
    lines.push(
        _pyTruthy(contradictions)
            ? `${contradictions.length} open`
            : plain
              ? 'No open disagreements.'
              : '0',
    );
    return {
        markdown: _rstrip(lines.join('\n')) + '\n',
        mode: plain ? 'plain' : 'technical',
        ids: _pyTruthy(envelope['id']) ? [envelope['id']] : [],
    };
}

function renderHostDecision(
    detection: Dict,
    opts?: { health?: Dict | null; resume_session_id?: string | null; mode?: string },
): Dict {
    const mode = opts?.mode ?? 'plain';
    const resume_session_id = opts?.resume_session_id ?? null;
    const plain = mode !== 'technical';
    const host = 'host' in detection ? detection['host'] : '(unknown)';
    const known = 'known' in detection ? detection['known'] : false;
    const inv_tier = detection['inventory_tier'];
    const eff_tier = 'effective_tier' in detection ? detection['effective_tier'] : 3;
    const cli = detection['cli'];
    const cli_present = 'cli_present' in detection ? detection['cli_present'] : false;
    const health = (opts?.health ?? {}) as Dict;
    const killed = Boolean(_pyTruthy(health['killed']) ? health['killed'] : false);
    const fails = _intOrZero(health['consecutive_failures']);

    if (!plain) {
        const techLines = [
            '## Host decision (technical)',
            `host=${_pyStr(host)} known=${_pyStr(known)} inventory_tier=${_pyStr(inv_tier)} ` +
                `effective_tier=${_pyStr(eff_tier)} cli=${_pyStr(cli)} cli_present=${_pyStr(cli_present)} ` +
                `killed=${_pyStr(killed)} consecutive_failures=${_pyStr(fails)} ` +
                `resume_session_id=${_pyTruthy(resume_session_id) ? _pyStr(resume_session_id) : '-'}`,
        ];
        return { markdown: techLines.join('\n') + '\n', mode: 'technical', host };
    }

    const lines: string[] = [];
    lines.push('## Why this host');
    lines.push(
        _pyTruthy(known)
            ? `\`${_pyStr(host)}\` is your active host.`
            : `\`${_pyStr(host)}\` is not in the known-host list, so it is treated ` +
                  'as a hand-off host.',
    );
    lines.push('');
    lines.push('## Why this tier');
    if (_pyEq(eff_tier, 1)) {
        lines.push(
            `Running at **Tier 1** — \`${_pyStr(host)}\` drives the work directly ` +
                `because its CLI (\`${_pyStr(cli)}\`) is installed and on your PATH.`,
        );
    } else {
        lines.push(
            `Running at **Tier 3** — \`${_pyStr(host)}\` hands work off through the ` +
                'inbox rather than driving it directly.',
        );
    }
    lines.push('');

    // "Why a fallback fired" — only when a demotion or a kill actually happened.
    const fallback: string[] = [];
    if (_pyTruthy(known) && _pyEq(inv_tier, 1) && !_pyTruthy(cli_present)) {
        fallback.push(
            `\`${_pyStr(host)}\` would normally drive at Tier 1, but its CLI ` +
                `(\`${_pyStr(cli)}\`) isn't on your PATH — so it dropped to Tier 3 ` +
                'hand-off. Install the CLI to get direct driving back.',
        );
    }
    if (killed) {
        fallback.push(
            `The drive kill-switch is **on** for \`${_pyStr(host)}\` after ${fails} ` +
                'consecutive failures. New launches run as a probe — one success ' +
                'closes the switch automatically.',
        );
    }
    if (fallback.length > 0) {
        lines.push('## Why a fallback fired');
        for (const f of fallback) lines.push(f);
        lines.push('');
    }

    if (_pyTruthy(resume_session_id)) {
        lines.push('## Why continue');
        lines.push(
            `Resuming your previous session (\`${_pyStr(resume_session_id)}\`) instead ` +
                'of starting fresh, so the task keeps its context across turns.',
        );
        lines.push('');
    }

    return { markdown: _rstrip(lines.join('\n')) + '\n', mode: 'plain', host };
}

/** Python `str(value)` for the values this module interpolates into f-strings. */
function _pyStr(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'number') return _pyNumStr(value);
    if (typeof value === 'string') return value;
    return String(value);
}

/** Python `str()` of a JSON number (int → no `.0`, float → repr-ish). */
function _pyNumStr(n: number): string {
    if (Number.isInteger(n) && Object.is(n, Math.trunc(n)) && !Object.is(n, -0)) {
        // Integral JSON numbers parsed from json.loads are ints → no `.0`.
        // (json.loads distinguishes `1` (int) from `1.0` (float); a bare
        // integral float would print `1.0`, but these fields carry ints.)
        return String(n);
    }
    return String(n);
}

/** `int(health.get(...) or 0)` — Python int() coercion. */
function _intOrZero(value: unknown): number {
    if (!_pyTruthy(value)) return 0;
    if (typeof value === 'number') return Math.trunc(value);
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
        const t = _strip(value);
        if (!/^[+-]?\d+$/.test(t)) throw new Error('ValueError');
        return parseInt(t, 10);
    }
    return 0;
}

/** Python `==` for the tier comparisons (`eff_tier == 1`). */
function _pyEq(a: unknown, b: number): boolean {
    if (typeof a === 'number') return a === b;
    if (typeof a === 'boolean') return (a ? 1 : 0) === b;
    return false;
}

interface ParsedArgs {
    cmd: string;
    mode: string;
    envelope_file?: string;
    glossary?: string;
    detection_file?: string;
    health_file?: string;
    resume_session_id?: string;
}

const PROG = 'workspace_explain';

const USAGE = `usage: ${PROG} [-h] {render,explain-host} ...\n`;
const USAGE_RENDER = `usage: ${PROG} render [-h] [--mode {plain,technical}] --envelope-file ENVELOPE_FILE [--glossary GLOSSARY]\n`;
const USAGE_HOST = `usage: ${PROG} explain-host [-h] [--mode {plain,technical}] --detection-file DETECTION_FILE [--health-file HEALTH_FILE] [--resume-session-id RESUME_SESSION_ID]\n`;

function _argError(usage: string, prog: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${prog}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

/** Options that take a value, per subcommand. */
const RENDER_VALUE_OPTS = new Set(['--mode', '--envelope-file', '--glossary']);
const HOST_VALUE_OPTS = new Set([
    '--mode',
    '--detection-file',
    '--health-file',
    '--resume-session-id',
]);

function _parse(argv: string[]): ParsedArgs {
    let i = 0;
    if (i < argv.length && (argv[i] === '-h' || argv[i] === '--help')) {
        process.stdout.write(USAGE);
        throw new ArgparseExit(0);
    }
    if (i >= argv.length) {
        _argError(USAGE, PROG, 'the following arguments are required: cmd');
    }
    const cmd = argv[i] as string;
    i += 1;
    if (cmd !== 'render' && cmd !== 'explain-host') {
        _argError(
            USAGE,
            PROG,
            `argument cmd: invalid choice: '${cmd}' (choose from 'render', 'explain-host')`,
        );
    }
    const subUsage = cmd === 'render' ? USAGE_RENDER : USAGE_HOST;
    const subProg = `${PROG} ${cmd}`;
    const valueOpts = cmd === 'render' ? RENDER_VALUE_OPTS : HOST_VALUE_OPTS;
    const out: ParsedArgs = { cmd, mode: 'plain' };
    const positionals: string[] = [];
    const unrecognized: string[] = [];

    while (i < argv.length) {
        let a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        // Support `--opt=value` form (argparse accepts it).
        let inlineVal: string | null = null;
        if (a.startsWith('--') && a.includes('=')) {
            const eq = a.indexOf('=');
            inlineVal = a.slice(eq + 1);
            a = a.slice(0, eq);
        }
        if (valueOpts.has(a)) {
            let val: string;
            if (inlineVal !== null) {
                val = inlineVal;
                i += 1;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(subUsage, subProg, `argument ${a}: expected one argument`);
                }
                val = argv[i + 1] as string;
                i += 2;
            }
            if (a === '--mode') {
                if (val !== 'plain' && val !== 'technical') {
                    _argError(
                        subUsage,
                        subProg,
                        `argument --mode: invalid choice: '${val}' (choose from 'plain', 'technical')`,
                    );
                }
                out.mode = val;
            } else if (a === '--envelope-file') {
                out.envelope_file = val;
            } else if (a === '--glossary') {
                out.glossary = val;
            } else if (a === '--detection-file') {
                out.detection_file = val;
            } else if (a === '--health-file') {
                out.health_file = val;
            } else if (a === '--resume-session-id') {
                out.resume_session_id = val;
            }
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            unrecognized.push(argv[i] as string);
            i += 1;
            continue;
        }
        positionals.push(argv[i] as string);
        i += 1;
    }

    // Required-option enforcement (argparse reports these at the sub-parser).
    if (cmd === 'render') {
        if (out.envelope_file === undefined) {
            _argError(
                subUsage,
                subProg,
                'the following arguments are required: --envelope-file',
            );
        }
    } else {
        if (out.detection_file === undefined) {
            _argError(
                subUsage,
                subProg,
                'the following arguments are required: --detection-file',
            );
        }
    }
    const extra = [...positionals, ...unrecognized];
    if (extra.length > 0) {
        _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
    }
    return out;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    if (args.cmd === 'render') {
        const env = JSON.parse(
            fs.readFileSync(args.envelope_file as string, { encoding: 'utf-8' }),
        ) as Dict;
        const gloss = args.glossary !== undefined ? loadGlossary(args.glossary) : null;
        const out = render(env, { mode: args.mode, glossary: gloss });
        print(jsonDumpsSorted(out));
        return 0;
    }
    if (args.cmd === 'explain-host') {
        const detection = JSON.parse(
            fs.readFileSync(args.detection_file as string, { encoding: 'utf-8' }),
        ) as Dict;
        const health =
            args.health_file !== undefined
                ? (JSON.parse(
                      fs.readFileSync(args.health_file, { encoding: 'utf-8' }),
                  ) as Dict)
                : null;
        const out = renderHostDecision(detection, {
            health,
            resume_session_id: args.resume_session_id ?? null,
            mode: args.mode,
        });
        print(jsonDumpsSorted(out));
        return 0;
    }
    return 2;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export {
    ArgparseExit,
    jsonDumpsSorted,
    render,
    renderHostDecision,
    loadGlossary,
    glossaryDefault,
};
