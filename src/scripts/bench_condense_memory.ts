#!/usr/bin/env tsx
/**
 * Offline bench for input-side memory condensation (Phase 2 / Step 11).
 *
 * TypeScript twin of `src/scripts/bench_condense_memory.py` (ADR-096,
 * Phase 7 / dev-side memory). The public API and CLI contract mirror the
 * Python original EXACTLY — same exit code, stdout/stderr, byte-identical
 * generated reports (`internal/bench/reports/telegraph-v2.{json,md}`,
 * matching json.dumps(indent=2) + the Markdown layout / number formats).
 * No behaviour changes — latent Python bugs are replicated and flagged as
 * divergence candidates.
 *
 * Runs `condense_memory` over a fixed corpus of memory-target files,
 * records pre/post char counts, approximates input-token savings (chars / 4
 * — the GPT-4 / Claude rule of thumb), and emits the report pair. Offline
 * (no API calls).
 *
 * The condense step is run as a subprocess against the `condense_memory`
 * twin in this repo (via the tsx runner), mirroring the Python original's
 * `subprocess.run([sys.executable, CONDENSE_SCRIPT, ...])`.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CONDENSE_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'condense_memory.ts');
const REPORT_JSON = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'telegraph-v2.json');
const REPORT_MD = path.join(REPO_ROOT, 'internal', 'bench', 'reports', 'telegraph-v2.md');

const CORPUS: readonly [string, string][] = [
    ['AGENTS.md', 'thin-root-package'],
    ['.agent-src.uncondensed/templates/AGENTS.md', 'thin-root-consumer-template'],
    ['dist/agent-src/templates/AGENTS.md', 'thin-root-consumer-generated'],
    ['docs/contracts/ai-council-config.md', 'prose-heavy-contract'],
    ['docs/contracts/implement-ticket-flow.md', 'prose-heavy-contract'],
    ['docs/contracts/command-clusters.md', 'prose-heavy-contract'],
    ['docs/contracts/mental-models.md', 'prose-heavy-contract'],
    ['docs/contracts/kernel-membership.md', 'prose-heavy-contract'],
    ['docs/contracts/load-context-budget-model.md', 'prose-heavy-contract'],
    ['docs/contracts/mcp-cloud-scope.md', 'prose-heavy-contract'],
    ['docs/contracts/context-spine.md', 'prose-heavy-contract'],
    ['docs/contracts/rule-classification.md', 'rule-classification'],
];

interface BenchRowOk {
    path: string;
    category: string;
    before_chars: number;
    after_chars: number;
    delta_chars: number;
    saving_pct_chars: number;
    before_tokens_est: number;
    after_tokens_est: number;
    delta_tokens_est: number;
    saving_pct_tokens_est: number;
}
interface BenchRowErr {
    path: string;
    category: string;
    error: string;
    stderr?: string;
}
type BenchRow = BenchRowOk | BenchRowErr;

function _isErr(r: BenchRow): r is BenchRowErr {
    return 'error' in r;
}

/** Approximate token count via chars / 4 — mirrors round(n / 4). */
export function chars_to_tokens(n: number): number {
    return _pyRound(n / 4);
}

/** Mirror Python round() — banker's rounding to nearest integer. */
function _pyRound(x: number): number {
    const floor = Math.floor(x);
    const diff = x - floor;
    if (Math.abs(diff - 0.5) < 1e-9) {
        return floor % 2 === 0 ? floor : floor + 1;
    }
    return Math.round(x);
}

