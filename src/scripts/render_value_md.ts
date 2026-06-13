#!/usr/bin/env node
/**
 * Render `docs/value.md` from the latest `value-v1` JSON report.
 *
 * TypeScript twin of `src/scripts/render_value_md.py` (ADR-092, Phase 8
 * / Wave 8b). The public surface and rendered output mirror the Python
 * original EXACTLY — same module-level path constants (exposed through a
 * mutable test seam so the pytest `monkeypatch.setattr` injection ports
 * 1:1), same `REQUIRED_SECTIONS`, same byte-for-byte rendered markdown,
 * same number formatting (Python `{:+,}` / `{:,}` thousands grouping
 * with comma→space replacement, `{:+.2f}%` percent), same placeholder
 * fallback, same `--quiet` flag and stdout text. No behaviour changes.
 *
 * This renderer is **deterministic** — it does not run any bench, only
 * formats existing reports. Mirrors `render_benchmark_md.py`'s
 * placeholder discipline: when the report is missing, write a
 * placeholder document explaining how to produce one. Never errors.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// src/scripts/render_value_md.ts → parents[2] of the .py file is the repo
// root (two dirs up from src/scripts).
const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');

/**
 * Mutable path config — mirrors the Python module-level constants
 * `VALUE_REPORTS_DIR`, `LATEST`, `OUT_PATH` that the pytest suite
 * reassigns via `monkeypatch.setattr(mod, "LATEST", ...)`. The renderer
 * reads through these getters; the test seam reassigns them.
 */
interface PathConfig {
    VALUE_REPORTS_DIR: string;
    LATEST: string;
    OUT_PATH: string;
}

function _derivePaths(repoRoot: string): PathConfig {
    const valueReportsDir = path.join(repoRoot, 'internal', 'bench', 'reports', 'value');
    return {
        VALUE_REPORTS_DIR: valueReportsDir,
        LATEST: path.join(valueReportsDir, 'latest.json'),
        OUT_PATH: path.join(repoRoot, 'docs', 'value.md'),
    };
}

const _paths: PathConfig = _derivePaths(REPO_ROOT);

export const VALUE_REPORTS_DIR = (): string => _paths.VALUE_REPORTS_DIR;
export const LATEST = (): string => _paths.LATEST;
export const OUT_PATH = (): string => _paths.OUT_PATH;

/**
 * Test seam mirroring `monkeypatch.setattr(mod, "LATEST", ...)` etc.
 * Reassigns the named path constants; unspecified ones keep their
 * current value. Not part of the Python surface — a TS-only injection
 * point.
 */
export function _setPathsForTest(overrides: Partial<PathConfig>): void {
    Object.assign(_paths, overrides);
}

export const REQUIRED_SECTIONS = [
    '## Reference scale',
    '## Panel A',
    '## Panel B',
    '## Glossary',
    '**NET',
] as const;

type Json = unknown;
type JsonObject = Record<string, unknown>;

/** Mirror `datetime.now(timezone.utc).isoformat(timespec="seconds")`. */
function utc_iso(): string {
    // Python isoformat with seconds precision for UTC produces e.g.
    // "2026-06-12T10:11:12+00:00". Build it from the Date object.
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
    );
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function safe_load(p: string): JsonObject | null {
    if (!_exists(p)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as JsonObject;
    } catch {
        // Mirrors `except json.JSONDecodeError: return None`.
        return null;
    }
}

/**
 * Python `"{:,}".format(value)` — comma thousands separators. Works on
 * non-negative integers as used here. Negative numbers carry a leading
 * minus before the grouped digits.
 */
function pyGroupInt(value: number): string {
    const neg = value < 0;
    const digits = Math.abs(Math.trunc(value)).toString();
    let out = '';
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) {
            out += ',';
        }
        out += digits[i];
    }
    return neg ? `-${out}` : out;
}

/**
 * Python `f"{value:+,}".replace(",", " ")` — note the replacement char
 * is U+202F NARROW NO-BREAK SPACE (taken verbatim from the Python source),
 * NOT a regular space. Byte-for-byte parity depends on it.
 */
function fmt_signed_int(value: number): string {
    const v = Math.trunc(value);
    const grouped = pyGroupInt(Math.abs(v));
    const signed = v >= 0 ? `+${grouped}` : `-${grouped}`;
    return signed.replace(/,/g, ' ');
}

