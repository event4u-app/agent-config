#!/usr/bin/env tsx
/**
 * Command-surface inventory + overlap detection + usage signal.
 *
 * TypeScript twin of `src/scripts/audit_command_surface.py` (ADR-089, Phase 8 /
 * Wave 8b). Mirrors the CLI contract EXACTLY — the `--root`, `--budget`,
 * `--check-new`, `--baseline`, `--quiet` flags, exit codes (0 ok / 1 budget
 * violation / 2 root-missing / 3 git error), the stdout/stderr split,
 * byte-identical messages AND byte-identical written reports
 * (`command-surface.{json,md}`, `command-budget-audit.{json,md}`,
 * each via `json.dumps(indent=2)` / the markdown renderers).
 *
 * Walks `src/domains/<pack>/<verb>/command.md`, collects metadata, flags
 * overlap pairs by keyword-cosine similarity, and adds a usage signal from
 * git history.
 *
 * No behaviour changes — latent Python quirks replicated (incl. git-history
 * `days_since_*` values, which depend on the wall clock and the worktree's
 * git log — golden parity is run in the SAME repo so both sides observe the
 * identical history; the day arithmetic is reproduced with the same floor).
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { SRC_DOMAINS } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/audit_command_surface.ts → parents[2] of the .py file is repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// 6.0.0-D Step 10 moved the command surface into src/domains/<pack>/<verb>/command.md.
const DEFAULT_ROOT = (): string => SRC_DOMAINS();
const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
const OUT_JSON = path.join(REPORT_DIR, 'command-surface.json');
const OUT_MD = path.join(REPORT_DIR, 'command-surface.md');
const OUT_BUDGET_JSON = path.join(REPORT_DIR, 'command-budget-audit.json');
const OUT_BUDGET_MD = path.join(REPORT_DIR, 'command-budget-audit.md');
const PACKS_YML = path.join(REPO_ROOT, 'src', 'config', 'discovery', 'packs.yml');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');

const SIZE_BUDGETS: Record<string, number> = {
    core: 8,
    small: 2,
    medium: 5,
    large: 8,
    platform: 10,
};
const VISIBLE_TIERS: ReadonlySet<number> = new Set([0, 1]);

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;
const DESCRIPTION_RE = /^description:\s*"?(.*?)"?\s*$/m;
const ALIASES_RE = /^aliases:\s*(.*)$/m;
const NAME_RE = /^name:\s*(.*)$/m;
const CLUSTER_RE = /^cluster:\s*(.*)$/m;
const TIER_RE = /^tier:\s*(\d+)/m;
const PACK_RE = /^pack:\s*(.*)$/m;

const STOPWORDS: ReadonlySet<string> = new Set([
    'the', 'and', 'for', 'with', 'when', 'use', 'or', 'of', 'to', 'a', 'an',
    'is', 'in', 'on', 'by', 'be', 'at', 'as', 'it', 'if', 'are', 'this',
    'that', 'from', 'but', 'not', 'can', 'any', 'all', 'no', 'after',
    'before', 'during', 'user', 'agent', 'code', 'project', 'via', 'into',
    'onto', 'even', 'without', 'naming', 'run', 'runs', 'running', 'each',
    'every', 'one', 'two', 'now', 'then', 'also', 'based', 'default',
]);

const OVERLAP_COSINE_THRESHOLD = 0.6;
const LOW_SIGNAL_COMMIT_COUNT = 2;
const LOW_SIGNAL_AGE_DAYS = 30;

// Dataclass `Command`. Field order is the JSON / asdict serialization order.
interface Command {
    name: string;
    path: string;
    relpath: string;
    directory: string;
    description: string;
    aliases: string[];
    tier: number | null;
    cluster: string;
    pack: string;
    line_count: number;
    last_modified_iso: string;
    days_since_modified: number | null;
    commit_count: number;
    first_commit_iso: string;
    days_since_first_commit: number | null;
}

const COMMAND_FIELDS: readonly (keyof Command)[] = [
    'name',
    'path',
    'relpath',
    'directory',
    'description',
    'aliases',
    'tier',
    'cluster',
    'pack',
    'line_count',
    'last_modified_iso',
    'days_since_modified',
    'commit_count',
    'first_commit_iso',
    'days_since_first_commit',
];

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** `sorted(root.rglob("*.md"))` with pathlib component-wise ordering. */
function _rglobMdSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !e.isSymbolicLink()) {
                walk(full);
            } else if (e.isFile() && e.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(root);
    out.sort(_pathCompare);
    return out;
}

