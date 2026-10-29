/**
 * Query tier — one engine, two sources (ADR-124 § 2). Runs identically over
 * the native cache and a consumer-shipped `graph.json`; every answer names
 * which source answered. BFS/DFS with a token budget; hybrid seed-matching
 * (exact id / label → BM25 fallback via `_lib/lexical_index.ts`). All string
 * fields pass the retrieved-content sanitizer before returning.
 */
import * as fs from 'node:fs';

import { LexicalIndex, tokenize } from '../_lib/lexical_index.js';
import { sanitizeLabel } from './sanitize.js';
import {
    emitSqliteTwin,
    type GraphIndex,
    INDEXED_READ_MIN_EDGES,
    openGraphIndex,
} from './sqlite_store.js';
import type { ConfirmState } from './map_areas.js';
import { type CodeEdge, type CodeGraph, type CodeNode, isStatedResolution, type Relation } from './types.js';
import { validateGraph } from './validate.js';
import { adaptForeignGraph, looksForeign } from './foreign.js';

const APPROX_CHARS_PER_TOKEN = 4;

/**
 * The node/adjacency reads every verb performs.
 *
 * Declared as interfaces rather than `Map` so one set of verbs runs over two
 * stores. `Map` satisfies both structurally, so the in-memory path is unchanged
 * and needed no edits; the SQLite path supplies objects with the same two
 * methods that hit an index instead of a heap.
 */
export interface NodeLookup {
    get(id: string): CodeNode | undefined;
    has(id: string): boolean;
}
export interface AdjacencyLookup {
    get(id: string): CodeEdge[] | undefined;
}

export interface LoadedGraph {
    /**
     * The whole deserialized graph — `null` on the indexed path, where not
     * materializing it is the entire point. Nothing in this module reads it;
     * the two callers that used to (`resolveSeedsTiered`, the CLI's
     * changed-file seeds) go through `idsByLabel` / `idsInFiles` instead, which
     * answer the same questions from an index.
     */
    graph: CodeGraph | null;
    source: string; // attribution path
    /**
     * The on-disk path the answer came from.
     *
     * Distinct from `source`, which is a display string (`native:relpath`) and
     * cannot be handed to a freshness check. A verb that prints staleness has
     * to describe THIS file, not a conventional cache path — see
     * `cli.ts::stateOf`.
     */
    answeredBy: string;
    byId: NodeLookup;
    out: AdjacencyLookup;
    in: AdjacencyLookup;
    /** Exact-label resolution. */
    idsByLabel(label: string, limit: number): string[];
    /** Non-file nodes declared in any of `files`. */
    idsInFiles(files: readonly string[]): string[];
    /**
     * Every node id, sorted.
     *
     * A whole-table read, and unlike {@link LoadedGraph.lex} it is not lazy —
     * because the one verb that calls it (`dead`, 3.3) is defined over every
     * node by construction: "zero accepted in-edges" is not a question you can
     * ask about a frontier. Nothing else may use it; a verb that walks from a
     * seed has `idsByLabel` / `idsInFiles` for that.
     */
    allNodeIds(): string[];
    /**
     * BM25 fallback corpus, LAZY.
     *
     * A function rather than a field because on the indexed path building it
     * reads every node — the one whole-table scan left — and a seed that
     * resolves by exact id or exact label must never pay for it. On the
     * in-memory path the corpus is already in hand and this just returns it.
     */
    lex(): LexicalIndex;
    /** Nodes of one kind in the whole graph: the population a filtered or empty answer is stated against. */
    kindCount(kind: string): number;
    /** Release any handle the store holds. No-op for the in-memory path. */
    close(): void;
}

/**
 * A `LoadedGraph` backed by the SQLite index — no `JSON.parse`, no whole-graph
 * `Map`.
 *
 * The adjacency lookups are per-call SQL against `edges_source` / `edges_target`
 * rather than a materialized map, which is the difference the threshold buys: a
 * 2-hop `affected` touches the rows for its frontier, not every edge in the
 * repository. Node reads are memoized per handle because a BFS asks for the
 * same label repeatedly while rendering edge lines, and that repetition is
 * cheap to remove and expensive to leave.
 */
