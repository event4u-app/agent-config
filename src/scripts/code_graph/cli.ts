#!/usr/bin/env tsx
/**
 * Native code-graph engine CLI (Class-A, ADR-124).
 *
 *   build    [--root P] [--out P] [--force]   (re)build the deterministic graph
 *            [--no-lanes]                      and merge every lane reader's facts
 *            [--check-fixture-findings]        exit 1 when a default-view finding or a
 *                                               tour lies outside product scope
 *   validate [--graph P]                       schema-gate a graph.json
 *   detect   [--root P] [--format json]        three-state freshness verdict
 *   refresh  [--root P] [--out P] [--budget-seconds N]
 *            [--single-flight] [--map]          build --update (STALE) / no-op
 *                                               (FRESH) / full build (ABSENT);
 *                                               a result built while HEAD moved
 *                                               is discarded and retried once
 *            [--allow-shrink]                  a result that loses more than a
 *                                               set share of facts with no matching
 *                                               change in the tree is refused unless
 *   refresh --touched [file…]                   re-read changed files into the
 *                                               working-tree overlay (`verify/`)
 *   confirm <id…> | --from-query <symbol>       re-read the witnesses of facts
 *   pack "<task>" [--diff] [--since <rev>]      a verified context pack
 *   rebuild-diff                                incremental vs cold build
 *   auto-refresh on|off|status [--root P]      opt this project in to the
 *                                               session-start background refresh
 *   projects list|add|remove|prune             the user-global registry of
 *                                               projects this machine works in
 *                                               (ADR-299, `projects_cli.ts`)
 *   estate where-used|projects-using|          estate questions from the local
 *          advisory-impact                     index alone (`estate_cli.ts`)
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
 * `agents/map/.build/code-graph-v1.json`; for a root without `agents/` or a
 * project install, the hub's `map/<repo id>-<checkout>/.build/`, ADR-299 and
 * ADR-303; a cache an older release left at `agents/runtime/state/` is still
 * read) is local-only and disposable — gitignored, rebuildable from source at
 * any time; never a source of truth.
 *
 *   impact    --diff <rev> [--depth N]      callers/dependents/test files
 *                                             reachable from the changed
 *                                             symbols over ACCEPTED edges
 *             [--regressions F]               the registry's regressions whose
 *                                             guards that neighbourhood reaches
 *   review-risk [--diff <rev>] [--json]       the diff as a sum of terms (callers,
 *               [--format markdown]           (markdown: the sticky PR comment)
 *                                             entry points, flows, co-change
 *                                             partners, areas, columns,
 *                                             operations, pipelines), each fact
 *                                             with its witness
 *   --include-guesses                         query, explain, affected, path,
 *                                             review-risk and pack walk stated
 *                                             edges only; this adds the guesses,
 *                                             each marked `(guess: <via>)`
 *   why <package[@version]>                   every path from a declaration to the
 *                                             package, from the lockfiles (offline)
 *   usage <package>                           the public names the code uses, of how
 *                                             many — only with the package installed
 *   remove-plan <package>                     call sites, non-import uses, dependents
 *                                             and packages leaving with it: a proposal
 *   provenance <ticket|#pr|file|symbol>       since when, by which commit, PR and
 *                                             ticket — from the local history only
 *   branches [index [ref…] | gc | list]       facts per branch without a checkout:
 *                                             index the default set (current, its
 *                                             parent chain, recently checked out) or
 *                                             named refs; gc drops stale branches
 *   branch-diff <a> [<b>]                     files, symbols, packages, tables and
 *                                             columns that differ (b = current)
 *   on-branches <package|table.column|symbol|file>  the indexed branches holding it
 *   tests-for <symbol>                        test files importing the symbol
 *   untested  --diff <rev>                    changed symbols no test imports
 *   dead      [--entry-points F]              zero accepted in-edges, minus
 *             [--accept-missing-exports]      declared entry points; REFUSES
 *                                             when a source is unavailable
 *
 * The four gate verbs (3.1–3.3) each print the `resolved_via` histogram of the
 * edges they accepted AND of the edges they refused to walk, plus the graph's
 * three-state staleness — so a caller can tell "no callers" from "no callers I
 * would trust", and "dead" from "dead as of a graph 40 commits behind".
 *
 * Every verb that reads a graph also takes `--project <id|name|path>`: a
 * project in the user-global registry, resolved to its root and graph home
 * (ADR-299). Only a registered project resolves.
 *
 * query/explain/affected also take [--kind K,..] [--relation R,..] [--direction
 * in|out|both] [--depth 1-3] [--limit N]: any of them answers a filtered tree,
 * each item with its witness, `returned of total`, and the population searched.
 *
 * Query subcommands (query/path/explain/affected) are added by the Phase-3
 * query tier. Deterministic, LLM-free, no network. Exit codes:
 * 0 ok · 1 not-found / validation-failed / refresh-budget-exceeded ·
 * 2 usage · 3 internal.
 *
 *   open     [--root P] [--out DIR]           open the drawn map in the browser
 *                                               without redrawing it
 *   map      [--root P] [--out DIR] [--open]  draw the project map into
 *            [--no-verify] [--diff <rev>]      agents/map/ (ADR-297, ADR-303), or the
 *                                               hub's <repo id>-<checkout>/ (ADR-299); renders it
 *            [--prs]                           (open PRs by area, via gh)
 *            [--branches]                      (the indexed branches and how each differs
 *                                               from this one — local state, so off by default)
 *                                               at three widths when Playwright
 *                                               is present
 *   map --demo [--out DIR] [--open]           the map and the hub drawn from the demo
 *            [--no-verify]                     fixture, into agents/map/.build/demo/ — for
 *                                               frontend work; source checkout only
 *   map --estate [--out DIR] [--no-verify]     the hub: the registered projects, their
 *                                               links and the facts they share, under the
 *                                               user-global map/; refused inside a git work tree
 *
 *   verify   --all [--min-rate R] [--json]     confirm rate per lane over every lane
 *                                               fact and edge, witness read by its kind
 *   lint     [--root P] [--graph P]           the endpoint contract: duplicate ids,
 *                                               invalid spans, dangling sources and
 *                                               targets; exit 1 on any (`lint.ts`)
 *   scope    <path…> [--root P]                which scope a path is in and the rule
 *                                               that decided (`scope.ts`, `layers.yaml` scope:)
 *   suggest-verb "<question>"                  (Phase 9 D3) print the verb
 *                                               (query/affected/path/explain)
 *                                               a regex table thinks best
 *                                               answers a free-text structure
 *                                               question — a standalone hint,
 *                                               never auto-run against a
 *                                               graph.
 */