/** Whether `dir` (recursively) contains any file named `command.md`. */
function _hasCommandMd(dir: string): boolean {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return false;
    }
    for (const e of entries) {
        if (e.isDirectory() && !e.isSymbolicLink()) {
            if (_hasCommandMd(path.join(dir, e.name))) {
                return true;
            }
        } else if (e.isFile() && e.name === 'command.md') {
            return true;
        }
    }
    return false;
}

function _pathCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x < y) return -1;
        if (x > y) return 1;
    }
    return pa.length - pb.length;
}

function _relPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/** Python `Path.stem`. */
function _stem(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

/** Mirror Python `str.strip(" \"'")` then `.strip(...)` chains used here. */
function _strip(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) start += 1;
    while (end > start && chars.includes(s[end - 1] as string)) end -= 1;
    return s.slice(start, end);
}

interface Frontmatter {
    description?: string;
    name?: string;
    cluster?: string;
    tier?: number;
    pack?: string;
    aliases?: string[];
}

export function parse_frontmatter(text: string): Frontmatter {
    const m = FRONTMATTER_RE.exec(text);
    if (!m) {
        return {};
    }
    const block = m[1] as string;
    const out: Frontmatter = {};
    const d = DESCRIPTION_RE.exec(block);
    if (d) {
        out.description = (d[1] as string).trim();
    }
    const n = NAME_RE.exec(block);
    if (n) {
        // Python: n.group(1).strip().strip('"').strip("'")
        out.name = _stripQuotes((n[1] as string).trim());
    }
    const c = CLUSTER_RE.exec(block);
    if (c) {
        out.cluster = _stripQuotes((c[1] as string).trim());
    }
    const t = TIER_RE.exec(block);
    if (t) {
        out.tier = parseInt(t[1] as string, 10);
    }
    const pk = PACK_RE.exec(block);
    if (pk) {
        out.pack = _stripQuotes((pk[1] as string).trim());
    }
    const a = ALIASES_RE.exec(block);
    if (a) {
        const raw = (a[1] as string).trim();
        if (raw.startsWith('[')) {
            const inner = _strip(raw, '[]');
            out.aliases = inner
                .split(',')
                .map((x) => x.trim())
                .filter((x) => x.length > 0)
                .map((x) => _stripQuotes(x));
        } else {
            out.aliases = raw ? [_stripQuotes(raw)] : [];
        }
    }
    return out;
}

/** Python `.strip('"').strip("'")` — strip all `"` then all `'`. */
function _stripQuotes(s: string): string {
    return _strip(_strip(s, '"'), "'");
}

export function keyword_vector(text: string): Map<string, number> {
    const tokens = text.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
    const counter = new Map<string, number>();
    for (const t of tokens) {
        if (STOPWORDS.has(t)) {
            continue;
        }
        counter.set(t, (counter.get(t) ?? 0) + 1);
    }
    return counter;
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
    if (a.size === 0 || b.size === 0) {
        return 0.0;
    }
    const shared = [...a.keys()].filter((t) => b.has(t));
    if (shared.length === 0) {
        return 0.0;
    }
    let num = 0;
    for (const t of shared) {
        num += (a.get(t) as number) * (b.get(t) as number);
    }
    let da = 0;
    for (const v of a.values()) da += v * v;
    let db = 0;
    for (const v of b.values()) db += v * v;
    da = Math.sqrt(da);
    db = Math.sqrt(db);
    return da && db ? num / (da * db) : 0.0;
}

/** Days between two ISO timestamps, floored — mirrors `timedelta.days`. */
function _daysSince(iso: string): number {
    const then = new Date(iso).getTime();
    const now = Date.now();
    return Math.floor((now - then) / 86400000);
}

