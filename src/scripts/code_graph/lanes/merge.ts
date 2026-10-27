/**
 * The one way lane readers' records enter the graph.
 *
 * `mergeLaneOutputs` turns each `LaneFact` into a node and each `LaneRelation`
 * into an edge, after checking both against the vocabulary file: a kind or a
 * relation the vocabulary does not list, or a relation running the wrong way,
 * is refused and reported rather than merged. A lane's earlier facts are
 * replaced as a whole, so merging the same output twice yields the same graph.
 *
 * Ids: a fact becomes node `<kind>:<id>` (an id already carrying its kind
 * prefix keeps it once). A relation's `from` / `to` name either such a fact or
 * any node already in the graph (a file, a symbol, a table). A source that
 * resolves to neither is refused; a target may stay unresolved, as `symbol:` and
 * `external:` targets do — a reference to something nobody declared is itself
 * a fact a drift rule can see. A kind is checked against the whole
 * vocabulary, not only its owning lane: a runtime reader's `service` and an
 * interfaces reader's `service` are the same kind of thing.
 *
 * A lane's annotations add `<lane>:`-prefixed attributes to facts another
 * reader owns; a re-merge of the lane drops every key with its prefix first,
 * so an annotation the reader no longer derives disappears with it.
 *
 * `applyLaneOutputs` does the same on a graph file and re-derives its SQLite
 * twin, so a query sees the merged facts through either store.
 */
import { declaredUnresolved } from '../lint.js';
import { stampScope } from '../scope.js';
import * as fs from 'node:fs';

import { write_atomic } from '../../_lib/fs_atomic.js';
import { serializeGraph } from '../build.js';
import { emitSqliteTwin } from '../sqlite_store.js';
import type { CodeEdge, CodeGraph, CodeNode, FactMeta } from '../types.js';
import { directionError, KINDS, LANE_CAP, RELATIONS } from '../vocabulary.js';
import type { LaneOutput, LaneRelation } from './lane_fact.js';

export interface MergeRefusal {
    lane: string;
    item: string;
    reason: string;
}

export interface MergeResult {
    graph: CodeGraph;
    merged: { nodes: number; edges: number };
    refused: MergeRefusal[];
}

/** A reader may already prefix its ids with the kind; the node id carries the prefix once. */
const factId = (kind: string, id: string): string => (id.startsWith(`${kind}:`) ? id : `${kind}:${id}`);

