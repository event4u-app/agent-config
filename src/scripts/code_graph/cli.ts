#!/usr/bin/env tsx
/**
 * Native code-graph engine CLI (Class-A, ADR-124).
 *
 *   build    [--root P] [--out P] [--force]   (re)build the deterministic graph
 *   validate [--graph P]                       schema-gate a graph.json
 *   detect   [--root P] [--format json]        three-state freshness verdict
 *   refresh  [--root P] [--out P] [--budget-seconds N]
 *                                               build --update (STALE) / no-op
 *                                               (FRESH) / full build (ABSENT)
 *
 * `detect --format json` (Phase 2, road-to-reachable-code-memory) emits a
 * single-line, stable-key-order JSON verdict on stdout — no timestamps, safe
 * to diff or pipe to `jq`:
 *
 *   { "verdict": "ABSENT" | "STALE" | "FRESH",
 *     "behind_commits": <n> | null,
 *     "source": { "kind": "consumer" | "scip" | "native", "path": "…" } | null,
 *     "sources": [ { "kind": …, "path": "…", "present": true, … }, … ] }
 *
 * `refresh` never blocks on a hung build: it spawns the actual `build` in a
 * CHILD process against a temp `--out` path, under a hard wall-clock
 * `--budget-seconds` (default 60, via SIGKILL). The real cache at `--out` is
 * only ever touched by a same-directory atomic rename of that child's
 * completed temp output — on budget-exceeded, build failure, or the child
 * never producing output, the rename never happens and the OLD cache is left
 * byte-for-byte untouched. The cache itself (default
 * `agents/runtime/state/code-graph-v1.json`) is local-only and disposable —
 * gitignored, rebuildable from source at any time; never a source of truth.
 *
 * Query subcommands (query/path/explain/affected) are added by the Phase-3
 * query tier. Deterministic, LLM-free, no network. Exit codes:
 * 0 ok · 1 not-found / validation-failed / refresh-budget-exceeded ·
 * 2 usage · 3 internal.
 *
 *   suggest-verb "<question>"                  (Phase 9 D3) print the verb
 *                                               (query/affected/path/explain)
 *                                               a regex table thinks best
 *                                               answers a free-text structure
 *                                               question — a standalone hint,
 *                                               never auto-run against a
 *                                               graph.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { buildFromRepo, sidecarPath } from './build.js';
import { computeVerdict, detectSources, pickSource } from './detect.js';
import { suggestVerb } from './intent.js';
import {
    affected,
    explain,
    loadGraph,
    type LoadedGraph,
    mergeRecommendedReads,
    path as graphPath,
    query,
    type QueryResult,
} from './query.js';
import { validateGraph } from './validate.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
export const DEFAULT_CACHE = path.join(REPO_ROOT, 'agents', 'runtime', 'state', 'code-graph-v1.json');
/** Local `tsx` binary — `refresh` spawns `build` as a child of THIS file
 * through it, so a budget-exceeded kill only ever terminates the child. */
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const DEFAULT_BUDGET_SECONDS = 60;