export function git_last_modified(p: string): [string, number | null] {
    const r = spawnSync(
        'git',
        ['log', '--follow', '-1', '--format=%cI', '--', p],
        { cwd: REPO_ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if ((r.status ?? 1) !== 0) {
        return ['', null];
    }
    const out = (r.stdout ?? '').trim();
    if (!out) {
        return ['', null];
    }
    const days = _daysSince(out);
    if (Number.isNaN(days)) {
        return ['', null];
    }
    return [out, days];
}

export function git_history(p: string): [number, string, number | null] {
    const r = spawnSync(
        'git',
        ['log', '--follow', '--format=%cI', '--', p],
        { cwd: REPO_ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if ((r.status ?? 1) !== 0) {
        return [0, '', null];
    }
    const lines = (r.stdout ?? '')
        .trim()
        .split('\n')
        .filter((l) => l.length > 0);
    if (lines.length === 0) {
        return [0, '', null];
    }
    const first = lines[lines.length - 1] as string;
    const days = _daysSince(first);
    if (Number.isNaN(days)) {
        return [0, '', null];
    }
    return [lines.length, first, days];
}

export function collect(root: string): Command[] {
    const commands: Command[] = [];
    for (const md of _rglobMdSorted(root)) {
        if (md.split(path.sep).some((part) => part === '_archive')) {
            continue;
        }
        const text = fs.readFileSync(md, 'utf-8');
        const fm = parse_frontmatter(text);
        const rel = _relPosix(md, REPO_ROOT);
        const directory =
            path.dirname(md) !== root ? _relPosix(path.dirname(md), root) : '.';
        const [lastIso, days] = git_last_modified(md);
        const [nCommits, firstIso, firstDays] = git_history(md);
        commands.push({
            name: fm.name ?? _stem(path.basename(md)),
            path: md,
            relpath: rel,
            directory,
            description: fm.description ?? '',
            aliases: fm.aliases ?? [],
            tier: fm.tier ?? null,
            cluster: fm.cluster ?? '',
            pack: fm.pack ?? '',
            line_count: _splitlinesLen(text),
            last_modified_iso: lastIso,
            days_since_modified: days,
            commit_count: nCommits,
            first_commit_iso: firstIso,
            days_since_first_commit: firstDays,
        });
    }
    return commands;
}

// Boundaries Python str.splitlines() recognises (CPython unicode line breaks):
// \n \r \r\n \v \f \x1c \x1d \x1e \x85 \u2028 \u2029.
const _LINE_BOUNDARY = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g;

/** Mirror Python `len(text.splitlines())` — count of lines, no trailing empty. */
function _splitlinesLen(text: string): number {
    if (text === '') {
        return 0;
    }
    let count = 0;
    let lastEnd = 0;
    _LINE_BOUNDARY.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = _LINE_BOUNDARY.exec(text)) !== null) {
        count += 1;
        lastEnd = m.index + m[0].length;
    }
    // Trailing characters after the final boundary form one more line; a string
    // ending exactly on a boundary contributes no trailing empty line.
    if (lastEnd < text.length) {
        count += 1;
    }
    return count;
}

interface OverlapPair {
    a: string;
    b: string;
    a_name: string;
    b_name: string;
    cosine: number;
    a_description: string;
    b_description: string;
}

/** Mirror Python `round(x, 3)` — round-half-to-even. */
function _round3(x: number): number {
    const factor = 1000;
    const scaled = x * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

export function find_overlap_pairs(commands: Command[]): OverlapPair[] {
    const vectors = new Map<string, Map<string, number>>();
    for (const c of commands) {
        vectors.set(c.relpath, keyword_vector(c.description));
    }
    const pairs: OverlapPair[] = [];
    // itertools.combinations(commands, 2) — index order i<j.
    for (let i = 0; i < commands.length; i += 1) {
        for (let j = i + 1; j < commands.length; j += 1) {
            const a = commands[i] as Command;
            const b = commands[j] as Command;
            if (!a.description || !b.description) {
                continue;
            }
            const sim = cosine(
                vectors.get(a.relpath) as Map<string, number>,
                vectors.get(b.relpath) as Map<string, number>,
            );
            if (sim < OVERLAP_COSINE_THRESHOLD) {
                continue;
            }
            pairs.push({
                a: a.relpath,
                b: b.relpath,
                a_name: a.name,
                b_name: b.name,
                cosine: _round3(sim),
                a_description: a.description,
                b_description: b.description,
            });
        }
    }
    // sorted(pairs, key=lambda p: -p["cosine"]) — stable sort, descending cosine.
    return _stableSort(pairs, (p) => -p.cosine);
}

/** Mirror Python's stable `sorted(..., key=...)`. */
function _stableSort<T>(arr: T[], key: (x: T) => number): T[] {
    return arr
        .map((v, i) => ({ v, i }))
        .sort((x, y) => {
            const kx = key(x.v);
            const ky = key(y.v);
            if (kx < ky) return -1;
            if (kx > ky) return 1;
            return x.i - y.i;
        })
        .map((p) => p.v);
}

/** Mirror `f"{x:.2f}"` round-half-to-even. */
function _fixed(x: number, ndigits: number): string {
    const neg = x < 0;
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
        result = `${intStr.slice(0, intStr.length - ndigits)}.${intStr.slice(intStr.length - ndigits)}`;
    }
    return neg ? `-${result}` : result;
}

export function render_md(commands: Command[], pairs: OverlapPair[]): string {
    const byDir = new Map<string, Command[]>();
    for (const c of commands) {
        if (!byDir.has(c.directory)) {
            byDir.set(c.directory, []);
        }
        (byDir.get(c.directory) as Command[]).push(c);
    }

    const lowSignal = commands.filter(
        (c) =>
            c.commit_count &&
            c.commit_count <= LOW_SIGNAL_COMMIT_COUNT &&
            (c.days_since_first_commit ?? 0) <= LOW_SIGNAL_AGE_DAYS,
    );

    const lines: string[] = [
        '# Command-Surface Inventory',
        '',
        '> Generated by `scripts/audit_command_surface.py`. ' +
            'Source: `.agent-src.uncondensed/commands/`.',
        '',
        '## Summary',
        '',
        `- **Total commands:** ${commands.length}`,
        `- **Top-level commands (directory \`.\`):** ${(byDir.get('.') ?? []).length}`,
        `- **Sub-cluster directories:** ${[...byDir.keys()].filter((d) => d !== '.').length}`,
        `- **Low-signal (≤${LOW_SIGNAL_COMMIT_COUNT} commits AND ≤${LOW_SIGNAL_AGE_DAYS}d old):** ${lowSignal.length}`,
        `- **Overlap pairs (cosine ≥ ${OVERLAP_COSINE_THRESHOLD}):** ${pairs.length}`,
        '',
        '## Per-directory counts',
        '',
        '| Directory | Count |',
        '|---|---:|',
    ];
    for (const d of [...byDir.keys()].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))) {
        lines.push(`| \`${d}\` | ${(byDir.get(d) as Command[]).length} |`);
    }
    lines.push('');

    lines.push('## Likely-overlapping pairs', '');
    if (pairs.length === 0) {
        lines.push('_No pairs above threshold._');
    } else {
        lines.push(
            '| # | A | B | cosine | A description | B description |',
            '|---|---|---|---:|---|---|',
        );
        pairs.forEach((p, idx) => {
            lines.push(
                `| ${idx + 1} | \`${p.a_name}\` | \`${p.b_name}\` | ${_fixed(p.cosine, 2)} | ` +
                    `${p.a_description} | ${p.b_description} |`,
            );
        });
    }
    lines.push('');

    lines.push(
        '## Usage-signal note',
        '',
        'Per-command invocation telemetry is **not** available. Two surrogate signals ' +
            'were considered:',
        '',
        '- **Filesystem mtime** — useless: `task sync` rewrites every file when the ' +
            '  condensed and uncondensed trees are regenerated.',
        '- **Git history (`--follow`)** — uninformative here: the `.agent-src.uncondensed/` ' +
            '  directory is the result of a recent rename (`.augment.uncondensed/` → ' +
            '  `.agent-src.uncondensed/`), so almost every file shows a single recent commit ' +
            `  on the current branch. ${lowSignal.length} of ${commands.length} commands fall into the ` +
            `  ≤${LOW_SIGNAL_COMMIT_COUNT}-commits / ≤${LOW_SIGNAL_AGE_DAYS}d-old bucket purely as a ` +
            '  rename artefact, not as a real cold-tail signal.',
        '',
        '**Implication for Phase 1 categorisation:** keep / merge / retire decisions must ' +
            'be made on **intent** (description content, overlap with sibling commands, tier ' +
            'placement, cluster fit) rather than usage data. The cosine-≥0.6 overlap ' +
            'pairs above are the primary structural lever.',
        '',
    );

    lines.push(
        '## Three-bucket categorisation (Phase 1 Step 4)',
        '',
        'The keep / merge / retire verdict lives in ' +
            '[`command-surface-synthesis.md`](command-surface-synthesis.md) — hand-curated ' +
            'and **not** regenerated by this script. Headline: 109 keep · 0 merge · 0 retire. ' +
            'Every overlap pair and retire candidate surfaced by the council turned out to ' +
            'be an intentional structural pattern (scope ladder, union dispatcher, thin ' +
            'alias, tier-gated specialist), not redundancy.',
        '',
    );

    lines.push(
        '## Full inventory',
        '',
        'Column `bucket` is left blank — the categorisation lives in ' +
            '[`command-surface-synthesis.md`](command-surface-synthesis.md). Every command ' +
            "in this table maps to `keep` unless named in that file's tables.",
        '',
        '| Name | Path | Tier | Cluster | Aliases | Lines | Commits | Age (d) | Bucket |',
        '|---|---|---:|---|---|---:|---:|---:|---|',
    );
    const sortedCmds = _stableSortStr(commands, (c) => c.relpath);
    for (const c of sortedCmds) {
        const aliases = c.aliases.length ? c.aliases.join(', ') : '—';
        const tier = c.tier === null ? '—' : String(c.tier);
        const cluster = c.cluster || '—';
        const age = c.days_since_first_commit === null ? '—' : String(c.days_since_first_commit);
        lines.push(
            `| \`${c.name}\` | \`${c.relpath}\` | ${tier} | ${cluster} | ${aliases} | ` +
                `${c.line_count} | ${c.commit_count} | ${age} | |`,
        );
    }
    lines.push('');
    return lines.join('\n');
}