/** Python `f"{value:+.2f}%"`. */
function fmt_pct(value: number): string {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function confidence_badge(level: string): string {
    const badges: Record<string, string> = {
        measured: '✅ measured',
        estimated: '≈ estimated',
        'vendor-claim': '⚠️ vendor-claim',
        pending: '⏳ pending',
        available: '🔁 available (default off)',
    };
    return badges[level] ?? level;
}

function mode_badge(mode: string): string {
    if (mode === 'live') {
        return '✅ live';
    }
    if (mode === 'dry-run') {
        return '⚠️ dry-run';
    }
    return mode;
}

function _get(obj: JsonObject, key: string): unknown {
    return obj[key];
}

function _asObject(v: unknown): JsonObject {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {};
}

function _asArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}

function render_intro(report: JsonObject): string {
    const ref = _asObject(_get(report, 'reference_scale'));
    const requests = (ref['requests'] as number) ?? 1000;
    const avgIn = (ref['avg_input_tokens'] as number) ?? 8000;
    const avgOut = (ref['avg_output_tokens'] as number) ?? 600;
    const tier = (ref['model_tier'] as string) ?? 'sonnet';
    return (
        `# Value Dashboard — what does the package cost, what does it bring?\n` +
        '\n' +
        '> This page answers **one** question in real numbers: ' +
        '*How many more tokens does the package cost me, and how much ' +
        'does it save back afterwards?* Generated by ' +
        '`scripts/render_value_md.py` from the latest `value-v1` report; ' +
        'source: `internal/bench/reports/value/latest.json`.\n' +
        '\n' +
        '## How to read this page\n' +
        '\n' +
        '**Panel A (token ladder)** — read top to bottom. Each ' +
        'rung states: *what it does*, *how many input tokens it adds or ' +
        'saves per request*, and *where we stand cumulatively*. ' +
        'The bold **NET** line at the end is the answer. ' +
        'Deliberately pure tokens — no € comparison, since subscription ' +
        'users pay no per-request API prices.\n' +
        '\n' +
        '**Panel B (behavior)** — four real comparisons, *with* vs. ' +
        '*without* the package. This is where the non-token value lives: ' +
        'fitting skill selection, stops on risky actions, fewer ' +
        'clarifying questions, more completed tasks.\n' +
        '\n' +
        '**Confidence markers** on each rung: `✅ measured` = a real ' +
        'value from a report in the repo · `⏳ pending` = not yet ' +
        'measured, the rung contributes 0 to the sum · `⚠️ vendor-claim` = ' +
        "a vendor's claim, not measured by us.\n" +
        '\n' +
        '## Reference scale\n' +
        '\n' +
        `- **${pyGroupInt(requests)}** requests, on average ` +
        `**${pyGroupInt(avgIn)}** input tokens and **${pyGroupInt(avgOut)}** output tokens ` +
        'per request\n' +
        `- Model tier (workload assumption): \`${tier}\`\n` +
        '- Anyone running a different workload recomputes it themselves — the ' +
        'methodology is disclosed; nothing is hardcoded or hidden.\n'
    );
}

function render_panel_a(report: JsonObject): string {
    const lines: string[] = [
        '## Panel A — Cost ladder (cumulative, min → max)\n',
        'Reads top to bottom. Positive Δ values = the package ' +
            '*costs* tokens (rule load is the honest up-front tax); ' +
            'negative Δ values = the package *saves* tokens.\n',
        '| Rung | What it does | Δ tokens | Cumulative | Source |',
        '|---|---|---:|---:|---|',
    ];
    for (const rungRaw of _asArray(_get(report, 'cost_ladder'))) {
        const rung = _asObject(rungRaw);
        let labelCell: string;
        if (rung['id'] === 'baseline') {
            labelCell = `**${rung['label'] as string}**`;
        } else {
            labelCell = rung['label'] as string;
        }
        let what = (rung['what_it_does'] as string) ?? '';
        const tokenDelta = Math.trunc((rung['token_delta'] as number) ?? 0);
        const cum = Number((rung['cumulative_pct'] as number) ?? 0.0);
        const conf = confidence_badge((rung['confidence'] as string) ?? 'pending');
        const source = (rung['source_report'] as string) ?? '';
        // Honesty stamp: an `up-front-cost` note on the load rung.
        if (rung['id'] === 'load' && tokenDelta > 0) {
            what = `${what} ⚠️ costs first`;
        }
        lines.push(
            `| ${labelCell} | ${what} | ` +
                `${fmt_signed_int(tokenDelta)} | ` +
                `${fmt_pct(cum)} | \`${source}\` · ${conf} |`,
        );
        if (rung['footnote']) {
            lines.push(`| | _Footnote:_ ${rung['footnote'] as string} | | | |`);
        }
    }

    const totals = _asObject(_get(report, 'totals'));
    const cumTokens = Math.trunc((totals['cumulative_token_delta'] as number) ?? 0);
    const cumPct = Number((totals['cumulative_pct'] as number) ?? 0.0);
    const verdict = (totals['net_verdict'] as string) ?? '—';
    const verdictLabels: Record<string, string> = {
        'net-saving': '**NET: saving** ✅',
        'net-cost': '**NET: extra cost** ⚠️',
        'break-even': '**NET: break-even** ⚖️',
    };
    const verdictLabel = verdictLabels[verdict] ?? `**NET: ${verdict}**`;
    lines.push(
        '',
        `${verdictLabel} — ` +
            `**${fmt_signed_int(cumTokens)} tokens / request**, ` +
            `cumulative **${fmt_pct(cumPct)}** vs. baseline.\n`,
    );
    return lines.join('\n');
}

