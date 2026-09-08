/**
 * Phase-3 verbs a gate can read (`road-to-a-graph-that-is-shipped` 3.1–3.3).
 *
 * `query` / `explain` / `affected` / `path` answer a question a human asked.
 * These four answer a question a GATE asks, which is a different shape: the
 * output has to be a decidable set rather than a readable neighbourhood, and it
 * has to say what it filtered out, because a gate that acts on a set nobody can
 * audit is a gate nobody should trust.
 *
 * THE ACCEPTED-EDGE FILTER, and why it is `resolved_via` and not `confidence`.
 *
 * An edge is ACCEPTED when its `resolved_via` is not in
 * {@link NON_ACCEPTED_VIA} — `name-lookup` and `dynamic`. Both are guesses:
 * `name-lookup` is the repo-wide same-name table (or a lookup that found
 * nothing), and `dynamic` is a receiver the extractor cannot type. Neither
 * states where the target came from, so neither may drive a gate.
 *
 * The filter cannot be expressed on the confidence axis at all, which is the
 * whole reason 2.2 added the field: a `name-lookup` hit and a `same-file` hit
 * can both be INFERRED, and an AMBIGUOUS `import-specifier` edge carries a real
 * specifier the file itself states. Filtering on `confidence` would drop the
 * second and keep the first — exactly backwards.
 *
 * EVERY VERB REPORTS ITS OWN FILTERING.
 *
 * Each result carries a `resolved_via` histogram over the edges it CONSIDERED
 * (accepted and rejected, separately) plus the graph's staleness state. A
 * caller can therefore tell "no callers" from "no callers I would trust", and
 * "dead" from "dead as of a graph 40 commits behind".
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { GraphState } from './detect.js';
import type { LoadedGraph, RecommendedRead } from './query.js';
import { resolveSeeds } from './query.js';
import { sanitizeLabel } from './sanitize.js';
import { type CodeEdge, EXT_LANG, GUESS_RESOLVED_VIA, isStatedResolution, type ResolvedVia } from './types.js';

/**
 * Mechanisms a gate-facing verb refuses to walk.
 *
 * Named as the REJECTED set rather than the accepted one deliberately: the
 * accepted set grows every time a resolution tier lands (2.3 added `path-alias`
 * and `psr4`; a future route table adds `route-table`), and an allowlist would
 * have silently excluded each new mechanism until someone remembered to add it.
 * A denylist of the two guesses is the invariant.
 */
export const NON_ACCEPTED_VIA: ReadonlySet<ResolvedVia> = GUESS_RESOLVED_VIA;

export function isAcceptedEdge(e: CodeEdge): boolean {
    return isStatedResolution(e.resolved_via);
}

/**
 * Relations that constitute a REFERENCE to the target, as opposed to
 * containment of it.
 *
 * `member` is the one exclusion and it is load-bearing for `dead`: the build
 * pass emits `file --member--> symbol` and `class --member--> method` for every
 * declaration, so on the fixture that motivated this every one of the ten nodes
 * had an accepted in-edge and `dead` returned the empty set — a verb that can
 * never report anything, which is worse than a wrong one because it looks calm.
 * A declaration is not a use.
 *
 * `tests` IS a reference: a symbol only a test imports is referenced, and
 * whether that makes it live is the caller's judgement, not the graph's.
 * `untested` is the verb that answers the other question.
 */
export const REFERENCE_RELATIONS: ReadonlySet<CodeEdge['relation']> = new Set<CodeEdge['relation']>([
    'calls',
    'imports',
    'uses',
    'inherits',
    'tests',
]);

export function isReferenceEdge(e: CodeEdge): boolean {
    return REFERENCE_RELATIONS.has(e.relation);
}

/** Descending-by-count `resolved_via` histogram, ties broken alphabetically. */
export function viaHistogram(edges: readonly CodeEdge[]): string {
    const counts = new Map<string, number>();
    for (const e of edges) counts.set(e.resolved_via, (counts.get(e.resolved_via) ?? 0) + 1);
    if (counts.size === 0) return '(none)';
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .map(([via, n]) => `${via} ${n}`)
        .join(' · ');
}

