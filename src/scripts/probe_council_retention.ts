#!/usr/bin/env tsx
/**
 * Read-only probe: is the declared council-artefact TTL actually honoured?
 *
 * `ai_council.session_retention_days` (default 7 — `ai_council/session.ts:81`)
 * declares a retention window for the three council artefact directories:
 *
 *   agents/runtime/council/questions/
 *   agents/runtime/council/responses/
 *   agents/runtime/council/sessions/
 *
 * Every pruner in the tree that could enforce that window is reached only by an
 * explicit human command:
 *
 *   - `prune_all_council_artifacts` (`ai_council/session.ts:468`) has exactly
 *     one caller in `src/`, the manual CLI `council_prune.ts:131`, which is
 *     bound to `task council-prune` and to no hook, workflow or scheduler.
 *   - `save()` (`ai_council/session.ts:506`), the only function that calls
 *     `prune_old_artifacts(QUESTIONS_DIR, …)` / `(RESPONSES_DIR, …)`
 *     (`:603-604`), has no caller in `src/` at all — `council_cli.ts` writes its
 *     own `--output` payload directly (`council_cli.ts:2807`) and never imports
 *     the session module.
 *   - `janitor.ts` declares `agents/runtime/council/responses` with
 *     `ttlDays: 7` (`janitor.ts:55-61`) but defaults to a dry-run report;
 *     deletion needs `--apply` (`janitor.ts:12-14`, `:329`), and it declares no
 *     entry for `questions/` or `sessions/` at all.
 *
 * So the TTL is a declaration, not a mechanism, and the retained corpus is
 * "every artefact nobody deleted by hand". This probe measures that gap instead
 * of asserting it: it reports how much of the corpus is past its declared TTL,
 * and how much provider-attributed response text that over-TTL slice holds.
 *
 * THIS SCRIPT NEVER WRITES, UNLINKS, MOVES, TRUNCATES, OR MUTATES ANYTHING.
 * It opens files for reading only. There is no `--apply`, no `--fix`, and no
 * code path that calls a mutating `fs` function. The corpus is the measurement
 * subject; destroying it would destroy the instrument.
 *
 * Usage:
 *   ./scripts-run src/scripts/probe_council_retention
 *   ./scripts-run src/scripts/probe_council_retention --root /path/to/project
 *   ./scripts-run src/scripts/probe_council_retention --retention-days 7 --json
 *
 * Exit code: 0 always. This is a report, never a gate — an over-TTL corpus is
 * the finding, not a build failure.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_project_root } from './_lib/agent_settings.js';

const _HERE = fileURLToPath(import.meta.url);

const PROG = 'probe_council_retention';

/** The three canonical council dirs, relative to the project root. */
const COUNCIL_DIRS: readonly string[] = ['responses', 'sessions', 'questions'];

/** Mirrors `DEFAULT_RETENTION_DAYS` (`ai_council/session.ts:81`). */
const DEFAULT_RETENTION_DAYS = 7;

const MS_PER_DAY = 86_400_000;

const _USAGE = `usage: ${PROG} [-h] [--root PATH] [--retention-days N] [--json]`;

const _HELP =
    `${_USAGE}\n\n` +
    'Read-only report on whether the declared council-artefact TTL is honoured.\n' +
    'Never deletes or modifies anything.\n\n' +
    'options:\n' +
    '  -h, --help           show this help message and exit\n' +
    '  --root PATH          project root to probe (default: resolved like sibling scripts)\n' +
    `  --retention-days N   TTL in days (default: ${String(DEFAULT_RETENTION_DAYS)})\n` +
    '  --json               emit the report as JSON instead of text\n';

interface Args {
    root: string | null;
    retention_days: number;
    json: boolean;
    help: boolean;
}

/** One TTL-split pair of counts. */
interface Split {
    within_ttl: number;
    over_ttl: number;
}