function _stableSortStr<T>(arr: T[], key: (x: T) => string): T[] {
    return arr
        .map((v, i) => ({ v, i }))
        .sort((x, y) => {
            const kx = key(x.v);
            const ky = key(y.v);
            if (kx < ky) return -1;
            if (kx > ky) return 1;
            return x.i - y.i;
        })
        .map((p) => p.v);
}

// --- Budget audit ----------------------------------------------------------

function _command_roots(): string[] {
    const roots: string[] = [];
    const domains = SRC_DOMAINS();
    if (_exists(domains)) {
        let entries: fs.Dirent[] = [];
        try {
            entries = fs.readdirSync(domains, { withFileTypes: true });
        } catch {
            entries = [];
        }
        const dirs = entries
            .filter((e) => e.isDirectory())
            .map((e) => path.join(domains, e.name))
            .sort(_pathCompare);
        for (const d of dirs) {
            if (_hasCommandMd(d)) {
                roots.push(d);
            }
        }
    }
    return roots.length ? roots : [DEFAULT_ROOT()];
}

export function collect_all(): Command[] {
    const cmds: Command[] = [];
    const seen = new Set<string>();
    for (const root of _command_roots()) {
        for (const c of collect(root)) {
            if (!seen.has(c.relpath)) {
                seen.add(c.relpath);
                cmds.push(c);
            }
        }
    }
    return cmds;
}

