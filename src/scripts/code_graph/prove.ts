/**
 * `code-graph prove` (road-to-a-graph-that-wins 3.6) — the evidence bundle
 * behind every claim this engine makes about itself, read from a scorecard
 * (`internal/bench/scorecard.yaml`: row → metric → artefact → bar → expiry).
 *
 * It reports, it never scores: a row's verdict is only what its artefact
 * states, a missing artefact is named with the pattern that found nothing, and
 * an artefact older than its row's expiry reads `expired`. The one refusal is a
 * scorecard that cannot be read, because then there is no claim list to report.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { gitProbe } from '../_lib/spawn_env.js';
import { cacheFor, flag, resolveRoot } from './cli_args.js';
import { detectSources, graphState, pickSource, type GraphState } from './detect.js';

export const DEFAULT_SCORECARD = 'internal/bench/scorecard.yaml';
const DAY_MS = 86_400_000;

export class ScorecardError extends Error {}

export interface ScorecardRow {
    id: string;
    metric: string;
    artefact: string | string[];
    bar: string;
    expiry_days: number;
    role?: string;
    verdict_pattern?: string;
}

export interface Scorecard {
    version: number;
    registration?: string | undefined;
    corpus?: string | undefined;
    rows: ScorecardRow[];
}

export type ArtefactStatus = 'present' | 'missing' | 'expired';

export interface ResolvedArtefact {
    pattern: string;
    path: string | null;
    sha256: string | null;
    date: string | null;
    date_source: 'commit' | 'mtime' | null;
    status: ArtefactStatus;
}

export interface BundleRow {
    id: string;
    role: string | null;
    metric: string;
    bar: string;
    expiry_days: number;
    status: ArtefactStatus;
    artefacts: ResolvedArtefact[];
    verdict: string | null;
}

export interface ProveBundle {
    generated_at: string;
    scorecard: string;
    corpus: {
        path: string | null;
        registration: string | null;
        registered_sha256: string | null;
        actual_sha256: string | null;
        matches: boolean | null;
        reason?: string;
    };
    rows: BundleRow[];
    oracle_version: string | null;
    oracle_version_reason?: string;
    resolved_via_histogram: Record<string, number> | null;
    resolved_via_reason?: string;
    graph: { path: string | null; state: GraphState };
    counterfactual_review: BundleRow | null;
    counterfactual_review_reason?: string;
}

export interface ProveOptions {
    root: string;
    scorecardPath: string;
    /** The graph whose `resolved_via` histogram and staleness the bundle states; default the detected source. */
    graphPath?: string | null;
    now?: Date;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v !== '';

function readScorecard(p: string): Scorecard {
    let raw: unknown;
    try {
        raw = parseYaml(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
        throw new ScorecardError(`scorecard unreadable: ${p} — ${(e as Error).message}`);
    }
    const doc = raw as Partial<Scorecard> | null;
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.rows)) throw new ScorecardError(`scorecard has no \`rows\` list: ${p}`);
    const rows: ScorecardRow[] = [];
    for (const [i, r] of (doc.rows as unknown[]).entries()) {
        const row = r as Partial<ScorecardRow> | null;
        const artefactOk = isStr(row?.artefact) || (Array.isArray(row?.artefact) && row.artefact.length > 0 && row.artefact.every(isStr));
        if (!row || !isStr(row.id) || !isStr(row.metric) || !isStr(row.bar) || !artefactOk || typeof row.expiry_days !== 'number' || row.expiry_days <= 0)
            throw new ScorecardError(`scorecard row ${i} needs id, metric, artefact, bar and a positive expiry_days: ${p}`);
        rows.push(row as ScorecardRow);
    }
    return { version: typeof doc.version === 'number' ? doc.version : 1, registration: doc.registration, corpus: doc.corpus, rows };
}

function sha256File(p: string): string {
    return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/** A directory hashes as the sorted list of `relpath\0sha256` lines of the files under it. */
function sha256Dir(dir: string): string {
    const lines: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.isFile()) lines.push(`${path.relative(dir, p)}\0${sha256File(p)}`);
        }
    };
    walk(dir);
    return createHash('sha256').update(lines.join('\n')).digest('hex');
}