export function indexBackedGraph(index: GraphIndex, source: string, answeredBy: string): LoadedGraph {
    const nodeCache = new Map<string, CodeNode | undefined>();
    const readNode = (id: string): CodeNode | undefined => {
        if (nodeCache.has(id)) return nodeCache.get(id);
        const n = index.getNode(id);
        nodeCache.set(id, n);
        return n;
    };
    let lexical: LexicalIndex | null = null;
    return {
        graph: null,
        source,
        answeredBy,
        byId: { get: readNode, has: (id) => readNode(id) !== undefined },
        out: { get: (id) => index.edgesFrom(id) },
        in: { get: (id) => index.edgesTo(id) },
        idsByLabel: (labelText, limit) => index.idsByLabel(labelText, limit),
        idsInFiles: (files) => index.idsInFiles(files),
        allNodeIds: () => index.allNodeIds(),
        lex: () => {
            lexical ??= new LexicalIndex(index.lexicalCorpus());
            return lexical;
        },
        kindCount: (kind) => index.countKind(kind),
        close: () => index.close(),
    };
}

/**
 * The edge count above which reads go through the SQLite index.
 * `AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES` lowers it so a small fixture graph can
 * be answered through the real twin, which is how that path is tested.
 */
function indexedReadMinEdges(): number {
    return Number(process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'] ?? INDEXED_READ_MIN_EDGES);
}

export function loadGraph(graphPath: string, source = graphPath): LoadedGraph {
    // Above the threshold, read through the INDEX: the twin's rows answer
    // per-node and per-edge questions directly, so neither `JSON.parse` nor the
    // two whole-graph `Map`s below ever run. This is the D6 repair — the twin
    // used to be preferred and still returned the entire serialization, which
    // made it a cheaper blob transport rather than an index.
    const index = openGraphIndex(graphPath);
    // `openGraphIndex` declines on exactly the conditions under which the twin
    // is stale, absent or corrupt — so a handle here means it needs no re-emit.
    const twinCurrent = index !== null;
    if (index) {
        if (index.edgeCount >= indexedReadMinEdges()) return indexBackedGraph(index, source, graphPath);
        // Small graph: the in-memory path is cheaper. Release the handle rather
        // than leaking a database for the life of the process.
        index.close();
    }

    // Below the threshold the JSON is parsed. The twin no longer carries a
    // second copy of it to read instead; a missing or stale twin is re-emitted
    // below (zero-touch rebuild-on-drift, ADR-129 Phase 7).
    const raw = fs.readFileSync(graphPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    // A consumer's own graph file, written by another tool, is DETECTED by
    // `detect.ts` and used to throw here — detected-but-unloadable, the worst
    // of both answers. Adapt it instead: its edges carry `resolved_via:
    // 'foreign'`, which is in the guess set, so the gate verbs refuse it by
    // name rather than answering from it.
    let foreignAdapted = false;
    let candidate = parsed;
    if (looksForeign(parsed)) {
        const adapted = adaptForeignGraph(parsed);
        if (adapted !== null) {
            candidate = adapted.graph;
            foreignAdapted = true;
        }
    }
    const v = validateGraph(candidate);
    if (!v.ok) throw new Error(`invalid graph at ${graphPath}: ${v.errors.slice(0, 3).join('; ')}`);
    const graph = candidate as CodeGraph;
    // The twin is a cache of a file's bytes keyed on its own checksum. An
    // adapted graph's bytes are not the file's, so emitting one would cache a
    // derivation under the source's identity.
    if (!twinCurrent && !foreignAdapted) {
        emitSqliteTwin(graph, graphPath);
    }
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const outM = new Map<string, CodeEdge[]>();
    const inM = new Map<string, CodeEdge[]>();
    const add = (m: Map<string, CodeEdge[]>, k: string, e: CodeEdge): void => {
        const arr = m.get(k);
        if (arr) arr.push(e);
        else m.set(k, [e]);
    };
    for (const e of graph.edges) {
        add(outM, e.source, e);
        add(inM, e.target, e);
    }
    const lex = new LexicalIndex(graph.nodes.map((n) => ({ id: n.id, text: `${n.label} ${n.id}` })));
    return {
        graph,
        source,
        answeredBy: graphPath,
        byId,
        out: outM,
        in: inM,
        idsByLabel: (labelText, limit) =>
            graph.nodes.filter((n) => n.label === labelText).slice(0, limit).map((n) => n.id),
        idsInFiles: (files) => {
            const set = new Set(files);
            return graph.nodes.filter((n) => set.has(n.source_file) && n.kind !== 'file').map((n) => n.id);
        },
        allNodeIds: () => graph.nodes.map((n) => n.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
        lex: () => lex,
        kindCount: (kind) => graph.nodes.filter((x) => x.kind === kind).length,
        close: () => {
            /* nothing held */
        },
    };
}

interface SeedResolution {
    ids: string[];
    /** true when NEITHER an exact-id nor an exact-label match was found and
     * resolution fell back to BM25 — a best-guess, not a confirmed hit. */
    weak: boolean;
}

/** Resolve a free-text seed to node ids: exact id → exact label → BM25. */
function resolveSeedsTiered(g: LoadedGraph, seed: string, limit = 5): SeedResolution {
    if (g.byId.has(seed)) return { ids: [seed], weak: false };
    const exactLabel = g.idsByLabel(seed, limit);
    if (exactLabel.length) return { ids: exactLabel, weak: false };
    // Only here does the BM25 corpus get built — the one whole-table read on
    // the indexed path, and unreachable when the seed resolved exactly.
    const ranked = g.lex().rank(tokenize(seed)).filter((r) => r.score > 0);
    return { ids: ranked.slice(0, limit).map((r) => r.id), weak: true };
}

/**
 * The EXACT half of the ladder above — id, then label — with no BM25 tier.
 *
 * `graph_node` is a node tool: every field it returns (location, degree, the
 * edge lists) is a statement about ONE node, so answering about a best-guess
 * node is worse than refusing. D4 of `road-to-a-graph-that-feeds-the-gate` makes
 * that explicit for this tool — free-text retrieval is the row the graph lost,
 * so a node answer never rests on a score.
 *
 * Still the same ladder and not a second resolver: this calls
 * {@link resolveSeedsTiered} and reads its `weak` flag, so a change to the
 * exact tiers reaches both callers.
 *
 * `ambiguous` carries the candidates when a LABEL resolves to several nodes.
 * Picking the first would be the silent guess this function exists to avoid; the
 * caller re-asks with one of the ids.
 */
export function resolveExactNode(
    g: LoadedGraph,
    seed: string,
): { id: string | null; ambiguous: string[]; more: boolean } {
    // The ladder's default limit is 5, and inheriting it made the refusal LIE:
    // a label on twelve nodes refused with "is a label on 5 nodes" and listed
    // five of them with nothing saying the list was cut. A completion review
    // reproduced it. Ask for one more than we will show, so truncation is
    // detectable rather than invisible.
    const r = resolveSeedsTiered(g, seed, AMBIGUITY_SHOWN + 1);
    if (r.weak || r.ids.length === 0) return { id: null, ambiguous: [], more: false };
    if (r.ids.length > 1) {
        return {
            id: null,
            ambiguous: r.ids.slice(0, AMBIGUITY_SHOWN),
            more: r.ids.length > AMBIGUITY_SHOWN,
        };
    }
    return { id: r.ids[0] as string, ambiguous: [], more: false };
}

/** How many candidate ids an ambiguity refusal lists before it says "and more". */
const AMBIGUITY_SHOWN = 25;

/** Resolve a free-text seed to node ids: exact id → exact label → BM25. */
export function resolveSeeds(g: LoadedGraph, seed: string, limit = 5): string[] {
    return resolveSeedsTiered(g, seed, limit).ids;
}

function label(g: LoadedGraph, id: string): string {
    return sanitizeLabel(g.byId.get(id)?.label ?? id);
}
function edgeLine(g: LoadedGraph, e: CodeEdge): string {
    const cand = e.candidates?.length ? ` [${e.candidates.map((c) => sanitizeLabel(c)).join(', ')}]` : '';
    const guess = isStatedResolution(e.resolved_via) ? '' : ` (guess: ${e.resolved_via})`;
    return `${e.confidence} ${sanitizeLabel(e.source)} --${e.relation}--> ${sanitizeLabel(e.target)}${cand}${guess}`;
}

/** What a reading verb walks: stated edges only, unless the caller asked for guesses by name. */
export interface WalkOptions {
    includeGuesses?: boolean;
}

/** The edge acceptance policy every consumer applies — one predicate, read through `isStatedResolution`. */
export function admitEdge(e: CodeEdge, opts: WalkOptions = {}): boolean {
    return opts.includeGuesses === true || isStatedResolution(e.resolved_via);
}

/**
 * A file + (when known) a 1-based inclusive line range worth reading directly
 * — surfaced whenever the engine dropped or under-trusted something instead
 * of silently truncating it (Phase 9 D4: "a read plan instead of silent
 * truncation").
 */
export interface RecommendedRead {
    path: string;
    lines: [number, number] | null;
    /** Set only on a region the read budget left out: why, so it is counted, never dropped. */
    reason?: string;
}

/** A changed or reached span worth reading, with how much rides on it. */
export interface ReadRegion {
    path: string;
    lines: [number, number];
    /** Higher reads first. */
    risk: number;
    /** A definition up to {@link REGION_DEFINITION_WHOLE} lines is read whole; a longer one is cut there. */
    definition?: boolean;
}

/** Read lines per answer, and the share one file may take of them. */
export const REGION_BUDGET_LINES = 400;
export const REGION_FILE_SHARE = 0.4;
export const REGION_DEFINITION_WHOLE = 40;

/**
 * The region budget behind `recommended_reads`: regions risk-ordered and taken
 * round-robin across files, no file above {@link REGION_FILE_SHARE} of the
 * budget, definitions up to {@link REGION_DEFINITION_WHOLE} lines whole. What
 * does not fit stays in the list with a `reason`, so the reader sees every
 * region and which ones the budget skipped. Line ranges only — never source text.
 */
export function regionReads(regions: readonly ReadRegion[], budget = REGION_BUDGET_LINES): RecommendedRead[] {
    const perFile = Math.floor(budget * REGION_FILE_SHARE);
    const byFile = new Map<string, ReadRegion[]>();
    const ordered = [...regions].sort((a, b) => b.risk - a.risk || (a.path < b.path ? -1 : a.path > b.path ? 1 : a.lines[0] - b.lines[0]));
    for (const r of ordered) byFile.set(r.path, [...(byFile.get(r.path) ?? []), r]);
    const queues = [...byFile.values()];
    const usedIn = new Map<string, number>();
    const kept: RecommendedRead[] = [];
    const rest: RecommendedRead[] = [];
    let used = 0;
    for (let round = 0; queues.some((q) => q.length > round); round += 1) {
        for (const q of queues) {
            const r = q[round];
            if (!r) continue;
            const from = r.lines[0];
            let to = r.lines[1];
            if (r.definition && to - from + 1 > REGION_DEFINITION_WHOLE) {
                rest.push({ path: r.path, lines: [from + REGION_DEFINITION_WHOLE, to], reason: `definition longer than ${REGION_DEFINITION_WHOLE} lines` });
                to = from + REGION_DEFINITION_WHOLE - 1;
            }
            const n = to - from + 1;
            const fileUsed = usedIn.get(r.path) ?? 0;
            if (fileUsed + n > perFile) rest.push({ path: r.path, lines: [from, to], reason: 'per-file share reached' });
            else if (used + n > budget) rest.push({ path: r.path, lines: [from, to], reason: 'read budget reached' });
            else {
                kept.push({ path: r.path, lines: [from, to] });
                used += n;
                usedIn.set(r.path, fileUsed + n);
            }
        }
    }
    return [...kept, ...rest];
}

export interface QueryResult {
    source: string;
    seeds: string[];
    lines: string[];
    truncated: boolean;
    recommended_reads: RecommendedRead[];
}

function readKey(r: RecommendedRead): string {
    return r.lines ? `${r.path}:${r.lines[0]}-${r.lines[1]}` : r.path;
}

/** A node's file + line range, or `null` for an unresolved `symbol:*`
 * placeholder (nothing real to read) or a node with no location info. */
function recommendedReadFor(g: LoadedGraph, id: string): RecommendedRead | null {
    const n = g.byId.get(id);
    if (!n) return null;
    const loc = n.source_location;
    return { path: n.source_file, lines: loc.length >= 3 ? [loc[0] as number, loc[2] as number] : null };
}

/** One relation line plus the node id (if any) a reader should go inspect
 * directly when this line gets dropped by the budget. */
interface LineEntry {
    text: string;
    focusId?: string;
}

/**
 * Apply the token budget to `entries`, then translate BOTH failure classes
 * this delta targets into a deterministic `recommended_reads` list: every
 * entry the budget dropped, plus every read the caller already flagged as
 * weak (an under-threshold/BM25-fallback seed match) — deduped by
 * path+line-range, insertion-ordered for determinism.
 */
function budgetedLines(
    g: LoadedGraph,
    source: string,
    seeds: string[],
    entries: LineEntry[],
    budget: number,
    weakSeedReads: RecommendedRead[] = [],
): QueryResult {
    const cap = budget * APPROX_CHARS_PER_TOKEN;
    const kept: string[] = [];
    const dropped: LineEntry[] = [];
    let used = 0;
    let truncated = false;
    for (const entry of entries) {
        if (!truncated && used + entry.text.length <= cap) {
            kept.push(entry.text);
            used += entry.text.length + 1;
        } else {
            truncated = true;
            dropped.push(entry);
        }
    }
    const recommended = new Map<string, RecommendedRead>();
    for (const r of weakSeedReads) recommended.set(readKey(r), r);
    for (const entry of dropped) {
        if (!entry.focusId) continue;
        const r = recommendedReadFor(g, entry.focusId);
        if (r) recommended.set(readKey(r), r);
    }
    return { source, seeds, lines: kept, truncated, recommended_reads: [...recommended.values()] };
}

/**
 * The same budget as {@link budgetedLines}, for any list: keep items while their
 * rendered characters fit, count the rest. Used by the gate verbs' caps
 * (`answer_detail.ts`), so a capped answer and a truncated query spend tokens alike.
 */
export function budgetList<T>(items: readonly T[], text: (t: T) => string, budget: number): { kept: T[]; omitted: number } {
    const cap = budget * APPROX_CHARS_PER_TOKEN;
    let used = 0;
    let i = 0;
    for (; i < items.length; i += 1) {
        const n = text(items[i] as T).length;
        if (used + n > cap) break;
        used += n + 1;
    }
    return { kept: items.slice(0, i), omitted: items.length - i };
}

function weakSeedReads(g: LoadedGraph, resolution: SeedResolution): RecommendedRead[] {
    if (!resolution.weak) return [];
    const out: RecommendedRead[] = [];
    for (const id of resolution.ids) {
        const r = recommendedReadFor(g, id);
        if (r) out.push(r);
    }
    return out;
}

/** `query <seed>` — the seed's direct (1-hop) outgoing relations. */
export function query(g: LoadedGraph, seed: string, budget = 1500, opts: WalkOptions = {}): QueryResult {
    const resolution = resolveSeedsTiered(g, seed);
    const seeds = resolution.ids;
    const entries: LineEntry[] = [];
    for (const s of seeds) for (const e of g.out.get(s) ?? []) if (admitEdge(e, opts)) entries.push({ text: edgeLine(g, e), focusId: e.target });
    return budgetedLines(g, g.source, seeds.map((s) => label(g, s)), entries, budget, weakSeedReads(g, resolution));
}

/** `explain <seed>` — 2-hop neighbourhood (out-edges of seeds + their targets). */
export function explain(g: LoadedGraph, seed: string, budget = 1500, opts: WalkOptions = {}): QueryResult {
    const resolution = resolveSeedsTiered(g, seed);
    const seeds = resolution.ids;
    const seen = new Set<string>();
    const entries: LineEntry[] = [];
    const frontier = [...seeds];
    for (let hop = 0; hop < 2 && frontier.length; hop += 1) {
        const next: string[] = [];
        for (const s of frontier.splice(0)) {
            if (seen.has(s)) continue;
            seen.add(s);
            for (const e of g.out.get(s) ?? []) {
                if (!admitEdge(e, opts)) continue;
                entries.push({ text: edgeLine(g, e), focusId: e.target });
                next.push(e.target);
            }
        }
        frontier.push(...next);
    }
    return budgetedLines(g, g.source, seeds.map((s) => label(g, s)), entries, budget, weakSeedReads(g, resolution));
}

/** `affected <target>` — reverse BFS: who calls / references the target. */
export function affected(g: LoadedGraph, target: string, depth = 2, budget = 1500, opts: WalkOptions = {}): QueryResult {
    const resolution = resolveSeedsTiered(g, target);
    const seeds = resolution.ids;
    const seen = new Set<string>(seeds);
    const entries: LineEntry[] = [];
    let frontier = [...seeds];
    for (let d = 0; d < depth && frontier.length; d += 1) {
        const next: string[] = [];
        for (const t of frontier) {
            for (const e of g.in.get(t) ?? []) {
                if (!admitEdge(e, opts)) continue;
                // the newly-discovered node here is the CALLER (e.source) —
                // e.target is already a known seed, so that side carries no
                // new read-plan information.
                entries.push({ text: edgeLine(g, e), focusId: e.source });
                if (!seen.has(e.source)) {
                    seen.add(e.source);
                    next.push(e.source);
                }
            }
        }
        frontier = next;
    }
    return budgetedLines(g, g.source, seeds.map((s) => label(g, s)), entries, budget, weakSeedReads(g, resolution));
}

/** `path <a> <b>` — shortest undirected path (direction preserved per edge). */
export function path(g: LoadedGraph, a: string, b: string, budget = 1500, opts: WalkOptions = {}): QueryResult {
    const startRes = resolveSeedsTiered(g, a, 1);
    const goalRes = resolveSeedsTiered(g, b, 1);
    const starts = startRes.ids;
    const goals = new Set(goalRes.ids);
    if (!starts.length || !goals.size) return { source: g.source, seeds: [], lines: [], truncated: false, recommended_reads: [] };
    const start = starts[0] as string;
    const prev = new Map<string, CodeEdge>();
    const seen = new Set<string>([start]);
    let frontier = [start];
    let hit: string | null = goals.has(start) ? start : null;
    while (frontier.length && !hit) {
        const next: string[] = [];
        for (const cur of frontier) {
            const adj = [...(g.out.get(cur) ?? []), ...(g.in.get(cur) ?? [])].filter((e) => admitEdge(e, opts));
            for (const e of adj) {
                const nb = e.source === cur ? e.target : e.source;
                if (seen.has(nb)) continue;
                seen.add(nb);
                prev.set(nb, e);
                if (goals.has(nb)) {
                    hit = nb;
                    break;
                }
                next.push(nb);
            }
            if (hit) break;
        }
        frontier = next;
    }
    const seedReads = [...weakSeedReads(g, startRes), ...weakSeedReads(g, goalRes)];
    if (!hit) {
        return {
            source: g.source,
            seeds: [label(g, start)],
            lines: ['(no path found)'],
            truncated: false,
            recommended_reads: [...new Map(seedReads.map((r) => [readKey(r), r])).values()],
        };
    }
    const chain: CodeEdge[] = [];
    let cur = hit;
    while (prev.has(cur)) {
        const e = prev.get(cur) as CodeEdge;
        chain.unshift(e);
        cur = e.source === cur ? e.target : e.source;
    }
    const entries = chain.map((e) => ({ text: edgeLine(g, e), focusId: e.target }));
    return budgetedLines(g, g.source, [label(g, start), label(g, hit)], entries, budget, seedReads);
}

/** Merge several `QueryResult`s (e.g. one per `--since` seed) into one,
 * de-duplicating `recommended_reads` by path+line-range so a read plan never
 * repeats the same file twice across merged seeds. */
export function mergeRecommendedReads(results: readonly QueryResult[]): RecommendedRead[] {
    const merged = new Map<string, RecommendedRead>();
    for (const r of results) for (const rr of r.recommended_reads) merged.set(readKey(rr), rr);
    return [...merged.values()];
}

// ---------------------------------------------------------------------------
// `node` — one node, its location, its edges, its degree (3.1)
// ---------------------------------------------------------------------------

/** One edge as the node view renders it: who, how, which way, how far. */
export interface NodeEdgeLine {
    /** The node at the OTHER end — the caller for an in-edge, the callee for an out-edge. */
    id: string;
    label: string;
    relation: Relation;
    confidence: string;
    hops: number;
}

export interface NodeResult {
    source: string;
    /** The resolved id, or `''` when nothing resolved and `refusal` is set. */
    id: string;
    label: string;
    kind: string;
    /** File + 1-based inclusive line range, or `null` for a placeholder node. */
    location: RecommendedRead | null;
    /** DIRECT edge counts, always 1-hop — a degree is not a property of a walk. */
    in_degree: number;
    out_degree: number;
    in: NodeEdgeLine[];
    out: NodeEdgeLine[];
    truncated: boolean;
    /** Set when the seed did not resolve exactly; every other field is empty. */
    refusal?: string;
}

export interface NodeOptions {
    direction?: 'in' | 'out' | 'both';
    /** 1-3. Anything outside the range is clamped rather than refused. */
    depth?: number;
    /** Restrict to one relation of the closed vocabulary. */
    relation?: Relation;
    /** List only far ends of this node kind; the walk still passes through others. */
    kind?: string;
}

/** Hard cap per direction, so one hub node cannot return an unbounded payload. */
const NODE_EDGE_CAP = 200;

/**
 * Walk one direction from `start`, recording each edge once, breadth-first.
 *
 * `seen` is keyed on the NODE, so a cycle terminates; the edge list can still
 * carry two lines into the same node by different relations, which is a real
 * distinction a caller asked for when it passed no `relation`.
 */
function walkDirection(
    g: LoadedGraph,
    start: string,
    dir: 'in' | 'out',
    depth: number,
    relation: Relation | undefined,
    kind?: string,
): { lines: NodeEdgeLine[]; truncated: boolean } {
    const lines: NodeEdgeLine[] = [];
    const seen = new Set<string>([start]);
    let frontier = [start];
    let truncated = false;
    for (let hop = 1; hop <= depth && frontier.length > 0; hop += 1) {
        const next: string[] = [];
        for (const cur of frontier) {
            for (const e of (dir === 'out' ? g.out : g.in).get(cur) ?? []) {
                if (relation !== undefined && e.relation !== relation) continue;
                const other = dir === 'out' ? e.target : e.source;
                if (lines.length >= NODE_EDGE_CAP) {
                    truncated = true;
                    break;
                }
                if (kind !== undefined && g.byId.get(other)?.kind !== kind) {
                    if (!seen.has(other)) {
                        seen.add(other);
                        next.push(other);
                    }
                    continue;
                }
                lines.push({
                    id: sanitizeLabel(other),
                    label: label(g, other),
                    relation: e.relation,
                    confidence: e.confidence,
                    hops: hop,
                });
                if (!seen.has(other)) {
                    seen.add(other);
                    next.push(other);
                }
            }
            if (truncated) break;
        }
        if (truncated) break;
        frontier = next;
    }
    return { lines, truncated };
}

/**
 * `node <seed>` — what one node IS, rather than what a walk from it reaches.
 *
 * The five readers before it all answer a question about a neighbourhood
 * (`query`, `explain`, `affected`, `path`) or about a set (`dead`, `untested`).
 * None answers "where does this live, who reaches it, what does it reach, how
 * connected is it" — which is the question an agent asks first and had to
 * assemble from two calls and a file read.
 *
 * Nothing new is walked: the edge maps are the ones `affected` already uses, so
 * this adds a view, not an index.
 */
export function node(g: LoadedGraph, seed: string, opts: NodeOptions = {}): NodeResult {
    const empty = {
        source: g.source,
        id: '',
        label: '',
        kind: '',
        location: null,
        in_degree: 0,
        out_degree: 0,
        in: [] as NodeEdgeLine[],
        out: [] as NodeEdgeLine[],
        truncated: false,
    };
    const { id, ambiguous, more } = resolveExactNode(g, seed);
    if (id === null) {
        return {
            ...empty,
            refusal:
                ambiguous.length > 0
                    ? `'${sanitizeLabel(seed)}' is a label on ${more ? 'more than ' : ''}` +
                      `${String(ambiguous.length)} nodes — re-ask with one id: ` +
                      `${ambiguous.map((a) => sanitizeLabel(a)).join(', ')}` +
                      (more ? ' (list truncated)' : '')
                    : `'${sanitizeLabel(seed)}' matches no node id and no node label. This tool ` +
                      'resolves exactly (id, then label) and does not score free text — use ' +
                      '`query` if a best-guess match is what you want.',
        };
    }
    const n = g.byId.get(id);
    const direction = opts.direction ?? 'both';
    const depth = Math.min(3, Math.max(1, Math.trunc(opts.depth ?? 1)));
    const inWalk =
        direction === 'out' ? { lines: [], truncated: false } : walkDirection(g, id, 'in', depth, opts.relation, opts.kind);
    const outWalk =
        direction === 'in' ? { lines: [], truncated: false } : walkDirection(g, id, 'out', depth, opts.relation, opts.kind);
    const degreeOf = (edges: readonly CodeEdge[] | undefined): number =>
        opts.relation === undefined ? (edges?.length ?? 0) : (edges ?? []).filter((e) => e.relation === opts.relation).length;
    return {
        source: g.source,
        id: sanitizeLabel(id),
        label: label(g, id),
        kind: n?.kind ?? '',
        location: recommendedReadFor(g, id),
        in_degree: degreeOf(g.in.get(id)),
        out_degree: degreeOf(g.out.get(id)),
        in: inWalk.lines,
        out: outWalk.lines,
        truncated: inWalk.truncated || outWalk.truncated,
    };
}

/** Options of the filtered, tree-shaped answer. */
export interface TreeOptions {
    /** Report only nodes of these kinds (the walk still passes through others). */
    kinds?: readonly string[];
    /** Follow only edges of these relations. */
    relations?: readonly string[];
    direction?: 'in' | 'out' | 'both';
    /** Hops, 1-3. */
    depth?: number;
    /** Items returned at most; the rest is counted. */
    limit?: number;
    /** A state the caller already knows for an id (a working-tree overlay's `added`); the rest stay `unconfirmed`. */
    stateOf?: (id: string) => ConfirmState | undefined;
}

export interface TreeItem {
    id: string;
    label: string;
    kind: string;
    /** The relation that reached it, read in its stated direction. */
    relation: string;
    direction: 'in' | 'out';
    depth: number;
    /** The node it was reached from. */
    via: string;
    /** `file:line` the fact was read at, when the graph knows one. */
    at: string | null;
    hash: string | null;
    /** Whether the witness still holds in the working tree; `unconfirmed` until `confirm` re-reads it. */
    confirm: ConfirmState;
}

export interface TreeResult {
    source: string;
    seeds: string[];
    /** What an empty or filtered answer is stated against. */
    population: string;
    returned: number;
    total: number;
    hasMore: boolean;
    /** Compact indented lines, one per item, with the relation label. */
    tree: string[];
    items: TreeItem[];
}

function witnessOf(n: CodeNode | undefined, e: CodeEdge): { at: string | null; hash: string | null } {
    const w = e.fact?.witness ?? n?.fact?.witness;
    if (w) return { at: `${w.file}:${w.line}`, hash: w.hash };
    const line = n?.source_location[0];
    if (n && n.source_file) return { at: line ? `${n.source_file}:${line}` : n.source_file, hash: null };
    return { at: null, hash: null };
}

/**
 * The neighbourhood of a seed as a filtered tree: walk up to `depth` hops along
 * the chosen relations and directions, report the nodes of the chosen kinds
 * with the witness each fact was read at. Every list says how many it returned
 * of how many it found, and an empty answer names the population it searched.
 */
export function tree(g: LoadedGraph, seed: string, opts: TreeOptions = {}): TreeResult {
    const resolution = resolveSeedsTiered(g, seed);
    const seeds = resolution.ids;
    const depth = Math.min(3, Math.max(1, Math.floor(opts.depth ?? 1)));
    const limit = Math.max(1, Math.floor(opts.limit ?? 50));
    const dir = opts.direction ?? 'both';
    const kinds = opts.kinds && opts.kinds.length ? new Set(opts.kinds) : null;
    const rels = opts.relations && opts.relations.length ? new Set(opts.relations) : null;
    const seen = new Set(seeds);
    const found: TreeItem[] = [];
    const walked: Array<{ id: string; via: string }> = [];
    let frontier = [...seeds];
    for (let d = 1; d <= depth && frontier.length; d++) {
        const next: string[] = [];
        for (const cur of frontier) {
            const steps: Array<[CodeEdge, 'in' | 'out']> = [];
            if (dir !== 'in') for (const e of g.out.get(cur) ?? []) steps.push([e, 'out']);
            if (dir !== 'out') for (const e of g.in.get(cur) ?? []) steps.push([e, 'in']);
            for (const [e, way] of steps) {
                if (rels && !rels.has(e.relation)) continue;
                const far = way === 'out' ? e.target : e.source;
                if (seen.has(far)) continue;
                seen.add(far);
                next.push(far);
                const n = g.byId.get(far);
                const kind = n?.kind ?? 'external';
                walked.push({ id: far, via: cur });
                if (kinds && !kinds.has(kind)) continue;
                found.push({ id: far, label: n?.label ?? far, kind, relation: e.relation, direction: way, depth: d, via: cur, ...witnessOf(n, e), confirm: opts.stateOf?.(far) ?? 'unconfirmed' });
            }
        }
        frontier = next;
    }
    // Depth-first order, so each item sits under the node it was reached from.
    const children = new Map<string, string[]>();
    for (const w of walked) children.set(w.via, [...(children.get(w.via) ?? []), w.id]);
    const byId = new Map(found.map((it) => [it.id, it] as const));
    const ordered: TreeItem[] = [];
    const visit = (id: string): void => {
        for (const c of children.get(id) ?? []) {
            const it = byId.get(c);
            if (it) ordered.push(it);
            visit(c);
        }
    };
    for (const s0 of seeds) visit(s0);
    const items = ordered.slice(0, limit);
    const kindNote = kinds ? [...kinds].sort().map((k) => `${g.kindCount(k)} ${k}`).join(', ') : null;
    const scope = `${depth} hop${depth > 1 ? 's' : ''} ${dir === 'both' ? 'in and out' : dir === 'in' ? 'in' : 'out'}${rels ? ` along ${[...rels].sort().join(', ')}` : ''}`;
    const population = seeds.length === 0
        ? `no node matches "${seed}"${kindNote ? `; the graph holds ${kindNote} node(s)` : ''}`
        : `${found.length} found within ${scope} of ${seeds.map((s) => label(g, s)).join(', ')}${kindNote ? `; the graph holds ${kindNote} node(s)` : ''}`;
    const lines = items.map((it) => `${'  '.repeat(it.depth - 1)}${it.direction === 'out' ? '-' : '<-'}${it.relation}${it.direction === 'out' ? '->' : '-'} ${it.label} [${it.kind}]${it.at ? ` at=${it.at}` : ''} (${it.confirm})`);
    return { source: g.source, seeds: seeds.map((s) => label(g, s)), population, returned: items.length, total: found.length, hasMore: found.length > items.length, tree: lines, items };
}
