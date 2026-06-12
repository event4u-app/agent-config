#!/usr/bin/env tsx
/**
 * Diff two A/B reports (one per variant) into a comparison artefact.
 *
 * TypeScript twin of `src/scripts/bench_ab_diff.py` (ADR-090 py2ts
 * Phase 8 / Wave 8d). The CLI contract mirrors the Python original
 * EXACTLY — positional args, `--out-dir`, exit codes, stdout/stderr
 * split, and byte-identical written JSON (`json.dumps(indent=2)` +
 * trailing newline) / Markdown artefacts. No behaviour changes; latent
 * Python bugs are replicated and flagged as divergence candidates.
 *
 * Phase 2 Step 4 of `agents/roadmaps/road-to-package-impact-benchmark.md`.
 *
 * Inputs: two report JSON paths. Output: a JSON artefact under
 * `internal/bench/reports/ab/diff/{stamp}-{corpus}-diff.json` plus a matching
 * `.md`. Phase 5's renderer consumes this artefact to populate `docs/benchmark.md`.
 *
 * The diff content depends on the corpus:
 *
 * - `ab-tracka` — trigger-accuracy %, false-positive count, per-rule lift.
 * - `ab-trackb` — completion-rate per category, wall-time, tokens,
 *   ask-vs-act ratio, tool-call count.
 *
 * Phase 2 only writes the structural skeleton (delta object with `with`,
 * `without`, `delta` keys); Phases 3 and 4 plug their real metrics into
 * the `results` blocks the runners emit, and the diff is computed in
 * `compute_track_a_diff` / `compute_track_b_diff` here.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// Python: Path(__file__).resolve().parent.parent.parent → repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab');
const DIFF_DIR = path.join(REPORTS_DIR, 'diff');

type Dict = Record<string, unknown>;

/**
 * Marker for a value that is a Python `float`. CPython's `json.dumps`
 * renders a float `2.0` as `2.0` (not `2`); JS numbers lose that
 * distinction. The `take()` / `mean()` / `round()` helpers in the
 * Python original all return floats, so the diff's numeric fields must
 * carry the `.0` to stay byte-identical.
 */
export class PyFloat {
    constructor(readonly value: number) {}
}

