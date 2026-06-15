#!/usr/bin/env tsx
/**
 * Render `docs/benchmark.md` from the latest paired A/B bench reports.
 *
 * TypeScript twin of `src/scripts/render_benchmark_md.py` (ADR-200, Phase 8 /
 * Wave 8b). Mirrors the CLI contract EXACTLY — the `--quiet` flag, exit code,
 * the stdout/stderr split, byte-identical stdout AND byte-identical rendered
 * `docs/benchmark.md`. The renderer is deterministic — it does not run any
 * bench; it only formats existing reports.
 *
 * Renders the 3-condition value bench: `without` → `with` (package value) and
 * `with` → `with-rdp` (RDP reasoning lift), with the third `with-rdp` column in
 * the Track B tables.
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

/** Latest Track B report for the third condition (`with-rdp`), or {}. */
export function latest_trackb_with_rdp(): Obj {
    const reports = _globSorted(REPORTS_DIR, '-ab-trackb-with-rdp.json');
    return reports.length ? safe_load(reports[reports.length - 1] as string) : {};
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

/** Python truthiness for a single JSON value (None/""/0/0.0/[]/{} are falsy). */
function _pyTruthy(v: Json | undefined): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return Object.keys(v).length > 0;
}

/** Python `a or b` where a is a possibly-falsy value and b is the str fallback. */
function _pyStrOr(a: Json | undefined, fallback: string): string {
    return _pyTruthy(a) ? _pyStr(a as Json) : fallback;
}

/** Python `a or b or c or d` chain — return the first truthy, else last. */
function _orFirst(...vals: (Json | undefined)[]): Json {
    for (let i = 0; i < vals.length - 1; i += 1) {
        if (_pyTruthy(vals[i])) {
            return vals[i] as Json;
        }
    }
    return (vals[vals.length - 1] ?? null) as Json;
}

// --- Python-format parity --------------------------------------------------

/**
 * Format `x` to `ndigits` decimals using round-half-to-even on the EXACT value
 * of the IEEE-754 double — byte-for-byte parity with CPython `format(x, '.Nf')`.
 *
 * CPython rounds the true decimal value of the stored double (David Gay dtoa),
 * not a naive `x * 10**N`. A naive scaled-float rounder diverges on values
 * whose product lands just below `.5` in float (e.g. `12.345 * 100` stores as
 * `1234.4999…`, but the true value of `12.345` is `12.34500…0064`, so `.2f`
 * is `12.35`, not `12.34`). `toFixed(40)` yields the exact decimal expansion of
 * the double; round-half-even on that string via BigInt reproduces CPython.
 */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    // Exact decimal expansion of the double (toFixed is correctly rounded; 40
    // places is well past the ~17 significant digits a double can carry, so the
    // tail is the true value, not an artefact).
    const exact = abs.toFixed(40);
    const dot = exact.indexOf('.');
    const intPart = dot === -1 ? exact : exact.slice(0, dot);
    const fracPart = dot === -1 ? '' : exact.slice(dot + 1);
    // Digits we keep, plus the remainder used to decide rounding.
    const kept = (intPart + fracPart.slice(0, ndigits).padEnd(ndigits, '0')).replace(/^0+(?=\d)/, '');
    const rest = fracPart.slice(ndigits); // digits past the cut
    let value = BigInt(kept === '' ? '0' : kept);
    // Round-half-to-even on `rest`.
    if (rest.length > 0) {
        const firstRest = rest.charCodeAt(0) - 48; // 0..9
        const hasMore = /[1-9]/.test(rest.slice(1));
        if (firstRest > 5 || (firstRest === 5 && hasMore)) {
            value += 1n;
        } else if (firstRest === 5 && !hasMore) {
            // Exactly half → round to even.
            if (value % 2n === 1n) {
                value += 1n;
            }
        }
    }
    let intStr = value.toString();
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

