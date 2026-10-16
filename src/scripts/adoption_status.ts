#!/usr/bin/env node
/**
 * One-screen adoption dashboard for the maintainer's weekly review.
 *
 * Ported from the retired Python `src/scripts/adoption_status.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8a). The CLI contract is mirrored
 * EXACTLY: same flags (`--json`, `--branch`), same exit codes (0 normal,
 * 1 on registry-read IO error), same byte-identical text + JSON output,
 * same `ci_status` shell-out (now the `.ts` twin run via `tsx` — no
 * python3), same `unknown` best-effort fallbacks. No behaviour
 * changes — historical quirks preserved (consumers pin the exact behaviour).
 *
 * Prints three things in one short block:
 *
 *   1. Registry-submission status — counts per status from
 *      `docs/distribution/registry-submissions.md`.
 *   2. Recruit-session report count — files matching
 *      `agents/recruit-sessions/[0-9]*.md` (excludes template / runbook /
 *      findings).
 *   3. Latest required-check colour on `main` — shells out to
 *      `scripts/ci_status.ts` (zero-cost; per-shape required set).
 *
 * CLI:
 *
 *   ./scripts-run src/scripts/adoption_status [--json] [--branch main] [--check-upstream]
 *
 * `--check-upstream` reads each ledger row's upstream (`gh pr view` for a pull
 * request, one `curl` for a listing page or registry query) and appends what it
 * found. Without the flag nothing touches the network: stdout is the sheet-only
 * report exactly as before, and stderr names that mode plus every row whose
 * `Last read` date is missing or older than the sheet's re-read threshold.
 *
 * Exit codes:
 *
 *   0 — printed successfully (status itself does not gate the exit).
 *   1 — IO error reading the registry-submissions sheet.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { sanitize_text } from './_lib/retrieval_sanitize.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/adoption_status.ts → parents[2] is the repo root (mirrors
// `Path(__file__).resolve().parent.parent.parent` in the .py).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REGISTRY_DOC = path.join(REPO_ROOT, 'docs', 'distribution', 'registry-submissions.md');
const RECRUIT_DIR = path.join(REPO_ROOT, 'agents', 'recruit-sessions');

export const STATUS_VALUES = [
    'pending',
    'submitted',
    'accepted',
    'rejected',
    'stalled',
] as const;

export type StatusCounts = Record<string, number>;

/**
 * Parse the `Tracking rows` table; return counts per status value.
 * Mirrors `parse_registry_statuses`.
 */
export function parse_registry_statuses(text: string): StatusCounts {
    const counts: StatusCounts = {};
    for (const s of STATUS_VALUES) {
        counts[s] = 0;
    }
    let inTable = false;
    // Python `str.splitlines()` semantics: split on universal newlines, no
    // trailing empty element. JS `split(/\r\n|\r|\n/)` would keep a trailing
    // empty; emulate splitlines by dropping a single trailing newline group.
    for (const line of _splitlines(text)) {
        if (line.startsWith('## Tracking rows')) {
            inTable = true;
            continue;
        }
        if (inTable && line.startsWith('## ')) {
            break;
        }
        if (!inTable) {
            continue;
        }
        if (!line.startsWith('|')) {
            continue;
        }
        // Python: `[c.strip() for c in line.split("|")[1:-1]]`.
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        if (cells.length < 4) {
            continue;
        }
        // Header / separator rows have the literal "Registry" or "---".
        if (
            cells[0] === '#' ||
            cells[0] === '---' ||
            cells[1] === 'Registry' ||
            cells[1] === '---'
        ) {
            continue;
        }
        const statusCell = _pyStripChar(cells[3] as string, '`');
        if (statusCell in counts) {
            counts[statusCell] = (counts[statusCell] as number) + 1;
        }
    }
    return counts;
}

/**
 * Count files matching `<NN>-<role>.md` under recruit-sessions/.
 * Mirrors `count_recruit_reports`.
 */
export function count_recruit_reports(reportsDir: string): number {
    if (!_exists(reportsDir)) {
        return 0;
    }
    const pattern = /^\d{2}-[a-z][a-z0-9-]*\.md$/;
    let names: string[];
    try {
        names = fs.readdirSync(reportsDir);
    } catch {
        return 0;
    }
    let n = 0;
    for (const name of names) {
        const p = path.join(reportsDir, name);
        if (_isFile(p) && pattern.test(name)) {
            n += 1;
        }
    }
    return n;
}