/** Common envelope: what answered, how stale it was, what was filtered. */
export interface VerbReport {
    source: string;
    state: GraphState;
    /** `resolved_via` histogram of the edges the walk ACCEPTED. */
    accepted_via: string;
    /** `resolved_via` histogram of the edges the walk REFUSED to walk. */
    rejected_via: string;
    lines: string[];
    recommended_reads: RecommendedRead[];
}

function readFor(g: LoadedGraph, id: string): RecommendedRead | null {
    const n = g.byId.get(id);
    if (!n) return null;
    const loc = n.source_location;
    return { path: n.source_file, lines: loc.length >= 3 ? [loc[0] as number, loc[2] as number] : null };
}

function dedupeReads(reads: readonly (RecommendedRead | null)[]): RecommendedRead[] {
    const m = new Map<string, RecommendedRead>();
    for (const r of reads) {
        if (!r) continue;
        m.set(r.lines ? `${r.path}:${r.lines[0]}-${r.lines[1]}` : r.path, r);
    }
    return [...m.values()];
}

// 3.1 impact.

/** One reverse-reachable node, with how far away it is and what reached it. */
export interface ReachedNode {
    node: string;
    /** Hop distance from the nearest seed. Never 0 — a seed is not a dependent. */
    depth: number;
    /** The relation of the edge that FIRST reached it, at its shallowest depth. */
    via: CodeEdge['relation'];
    /** That edge's mechanism. */
    resolved_via: ResolvedVia;
}

export interface ImpactResult extends VerbReport {
    /** Node ids the diff touched that the graph knows. */
    seeds: string[];
    /**
     * Touched files the graph SHOULD know and does not — a real gap.
     *
     * A file in a language the engine indexes (php / ts / js) that carries no
     * node. Distinct from {@link ImpactResult.not_indexed_files}, and the
     * distinction is the finding: an unindexed `.md` is not an unknown
     * neighbourhood.
     */
    unresolved_files: string[];
    /** Touched files in a language the engine does not index. Not a gap. */
    not_indexed_files: string[];
    /** Reverse-reachable callers/dependents over accepted edges, sorted. */
    dependents: string[];
    /**
     * The same set as `dependents`, carrying depth and the reaching relation.
     *
     * Two shapes for one set, deliberately: `dependents` is what a human reads
     * and what the golden fixtures pin, while a consumer that has to explain
     * WHY a node is in the set — the regression selector, 3.4 — needs the hop
     * count and the relation, and reconstructing them by re-running the walk at
     * increasing depths would be the same BFS three times.
     */
    reached: ReachedNode[];
    /** The subset of `dependents` declared in a test file. */
    test_files: string[];
    /** The edges that produced `dependents`, rendered. */
    producing_edges: string[];
}

/**
 * Node ids declared in `files`, plus the file nodes themselves.
 *
 * `idsInFiles` deliberately excludes `kind: 'file'` nodes (it exists to seed a
 * symbol walk), but an `imports` edge's source IS the file node, so a diff that
 * only changes a file's import list would seed nothing without them. Added here
 * rather than by changing `idsInFiles`, whose two existing callers want the
 * symbol-only behaviour.
 */
