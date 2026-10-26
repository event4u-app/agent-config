#!/usr/bin/env tsx
/**
 * Edge census for a built code graph (road-to-edges-that-earn-their-target 0.1).
 *
 *   tsx internal/bench/code-graph/edge_census.ts <graph.json>
 *
 * Prints one JSON object. A report, never a gate: its noise is unmeasured.
 *
 * `name_lookup_multi` counts repo-wide name-lookup `calls` edges onto a real
 * node whose label is shared by more than one top-level callable of the same
 * file extension — the edges that bound an arbitrary winner.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CodeGraph } from '../../../src/scripts/code_graph/types.js';

export interface EdgeCensus {
    name_lookup_calls: number;
    name_lookup_multi: number;
    top_multi_labels: Array<[string, number]>;
    symbol_targets: number;
    symbol_targets_ambiguous: number;
    name_collision_edges: number;
    suppressed_edge_counts: Record<string, number>;
}

const TOP_LEVEL_KINDS = new Set(['function', 'class', 'constant']);

export function edgeCensus(graph: Pick<CodeGraph, 'nodes' | 'edges'> & { suppressed_edge_counts?: object }): EdgeCensus {
    const nodes = new Map(graph.nodes.map((n) => [n.id, n] as const));
    const extOf = (id: string): string => path.extname(id.split('#')[0] ?? '');
    const shared = new Map<string, number>();
    for (const n of graph.nodes) {
        if (!n.id.includes('#') || n.id.includes('::') || !TOP_LEVEL_KINDS.has(n.kind)) continue;
        const key = `${extOf(n.id)}\0${n.label}`;
        shared.set(key, (shared.get(key) ?? 0) + 1);
    }
    let calls = 0;
    let multi = 0;
    const labels = new Map<string, number>();
    let symbolTargets = 0;
    let symbolAmbiguous = 0;
    let collisions = 0;
    for (const e of graph.edges) {
        if (e.target.startsWith('symbol:')) {
            symbolTargets++;
            if (e.confidence === 'AMBIGUOUS') symbolAmbiguous++;
        }
        if ((e.ambiguity_reason as string | undefined) === 'name-collision') collisions++;
        if (e.relation !== 'calls' || e.resolved_via !== 'name-lookup') continue;
        const t = nodes.get(e.target);
        if (!t) continue;
        calls++;
        if ((shared.get(`${extOf(t.id)}\0${t.label}`) ?? 0) > 1) {
            multi++;
            labels.set(t.label, (labels.get(t.label) ?? 0) + 1);
        }
    }
    return {
        name_lookup_calls: calls,
        name_lookup_multi: multi,
        top_multi_labels: [...labels].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8),
        symbol_targets: symbolTargets,
        symbol_targets_ambiguous: symbolAmbiguous,
        name_collision_edges: collisions,
        suppressed_edge_counts: { ...((graph.suppressed_edge_counts as Record<string, number> | undefined) ?? {}) },
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const file = process.argv[2];
    if (!file) {
        process.stderr.write('usage: edge_census.ts <graph.json>\n');
        process.exit(2);
    }
    process.stdout.write(`${JSON.stringify(edgeCensus(JSON.parse(fs.readFileSync(file, 'utf8')) as CodeGraph), null, 2)}\n`);
}
