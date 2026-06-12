#!/usr/bin/env tsx
/**
 * Roll up `adoption-snapshots.jsonl` into a Markdown trend report.
 *
 * TypeScript twin of `src/scripts/adoption_report.py` (ADR-089, Phase 8 /
 * Wave 8a). The CLI contract is mirrored EXACTLY — the flags `--in` /
 * `--out` / `--weeks`, exit codes (0 written · 1 IO failure on read/write),
 * the stdout/stderr split, byte-identical messages, AND byte-identical
 * generated Markdown (the report is a write target). Mirrors the shape of
 * `skill_usage_report.py`: a single file, no external deps. The report is
 * regenerated on every invocation (idempotent for a given JSONL state).
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

type Json = unknown;
type JsonObject = Record<string, Json>;

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/adoption_report.ts → parents[2] of the .py file is the repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const DEFAULT_IN = path.join(REPO_ROOT, 'agents', 'runtime', 'metrics', 'adoption-snapshots.jsonl');
export const DEFAULT_OUT = path.join(REPO_ROOT, 'agents', 'runtime', 'metrics', 'adoption-report.md');

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _asObject(v: Json): JsonObject | null {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v as JsonObject;
    }
    return null;
}

/**
 * `dict.get(key, default)` over a Json value: when `obj` is an object and the
 * key is present, return its value; otherwise the default.
 */
function _get(obj: Json, key: string, dflt: Json): Json {
    const o = _asObject(obj);
    if (o && key in o) {
        return o[key];
    }
    return dflt;
}

/** Mirror Python `str()` for the values printed/sliced here. */
function _str(v: Json): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    return String(v);
}

/** Mirror the `f"{n:,}"` thousands-separator format (Python uses `,` grouping). */
function _comma(n: Json): string {
    if (typeof n === 'number' && Number.isFinite(n)) {
        return n.toLocaleString('en-US');
    }
    // Python would raise on a non-number; the snapshot fields are ints by
    // contract. Fall back to plain stringification to avoid a crash.
    return _str(n);
}

export function parse_jsonl(p: string): JsonObject[] {
    const rows: JsonObject[] = [];
    if (!_exists(p)) {
        return rows;
    }
    const text = fs.readFileSync(p, 'utf-8');
    // Python str.splitlines() splits on universal newlines and drops the
    // trailing separator. `\n`-only split with a final-empty drop matches the
    // JSONL fixture shape (LF-terminated). Use a splitlines-equivalent.
    for (let line of _splitlines(text)) {
        line = line.trim();
        if (!line) {
            continue;
        }
        try {
            const parsed = JSON.parse(line);
            // json.loads can yield non-dict values; the original appends them
            // verbatim. Downstream `.get` guards via _get() tolerate non-dicts.
            rows.push(parsed as JsonObject);
        } catch {
            continue;
        }
    }
    return rows;
}

/** Mirror Python `str.splitlines()` (no trailing empty element for a final newline). */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    // Split on the universal newline set Python recognises in practice here:
    // \r\n, \r, \n. Trailing line separator does not produce a final "".
    const parts = text.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '' && /(\r\n|\r|\n)$/.test(text)) {
        parts.pop();
    }
    return parts;
}

/**
 * Parse a `%Y-%m-%dT%H:%M:%SZ` timestamp as a UTC epoch millisecond value, or
 * `null` when it does not match (mirrors `strptime` raising ValueError).
 */
function _parseSnapshotTs(ts: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(ts);
    if (!m) {
        return null;
    }
    const [, y, mo, d, h, mi, s] = m;
    return Date.UTC(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
        Number(s),
    );
}

export function filter_window(rows: JsonObject[], weeks: number): JsonObject[] {
    if (rows.length === 0) {
        return rows;
    }
    const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;
    const out: JsonObject[] = [];
    for (const r of rows) {
        const ts = _str(_get(r, 'snapshot_at', ''));
        const when = _parseSnapshotTs(ts);
        if (when === null) {
            continue;
        }
        if (when >= cutoff) {
            out.push(r);
        }
    }
    return out;
}

export function render_section(title: string, lines: string[]): string {
    return `## ${title}\n\n` + lines.join('\n') + '\n\n';
}

export function render_npm_downloads(rows: JsonObject[]): string {
    const lines: string[] = [];
    lines.push('| Snapshot | Last 7 days (npm installs) |');
    lines.push('|---|---:|');
    for (const r of rows) {
        const signal = _get(_get(r, 'signals', {}), 'npm_downloads', {});
        const sObj = _asObject(signal);
        let cell: string;
        if (sObj && 'error' in sObj) {
            cell = `_(error: ${_str(sObj['error']).slice(0, 40)})_`;
        } else {
            cell = `${_comma(_get(signal, 'last_7_days', 0))}`;
        }
        lines.push(`| \`${_str(_get(r, 'snapshot_at', '?'))}\` | ${cell} |`);
    }
    return render_section('npm install count (last 7 days, weekly snapshot)', lines);
}

export function render_npm_version(rows: JsonObject[]): string {
    const lines: string[] = [];
    lines.push('| Snapshot | Latest version | Version count |');
    lines.push('|---|---|---:|');
    for (const r of rows) {
        const signal = _get(_get(r, 'signals', {}), 'npm_version', {});
        const sObj = _asObject(signal);
        if (sObj && 'error' in sObj) {
            lines.push(`| \`${_str(_get(r, 'snapshot_at', '?'))}\` | _(error)_ | _(error)_ |`);
        } else {
            const latest = _get(signal, 'latest', '?');
            const count = _get(signal, 'version_count', 0);
            lines.push(`| \`${_str(_get(r, 'snapshot_at', '?'))}\` | \`${_str(latest)}\` | ${_str(count)} |`);
        }
    }
    return render_section('npm version distribution', lines);
}