export function load_size_classes(): Map<string, string | null> {
    const raw = parseYaml(fs.readFileSync(PACKS_YML, 'utf-8'), { version: '1.1' }) as Json;
    const list = Array.isArray(raw) ? raw : [];
    const out = new Map<string, string | null>();
    for (const e of list) {
        if (e !== null && typeof e === 'object' && !Array.isArray(e)) {
            const o = e as { [k: string]: Json };
            const id = o['id'];
            if (typeof id === 'string') {
                const sc = o['size_class'];
                out.set(id, typeof sc === 'string' ? sc : null);
            }
        }
    }
    return out;
}

export function citation_count(name: string): number {
    if (!_exists(DOCS_DIR)) {
        return 0;
    }
    const needle = `/${name}`;
    let hits = 0;
    for (const md of _rglobMdSorted(DOCS_DIR)) {
        try {
            if (fs.readFileSync(md, 'utf-8').includes(needle)) {
                hits += 1;
            }
        } catch {
            continue;
        }
    }
    return hits;
}

function _is_visible(c: Command): boolean {
    return VISIBLE_TIERS.has(c.tier !== null ? c.tier : 2);
}

interface VisibleCommand {
    name: string;
    tier: number | null;
    cluster: string;
    citations_docs: number;
    commit_count: number;
    days_since_modified: number | null;
}
interface PackEntry {
    pack: string;
    size_class: string | null;
    budget: number | null;
    visible_count: number;
    internal_count: number;
    over_budget: boolean;
    over_by: number;
    visible_commands?: VisibleCommand[];
}
interface BudgetAudit {
    budgets: Record<string, number>;
    visible_tiers: number[];
    total_commands: number;
    packs: PackEntry[];
}

