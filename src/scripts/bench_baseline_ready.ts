#!/usr/bin/env node
/**
 * Baseline-closure check — step-4 Phase 3 Step 4.
 *
 * TypeScript twin of `src/scripts/bench_baseline_ready.py` (ADR-090 Python→TS
 * migration, Phase 8 / Wave 8d). Mirrors the CLI contract EXACTLY: flags
 * (`--corpus`, `--reports-dir`, `--baseline-file`, `--min-days`,
 * `--min-reports`, `--json`), exit codes (0 ready / 1 file error / 2 not
 * ready), byte-identical stdout/stderr, and byte-identical JSON. No
 * behaviour changes.
 *
 * Returns exit 0 iff the 60-day clock has elapsed since
 * `internal/bench/baseline-start.txt` AND `internal/bench/reports/` contains at
 * least `--min-reports` complete runs for the named corpus (default 30).
 *
 * Read by P2 enforcement roadmaps as their precondition (G1 gate in
 * step-99). This is the single arbiter of "are we allowed to flip
 * defaults yet" — no other timer is authoritative.
 *
 * Exit codes:
 *     0 — baseline ready (clock elapsed AND report count met)
 *     1 — argument / file error
 *     2 — baseline not ready (clock OR reports insufficient)
 *
 * CLI:
 *     python3 scripts/bench_baseline_ready.py
 *     python3 scripts/bench_baseline_ready.py --corpus dev --min-days 60 --min-reports 30
 *     python3 scripts/bench_baseline_ready.py --json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/bench_baseline_ready.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * Read the first non-comment, non-empty line as a `YYYY-MM-DD` date.
 * Returns the ISO date string (the only thing the caller needs) or null.
 */
export function _read_baseline_start(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const text = fs.readFileSync(filePath, 'utf-8');
    for (const line of _splitlines(text)) {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('#')) {
            continue;
        }
        const parsed = _strptimeDate(stripped);
        if (parsed !== null) {
            return parsed;
        }
        // datetime.strptime raised ValueError → `continue` to the next line.
    }
    return null;
}

interface Args {
    corpus: string;
    reportsDir: string;
    baselineFile: string;
    minDays: number;
    minReports: number;
    json: boolean;
}

function parse_args(argv: string[]): Args {
    const args: Args = {
        corpus: 'dev',
        reportsDir: 'internal/bench/reports',
        baselineFile: 'internal/bench/baseline-start.txt',
        minDays: 60,
        minReports: 30,
        json: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--corpus') args.corpus = argv[++i] ?? '';
        else if (a.startsWith('--corpus=')) args.corpus = a.slice('--corpus='.length);
        else if (a === '--reports-dir') args.reportsDir = argv[++i] ?? '';
        else if (a.startsWith('--reports-dir=')) args.reportsDir = a.slice('--reports-dir='.length);
        else if (a === '--baseline-file') args.baselineFile = argv[++i] ?? '';
        else if (a.startsWith('--baseline-file=')) args.baselineFile = a.slice('--baseline-file='.length);
        else if (a === '--min-days') args.minDays = _pyInt(argv[++i] ?? '', '--min-days');
        else if (a.startsWith('--min-days=')) args.minDays = _pyInt(a.slice('--min-days='.length), '--min-days');
        else if (a === '--min-reports') args.minReports = _pyInt(argv[++i] ?? '', '--min-reports');
        else if (a.startsWith('--min-reports='))
            args.minReports = _pyInt(a.slice('--min-reports='.length), '--min-reports');
        else if (a === '--json') args.json = true;
        else {
            process.stderr.write(`bench_baseline_ready: error: unrecognized arguments: ${a}\n`);
            process.exitCode = 2;
            throw new ArgExit();
        }
    }
    return args;
}