/** Mirror datetime.now(utc).strftime("%Y-%m-%dT%H-%M-%SZ"). */
export function utc_stamp(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
    const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mo}-${day}T${hh}-${mi}-${ss}Z`;
}

export function load_report(p: string): Dict {
    // DIVERGENCE (documented, matches src/scripts/_lib/json_pointers.ts):
    // Python `json.load` distinguishes an input float `1.0` from an int `1`,
    // so an integral-valued float echoed VERBATIM through a pass-through
    // subtree (`per_rule_accuracy`, `false_positives`, `per_category[*]`,
    // or the track-c `with_results` / `without_results` fallback) re-emits
    // as `1.0`. JS `JSON.parse` collapses both to the number `1`, so such a
    // value re-emits as `1`. COMPUTED floats are unaffected — they are
    // wrapped in PyFloat above. Non-integral input floats (e.g. `0.88`)
    // round-trip identically in both runtimes.
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Dict;
}

/**
 * Track A: trigger accuracy + per-rule lift.
 *
 * Phase 3 populates `triggers`, `per_rule_accuracy`, `false_positives` in the
 * `results` block. This helper computes the delta. While Phase 3 is not yet
 * landed, we surface what we have and zero what we don't — never invent
 * numbers.
 */
export function compute_track_a_diff(with_results: Dict, without_results: Dict): Dict {
    function take(d: Dict, key: string, dflt = 0.0): number {
        const value = key in d ? d[key] : dflt;
        // Python: float(value) with (TypeError, ValueError) → default.
        const coerced = _pyFloat(value);
        return coerced === null ? dflt : coerced;
    }

    const with_acc = take(with_results, 'trigger_accuracy');
    const without_acc = take(without_results, 'trigger_accuracy');
    return {
        trigger_accuracy: {
            // take() → float, round() → float.
            with: new PyFloat(with_acc),
            without: new PyFloat(without_acc),
            delta_pct_points: new PyFloat(_round3(with_acc - without_acc)),
        },
        false_positives: {
            with: 'false_positives' in with_results ? with_results.false_positives : 0,
            without: 'false_positives' in without_results ? without_results.false_positives : 0,
        },
        per_rule: {
            with: 'per_rule_accuracy' in with_results ? with_results.per_rule_accuracy : {},
            without: 'per_rule_accuracy' in without_results ? without_results.per_rule_accuracy : {},
        },
    };
}

/** Track B: completion rate per category + wall-time + tokens + ask-vs-act. */
export function compute_track_b_diff(with_results: Dict, without_results: Dict): Dict {
    function mean(d: Dict, key: string): number {
        // Python: float(d.get(key, 0.0)) with (TypeError, ValueError) → 0.0.
        const value = key in d ? d[key] : 0.0;
        const coerced = _pyFloat(value);
        return coerced === null ? 0.0 : coerced;
    }

    const with_cats = (('per_category' in with_results ? with_results.per_category : {}) ?? {}) as Dict;
    const without_cats = (('per_category' in without_results ? without_results.per_category : {}) ?? {}) as Dict;
    // Python: sorted(set(with_cats) | set(without_cats)).
    const categories = _sortedUnion(Object.keys(with_cats), Object.keys(without_cats));
    const per_category: Dict = {};
    for (const cat of categories) {
        per_category[cat] = {
            with: cat in with_cats ? with_cats[cat] : {},
            without: cat in without_cats ? without_cats[cat] : {},
        };
    }

    // mean() → float, round() → float; wrap all so json.dumps keeps `.0`.
    return {
        per_category,
        wall_time_seconds: {
            with: new PyFloat(mean(with_results, 'mean_wall_time')),
            without: new PyFloat(mean(without_results, 'mean_wall_time')),
            delta: new PyFloat(_round3(mean(with_results, 'mean_wall_time') - mean(without_results, 'mean_wall_time'))),
        },
        tokens: {
            with: new PyFloat(mean(with_results, 'mean_tokens')),
            without: new PyFloat(mean(without_results, 'mean_tokens')),
            delta: new PyFloat(_round3(mean(with_results, 'mean_tokens') - mean(without_results, 'mean_tokens'))),
        },
        // cost_usd comparison intentionally omitted — API pricing misleads
        // subscription users; tokens are the currency-neutral metric.
        ask_vs_act_ratio: {
            with: new PyFloat(mean(with_results, 'ask_vs_act_ratio')),
            without: new PyFloat(mean(without_results, 'ask_vs_act_ratio')),
        },
        tool_calls_per_task: {
            with: new PyFloat(mean(with_results, 'mean_tool_calls')),
            without: new PyFloat(mean(without_results, 'mean_tool_calls')),
        },
    };
}

export function render_markdown(diff: Dict): string {
    const lines: string[] = [
        `# A/B Bench Diff — ${diff.corpus as string}`,
        '',
        `- Stamp: \`${diff.stamp as string}\``,
        `- With:    \`${diff.with_report as string}\``,
        `- Without: \`${diff.without_report as string}\``,
        '',
        '## Delta',
        '',
        '```json',
        // Python: json.dumps(diff.get("delta", {}), indent=2) — ensure_ascii=True.
        _pyJsonDumps('delta' in diff ? diff.delta : {}, 2),
        '```',
        '',
    ];
    return lines.join('\n');
}

interface ParsedArgs {
    with_report: string;
    without_report: string;
    out_dir: string;
}

/**
 * Mirror argparse: two positionals + `--out-dir`. On a usage error
 * (missing positional, unknown flag), argparse prints usage to stderr
 * and exits 2. We replicate the exit code; the prose is approximated
 * but the script never reaches the prose path under the golden tests.
 */