/**
 * Shell out to `scripts/ci_status.ts --json` to find the required-set
 * color. Mirrors `ci_status_color`. Returns `[color, summary]`.
 */
export function ci_status_color(branch: string): [string, string] {
    const script = path.join(REPO_ROOT, 'src', 'scripts', 'ci_status.ts');
    if (!_exists(script)) {
        return ['unknown', 'ci_status.ts not present — Phase A Step 6 not landed'];
    }
    if (_which('gh') === null) {
        return ['unknown', 'gh CLI not on PATH — cannot probe required-check set'];
    }
    // Run the `.ts` twin through the repo-local `tsx` binary — no python3.
    const tsxBin = path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );
    let proc;
    try {
        proc = spawnSync(
            tsxBin,
            [script, '--branch', branch, '--json', '--no-phantom-resolve'],
            { encoding: 'utf8', timeout: 15_000 },
        );
    } catch {
        return ['unknown', `ci_status.ts timed out probing branch ${branch}`];
    }
    // Node surfaces a timeout as an error on the result, not a throw.
    if (proc.error && (proc.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
        return ['unknown', `ci_status.ts timed out probing branch ${branch}`];
    }
    if (proc.signal === 'SIGTERM') {
        return ['unknown', `ci_status.ts timed out probing branch ${branch}`];
    }
    const returncode = proc.status;
    if (returncode !== 0 && returncode !== 1) {
        const stderrSnip = _pyStrip(proc.stderr ?? '').slice(0, 80);
        return ['unknown', `ci_status.ts exit=${returncode}: ${stderrSnip}`];
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(proc.stdout || '{}') as Record<string, unknown>;
    } catch {
        return ['unknown', 'ci_status.ts output not parseable as JSON'];
    }
    const red = data.red;
    if (_pyTruthy(red)) {
        return ['red', `${(red as unknown[]).length} required check(s) red`];
    }
    const missing = data.missing;
    if (_pyTruthy(missing)) {
        return ['amber', `${(missing as unknown[]).length} check(s) missing on ${branch}`];
    }
    const green = Array.isArray(data.green) ? data.green : [];
    return ['green', `${green.length} required check(s) green`];
}

const _COLOR_EMOJI: Record<string, string> = {
    green: '🟢',
    amber: '🟡',
    red: '🔴',
    unknown: '⚪',
};

/** Mirrors `render_text`. */
export function render_text(
    registryCounts: StatusCounts,
    reports: number,
    ci: [string, string],
    branch: string,
): string {
    const lines: string[] = [];
    lines.push('Adoption status (one-screen)');
    lines.push('============================');
    lines.push('');
    lines.push('Registry submissions:');
    for (const status of STATUS_VALUES) {
        // Python: f"  {status:10} {registry_counts[status]}" — left-justify 10.
        lines.push(`  ${status.padEnd(10)} ${registryCounts[status]}`);
    }
    lines.push('');
    lines.push(`Recruit-session reports filed: ${reports}`);
    lines.push('');
    lines.push(
        `Required-check status on ${branch}: ${_COLOR_EMOJI[ci[0]]} ${ci[0]} — ${ci[1]}`,
    );
    return lines.join('\n');
}

/** Mirrors `render_json` (json.dumps(..., indent=2)). */
export function render_json(
    registryCounts: StatusCounts,
    reports: number,
    ci: [string, string],
    branch: string,
): string {
    return _pyJsonDumpsIndent2({
        registries: registryCounts,
        recruit_reports: reports,
        ci: { branch, color: ci[0], summary: ci[1] },
    });
}

interface Args {
    json: boolean;
    branch: string;
    checkUpstream: boolean;
}