export function build_budget_audit(
    commands: Command[],
    sizeClasses: Map<string, string | null>,
): BudgetAudit {
    const byPack = new Map<string, Command[]>();
    for (const c of commands) {
        const key = c.pack || '(unassigned)';
        if (!byPack.has(key)) {
            byPack.set(key, []);
        }
        (byPack.get(key) as Command[]).push(c);
    }

    const packsOut: PackEntry[] = [];
    for (const pack of [...byPack.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        const members = byPack.get(pack) as Command[];
        const visible = members.filter((c) => _is_visible(c));
        const internal = members.filter((c) => !_is_visible(c));
        const sc = sizeClasses.has(pack) ? (sizeClasses.get(pack) as string | null) : undefined;
        const budget =
            sc !== undefined && sc !== null && sc in SIZE_BUDGETS
                ? (SIZE_BUDGETS[sc] as number)
                : null;
        const over = budget !== null && visible.length > budget;
        const entry: PackEntry = {
            pack,
            size_class: sc === undefined ? null : sc,
            budget,
            visible_count: visible.length,
            internal_count: internal.length,
            over_budget: over,
            over_by: over ? visible.length - (budget as number) : 0,
        };
        if (over) {
            const vis = visible.map((c) => ({
                name: c.name,
                tier: c.tier,
                cluster: c.cluster,
                citations_docs: citation_count(c.name),
                commit_count: c.commit_count,
                days_since_modified: c.days_since_modified,
            }));
            // sorted(..., key=lambda d: (d["citations_docs"], d["commit_count"]))
            entry.visible_commands = vis
                .map((v, i) => ({ v, i }))
                .sort((x, y) => {
                    if (x.v.citations_docs !== y.v.citations_docs) {
                        return x.v.citations_docs - y.v.citations_docs;
                    }
                    if (x.v.commit_count !== y.v.commit_count) {
                        return x.v.commit_count - y.v.commit_count;
                    }
                    return x.i - y.i;
                })
                .map((p) => p.v);
        }
        packsOut.push(entry);
    }
    return {
        budgets: SIZE_BUDGETS,
        visible_tiers: [...VISIBLE_TIERS].sort((a, b) => a - b),
        total_commands: commands.length,
        packs: packsOut,
    };
}

export function render_budget_md(audit: BudgetAudit): string {
    const L: string[] = [];
    L.push('# Command budget audit (6.0.0-B Phase 2 Step 4)\n');
    L.push(
        '> Per-pack VISIBLE-command counts vs. the `size_class` budget ' +
            '(capability-packs.md). `visible` = tier ∈ {0,1}; tier 2 / absent = ' +
            'internal (uncapped). Citations = docs/ files referencing `/<name>`.\n' +
            '>\n' +
            '> **Signal note:** docs-citations is the load-bearing signal (rank ' +
            'candidates low→high). The git commit/idle columns are low-variance on ' +
            'this active repo and only weakly discriminating — do not hide a ' +
            'high-citation command on an idle-days reading alone.\n',
    );
    L.push('\n## Summary\n');
    L.push('| Pack | size_class | budget | visible | internal | over? |');
    L.push('|---|---|--:|--:|--:|:--|');
    for (const p of audit.packs) {
        const flag = p.over_budget ? `⚠️ +${p.over_by}` : 'ok';
        L.push(
            `| \`${p.pack}\` | ${p.size_class ?? '—'} | ` +
                `${p.budget !== null ? p.budget : '—'} | ` +
                `${p.visible_count} | ${p.internal_count} | ${flag} |`,
        );
    }
    const overPacks = audit.packs.filter((p) => p.over_budget);
    L.push('\n## Over-budget packs — decision signals (Phase 2 Step 5)\n');
    if (overPacks.length === 0) {
        L.push('None — every pack is within its visible-command budget.\n');
    }
    for (const p of overPacks) {
        L.push(
            `\n### \`${p.pack}\` — ${p.visible_count} visible / ` +
                `budget ${p.budget} (${p.size_class}), over by ${p.over_by}\n`,
        );
        L.push('Decide per command: keep-visible · set `internal` · relocate-to-pack-X.\n');
        L.push('| Command | tier | cluster | docs citations | commits | days idle |');
        L.push('|---|--:|---|--:|--:|--:|');
        for (const c of p.visible_commands ?? []) {
            L.push(
                `| \`${c.name}\` | ${c.tier} | ${c.cluster || '—'} | ` +
                    `${c.citations_docs} | ${c.commit_count} | ` +
                    `${c.days_since_modified !== null ? c.days_since_modified : '—'} |`,
            );
        }
    }
    return L.join('\n') + '\n';
}

// --- Forward-looking budget gate -------------------------------------------

const _CMD_PATH_RE = /src\/domains\/.+\/command\.md$/;

function _git_lines(args: string[]): string[] {
    let r: SpawnSyncReturns<string>;
    try {
        r = spawnSync('git', args, {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            timeout: 15000,
        });
    } catch (exc) {
        process.stderr.write(`error: git ${args.join(' ')} failed: ${String(exc)}\n`);
        process.exit(3);
    }
    if (r.error) {
        process.stderr.write(`error: git ${args.join(' ')} failed: ${String(r.error)}\n`);
        process.exit(3);
    }
    if ((r.status ?? 1) !== 0) {
        process.stderr.write(
            `error: git ${args.join(' ')} exit ${r.status}: ${r.stderr ?? ''}\n`,
        );
        process.exit(3);
    }
    return (r.stdout ?? '').split('\n').filter((ln) => ln.trim().length > 0);
}

function _tier_at_ref(ref: string, relpath: string): number | null {
    const r = spawnSync('git', ['show', `${ref}:${relpath}`], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: 15000,
    });
    if ((r.status ?? 1) !== 0) {
        return null;
    }
    const m = TIER_RE.exec(r.stdout ?? '');
    return m ? parseInt(m[1] as string, 10) : null;
}