/** Matches for a pattern whose `*` may appear in the last segment only; newest name last. */
function matchPattern(root: string, pattern: string): string[] {
    const abs = path.resolve(root, pattern);
    const base = path.basename(abs);
    if (!base.includes('*')) return fs.existsSync(abs) ? [abs] : [];
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) return [];
    const re = new RegExp(`^${base.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    return fs
        .readdirSync(dir)
        .filter((n) => re.test(n))
        .sort()
        .map((n) => path.join(dir, n));
}

/** Last commit date when the file is tracked and unchanged; its mtime otherwise. */
function artefactDate(root: string, abs: string): { date: Date; source: 'commit' | 'mtime' } {
    const rel = path.relative(root, abs);
    try {
        const committed = gitProbe(root, ['log', '-1', '--format=%cI', '--', rel], { timeout: 5_000 }).trim();
        const dirty = gitProbe(root, ['status', '--porcelain', '--', rel], { timeout: 5_000 }).trim();
        if (committed !== '' && dirty === '') return { date: new Date(committed), source: 'commit' };
    } catch {
        // Not a repository, or git is unavailable: the file's own mtime is all that is known.
    }
    return { date: fs.statSync(abs).mtime, source: 'mtime' };
}

function resolveArtefact(root: string, pattern: string, expiryDays: number, now: Date): ResolvedArtefact {
    const hit = matchPattern(root, pattern).at(-1);
    if (!hit) return { pattern, path: null, sha256: null, date: null, date_source: null, status: 'missing' };
    const { date, source } = artefactDate(root, hit);
    const expired = now.getTime() - date.getTime() > expiryDays * DAY_MS;
    return {
        pattern,
        path: path.relative(root, hit),
        sha256: fs.statSync(hit).isDirectory() ? sha256Dir(hit) : sha256File(hit),
        date: date.toISOString(),
        date_source: source,
        status: expired ? 'expired' : 'present',
    };
}

const DEFAULT_VERDICT = /^\*\*(?:Result|Verdict):\s*([^*]+?)\*\*/im;

/** The verdict the artefact itself states — never one computed here. */
function statedVerdict(root: string, a: ResolvedArtefact, pattern?: string): string | null {
    if (!a.path) return null;
    const abs = path.join(root, a.path);
    if (!fs.statSync(abs).isFile()) return null;
    const text = fs.readFileSync(abs, 'utf-8');
    const re = pattern ? new RegExp(pattern, 'm') : DEFAULT_VERDICT;
    const m = re.exec(text);
    return m ? (m[1] ?? m[0]).trim() : null;
}

const RANK: Record<ArtefactStatus, number> = { present: 0, expired: 1, missing: 2 };

function resolveRow(root: string, row: ScorecardRow, now: Date): BundleRow {
    const patterns = Array.isArray(row.artefact) ? row.artefact : [row.artefact];
    const artefacts = patterns.map((p) => resolveArtefact(root, p, row.expiry_days, now));
    const status = artefacts.reduce<ArtefactStatus>((worst, a) => (RANK[a.status] > RANK[worst] ? a.status : worst), 'present');
    const first = artefacts[0] as ResolvedArtefact;
    return {
        id: row.id,
        role: row.role ?? null,
        metric: row.metric,
        bar: row.bar,
        expiry_days: row.expiry_days,
        status,
        artefacts,
        verdict: statedVerdict(root, first, row.verdict_pattern),
    };
}

/** The SHA-256 a registration's Hashes block binds to `corpus`. */
function registeredSha(root: string, registration: string, corpus: string): string | null {
    const text = fs.readFileSync(path.resolve(root, registration), 'utf-8');
    for (const line of text.split('\n')) {
        const m = /^([0-9a-f]{64})\s+(\S+)\s*$/.exec(line.trim());
        if (m && m[2] === corpus) return m[1] as string;
    }
    return null;
}

function corpusBlock(root: string, sc: Scorecard): ProveBundle['corpus'] {
    const base = { path: sc.corpus ?? null, registration: sc.registration ?? null };
    if (!sc.corpus || !sc.registration) return { ...base, registered_sha256: null, actual_sha256: null, matches: null, reason: 'scorecard names no registration/corpus pair' };
    if (!fs.existsSync(path.resolve(root, sc.registration)))
        return { ...base, registered_sha256: null, actual_sha256: null, matches: null, reason: `registration not found: ${sc.registration}` };
    const registered = registeredSha(root, sc.registration, sc.corpus);
    const corpusAbs = path.resolve(root, sc.corpus);
    const actual = fs.existsSync(corpusAbs) ? sha256File(corpusAbs) : null;
    const reason = registered === null ? `the registration's Hashes block does not bind ${sc.corpus}` : actual === null ? `corpus not found: ${sc.corpus}` : undefined;
    return { ...base, registered_sha256: registered, actual_sha256: actual, matches: registered !== null && actual !== null ? registered === actual : null, ...(reason ? { reason } : {}) };
}

