#!/usr/bin/env tsx
/**
 * Where the SQLite index starts to beat the JSON parse
 * (road-to-a-graph-that-wins 4.6, `INDEXED_READ_MIN_EDGES`).
 *
 *   npx tsx internal/bench/code-graph/index_crossover.ts [--sizes 10000,25000,...] [--reps 5] [--real <graph.json>]
 *
 * For each size a synthetic graph shaped like this repository's own (edges per
 * node, share of nodes carrying a fact, id length, relation mix) is written as
 * JSON with its SQLite twin. Two per-invocation costs are timed on both paths,
 * because each CLI or MCP call loads the graph afresh:
 *
 *   query        loadGraph + `affected` (depth 2) for 10 seeds + close
 *   review-risk  loadRiskSource + reviewRisk over a 5-file diff + close
 *
 * The path is forced with AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES (0 = index,
 * Infinity = JSON). Prints one JSON object; medians of `--reps` runs.
 * Wall-clock, so the figures belong to the machine they were taken on.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import { affected, loadGraph } from '../../../src/scripts/code_graph/query.js';
import { type Hunk, loadRiskSource, reviewRisk } from '../../../src/scripts/code_graph/review_risk.js';
import { emitSqliteTwin } from '../../../src/scripts/code_graph/sqlite_store.js';
import type { CodeEdge, CodeGraph, CodeNode } from '../../../src/scripts/code_graph/types.js';

const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
};
const sizes = (arg('--sizes') ?? '10000,25000,50000,100000,200000').split(',').map(Number);
const reps = Number(arg('--reps') ?? 5);
const real = arg('--real');

/** A deterministic PRNG so every size is the same shape at every run. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

/** ~3.7 edges per node and ~20 % of nodes with a ~180-byte fact, as measured on this repository's graph (274,338 edges, 73,307 nodes). */
function synthesise(edgeTarget: number): { graph: CodeGraph; files: string[] } {
    const rand = rng(edgeTarget);
    const nodeCount = Math.round(edgeTarget / 3.7);
    const fileCount = Math.max(5, Math.round(nodeCount / 10));
    const nodes: CodeNode[] = [];
    const files: string[] = [];
    for (let f = 0; f < fileCount; f++) {
        const file = `src/scripts/package_${f % 60}/module_number_${f}.ts`;
        files.push(file);
        nodes.push({ id: file, label: path.basename(file), kind: 'file', source_file: file, source_location: [] });
    }
    const fns: string[] = [];
    for (let i = 0; nodes.length < nodeCount; i++) {
        const file = files[i % fileCount] as string;
        const line = 1 + Math.floor(i / fileCount) * 12;
        const id = `${file}::exportedFunction${i}`;
        const n: CodeNode = { id, label: `exportedFunction${i}`, kind: 'function', source_file: file, source_location: [line, 0, line + 10, 1] };
        if (rand() < 0.2) {
            n.fact = { lane: 'code', owner: file, witness: { kind: 'span', file, line, hash: 'a1b2c3d4' }, rung: 'parse', resolved_via: 'same-file' } as unknown as CodeNode['fact'];
        }
        nodes.push(n);
        fns.push(id);
    }
    const edges: CodeEdge[] = [];
    const edge = (source: string, target: string, relation: CodeEdge['relation']): void => {
        edges.push({ source, target, relation, confidence: 'EXTRACTED', resolved_via: 'import-specifier', provider: 'native' });
    };
    for (const id of fns) edge(id.slice(0, id.indexOf('::')), id, 'member');
    while (edges.length < edgeTarget) {
        const r = rand();
        if (r < 0.02) edge(files[Math.floor(rand() * fileCount)] as string, files[Math.floor(rand() * fileCount)] as string, 'co-changes');
        else if (r < 0.25) edge(files[Math.floor(rand() * fileCount)] as string, files[Math.floor(rand() * fileCount)] as string, 'imports');
        else edge(fns[Math.floor(rand() * fns.length)] as string, fns[Math.floor(rand() * fns.length)] as string, 'calls');
    }
    const graph = {
        schema_version: 1,
        source_checksum: `synthetic-${edgeTarget}`,
        languages: ['typescript'],
        grammar_abi: 14,
        edge_confidence_counts: { EXTRACTED: edges.length, INFERRED: 0, AMBIGUOUS: 0 },
        suppressed_edge_counts: { dynamic_no_candidate: 0 },
        nodes,
        edges,
        lanes_run: [],
    } as unknown as CodeGraph;
    return { graph, files };
}