export function _delta_pct(a: number | null, b: number | null): string {
    // fmt_pct((a or 0) - (b or 0))
    return fmt_pct((a ?? 0) - (b ?? 0));
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

export function fmt_int(value: number | null): string {
    if (value === null) {
        return '—';
    }
    // f"{int(value):,}" — int() truncates toward zero, then grouped by commas.
    return _pyThousands(_pyIntTrunc(value));
}

export function _delta_num(a: number | null, b: number | null, places = 3): string {
    // d = (a or 0) - (b or 0); f"{d:+.{places}f}"
    const d = (a ?? 0) - (b ?? 0);
    const body = _pyFixed(d, places);
    // f"{d:+...}" forces a leading sign; _pyFixed already emits '-' for negatives.
    return body.startsWith('-') ? body : `+${body}`;
}

/** Python int(x): truncate toward zero. */
function _pyIntTrunc(x: number): number {
    return x < 0 ? Math.ceil(x) : Math.floor(x);
}

/** Python `f"{n:,}"` — group integer digits in threes with commas. */
function _pyThousands(n: number): string {
    const neg = n < 0;
    const digits = String(Math.abs(n));
    let out = '';
    for (let i = 0; i < digits.length; i += 1) {
        if (i > 0 && (digits.length - i) % 3 === 0) {
            out += ',';
        }
        out += digits[i];
    }
    return neg ? `-${out}` : out;
}

export function render_headline(trackA: Obj, trackB: Obj, trackBRdp: Obj = {}): string {
    const wo = _getObj(_getObj(trackB, 'without'), 'results');
    const wi = _getObj(_getObj(trackB, 'with'), 'results');
    const rd = _getObj(trackBRdp, 'results');
    // mode = wi.get("mode") or wo.get("mode") or rd.get("mode") or "—"
    const mode = _pyStrOr(wi['mode'], _pyStrOr(wo['mode'], _pyStrOr(rd['mode'], '—')));
    // total = wi.get("total") or wo.get("total") or rd.get("total") or 0
    const total = _orFirst(wi['total'], wo['total'], rd['total'], 0);
    const dry = mode !== 'live';
    const lines: string[] = [
        '## Headline',
        '',
        '> **Lift of agent-config on the host model — NOT a model-vs-model benchmark.** ' +
            'This measures what the package + the RDP reasoning lift do to a *fixed* host ' +
            'model on a neutral fixture; it is not comparable to public SWE-bench / ' +
            'Fable-5 model scores (different question entirely).',
        '',
    ];
    if (dry) {
        lines.push(
            '> ⚠️ **DRY RUN — no model calls were made; every cell is 0/N by construction.** ' +
                'This shows the *shape* the real numbers will fill. Run `task bench:ab:live` ' +
                '(billable) for actual results.',
            '',
        );
    }
    const errBits: string[] = [];
    for (const [name, res] of [
        ['without', wo],
        ['with', wi],
        ['with-rdp', rd],
    ] as [string, Obj][]) {
        const e = _orZero(res['errored']);
        if (e) {
            errBits.push(`${name}: ${e}/${_pyStr(res['total'] ?? 0)}`);
        }
    }
    lines.push(
        `> ⚠️ **Low statistical power: corpus N=${_pyStr(total)} (< 40).** Directional only; ` +
            'per-cell N is shown below. The `long × mechanical` cell is intentionally ' +
            'empty (documented hole, not an error).',
        '',
    );
    if (errBits.length) {
        lines.push(
            '> ⚠️ **Some tasks errored (rate-limit / budget-cap / timeout) and are ' +
                'excluded from the hit-rate** — they are NOT content failures. Errored ' +
                `counts — ${errBits.join('; ')}. Hit-rate is computed over completed tasks only.`,
            '',
        );
    }
    lines.push(
        '_Host model + inference config (temp / top-p / max-tokens) are recorded in ' +
            'Methodology and must be cited with any quoted number._',
        '',
        '### Table 1 — Package value (without → with)',
        '',
        '| Metric | without | with | delta |',
        '|---|---|---|---|',
        `| Success / hit-rate | ${fmt_pct(_num(wo['completion_rate']))} | ${fmt_pct(_num(wi['completion_rate']))} | ${_delta_pct(_num(wi['completion_rate']), _num(wo['completion_rate']))} |`,
        `| Mean wall-time | ${fmt_num(_num(wo['mean_wall_time']))}s | ${fmt_num(_num(wi['mean_wall_time']))}s | ${fmt_num(_orZero(wi['mean_wall_time']) - _orZero(wo['mean_wall_time']))}s |`,
        `| Ask-vs-act ratio | ${fmt_num(_num(wo['ask_vs_act_ratio']), 3)} | ${fmt_num(_num(wi['ask_vs_act_ratio']), 3)} | ${_delta_num(_num(wi['ask_vs_act_ratio']), _num(wo['ask_vs_act_ratio']))} |`,
        `| Total tokens | ${fmt_int(_num(wo['total_tokens']))} | ${fmt_int(_num(wi['total_tokens']))} | ${fmt_int(_orZero(wi['total_tokens']) - _orZero(wo['total_tokens']))} |`,
        '',
        '### Table 2 — RDP reasoning lift (with → with-rdp)',
        '',
        '| Metric | with | with-rdp | delta |',
        '|---|---|---|---|',
        `| Success / hit-rate | ${fmt_pct(_num(wi['completion_rate']))} | ${fmt_pct(_num(rd['completion_rate']))} | ${_delta_pct(_num(rd['completion_rate']), _num(wi['completion_rate']))} |`,
        `| Mean wall-time | ${fmt_num(_num(wi['mean_wall_time']))}s | ${fmt_num(_num(rd['mean_wall_time']))}s | ${fmt_num(_orZero(rd['mean_wall_time']) - _orZero(wi['mean_wall_time']))}s |`,
        `| Ask-vs-act ratio | ${fmt_num(_num(wi['ask_vs_act_ratio']), 3)} | ${fmt_num(_num(rd['ask_vs_act_ratio']), 3)} | ${_delta_num(_num(rd['ask_vs_act_ratio']), _num(wi['ask_vs_act_ratio']))} |`,
        `| Total tokens | ${fmt_int(_num(wi['total_tokens']))} | ${fmt_int(_num(rd['total_tokens']))} | ${fmt_int(_orZero(rd['total_tokens']) - _orZero(wi['total_tokens']))} |`,
        '',
    );
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

export function render_track_b(trackB: Obj, trackBRdp: Obj = {}): string {
    const lines: string[] = ['## Track B — Task completion', ''];
    const wo = _getObj(_getObj(trackB, 'without'), 'results');
    const wi = _getObj(_getObj(trackB, 'with'), 'results');
    const rd = _getObj(trackBRdp, 'results');
    // mode = wi.get("mode") or wo.get("mode") or rd.get("mode") or "—"
    const mode = _pyStrOr(wi['mode'], _pyStrOr(wo['mode'], _pyStrOr(rd['mode'], '—')));
    lines.push(`- Mode: \`${mode}\``);
    // if not (wo or wi or rd):
    if (!(_pyTruthy(wo) || _pyTruthy(wi) || _pyTruthy(rd))) {
        lines.push('', '_No Track B reports yet. Run `task bench:ab:track-b`._', '');
        return lines.join('\n');
    }
    lines.push(
        `- without → **${fmt_pct(_num(wo['completion_rate']))}** (${_getCount(wo, 'passed')}/${_getCount(wo, 'total')})`,
        `- with → **${fmt_pct(_num(wi['completion_rate']))}** (${_getCount(wi, 'passed')}/${_getCount(wi, 'total')})`,
        `- with-rdp → **${fmt_pct(_num(rd['completion_rate']))}** (${_getCount(rd, 'passed')}/${_getCount(rd, 'total')})`,
        '',
        '### Per 2×2 cell (success-rate per condition; per-cell N in parens)',
        '',
        '| Cell (duration × cognitive) | N | without | with | with-rdp |',
        '|---|---|---|---|---|',
    );
    const woC = _getObj(wo, 'per_cell');
    const wiC = _getObj(wi, 'per_cell');
    const rdC = _getObj(rd, 'per_cell');
    // cells = sorted(set(wo_c) | set(wi_c) | set(rd_c)) or [<defaults>]
    let cells = [...new Set([...Object.keys(woC), ...Object.keys(wiC), ...Object.keys(rdC)])].sort(
        (a, b) => (a < b ? -1 : a > b ? 1 : 0),
    );
    if (cells.length === 0) {
        cells = [
            'short/reasoning-heavy',
            'short/mechanical',
            'long/reasoning-heavy',
            'long/mechanical',
        ];
    }
    for (const cell of cells) {
        // n = (wi_c.get(cell) or wo_c.get(cell) or rd_c.get(cell) or {}).get("total", 0)
        const cellObj = _firstTruthyObj(wiC[cell], woC[cell], rdC[cell]);
        const n = _getCount(cellObj, 'total');
        lines.push(
            `| ${cell} | ${n} | ${fmt_pct(_num(_getObj(woC, cell)['completion_rate']))} ` +
                `| ${fmt_pct(_num(_getObj(wiC, cell)['completion_rate']))} ` +
                `| ${fmt_pct(_num(_getObj(rdC, cell)['completion_rate']))} |`,
        );
    }
    lines.push(
        '',
        '### Per 2×2 cell — mean tokens per condition',
        '',
        '| Cell (duration × cognitive) | without | with | with-rdp |',
        '|---|---|---|---|',
    );
    for (const cell of cells) {
        lines.push(
            `| ${cell} | ${fmt_int(_num(_getObj(woC, cell)['mean_tokens']))} ` +
                `| ${fmt_int(_num(_getObj(wiC, cell)['mean_tokens']))} ` +
                `| ${fmt_int(_num(_getObj(rdC, cell)['mean_tokens']))} |`,
        );
    }
    lines.push(
        '',
        '_`short × mechanical` mean-tokens across conditions answers "are short ' +
            'tasks more expensive?"; `long × reasoning-heavy` answers "do long tasks ' +
            'get cheaper / better?"._',
        '',
        '### Per category',
        '',
        '| Category | without | with | with-rdp |',
        '|---|---|---|---|',
    );
    const woCat = _getObj(wo, 'per_category');
    const wiCat = _getObj(wi, 'per_category');
    const rdCat = _getObj(rd, 'per_category');
    const cats = [
        ...new Set([...Object.keys(woCat), ...Object.keys(wiCat), ...Object.keys(rdCat)]),
    ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const cat of cats) {
        lines.push(
            `| ${cat} | ${fmt_pct(_num(_getObj(woCat, cat)['completion_rate']))} ` +
                `| ${fmt_pct(_num(_getObj(wiCat, cat)['completion_rate']))} ` +
                `| ${fmt_pct(_num(_getObj(rdCat, cat)['completion_rate']))} |`,
        );
    }
    lines.push('');
    return lines.join('\n');
}

/** Python `(a or b or c or {})` for chained dict fallback → Obj. */
function _firstTruthyObj(...vals: (Json | undefined)[]): Obj {
    for (const v of vals) {
        if (_pyTruthy(v)) {
            return _obj(v);
        }
    }
    return {};
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
    const trackBRdp = latest_trackb_with_rdp();
    const haveData = Boolean(
        Object.keys(_obj(trackA['with'])).length ||
            Object.keys(_obj(trackA['without'])).length ||
            Object.keys(_obj(trackB['with'])).length ||
            Object.keys(_obj(trackB['without'])).length ||
            Object.keys(trackBRdp).length,
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
        render_headline(trackA, trackB, trackBRdp),
        render_track_a(trackA),
        render_track_b(trackB, trackBRdp),
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