function render_panel_b(report: JsonObject): string {
    const lines: string[] = [
        '## Panel B — Behavior (with vs. without)\n',
        'Four real comparisons from actual bench runs. This is where the ' +
            'value lives that tokens alone do not measure: whether the agent ' +
            'picks the right skill, stops on risky actions, asks fewer ' +
            'clarifying questions, and completes more tasks.\n',
        '| Metric | What it means | With package | Without package | Δ | Mode |',
        '|---|---|---:|---:|---:|---|',
    ];
    for (const metricRaw of _asArray(_get(report, 'behaviour'))) {
        const metric = _asObject(metricRaw);
        const label = metric['label'] as string;
        const what = (metric['what_this_means'] as string) ?? '';
        const unit = (metric['unit'] as string) ?? '';
        const mode = mode_badge((metric['mode'] as string) ?? 'dry-run');

        const _fmt = (v: unknown): string => {
            if (v === null || v === undefined) {
                return '—';
            }
            if (unit === 'pct' && typeof v === 'number') {
                return `${(v * 100).toFixed(1)}%`;
            }
            if (unit === 'count') {
                return String(Math.trunc(v as number));
            }
            if (unit === 'ratio' && typeof v === 'number') {
                return v.toFixed(3);
            }
            if (unit === 'seconds' && typeof v === 'number') {
                return `${v.toFixed(1)}s`;
            }
            return String(v);
        };

        const withV = _fmt(metric['with']);
        const withoutV = _fmt(metric['without']);
        const deltaV = _fmt(metric['delta']);
        lines.push(`| ${label} | ${what} | ${withV} | ${withoutV} | ${deltaV} | ${mode} |`);
    }
    return lines.join('\n') + '\n';
}

function render_glossary(): string {
    return (
        '## Glossary\n' +
        '\n' +
        'Plain-language definitions for the non-developer reader.\n' +
        '\n' +
        '- **Token** — the unit a language model bills in. ' +
        'Rule of thumb: one token ≈ 4 characters of German/English prose. ' +
        '1,000 tokens ≈ 750 words.\n' +
        '- **Input tokens** — everything the model reads per turn ' +
        '(system prompt, always-active rules, your message, earlier ' +
        'conversation). The package adds rules here — installation ' +
        'costs input tokens.\n' +
        '- **Output tokens** — what the model writes back. Usually ' +
        'fewer than input. More expensive per token than input.\n' +
        '- **condense** — a build step that shrinks the rule files ' +
        'before shipping (`.agent-src.uncondensed` → ' +
        '`dist/agent-src`). Saves input tokens on every request.\n' +
        '- **rtk** — the *Rust Token Killer*, a CLI wrapper that ' +
        'filters verbose output (`git status`, lint output, test ' +
        'runners) before the model reads it. Saves input tokens on ' +
        'tool calls.\n' +
        '- **terse / telegraph** — a style (short phrases, ' +
        'dropped articles) the agent uses for terser answers. ' +
        'Saves output tokens — when the corpus rewards it.\n' +
        '- **Without package / With package** — the two arms of the ' +
        'A/B comparison.\n' +
        '- **Δ tokens** — input-token difference per request against the ' +
        'baseline. Deliberately the only cost unit: a € comparison ' +
        'would imply per-request API prices that subscription users do ' +
        'not pay.\n'
    );
}

