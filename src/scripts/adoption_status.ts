#!/usr/bin/env node
/**
 * One-screen adoption dashboard for the maintainer's weekly review.
 *
 * TypeScript twin of `src/scripts/adoption_status.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8a). The CLI contract is mirrored
 * EXACTLY: same flags (`--json`, `--branch`), same exit codes (0 normal,
 * 1 on registry-read IO error), same byte-identical text + JSON output,
 * same `ci_status.py` shell-out (still the Python script — it has not
 * been ported), same `unknown` best-effort fallbacks. No behaviour
 * changes — latent bugs replicated.
 *
 * Prints three things in one short block:
 *
 *   1. Registry-submission status — counts per status from
 *      `docs/distribution/registry-submissions.md`.
 *   2. Recruit-session report count — files matching
 *      `agents/recruit-sessions/[0-9]*.md` (excludes template / runbook /
 *      findings).
 *   3. Latest required-check colour on `main` — shells out to
 *      `scripts/ci_status.py` (zero-cost; per-shape required set).
 *
 * CLI:
 *
 *   ./scripts-run src/scripts/adoption_status [--json] [--branch main]
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
 * Shell out to `scripts/ci_status.py --json` to find the required-set
 * color. Mirrors `ci_status_color`. Returns `[color, summary]`.
 */
export function ci_status_color(branch: string): [string, string] {
    const script = path.join(REPO_ROOT, 'src', 'scripts', 'ci_status.py');
    if (!_exists(script)) {
        return ['unknown', 'ci_status.py not present — Phase A Step 6 not landed'];
    }
    if (_which('gh') === null) {
        return ['unknown', 'gh CLI not on PATH — cannot probe required-check set'];
    }
    let proc;
    try {
        proc = spawnSync(
            'python3',
            [script, '--branch', branch, '--json', '--no-phantom-resolve'],
            { encoding: 'utf8', timeout: 15_000 },
        );
    } catch {
        return ['unknown', `ci_status.py timed out probing branch ${branch}`];
    }
    // Node surfaces a timeout as an error on the result, not a throw.
    if (proc.error && (proc.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
        return ['unknown', `ci_status.py timed out probing branch ${branch}`];
    }
    if (proc.signal === 'SIGTERM') {
        return ['unknown', `ci_status.py timed out probing branch ${branch}`];
    }
    const returncode = proc.status;
    if (returncode !== 0 && returncode !== 1) {
        const stderrSnip = _pyStrip(proc.stderr ?? '').slice(0, 80);
        return ['unknown', `ci_status.py exit=${returncode}: ${stderrSnip}`];
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(proc.stdout || '{}') as Record<string, unknown>;
    } catch {
        return ['unknown', 'ci_status.py output not parseable as JSON'];
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
}

export function parse_args(argv: string[]): Args {
    let json = false;
    let branch = 'main';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') {
            json = true;
        } else if (a === '--branch') {
            branch = argv[++i] ?? '';
        } else if (a !== undefined && a.startsWith('--branch=')) {
            branch = a.slice('--branch='.length);
        }
    }
    return { json, branch };
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

    if (args.json) {
        process.stdout.write(render_json(registryCounts, reports, ci, args.branch) + '\n');
    } else {
        process.stdout.write(render_text(registryCounts, reports, ci, args.branch) + '\n');
    }
    return 0;
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

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
