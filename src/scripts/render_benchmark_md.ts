#!/usr/bin/env tsx
/**
 * Render `docs/benchmark.md` from the latest paired A/B bench reports.
 *
 * TypeScript twin of `src/scripts/render_benchmark_md.py` (ADR-094, Phase 8 /
 * Wave 8b). Mirrors the CLI contract EXACTLY — the `--quiet` flag, exit code,
 * the stdout/stderr split, byte-identical stdout AND byte-identical rendered
 * `docs/benchmark.md`. The renderer is deterministic — it does not run any
 * bench; it only formats existing reports.
 *
 * If no reports exist yet, the script writes a placeholder document — never
 * errors out, so the file is always a real description of the bench state.
 *
 * No behaviour changes — latent Python quirks replicated. The only volatile
 * value is the embedded `utc_iso()` timestamp; golden parity for this script
 * pins on structure + the deterministic placeholder/report shape, not on the
 * second-precision timestamp.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/render_benchmark_md.ts → parents[2] of the .py file is repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'ab');
const DIFF_DIR = path.join(REPORTS_DIR, 'diff');
const OUT_PATH = path.join(REPO_ROOT, 'docs', 'benchmark.md');

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** `sorted(dir.glob(pattern))` for a `*-<suffix>` glob — direct children. */
function _globSorted(dir: string, suffix: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith(suffix)).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

function _relToRootPosix(p: string): string {
    return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

export function utc_iso(): string {
    // datetime.now(timezone.utc).isoformat(timespec="seconds") → +00:00 suffix.
    const d = new Date();
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
    );
}

export function latest_pair(corpus: string): [string | null, string | null] {
    const withReports = _globSorted(REPORTS_DIR, `-${corpus}-with.json`);
    const withoutReports = _globSorted(REPORTS_DIR, `-${corpus}-without.json`);
    if (withReports.length === 0 && withoutReports.length === 0) {
        return [null, null];
    }
    return [
        withReports.length ? (withReports[withReports.length - 1] as string) : null,
        withoutReports.length ? (withoutReports[withoutReports.length - 1] as string) : null,
    ];
}

export function latest_diff(corpus: string): string | null {
    const diffs = _globSorted(DIFF_DIR, `-${corpus}-diff.json`);
    return diffs.length ? (diffs[diffs.length - 1] as string) : null;
}

export function safe_load(p: string | null): Obj {
    if (p === null || !_exists(p)) {
        return {};
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as Json;
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    } catch {
        return {};
    }
}

// --- value access helpers (Python dict.get with default {}/0) ---------------

function _obj(v: Json | undefined): Obj {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
}

/** Python `(d.get("a") or {}).get("b", {})` style chained access → Obj. */
function _getObj(o: Obj, key: string): Obj {
    return _obj(o[key]);
}

function _num(v: Json | undefined): number | null {
    return typeof v === 'number' ? v : null;
}

/** Mirror Python truthiness for `.get("x") or 0`. */
function _orZero(v: Json | undefined): number {
    if (typeof v === 'number' && v !== 0 && !Number.isNaN(v)) {
        return v;
    }
    return 0;
}

// --- Python-format parity --------------------------------------------------

/** Format `x` to `ndigits` decimals using round-half-to-even (CPython). */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

export function fmt_pct(value: number | null): string {
    if (value === null) {
        return '—';
    }
    // f"{value * 100:.1f}%"
    return `${_pyFixed(value * 100, 1)}%`;
}

export function fmt_num(value: number | null, places = 2): string {
    if (value === null) {
        return '—';
    }
    // f"{value:.{places}f}"
    return _pyFixed(value, places);
}

export function render_headline(trackA: Obj, trackB: Obj): string {
    const aResults = _getObj(_getObj(trackA, 'with'), 'results');
    const aWithout = _getObj(_getObj(trackA, 'without'), 'results');
    const bResults = _getObj(_getObj(trackB, 'with'), 'results');
    const bWithout = _getObj(_getObj(trackB, 'without'), 'results');
    const aWithAcc = _num(aResults['trigger_accuracy']);
    const aWoAcc = _num(aWithout['trigger_accuracy']);
    const bWithComp = _num(bResults['completion_rate']);
    const bWoComp = _num(bWithout['completion_rate']);
    const lines = [
        '## Headline',
        '',
        '> **Track A confirms surface availability** — a precondition, not an impact metric. ' +
            'For the impact view (cost-ladder + behaviour with vs. without), see ' +
            '[`docs/value.md`](value.md).',
        '',
        '| Metric | with | without | delta |',
        '|---|---|---|---|',
        `| Track A surface-availability | ${fmt_pct(aWithAcc)} | ${fmt_pct(aWoAcc)} | ` +
            `${fmt_pct((aWithAcc ?? 0) - (aWoAcc ?? 0))} _(structural — files present)_ |`,
        `| Track B completion-rate  | ${fmt_pct(bWithComp)} | ${fmt_pct(bWoComp)} | ` +
            `${fmt_pct((bWithComp ?? 0) - (bWoComp ?? 0))} |`,
        `| Track B mean wall-time   | ${fmt_num(_num(bResults['mean_wall_time']))}s ` +
            `| ${fmt_num(_num(bWithout['mean_wall_time']))}s | ` +
            `${fmt_num(_orZero(bResults['mean_wall_time']) - _orZero(bWithout['mean_wall_time']))}s |`,
        `| Track B ask-vs-act ratio | ${fmt_num(_num(bResults['ask_vs_act_ratio']), 3)} ` +
            `| ${fmt_num(_num(bWithout['ask_vs_act_ratio']), 3)} | — |`,
        '',
    ];
    return lines.join('\n');
}