function median(xs: number[]): number {
    const s = [...xs].sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length / 2)] as number);
}

function timed(fn: () => void): number {
    const t = performance.now();
    fn();
    return performance.now() - t;
}

function withThreshold<T>(value: string, fn: () => T): T {
    const before = process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'];
    process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'] = value;
    try {
        return fn();
    } finally {
        if (before === undefined) delete process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'];
        else process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'] = before;
    }
}

function measure(jsonPath: string, seeds: string[], hunks: Hunk[], root: string): Record<string, number | string> {
    const run = (threshold: string): { query: number; risk: number; via: string } => {
        const q: number[] = [];
        const r: number[] = [];
        let via = '';
        for (let i = 0; i < reps; i++) {
            q.push(
                timed(() =>
                    withThreshold(threshold, () => {
                        const g = loadGraph(jsonPath);
                        try {
                            for (const s of seeds) affected(g, s, 2);
                        } finally {
                            g.close();
                        }
                    }),
                ),
            );
            r.push(
                timed(() =>
                    withThreshold(threshold, () => {
                        const loaded = loadRiskSource(jsonPath);
                        via = loaded.via;
                        try {
                            reviewRisk(root, loaded.source, 'HEAD', hunks);
                        } finally {
                            loaded.close();
                        }
                    }),
                ),
            );
        }
        return { query: median(q), risk: median(r), via };
    };
    const idx = run('0');
    const json = run('Infinity');
    return { query_index_ms: idx.query, query_json_ms: json.query, review_risk_index_ms: idx.risk, review_risk_json_ms: json.risk, review_risk_paths: `${idx.via}/${json.via}` };
}

const rows: Record<string, unknown>[] = [];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'index-crossover-'));
try {
    for (const size of sizes) {
        const { graph, files } = synthesise(size);
        const jsonPath = path.join(scratch, `graph-${size}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(graph));
        if (!emitSqliteTwin(graph, jsonPath)) throw new Error('twin not written');
        const seeds = graph.nodes.filter((n) => n.kind === 'function').slice(0, 10).map((n) => n.id);
        const hunks = files.slice(0, 5).map((file) => ({ file, from: 1, to: 40 }));
        rows.push({ edges: graph.edges.length, nodes: graph.nodes.length, json_bytes: fs.statSync(jsonPath).size, ...measure(jsonPath, seeds, hunks, scratch) });
    }
    if (real) {
        const g = JSON.parse(fs.readFileSync(real, 'utf-8')) as CodeGraph;
        const seeds = g.nodes.filter((n) => n.kind === 'function').slice(0, 10).map((n) => n.id);
        const files = [...new Set(g.nodes.filter((n) => n.kind === 'function').map((n) => n.source_file))].slice(0, 5);
        const hunks = files.map((file) => ({ file, from: 1, to: 40 }));
        rows.push({ real, edges: g.edges.length, nodes: g.nodes.length, json_bytes: fs.statSync(real).size, ...measure(real, seeds, hunks, path.dirname(real)) });
    }
} finally {
    fs.rmSync(scratch, { recursive: true, force: true });
}
process.stdout.write(`${JSON.stringify({ node: process.version, platform: `${process.platform}-${process.arch}`, cpus: os.cpus()[0]?.model, reps, rows }, null, 2)}\n`);