export function seedsForFiles(
    g: LoadedGraph,
    files: readonly string[],
): { seeds: string[]; unresolved: string[]; not_indexed: string[] } {
    const symbols = g.idsInFiles(files);
    const seeds = new Set(symbols);
    const unresolved: string[] = [];
    const notIndexed: string[] = [];
    for (const f of files) {
        if (g.byId.has(f)) {
            seeds.add(f);
            continue;
        }
        if (symbols.some((s) => s.startsWith(`${f}#`))) continue;
        // A `.md`, `.json` or `.yaml` the engine never indexes is NOT an
        // unknown neighbourhood — it is a file with no symbols, which is a fact
        // about the language set and not a gap in the graph. Conflating the two
        // made `selectionVerdict` refuse unconditionally for any candidate that
        // touched a doc, and made `impact --diff` print a long
        // "unresolved changed files" list on every normal diff. Found by an
        // independent review, demonstrated with `touches: ['…Mailer.php',
        // 'README.md']`.
        if (EXT_LANG[path.extname(f).toLowerCase()] === undefined) notIndexed.push(f);
        else unresolved.push(f);
    }
    return {
        seeds: [...seeds].sort(),
        unresolved: unresolved.sort(),
        not_indexed: notIndexed.sort(),
    };
}

/**
 * `impact` — everything that reaches the changed symbols over ACCEPTED edges.
 *
 * Reverse BFS, so `dependents` are the things a change to the seeds can break,
 * never the things the seeds themselves use. `depth` bounds the walk; the
 * default of 2 matches `affected`'s so the two verbs do not disagree about what
 * "reachable" means.
 */
export function impact(
    g: LoadedGraph,
    files: readonly string[],
    state: GraphState,
    depth = 2,
    isTest: (relPath: string) => boolean = () => false,
): ImpactResult {
    const { seeds, unresolved, not_indexed } = seedsForFiles(g, files);
    const accepted: CodeEdge[] = [];
    const rejected: CodeEdge[] = [];
    const seen = new Set(seeds);
    const reached = new Map<string, ReachedNode>();
    let frontier = [...seeds];
    for (let d = 0; d < depth && frontier.length; d += 1) {
        const next: string[] = [];
        for (const t of frontier) {
            // Containment first, for the same reason `dead` does it: a
            // `member` in-edge is the declaring file, never a dependent, and
            // counting it as a rejected MECHANISM would misreport the filter.
            for (const e of (g.in.get(t) ?? []).filter(isReferenceEdge)) {
                if (!isAcceptedEdge(e)) {
                    rejected.push(e);
                    continue;
                }
                accepted.push(e);
                if (seen.has(e.source)) continue;
                seen.add(e.source);
                reached.set(e.source, {
                    node: e.source,
                    depth: d + 1,
                    via: e.relation,
                    resolved_via: e.resolved_via,
                });
                next.push(e.source);
            }
        }
        frontier = next;
    }
    const deps = [...reached.keys()].sort();
    const fileOf = (id: string): string => g.byId.get(id)?.source_file ?? '';
    const testFiles = [...new Set(deps.map(fileOf).filter((f) => f !== '' && isTest(f)))].sort();
    return {
        source: g.source,
        state,
        accepted_via: viaHistogram(accepted),
        rejected_via: viaHistogram(rejected),
        seeds,
        unresolved_files: unresolved,
        not_indexed_files: not_indexed,
        dependents: deps,
        reached: deps.map((d) => reached.get(d) as ReachedNode),
        test_files: testFiles,
        producing_edges: accepted.map(renderEdge).sort(),
        lines: deps.map((d) => `${d}`),
        recommended_reads: dedupeReads(deps.map((d) => readFor(g, d))),
    };
}

function renderEdge(e: CodeEdge): string {
    return `${e.confidence} ${sanitizeLabel(e.source)} --${e.relation}/${e.resolved_via}--> ${sanitizeLabel(e.target)}`;
}

// 3.2 tests-for / untested.

export interface TestsForResult extends VerbReport {
    seeds: string[];
    /** Test-file node ids whose `tests` edge reaches a seed, sorted. */
    tests: string[];
    /** The `tests` edges this walk accepted — so a caller aggregating several
     * symbols reports the histogram of the walk the decision came from. */
    accepted_edges: CodeEdge[];
    /** The `tests` edges this walk refused, for the same reason. */
    rejected_edges: CodeEdge[];
}

