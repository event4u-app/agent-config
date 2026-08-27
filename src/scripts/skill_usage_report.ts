#!/usr/bin/env node
/**
 * Aggregate `agents/runtime/metrics/skill-usage.jsonl` into a per-skill report,
 * plus a second section over the Class-A sink export when one is present.
 *
 * Ported from the retired Python `src/scripts/skill_usage_report.py` (ADR-200,
 * Phase 8 / Wave 8b). The public surface, CLI contract, exit code,
 * stdout text, and rendered markdown mirror the retired Python implementation EXACTLY
 * — same record grouping, same 30-day window math, same status
 * classification, same known-slug discovery roots, same sort key, same
 * byte-for-byte report body. No behaviour changes.
 *
 * `status` ∈ { active, exposed-only, dead } per:
 *   active        = mentions_30d ≥ 1
 *   exposed-only  = exposures_30d ≥ 1 ∧ mentions_30d == 0
 *   dead          = exposures_30d == 0
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
// The "existing threshold constant" the step names — the distinct-user bar the
// tier-usage re-tier already ships. Imported rather than restated so the sink
// section and the re-tier decision cannot drift to two different numbers.
import { DEFAULT_TIER_USAGE_RETIER } from '../agent-src/templates/scripts/telemetry/settings.js';
import { generatedByQuote } from './_lib/generated_by.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// parent.parent.parent of the .py file (src/scripts/skill_usage_report.py)
// is the repo root — two dirs up from src/scripts.
const REPO = path.resolve(_HERE, '..', '..');
// Both of these pointed into `agents/metrics/`, a directory the agents/
// taxonomy consolidation retired — so the report read a file that does not
// exist and wrote beside it, while the real record set sat at
// `agents/runtime/metrics/` and the tracked report at
// `agents/evidence/metrics/`. road-to-org-telemetry Phase 0 named this repair
// a Phase 4 prerequisite: adding the sink as a SECOND source lands beside a
// first source that reads nothing. Destinations follow the agents/ layout
// contract, and both match what `taskfiles/ci-fast.yml`'s own task
// descriptions already claimed this script does.
//
// OUT IS THE RUNTIME COPY, NOT THE TRACKED ONE, AND THAT IS DELIBERATE. The
// tracked `agents/evidence/metrics/skill-usage-report.md` is a promoted
// baseline snapshot the roadmap cites by its numbers. Pointing OUT at it makes
// every run in a checkout WITHOUT the gitignored record set overwrite that
// baseline with zeros — measured while writing this change: 297 insertions /
// 339 deletions, every row reclassified `dead`, from a worktree where the
// JSONL simply does not exist. A measurement that corrupts its own baseline is
// worse than no measurement. Promotion to `evidence/` stays a deliberate copy.
const IN = path.join(REPO, 'agents', 'runtime', 'metrics', 'skill-usage.jsonl');
const OUT = path.join(REPO, 'agents', 'runtime', 'metrics', 'skill-usage-report.md');

/**
 * The sink export — the SECOND source (Phase 4, step 4.1).
 *
 * Class-A records as JSONL, either an export of the org sink or one install's
 * own local `.agent-telemetry.jsonl`. Default-absent is the normal state and
 * is reported as such: `sink-choice` is transferred, so no sink exists for
 * this repository to read, and a section that silently rendered nothing would
 * be indistinguishable from a sink that answered zero — which is the exact
 * blind-zero confusion this roadmap exists to remove.
 */
const SINK_IN = path.join(REPO, 'agents', 'runtime', 'metrics', 'telemetry-class-a.jsonl');

interface Bucket {
    exposures_total: number;
    mentions_total: number;
    exposures_30d: number;
    mentions_30d: number;
    last_seen: Date | null;
}

function _newBucket(): Bucket {
    return {
        exposures_total: 0,
        mentions_total: 0,
        exposures_30d: 0,
        mentions_30d: 0,
        last_seen: null,
    };
}