function _is_visible_tier(tier: number | null): boolean {
    return VISIBLE_TIERS.has(tier !== null ? tier : 2);
}

export function grown_packs(baseline: string, commands: Command[]): Map<string, string[]> {
    const byRelpath = new Map<string, Command>();
    for (const c of commands) {
        byRelpath.set(c.relpath, c);
    }
    const added = new Set(
        _git_lines(['diff', '--name-only', '--diff-filter=A', `${baseline}...HEAD`]),
    );
    const modified = new Set(
        _git_lines(['diff', '--name-only', '--diff-filter=M', `${baseline}...HEAD`]),
    );
    for (const line of _git_lines(['status', '--porcelain', '-uall'])) {
        const status = line.slice(0, 2);
        const rawPath = line.slice(3).trim();
        const p = rawPath.split(' -> ').pop() as string;
        const st = status.trim();
        if (['A', '??', 'AM', 'M', 'MM'].includes(st)) {
            if (['A', '??', 'AM'].includes(st)) {
                added.add(p);
            } else {
                modified.add(p);
            }
        }
    }

    const grew = new Map<string, string[]>();
    const union = new Set<string>([...added, ...modified]);
    for (const relpath of union) {
        if (!_CMD_PATH_RE.test(relpath)) {
            continue;
        }
        const cmd = byRelpath.get(relpath);
        if (cmd === undefined || !cmd.pack) {
            continue;
        }
        if (!_is_visible_tier(cmd.tier)) {
            continue;
        }
        if (modified.has(relpath) && !added.has(relpath)) {
            if (_is_visible_tier(_tier_at_ref(baseline, relpath))) {
                continue;
            }
        }
        if (!grew.has(cmd.pack)) {
            grew.set(cmd.pack, []);
        }
        (grew.get(cmd.pack) as string[]).push(cmd.name);
    }
    return grew;
}

export function check_new_budget(baseline: string, quiet: boolean): number {
    const commands = collect_all();
    const audit = build_budget_audit(commands, load_size_classes());
    const byPack = new Map<string, PackEntry>();
    for (const p of audit.packs) {
        byPack.set(p.pack, p);
    }
    const grew = grown_packs(baseline, commands);

    const violations: { pack: string; new_commands: string[]; entry: PackEntry }[] = [];
    for (const pack of [...grew.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        const newNames = grew.get(pack) as string[];
        const entry = byPack.get(pack);
        if (entry && entry.over_budget) {
            violations.push({
                pack,
                new_commands: [...newNames].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
                entry,
            });
        }
    }

    if (violations.length) {
        process.stdout.write('❌  Per-pack command budget exceeded by newly visible command(s):\n');
        for (const v of violations) {
            const e = v.entry;
            process.stdout.write(
                `  • pack \`${v.pack}\` (${e.size_class}): ` +
                    `${e.visible_count} visible / budget ${e.budget} ` +
                    `(+${e.over_by}) — new: ${v.new_commands.join(', ')}\n`,
            );
        }
        process.stdout.write(
            '\nResolve by one of: set the command to `tier: 2` (internal, ' +
                'uncapped) · merge into a sibling cluster · relocate to a pack ' +
                'with budget headroom · file a budget-exemption ADR ' +
                '(docs/contracts/capability-packs.md § Budget exemption process).\n',
        );
        return 1;
    }
    if (!quiet) {
        let n = 0;
        for (const v of grew.values()) {
            n += v.length;
        }
        process.stdout.write(
            `✅  Budget gate: ${n} newly visible command(s) across ` +
                `${grew.size} pack(s); no pack over its size_class budget ` +
                `(baseline: ${baseline}).\n`,
        );
    }
    return 0;
}

// --- json.dumps(indent=2) replica (ensure_ascii default, insertion order) ---

function _jsonDumpsIndent2(obj: unknown): string {
    const pad = '  ';
    const enc = (value: unknown, depth: number): string => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    };
    const encStr = (s: string): string => {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    };
    return enc(obj, 0);
}