/**
 * `tests-for <symbol>` — the test files that import the symbol, or its file.
 *
 * Two hops of one specific shape, not a general BFS: a `tests` edge points at
 * whatever the test file imported, which is usually the SYMBOL but is the FILE
 * node when the test imports a module rather than a name. So a seed's own
 * `tests` in-edges are collected, and so are its declaring file's — otherwise
 * `tests-for someFunction` would answer empty for a test that does
 * `import * as m from './mod.js'`.
 */
export function testsFor(g: LoadedGraph, symbol: string, state: GraphState): TestsForResult {
    const seeds = resolveSeeds(g, symbol);
    const targets = new Set(seeds);
    for (const s of seeds) {
        const f = g.byId.get(s)?.source_file;
        if (f && g.byId.has(f)) targets.add(f);
    }
    const accepted: CodeEdge[] = [];
    const rejected: CodeEdge[] = [];
    const tests = new Set<string>();
    for (const t of targets) {
        for (const e of g.in.get(t) ?? []) {
            if (e.relation !== 'tests') continue;
            if (!isAcceptedEdge(e)) {
                rejected.push(e);
                continue;
            }
            accepted.push(e);
            tests.add(e.source);
        }
    }
    const list = [...tests].sort();
    return {
        source: g.source,
        state,
        accepted_via: viaHistogram(accepted),
        rejected_via: viaHistogram(rejected),
        seeds,
        tests: list,
        accepted_edges: accepted,
        rejected_edges: rejected,
        lines: list,
        recommended_reads: dedupeReads(list.map((t) => readFor(g, t))),
    };
}

export interface UntestedResult extends VerbReport {
    seeds: string[];
    unresolved_files: string[];
    not_indexed_files: string[];
    /** Changed nodes with no `tests` edge reaching them or their file. */
    untested: string[];
    /** Changed nodes that do have one — reported so the ratio is readable. */
    tested: string[];
}

/**
 * `untested --diff <rev>` — changed symbols no test file imports.
 *
 * File nodes are excluded from the answer: a file is "tested" exactly when
 * something in it is, so listing both the file and its symbols would double
 * count and make the ratio meaningless.
 */
export function untested(g: LoadedGraph, files: readonly string[], state: GraphState): UntestedResult {
    const { seeds, unresolved, not_indexed } = seedsForFiles(g, files);
    const accepted: CodeEdge[] = [];
    const rejected: CodeEdge[] = [];
    const tested: string[] = [];
    const bare: string[] = [];
    for (const s of seeds) {
        if (g.byId.get(s)?.kind === 'file') continue;
        const r = testsFor(g, s, state);
        // Both histograms come from the SAME walk the decision came from —
        // `testsFor`, which also consults the declaring FILE's edges. They used
        // to be assembled here from the seed's own edges with `rejected_via`
        // hardcoded to `(none)`, so the envelope could report "nothing was
        // rejected" without measuring, and "accepted: (none)" for a symbol it
        // had just called tested. An independent review found both.
        accepted.push(...r.accepted_edges);
        rejected.push(...r.rejected_edges);
        if (r.tests.length) tested.push(s);
        else bare.push(s);
    }
    return {
        source: g.source,
        state,
        accepted_via: viaHistogram(accepted),
        rejected_via: viaHistogram(rejected),
        seeds,
        unresolved_files: unresolved,
        not_indexed_files: not_indexed,
        untested: bare.sort(),
        tested: tested.sort(),
        lines: bare.sort(),
        recommended_reads: dedupeReads(bare.map((b) => readFor(g, b))),
    };
}

// 3.3 dead.

/** One declared entry-point source, and whether it could be read. */
export interface EntryPointSource {
    name: 'routes' | 'exports' | 'cli-registry' | 'hook-manifest' | 'allowlist';
    /** `read` — consulted successfully. `empty` — consulted, nothing declared.
     * `unavailable` — the graph or the tree cannot answer it at all. */
    status: 'read' | 'empty' | 'unavailable';
    /** Why, when `unavailable`. */
    detail?: string;
    /** Node ids or labels this source declares as entry points. */
    entries: string[];
}