interface DirReport {
    /** Directory label (`responses` / `sessions` / `questions`). */
    dir: string;
    /** Absolute path probed. */
    abs_path: string;
    /** Whether the directory exists at all. */
    exists: boolean;
    /** Files found, recursively. */
    files: number;
    /** Files split by mtime against the TTL cutoff. */
    files_split: Split;
    /** JSON files carrying a `responses[]` array. */
    json_with_responses: number;
    /** Files that look like JSON but would not parse. */
    unparseable: number;
    /** Provider-attributed response bodies (provider + text, no error). */
    attributed_bodies: number;
    /** Attributed bodies split by their SOURCE FILE's mtime against the TTL. */
    attributed_split: Split;
    /** Attributed bodies per provider. */
    by_provider: Record<string, number>;
    /** Attributed bodies per provider, over-TTL only. */
    by_provider_over_ttl: Record<string, number>;
    /** Age in days of the oldest file found, or `null` when the dir is empty. */
    oldest_age_days: number | null;
}

interface Report {
    root: string;
    root_origin: string;
    retention_days: number;
    generated_at_utc: string;
    dirs: DirReport[];
    totals: {
        files: number;
        files_over_ttl: number;
        attributed_bodies: number;
        attributed_bodies_over_ttl: number;
        unparseable: number;
        oldest_age_days: number | null;
    };
    /** `true` when nothing at all is past the declared window. */
    ttl_honoured: boolean;
}

function _argError(message: string): never {
    process.stderr.write(`${_USAGE}\n`);
    process.stderr.write(`${PROG}: error: ${message}\n`);
    // A malformed invocation is still not a gate failure for the caller's
    // build, but it must not print a report that means nothing.
    process.exitCode = 2;
    throw new _ExitSignal(2);
}

class _ExitSignal extends Error {
    constructor(readonly code: number) {
        super(`exit ${code}`);
    }
}

function _parseArgs(argv: readonly string[]): Args {
    const args: Args = {
        root: null,
        retention_days: DEFAULT_RETENTION_DAYS,
        json: false,
        help: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            args.help = true;
        } else if (a === '--json') {
            args.json = true;
        } else if (a === '--root') {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('-')) {
                _argError('argument --root: expected one argument');
            }
            args.root = v;
            i += 1;
        } else if (a === '--retention-days') {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('-')) {
                _argError('argument --retention-days: expected one argument');
            }
            const parsed = Number.parseInt(v, 10);
            if (!Number.isFinite(parsed) || String(parsed) !== v.trim() || parsed < 0) {
                _argError(`argument --retention-days: invalid non-negative int value: '${v}'`);
            }
            args.retention_days = parsed;
            i += 1;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Every FILE under `dir`, recursively, sorted for a stable report.
 *
 * Recursive rather than a flat `readdirSync`: `responses/` holds per-debate
 * subdirectories (`<slug>.json/debate-round-N.json`), and a flat listing counts
 * one entry where the corpus holds several artefacts.
 */
function _walkFiles(dir: string): string[] {
    const out: string[] = [];
    if (!_isDir(dir)) {
        return out;
    }
    let entries: string[];
    try {
        entries = fs.readdirSync(dir).sort();
    } catch {
        return out;
    }
    for (const name of entries) {
        const full = path.join(dir, name);
        let st: fs.Stats;
        try {
            st = fs.statSync(full);
        } catch {
            continue;
        }
        if (st.isFile()) {
            out.push(full);
        } else if (st.isDirectory()) {
            out.push(..._walkFiles(full));
        }
    }
    return out;
}

function _mtimeMs(p: string): number | null {
    try {
        return fs.statSync(p).mtimeMs;
    } catch {
        return null;
    }
}

function _bump(map: Record<string, number>, key: string): void {
    map[key] = (map[key] ?? 0) + 1;
}

/**
 * A response body counts as provider-attributed when it names a provider,
 * carries text, and records no error — the shape `recouncil_guard` and the
 * leakage assembler both treat as real captured provider output.
 */
function _isAttributed(entry: unknown): { attributed: boolean; provider: string } {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        return { attributed: false, provider: '' };
    }
    const rec = entry as Record<string, unknown>;
    const provider = typeof rec['provider'] === 'string' ? rec['provider'].trim() : '';
    const text = typeof rec['text'] === 'string' ? rec['text'] : '';
    const error = rec['error'];
    const hasError = error !== null && error !== undefined && error !== '' && error !== false;
    if (provider === '' || text.trim() === '' || hasError) {
        return { attributed: false, provider };
    }
    return { attributed: true, provider };
}