function render_methodology(report: JsonObject): string {
    const notes = _asArray(_get(report, 'notes'));
    const lines: string[] = [
        '## Methodology & sources\n',
        'This page is a **derived** view — not its own ' +
            'measurement. It summarizes three existing bench surfaces ' +
            "(see the 'Source' column in Panel A). The machine-readable " +
            'raw reports remain the source of truth:\n',
        '- `internal/bench/reports/telegraph-v1.json` / `telegraph-v2.json` ' +
            '— Telegraph/condense measurements.\n',
        '- `agents/runtime/frugality/baseline.jsonl` — the package load ' +
            '(Metric A footprint).\n',
        '- `internal/bench/reports/rtk/latest.json` — the rtk measurement ' +
            '(new, Phase 2).\n',
        '- `internal/bench/reports/ab/*-ab-trackb-{with,without}.json` ' +
            '— A/B Track B (behavior).\n',
        '- `internal/bench/reports/*-dev.json` — dev-corpus selection ' +
            'accuracy.\n',
        '',
        '**A/B technical appendix:** [`docs/benchmark.md`](benchmark.md) ' +
            'carries the cache-key, integrity, and methodology details of ' +
            'the A/B bench — anyone who wants to see the variant-axis proof ' +
            'reads on there.\n',
        '',
    ];
    if (notes.length) {
        lines.push('**Notes from the report:**\n');
        for (const note of notes) {
            lines.push(`- ${note as string}`);
        }
        lines.push('');
    }
    lines.push(`_Last rendered: \`${utc_iso()}\`_\n`);
    return lines.join('\n');
}

function render_placeholder(): string {
    return (
        '# Value Dashboard — placeholder\n' +
        '\n' +
        '_No `value-v1` report exists yet at ' +
        '`internal/bench/reports/value/latest.json`._\n' +
        '\n' +
        'Generate one with:\n' +
        '\n' +
        '```sh\n' +
        'task value\n' +
        '```\n' +
        '\n' +
        'The methodology of this dashboard is described in ' +
        '`docs/contracts/value-dashboard-spec.md` and the associated ' +
        'roadmap `agents/roadmaps/road-to-readable-value-dashboard.md`.\n' +
        '\n' +
        `_Last rendered: ${utc_iso()}_\n`
    );
}

/**
 * Mirror `Path.relative_to(REPO_ROOT)` — throws when `p` is NOT under the
 * repo root (Python `ValueError`). The default `OUT_PATH` is always in-repo
 * (`docs/value.md`); replicated for fidelity with the Python original.
 */
function _relativeToRepo(p: string): string {
    const abs = path.resolve(p);
    const rel = path.relative(REPO_ROOT, abs);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(
            `'${abs}' is not in the subpath of '${REPO_ROOT}' ` +
                `OR one path is relative and the other is absolute.`,
        );
    }
    return rel.split(path.sep).join('/');
}

export function render(quiet = false): number {
    const report = safe_load(_paths.LATEST);
    fs.mkdirSync(path.dirname(_paths.OUT_PATH), { recursive: true });
    if (!report) {
        fs.writeFileSync(_paths.OUT_PATH, render_placeholder());
        if (!quiet) {
            process.stdout.write(
                `render_value_md: no report — wrote placeholder to ` +
                    `${_relativeToRepo(_paths.OUT_PATH)}\n`,
            );
        }
        return 0;
    }
    const parts = [
        render_intro(report),
        render_panel_a(report),
        render_panel_b(report),
        render_glossary(),
        render_methodology(report),
    ];
    fs.writeFileSync(_paths.OUT_PATH, parts.join('\n'));
    if (!quiet) {
        process.stdout.write(`render_value_md: wrote ${_relativeToRepo(_paths.OUT_PATH)}\n`);
    }
    return 0;
}

interface ParsedArgs {
    quiet: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    let quiet = false;
    for (const a of argv) {
        if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: render_value_md [-h] [--quiet]\n\n' +
                    'Render docs/value.md from the latest value-v1 report.\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(
                `render_value_md: error: unrecognized arguments: ${a}\n`,
            );
            process.exit(2);
        }
    }
    return { quiet };
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    return render(args.quiet);
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked temp dirs (e.g. macOS /var → /private/var) make the raw URLs
    // differ; compare realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1] as string));
        return here === argv;
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    process.exitCode = main();
}