export function parse_args(argv: string[]): Args {
    let json = false;
    let branch = 'main';
    let checkUpstream = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') {
            json = true;
        } else if (a === '--check-upstream') {
            checkUpstream = true;
        } else if (a === '--branch') {
            branch = argv[++i] ?? '';
        } else if (a !== undefined && a.startsWith('--branch=')) {
            branch = a.slice('--branch='.length);
        }
    }
    return { json, branch, checkUpstream };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);

    let registryText: string;
    try {
        registryText = fs.readFileSync(REGISTRY_DOC, 'utf-8');
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`error: failed to read ${REGISTRY_DOC}: ${msg}\n`);
        return 1;
    }
    const registryCounts = parse_registry_statuses(registryText);
    const reports = count_recruit_reports(RECRUIT_DIR);
    const ci = ci_status_color(args.branch);

    const rows = parse_ledger_rows(registryText);
    const today = _todayUtc();
    const unread = unread_findings(rows, today, parse_reread_threshold(registryText));

    if (!args.checkUpstream) {
        if (args.json) {
            process.stdout.write(render_json(registryCounts, reports, ci, args.branch) + '\n');
        } else {
            process.stdout.write(render_text(registryCounts, reports, ci, args.branch) + '\n');
        }
        process.stderr.write(upstream_mode_note(false) + '\n');
        for (const u of unread) {
            process.stderr.write(`  row ${u.id} ${u.registry}: ${u.label}\n`);
        }
        return 0;
    }

    const verdicts = judge_upstream(rows, live_upstream_reader, today);
    if (args.json) {
        const base = JSON.parse(render_json(registryCounts, reports, ci, args.branch)) as Record<
            string,
            unknown
        >;
        base.upstream = { mode: _modeOf(verdicts), verdicts, unread };
        process.stdout.write(_pyJsonDumpsIndent2(base) + '\n');
    } else {
        process.stdout.write(render_text(registryCounts, reports, ci, args.branch) + '\n');
        process.stdout.write(render_upstream_text(verdicts, unread) + '\n');
    }
    return 0;
}

// --- upstream reading --------------------------------------------------------

/** One row of the `Tracking rows` table, keyed by header name, not position. */
export interface LedgerRow {
    id: string;
    registry: string;
    status: string;
    kind: string;
    ref: string;
    lastRead: string;
    date: string;
}

export type UpstreamReading =
    | { ok: true; state: 'open' | 'closed' | 'merged' | 'listed' | 'not-listed'; at?: string }
    | { ok: false; reason: string };

export type UpstreamReader = (row: LedgerRow) => UpstreamReading;

export type UpstreamVerdict =
    | 'answered-closed'
    | 'answered-merged'
    | 'stalled'
    | 'open'
    | 'listed'
    | 'not-listed'
    | 'unreachable'
    | 'no-upstream';

export interface RowVerdict {
    id: string;
    registry: string;
    verdict: UpstreamVerdict;
    detail: string;
}

export interface UnreadFinding {
    id: string;
    registry: string;
    label: string;
}

/** Same threshold the sheet's legend states for `stalled`. */
export const STALLED_AFTER_DAYS = 60;
const DEFAULT_REREAD_THRESHOLD_DAYS = 30;