/** `(indexer version)` from the header line the edge-oracle runner writes. */
function oracleVersion(root: string, rows: BundleRow[]): { version: string | null; reason?: string } {
    const row = rows.find((r) => r.role === 'edge-oracle');
    if (!row) return { version: null, reason: 'scorecard has no row with role edge-oracle' };
    const a = row.artefacts.find((x) => x.path !== null);
    if (!a?.path) return { version: null, reason: `no edge-oracle report matches ${row.artefacts.map((x) => x.pattern).join(', ')}` };
    const m = /· index `[^`]*` \(([^)]+)\)/.exec(fs.readFileSync(path.join(root, a.path), 'utf-8'));
    return m ? { version: (m[1] as string).trim() } : { version: null, reason: `${a.path} states no indexer in its header` };
}

function histogram(graphPath: string | null): { counts: Record<string, number> | null; reason?: string } {
    if (!graphPath) return { counts: null, reason: 'no code-graph source found' };
    let g: { edges?: unknown; links?: unknown };
    try {
        g = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    } catch (e) {
        return { counts: null, reason: `graph unreadable: ${(e as Error).message}` };
    }
    const edges = Array.isArray(g.edges) ? g.edges : Array.isArray(g.links) ? g.links : null;
    if (!edges) return { counts: null, reason: 'graph carries no edge list' };
    const counts: Record<string, number> = {};
    for (const e of edges as Array<{ resolved_via?: unknown }>) {
        const via = typeof e.resolved_via === 'string' ? e.resolved_via : '(none)';
        counts[via] = (counts[via] ?? 0) + 1;
    }
    return { counts: Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) };
}

export function buildBundle(opts: ProveOptions): ProveBundle {
    const now = opts.now ?? new Date();
    const sc = readScorecard(opts.scorecardPath);
    const rows = sc.rows.map((r) => resolveRow(opts.root, r, now));
    let graphPath = opts.graphPath ?? null;
    if (graphPath === null) {
        const picked = pickSource(detectSources(opts.root, cacheFor(opts.root)));
        graphPath = picked && picked.kind !== 'scip' ? picked.path : null;
    }
    const hist = histogram(graphPath && fs.existsSync(graphPath) ? graphPath : null);
    const oracle = oracleVersion(opts.root, rows);
    const cf = rows.find((r) => r.role === 'counterfactual-review') ?? null;
    const cfRun = cf !== null && cf.status !== 'missing';
    return {
        generated_at: now.toISOString(),
        scorecard: path.relative(opts.root, opts.scorecardPath) || opts.scorecardPath,
        corpus: corpusBlock(opts.root, sc),
        rows,
        oracle_version: oracle.version,
        ...(oracle.reason ? { oracle_version_reason: oracle.reason } : {}),
        resolved_via_histogram: hist.counts,
        ...(hist.reason ? { resolved_via_reason: hist.reason } : {}),
        graph: { path: graphPath, state: graphState(opts.root, graphPath ?? undefined) },
        counterfactual_review: cfRun ? cf : null,
        ...(cfRun ? {} : { counterfactual_review_reason: cf ? `not run — no artefact matches ${cf.artefacts.map((a) => a.pattern).join(', ')}` : 'not run — scorecard has no counterfactual-review row' }),
    };
}

/** `prove [--scorecard P] [--graph P] [--out P] [--root P]` — exit 0 when the bundle is emitted, 1 when the scorecard is unreadable. */
export function proveMain(argv: string[]): number {
    const root = resolveRoot(argv);
    const scorecardPath = path.resolve(root, flag(argv, '--scorecard') ?? DEFAULT_SCORECARD);
    const graph = flag(argv, '--graph');
    let bundle: ProveBundle;
    try {
        bundle = buildBundle({ root, scorecardPath, graphPath: graph ? path.resolve(graph) : null });
    } catch (e) {
        if (e instanceof ScorecardError) {
            process.stderr.write(`code-graph prove: ${e.message}\n`);
            return 1;
        }
        throw e;
    }
    const json = `${JSON.stringify(bundle, null, 2)}\n`;
    const out = flag(argv, '--out');
    if (out) {
        const abs = path.resolve(out);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, json);
        const missing = bundle.rows.filter((r) => r.status !== 'present').length;
        process.stdout.write(`bundle: ${abs} — ${bundle.rows.length} rows, ${missing} not present\n`);
    } else process.stdout.write(json);
    return 0;
}