function flag(argv: string[], name: string): string | null {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

/**
 * Resolve the repository to operate on. `--root` > `AGENT_CONFIG_PROJECT_ROOT` >
 * this module's own tree.
 *
 * The middle rung is the whole point, and its absence was a confused deputy:
 * `_dispatch.bash` parses `--root` GLOBALLY, strips it from argv, and exports
 * `AGENT_CONFIG_PROJECT_ROOT` (`:1655`) — then this engine read neither and fell
 * back to its own module path. So `agent-config code-graph build --root <other
 * repo>` silently indexed THIS package. The dispatcher made the decision and the
 * engine substituted its own, which is why every consumer-facing invocation was
 * wrong about which repository it had just read.
 *
 * `realpathSync` rather than `resolve` alone: a symlinked root must normalise to
 * what will actually be walked, or the path a caller sees in the output is not
 * the path that was indexed. Fail-loud on a root that does not exist — a silent
 * fallback to the package tree is the defect this function exists to remove, and
 * reintroducing it for a typo'd path would be the same bug wearing a smaller
 * hat.
 *
 * Deliberately NOT touching `DEFAULT_CACHE`, which is anchored to `REPO_ROOT`
 * for the same reason and is a separate decision: it is a WRITE path, with its
 * own ownership, cleanup, concurrency and multi-repo namespacing questions.
 * Council 2026-08-22, both seats, explicitly out of scope here.
 */
function resolveRoot(argv: string[]): string {
    const explicit = flag(argv, '--root');
    const fromDispatcher = process.env['AGENT_CONFIG_PROJECT_ROOT'];
    const candidate =
        explicit ?? (fromDispatcher !== undefined && fromDispatcher !== '' ? fromDispatcher : REPO_ROOT);
    try {
        return fs.realpathSync(path.resolve(candidate));
    } catch {
        // Returned unresolved on purpose: every caller checks existence and
        // prints the path it was given, which is more useful in the error than
        // a normalised form of a path that does not exist.
        return path.resolve(candidate);
    }
}

async function cmdBuild(argv: string[]): Promise<number> {
    const root = resolveRoot(argv);
    const out = argv.includes('--out') ? flag(argv, '--out') : DEFAULT_CACHE;
    if (!fs.existsSync(root)) {
        process.stderr.write(`code-graph: root not found: ${root}\n`);
        return 1;
    }
    const update = argv.includes('--update');
    const { graph, fileCount, reExtracted, reused } = await buildFromRepo(root, out, { update });
    const c = graph.edge_confidence_counts;
    process.stdout.write(
        `✅  code-graph ${update ? 'updated' : 'built'} — ${fileCount} files · ${graph.nodes.length} nodes · ${graph.edges.length} edges\n` +
            `    languages: ${graph.languages.join(', ') || '(none)'} · grammar ABI ${graph.grammar_abi}\n` +
            `    edges: EXTRACTED ${c.EXTRACTED} · INFERRED ${c.INFERRED} · AMBIGUOUS ${c.AMBIGUOUS}\n` +
            (update ? `    incremental: ${reExtracted} re-extracted · ${reused} reused\n` : '') +
            (out ? `    cache: ${path.relative(REPO_ROOT, out)}\n` : ''),
    );
    return 0;
}

function cmdValidate(argv: string[]): number {
    const p = flag(argv, '--graph') ?? DEFAULT_CACHE;
    if (!fs.existsSync(p)) {
        process.stderr.write(`code-graph: graph not found: ${p}\n`);
        return 1;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
        process.stderr.write(`code-graph: graph is not valid JSON: ${(e as Error).message}\n`);
        return 1;
    }
    const r = validateGraph(parsed);
    if (r.ok) {
        process.stdout.write(`✅  graph schema valid: ${path.relative(REPO_ROOT, p)}\n`);
        return 0;
    }
    process.stderr.write(`❌  graph schema invalid (${r.errors.length}):\n`);
    for (const e of r.errors) process.stderr.write(`  ${e}\n`);
    return 1;
}

function resolveGraph(argv: string[]): { g: LoadedGraph; note: string } | { err: string } {
    const explicit = flag(argv, '--graph');
    const root = resolveRoot(argv);
    if (explicit) {
        if (!fs.existsSync(explicit)) return { err: `graph not found: ${explicit}` };
        return { g: loadGraph(explicit, path.relative(REPO_ROOT, explicit)), note: '' };
    }
    const picked = pickSource(detectSources(root, DEFAULT_CACHE));
    if (!picked) return { err: 'no code-graph source found — run `code_graph build` or ship a graph.json' };
    if (picked.kind === 'scip') return { err: `${picked.note ?? 'SCIP detected'} — pass --graph <json> or install peer tooling` };
    const staleNote = picked.stale ? ` ⚠ index is ${picked.commits_behind ?? 'N'} commit(s) behind — rebuild before trusting` : '';
    return { g: loadGraph(picked.path, `${picked.kind}:${path.relative(REPO_ROOT, picked.path)}`), note: staleNote };
}

function render(r: QueryResult, staleNote: string): number {
    process.stdout.write(`source: ${r.source}${staleNote}\n`);
    if (r.seeds.length) process.stdout.write(`seeds: ${r.seeds.join(', ')}\n`);
    for (const l of r.lines) process.stdout.write(`  ${l}\n`);
    if (r.truncated) process.stdout.write('  … (budget reached — narrow the seed or raise --budget)\n');
    if (!r.lines.length) process.stdout.write('  (no matching relations)\n');
    if (r.recommended_reads.length) {
        process.stdout.write('recommended reads (dropped by the budget, or a low-confidence seed match):\n');
        for (const rr of r.recommended_reads) process.stdout.write(`  ${rr.path}${rr.lines ? `:${rr.lines[0]}-${rr.lines[1]}` : ''}\n`);
    }
    return 0;
}

function budgetOf(argv: string[]): number {
    const b = Number(flag(argv, '--budget'));
    return Number.isFinite(b) && b > 0 ? b : 1500;
}

function changedNodeSeeds(g: LoadedGraph, root: string, ref: string): string[] {
    let files: string[];
    try {
        files = execFileSync('git', ['-C', root, 'diff', '--name-only', `${ref}..HEAD`], {
            env: hardenedSpawnEnv(),
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    } catch {
        return [];
    }
    const set = new Set(files);
    return g.graph.nodes.filter((n) => set.has(n.source_file) && n.kind !== 'file').map((n) => n.id);
}

function cmdQuery(kind: 'query' | 'explain' | 'affected' | 'path', argv: string[]): number {
    const r = resolveGraph(argv);
    if ('err' in r) {
        process.stderr.write(`code-graph: ${r.err}\n`);
        return 1;
    }
    const positional = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    const budget = budgetOf(argv);
    if (kind === 'affected' && flag(argv, '--since')) {
        const root = resolveRoot(argv);
        const seeds = changedNodeSeeds(r.g, root, flag(argv, '--since') as string);
        const merged: QueryResult = { source: r.g.source, seeds: [], lines: [], truncated: false, recommended_reads: [] };
        const perSeed: QueryResult[] = [];
        for (const s of seeds) {
            const one = affected(r.g, s, 2, budget);
            merged.seeds.push(...one.seeds);
            merged.lines.push(...one.lines);
            merged.truncated = merged.truncated || one.truncated;
            perSeed.push(one);
        }
        merged.recommended_reads = mergeRecommendedReads(perSeed);
        return render(merged, r.note);
    }
    const a = positional[0];
    if (!a) {
        process.stderr.write(`usage: code_graph/cli.ts ${kind} <symbol> [--graph P] [--budget N]\n`);
        return 2;
    }
    if (kind === 'path') {
        const b = positional[1];
        if (!b) {
            process.stderr.write('usage: code_graph/cli.ts path <a> <b>\n');
            return 2;
        }
        return render(graphPath(r.g, a, b, budget), r.note);
    }
    const fn = kind === 'query' ? query : kind === 'explain' ? explain : affected;
    return render(fn(r.g, a, budget), r.note);
}

function isFlagValue(argv: string[], token: string): boolean {
    const i = argv.indexOf(token);
    return i > 0 && (argv[i - 1] as string).startsWith('--');
}

function cmdDetect(argv: string[]): number {
    const root = resolveRoot(argv);
    if (flag(argv, '--format') === 'json') {
        // Machine-readable three-state verdict (Phase 2). Existing human-text
        // output below is unchanged for existing consumers.
        process.stdout.write(`${JSON.stringify(computeVerdict(root, DEFAULT_CACHE))}\n`);
        return 0;
    }
    const verdicts = detectSources(root, DEFAULT_CACHE);
    if (!verdicts.length) {
        process.stdout.write('no code-graph source detected\n');
        return 1;
    }
    for (const v of verdicts) {
        const fresh = v.stale === undefined ? '' : v.stale ? ` · STALE${v.commits_behind !== undefined ? ` (${v.commits_behind} behind)` : ''}` : ' · fresh';
        process.stdout.write(`${v.kind.padEnd(9)} ${path.relative(REPO_ROOT, v.path)}${fresh}${v.note ? ` · ${v.note}` : ''}\n`);
    }
    const picked = pickSource(verdicts);
    if (picked) process.stdout.write(`→ query would use: ${picked.kind}\n`);
    return 0;
}

function budgetSecondsOf(argv: string[]): number {
    const raw = flag(argv, '--budget-seconds');
    if (raw === null) return DEFAULT_BUDGET_SECONDS;
    const n = Number(raw);
    return Number.isFinite(n) ? n : DEFAULT_BUDGET_SECONDS;
}

/** Best-effort removal of a temp build output + its sidecar. Never throws —
 * cleanup failure must not mask the real result (budget-exceeded / error). */
function cleanupTemp(tmpOut: string): void {
    for (const p of [tmpOut, sidecarPath(tmpOut)]) {
        try {
            fs.unlinkSync(p);
        } catch {
            /* already absent, or never materialised — fine */
        }
    }
}

/**
 * Run `build` (optionally `--update`) as a CHILD process against a temp
 * `--out` path, under a hard wall-clock budget. Only on a clean, in-budget
 * exit does the temp output get promoted into `out` — via a same-directory
 * `renameSync`, atomic at the OS level, exactly the technique `write_atomic`
 * itself uses. Any other outcome (timeout, non-zero exit, missing output)
 * cleans up the temp files and leaves `out` untouched.
 */
function runBudgetedBuild(root: string, out: string, update: boolean, budgetSeconds: number): number {
    if (!(budgetSeconds > 0)) {
        // Node's own `timeout` option treats 0 as "no limit" — a genuinely
        // zero-or-negative budget is an immediate, deterministic abort
        // instead of silently becoming unlimited.
        process.stderr.write(`code-graph: refresh budget exceeded (${budgetSeconds}s) — old cache kept\n`);
        return 1;
    }
    const dir = path.dirname(out);
    const tmpOut = path.join(dir, `.${path.basename(out)}.refresh-tmp-${process.pid}-${randomBytes(4).toString('hex')}.json`);
    if (update) {
        const realSidecar = sidecarPath(out);
        if (fs.existsSync(realSidecar)) {
            try {
                fs.copyFileSync(realSidecar, sidecarPath(tmpOut));
            } catch {
                /* fall back to a full re-extraction inside the child */
            }
        }
    }
    const args = ['build', '--root', root, '--out', tmpOut, ...(update ? ['--update'] : [])];
    const res = spawnSync(TSX_BIN, [_HERE, ...args], {
        env: hardenedSpawnEnv(),
        stdio: 'ignore',
        timeout: Math.round(budgetSeconds * 1000),
        killSignal: 'SIGKILL',
    });
    const timedOut = res.signal !== null || (res.error !== undefined && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT');
    if (timedOut) {
        cleanupTemp(tmpOut);
        process.stderr.write(`code-graph: refresh budget exceeded (${budgetSeconds}s) — old cache kept\n`);
        return 1;
    }
    if (res.status !== 0) {
        cleanupTemp(tmpOut);
        const detail = res.error ? `: ${res.error.message}` : res.status !== null ? ` (exit ${res.status})` : '';
        process.stderr.write(`code-graph: refresh build failed${detail} — old cache kept\n`);
        return 1;
    }
    if (!fs.existsSync(tmpOut)) {
        cleanupTemp(tmpOut);
        process.stderr.write('code-graph: refresh produced no output — old cache kept\n');
        return 3;
    }
    fs.renameSync(tmpOut, out); // same-dir → atomic; real cache only ever changes here
    const tmpSidecar = sidecarPath(tmpOut);
    if (fs.existsSync(tmpSidecar)) fs.renameSync(tmpSidecar, sidecarPath(out));
    process.stdout.write(`✅  code-graph refreshed — cache: ${path.relative(REPO_ROOT, out)}\n`);
    return 0;
}

function cmdRefresh(argv: string[]): number {
    const root = resolveRoot(argv);
    const out = flag(argv, '--out') ?? DEFAULT_CACHE;
    const budgetSeconds = budgetSecondsOf(argv);
    if (!fs.existsSync(root)) {
        process.stderr.write(`code-graph: root not found: ${root}\n`);
        return 1;
    }
    const v = computeVerdict(root, out);
    if (v.verdict === 'FRESH') {
        process.stdout.write('fresh — nothing to do\n');
        return 0;
    }
    return runBudgetedBuild(root, out, v.verdict === 'STALE', budgetSeconds);
}

/**
 * `suggest-verb "<question>"` (Phase 9 D3) — print the `code_graph` verb a
 * pure regex table thinks best answers a free-text structure question. A
 * standalone hint only: never resolves a graph, never runs a query itself.
 */
function cmdSuggestVerb(argv: string[]): number {
    const question = argv.filter((a) => !a.startsWith('--')).join(' ').trim();
    if (!question) {
        process.stderr.write('usage: code_graph/cli.ts suggest-verb "<question>"\n');
        return 2;
    }
    process.stdout.write(`${suggestVerb(question)}\n`);
    return 0;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
    const sub = argv[0];
    try {
        if (sub === 'build') return await cmdBuild(argv.slice(1));
        if (sub === 'validate') return cmdValidate(argv.slice(1));
        if (sub === 'detect') return cmdDetect(argv.slice(1));
        if (sub === 'refresh') return cmdRefresh(argv.slice(1));
        if (sub === 'query' || sub === 'explain' || sub === 'affected' || sub === 'path')
            return cmdQuery(sub, argv.slice(1));
        if (sub === 'suggest-verb') return cmdSuggestVerb(argv.slice(1));
        process.stderr.write(
            'usage: code_graph/cli.ts <build|validate|detect|refresh|query|explain|affected|path|suggest-verb> [options]\n',
        );
        return 2;
    } catch (e) {
        process.stderr.write(`code-graph: internal error: ${(e as Error).message}\n`);
        return 3;
    }
}

const _invokedDirectly = (() => {
    if (process.argv[1] === undefined) return false;
    try {
        return fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(_HERE);
    } catch {
        return import.meta.url === `file://${process.argv[1]}`;
    }
})();
if (_invokedDirectly) {
    main().then((rc) => process.exit(rc));
}