function _cellValue(cell: string): string {
    const v = cell.trim().replace(/`/g, '');
    const link = /^<(.+)>$/.exec(v);
    const out = link ? (link[1] as string) : v;
    return out === '—' || out === '-' ? '' : out;
}

/**
 * Parse the `Tracking rows` table by its header names, so a sheet that lacks a
 * column yields empty fields rather than a misread neighbour.
 */
export function parse_ledger_rows(text: string): LedgerRow[] {
    const rows: LedgerRow[] = [];
    let inTable = false;
    let header: string[] | null = null;
    for (const line of _splitlines(text)) {
        if (line.startsWith('## Tracking rows')) {
            inTable = true;
            continue;
        }
        if (inTable && line.startsWith('## ')) {
            break;
        }
        if (!inTable || !line.startsWith('|')) {
            continue;
        }
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        if (header === null) {
            header = cells.map((c) => c.toLowerCase());
            continue;
        }
        if (cells.every((c) => /^-+$/.test(c))) {
            continue;
        }
        const names = header;
        const col = (name: string): string => {
            const i = names.indexOf(name);
            return i < 0 || i >= cells.length ? '' : _cellValue(cells[i] as string);
        };
        rows.push({
            id: col('#'),
            registry: col('registry'),
            status: col('status'),
            kind: col('upstream kind'),
            ref: col('upstream ref'),
            lastRead: col('last read'),
            date: col('date'),
        });
    }
    return rows;
}

/** The sheet states its own re-read threshold as `**Re-read threshold:** N days`. */
export function parse_reread_threshold(text: string): number {
    const m = /\*\*Re-read threshold:\*\*\s*(\d+)\s*days/.exec(text);
    return m ? Number(m[1]) : DEFAULT_REREAD_THRESHOLD_DAYS;
}

function _daysBetween(fromIso: string, toIso: string): number | null {
    const a = Date.parse(fromIso.slice(0, 10) + 'T00:00:00Z');
    const b = Date.parse(toIso.slice(0, 10) + 'T00:00:00Z');
    if (Number.isNaN(a) || Number.isNaN(b)) {
        return null;
    }
    return Math.round((b - a) / 86_400_000);
}

/** A row never read, or read longer ago than the threshold, is a finding. */
export function unread_findings(
    rows: LedgerRow[],
    today: string,
    thresholdDays: number,
): UnreadFinding[] {
    const out: UnreadFinding[] = [];
    for (const row of rows) {
        const age = row.lastRead === '' ? null : _daysBetween(row.lastRead, today);
        if (age === null) {
            out.push({ id: row.id, registry: row.registry, label: 'unread-never' });
        } else if (age > thresholdDays) {
            out.push({ id: row.id, registry: row.registry, label: `unread-for-${age}-days` });
        }
    }
    return out;
}

/**
 * `stalled` keeps its old meaning — submitted, no answer, 60 days — but is
 * reachable only when the reading says the upstream is still open, so an
 * answered row can no longer hide behind the date arithmetic.
 */
export function judge_upstream(
    rows: LedgerRow[],
    reader: UpstreamReader,
    today: string,
): RowVerdict[] {
    return rows.map((row): RowVerdict => {
        const base = { id: row.id, registry: row.registry };
        if (row.kind === '' || row.ref === '') {
            return { ...base, verdict: 'no-upstream', detail: 'the row names no upstream to read' };
        }
        const r = reader(row);
        if (!r.ok) {
            return { ...base, verdict: 'unreachable', detail: r.reason };
        }
        switch (r.state) {
            case 'closed':
                return { ...base, verdict: 'answered-closed', detail: `closed ${r.at ?? 'date unknown'}` };
            case 'merged':
                return { ...base, verdict: 'answered-merged', detail: `merged ${r.at ?? 'date unknown'}` };
            case 'listed':
            case 'not-listed':
                return { ...base, verdict: r.state, detail: row.ref };
            case 'open': {
                const age = row.date === '' ? null : _daysBetween(row.date, today);
                if (row.status === 'submitted' && age !== null && age >= STALLED_AFTER_DAYS) {
                    return { ...base, verdict: 'stalled', detail: `open ${age} days, no answer` };
                }
                return { ...base, verdict: 'open', detail: age === null ? 'open' : `open ${age} days` };
            }
        }
    });
}

export function upstream_mode_note(checked: boolean): string {
    return checked
        ? 'upstream: read live (--check-upstream)'
        : 'upstream: not read — reporting from the sheet only; pass --check-upstream for live state';
}

function _modeOf(verdicts: RowVerdict[]): string {
    const readable = verdicts.filter((v) => v.verdict !== 'no-upstream');
    if (readable.length > 0 && readable.every((v) => v.verdict === 'unreachable')) {
        return 'degraded — no upstream could be read; the sheet above is the only source';
    }
    return 'live';
}

export function render_upstream_text(verdicts: RowVerdict[], unread: UnreadFinding[]): string {
    const lines: string[] = ['', `Upstream readings (${_modeOf(verdicts)}):`];
    for (const v of verdicts) {
        lines.push(`  row ${v.id.padEnd(3)} ${v.verdict.padEnd(16)} ${v.registry} — ${v.detail}`);
    }
    lines.push('');
    lines.push(
        unread.length === 0
            ? 'Ledger readings: all within the re-read threshold'
            : 'Ledger readings out of date:',
    );
    for (const u of unread) {
        lines.push(`  row ${u.id.padEnd(3)} ${u.label} ${u.registry}`);
    }
    return lines.join('\n');
}

function _readPullRequest(ref: string): UpstreamReading {
    const m = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(ref);
    if (!m) {
        return { ok: false, reason: `unparseable pull-request ref ${ref}` };
    }
    if (_which('gh') === null) {
        return { ok: false, reason: 'gh CLI not on PATH' };
    }
    const proc = spawnSync(
        'gh',
        ['pr', 'view', m[2] as string, '--repo', m[1] as string, '--json', 'state,closedAt,mergedAt'],
        { encoding: 'utf8', timeout: 20_000 },
    );
    if (proc.status !== 0) {
        const snip = sanitize_text(_pyStrip(proc.stderr ?? '')).slice(0, 80);
        return { ok: false, reason: `gh exit=${proc.status}: ${snip}` };
    }
    let d: { state?: string; closedAt?: string; mergedAt?: string };
    try {
        d = JSON.parse(proc.stdout) as typeof d;
    } catch {
        return { ok: false, reason: 'gh output not parseable as JSON' };
    }
    if (d.state === 'MERGED') return { ok: true, state: 'merged', at: sanitize_text(d.mergedAt ?? '').slice(0, 10) };
    if (d.state === 'CLOSED') return { ok: true, state: 'closed', at: sanitize_text(d.closedAt ?? '').slice(0, 10) };
    if (d.state === 'OPEN') return { ok: true, state: 'open' };
    return { ok: false, reason: `unknown pull-request state ${sanitize_text(String(d.state)).slice(0, 40)}` };
}

function _readUrl(kind: string, ref: string): UpstreamReading {
    if (_which('curl') === null) {
        return { ok: false, reason: 'curl not on PATH' };
    }
    const proc = spawnSync('curl', ['-sL', '--max-time', '20', '-w', '\n%{http_code}', ref], {
        encoding: 'utf8',
        timeout: 25_000,
    });
    const out = proc.stdout ?? '';
    const cut = out.lastIndexOf('\n');
    const code = out.slice(cut + 1).trim();
    if (proc.status !== 0 || code === '000' || code === '') {
        return { ok: false, reason: `no response from ${ref}` };
    }
    if (kind === 'listing-page') {
        if (code === '200') return { ok: true, state: 'listed' };
        if (code === '404') return { ok: true, state: 'not-listed' };
        return { ok: false, reason: `HTTP ${code} from ${ref}` };
    }
    let body: { metadata?: { count?: unknown } };
    try {
        body = JSON.parse(out.slice(0, cut)) as typeof body;
    } catch {
        return { ok: false, reason: `registry answer from ${ref} not parseable as JSON` };
    }
    const n = body.metadata?.count;
    if (typeof n !== 'number') {
        return { ok: false, reason: 'registry answer has no metadata.count' };
    }
    return { ok: true, state: n > 0 ? 'listed' : 'not-listed' };
}

/** Reads the real upstream: `gh` for a pull request, `curl` otherwise. */
export const live_upstream_reader: UpstreamReader = (row) => {
    if (row.kind === 'github-pr') {
        return _readPullRequest(row.ref);
    }
    if (row.kind === 'listing-page' || row.kind === 'registry-query') {
        return _readUrl(row.kind, row.ref);
    }
    return { ok: false, reason: `no reader for upstream kind ${row.kind}` };
};

function _todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
}

// --- helpers -----------------------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _which(cmd: string): string | null {
    const pathVar = process.env.PATH ?? '';
    const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '').split(';') : [''];
    for (const dir of pathVar.split(path.delimiter)) {
        if (!dir) continue;
        for (const ext of exts) {
            const candidate = path.join(dir, cmd + ext);
            try {
                fs.accessSync(candidate, fs.constants.X_OK);
                return candidate;
            } catch {
                // not executable here
            }
        }
    }
    return null;
}

/** Python `str.splitlines()` — universal newlines, no trailing empty element. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        if (ch === '\n' || ch === '\r') {
            out.push(cur);
            cur = '';
            if (ch === '\r' && text[i + 1] === '\n') {
                i += 1;
            }
        } else {
            cur += ch;
        }
    }
    if (cur !== '') {
        out.push(cur);
    }
    return out;
}

/** Python `str.strip(ch)` for a single strip char (used for backtick). */
function _pyStripChar(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) start += 1;
    while (end > start && s[end - 1] === ch) end -= 1;
    return s.slice(start, end);
}

/** Python `str.strip()` (default whitespace) for the stderr snippet. */
function _pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/**
 * Mirror `json.dumps(obj, indent=2)` for the limited value shapes here
 * (string keys, numbers, strings, nested plain objects). `indent=2` →
 * item separator is `,` and key separator `: `; ensure_ascii defaults to
 * True, but every value here is ASCII, so this matches.
 */
function _pyJsonDumpsIndent2(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
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

/** Mirror json.dumps string escaping (ensure_ascii=True default). */
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
            // Astral → surrogate pair, matching CPython's json.
            const v = code - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
