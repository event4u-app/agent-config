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
    const parsed = JSON.parse(fs.readFileSync(graphPath, 'utf-8')) as unknown;
    const v = validateGraph(parsed);
    if (!v.ok) throw new Error(`invalid graph at ${graphPath}: ${v.errors.slice(0, 3).join('; ')}`);
    const graph = parsed as CodeGraph;
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

/** Resolve a free-text seed to node ids: exact id → exact label → BM25. */
export function resolveSeeds(g: LoadedGraph, seed: string, limit = 5): string[] {
    if (g.byId.has(seed)) return [seed];
    const exactLabel = g.graph.nodes.filter((n) => n.label === seed).map((n) => n.id);
    if (exactLabel.length) return exactLabel.slice(0, limit);
    const ranked = g.lex.rank(tokenize(seed)).filter((r) => r.score > 0);
    return ranked.slice(0, limit).map((r) => r.id);
}

function label(g: LoadedGraph, id: string): string {
    return sanitizeLabel(g.byId.get(id)?.label ?? id);
}
function edgeLine(g: LoadedGraph, e: CodeEdge): string {
    const cand = e.candidates?.length ? ` [${e.candidates.map((c) => sanitizeLabel(c)).join(', ')}]` : '';
    return `${e.confidence} ${sanitizeLabel(e.source)} --${e.relation}--> ${sanitizeLabel(e.target)}${cand}`;
}

export interface QueryResult {
    source: string;
    seeds: string[];
    lines: string[];
    truncated: boolean;
}

function budgetedLines(source: string, seeds: string[], lines: string[], budget: number): QueryResult {
    const cap = budget * APPROX_CHARS_PER_TOKEN;
    const kept: string[] = [];
    let used = 0;
    let truncated = false;
    for (const l of lines) {
        if (used + l.length > cap) {
            truncated = true;
            break;
        }
        kept.push(l);
        used += l.length + 1;
    }
    return { source, seeds, lines: kept, truncated };
}

/** `query <seed>` — the seed's direct (1-hop) outgoing relations. */
export function query(g: LoadedGraph, seed: string, budget = 1500): QueryResult {
    const seeds = resolveSeeds(g, seed);
    const lines: string[] = [];
    for (const s of seeds) for (const e of g.out.get(s) ?? []) lines.push(edgeLine(g, e));
    return budgetedLines(g.source, seeds.map((s) => label(g, s)), lines, budget);
}

/** `explain <seed>` — 2-hop neighbourhood (out-edges of seeds + their targets). */
export function explain(g: LoadedGraph, seed: string, budget = 1500): QueryResult {
    const seeds = resolveSeeds(g, seed);
    const seen = new Set<string>();
    const lines: string[] = [];
    const frontier = [...seeds];
    for (let hop = 0; hop < 2 && frontier.length; hop += 1) {
        const next: string[] = [];
        for (const s of frontier.splice(0)) {
            if (seen.has(s)) continue;
            seen.add(s);
            for (const e of g.out.get(s) ?? []) {
                lines.push(edgeLine(g, e));
                next.push(e.target);
            }
        }
        frontier.push(...next);
    }
    return budgetedLines(g.source, seeds.map((s) => label(g, s)), lines, budget);
}

/** `affected <target>` — reverse BFS: who calls / references the target. */
export function affected(g: LoadedGraph, target: string, depth = 2, budget = 1500): QueryResult {
    const seeds = resolveSeeds(g, target);
    const seen = new Set<string>(seeds);
    const lines: string[] = [];
    let frontier = [...seeds];
    for (let d = 0; d < depth && frontier.length; d += 1) {
        const next: string[] = [];
        for (const t of frontier) {
            for (const e of g.in.get(t) ?? []) {
                lines.push(edgeLine(g, e));
                if (!seen.has(e.source)) {
                    seen.add(e.source);
                    next.push(e.source);
                }
            }
        }
        frontier = next;
    }
    return budgetedLines(g.source, seeds.map((s) => label(g, s)), lines, budget);
}

/** `path <a> <b>` — shortest undirected path (direction preserved per edge). */
export function path(g: LoadedGraph, a: string, b: string, budget = 1500): QueryResult {
    const starts = resolveSeeds(g, a, 1);
    const goals = new Set(resolveSeeds(g, b, 1));
    if (!starts.length || !goals.size) return { source: g.source, seeds: [], lines: [], truncated: false };
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
    if (!hit) return { source: g.source, seeds: [label(g, start)], lines: ['(no path found)'], truncated: false };
    const chain: CodeEdge[] = [];
    let cur = hit;
    while (prev.has(cur)) {
        const e = prev.get(cur) as CodeEdge;
        chain.unshift(e);
        cur = e.source === cur ? e.target : e.source;
    }
    return budgetedLines(g.source, [label(g, start), label(g, hit)], chain.map((e) => edgeLine(g, e)), budget);
}