/** Merge lane outputs into a copy of `graph`; the input graph is not changed. */
export function mergeLaneOutputs(graph: CodeGraph, outputs: readonly LaneOutput[]): MergeResult {
    const lanes = new Set(outputs.map((o) => o.lane));
    const refused: MergeRefusal[] = [];
    const prefixes = [...lanes].map((l) => `${l}:`);
    const unannotated = (n: CodeNode): CodeNode => {
        const attrs = n.fact?.attrs;
        if (!attrs || !Object.keys(attrs).some((k) => prefixes.some((p) => k.startsWith(p)))) return n;
        const kept = Object.fromEntries(Object.entries(attrs).filter(([k]) => !prefixes.some((p) => k.startsWith(p))));
        return { ...n, fact: { ...n.fact!, attrs: kept } };
    };
    const nodes = graph.nodes.filter((n) => !(n.fact?.lane && lanes.has(n.fact.lane as LaneOutput['lane']))).map(unannotated);
    const edges = graph.edges.filter((e) => !(e.fact?.lane && lanes.has(e.fact.lane as LaneOutput['lane'])));
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    let mergedNodes = 0;
    let mergedEdges = 0;

    for (const o of outputs) {
        const kinds = new Set(o.facts.map((f) => f.kind));
        if (kinds.size > LANE_CAP.kinds) refused.push({ lane: o.lane, item: '*', reason: `${kinds.size} kinds exceed the lane cap of ${LANE_CAP.kinds}` });
        for (const f of o.facts) {
            const item = factId(f.kind, f.id);
            if (!KINDS.has(f.kind)) {
                refused.push({ lane: o.lane, item, reason: `kind "${f.kind}" is not in the vocabulary` });
                continue;
            }
            const fact: FactMeta = { owner: f.owner, witness: { ...f.witness }, rung: f.rung, resolved_via: 'lane-read', lane: o.lane, attrs: { ...f.attrs } };
            const node: CodeNode = {
                id: item,
                label: f.name,
                kind: f.kind as CodeNode['kind'],
                source_file: f.witness.file,
                source_location: [f.witness.line, 1, f.witness.line, 1],
                fact,
            };
            if (byId.has(item)) {
                refused.push({ lane: o.lane, item, reason: 'id already in the graph' });
                continue;
            }
            byId.set(item, node);
            nodes.push(node);
            mergedNodes += 1;
        }
    }
    const position = new Map(nodes.map((n, i) => [n.id, i] as const));
    for (const o of outputs) {
        for (const a of o.annotations ?? []) {
            const at = position.get(a.id) ?? -1;
            const target = at >= 0 ? nodes[at] : undefined;
            const foreign = Object.keys(a.attrs).filter((k) => !k.startsWith(`${o.lane}:`));
            if (!target?.fact) {
                refused.push({ lane: o.lane, item: a.id, reason: target ? 'annotated node carries no fact' : 'annotated node not in the graph' });
                continue;
            }
            if (foreign.length) {
                refused.push({ lane: o.lane, item: a.id, reason: `annotation keys must carry the lane prefix "${o.lane}:": ${foreign.join(', ')}` });
                continue;
            }
            const next: CodeNode = { ...target, fact: { ...target.fact, attrs: { ...(target.fact.attrs ?? {}), ...a.attrs } } };
            nodes[at] = next;
            byId.set(next.id, next);
        }
    }
    for (const o of outputs) {
        for (const r of o.relations) {
            const item = `${r.from} ${r.relation} ${r.to}`;
            if (!RELATIONS.has(r.relation)) {
                refused.push({ lane: o.lane, item, reason: `relation "${r.relation}" is not in the vocabulary` });
                continue;
            }
            const from = byId.get(r.from);
            const to = byId.get(r.to);
            if (!from) {
                refused.push({ lane: o.lane, item, reason: `source not in the graph: ${r.from}` });
                continue;
            }
            const wrongWay = directionError(r.relation, from.kind, to?.kind);
            if (wrongWay) {
                refused.push({ lane: o.lane, item, reason: wrongWay });
                continue;
            }
            const edge: CodeEdge = {
                source: from.id,
                target: to?.id ?? r.to,
                relation: r.relation as CodeEdge['relation'],
                confidence: r.guess ? 'INFERRED' : 'EXTRACTED',
                resolved_via: r.guess ? 'name-lookup' : 'lane-read',
                provider: 'native',
                fact: { owner: r.owner, witness: { ...r.witness }, rung: r.rung, lane: o.lane, attrs: endpointState(r.attrs, to !== undefined, r.to) },
            };
            edges.push(edge);
            mergedEdges += 1;
        }
    }

    nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    edges.sort((a, b) => {
        const ka = `${a.source}\0${a.relation}\0${a.target}\0${a.confidence}`;
        const kb = `${b.source}\0${b.relation}\0${b.target}\0${b.confidence}`;
        return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const counts = { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 };
    for (const e of edges) counts[e.confidence] += 1;
    // A lane fact carries the scope of the file that owns it, like a core node.
    return { graph: stampScope({ ...graph, nodes, edges, edge_confidence_counts: counts }), merged: { nodes: mergedNodes, edges: mergedEdges }, refused };
}

/**
 * The endpoint contract: an edge hits a node, or it is typed `unresolved` with a
 * reason — the lane's own when it gave one, else that the target is no node of
 * this graph. Never a silent dangling edge, never a deletion of a fact a lane
 * read. A target that resolved drops a lane's pre-declared state.
 */
function endpointState(attrs: LaneRelation['attrs'], hit: boolean, target: string): LaneRelation['attrs'] {
    const { relation_state: _s, reason: _r, ...rest } = attrs;
    if (hit) return rest;
    return declaredUnresolved(attrs) ? { ...attrs } : { ...rest, relation_state: 'unresolved', reason: `target ${target} is not a node of this graph` };
}

/** Merge into the graph file at `jsonPath`, write it back atomically, and re-derive its SQLite twin. */
export function applyLaneOutputs(jsonPath: string, outputs: readonly LaneOutput[]): MergeResult {
    const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as CodeGraph;
    const result = mergeLaneOutputs(graph, outputs);
    write_atomic(jsonPath, serializeGraph(result.graph));
    emitSqliteTwin(result.graph, jsonPath);
    return result;
}