export interface DeadResult extends VerbReport {
    sources: EntryPointSource[];
    /** Non-null when the verb REFUSED to answer. The list is then empty. */
    refusal: string | null;
    dead: string[];
    /** Entry points excluded from `dead` — the audit trail for the exclusion. */
    excluded: string[];
}

/**
 * Symbols with zero accepted in-edges, minus declared entry points.
 *
 * WHY THIS VERB CAN REFUSE.
 *
 * AI council 2026-09-08 (2/2 convergent, round 2 Fork 4, option 2). Step 3.3
 * names four entry-point sources — routes, exports, the CLI registry, the hook
 * manifest — and one of them, `exports`, cannot be evaluated from this graph at
 * all: the extractor records no exportedness (`FileExtract` carries
 * `nodes / rawEdges / inherits / parseError`; `CodeNode` carries no export
 * flag). Without it, every exported-but-not-yet-imported public symbol in a
 * library-shaped tree reports as dead — which is Risk-Register rank 4 arriving
 * through the verb rather than around it: *"A confident false 'dead' is worse
 * than no verb: it invites a deletion the graph cannot justify."*
 *
 * So the verb is fail-closed in the shape this repository already uses for
 * `selectionVerdict` (`_lib/regression_neighbourhood.ts`): the refusal is not
 * relaxable by an option object, only by the caller supplying the missing
 * source (`--entry-points <file>`) or explicitly acknowledging its absence
 * (`--accept-missing-exports`). Both are visible in a command line and in a
 * diff; a boolean buried in an options bag is not.
 *
 * WHAT IT DOES NOT CLAIM.
 *
 * Nothing here says an unreferenced symbol should be deleted. `dead` reports
 * "no accepted in-edge, and no declared entry point names it", which is a
 * question worth asking and not an answer.
 */
export function dead(
    g: LoadedGraph,
    sources: readonly EntryPointSource[],
    state: GraphState,
    opts: { acceptMissingExports?: boolean } = {},
): DeadResult {
    const unavailable = sources.filter((s) => s.status === 'unavailable');
    const base = {
        source: g.source,
        state,
        sources: [...sources],
    };
    if (unavailable.length > 0 && opts.acceptMissingExports !== true) {
        return {
            ...base,
            accepted_via: '(none)',
            rejected_via: '(none)',
            refusal:
                `entry-point source(s) unavailable: ${unavailable
                    .map((s) => `${s.name} (${s.detail ?? 'no detail'})`)
                    .join('; ')}. ` +
                'A symbol they would have declared an entry point is indistinguishable from a dead one, ' +
                'so no list is produced. Supply the missing source with --entry-points <file>, or state ' +
                'that you accept the gap with --accept-missing-exports.',
            dead: [],
            excluded: [],
            lines: [],
            recommended_reads: [],
        };
    }

    const entries = new Set<string>();
    for (const s of sources) for (const e of s.entries) entries.add(e);
    const accepted: CodeEdge[] = [];
    const rejected: CodeEdge[] = [];
    const candidates: string[] = [];
    const excluded: string[] = [];
    for (const id of g.allNodeIds()) {
        const n = g.byId.get(id);
        if (!n || n.kind === 'file' || n.kind === 'skipped') continue;
        // Containment is filtered BEFORE acceptance, so the histogram counts
        // only edges the verb actually reasoned about — a `member` edge in
        // `rejected_via` would read as a rejected mechanism, which it is not.
        const incoming = (g.in.get(id) ?? []).filter(isReferenceEdge);
        const acc = incoming.filter(isAcceptedEdge);
        accepted.push(...acc);
        rejected.push(...incoming.filter((e) => !isAcceptedEdge(e)));
        if (acc.length > 0) continue;
        if (entries.has(id) || entries.has(n.label)) {
            excluded.push(id);
            continue;
        }
        candidates.push(id);
    }
    const list = candidates.sort();
    return {
        ...base,
        accepted_via: viaHistogram(accepted),
        rejected_via: viaHistogram(rejected),
        refusal: null,
        dead: list,
        excluded: excluded.sort(),
        lines: list,
        recommended_reads: dedupeReads(list.map((d) => readFor(g, d))),
    };
}