export function render_github_stars(rows: JsonObject[]): string {
    const lines: string[] = [];
    lines.push('| Snapshot | Stars | Forks | Watchers |');
    lines.push('|---|---:|---:|---:|');
    for (const r of rows) {
        const signal = _get(_get(r, 'signals', {}), 'github_stars', {});
        const sObj = _asObject(signal);
        if (sObj && 'error' in sObj) {
            lines.push(`| \`${_str(_get(r, 'snapshot_at', '?'))}\` | _(error)_ | _(error)_ | _(error)_ |`);
        } else {
            lines.push(
                `| \`${_str(_get(r, 'snapshot_at', '?'))}\` | ` +
                    `${_comma(_get(signal, 'stars', 0))} | ` +
                    `${_comma(_get(signal, 'forks', 0))} | ` +
                    `${_comma(_get(signal, 'watchers', 0))} |`,
            );
        }
    }
    return render_section('GitHub stars / forks / watchers', lines);
}

export function render_topic_rank(rows: JsonObject[]): string {
    const lines: string[] = [];
    lines.push('| Snapshot | `agent-skills` rank | `cinematic-ai-video` rank |');
    lines.push('|---|---:|---:|');
    for (const r of rows) {
        const signal = _get(_get(r, 'signals', {}), 'topic_rank', {});
        const asBlock = _get(signal, 'agent-skills', {});
        const cavBlock = _get(signal, 'cinematic-ai-video', {});
        const asObj = _asObject(asBlock);
        const cavObj = _asObject(cavBlock);
        // "_(error)_" if "error" in block else (block.get("rank") or "—")
        const asRank = asObj && 'error' in asObj
            ? '_(error)_'
            : _pyOr(_get(asBlock, 'rank', undefined), '—');
        const cavRank = cavObj && 'error' in cavObj
            ? '_(error)_'
            : _pyOr(_get(cavBlock, 'rank', undefined), '—');
        lines.push(`| \`${_str(_get(r, 'snapshot_at', '?'))}\` | ${asRank} | ${cavRank} |`);
    }
    return render_section('Topic-search rank (`agent-skills` + `cinematic-ai-video`)', lines);
}

/** Mirror Python `a or b`: return string form of `a` when truthy, else of `b`. */
function _pyOr(a: Json, b: Json): string {
    return _pyTruthy(a) ? _str(a) : _str(b);
}

function _pyTruthy(v: Json): boolean {
    if (v === undefined || v === null || v === false || v === '' || v === 0) {
        return false;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v as object).length > 0;
    }
    return Boolean(v);
}

export function render_report(rows: JsonObject[], weeks: number): string {
    let header =
        '# Adoption report — rolling trend\n\n' +
        '> Generated by `scripts/adoption_report.py` from ' +
        '`agents/runtime/metrics/adoption-snapshots.jsonl`.\n' +
        `> Window: rolling ${weeks} weeks. Source contract: ` +
        '`docs/contracts/adoption-signal-floor.md`.\n\n';
    if (rows.length === 0) {
        header +=
            '_No snapshots in the current window — run `python3 scripts/adoption_snapshot.py` ' +
            '(scheduled weekly via the cron in `.github/workflows/`) to populate the trend._\n';
        return header;
    }
    return (
        header +
        render_npm_downloads(rows) +
        render_npm_version(rows) +
        render_github_stars(rows) +
        render_topic_rank(rows)
    );
}

export interface ParsedArgs {
    in_path: string;
    out: string;
    weeks: number;
}

export function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { in_path: DEFAULT_IN, out: DEFAULT_OUT, weeks: 8 };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const takeValue = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                return a.slice(eq + 1);
            }
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(`adoption_report: error: argument ${flag}: expected one argument\n`);
                process.exit(2);
            }
            i += 1;
            return next;
        };
        if (a === '--in' || a.startsWith('--in=')) {
            out.in_path = takeValue('--in');
        } else if (a === '--out' || a.startsWith('--out=')) {
            out.out = takeValue('--out');
        } else if (a === '--weeks' || a.startsWith('--weeks=')) {
            out.weeks = parseInt(takeValue('--weeks'), 10);
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: adoption_report [-h] [--in IN_PATH] [--out OUT] [--weeks WEEKS]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    let rows: JsonObject[];
    try {
        rows = parse_jsonl(args.in_path);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`error: failed to read ${args.in_path}: ${msg}\n`);
        return 1;
    }
    rows = filter_window(rows, args.weeks);
    // rows.sort(key=lambda r: r.get("snapshot_at", "")) — stable, lexicographic.
    rows = _stableSortByKey(rows, (r) => _str(_get(r, 'snapshot_at', '')));
    const report = render_report(rows, args.weeks);
    try {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, report, 'utf-8');
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`error: failed to write ${args.out}: ${msg}\n`);
        return 1;
    }
    process.stdout.write(`adoption_report: wrote ${args.out} (${rows.length} snapshot(s))\n`);
    return 0;
}

/** Stable sort by a string key, mirroring Python's stable `list.sort`. */
function _stableSortByKey(rows: JsonObject[], key: (r: JsonObject) => string): JsonObject[] {
    return rows
        .map((r, idx) => ({ r, idx, k: key(r) }))
        .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.idx - b.idx))
        .map((x) => x.r);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
