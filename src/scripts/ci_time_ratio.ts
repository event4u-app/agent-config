#!/usr/bin/env node
/**
 * CI-time / local-edit-time ratio (council file 07, Phase 2.3).
 *
 * TypeScript twin of `ci_time_ratio.py` (Phase 8 / Wave 8e).
 *
 * Samples the last N commits on a branch, classifies each by touched
 * paths (doc / skill / test / meta / mixed), and computes:
 *
 *     ratio = ci_time / local_time
 *
 * where:
 * - `local_time` = delta between author-date of the *previous* commit and
 *   author-date of the current commit, capped at 60 min to filter breaks.
 * - `ci_time`  = sum of GitHub Actions workflow durations for that commit
 *   sha (via `gh run list --commit <sha>`).
 *
 * Threshold rule (Round-3 Sonnet protocol):
 * - Median ratio > 5× for any frequent class → that class needs a cheaper tier
 * - Median ratio < 3× across all classes      → structural overhead acceptable
 *
 * Output: human-readable table on stdout + JSON to
 * `agents/runtime/reports/ci-time-ratio.json`.
 *
 * Usage:
 *   node ci_time_ratio.js --limit 30
 *   node ci_time_ratio.js --branch main --limit 30 --out path.json
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(_HERE, '..', '..', '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'agents', 'reports', 'ci-time-ratio.json');

const LOCAL_TIME_CAP_S = 60 * 60; // cap a single edit window at 60 min
const THRESHOLD_FAIL = 5.0;
const THRESHOLD_PASS = 3.0;

/** Mirror subprocess.check_output(cmd, cwd=REPO_ROOT, text=True). */
function run(cmd: string[]): string {
    const proc = spawnSync(cmd[0] as string, cmd.slice(1), {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
    });
    if (proc.error) {
        // Mirror Python FileNotFoundError when the binary is missing.
        throw new ProcessError(proc.status ?? 1, proc.stderr ?? '');
    }
    if (proc.status !== 0) {
        throw new ProcessError(proc.status ?? 1, proc.stderr ?? '');
    }
    return proc.stdout;
}

/** Stand-in for subprocess.CalledProcessError. */
class ProcessError extends Error {
    constructor(
        public readonly returncode: number,
        message: string,
    ) {
        super(message);
    }
}

interface Commit {
    sha: string;
    timestamp: number;
    subject: string;
}

export function list_commits(branch: string, limit: number): Commit[] {
    const out = _splitlines(
        _pyStrip(run(['git', 'log', branch, `-n${limit + 1}`, '--format=%H\t%at\t%s'])),
    );
    const rows: Commit[] = [];
    for (const line of out) {
        const parts = _splitN(line, '\t', 2);
        const sha = parts[0] as string;
        const ts = parts[1] as string;
        const subject = (parts[2] ?? '') as string;
        rows.push({ sha, timestamp: parseInt(ts, 10), subject });
    }
    return rows;
}

export function classify(sha: string): string {
    let files = _splitlines(_pyStrip(run(['git', 'show', '--name-only', '--format=', sha])));
    files = files.filter((f) => f !== '');
    if (files.length === 0) {
        return 'empty';
    }
    const doc = files.filter((f) => f.startsWith('docs/') || f.endsWith('.md')).length;
    const skill = files.filter(
        (f) => f.includes('/skills/') || f.startsWith('.agent-src.uncondensed/skills/'),
    ).length;
    const test = files.filter((f) => f.startsWith('tests/') || f.includes('/tests/')).length;
    const meta = files.filter(
        (f) =>
            f.startsWith('Taskfile') ||
            f.startsWith('src/scripts/') ||
            f.startsWith('.github/') ||
            f.startsWith('pyproject') ||
            f.startsWith('package'),
    ).length;
    const total = files.length;
    // Single-class dominance: 70% of touched files in one bucket
    const buckets: Array<[string, number]> = [
        ['skill', skill],
        ['test', test],
        ['doc', doc],
        ['meta', meta],
    ];
    for (const [label, n] of buckets) {
        if (n >= Math.max(1, Math.trunc(total * 0.7))) {
            return label;
        }
    }
    return 'mixed';
}

/** Total wall-clock seconds for all completed runs of this commit. */
export function ci_duration_for(sha: string): number | null {
    let out: string;
    try {
        out = run([
            'gh', 'run', 'list', '--commit', sha, '--limit', '20',
            '--json', 'createdAt,updatedAt,status,conclusion',
        ]);
    } catch (err) {
        if (err instanceof ProcessError) {
            return null;
        }
        throw err;
    }
    const runs = JSON.parse(out) as Array<Record<string, unknown>>;
    if (!runs || runs.length === 0) {
        return null;
    }
    const durations: number[] = [];
    for (const r of runs) {
        if (r['status'] !== 'completed') {
            continue;
        }
        const c = _isoToEpochMs(String(r['createdAt']));
        const u = _isoToEpochMs(String(r['updatedAt']));
        durations.push((u - c) / 1000);
    }
    if (durations.length === 0) {
        return null;
    }
    // Workflows run in parallel — wall-clock is the max, not the sum.
    return Math.trunc(Math.max(...durations));
}