function probeDir(root: string, label: string, cutoffMs: number, nowMs: number): DirReport {
    const abs = path.join(root, 'agents', 'runtime', 'council', label);
    const report: DirReport = {
        dir: label,
        abs_path: abs,
        exists: _isDir(abs),
        files: 0,
        files_split: { within_ttl: 0, over_ttl: 0 },
        json_with_responses: 0,
        unparseable: 0,
        attributed_bodies: 0,
        attributed_split: { within_ttl: 0, over_ttl: 0 },
        by_provider: {},
        by_provider_over_ttl: {},
        oldest_age_days: null,
    };
    if (!report.exists) {
        return report;
    }
    const files = _walkFiles(abs);
    report.files = files.length;
    let oldestMs: number | null = null;
    for (const f of files) {
        const mtime = _mtimeMs(f);
        const overTtl = mtime !== null && mtime < cutoffMs;
        if (overTtl) {
            report.files_split.over_ttl += 1;
        } else {
            report.files_split.within_ttl += 1;
        }
        if (mtime !== null && (oldestMs === null || mtime < oldestMs)) {
            oldestMs = mtime;
        }
        // Only JSON-shaped artefacts can carry a `responses[]` array. A `.md`
        // render is a sibling projection, counted as a file and nothing more.
        if (!f.endsWith('.json')) {
            continue;
        }
        let payload: unknown;
        try {
            payload = JSON.parse(fs.readFileSync(f, 'utf-8'));
        } catch {
            report.unparseable += 1;
            continue;
        }
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
            continue;
        }
        const responses = (payload as Record<string, unknown>)['responses'];
        if (!Array.isArray(responses)) {
            continue;
        }
        report.json_with_responses += 1;
        for (const entry of responses) {
            const { attributed, provider } = _isAttributed(entry);
            if (!attributed) {
                continue;
            }
            report.attributed_bodies += 1;
            _bump(report.by_provider, provider);
            if (overTtl) {
                report.attributed_split.over_ttl += 1;
                _bump(report.by_provider_over_ttl, provider);
            } else {
                report.attributed_split.within_ttl += 1;
            }
        }
    }
    if (oldestMs !== null) {
        report.oldest_age_days = Math.floor((nowMs - oldestMs) / MS_PER_DAY);
    }
    return report;
}

export function buildReport(opts: {
    root: string;
    root_origin: string;
    retention_days: number;
    now?: Date;
}): Report {
    const now = opts.now ?? new Date();
    const nowMs = now.getTime();
    const cutoffMs = nowMs - opts.retention_days * MS_PER_DAY;
    const dirs = COUNCIL_DIRS.map((label) => probeDir(opts.root, label, cutoffMs, nowMs));
    const oldest = dirs
        .map((d) => d.oldest_age_days)
        .filter((v): v is number => v !== null)
        .reduce<number | null>((acc, v) => (acc === null || v > acc ? v : acc), null);
    const totals = {
        files: dirs.reduce((s, d) => s + d.files, 0),
        files_over_ttl: dirs.reduce((s, d) => s + d.files_split.over_ttl, 0),
        attributed_bodies: dirs.reduce((s, d) => s + d.attributed_bodies, 0),
        attributed_bodies_over_ttl: dirs.reduce((s, d) => s + d.attributed_split.over_ttl, 0),
        unparseable: dirs.reduce((s, d) => s + d.unparseable, 0),
        oldest_age_days: oldest,
    };
    return {
        root: opts.root,
        root_origin: opts.root_origin,
        retention_days: opts.retention_days,
        generated_at_utc: now.toISOString(),
        dirs,
        totals,
        // A zero over-TTL count is the ONLY reading that shows the window being
        // enforced; anything else means the declaration is not a mechanism.
        ttl_honoured: totals.files_over_ttl === 0,
    };
}