/** asdict(Command) — fields in dataclass declaration order. */
function _asdict(c: Command): Record<string, Json> {
    const out: Record<string, Json> = {};
    for (const f of COMMAND_FIELDS) {
        out[f] = c[f] as Json;
    }
    return out;
}

interface ParsedArgs {
    root: string;
    budget: boolean;
    check_new: boolean;
    baseline: string;
    quiet: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = {
        root: DEFAULT_ROOT(),
        budget: false,
        check_new: false,
        baseline: 'main',
        quiet: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const takeValue = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                return a.slice(eq + 1);
            }
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(
                    `audit_command_surface: error: argument ${flag}: expected one argument\n`,
                );
                process.exit(2);
            }
            i += 1;
            return next;
        };
        if (a === '--root' || a.startsWith('--root=')) {
            out.root = takeValue('--root');
        } else if (a === '--budget') {
            out.budget = true;
        } else if (a === '--check-new') {
            out.check_new = true;
        } else if (a === '--baseline' || a.startsWith('--baseline=')) {
            out.baseline = takeValue('--baseline');
        } else if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: audit_command_surface [-h] [--root ROOT] [--budget] [--check-new] [--baseline BASELINE] [--quiet]\n',
            );
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (!_exists(args.root)) {
        process.stderr.write(`error: ${args.root} does not exist\n`);
        return 2;
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });

    if (args.check_new) {
        return check_new_budget(args.baseline, args.quiet);
    }

    if (args.budget) {
        const commands = collect_all();
        const audit = build_budget_audit(commands, load_size_classes());
        fs.writeFileSync(OUT_BUDGET_JSON, _jsonDumpsIndent2(audit), 'utf-8');
        fs.writeFileSync(OUT_BUDGET_MD, render_budget_md(audit), 'utf-8');
        const over = audit.packs.filter((p) => p.over_budget);
        if (!args.quiet) {
            process.stdout.write(
                `✅  Budget audit: ${audit.total_commands} commands, ` +
                    `${over.length} pack(s) over budget.\n`,
            );
            for (const p of over) {
                process.stdout.write(
                    `   ⚠️  ${p.pack}: ${p.visible_count} visible / ` +
                        `budget ${p.budget} (+${p.over_by})\n`,
                );
            }
            process.stdout.write(`   JSON: ${_relPosix(OUT_BUDGET_JSON, REPO_ROOT)}\n`);
            process.stdout.write(`   MD:   ${_relPosix(OUT_BUDGET_MD, REPO_ROOT)}\n`);
        }
        return 0;
    }

    const commands = collect(args.root);
    const pairs = find_overlap_pairs(commands);

    fs.writeFileSync(
        OUT_JSON,
        _jsonDumpsIndent2({
            total: commands.length,
            thresholds: {
                overlap_cosine: OVERLAP_COSINE_THRESHOLD,
                low_signal_commit_count: LOW_SIGNAL_COMMIT_COUNT,
                low_signal_age_days: LOW_SIGNAL_AGE_DAYS,
            },
            commands: commands.map((c) => _asdict(c)),
            overlap_pairs: pairs as unknown as Json,
        }),
        'utf-8',
    );
    fs.writeFileSync(OUT_MD, render_md(commands, pairs), 'utf-8');

    if (!args.quiet) {
        process.stdout.write(`✅  Audited ${commands.length} commands.\n`);
        process.stdout.write(`   JSON: ${_relPosix(OUT_JSON, REPO_ROOT)}\n`);
        process.stdout.write(`   MD:   ${_relPosix(OUT_MD, REPO_ROOT)}\n`);
        process.stdout.write(
            `   Overlap pairs (cosine ≥ ${OVERLAP_COSINE_THRESHOLD}): ${pairs.length}\n`,
        );
        let lowN = 0;
        for (const c of commands) {
            if (
                c.commit_count &&
                c.commit_count <= LOW_SIGNAL_COMMIT_COUNT &&
                (c.days_since_first_commit ?? 0) <= LOW_SIGNAL_AGE_DAYS
            ) {
                lowN += 1;
            }
        }
        process.stdout.write(
            `   Low-signal (≤${LOW_SIGNAL_COMMIT_COUNT} commits, ≤${LOW_SIGNAL_AGE_DAYS}d): ${lowN}\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