interface Row {
    sha: string;
    class: string;
    local_s: number;
    ci_s: number;
    ratio: PyFloat | null;
    subject: string;
}

export function collect(branch: string, limit: number): Row[] {
    const commits = list_commits(branch, limit);
    if (commits.length < 2) {
        return [];
    }
    const rows: Row[] = [];
    for (let i = 0; i < commits.length - 1; i += 1) {
        const cur = commits[i] as Commit;
        const prev = commits[i + 1] as Commit;
        const local_s = Math.min(cur.timestamp - prev.timestamp, LOCAL_TIME_CAP_S);
        if (local_s < 30) {
            continue;
        }
        const ci_s = ci_duration_for(cur.sha);
        if (ci_s === null) {
            continue;
        }
        const cls = classify(cur.sha);
        rows.push({
            sha: cur.sha.slice(0, 10),
            class: cls,
            local_s,
            ci_s,
            ratio: local_s ? new PyFloat(_pyRound(ci_s / local_s, 2)) : null,
            subject: cur.subject.slice(0, 80),
        });
    }
    return rows;
}

interface ClassSummary {
    n: number;
    median: PyFloat;
    min: PyFloat;
    max: PyFloat;
    verdict: string;
}

interface Summary {
    overall: { n: number; median: PyFloat | null; verdict: string };
    by_class: Record<string, ClassSummary>;
}

export function summarise(rows: Row[]): Summary {
    const by_class = new Map<string, number[]>();
    for (const r of rows) {
        if (r.ratio !== null) {
            const arr = by_class.get(r.class);
            if (arr) arr.push(r.ratio.value);
            else by_class.set(r.class, [r.ratio.value]);
        }
    }
    const summary: Record<string, ClassSummary> = {};
    // Python: for cls, ratios in sorted(by_class.items())
    const sortedKeys = [...by_class.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const cls of sortedKeys) {
        const ratios = by_class.get(cls) as number[];
        const m = _median(ratios);
        let verdict: string;
        if (m > THRESHOLD_FAIL) verdict = 'optimise';
        else if (m < THRESHOLD_PASS) verdict = 'acceptable';
        else verdict = 'watch';
        summary[cls] = {
            n: ratios.length,
            median: new PyFloat(_pyRound(m, 2)),
            min: new PyFloat(_pyRound(Math.min(...ratios), 2)),
            max: new PyFloat(_pyRound(Math.max(...ratios), 2)),
            verdict,
        };
    }
    const all_ratios: number[] = [];
    for (const r of rows) {
        if (r.ratio !== null) all_ratios.push(r.ratio.value);
    }
    const overallMedian = all_ratios.length > 0 ? _median(all_ratios) : null;
    const overall = {
        n: all_ratios.length,
        median: overallMedian !== null ? new PyFloat(_pyRound(overallMedian, 2)) : null,
        verdict:
            all_ratios.length > 0 && (overallMedian as number) < THRESHOLD_PASS
                ? 'acceptable'
                : all_ratios.length > 0
                  ? 'needs-review'
                  : 'no-data',
    };
    return { overall, by_class: summary };
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const rows = collect(args.branch, args.limit);
    const report = summarise(rows);
    const reportOut: Summary & { sample: Row[] } = { ...report, sample: rows };
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, _pyJsonDumpsIndent2(reportOut) + '\n', 'utf-8');
    const rel = _relTo(args.out, REPO_ROOT);
    process.stdout.write(`✅  Wrote ${rel}  (n=${report.overall.n})\n`);
    const ov = report.overall;
    process.stdout.write(
        `   overall median ratio: ${_fmtVal(ov.median)}×  →  ${ov.verdict}\n`,
    );
    for (const [cls, s] of Object.entries(report.by_class)) {
        process.stdout.write(
            `   ${_ljust(cls, 7)}  n=${_rjust(String(s.n), 2)}  ` +
                `median=${_fmtFixed2(s.median.value)}×  ` +
                `range=[${_fmtVal(s.min)}–${_fmtVal(s.max)}]  ${s.verdict}\n`,
        );
    }
    return 0;
}

interface ParsedArgs {
    branch: string;
    limit: number;
    out: string;
}