import { gcBranches } from './branches.js';
import { fixtureScopeProblems, produceAreas } from './map_area_payloads.js';
import { lintGraph } from './lint.js';
import { explainScope, readScopeRules } from './scope.js';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { gitProbe, hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { buildFromRepo, discoverFiles, isTestFile, type LaneSummary, sidecarPath } from './build.js';
import { selectionVerdict, selectRegressionsFromCode, type RegressionSpec } from '../_lib/regression_neighbourhood.js';
import { capAnswer, capReviewRisk, parseDetail } from './answer_detail.js';
import { diffHunks, renderReviewRisk, renderReviewRiskMarkdown, reviewRisk } from './review_risk.js';
import { DOC_EXTS } from './docs_layer.js';
import {
    computeVerdict,
    detectSources,
    type GraphState,
    graphState,
    pickSource,
} from './detect.js';
import { graphHome } from './graph_home.js';
import { suggestVerb } from './intent.js';
import { estateMain } from './estate_cli.js';
import { estateMapMain } from './estate_map.js';
import { touchHome } from './graph_budget.js';
import { projectsMain, registerUse } from './projects_cli.js';
import { buildMap, graphGeneration, hasMap, mapGeneration, recordOutcome } from './map.js';
import { cliPackage, usableCli } from './refresh_cli.js';
import {
    STALE_LOCK_MS,
    acquire as acquireRefreshLock,
    pidAlive,
    readRefreshRecords,
    reclaimMutexPath,
    recordRefresh,
} from './refresh_lock.js';
import { verifyMap } from './map_verify.js';
import {
    affected,
    explain,
    loadGraph,
    type LoadedGraph,
    mergeRecommendedReads,
    path as graphPath,
    query,
    type QueryResult,
    resolveSeeds,
    tree,
} from './query.js';
import { openGraphIndex, sqliteTwinPath } from './sqlite_store.js';
import type { CodeGraph } from './types.js';
import { validateGraph } from './validate.js';
import {
    dead,
    type DeadResult,
    entryPointsFromFile,
    impact,
    repoEntryPoints,
    untested,
    type UntestedResult,
} from './verbs.js';
import { main as lineageMain } from './lineage_cli.js';
import { graphChecksum } from './verify/owner_index.js';
import { writeChainStatus } from '../_lib/branch_chain_status.js';
import { domainResolver } from './domains.js';
import { readCachedProvenance, ticketsTouched } from './provenance.js';
import { overlayState, overlayView, readOverlay } from './verify/overlay.js';
import { headSha, verifyPaths } from './verify/paths.js';
import { renderShrink, shrinkCheck } from './verify/shrink_guard.js';
import { writeTombstones } from './verify/tombstones.js';
import { usageLowerBound, verifyMain } from './verify/verify_cli.js';

import { buildCacheFor, cacheFor, flag, isFlagValue, resolveRoot, shown, UsageError } from './cli_args.js';
import { pageReads } from './answer_budget.js';
import { noEntryLine, testsForModuleAnswer, withDeclaringFileTests } from './answer_correctness.js';
import { askMain } from './cli_ask.js';
import { mapSection } from './map_sections.js';
import { scanMain } from './scan.js';
import { bugsMain } from './cli_bugs.js';
import { cmdBranchDiff, cmdBranches, cmdOnBranches, cmdProvenance, cmdSystems } from './cli_knowledge.js';

export { buildCacheFor, cacheFor } from './cli_args.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
/** Local `tsx` binary — `refresh` spawns `build` as a child of THIS file
 * through it, so a budget-exceeded kill only ever terminates the child. */
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const DEFAULT_BUDGET_SECONDS = 60;

/**
 * A cache an older version wrote inside the package directory is named once
 * per build, so a consumer can delete it. Never deleted here: the path is
 * outside the project the user pointed the verb at.
 */
function legacyCacheNotice(root: string): string {
    const legacy = cacheFor(REPO_ROOT);
    // Only an installed package is a wrong home for a cache; a source checkout
    // of this repository legitimately keeps its own.
    if (!REPO_ROOT.split(path.sep).includes('node_modules')) return '';
    if (path.resolve(REPO_ROOT) === path.resolve(root) || !fs.existsSync(legacy)) return '';
    return `    note: a stale cache from an older version sits inside the package: ${legacy} — safe to delete\n`;
}

async function cmdBuild(argv: string[]): Promise<number> {
    const root = resolveRoot(argv);
    const out = argv.includes('--out') ? flag(argv, '--out') : buildCacheFor(root);
    if (!fs.existsSync(root)) {
        process.stderr.write(`code-graph: root not found: ${root}\n`);
        return 1;
    }
    const update = argv.includes('--update');
    const { graph, fileCount, reExtracted, reused, lanes } = await buildFromRepo(root, out, { update, lanes: !argv.includes('--no-lanes') });
    if (out === buildCacheFor(root)) registerUse(root, graph, git(root, 'rev-parse', 'HEAD'));
    const c = graph.edge_confidence_counts;
    process.stdout.write(
        `✅  code-graph ${update ? 'updated' : 'built'} — ${fileCount} files · ${graph.nodes.length} nodes · ${graph.edges.length} edges\n` +
            `    languages: ${graph.languages.join(', ') || '(none)'} · grammar ABI ${graph.grammar_abi}\n` +
            `    edges: EXTRACTED ${c.EXTRACTED} · INFERRED ${c.INFERRED} · AMBIGUOUS ${c.AMBIGUOUS}\n` +
            `    resolved_via: ${resolvedViaHistogram(graph)}\n` +
            (update ? `    incremental: ${reExtracted} re-extracted · ${reused} reused\n` : '') +
            (lanes ? laneSummaryLines(lanes) : '') +
            (out ? `    cache: ${shown(root, out)}\n` : '') +
            legacyCacheNotice(root),
    );
    if (argv.includes('--check-fixture-findings')) {
        const problems = fixtureScopeProblems(produceAreas(root, graph).areas);
        for (const p of problems) process.stdout.write(`    fixture scope: ${p}\n`);
        process.stdout.write(`    fixture scope check: ${problems.length} problem(s)\n`);
        return problems.length === 0 ? 0 : 1;
    }
    return 0;
}

/** One line per lane reader, then what failed and what the merge refused. */
function laneSummaryLines(l: LaneSummary): string {
    const ok = l.runs.filter((r) => !r.error).map((r) => `${r.lane} ${r.facts}/${r.relations}${r.outside ? ` (+${r.outside} outside the graph)` : ''} (${r.ms} ms)`);
    const failed = l.runs.filter((r) => r.error).map((r) => `    lane ${r.lane} failed, left out: ${r.error}\n`);
    return (
        `    lanes (facts/relations): ${ok.join(' · ') || '(none)'} · ${l.ms} ms\n` +
        failed.join('') +
        (l.refused.length ? `    lane merge refused ${l.refused.length}: ${l.refused.slice(0, 3).map((x) => `${x.lane} ${x.item} — ${x.reason}`).join('; ')}\n` : '')
    );
}

/**
 * The `resolved_via` histogram, descending by count.
 *
 * Printed on every build because it is the number that says whether the graph
 * is getting BETTER, and the confidence split does not: 2.3's whole target is
 * moving edges off `name-lookup` onto a real binding, and a reader who cannot
 * see the starting distribution cannot tell whether it moved. Only non-zero
 * buckets appear — a row of zeroes for the four mechanisms nothing emits yet
 * would be noise on every build.
 */
function resolvedViaHistogram(graph: CodeGraph): string {
    const counts = new Map<string, number>();
    for (const e of graph.edges) counts.set(e.resolved_via, (counts.get(e.resolved_via) ?? 0) + 1);
    if (counts.size === 0) return '(no edges)';
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .map(([via, n]) => `${via} ${n}`)
        .join(' · ');
}

function cmdValidate(argv: string[]): number {
    const root = resolveRoot(argv);
    const p = flag(argv, '--graph') ?? cacheFor(root);
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
    if (!r.ok) {
        process.stderr.write(`❌  graph schema invalid (${r.errors.length}):\n`);
        for (const e of r.errors) process.stderr.write(`  ${e}\n`);
        return 1;
    }

    // Twin ⇔ JSON, by checksum (road-to-a-graph-that-is-shipped 2.1).
    //
    // The schema check above says the JSON is well-formed. It says nothing
    // about the derived store that now ANSWERS most queries, and since 2.1 the
    // twin is read as an index rather than replayed as a blob — so a twin that
    // disagreed with the JSON would produce different answers rather than a
    // parse error. The comparison is `source_checksum`, which is the JSON's own
    // content-addressed cache key, so agreement here means the twin was emitted
    // from THIS graph and not merely from a graph.
    const twinState = twinChecksumState(p, (parsed as CodeGraph).source_checksum);
    const rel = shown(root, p);
    if (twinState.kind === 'mismatch') {
        process.stderr.write(
            `❌  SQLite twin disagrees with the canonical JSON: twin ${twinState.twin} ≠ json ${twinState.json}\n` +
                '    The twin is derived and disposable — delete it and re-run `code-graph build`.\n' +
                `    ${shown(root, sqliteTwinPath(p))}\n`,
        );
        return 1;
    }
    process.stdout.write(`✅  graph schema valid: ${rel}  ·  twin: ${twinState.kind}\n`);
    return 0;
}

/**
 * Compare the twin's stored `source_checksum` against the canonical JSON's.
 *
 * `absent` covers every state in which there is nothing to disagree WITH — no
 * twin, no `node:sqlite`, a stale or corrupt twin the reader would refuse
 * anyway. Those are not validation failures: the JSON is canonical and a
 * missing accelerator changes no answer. Only a twin that is present, fresh,
 * readable AND carrying a different checksum is a real contradiction.
 */
function twinChecksumState(
    jsonPath: string,
    jsonChecksum: string,
): { kind: 'absent' | 'match' } | { kind: 'mismatch'; twin: string; json: string } {
    const index = openGraphIndex(jsonPath);
    if (!index) return { kind: 'absent' };
    try {
        const twin = index.sourceChecksum;
        if (twin && twin !== jsonChecksum) return { kind: 'mismatch', twin, json: jsonChecksum };
        return { kind: 'match' };
    } finally {
        index.close();
    }
}

function resolveGraph(argv: string[]): { g: LoadedGraph; note: string } | { err: string } {
    const explicit = flag(argv, '--graph');
    const root = resolveRoot(argv);
    if (explicit) {
        if (!fs.existsSync(explicit)) return { err: `graph not found: ${explicit}` };
        return { g: withOverlay(loadGraph(explicit, path.relative(root, explicit))), note: '' };
    }
    const picked = pickSource(detectSources(root, cacheFor(root)));
    if (!picked) return { err: 'no code-graph source found — run `code_graph build` or ship a graph.json' };
    if (picked.kind === 'scip') return { err: `${picked.note ?? 'SCIP detected'} — run \`code-graph build\` to merge it into the native graph` };
    const staleNote = picked.stale ? ` ⚠ index is ${picked.commits_behind ?? 'N'} commit(s) behind — rebuild before trusting` : '';
    touchHome(root);
    return { g: withOverlay(loadGraph(picked.path, `${picked.kind}:${shown(root, picked.path)}`)), note: staleNote };
}

/** `added` for a fact only the working-tree overlay holds. */
function overlayStateOf(g: LoadedGraph): (id: string) => ReturnType<typeof overlayState> {
    const ov = readOverlay(g.answeredBy, graphChecksum(g));
    return (id) => overlayState(ov, id);
}

/** Committed facts seen through the working-tree overlay, when `refresh --touched` computed one against this graph. */
function withOverlay(g: LoadedGraph): LoadedGraph {
    return overlayView(g, readOverlay(g.answeredBy, graphChecksum(g)));
}

let readsPage = 1;

function render(r: QueryResult, staleNote: string): number {
    process.stdout.write(`source: ${r.source}${staleNote}\n`);
    if (r.seeds.length) process.stdout.write(`seeds: ${r.seeds.join(', ')}\n`);
    for (const l of r.lines) process.stdout.write(`  ${l}\n`);
    if (r.truncated) process.stdout.write('  … (budget reached — narrow the seed or raise --budget)\n');
    if (!r.lines.length) process.stdout.write('  (no matching relations)\n');
    if (r.recommended_reads.length) {
        const pg = pageReads(r.recommended_reads, readsPage);
        process.stdout.write(`recommended reads (dropped by the budget, or a low-confidence seed match) — ${pg.items.length} of ${pg.total}, page ${pg.page}/${pg.pages}:\n`);
        for (const rr of pg.items) process.stdout.write(`  ${rr.path}${rr.lines ? `:${rr.lines[0]}-${rr.lines[1]}` : ''}\n`);
        if (pg.pages > pg.page) process.stdout.write(`  … next page: --reads-page ${pg.page + 1}\n`);
    }
    return 0;
}

function budgetOf(argv: string[]): number {
    const b = Number(flag(argv, '--budget'));
    return Number.isFinite(b) && b > 0 ? b : 1500;
}

/**
 * Files changed between `ref` and `HEAD`, repo-relative.
 *
 * Extracted from `changedNodeSeeds` so the Phase-3 verbs seed from the same
 * diff reading as `affected --since`. `null` distinguishes "git refused" (a bad
 * rev, not a repository) from "nothing changed" — a verb that reports an empty
 * impact set for a rev git could not resolve is asserting something it never
 * measured.
 */
export function changedFiles(root: string, ref: string): string[] | null {
    // `execFileSync` takes an argv array, so there is no shell and `$(...)` in a
    // rev is inert. What the `${ref}..HEAD` concatenation does NOT stop is
    // OPTION injection: `--output=/tmp/x` becomes `--output=/tmp/x..HEAD`, a
    // well-formed option whose value is a filename, and the file is written with
    // exit 0 (probed 2026-09-09). A rev never begins with `-`.
    if (ref.startsWith('-')) return null;
    try {
        return gitProbe(root, ['diff', '--name-only', '--relative', `${ref}..HEAD`])
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    } catch {
        return null;
    }
}

function changedNodeSeeds(g: LoadedGraph, root: string, ref: string): string[] {
    const files = changedFiles(root, ref);
    if (files === null) return [];
    // Served by the `nodes_source_file` index on the SQLite path, so a wide
    // diff does not force the whole node table into memory to answer it.
    return g.idsInFiles(files);
}

function cmdQuery(kind: 'query' | 'explain' | 'affected' | 'path', argv: string[]): number {
    const r = resolveGraph(argv);
    if ('err' in r) {
        process.stderr.write(`code-graph: ${r.err}\n`);
        return 1;
    }
    const positional = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    const budget = budgetOf(argv);
    const walk = { includeGuesses: argv.includes('--include-guesses') };
    readsPage = Math.max(1, Number(flag(argv, '--reads-page') ?? 1) || 1);
    if (kind === 'affected' && flag(argv, '--since')) {
        const root = resolveRoot(argv);
        const seeds = changedNodeSeeds(r.g, root, flag(argv, '--since') as string);
        const merged: QueryResult = { source: r.g.source, seeds: [], lines: [], truncated: false, recommended_reads: [] };
        const perSeed: QueryResult[] = [];
        for (const s of seeds) {
            const one = affected(r.g, s, 2, budget, walk);
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
        return render(graphPath(r.g, a, b, budget, walk), r.note);
    }
    const kinds = flag(argv, '--kind');
    const relation = flag(argv, '--relation');
    const dir = flag(argv, '--direction');
    if (kinds || relation || dir || flag(argv, '--depth')) {
        const t = tree(r.g, a, {
            ...(kinds ? { kinds: kinds.split(',').map((k) => k.trim()).filter(Boolean) } : {}),
            ...(relation ? { relations: relation.split(',').map((k) => k.trim()).filter(Boolean) } : {}),
            direction: dir === 'in' || dir === 'out' ? dir : kind === 'affected' ? 'in' : kind === 'query' ? 'out' : 'both',
            depth: Number(flag(argv, '--depth') ?? (kind === 'query' ? 1 : 2)),
            limit: Number(flag(argv, '--limit') ?? 50),
            stateOf: overlayStateOf(r.g),
        });
        process.stdout.write(`source: ${t.source}${r.note}\n`);
        if (t.seeds.length) process.stdout.write(`seeds: ${t.seeds.join(', ')}\n`);
        process.stdout.write(`population: ${t.population}\n`);
        for (const l of t.tree) process.stdout.write(`  ${l}\n`);
        process.stdout.write(`returned ${t.returned} of ${t.total}${t.hasMore ? ' (more — raise --limit)' : ''}\n`);
        if (t.items.some((i) => i.direction === 'in')) renderUsage(r.g, argv, a);
        return 0;
    }
    const answer = kind === 'affected' ? affected(r.g, a, 2, budget, walk) : kind === 'explain' ? explain(r.g, a, budget, walk) : query(r.g, a, budget, walk);
    const rc = render(answer, r.note);
    if (kind === 'affected') renderUsage(r.g, argv, a);
    return rc;
}

/** A usage answer is a lower bound: pair it with a text search for the seed's name. */
function renderUsage(g: LoadedGraph, argv: string[], seed: string): void {
    const ids = resolveSeeds(g, seed, 1);
    if (ids.length === 0) return;
    const root = resolveRoot(argv);
    const users = tree(g, ids[0] as string, { direction: 'in', depth: 2, limit: 10_000 }).items.map((i) => i.id);
    const lb = usageLowerBound(g, root, flag(argv, '--graph') ?? g.answeredBy, ids[0] as string, users);
    if (!lb) return;
    process.stdout.write(`usage: ${lb.line}\n`);
    for (const at of lb.text_only_at) process.stdout.write(`  text only: ${at}\n`);
}

// Phase-3 gate verbs (3.1-3.3).

/** The staleness token every gate verb prints, per step 3.1–3.3's shared
 * verify: "each prints `resolved_via` counts and the staleness state". */
/**
 * The staleness of the graph the verb is ACTUALLY reading.
 *
 * `answeredBy` is `resolveGraph`'s own picked path when it has one. Without it
 * the two disagreed on the case `resolveRoot`'s docstring exists for: with
 * `--root <other repo>` the verb answered from a cache anchored to the
 * package tree while `graphState` looked under the OTHER root, so the printed
 * staleness described a cache the answer never came from. An independent review
 * found the `--graph` half fixed and this half open.
 */
function stateOf(argv: string[], answeredBy?: string): GraphState {
    const explicit = flag(argv, '--graph');
    const root = resolveRoot(argv);
    return graphState(root, explicit ?? answeredBy ?? cacheFor(root));
}

/** The two histogram lines + the staleness line, in one place so the four
 * verbs cannot drift apart in how they report their own filtering. */
function renderEnvelope(r: { source: string; state: GraphState; accepted_via: string; rejected_via: string }): void {
    process.stdout.write(`source: ${r.source}\nstaleness: ${r.state}\n`);
    process.stdout.write(`accepted resolved_via: ${r.accepted_via}\n`);
    process.stdout.write(`rejected resolved_via: ${r.rejected_via}\n`);
}

function renderReads(reads: readonly { path: string; lines: [number, number] | null }[]): void {
    if (!reads.length) return;
    process.stdout.write('minimal read set:\n');
    for (const r of reads) process.stdout.write(`  ${r.path}${r.lines ? `:${r.lines[0]}-${r.lines[1]}` : ''}\n`);
}

/**
 * `impact --diff <rev>` (3.1) — callers, dependents and test files reachable
 * from the changed symbols over ACCEPTED edges, plus the producing edges and a
 * minimal read set.
 */
function cmdImpact(argv: string[]): number {
    const ref = flag(argv, '--diff');
    if (ref === null) {
        process.stderr.write('usage: code_graph/cli.ts impact --diff <rev> [--graph P] [--depth N] [--detail minimal|standard] [--regressions F]\n');
        return 2;
    }
    const root = resolveRoot(argv);
    const files = changedFiles(root, ref);
    if (files === null) {
        process.stderr.write(`code-graph: cannot resolve rev '${ref}' in ${root}\n`);
        return 1;
    }
    const r = resolveGraph(argv);
    if ('err' in r) {
        process.stderr.write(`code-graph: ${r.err}\n`);
        return 1;
    }
    try {
        const depth = Number(flag(argv, '--depth'));
        const registryFile = flag(argv, '--regressions');
        if (registryFile !== null) return renderRegressions(r.g, ref, files, registryFile, stateOf(argv, r.g.answeredBy), Number.isFinite(depth) && depth > 0 ? depth : 2);
        const res = capAnswer(
            withDeclaringFileTests(r.g, impact(r.g, files, stateOf(argv, r.g.answeredBy), Number.isFinite(depth) && depth > 0 ? depth : 2, isTestFile, diffHunks(root, `${ref}..HEAD`) ?? undefined), isTestFile),
            ['dependents', 'reached', 'test_files', 'producing_edges', 'lines', 'recommended_reads'],
            parseDetail(flag(argv, '--detail')),
            ['reached', 'producing_edges', 'lines'],
        );
        renderEnvelope(res);
        process.stdout.write(`changed files: ${files.length} · seeds: ${res.seeds.length}\n`);
        if (res.file_seeded.length) process.stdout.write(`seeded by whole file (git gave no hunk): ${res.file_seeded.join(', ')}\n`);
        if (res.unresolved_files.length)
            process.stdout.write(`unresolved changed files (no node in the graph): ${res.unresolved_files.join(', ')}\n`);
        if (res.partial_files.length) process.stdout.write(`partial files (parsed with errors, not complete): ${res.partial_files.join(', ')}\n`);
        process.stdout.write(`dependents (${res.dependents.length}):\n`);
        if (res.uncertainty) process.stdout.write(`  ${res.uncertainty}\n`);
        for (const d of res.dependents) process.stdout.write(`  ${d}\n`);
        process.stdout.write(`test files (${res.test_files.length}):\n`);
        for (const t of res.test_files) process.stdout.write(`  ${t}\n`);
        process.stdout.write(`producing edges (${res.producing_edges.length}):\n`);
        for (const e of res.producing_edges) process.stdout.write(`  ${e}\n`);
        renderOmitted(res.omitted);
        renderReads(res.recommended_reads);
        return 0;
    } finally {
        r.g.close();
    }
}

/**
 * `review-risk [--diff <rev>]` — the diff's hunks against the graph as a sum of
 * terms, each counted fact listed with its witness. Without `--diff` the
 * working tree is set against HEAD.
 */
function cmdReviewRisk(argv: string[]): number {
    const root = resolveRoot(argv);
    const rev = flag(argv, '--diff') ?? 'HEAD';
    const markdown = flag(argv, '--format') === 'markdown';
    const hunks = diffHunks(root, rev);
    if (hunks === null) {
        if (markdown) process.stdout.write(renderReviewRiskMarkdown(null, `the rev '${rev}' does not resolve`));
        process.stderr.write(`code-graph: cannot resolve rev '${rev}' in ${root}\n`);
        return 1;
    }
    const p = flag(argv, '--graph') ?? cacheFor(root);
    if (!fs.existsSync(p)) {
        if (markdown) process.stdout.write(renderReviewRiskMarkdown(null, 'no code graph has been built'));
        process.stderr.write(`code-graph: graph not found: ${p} — run \`code-graph build\` first\n`);
        return 1;
    }
    const graph = JSON.parse(fs.readFileSync(p, 'utf-8')) as CodeGraph;
    const r = reviewRisk(root, graph, rev, hunks, undefined, { includeGuesses: argv.includes('--include-guesses') });
    // Whose work the diff touches — informational, never a weighted term of the sum.
    const prov = readCachedProvenance(root, path.dirname(p));
    const tickets = prov ? ticketsTouched(prov, r.changed) : null;
    const detail = parseDetail(flag(argv, '--detail'));
    if (markdown) {
        process.stdout.write(renderReviewRiskMarkdown(r, undefined, capReviewRisk(r, detail).omitted));
        return 0;
    }
    if (argv.includes('--json')) {
        const capped = capReviewRisk(r, detail);
        process.stdout.write(`${JSON.stringify(tickets ? { ...capped, tickets } : capped)}\n`);
    } else {
        const lines = renderReviewRisk(r, detail === 'minimal' ? 5 : 20);
        const domainOf = domainResolver(path.dirname(path.dirname(p)));
        if (domainOf) {
            const crossings = new Set<string>();
            const changed = new Set(r.changed);
            for (const t of r.terms) {
                for (const i of t.items) {
                    const far = i.witness?.file;
                    if (!far || changed.has(far)) continue;
                    for (const c of r.changed) {
                        const a = domainOf(c);
                        const b = domainOf(far);
                        if (a && b && a !== b) crossings.add(`${a} ↔ ${b} (${c} · ${far})`);
                    }
                }
            }
            if (crossings.size) {
                lines.push(`domain crossings (${crossings.size}), not part of the sum:`);
                for (const x of [...crossings].sort().slice(0, 20)) lines.push(`  ${x}`);
            }
        }
        if (tickets && tickets.length) {
            lines.push(`tickets and PRs whose code the diff touches (${tickets.length}), not part of the sum:`);
            for (const t of tickets.slice(0, 20)) lines.push(`  ${t.key} — ${t.files.join(', ')}`);
        }
        process.stdout.write(`${lines.join('\n')}\n`);
    }
    return 0;
}

/** `tests-for <symbol>` (3.2) — the test files that import the symbol. */
function cmdTestsFor(argv: string[]): number {
    const positional = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    const symbol = positional[0];
    if (!symbol) {
        process.stderr.write('usage: code_graph/cli.ts tests-for <symbol> [--graph P]\n');
        return 2;
    }
    const r = resolveGraph(argv);
    if ('err' in r) {
        process.stderr.write(`code-graph: ${r.err}\n`);
        return 1;
    }
    try {
        const res = capAnswer(testsForModuleAnswer(r.g, symbol, stateOf(argv, r.g.answeredBy)), ['tests', 'lines', 'recommended_reads'], parseDetail(flag(argv, '--detail')));
        renderEnvelope(res);
        process.stdout.write(`seeds: ${res.seeds.join(', ') || '(none)'}\n`);
        if (res.partial_files.length) process.stdout.write(`partial files (parsed with errors, not complete): ${res.partial_files.join(', ')}\n`);
        process.stdout.write(`tests (${res.tests.length}):\n`);
        if (res.uncertainty) process.stdout.write(`  ${res.uncertainty}\n`);
        for (const t of res.tests) process.stdout.write(`  ${t}\n`);
        renderOmitted(res.omitted);
        if (res.seeds.length === 0) process.stdout.write(`${noEntryLine(symbol, 'tests-for')}\n`);
        renderReads(res.recommended_reads);
        return 0;
    } finally {
        r.g.close();
    }
}

/** `untested --diff <rev>` (3.2) — changed symbols no test file imports. */
function cmdUntested(argv: string[]): number {
    const ref = flag(argv, '--diff');
    if (ref === null) {
        process.stderr.write('usage: code_graph/cli.ts untested --diff <rev> [--graph P]\n');
        return 2;
    }
    const root = resolveRoot(argv);
    const files = changedFiles(root, ref);
    if (files === null) {
        process.stderr.write(`code-graph: cannot resolve rev '${ref}' in ${root}\n`);
        return 1;
    }
    const r = resolveGraph(argv);
    if ('err' in r) {
        process.stderr.write(`code-graph: ${r.err}\n`);
        return 1;
    }
    try {
        const res: UntestedResult = untested(r.g, files, stateOf(argv, r.g.answeredBy));
        renderEnvelope(res);
        process.stdout.write(`changed files: ${files.length} · changed symbols: ${res.tested.length + res.untested.length}\n`);
        if (res.unresolved_files.length)
            process.stdout.write(`unresolved changed files (no node in the graph): ${res.unresolved_files.join(', ')}\n`);
        process.stdout.write(`tested (${res.tested.length}) · untested (${res.untested.length}):\n`);
        for (const u of res.untested) process.stdout.write(`  ${u}\n`);
        renderReads(res.recommended_reads);
        return 0;
    } finally {
        r.g.close();
    }
}

/**
 * `dead` (3.3) — symbols with zero accepted in-edges that no declared entry
 * point names. REFUSES by default when an entry-point source is unavailable;
 * see `verbs.ts::dead` for why that refusal is not relaxable by an options bag.
 */
function cmdDead(argv: string[]): number {
    const r = resolveGraph(argv);
    if ('err' in r) {
        process.stderr.write(`code-graph: ${r.err}\n`);
        return 1;
    }
    try {
        const root = resolveRoot(argv);
        const sources = repoEntryPoints(root);
        const listFile = flag(argv, '--entry-points');
        if (listFile !== null) {
            if (!fs.existsSync(listFile)) {
                process.stderr.write(`code-graph: entry-point list not found: ${listFile}\n`);
                return 1;
            }
            // An operator-supplied list SUPPLIES the missing source, so the
            // `exports` row stops being a gap rather than being ignored: the
            // caller has stated the entry points the graph could not.
            const supplied = entryPointsFromFile(listFile);
            const patched = sources.map((srcRow) =>
                srcRow.name === 'exports'
                    ? { ...srcRow, status: 'read' as const, detail: `supplied by ${listFile}`, entries: [] }
                    : srcRow,
            );
            patched.push(supplied);
            const res: DeadResult = dead(r.g, patched, stateOf(argv, r.g.answeredBy));
            return renderDead(capAnswer(res, ['dead', 'excluded', 'lines', 'recommended_reads'], parseDetail(flag(argv, '--detail'))));
        }
        const res: DeadResult = dead(r.g, sources, stateOf(argv, r.g.answeredBy), {
            acceptMissingExports: argv.includes('--accept-missing-exports'),
        });
        return renderDead(capAnswer(res, ['dead', 'excluded', 'lines', 'recommended_reads'], parseDetail(flag(argv, '--detail'))));
    } finally {
        r.g.close();
    }
}

/**
 * `impact --diff <rev> --regressions <registry.json>` — the existing regressions
 * whose guards the diff's neighbourhood reaches, from a `[{ id, guards }]` file.
 * The verify-repair loop's regression scope; fail-closed through `selectionVerdict`.
 */
function renderRegressions(g: LoadedGraph, ref: string, files: string[], registryFile: string, state: GraphState, depth: number): number {
    let registry: RegressionSpec[];
    try {
        registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8')) as RegressionSpec[];
        if (!Array.isArray(registry) || !registry.every((x) => typeof x?.id === 'string' && Array.isArray(x.guards))) throw new Error('expected [{ id, guards: [] }]');
    } catch (e) {
        process.stderr.write(`code-graph: cannot read regression registry ${registryFile}: ${(e as Error).message}\n`);
        return 1;
    }
    const report = selectRegressionsFromCode(g, { id: `diff:${ref}`, touches: files }, registry, depth, isTestFile, state);
    const refusal = selectionVerdict(report);
    process.stdout.write(`${JSON.stringify({ ...report, selected: report.selected.map((x) => ({ id: x.spec.id, matched: x.matched, reason: x.reason })), refusal })}\n`);
    return refusal === null ? 0 : 1;
}

/** What a capped answer left out, counted per list (`answer_detail.ts`). */
function renderOmitted(omitted: Record<string, number>): void {
    const parts = Object.entries(omitted).map(([k, n]) => `${k} ${n}`);
    if (parts.length) process.stdout.write(`omitted by --detail cap: ${parts.join(' · ')}\n`);
}

function renderDead(res: DeadResult & { omitted: Record<string, number> }): number {
    // The envelope FIRST, on both branches. It used to print only after the
    // refusal check, so the default invocation in this repository — where
    // `exports` is always unavailable — printed neither histogram nor the
    // staleness line, and 3.1-3.3's shared verify ("each prints `resolved_via`
    // counts and the staleness state") held only on the branch that answers.
    // A reader of a refusal wants the staleness most of all: it says whether
    // re-running after a rebuild could change anything.
    renderEnvelope(res);
    process.stdout.write('entry-point sources consulted:\n');
    for (const srcRow of res.sources)
        process.stdout.write(
            `  ${srcRow.name.padEnd(13)} ${srcRow.status}${srcRow.detail ? ` — ${srcRow.detail}` : ''} · ${srcRow.entries.length} entr${srcRow.entries.length === 1 ? 'y' : 'ies'}\n`,
        );
    if (res.refusal !== null) {
        process.stderr.write(`❌  dead refused: ${res.refusal}\n`);
        return 1;
    }
    process.stdout.write(`excluded as declared entry points: ${res.excluded.length}\n`);
    process.stdout.write(`dead (${res.dead.length}):\n`);
    for (const d of res.dead) process.stdout.write(`  ${d}\n`);
    renderOmitted(res.omitted);
    renderReads(res.recommended_reads);
    return 0;
}

function cmdDetect(argv: string[]): number {
    const root = resolveRoot(argv);
    if (flag(argv, '--format') === 'json') {
        // Machine-readable three-state verdict (Phase 2). Existing human-text
        // output below is unchanged for existing consumers.
        process.stdout.write(`${JSON.stringify(computeVerdict(root, cacheFor(root)))}\n`);
        return 0;
    }
    const verdicts = detectSources(root, cacheFor(root));
    if (!verdicts.length) {
        process.stdout.write('no code-graph source detected\n');
        return 1;
    }
    for (const v of verdicts) {
        const fresh = v.stale === undefined ? '' : v.stale ? ` · STALE${v.commits_behind !== undefined ? ` (${v.commits_behind} behind)` : ''}` : ' · fresh';
        process.stdout.write(`${v.kind.padEnd(9)} ${shown(root, v.path)}${fresh}${v.note ? ` · ${v.note}` : ''}\n`);
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

/** Best-effort removal of a temp build output, its sidecar, its SQLite twin and
 * the twin's own half-written temp. Never throws — cleanup failure must not mask
 * the real result (budget-exceeded / error). */
export function cleanupTemp(tmpOut: string): void {
    const twin = sqliteTwinPath(tmpOut);
    let twinTemps: string[] = [];
    try {
        twinTemps = fs
            .readdirSync(path.dirname(tmpOut))
            .filter((f) => f.startsWith(`${path.basename(twin)}.tmp-`))
            .map((f) => path.join(path.dirname(tmpOut), f));
    } catch {
        /* the directory is gone, so nothing in it is left to remove */
    }
    for (const p of [tmpOut, sidecarPath(tmpOut), twin, ...twinTemps]) {
        try {
            fs.unlinkSync(p);
        } catch {
            /* already absent, or never materialised — fine */
        }
    }
}

/**
 * Remove what a refresh killed before its own cleanup left behind. A file is
 * only an orphan when the pid in its name is gone AND it is older than a stale
 * lock: the pid check alone would race a refresh that is starting right now.
 */
function sweepOrphanedTemps(out: string): void {
    const dir = path.dirname(out);
    const prefix = `.${path.basename(out)}.refresh-tmp-`;
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return;
    }
    for (const name of names) {
        if (!name.startsWith(prefix)) continue;
        const pid = Number(name.slice(prefix.length).split('-')[0]);
        if (!Number.isInteger(pid) || pid <= 0 || pidAlive(pid)) continue;
        const full = path.join(dir, name);
        try {
            if (Date.now() - fs.statSync(full).mtimeMs > STALE_LOCK_MS) fs.unlinkSync(full);
        } catch {
            /* raced another sweeper — fine */
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
function git(root: string, ...args: string[]): string | null {
    try {
        return gitProbe(root, args).trim();
    } catch {
        return null;
    }
}

/**
 * HEAD; `''` when no ancestor of the CANONICAL root holds `.git`; `null` when
 * one does and HEAD cannot be read, or when the root or an ancestor cannot be
 * inspected. "Not a repository" is read from the filesystem, never from a git
 * probe, and is walked from the realpath so a symlinked root cannot hide the
 * repository git itself would find.
 */
function headOf(root: string): string | null {
    let dir: string;
    try {
        dir = fs.realpathSync(root);
    } catch {
        return null;
    }
    for (;;) {
        try {
            fs.lstatSync(path.join(dir, '.git'));
            return git(dir, 'rev-parse', 'HEAD');
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return null;
        }
        if (path.dirname(dir) === dir) return '';
        dir = path.dirname(dir);
    }
}

/**
 * A stamp of the files a build reads — path, size and modification time of every
 * source and document file. HEAD alone misses an edit to the working tree made
 * while the build ran (a second agent saving a file), which leaves a graph of
 * content that never existed together. Best-effort, not definitive: an edit
 * that keeps the size and lands within the filesystem's mtime resolution (or
 * restores the mtime) is not seen; hashing every file's content would be.
 */
function treeStamp(root: string): string {
    const h = createHash('sha256');
    for (const full of [...discoverFiles(root), ...discoverFiles(root, DOC_EXTS)]) {
        try {
            const st = fs.statSync(full);
            h.update(`${full}\0${st.size}\0${st.mtimeMs}\n`);
        } catch {
            h.update(`${full}\0gone\n`);
        }
    }
    return h.digest('hex');
}

/** Returned by {@link runBudgetedBuild} when HEAD or the working tree moved while the child built. */
const HEAD_MOVED = -1;

function runBudgetedBuild(root: string, out: string, update: boolean, budgetSeconds: number, allowShrink = false): number {
    if (!(budgetSeconds > 0)) {
        // Node's own `timeout` option treats 0 as "no limit" — a genuinely
        // zero-or-negative budget is an immediate, deterministic abort
        // instead of silently becoming unlimited.
        process.stderr.write(`code-graph: refresh budget exceeded (${budgetSeconds}s) — old cache kept\n`);
        return 1;
    }
    const dir = path.dirname(out);
    sweepOrphanedTemps(out);
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
    // A hoisted consumer install has no `tsx` under the package's own
    // `node_modules`; re-entering through this process's own loader flags works
    // wherever the parent itself started.
    const [cmd, cmdArgs] = fs.existsSync(TSX_BIN)
        ? [TSX_BIN, [_HERE, ...args]]
        : [process.execPath, [...process.execArgv, _HERE, ...args]];
    const headBefore = headOf(root);
    const treeBefore = treeStamp(root);
    const res = spawnSync(cmd, cmdArgs, {
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
    // A checkout or rebase that lands mid-build leaves a graph of a tree that
    // existed only in passing; publishing it would label mixed content fresh.
    // An unreadable HEAD is not evidence it held still, so it fails the same way.
    if (headBefore === null || headOf(root) !== headBefore) {
        cleanupTemp(tmpOut);
        process.stderr.write('code-graph: HEAD moved (or could not be read) during the refresh — result discarded\n');
        return HEAD_MOVED;
    }
    if (treeStamp(root) !== treeBefore) {
        cleanupTemp(tmpOut);
        process.stderr.write('code-graph: files changed during the refresh — result discarded\n');
        return HEAD_MOVED;
    }
    const shrink = shrinkCheck(root, out, tmpOut, { basis: headSha(root) ?? 'no-commit' });
    if (!shrink.ok && !allowShrink) {
        cleanupTemp(tmpOut);
        process.stderr.write(`code-graph: ${renderShrink(shrink)}\n`);
        return 1;
    }
    if (shrink.tombstones.length > 0) writeTombstones(verifyPaths(out).tombstones, shrink.tombstones);
    fs.renameSync(tmpOut, out); // same-dir → atomic; real cache only ever changes here
    const tmpSidecar = sidecarPath(tmpOut);
    if (fs.existsSync(tmpSidecar)) fs.renameSync(tmpSidecar, sidecarPath(out));
    // The twin records the JSON's size and mtime; a rename keeps both, so the
    // promoted twin matches the promoted JSON. Without a twin, the old one goes:
    // it describes a JSON that no longer exists.
    const tmpTwin = sqliteTwinPath(tmpOut);
    if (fs.existsSync(tmpTwin)) fs.renameSync(tmpTwin, sqliteTwinPath(out));
    else fs.rmSync(sqliteTwinPath(out), { force: true });
    process.stdout.write(`✅  code-graph refreshed — cache: ${shown(root, out)}\n`);
    return 0;
}

/**
 * `--single-flight` takes the lock the git-hook refresh block takes and exits 0
 * when another refresh holds it. `--map` redraws `agents/map/` afterwards, only
 * when the project already has one and it is older than the cache.
 */
/** How long a refresh may spend on branch gc. */
const BRANCH_GC_BUDGET_MS = 2_000;

async function cmdRefresh(argv: string[]): Promise<number> {
    const root = resolveRoot(argv);
    const out = flag(argv, '--out') ?? buildCacheFor(root);
    const budgetSeconds = budgetSecondsOf(argv);
    if (!fs.existsSync(root)) {
        process.stderr.write(`code-graph: root not found: ${root}\n`);
        return 1;
    }
    // `--map` writes the same files a manual `map` does, so it is never drawn unlocked.
    const locked = argv.includes('--single-flight') || argv.includes('--map');
    const release = locked ? acquireRefreshLock(root) : () => {};
    const record = (outcome: string, detail?: string): void => {
        if (locked) recordRefresh(root, { by: 'refresh', outcome, ...(detail ? { detail } : {}) });
    };
    if (release === null) {
        process.stdout.write('another refresh is running — nothing to do\n');
        record('locked');
        return 0;
    }
    try {
        // The branch chain's offline status beside the graph: local refs only, never the network.
        try {
            writeChainStatus(root, path.join(path.dirname(out), 'branch-chain.json'));
        } catch {
            /* a chain that cannot be read is no reason to skip the refresh */
        }
        let rc = HEAD_MOVED;
        // One retry: a second move inside one build window means the tree is
        // still in motion, and the next hook or session start will refresh it.
        for (let attempt = 0; attempt < 2 && rc === HEAD_MOVED; attempt++) {
            const v = computeVerdict(root, out);
            if (v.verdict === 'FRESH') {
                process.stdout.write('fresh — nothing to do\n');
                rc = 0;
                break;
            }
            rc = runBudgetedBuild(root, out, v.verdict === 'STALE', budgetSeconds, argv.includes('--allow-shrink'));
        }
        if (rc === HEAD_MOVED) {
            record('tree-moved', 'HEAD or files changed during both attempts; the next refresh retries');
            return 1;
        }
        if (rc !== 0) {
            record('failed', `build exited ${rc}`);
            return rc;
        }
        if (out === buildCacheFor(root)) registerUse(root, null, git(root, 'rev-parse', 'HEAD'));
        // Branch gc rides on every refresh, bounded in time; a store it cannot read is no reason to fail one.
        try {
            const g = gcBranches(root, path.dirname(out), { budgetMs: BRANCH_GC_BUDGET_MS });
            process.stdout.write(`branch gc: ${g.dropped.length} dropped, ${g.swept} fact file(s) swept${g.bounded ? ' — stopped at its time budget, the next refresh continues' : ''}\n`);
        } catch {
            /* the branch store is optional */
        }
        if (argv.includes('--map') && mapIsBehind(root, out)) {
            const mrc = await drawMap(['--root', root, '--no-build', '--no-verify']);
            record(mrc === 0 ? 'refreshed-with-map' : 'map-failed', mrc === 0 ? undefined : `map exited ${mrc}`);
            return mrc;
        }
        record('refreshed');
        return rc;
    } finally {
        release();
    }
}

/**
 * `auto-refresh on|off|status` — the explicit, local, per-project opt-in the
 * `code-graph-refresh` session concern requires before it starts anything
 * (ratification round of 2026-10-23: an existing cache is not consent).
 */
function cmdAutoRefresh(argv: string[]): number {
    const root = resolveRoot(argv);
    const action = argv.find((a) => !a.startsWith('--') && !isFlagValue(argv, a)) ?? 'status';
    const home = graphHome(root);
    const marker = home.autoRefreshPath;
    if (action === 'on') {
        if (home.kind === 'global') {
            // The session concern serves project homes only; its chunk cannot carry the
            // user-global resolver, so an opt-in here would be a promise nothing keeps.
            process.stderr.write(
                `code-graph: auto-refresh needs a project home (agents/ or a project install); ${root} has none.\n` +
                    'Its graph lives in the user-global home — refresh it with `code-graph refresh`.\n',
            );
            return 1;
        }
        const now = path.join(home.buildDir, path.basename(marker));
        fs.mkdirSync(home.buildDir, { recursive: true });
        fs.writeFileSync(now, `${JSON.stringify({ enabled_at: new Date().toISOString() })}\n`);
        if (now !== marker) fs.rmSync(marker, { force: true });
        const cli = usableCli(root);
        process.stdout.write(
            'auto-refresh on — each agent session start refreshes the graph, and agents/map/ when it exists,\n' +
                'in the background (POSIX hosts). `code-graph auto-refresh off` stops it.\n' +
                'The opt-in is per working tree: run it again in each new git worktree.\n' +
                (fs.existsSync(cacheFor(root)) ? '' : 'No graph yet: `code-graph build` or `code-graph map` creates one.\n'),
        );
        if ('reason' in cli) {
            process.stderr.write(
                cli.reason === 'no-cli'
                    ? 'warning: no agent-config outside this repository is on PATH, so nothing will run yet — install it globally (npm i -g @event4u/agent-config).\n'
                    : `warning: ${cli.cli} (version ${cliPackage(cli.cli)?.version ?? 'unknown'}) is too old for the single-flight refresh, so nothing will run yet — update it (npm i -g @event4u/agent-config).\n`,
            );
        }
        return 0;
    }
    if (action === 'off') {
        for (const m of new Set([marker, path.join(home.buildDir, path.basename(marker)), path.join(home.legacyDir, path.basename(marker))])) fs.rmSync(m, { force: true });
        process.stdout.write('auto-refresh off\n');
        return 0;
    }
    if (action !== 'status') {
        process.stderr.write('usage: code_graph/cli.ts auto-refresh on|off|status [--root P]\n');
        return 2;
    }
    const cli = usableCli(root);
    const last = readRefreshRecords(root);
    const line = (r: (typeof last)['refresh']): string => (r ? `${r.outcome} at ${r.at}${r.detail ? ` (${r.detail})` : ''}` : 'never');
    const mapDir = home.mapDir;
    const gen = graphGeneration(cacheFor(root));
    const drawnFrom = mapGeneration(mapDir);
    const mutex = reclaimMutexPath(home.lockPath);
    process.stdout.write(
        `auto-refresh: ${fs.existsSync(marker) ? 'on' : 'off'}\n` +
            `cli: ${'reason' in cli ? (cli.reason === 'no-cli' ? 'none usable — nothing will run' : `${cli.cli} ${cliPackage(cli.cli)?.version ?? '?'} — too old, nothing will run`) : `${cli.cli} ${cliPackage(cli.cli)?.version ?? '?'}`}\n` +
            `last session start: ${line(last['session-start'])}\n` +
            `last refresh: ${line(last.refresh)}\n` +
            `graph: ${computeVerdict(root, cacheFor(root)).verdict}\n` +
            `map: ${!hasMap(mapDir) ? 'absent' : drawnFrom === null ? 'present (generation unknown — redrawn on the next refresh)' : drawnFrom === gen ? 'present, drawn from the current graph' : 'present, drawn from an older graph'}\n` +
            (fs.existsSync(mutex) && mutexAgeMs(mutex) > 60_000
                ? `reclaim mutex: ${shown(root, mutex)} left by a crash — stale locks stay held until it is removed by hand\n`
                : ''),
    );
    return 0;
}

function mutexAgeMs(p: string): number {
    try {
        return Date.now() - fs.statSync(p).mtimeMs;
    } catch {
        return 0;
    }
}

/**
 * Whether the map was drawn from a different graph than the cache now holds —
 * decided by the generation both record, never by modification times, which a
 * copied or restored file carries wrongly. No map → never draw one unbidden.
 */
function mapIsBehind(root: string, cache: string): boolean {
    const mapDir = graphHome(root).mapDir;
    if (!hasMap(mapDir)) return false;
    const gen = graphGeneration(cache);
    return gen !== null && mapGeneration(mapDir) !== gen;
}

/**
 * `map` — draw the project map into `agents/map/` (ADR-297): `index.html`,
 * `MAP.md`, one page per area and the `map.json` they are rendered from.
 * Builds or updates the graph first when it is absent or behind.
 */
async function cmdMap(argv: string[]): Promise<number> {
    if (argv.includes('--estate')) return estateMapMain(argv);
    if (argv.includes('--demo')) return cmdMapDemo(argv);
    const section = flag(argv, '--section');
    if (section !== null) {
        const out = flag(argv, '--out');
        const r = mapSection(out ? path.resolve(out) : graphHome(resolveRoot(argv)).mapDir, section);
        process.stdout.write(r.ok ? `${r.body}\n` : `code-graph: ${r.reason}${r.names.length ? ` — sections: ${r.names.join(', ')}` : ''}\n`);
        return r.ok ? 0 : 1;
    }
    const root = resolveRoot(argv);
    if (!fs.existsSync(root)) {
        process.stderr.write(`code-graph: root not found: ${root}\n`);
        return 1;
    }
    // A background refresh may be redrawing the same files; two writers would
    // interleave them. Wait for it — a session start is exactly when someone asks
    // for the map — but not beyond one refresh budget plus a redraw.
    let release = acquireRefreshLock(root);
    const deadline = Date.now() + MAP_LOCK_WAIT_MS;
    if (release === null) process.stderr.write('code-graph: waiting for a background refresh to finish…\n');
    while (release === null && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 250));
        release = acquireRefreshLock(root);
    }
    if (release === null) {
        process.stderr.write('code-graph: a refresh is still redrawing the map — try again in a moment\n');
        return 1;
    }
    try {
        return await drawMap(argv);
    } finally {
        release();
    }
}

/**
 * `map --demo [--out DIR] [--open] [--no-verify]` — the map and the hub drawn
 * from the demo fixture (`map_demo.ts`), for frontend work in a repository that
 * has no data, contracts or pipelines of its own.
 */
async function cmdMapDemo(argv: string[]): Promise<number> {
    const root = resolveRoot(argv);
    const out = flag(argv, '--out');
    const { buildDemoMap } = await import('./map_demo.js');
    let r: Awaited<ReturnType<typeof buildDemoMap>>;
    try {
        r = await buildDemoMap(root, out ? { outDir: path.resolve(out) } : {});
    } catch (e) {
        process.stderr.write(`code-graph map --demo: ${(e as Error).message}\n`);
        return 1;
    }
    const rel = path.relative(process.cwd(), r.outDir) || '.';
    process.stdout.write(
        `✅  code-graph map --demo — ${r.map.meta.summary} · state ${r.map.meta.state}\n` +
            `    hub: ${r.hubProjects} fixture projects\n` +
            `    wrote ${path.join(rel, 'index.html')} and ${path.join(rel, 'hub', 'index.html')}\n`,
    );
    let rc = 0;
    if (!argv.includes('--no-verify')) {
        for (const [page, hash] of [[r.page, ''], [r.hubPage, '#/projects']] as const) {
            const check = await verifyMap(page, hash ? { hash } : {});
            process.stdout.write(`    render check ${path.basename(path.dirname(page))}: ${check.verification}${check.reason ? ` — ${check.reason}` : ''}\n`);
            if (check.verification === 'failed') rc = 1;
        }
    }
    if (argv.includes('--open')) {
        const { default: open } = await import('open');
        await open(r.page);
    }
    return rc;
}

/** How long `map` waits for a background refresh to release the lock. */
const MAP_LOCK_WAIT_MS = Number(process.env['AGENT_CONFIG_MAP_LOCK_WAIT_MS'] ?? 90 * 1000);

/** The map itself; callers hold the refresh lock. */
async function drawMap(argv: string[]): Promise<number> {
    const root = resolveRoot(argv);
    const out = flag(argv, '--out');
    const diffRev = flag(argv, '--diff');
    const r = await buildMap(root, {
        ...(out ? { outDir: path.resolve(out) } : {}),
        ...(diffRev !== null ? { diffRev } : {}),
        ...(argv.includes('--prs') ? { prs: true } : {}),
        ...(argv.includes('--branches') ? { branches: true } : {}),
        ...(argv.includes('--no-build') ? { noBuild: true } : {}),
    });
    const rel = path.relative(process.cwd(), r.outDir) || '.';
    const largest = r.model.areas.find((a) => a.kind === 'area');
    process.stdout.write(
        `✅  code-graph map — ${r.meta.summary}\n` +
            `    graph: ${r.graphBuilt ? 'rebuilt' : 'reused'} · state ${r.meta.state} · commit ${r.meta.commit}\n` +
            (largest ? `    largest area: ${largest.name} (${largest.files.length} files)\n` : '') +
            (r.model.diff
                ? `    diff ${r.model.diff.rev}: ${r.model.diff.changed.length} changed · ${r.model.diff.impacted.length} linked into them · ${r.model.diff.areas.length} area(s) touched\n`
                : '') +
            `    wrote: ${r.written.length} files under ${rel}/ — open ${path.join(rel, 'index.html')}\n` +
            (fs.existsSync(graphHome(root).autoRefreshPath)
                ? ''
                : '    keep it current at every agent session start: agent-config code-graph auto-refresh on\n'),
    );
    let rc = 0;
    const renderFile = path.join(r.outDir, '.build', 'map-render.json');
    if (argv.includes('--no-verify')) {
        // A check that names the generation it checked can stay beside a newer
        // map without being read as about it; one that names none cannot.
        try {
            const prev = JSON.parse(fs.readFileSync(renderFile, 'utf-8')) as { graph_generation?: unknown };
            if (typeof prev.graph_generation !== 'string') fs.rmSync(renderFile, { force: true });
        } catch {
            fs.rmSync(renderFile, { force: true });
        }
    } else {
        const check = await verifyMap(path.join(r.outDir, 'index.html'));
        fs.writeFileSync(renderFile, `${JSON.stringify({ ...check, graph_generation: r.meta.graph_generation }, null, 2)}\n`);
        const problems = check.viewports
            .flatMap((v) => [
                ...(v.pageErrors ? [`${v.name}: ${v.pageErrors} page error(s)`] : []),
                ...(v.externalRequests ? [`${v.name}: ${v.externalRequests} network request(s)`] : []),
                ...(v.horizontalScroll ? [`${v.name}: horizontal scroll`] : []),
                ...v.views.filter((x) => x.outside || x.overlapping).map((x) => `${v.name}/${x.view}: ${x.outside} label(s) cut off, ${x.overlapping} overlapping`),
            ])
            .join('; ');
        process.stdout.write(
            `    render check: ${check.verification}` +
                (check.reason ? ` — ${check.reason}` : '') +
                (problems ? ` — ${problems}` : check.verification === 'verified' ? ` — ${check.viewports.map((v) => v.name).join(', ')}` : '') +
                '\n',
        );
        if (check.verification === 'failed') rc = 1;
    }
    if (argv.includes('--open')) {
        const { default: open } = await import('open');
        await open(path.join(r.outDir, 'index.html'));
    }
    return rc;
}

/**
 * `open [--root P] [--out DIR]` — show the map that is already drawn, without
 * redrawing it. Resolves the page exactly where `map` writes it.
 */
export async function openMap(
    argv: string[],
    opener: (target: string) => Promise<unknown> = async (target) => (await import('open')).default(target),
): Promise<number> {
    const root = resolveRoot(argv);
    const out = flag(argv, '--out');
    const page = path.join(out ? path.resolve(out) : graphHome(root).mapDir, 'index.html');
    const relative = path.relative(process.cwd(), page);
    const rel = relative && !relative.startsWith('..') ? relative : page;
    if (!fs.existsSync(page)) {
        process.stderr.write(`code-graph: no map at ${rel} — draw one with \`agent-config code-graph map\` (add --open to open it right away)\n`);
        return 1;
    }
    await opener(page);
    process.stdout.write(`opened ${rel}\n`);
    return 0;
}

/**
 * `outcome <path> useful|dead-end` — record, locally, that a session found a
 * file useful or a dead end. The map draws the time-decayed result as a ring;
 * nothing leaves the machine and nothing is committed.
 */
function cmdOutcome(argv: string[]): number {
    const [file, outcome] = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    if (!file || (outcome !== 'useful' && outcome !== 'dead-end')) {
        process.stderr.write('usage: code_graph/cli.ts outcome <path> useful|dead-end [--root P]\n');
        return 2;
    }
    const root = resolveRoot(argv);
    try {
        recordOutcome(root, file, outcome);
    } catch (e) {
        process.stderr.write(`code-graph: ${(e as Error).message}\n`);
        return 2;
    }
    process.stdout.write(`recorded: ${file} ${outcome}\n`);
    return 0;
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
        if (sub === 'refresh' && argv.includes('--touched')) return await verifyMain('refresh', argv.slice(1), resolveRoot(argv.slice(1)), flag(argv, '--graph') ?? cacheFor(resolveRoot(argv.slice(1))));
        if (sub === 'refresh') return await cmdRefresh(argv.slice(1));
        if (sub === 'confirm' || sub === 'pack' || sub === 'rebuild-diff' || sub === 'verify')
            return await verifyMain(sub, argv.slice(1), resolveRoot(argv.slice(1)), flag(argv, '--graph') ?? cacheFor(resolveRoot(argv.slice(1))));
        if (sub === 'query' || sub === 'explain' || sub === 'affected' || sub === 'path')
            return cmdQuery(sub, argv.slice(1));
        if (sub === 'impact') return cmdImpact(argv.slice(1));
        if (sub === 'tests-for') return cmdTestsFor(argv.slice(1));
        if (sub === 'review-risk') return cmdReviewRisk(argv.slice(1));
        if (sub === 'why' || sub === 'usage' || sub === 'remove-plan') return await cmdSystems(sub, argv.slice(1));
        if (sub === 'provenance') return cmdProvenance(argv.slice(1));
        if (sub === 'branches') return await cmdBranches(argv.slice(1));
        if (sub === 'branch-diff') return await cmdBranchDiff(argv.slice(1));
        if (sub === 'on-branches') return cmdOnBranches(argv.slice(1));
        if (sub === 'untested') return cmdUntested(argv.slice(1));
        if (sub === 'dead') return cmdDead(argv.slice(1));
        if (sub === 'suggest-verb') return cmdSuggestVerb(argv.slice(1));
        if (sub === 'scope') return cmdScope(argv.slice(1));
        if (sub === 'lint') return cmdLint(argv.slice(1));
        if (sub === 'lineage' || (sub === 'map' && argv.includes('--lineage')))
            return await lineageMain(sub === 'lineage' ? argv.slice(1) : ['map', ...argv.slice(1)]);
        if (sub === 'map') return await cmdMap(argv.slice(1));
        if (sub === 'open') return await openMap(argv.slice(1));
        if (sub === 'outcome') return cmdOutcome(argv.slice(1));
        if (sub === 'auto-refresh') return cmdAutoRefresh(argv.slice(1));
        if (sub === 'projects') return projectsMain(argv.slice(1));
        if (sub === 'estate') return estateMain(argv.slice(1));
        if (sub === 'bugs') return bugsMain(argv.slice(1));
        if (sub === 'ask') return askMain(argv.slice(1));
        if (sub === 'scan') return scanMain(argv.slice(1));
        process.stderr.write(
            'usage: code_graph/cli.ts <build|validate|detect|refresh|query|explain|affected|path|' +
                'impact|review-risk|why|usage|remove-plan|provenance|branches|branch-diff|on-branches|tests-for|untested|dead|confirm|pack|rebuild-diff|verify|suggest-verb|scope|lint|map|open|outcome|auto-refresh|projects|estate|lineage|bugs|ask|scan> [options]\n',
        );
        return 2;
    } catch (e) {
        if (e instanceof UsageError) {
            process.stderr.write(`code-graph: ${e.message}\n`);
            return 1;
        }
        process.stderr.write(`code-graph: internal error: ${(e as Error).message}\n`);
        return 3;
    }
}

/** `lint [--root P] [--graph P]` — nodes, then edges; one line per problem, exit 1 when there is any. */
function cmdLint(argv: string[]): number {
    const opt = (name: string): string | undefined => {
        const i = argv.indexOf(name);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const root = path.resolve(opt('--root') ?? '.');
    const file = opt('--graph') ?? graphHome(root).cachePath;
    if (!fs.existsSync(file)) throw new UsageError(`no graph at ${file} — run \`code-graph build\` first`);
    const g = JSON.parse(fs.readFileSync(file, 'utf-8')) as CodeGraph;
    const problems = lintGraph(g);
    for (const p of problems) process.stdout.write(`${p.kind}: ${p.item} — ${p.detail}\n`);
    process.stdout.write(`code-graph lint: ${g.nodes.length} nodes, ${g.edges.length} edges, ${problems.length} problem(s)\n`);
    return problems.length === 0 ? 0 : 1;
}

/** `scope <path…> [--root P]` — one line per path: its scope and the rule that decided. */
function cmdScope(argv: string[]): number {
    const at = argv.indexOf('--root');
    const root = at >= 0 ? path.resolve(argv[at + 1] ?? '.') : process.cwd();
    const paths = argv.filter((a, i) => a !== '--root' && argv[i - 1] !== '--root');
    if (paths.length === 0) throw new UsageError('scope needs at least one path');
    const overrides = readScopeRules(path.join(root, 'agents', 'map', 'layers.yaml'));
    for (const p of paths) process.stdout.write(`${explainScope(path.isAbsolute(p) ? path.relative(root, p) : p, overrides)}\n`);
    return 0;
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