/** Python-string ordering (codepoint), for `sorted(...)` parity. */
function pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Mirror `datetime.fromisoformat(raw.replace("Z", "+00:00"))` returning
 * `null` on a parse failure (Python's `ValueError` path).
 */
export function parse_ts(raw: string): Date | null {
    if (!raw) {
        return null;
    }
    const normalized = raw.replace(/Z/g, '+00:00');
    const ms = Date.parse(normalized);
    if (Number.isNaN(ms)) {
        return null;
    }
    return new Date(ms);
}

export function load_records(p: string): Array<Record<string, unknown>> {
    if (!_exists(p)) {
        return [];
    }
    const records: Array<Record<string, unknown>> = [];
    // errors="replace" — Node decodes UTF-8 lossily by default for utf-8.
    const text = fs.readFileSync(p, 'utf-8');
    for (const line of text.split('\n')) {
        if (!line.trim()) {
            continue;
        }
        try {
            records.push(JSON.parse(line) as Record<string, unknown>);
        } catch {
            continue;
        }
    }
    return records;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

export function aggregate(
    records: Array<Record<string, unknown>>,
    now: Date,
    window_days = 30,
): Map<string, Bucket> {
    const cutoff = new Date(now.getTime() - window_days * 24 * 60 * 60 * 1000);
    const per = new Map<string, Bucket>();
    for (const rec of records) {
        const slug = rec['slug'] as string | undefined;
        const kind = rec['kind'] as string | undefined;
        if (!slug || (kind !== 'exposure' && kind !== 'mention')) {
            continue;
        }
        const ts = parse_ts((rec['ts'] as string) || '');
        let bucket = per.get(slug);
        if (bucket === undefined) {
            bucket = _newBucket();
            per.set(slug, bucket);
        }
        if (kind === 'exposure') {
            bucket.exposures_total += 1;
            if (ts && ts >= cutoff) {
                bucket.exposures_30d += 1;
            }
        } else {
            bucket.mentions_total += 1;
            if (ts && ts >= cutoff) {
                bucket.mentions_30d += 1;
            }
        }
        if (ts && (bucket.last_seen === null || ts > bucket.last_seen)) {
            bucket.last_seen = ts;
        }
    }
    return per;
}

export function status_for(row: Bucket): string {
    if (row.mentions_30d >= 1) {
        return 'active';
    }
    if (row.exposures_30d >= 1) {
        return 'exposed-only';
    }
    return 'dead';
}

export function all_known_slugs(repo: string): Set<string> {
    const slugs = new Set<string>();
    const roots = [
        path.join(repo, '.augment', 'skills'),
        path.join(repo, '.claude', 'skills'),
        path.join(repo, 'dist/agent-src', 'skills'),
    ];
    for (const root of roots) {
        if (!_isDir(root)) {
            continue;
        }
        // root.glob("*/SKILL.md") — immediate child dirs containing SKILL.md.
        let names: string[];
        try {
            names = fs.readdirSync(root);
        } catch {
            continue;
        }
        for (const name of names) {
            const skillMd = path.join(root, name, 'SKILL.md');
            if (_isFile(skillMd)) {
                slugs.add(name);
            }
        }
    }
    return slugs;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
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

interface ReportRow extends Bucket {
    slug: string;
    status: string;
}

/** Mirror `dt.date().isoformat()` (YYYY-MM-DD in UTC). */
function _dateIso(d: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// ── The sink as a second source (Phase 4, step 4.1) ────────────────────────
//
// WHY THIS IS A SEPARATE SECTION AND NOT EXTRA COLUMNS. The two sources do not
// measure the same thing and cannot share a row. The first source is a regex
// scan of the maintainer's own transcripts, so it counts *exposure* and
// *mention* on one machine; Phase 0's third spike measured it detecting **0 of
// 89** real invocations on the set it reads. The sink counts *invocations* with
// a pseudonymous user per record, across every consenting install. Merging them
// into one table would produce a row whose numbers come from different
// populations, which is exactly the kind of arithmetic the zero-activation
// reading already taught this repository not to trust.
//
// DISTINCT USERS ARE THE POINT. A per-skill invocation count from one heavy
// user is not adoption. `user_hash` is a salted digest of host + login, so it
// distinguishes people without naming them, and the threshold below is the bar
// the tier-usage re-tier already uses.

/** One Class-A usage record, as the emitter writes it. */
interface ClassALine {
    skill: string;
    user_hash: string;
    session_hash: string | null;
    host: string | null;
    ts_bucket: string;
    record_class: string;
}

export interface SinkBucket {
    invocations_total: number;
    invocations_window: number;
    users_window: Set<string>;
    sessions_window: Set<string>;
    hosts: Set<string>;
    last_seen: Date | null;
}

/**
 * Parse an hour bucket (`2026-08-20T10:00Z`).
 *
 * Its own parser rather than `parse_ts`: the first source carries a full ISO
 * timestamp and the sink deliberately carries hour resolution only, so one
 * parser over both would quietly accept a precision neither guarantees.
 */
export function parse_hour_bucket(raw: unknown): Date | null {
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:00Z$/u.test(raw)) {
        return null;
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Load Class-A records. A missing sink export is a normal state, not an error. */
export function load_class_a(p: string): ClassALine[] {
    let text = '';
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return [];
    }
    const out: ClassALine[] = [];
    for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
            const rec = JSON.parse(line) as Record<string, unknown>;
            const skill = rec['skill'];
            const user_hash = rec['user_hash'];
            const ts_bucket = rec['ts_bucket'];
            // A record missing any of the three fields the aggregate is built
            // from is dropped rather than counted with a substitute: a
            // fabricated user or a fabricated hour both inflate the very
            // numbers an estate decision would cite.
            if (typeof skill !== 'string' || typeof user_hash !== 'string') continue;
            if (typeof ts_bucket !== 'string') continue;
            out.push({
                skill,
                user_hash,
                session_hash: typeof rec['session_hash'] === 'string' ? rec['session_hash'] : null,
                host: typeof rec['host'] === 'string' ? rec['host'] : null,
                ts_bucket,
                record_class: typeof rec['record_class'] === 'string' ? rec['record_class'] : '',
            });
        } catch {
            // Same tolerance as the first source: a truncated tail line does
            // not discard the file.
        }
    }
    return out;
}

export function aggregate_sink(
    records: readonly ClassALine[],
    now: Date,
    window_days: number,
): Map<string, SinkBucket> {
    const cutoff = now.getTime() - window_days * 86400_000;
    const per = new Map<string, SinkBucket>();
    for (const r of records) {
        // Only usage records feed a usage report. Phase 5 adds a self-repair
        // class to the same schema, and counting those as invocations would
        // read defect reports as adoption.
        if (r.record_class !== 'usage') continue;
        const ts = parse_hour_bucket(r.ts_bucket);
        if (ts === null) continue;
        let b = per.get(r.skill);
        if (b === undefined) {
            b = {
                invocations_total: 0,
                invocations_window: 0,
                users_window: new Set<string>(),
                sessions_window: new Set<string>(),
                hosts: new Set<string>(),
                last_seen: null,
            };
            per.set(r.skill, b);
        }
        b.invocations_total += 1;
        if (r.host !== null) b.hosts.add(r.host);
        if (b.last_seen === null || ts.getTime() > b.last_seen.getTime()) b.last_seen = ts;
        if (ts.getTime() >= cutoff) {
            b.invocations_window += 1;
            b.users_window.add(r.user_hash);
            if (r.session_hash !== null) b.sessions_window.add(r.session_hash);
        }
    }
    return per;
}

/** The distinct-user bar, from the constant the re-tier already ships. */
export const MIN_DISTINCT_USERS = DEFAULT_TIER_USAGE_RETIER.min_distinct_users;

/**
 * Render the sink section.
 *
 * An ABSENT or EMPTY sink renders a paragraph saying so, naming the path and
 * the reason. That is the load-bearing case today: `sink-choice` is
 * transferred, so no sink exists for this repository to read. A section that
 * rendered nothing would leave a reader unable to tell "no sink" from "a sink
 * that answered zero" — the blind-zero confusion this whole roadmap exists to
 * remove, reproduced one layer up.
 */
export function render_sink_section(
    per: Map<string, SinkBucket>,
    window_days: number,
    source_rel: string,
    present: boolean,
): string[] {
    const lines: string[] = ['', '## Second source — org sink (Class-A)', ''];
    if (!present || per.size === 0) {
        lines.push(
            `> **No sink data.** \`${source_rel}\` ` +
                (present ? 'holds no usage records' : 'does not exist') +
                '. This is the expected state while the sink itself is transferred ' +
                '(`sink-choice`, see `agents/roadmaps/stubs/road-to-org-telemetry-sink.md`): ' +
                'nothing has been stood up for this report to read. Read it as ' +
                '**no instrument**, never as no adoption — the distinction is the ' +
                'reason this roadmap exists.',
        );
        lines.push('');
        return lines;
    }

    const rows = [...per.entries()].sort((a, b) => {
        const du = b[1].users_window.size - a[1].users_window.size;
        if (du !== 0) return du;
        const iv = b[1].invocations_window - a[1].invocations_window;
        if (iv !== 0) return iv;
        return pyStrCmp(a[0], b[0]);
    });
    const meeting = rows.filter(([, b]) => b.users_window.size >= MIN_DISTINCT_USERS).length;
    lines.push(
        `**Window:** ${window_days}-day rolling · **Source:** \`${source_rel}\` · ` +
            `**Skills with any invocation:** ${rows.length} · ` +
            `**At or above the ${MIN_DISTINCT_USERS}-distinct-user bar:** ${meeting}`,
    );
    lines.push('');
    lines.push(
        `| # | slug | invocations_${window_days}d | distinct_users_${window_days}d | ` +
            `distinct_sessions_${window_days}d | hosts | meets_bar | last_seen |`,
    );
    lines.push('|---|---|---|---|---|---|---|---|');
    let i = 0;
    for (const [slug, b] of rows) {
        i += 1;
        const hosts = [...b.hosts].sort(pyStrCmp).join(', ') || '—';
        const meets = b.users_window.size >= MIN_DISTINCT_USERS ? 'yes' : 'no';
        const last = b.last_seen ? _dateIso(b.last_seen) : '—';
        lines.push(
            `| ${i} | \`${slug}\` | ${b.invocations_window} | ${b.users_window.size} | ` +
                `${b.sessions_window.size} | ${hosts} | ${meets} | ${last} |`,
        );
    }
    lines.push('');
    lines.push(
        `**Read-out:** \`meets_bar\` is the ${MIN_DISTINCT_USERS}-distinct-user threshold ` +
            'the tier-usage re-tier already uses; below it, a count is one person\'s habit ' +
            'rather than adoption. A host with no `Skill` tool emits no records at all, so ' +
            'a missing host in this table is a missing instrument and not a missing user.',
    );
    lines.push('');
    return lines;
}

export function render(
    per: Map<string, Bucket>,
    known: Set<string>,
    sink: { per: Map<string, SinkBucket>; source_rel: string; present: boolean } | null = null,
    window_days = 30,
): string {
    // sorted(known | set(per))
    const allSlugs = pySortedUnique([...known, ...per.keys()]);
    const rows: ReportRow[] = [];
    for (const slug of allSlugs) {
        const data = per.get(slug) ?? _newBucket();
        rows.push({ slug, ...data, status: status_for(data) });
    }
    // rows.sort(key=lambda r: (r["status"] != "dead", -r["exposures_total"], r["slug"]))
    rows.sort((a, b) => {
        const ad = a.status !== 'dead' ? 1 : 0;
        const bd = b.status !== 'dead' ? 1 : 0;
        if (ad !== bd) {
            return ad - bd;
        }
        if (-a.exposures_total !== -b.exposures_total) {
            return -a.exposures_total - -b.exposures_total;
        }
        return pyStrCmp(a.slug, b.slug);
    });

    const counts: Record<string, number> = { active: 0, 'exposed-only': 0, dead: 0 };
    for (const r of rows) {
        counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    const total = rows.length;

    const lines: string[] = [
        '# Skill Usage Report (baseline)',
        '',
        generatedByQuote('skill_usage_report', 'Source:'),
        '> `agents/runtime/metrics/skill-usage.jsonl` (collector emits per-turn',
        '> exposure/mention records). See',
        '> [`step-2-skill-inventory-rationalization.md`](../roadmaps/step-2-skill-inventory-rationalization.md)',
        '> Phase 1.',
        '',
        `**Window:** 30-day rolling · **Skills tracked:** ${total} · ` +
            `**Active:** ${counts['active']} · **Exposed-only:** ${counts['exposed-only']} · ` +
            `**Dead:** ${counts['dead']}`,
        '',
        '| # | slug | status | exposures_30d | mentions_30d | exposures_total | mentions_total | last_seen |',
        '|---|---|---|---|---|---|---|---|',
    ];
    let i = 0;
    for (const r of rows) {
        i += 1;
        const last = r.last_seen ? _dateIso(r.last_seen) : '—';
        lines.push(
            `| ${i} | \`${r.slug}\` | ${r.status} | ${r.exposures_30d} | ` +
                `${r.mentions_30d} | ${r.exposures_total} | ${r.mentions_total} | ${last} |`,
        );
    }
    lines.push('');
    lines.push(
        '**Read-out:** rows tagged `dead` are first-cut archive candidates; ' +
            'rows tagged `exposed-only` are first-cut merge / rename candidates ' +
            '(catalog noise, agent never invokes). Phase 2 confirms with ' +
            'structural overlap before any deletion.',
    );
    lines.push('');
    if (sink !== null) {
        lines.push(...render_sink_section(sink.per, window_days, sink.source_rel, sink.present));
    }
    return lines.join('\n');
}

function pySortedUnique(values: string[]): string[] {
    return [...new Set(values)].sort(pyStrCmp);
}

/**
 * Mirror `Path.relative_to(REPO)` — POSIX relative path, but throws when
 * `p` is NOT under `REPO` (Python raises `ValueError`, which propagates as
 * an uncaught exception → traceback + exit 1). Replicating this latent
 * behaviour is intentional; flagged as a divergence candidate (the script
 * crashes on a non-repo `--out`).
 */
function _relativeToRepo(p: string): string {
    const abs = path.resolve(p);
    const rel = path.relative(REPO, abs);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(
            `'${abs}' is not in the subpath of '${REPO}' ` +
                `OR one path is relative and the other is absolute.`,
        );
    }
    return rel.split(path.sep).join('/');
}

interface ParsedArgs {
    inp: string;
    out: string;
    /** The Class-A sink export — the second source. */
    sink: string;
    window: number;
    quiet: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { inp: IN, out: OUT, sink: SINK_IN, window: 30, quiet: false };
    const fail = (msg: string): never => {
        process.stderr.write(`skill_usage_report: error: ${msg}\n`);
        process.exit(2);
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--in') {
            const v = argv[++i];
            if (v === undefined) fail('argument --in: expected one argument');
            out.inp = path.resolve(v as string);
        } else if (a.startsWith('--in=')) {
            out.inp = path.resolve(a.slice('--in='.length));
        } else if (a === '--out') {
            const v = argv[++i];
            if (v === undefined) fail('argument --out: expected one argument');
            out.out = path.resolve(v as string);
        } else if (a.startsWith('--out=')) {
            out.out = path.resolve(a.slice('--out='.length));
        } else if (a === '--sink') {
            const v = argv[++i];
            if (v === undefined) fail('argument --sink: expected one argument');
            out.sink = path.resolve(v as string);
        } else if (a.startsWith('--sink=')) {
            out.sink = path.resolve(a.slice('--sink='.length));
        } else if (a === '--window') {
            const v = argv[++i];
            if (v === undefined) fail('argument --window: expected one argument');
            out.window = Number.parseInt(v as string, 10);
        } else if (a.startsWith('--window=')) {
            out.window = Number.parseInt(a.slice('--window='.length), 10);
        } else if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: skill_usage_report [-h] [--in INP] [--out OUT] [--sink SINK] [--window WINDOW] [--quiet]\n');
            process.exit(0);
        } else {
            fail(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const records = load_records(args.inp);
    const now = new Date();
    const per = aggregate(records, now, args.window);
    const known = all_known_slugs(REPO);
    // Same split as `skill_usage_collect`: the JSONL is legitimately empty
    // before any turn is recorded, but a vanished skills projection makes the
    // report list only the slugs that happen to appear in the metrics — and a
    // report certifying over nothing is the same lie in a quieter voice.
    try {
        assertScanned({
            gate: 'skill_usage_report',
            scanned: known.size,
            units: 'known skill slug(s)',
            roots: ['.augment/skills', '.claude/skills', 'dist/agent-src/skills'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 2 is the only non-zero code this CLI has (argparse errors).
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    // The second source. Absent is the normal state and is rendered as such
    // rather than omitted — see `render_sink_section`.
    const sink_present = fs.existsSync(args.sink);
    const sink_per = aggregate_sink(load_class_a(args.sink), now, args.window);
    let sink_rel: string;
    try {
        sink_rel = _relativeToRepo(args.sink);
    } catch {
        // A sink export outside the repo is legitimate (an org may mount one);
        // the report then names it by basename rather than refusing to render.
        sink_rel = path.basename(args.sink);
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(
        args.out,
        render(per, known, { per: sink_per, source_rel: sink_rel, present: sink_present }, args.window),
        'utf-8',
    );
    if (!args.quiet) {
        const count = new Set([...known, ...per.keys()]).size;
        process.stdout.write(`✅  Wrote ${_relativeToRepo(args.out)} (${count} skill(s))\n`);
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
