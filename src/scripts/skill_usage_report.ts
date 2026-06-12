#!/usr/bin/env node
/**
 * Aggregate `agents/runtime/metrics/skill-usage.jsonl` into a per-skill report.
 *
 * TypeScript twin of `src/scripts/skill_usage_report.py` (ADR-089,
 * Phase 8 / Wave 8b). The public surface, CLI contract, exit code,
 * stdout text, and rendered markdown mirror the Python original EXACTLY
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

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// parent.parent.parent of the .py file (src/scripts/skill_usage_report.py)
// is the repo root — two dirs up from src/scripts.
const REPO = path.resolve(_HERE, '..', '..');
const IN = path.join(REPO, 'agents', 'metrics', 'skill-usage.jsonl');
const OUT = path.join(REPO, 'agents', 'metrics', 'skill-usage-report.md');

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

export function render(per: Map<string, Bucket>, known: Set<string>): string {
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
        '> Generated by `scripts/skill_usage_report.py`. Source:',
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
    window: number;
    quiet: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { inp: IN, out: OUT, window: 30, quiet: false };
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
        } else if (a === '--window') {
            const v = argv[++i];
            if (v === undefined) fail('argument --window: expected one argument');
            out.window = Number.parseInt(v as string, 10);
        } else if (a.startsWith('--window=')) {
            out.window = Number.parseInt(a.slice('--window='.length), 10);
        } else if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: skill_usage_report [-h] [--in INP] [--out OUT] [--window WINDOW] [--quiet]\n');
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
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, render(per, known), 'utf-8');
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