class ArgExit extends Error {}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    const args = parse_args(rawArgv);

    const baselinePath = path.join(REPO_ROOT, args.baselineFile);
    const start = _read_baseline_start(baselinePath);
    if (start === null) {
        const msg = `baseline-start file missing or unreadable: ${baselinePath}`;
        if (args.json) {
            process.stdout.write(_jsonDumps({ status: 'error', reason: msg }) + '\n');
        } else {
            process.stderr.write(`  ❌  ${msg}\n`);
        }
        return 1;
    }

    const today = _utcToday();
    const daysElapsed = _daysBetween(start, today);
    const daysOk = daysElapsed >= args.minDays;

    const reportsDir = path.join(REPO_ROOT, args.reportsDir);
    const reportCount = fs.existsSync(reportsDir)
        ? _glob(reportsDir, `*-${args.corpus}.json`).length
        : 0;
    const reportsOk = reportCount >= args.minReports;

    const ready = daysOk && reportsOk;
    const payload = {
        status: ready ? 'ready' : 'warmup',
        corpus: args.corpus,
        baseline_start: start,
        today,
        days_elapsed: daysElapsed,
        min_days: args.minDays,
        days_ok: daysOk,
        report_count: reportCount,
        min_reports: args.minReports,
        reports_ok: reportsOk,
    };
    if (args.json) {
        process.stdout.write(_jsonDumps(payload, 2) + '\n');
    } else {
        const emoji = ready ? '✅' : '⏳';
        const verdict = ready ? 'READY' : 'WARMUP';
        process.stdout.write(
            `  ${emoji}  bench-baseline · corpus=${args.corpus} · ` +
                `${verdict} · days=${daysElapsed}/${args.minDays} · ` +
                `reports=${reportCount}/${args.minReports}\n`,
        );
    }
    return ready ? 0 : 2;
}

// --- Python helpers ----------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/**
 * json.dumps(obj) with optional indent. With no indent (the error path),
 * Python uses ", " / ": " separators; with indent it pretty-prints.
 */
function _jsonDumps(obj: Json, indent?: number): string {
    if (indent === undefined) {
        return _jsonCompact(obj);
    }
    const pad = ' '.repeat(indent);
    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k]!, depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }
    return enc(obj, 0);
}

/** json.dumps(obj) default — separators (", ", ": "), no newlines. */
function _jsonCompact(obj: Json): string {
    if (obj === null) return 'null';
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'number') return String(obj);
    if (typeof obj === 'string') return encStr(obj);
    if (Array.isArray(obj)) {
        return '[' + obj.map((v) => _jsonCompact(v)).join(', ') + ']';
    }
    const o = obj as { [k: string]: Json };
    const keys = Object.keys(o);
    return '{' + keys.map((k) => encStr(k) + ': ' + _jsonCompact(o[k]!)).join(', ') + '}';
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

/** Mirror str.splitlines() for the line classes this file may contain. */
function _splitlines(text: string): string[] {
    // Python str.splitlines() splits on \n, \r, \r\n (plus a few unicode
    // breaks); the baseline file is plain ASCII so \r?\n / \r coverage suffices.
    return text.split(/\r\n|\r|\n/);
}

/** datetime.strptime(s, "%Y-%m-%d").date() → ISO string, or null on ValueError. */
function _strptimeDate(s: string): string | null {
    // strptime is strict: requires exactly YYYY-MM-DD with valid calendar date.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
        return null;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    // Validate calendar correctness (strptime rejects e.g. 2026-13-40).
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (
        dt.getUTCFullYear() !== year ||
        dt.getUTCMonth() !== month - 1 ||
        dt.getUTCDate() !== day
    ) {
        return null;
    }
    return `${m[1]}-${m[2]}-${m[3]}`;
}

/** datetime.now(timezone.utc).date().isoformat() */
function _utcToday(): string {
    const d = new Date();
    const Y = String(d.getUTCFullYear()).padStart(4, '0');
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    return `${Y}-${m}-${D}`;
}

/** (today - start).days — whole calendar days between two ISO dates. */
function _daysBetween(startIso: string, todayIso: string): number {
    const start = _isoToUtcMs(startIso);
    const today = _isoToUtcMs(todayIso);
    return Math.round((today - start) / 86400000);
}

function _isoToUtcMs(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
}

/**
 * Mirror Path.glob(pattern) count for the simple `*-<corpus>.json` shape:
 * non-recursive, top-level only. Pattern has a single leading `*`.
 */
function _glob(dir: string, pattern: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const re = _globToRegExp(pattern);
    return names.filter((n) => re.test(n));
}

function _globToRegExp(pattern: string): RegExp {
    // Only `*` is meaningful here (matches any run of non-separator chars,
    // and fnmatch `*` also matches an empty run). Escape the rest.
    let out = '^';
    for (const ch of pattern) {
        if (ch === '*') out += '[^/]*';
        else out += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
    out += '$';
    return new RegExp(out);
}

function _pyInt(s: string, flag: string): number {
    const trimmed = s.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) {
        process.stderr.write(`bench_baseline_ready: error: argument ${flag}: invalid int value: '${s}'\n`);
        process.exitCode = 2;
        throw new ArgExit();
    }
    return parseInt(trimmed, 10);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof ArgExit) {
            process.exitCode = process.exitCode ?? 2;
        } else {
            throw e;
        }
    }
}