/** Python `data.get(k, 0)` for an int-ish field used in `{x}/{y}` counts. */
function _getCount(o: Obj, key: string): string {
    const v = o[key];
    if (v === null || v === undefined) {
        return '0';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    return String(v as unknown as string);
}

export function render_track_a(trackA: Obj): string {
    const withData = _getObj(_getObj(trackA, 'with'), 'results');
    const withoutData = _getObj(_getObj(trackA, 'without'), 'results');
    const lines: string[] = ['## Track A — Behavioural eval', ''];
    if (Object.keys(withData).length === 0 && Object.keys(withoutData).length === 0) {
        lines.push('_No Track A reports yet. Run `task bench:ab:track-a`._');
        lines.push('');
        return lines.join('\n');
    }
    const integrity = _getObj(trackA, 'with')['integrity_ok'];
    const integrityStr = integrity === undefined ? '—' : _pyStr(integrity);
    lines.push(
        `- with → **${fmt_pct(_num(withData['trigger_accuracy']))}** ` +
            `(${_getCount(withData, 'matched')}/${_getCount(withData, 'total')})`,
        `- without → **${fmt_pct(_num(withoutData['trigger_accuracy']))}** ` +
            `(${_getCount(withoutData, 'matched')}/${_getCount(withoutData, 'total')})`,
        `- integrity OK: \`${integrityStr}\``,
        '',
        'Per-target presence (sample):',
        '',
    );
    const perTarget = _getObj(withData, 'per_target_present');
    const items = Object.entries(perTarget).sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
    for (let i = 0; i < items.length; i += 1) {
        if (i >= 10) {
            lines.push(`- … ${items.length - 10} more`);
            break;
        }
        const entry = items[i] as [string, Json];
        lines.push(`- \`${entry[0]}\` → with=${_pyStr(entry[1])}, without=0`);
    }
    lines.push('');
    return lines.join('\n');
}

export function render_track_b(trackB: Obj): string {
    const lines: string[] = ['## Track B — Task completion', ''];
    const withData = _getObj(_getObj(trackB, 'with'), 'results');
    const withoutData = _getObj(_getObj(trackB, 'without'), 'results');
    const modeRaw = withData['mode'] ?? withoutData['mode'] ?? '—';
    const mode = _pyStr(modeRaw);
    lines.push(`- Mode: \`${mode}\``);
    if (Object.keys(withData).length === 0 && Object.keys(withoutData).length === 0) {
        lines.push('');
        lines.push('_No Track B reports yet. Run `task bench:ab:track-b`._');
        lines.push('');
        return lines.join('\n');
    }
    lines.push(
        `- with → **${fmt_pct(_num(withData['completion_rate']))}** ` +
            `(${_getCount(withData, 'passed')}/${_getCount(withData, 'total')})`,
        `- without → **${fmt_pct(_num(withoutData['completion_rate']))}** ` +
            `(${_getCount(withoutData, 'passed')}/${_getCount(withoutData, 'total')})`,
        '',
        'Per-category:',
        '',
        '| Category | with | without | delta |',
        '|---|---|---|---|',
    );
    const withCats = _getObj(withData, 'per_category');
    const withoutCats = _getObj(withoutData, 'per_category');
    const cats = [...new Set([...Object.keys(withCats), ...Object.keys(withoutCats)])].sort(
        (a, b) => (a < b ? -1 : a > b ? 1 : 0),
    );
    for (const cat of cats) {
        const w = _orZero(_getObj(withCats, cat)['completion_rate']);
        const wo = _orZero(_getObj(withoutCats, cat)['completion_rate']);
        lines.push(`| ${cat} | ${fmt_pct(w)} | ${fmt_pct(wo)} | ${fmt_pct(w - wo)} |`);
    }
    lines.push('');
    return lines.join('\n');
}

export function render_methodology(trackA: Obj, trackB: Obj): string {
    // with_report = track_a.get("with") or track_b.get("with") or {}
    let withReport = _getObj(trackA, 'with');
    if (Object.keys(withReport).length === 0) {
        withReport = _getObj(trackB, 'with');
    }
    const cacheKey = _getObj(withReport, 'cache_key');
    const lines = [
        '## Methodology',
        '',
        '- **Target shape:** Shape A (neutral TypeScript fixture under `internal/bench/ab/fixture/`).',
        '- **Variants:** `with` clone inherits `.claude/`, `.augment/`, `AGENTS.md`, ' +
            '`CLAUDE.md` from the package root; `without` does not.',
        '- **Integrity:** `python3 scripts/bench_ab_integrity.py` exits 0 on every run ' +
            '(clones differ only at the agent-config surface).',
        '- **Scoring:** structural only (no LLM judge). See `scripts/_lib/bench_ab_scoring.py`.',
        '',
        'Cache key for the latest run:',
        '',
    ];
    if (Object.keys(cacheKey).length > 0) {
        for (const k of ['corpus_hash', 'claude_cli_version', 'target_shape_hash']) {
            const v = cacheKey[k];
            lines.push(`- \`${k}\`: \`${v === undefined ? '—' : _pyStr(v)}\``);
        }
    } else {
        lines.push('- _no cache key recorded yet_');
    }
    lines.push('');
    lines.push(`- **Last rendered:** \`${utc_iso()}\``);
    lines.push('');
    return lines.join('\n');
}

export function render_history(): string {
    const lines: string[] = ['## History', '', 'Last 5 runs (per corpus):', ''];
    for (const corpus of ['ab-tracka', 'ab-trackb']) {
        lines.push(`### \`${corpus}\``);
        lines.push('');
        // sorted(glob, reverse=True)[:5]
        const reports = _globSorted(REPORTS_DIR, `-${corpus}-with.json`).reverse().slice(0, 5);
        if (reports.length === 0) {
            lines.push('_no runs yet_');
            lines.push('');
            continue;
        }
        for (const report of reports) {
            let data: Obj;
            try {
                const parsed = JSON.parse(fs.readFileSync(report, 'utf-8')) as Json;
                data =
                    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
                        ? parsed
                        : {};
            } catch {
                continue;
            }
            const results = _getObj(data, 'results');
            const metric =
                corpus === 'ab-tracka'
                    ? _num(results['trigger_accuracy'])
                    : _num(results['completion_rate']);
            const stamp = data['stamp'];
            lines.push(`- \`${stamp === undefined ? '—' : _pyStr(stamp)}\` → ${fmt_pct(metric)}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

export function render_placeholder(): string {
    return (
        '# Package-Impact A/B Benchmark\n' +
        '\n' +
        '_No A/B bench reports yet._ Produce one with:\n' +
        '\n' +
        '```sh\n' +
        'task bench:ab\n' +
        '```\n' +
        '\n' +
        'Methodology lives in `agents/roadmaps/road-to-package-impact-benchmark.md` ' +
        'and `internal/bench/ab/README.md`.\n' +
        `\n_Last rendered: ${utc_iso()}_\n`
    );
}

/** Mirror Python `str(x)` for the JSON scalar types rendered into the md. */
function _pyStr(v: Json): string {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    return String(v);
}

export function render(quiet = false): number {
    const [aWith, aWithout] = latest_pair('ab-tracka');
    const [bWith, bWithout] = latest_pair('ab-trackb');
    const trackA: Obj = { with: safe_load(aWith), without: safe_load(aWithout) };
    const trackB: Obj = { with: safe_load(bWith), without: safe_load(bWithout) };
    const haveData = Boolean(
        Object.keys(_obj(trackA['with'])).length ||
            Object.keys(_obj(trackA['without'])).length ||
            Object.keys(_obj(trackB['with'])).length ||
            Object.keys(_obj(trackB['without'])).length,
    );
    if (!haveData) {
        fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
        fs.writeFileSync(OUT_PATH, render_placeholder());
        if (!quiet) {
            process.stdout.write(
                `render_benchmark_md: no reports — wrote placeholder to ${_relToRootPosix(OUT_PATH)}\n`,
            );
        }
        return 0;
    }
    const parts = [
        '# Package-Impact A/B Benchmark',
        '',
        '> Generated by `scripts/render_benchmark_md.py`. Source of truth: ' +
            '`internal/bench/reports/ab/`. Re-render anytime with `task bench:ab:diff`.',
        '',
        render_headline(trackA, trackB),
        render_track_a(trackA),
        render_track_b(trackB),
        render_methodology(trackA, trackB),
        render_history(),
    ];
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, parts.join('\n'));
    if (!quiet) {
        process.stdout.write(`render_benchmark_md: wrote ${_relToRootPosix(OUT_PATH)}\n`);
    }
    return 0;
}

interface ParsedArgs {
    quiet: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { quiet: false };
    for (const a of argv) {
        if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: render_benchmark_md [-h] [--quiet]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    return render(args.quiet);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