// Entry-point providers.

/**
 * DECLARED names in a registry or manifest — quoted string literals and YAML
 * scalar values, never every identifier in the file.
 *
 * The first version matched `/[A-Za-z_$][A-Za-z0-9_$]*​/g` over the whole file,
 * which on this tree yielded ~2,595 tokens including `name`, `build`, `query`,
 * `path`, `main`, `run`, `get`, `set`, `value` and `status`. Every symbol whose
 * LABEL happened to be one of those was silently excluded from `dead` and
 * dumped into a list described as "the audit trail for the exclusion" — at that
 * size unable to distinguish a declared entry point from a coincidental word.
 * An independent review measured it.
 *
 * A registry and a manifest both DECLARE by value: `{ name: 'code-graph', … }`,
 * `id: code-graph-context`. So the extraction is quoted strings plus
 * `key: value` scalars, which is narrower by construction and still a scan
 * rather than a parse — a provider that half-parses a TypeScript module is a
 * provider that goes wrong quietly.
 *
 * Still a heuristic, and the direction is the safe one: a missed declaration
 * makes `dead` report a real entry point (loud, and caught by the reader), a
 * spurious one makes it miss a dead symbol (quiet). That asymmetry is why the
 * narrowing is worth the risk of missing one.
 */
function declaredNames(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(/'([^'\n]{1,120})'|"([^"\n]{1,120})"|`([^`\n]{1,120})`/g)) {
        const v = (m[1] ?? m[2] ?? m[3] ?? '').trim();
        if (v !== '') out.add(v);
    }
    for (const m of text.matchAll(/^[ \t-]*[A-Za-z_][\w-]*:[ \t]+([^\n#]{1,120})$/gm)) {
        const v = (m[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
        if (v !== '') out.add(v);
    }
    return [...out];
}

/**
 * The four sources step 3.3 names, read from `root`.
 *
 * `exports` is ALWAYS `unavailable` here, with the reason stated, until the
 * extractor records exportedness. That is the honest reading and it is what
 * makes {@link dead} refuse by default rather than lie by default.
 */
export function repoEntryPoints(root: string): EntryPointSource[] {
    const out: EntryPointSource[] = [];

    const registry = path.join(root, 'src', 'cli', 'registry.ts');
    if (fs.existsSync(registry)) {
        out.push({ name: 'cli-registry', status: 'read', entries: declaredNames(fs.readFileSync(registry, 'utf-8')) });
    } else {
        out.push({ name: 'cli-registry', status: 'empty', entries: [] });
    }

    const manifest = path.join(root, 'src', 'scripts', 'hook_manifest.yaml');
    if (fs.existsSync(manifest)) {
        out.push({ name: 'hook-manifest', status: 'read', entries: declaredNames(fs.readFileSync(manifest, 'utf-8')) });
    } else {
        out.push({ name: 'hook-manifest', status: 'empty', entries: [] });
    }

    // Routes: no route table exists in this repository. `empty` rather than
    // `unavailable` — consulted, nothing declared — because an absent route
    // table is a fact about the tree, not a gap in the graph.
    out.push({ name: 'routes', status: 'empty', entries: [] });

    out.push({
        name: 'exports',
        status: 'unavailable',
        detail: 'the extractor records no exportedness — CodeNode carries no export flag',
        entries: [],
    });
    return out;
}

/** An operator-supplied entry-point list: one id or label per line, `#` comments. */
export function entryPointsFromFile(file: string): EntryPointSource {
    const lines = fs
        .readFileSync(file, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '' && !l.startsWith('#'));
    return { name: 'allowlist', status: lines.length ? 'read' : 'empty', entries: lines };
}