function bench_one(rel_path: string, category: string): BenchRow {
    const src = path.join(REPO_ROOT, rel_path);
    if (!_isFile(src)) {
        return { path: rel_path, category, error: 'not-found' };
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'benchcond-'));
    try {
        const target = path.join(tmp, path.basename(src));
        fs.copyFileSync(src, target);
        const before_chars = fs.statSync(target).size;
        const result = _runCondense(target);
        if (result.status !== 0) {
            const stderrStr = typeof result.stderr === 'string' ? result.stderr : (result.stderr?.toString() ?? '');
            return {
                path: rel_path,
                category,
                error: `exit-${result.status}`,
                stderr: stderrStr.slice(0, 200),
            };
        }
        const after_chars = fs.statSync(target).size;
        const before_tok = chars_to_tokens(before_chars);
        const after_tok = chars_to_tokens(after_chars);
        return {
            path: rel_path,
            category,
            before_chars,
            after_chars,
            delta_chars: after_chars - before_chars,
            saving_pct_chars: ((before_chars - after_chars) * 100) / before_chars,
            before_tokens_est: before_tok,
            after_tokens_est: after_tok,
            delta_tokens_est: after_tok - before_tok,
            saving_pct_tokens_est: before_tok ? ((before_tok - after_tok) * 100) / before_tok : 0.0,
        };
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function _runCondense(target: string): ReturnType<typeof spawnSync> {
    const tsxBin = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
    return spawnSync(tsxBin, [CONDENSE_SCRIPT, target], {
        encoding: 'utf-8',
        cwd: REPO_ROOT,
    });
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

interface Aggregate {
    calls: number;
    errors: number;
    median_saving_pct: number;
    p10_saving_pct: number;
    p90_saving_pct: number;
    stdev_saving_pct: number;
    total_chars_saved: number;
    total_tokens_est_saved: number;
    by_category_median_pct: Record<string, number>;
}

function aggregate(rows: BenchRow[]): Aggregate {
    const rows_ok = rows.filter((r): r is BenchRowOk => !_isErr(r));
    const savings = rows_ok.map((r) => r.saving_pct_chars);
    const by_cat = new Map<string, number[]>();
    for (const r of rows_ok) {
        if (!by_cat.has(r.category)) {
            by_cat.set(r.category, []);
        }
        (by_cat.get(r.category) as number[]).push(r.saving_pct_chars);
    }
    const by_category_median_pct: Record<string, number> = {};
    for (const [k, v] of by_cat) {
        by_category_median_pct[k] = _median(v);
    }
    return {
        calls: rows.length,
        errors: rows.length - rows_ok.length,
        median_saving_pct: savings.length ? _median(savings) : 0.0,
        p10_saving_pct: savings.length >= 10 ? (_quantiles10(savings)[0] as number) : _min(savings, 0.0),
        p90_saving_pct: savings.length >= 10 ? (_quantiles10(savings)[8] as number) : _max(savings, 0.0),
        stdev_saving_pct: savings.length > 1 ? _pstdev(savings) : 0.0,
        total_chars_saved: rows_ok.reduce((acc, r) => acc + (r.before_chars - r.after_chars), 0),
        total_tokens_est_saved: rows_ok.reduce((acc, r) => acc + (r.before_tokens_est - r.after_tokens_est), 0),
        by_category_median_pct,
    };
}

/** Mirror statistics.median. */
function _median(data: number[]): number {
    const s = [...data].sort((a, b) => a - b);
    const n = s.length;
    if (n === 0) {
        return 0.0;
    }
    const mid = Math.floor(n / 2);
    if (n % 2 === 1) {
        return s[mid] as number;
    }
    return ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * Mirror statistics.quantiles(data, n=10) — exclusive method (CPython default).
 * Reproduces the integer-arithmetic interpolation in CPython's
 * statistics._quantiles exclusive branch.
 */
function _quantiles10(data: number[]): number[] {
    const ld = data.length;
    const s = [...data].sort((a, b) => a - b);
    const n = 10;
    const m = ld + 1;
    const result: number[] = [];
    for (let i = 1; i < n; i += 1) {
        let j = Math.floor((i * m) / n); // integer division
        if (j < 1) {
            j = 1;
        } else if (j > ld - 1) {
            j = ld - 1;
        }
        const delta = i * m - j * n;
        const interpolated = ((s[j - 1] as number) * (n - delta) + (s[j] as number) * delta) / n;
        result.push(interpolated);
    }
    return result;
}

/** Mirror statistics.pstdev (population standard deviation). */
function _pstdev(data: number[]): number {
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / n;
    return Math.sqrt(variance);
}

function _min(data: number[], dflt: number): number {
    return data.length ? Math.min(...data) : dflt;
}
function _max(data: number[], dflt: number): number {
    return data.length ? Math.max(...data) : dflt;
}

interface Payload {
    generated_at: string;
    schema: string;
    rows: BenchRow[];
    aggregate: Aggregate;
}

function render_md(payload: Payload): string {
    const agg = payload.aggregate;
    const lines: string[] = [
        '# telegraph-v2 — input-side memory condensation bench',
        '',
        `**Generated:** ${payload.generated_at}`,
        '**Schema:** `telegraph-v2` (input-side; offline; chars→tokens via /4 heuristic)',
        '**Script:** `scripts/bench_condense_memory.py`',
        '',
        '## Headline',
        '',
        `- Median char saving: **${_pctSigned2(agg.median_saving_pct)}** (p10 ${_pctSigned2(
            agg.p10_saving_pct,
        )} · p90 ${_pctSigned2(agg.p90_saving_pct)})`,
        `- Total chars saved across corpus: **${_intSignedComma(agg.total_chars_saved)}**`,
        `- Total tokens (estimate) saved across corpus: **${_intSignedComma(agg.total_tokens_est_saved)}**`,
        `- Files: ${agg.calls} · errors: ${agg.errors}`,
        '',
        '## By category (median %)',
        '',
        '| Category | Median saving |',
        '|---|---:|',
    ];
    for (const [cat, med] of _sortedEntries(agg.by_category_median_pct)) {
        lines.push(`| ${cat} | ${_pctSigned2(med)} |`);
    }
    lines.push(
        '',
        '## Per file',
        '',
        '| Path | Category | Before | After | Δ chars | Saving % |',
        '|---|---|---:|---:|---:|---:|',
    );
    for (const r of payload.rows) {
        if (_isErr(r)) {
            lines.push(`| \`${r.path}\` | ${r.category} | — | — | — | ${r.error} |`);
        } else {
            lines.push(
                `| \`${r.path}\` | ${r.category} | ${_intComma(r.before_chars)} | ${_intComma(r.after_chars)} | ` +
                    `${_intSignedComma(r.delta_chars)} | ${_pctSigned2(r.saving_pct_chars)} |`,
            );
        }
    }
    lines.push(
        '',
        '## Methodology',
        '',
        '- Offline run: `condense_memory.py` writes `.original.md` backup + frontmatter (`original_sha256`, `condensed_at`). The frontmatter pair (≈ 120 chars) is the fixed condensation tax — files with little prose net negative.',
        '- chars → tokens approximation: `tokens ≈ chars / 4` (GPT-4 / Claude English rule of thumb). Calibrated number requires `tiktoken` or `claude-tokenizer`; deferred until a consumer requests pinpoint numbers.',
        '- The `telegraph-v1` output-side verdict (`vs_terse` median −9.27%) is orthogonal — input-side savings apply to the always-loaded memory budget, not the reply stream.',
        '',
        '## Interpretation',
        '',
        '- **Thin-Root files net negative.** `AGENTS.md` and `templates/AGENTS.md` already follow `agents-md-thin-root` (≥ 40 % pointer ratio). The condenseor\'s frontmatter pair adds more bytes than the sparse prose loses. **Do not condense Thin-Root files.**',
        '- **Prose-heavy contract docs net 3–6 % saving.** Useful but modest. Pays off when the file is large and frequently loaded.',
        '- **Rule of thumb:** target files with > 5 KB and visible paragraph prose; skip pointer-only files.',
        '',
    );
    return lines.join('\n');
}

/** sorted(dict.items()) by key. */
function _sortedEntries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Mirror f"{x:+.2f}%". */
function _pctSigned2(x: number): string {
    const v = x.toFixed(2);
    return `${x >= 0 && !v.startsWith('-') ? '+' : ''}${v}%`;
}

/** Mirror f"{n:+,}" — signed, comma-grouped integer. */
function _intSignedComma(n: number): string {
    const sign = n >= 0 ? '+' : '-';
    return `${sign}${_groupThousands(Math.abs(n))}`;
}

/** Mirror f"{n:,}" — comma-grouped integer. */
function _intComma(n: number): string {
    const sign = n < 0 ? '-' : '';
    return `${sign}${_groupThousands(Math.abs(n))}`;
}

function _groupThousands(n: number): string {
    return Math.trunc(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// --- JSON output (json.dumps(payload, indent=2)) ----------------------------

function pyJsonDumps(value: unknown, indent: number): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0));
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
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
    // Python json.dumps emits repr(float); Number.toString() matches the
    // shortest round-trip representation for the doubles that arise here.
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

/** Mirror datetime.now(utc).strftime("%Y-%m-%dT%H:%M:%SZ"). */
function _nowUtcZ(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
    const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mo}-${day}T${hh}:${mi}:${ss}Z`;
}

// Exported for differential testing of the pure transform layer.
export { aggregate, bench_one, render_md };

export function main(): number {
    const rows = CORPUS.map(([p, c]) => bench_one(p, c));
    const payload: Payload = {
        generated_at: _nowUtcZ(),
        schema: 'telegraph-v2',
        rows,
        aggregate: aggregate(rows),
    };
    fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
    fs.writeFileSync(REPORT_JSON, `${pyJsonDumps(payload, 2)}\n`, 'utf-8');
    fs.writeFileSync(REPORT_MD, render_md(payload), 'utf-8');
    process.stdout.write(`wrote: ${REPORT_JSON}\n`);
    process.stdout.write(`wrote: ${REPORT_MD}\n`);
    process.stdout.write(`median saving: ${_pctSigned2(payload.aggregate.median_saving_pct)}\n`);
    return 0;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}