function _providerLines(map: Record<string, number>, indent: string): string {
    const keys = Object.keys(map).sort((a, b) => {
        const d = (map[b] as number) - (map[a] as number);
        return d !== 0 ? d : a.localeCompare(b);
    });
    if (keys.length === 0) {
        return `${indent}(none)\n`;
    }
    return keys.map((k) => `${indent}${k.padEnd(14)} ${String(map[k])}\n`).join('');
}

export function renderReport(r: Report): string {
    const lines: string[] = [];
    lines.push(`council retention probe — read-only, nothing was deleted`);
    lines.push(`root              ${r.root} (origin: ${r.root_origin})`);
    lines.push(`retention_days    ${String(r.retention_days)}`);
    lines.push(`generated         ${r.generated_at_utc}`);
    lines.push('');
    for (const d of r.dirs) {
        lines.push(`── ${d.dir} ──`);
        if (!d.exists) {
            lines.push(`  directory absent: ${d.abs_path}`);
            lines.push('');
            continue;
        }
        lines.push(`  files                       ${String(d.files)}`);
        lines.push(
            `    within TTL / over TTL     ${String(d.files_split.within_ttl)} / ${String(d.files_split.over_ttl)}`,
        );
        lines.push(`  JSON records with responses[] ${String(d.json_with_responses)}`);
        lines.push(`  unparseable JSON            ${String(d.unparseable)}`);
        lines.push(`  provider-attributed bodies  ${String(d.attributed_bodies)}`);
        lines.push(
            `    within TTL / over TTL     ${String(d.attributed_split.within_ttl)} / ${String(d.attributed_split.over_ttl)}`,
        );
        lines.push('  by provider (all):');
        lines.push(_providerLines(d.by_provider, '    ').trimEnd());
        lines.push('  by provider (over TTL only):');
        lines.push(_providerLines(d.by_provider_over_ttl, '    ').trimEnd());
        lines.push(
            `  oldest file age (days)      ${d.oldest_age_days === null ? 'n/a' : String(d.oldest_age_days)}`,
        );
        lines.push('');
    }
    lines.push('── totals ──');
    lines.push(`  files                       ${String(r.totals.files)}`);
    lines.push(`  files over TTL              ${String(r.totals.files_over_ttl)}`);
    lines.push(`  attributed bodies           ${String(r.totals.attributed_bodies)}`);
    lines.push(`  attributed bodies over TTL  ${String(r.totals.attributed_bodies_over_ttl)}`);
    lines.push(`  unparseable JSON            ${String(r.totals.unparseable)}`);
    lines.push(
        `  oldest artefact age (days)  ${r.totals.oldest_age_days === null ? 'n/a' : String(r.totals.oldest_age_days)}`,
    );
    lines.push('');
    lines.push(
        r.ttl_honoured
            ? `TTL HONOURED — 0 artefacts are older than ${String(r.retention_days)} days.`
            : `TTL NOT HONOURED — ${String(r.totals.files_over_ttl)} of ${String(r.totals.files)} ` +
                  `artefacts are older than the declared ${String(r.retention_days)}-day window ` +
                  `(oldest ${r.totals.oldest_age_days === null ? 'n/a' : String(r.totals.oldest_age_days)} days). ` +
                  `Every pruner in the tree needs an explicit human command; nothing sweeps on its own.`,
    );
    return lines.join('\n') + '\n';
}

export function main(argv: readonly string[]): number {
    let args: Args;
    try {
        args = _parseArgs(argv);
    } catch (exc) {
        if (exc instanceof _ExitSignal) {
            // Arg errors already wrote usage + set exitCode; the report itself
            // never fails, so the caller still sees a 0-shaped contract for the
            // reporting path and a 2 only for a malformed invocation.
            return exc.code;
        }
        throw exc;
    }
    if (args.help) {
        process.stdout.write(_HELP);
        return 0;
    }
    const [root, origin] = resolve_project_root(args.root);
    const report = buildReport({
        root,
        root_origin: origin,
        retention_days: args.retention_days,
    });
    if (args.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(renderReport(report));
    }
    return 0;
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
    process.exitCode = main(process.argv.slice(2));
}

export { COUNCIL_DIRS, DEFAULT_RETENTION_DAYS, PROG };
export type { Report, DirReport, Split };