function _argError(msg: string): never {
    process.stderr.write(
        'usage: ci_time_ratio.py [-h] [--branch BRANCH] [--limit LIMIT] [--out OUT]\n',
    );
    process.stderr.write(`ci_time_ratio.py: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { branch: 'HEAD', limit: 30, out: DEFAULT_OUT };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: ci_time_ratio.py [-h] [--branch BRANCH] [--limit LIMIT] [--out OUT]\n',
            );
            process.exit(0);
        } else if (a === '--branch') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --branch: expected one argument');
            out.branch = v as string;
            i += 1;
        } else if (a.startsWith('--branch=')) {
            out.branch = a.slice('--branch='.length);
        } else if (a === '--limit') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --limit: expected one argument');
            out.limit = _parseInt(v as string);
            i += 1;
        } else if (a.startsWith('--limit=')) {
            out.limit = _parseInt(a.slice('--limit='.length));
        } else if (a === '--out') {
            const v = argv[i + 1];
            if (v === undefined) _argError('argument --out: expected one argument');
            out.out = v as string;
            i += 1;
        } else if (a.startsWith('--out=')) {
            out.out = a.slice('--out='.length);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
        i += 1;
    }
    return out;
}

function _parseInt(v: string): number {
    if (!/^[+-]?\d+$/.test(v.trim())) {
        _argError(`argument --limit: invalid int value: '${v}'`);
    }
    return parseInt(v, 10);
}

// ---------- helpers ----------

/** Marker for a value that is a Python float (json.dumps emits 1.0, not 1). */
class PyFloat {
    constructor(public readonly value: number) {}
}

function _pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Python str.splitlines(). */
function _splitlines(s: string): string[] {
    if (s === '') return [];
    return s.split(/\r\n|\r|\n/);
}

/** Python str.split(sep, maxsplit). */
function _splitN(s: string, sep: string, maxsplit: number): string[] {
    const out: string[] = [];
    let rest = s;
    let n = 0;
    while (n < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) break;
        out.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        n += 1;
    }
    out.push(rest);
    return out;
}

/** datetime.fromisoformat(s.replace("Z","+00:00")) → epoch ms. */
function _isoToEpochMs(s: string): number {
    return Date.parse(s.replace('Z', '+00:00'));
}

/** statistics.median — average of two middles for even length. */
function _median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mid = Math.floor(n / 2);
    if (n % 2 === 1) {
        return sorted[mid] as number;
    }
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Python round(x, ndigits) — banker's rounding (round-half-to-even). */
function _pyRound(value: number, ndigits: number): number {
    if (!Number.isFinite(value)) return value;
    const factor = 10 ** ndigits;
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (Math.abs(diff - 0.5) < eps) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

/** Python str(float|None) for the f-string `{ov['median']}`. */
function _fmtVal(v: PyFloat | null): string {
    if (v === null) return 'None';
    return _floatRepr(v.value);
}

/** Python f"{x:.2f}". */
function _fmtFixed2(x: number): string {
    return x.toFixed(2);
}

/** Python str(float) / repr(float). Integral floats render with trailing .0. */
function _floatRepr(n: number): string {
    if (Number.isInteger(n)) return `${n}.0`;
    return String(n);
}

function _ljust(s: string, width: number): string {
    const pad = width - _pyLen(s);
    return pad > 0 ? s + ' '.repeat(pad) : s;
}

function _rjust(s: string, width: number): string {
    const pad = width - _pyLen(s);
    return pad > 0 ? ' '.repeat(pad) + s : s;
}

function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) n += 1;
    return n;
}

/**
 * Mirror pathlib `Path(p).relative_to(base)` on the RAW path string (argparse
 * `type=Path` does NOT make it absolute). Returns the relative path when `p`
 * is a subpath of `base`; otherwise raises the Python ValueError. The Python
 * original lets that ValueError propagate, crashing main() with a traceback
 * and exit code 1. Mixed absolute/relative inputs always raise — that is why a
 * relative `--out` (or any path outside the repo) fails identically.
 */
function _relTo(p: string, base: string): string {
    // PurePath.relative_to compares the parts. A relative `p` against an
    // absolute `base` (or any non-subpath) raises ValueError.
    const pAbs = path.isAbsolute(p);
    const baseAbs = path.isAbsolute(base);
    if (pAbs === baseAbs) {
        const rel = path.relative(base, p);
        if (
            rel !== '' &&
            !rel.startsWith('..' + path.sep) &&
            rel !== '..' &&
            !path.isAbsolute(rel)
        ) {
            return (rel === '' ? '.' : rel).split(path.sep).join('/');
        }
    }
    throw new RelativeToError(
        `'${p}' is not in the subpath of '${base}' OR one path is relative and the other is absolute.`,
    );
}

/** Stand-in for the Python ValueError raised by Path.relative_to. */
class RelativeToError extends Error {}

/** Mirror json.dumps(obj, indent=2). */
function _pyJsonDumpsIndent2(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
    if (value instanceof PyFloat) return _floatRepr(value.value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return _dumpString(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => padInner + _dumpValue(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const items = entries.map(
        ([k, v]) => padInner + _dumpString(k) + ': ' + _dumpValue(v, depth + 1),
    );
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
}

function _dumpString(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
        else if (code < 0x7f) out += ch;
        else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
        else {
            const v = code - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