export function parse_args(argv: string[]): ParsedArgs {
    const positionals: string[] = [];
    let out_dir = DIFF_DIR;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--out-dir') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argparseError('argument --out-dir: expected one argument');
            }
            out_dir = next as string;
            i += 2;
            continue;
        }
        if (arg.startsWith('--out-dir=')) {
            out_dir = arg.slice('--out-dir='.length);
            i += 1;
            continue;
        }
        if (arg === '-h' || arg === '--help') {
            // argparse prints help to stdout and exits 0.
            process.stdout.write('usage: bench_ab_diff [-h] [--out-dir OUT_DIR] with_report without_report\n');
            process.exit(0);
        }
        if (arg.startsWith('-') && arg !== '-') {
            _argparseError(`unrecognized arguments: ${arg}`);
        }
        positionals.push(arg);
        i += 1;
    }
    if (positionals.length < 2) {
        _argparseError('the following arguments are required: with_report, without_report');
    }
    if (positionals.length > 2) {
        _argparseError(`unrecognized arguments: ${positionals.slice(2).join(' ')}`);
    }
    return {
        with_report: positionals[0] as string,
        without_report: positionals[1] as string,
        out_dir,
    };
}

function _argparseError(msg: string): never {
    process.stderr.write(`bench_ab_diff: error: ${msg}\n`);
    process.exit(2);
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (!_exists(args.with_report)) {
        process.stderr.write(`bench_ab_diff: missing ${args.with_report}\n`);
        return 1;
    }
    if (!_exists(args.without_report)) {
        process.stderr.write(`bench_ab_diff: missing ${args.without_report}\n`);
        return 1;
    }
    const with_rep = load_report(args.with_report);
    const without_rep = load_report(args.without_report);
    if (_get(with_rep, 'variant') !== 'with') {
        process.stderr.write(
            `bench_ab_diff: ${args.with_report} variant is ` + `${_pyRepr(_get(with_rep, 'variant'))}, expected 'with'\n`,
        );
        return 1;
    }
    if (_get(without_rep, 'variant') !== 'without') {
        process.stderr.write(
            `bench_ab_diff: ${args.without_report} variant is ` +
                `${_pyRepr(_get(without_rep, 'variant'))}, expected 'without'\n`,
        );
        return 1;
    }
    if (_get(with_rep, 'corpus') !== _get(without_rep, 'corpus')) {
        process.stderr.write(
            `bench_ab_diff: corpus mismatch — with=${_pyStr(_get(with_rep, 'corpus'))} ` +
                `without=${_pyStr(_get(without_rep, 'corpus'))}\n`,
        );
        return 1;
    }
    // Python: with_rep.get("corpus") or "unknown".
    const corpus = (_pyTruthy(_get(with_rep, 'corpus')) ? _get(with_rep, 'corpus') : 'unknown') as string;
    const with_results = (('results' in with_rep ? with_rep.results : {}) ?? {}) as Dict;
    const without_results = (('results' in without_rep ? without_rep.results : {}) ?? {}) as Dict;
    let delta: Dict;
    if (corpus === 'ab-tracka') {
        delta = compute_track_a_diff(with_results, without_results);
    } else if (corpus === 'ab-trackb') {
        delta = compute_track_b_diff(with_results, without_results);
    } else {
        delta = {
            note: `no diff strategy registered for corpus ${_pyRepr(corpus)}`,
            with_results,
            without_results,
        };
    }
    const stamp = utc_stamp();
    const diff: Dict = {
        schema: 'ab-bench-diff/0.1',
        stamp,
        corpus,
        // Python: str(args.with_report.resolve().relative_to(REPO_ROOT)).
        with_report: _relToRepo(args.with_report),
        without_report: _relToRepo(args.without_report),
        delta,
    };
    fs.mkdirSync(args.out_dir, { recursive: true });
    const json_path = path.join(args.out_dir, `${stamp}-${corpus}-diff.json`);
    const md_path = _withSuffixMd(json_path);
    fs.writeFileSync(json_path, `${_pyJsonDumps(diff, 2)}\n`, 'utf-8');
    fs.writeFileSync(md_path, render_markdown(diff), 'utf-8');
    // Python: json_path.relative_to(REPO_ROOT) — json_path is already
    // built under args.out_dir; relative_to raises if out_dir is outside
    // REPO_ROOT. The default lands inside, so we mirror the relative form.
    process.stdout.write(`bench_ab_diff: wrote ${_relToRepoLiteral(json_path)}\n`);
    return 0;
}

