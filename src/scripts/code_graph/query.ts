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
import { emitSqliteTwin, loadSerializedFromTwin } from './sqlite_store.js';
import type { CodeEdge, CodeGraph } from './types.js';
import { validateGraph } from './validate.js';

const APPROX_CHARS_PER_TOKEN = 4;

export interface LoadedGraph {
    graph: CodeGraph;
    source: string; // attribution path
    byId: Map<string, CodeGraph['nodes'][number]>;
    out: Map<string, CodeEdge[]>;
    in: Map<string, CodeEdge[]>;
    lex: LexicalIndex;
}

export function loadGraph(graphPath: string, source = graphPath): LoadedGraph {
    // Prefer the derived SQLite twin (ADR-129): checksum/stat-verified against
    // the canonical JSON, byte-identical content, ~1/90 the load cost at
    // consumer scale. Fallback = parse the JSON — and best-effort re-emit the
    // twin from it (zero-touch rebuild-on-drift, Phase 7).
    const fromTwin = loadSerializedFromTwin(graphPath);
    const raw = fromTwin ?? fs.readFileSync(graphPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const v = validateGraph(parsed);
    if (!v.ok) throw new Error(`invalid graph at ${graphPath}: ${v.errors.slice(0, 3).join('; ')}`);
    const graph = parsed as CodeGraph;
    if (fromTwin === null) {
        emitSqliteTwin(graph, raw, graphPath);
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
    return { graph, source, byId, out: outM, in: inM, lex };
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
    const exactLabel = g.graph.nodes.filter((n) => n.label === seed).map((n) => n.id);
    if (exactLabel.length) return { ids: exactLabel.slice(0, limit), weak: false };
    const ranked = g.lex.rank(tokenize(seed)).filter((r) => r.score > 0);
    return { ids: ranked.slice(0, limit).map((r) => r.id), weak: true };
}

/** Resolve a free-text seed to node ids: exact id → exact label → BM25. */
export function resolveSeeds(g: LoadedGraph, seed: string, limit = 5): string[] {
    return resolveSeedsTiered(g, seed, limit).ids;
}

function label(g: LoadedGraph, id: string): string {
    return sanitizeLabel(g.byId.get(id)?.label ?? id);
}
function edgeLine(g: LoadedGraph, e: CodeEdge): string {
    const cand = e.candidates?.length ? ` [${e.candidates.map((c) => sanitizeLabel(c)).join(', ')}]` : '';
    return `${e.confidence} ${sanitizeLabel(e.source)} --${e.relation}--> ${sanitizeLabel(e.target)}${cand}`;
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
export function query(g: LoadedGraph, seed: string, budget = 1500): QueryResult {
    const resolution = resolveSeedsTiered(g, seed);
    const seeds = resolution.ids;
    const entries: LineEntry[] = [];
    for (const s of seeds) for (const e of g.out.get(s) ?? []) entries.push({ text: edgeLine(g, e), focusId: e.target });
    return budgetedLines(g, g.source, seeds.map((s) => label(g, s)), entries, budget, weakSeedReads(g, resolution));
}

/** `explain <seed>` — 2-hop neighbourhood (out-edges of seeds + their targets). */
export function explain(g: LoadedGraph, seed: string, budget = 1500): QueryResult {
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
                entries.push({ text: edgeLine(g, e), focusId: e.target });
                next.push(e.target);
            }
        }
        frontier.push(...next);
    }
    return budgetedLines(g, g.source, seeds.map((s) => label(g, s)), entries, budget, weakSeedReads(g, resolution));
}

/** `affected <target>` — reverse BFS: who calls / references the target. */
export function affected(g: LoadedGraph, target: string, depth = 2, budget = 1500): QueryResult {
    const resolution = resolveSeedsTiered(g, target);
    const seeds = resolution.ids;
    const seen = new Set<string>(seeds);
    const entries: LineEntry[] = [];
    let frontier = [...seeds];
    for (let d = 0; d < depth && frontier.length; d += 1) {
        const next: string[] = [];
        for (const t of frontier) {
            for (const e of g.in.get(t) ?? []) {
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
export function path(g: LoadedGraph, a: string, b: string, budget = 1500): QueryResult {
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
            const adj = [...(g.out.get(cur) ?? []), ...(g.in.get(cur) ?? [])];
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