// --- pathlib / Python parity helpers ----------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _get(d: Dict, key: string): unknown {
    return key in d ? d[key] : undefined;
}

/** Mirror Python truthiness for dict.get(...) or "default" idiom. */
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

/** Mirror Python float(value) returning null on TypeError/ValueError. */
function _pyFloat(value: unknown): number | null {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 1.0 : 0.0;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }
        // Python float() accepts inf / nan / scientific; replicate the common cases.
        const lowered = trimmed.toLowerCase();
        if (lowered === 'inf' || lowered === '+inf' || lowered === 'infinity' || lowered === '+infinity') {
            return Infinity;
        }
        if (lowered === '-inf' || lowered === '-infinity') {
            return -Infinity;
        }
        if (lowered === 'nan' || lowered === '+nan' || lowered === '-nan') {
            return NaN;
        }
        const n = Number(trimmed);
        return Number.isNaN(n) ? null : n;
    }
    // dict / list / None → TypeError → default.
    return null;
}

/** Mirror Python round(x, 3) — round-half-to-even at 3 decimals, numeric result. */
function _round3(x: number): number {
    if (!Number.isFinite(x)) {
        return x;
    }
    const factor = 1000;
    const scaled = x * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

/** sorted(set(a) | set(b)) — string sort. */
function _sortedUnion(a: string[], b: string[]): string[] {
    const set = new Set<string>([...a, ...b]);
    return [...set].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

/** Mirror str(x) for the corpus mismatch message (None → "None"). */
function _pyStr(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    return String(v);
}

/** Mirror repr(x) for the {value!r} placeholders. */
function _pyRepr(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    if (typeof v === 'string') {
        return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(v);
}

/**
 * Mirror Path(p).resolve().relative_to(REPO_ROOT) → posix string.
 * Raises (ValueError-equivalent) when the resolved path is not under
 * REPO_ROOT, exactly like pathlib's relative_to.
 */
function _relToRepo(p: string): string {
    return _relativeTo(path.resolve(p), path.resolve(REPO_ROOT));
}

/**
 * Mirror json_path.relative_to(REPO_ROOT) on the UN-resolved json_path.
 * Python builds json_path = args.out_dir / "<stamp>-...json"; when
 * --out-dir is relative the resulting Path is relative and relative_to
 * against the absolute REPO_ROOT raises — replicate that crash.
 */
function _relToRepoLiteral(p: string): string {
    return _relativeTo(p, path.resolve(REPO_ROOT));
}

/** pathlib Path.relative_to — raises when `child` is not under `base`. */
function _relativeTo(child: string, base: string): string {
    const childIsAbs = path.isAbsolute(child);
    const baseIsAbs = path.isAbsolute(base);
    if (childIsAbs !== baseIsAbs) {
        throw new Error(
            `'${child}' is not in the subpath of '${base}' OR one path is relative and the other is absolute.`,
        );
    }
    if (child !== base && !child.startsWith(base + path.sep)) {
        throw new Error(
            `'${child}' is not in the subpath of '${base}' OR one path is relative and the other is absolute.`,
        );
    }
    const rel = path.relative(base, child);
    return rel.split(path.sep).join('/');
}

/** Mirror Path.with_suffix(".md"). */
function _withSuffixMd(p: string): string {
    const ext = path.extname(p);
    if (ext === '') {
        return `${p}.md`;
    }
    return `${p.slice(0, p.length - ext.length)}.md`;
}

// --- JSON serializer — json.dumps(indent=2) parity (ensure_ascii=True) ------

function _pyJsonDumps(value: unknown, indent: number): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0));
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (value instanceof PyFloat) {
        return _jsonFloat(value.value);
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map((k) => `${pad}${_jsonStrAscii(k)}: ${_dumpsIndent(obj[k], indent, depth + 1)}`);
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

function _jsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

/** Render a Python float: integer-valued floats keep the `.0` suffix. */
function _jsonFloat(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
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
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}
