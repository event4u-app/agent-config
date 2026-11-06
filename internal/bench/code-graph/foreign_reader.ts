/**
 * Reader for the v3 benchmark's foreign arm (PREREGISTRATION-v3-2026-11-05 § Arms 3):
 * a third-party code-graph export, mapped onto the engine's relation and confidence
 * names so the same verb map can be run over it.
 *
 * Relation names are mapped by `src/scripts/code_graph/foreign.ts` — the shipped
 * adapter, reused rather than forked, so the bench and the product cannot disagree
 * about what a foreign `invokes` means. That adapter discards the foreign confidence
 * (every edge becomes AMBIGUOUS) and tags every edge a guess, which is the right
 * product policy and the wrong measurement: the gate verbs would then refuse the
 * graph and the arm would score its refusal. This reader keeps the adapter's
 * relation mapping and adds the two things the arm needs:
 *
 * 1. **Confidence mapping.** A small literal synonym table onto
 *    EXTRACTED / INFERRED / AMBIGUOUS. A value it does not know is COUNTED in
 *    `unmapped_confidences` and the edge kept as AMBIGUOUS — the lowest label, never
 *    a guessed higher one.
 * 2. **Trust follows the tool's own label.** A foreign EXTRACTED edge is tagged
 *    `resolved_via: 'compiler-index'` (the engine's stated mechanism for an index
 *    another tool produced); every other foreign edge stays `foreign`, a guess. The
 *    engine's walks then accept exactly what the foreign tool itself claimed as
 *    extracted, the same rule the native arm is held to. `provider` stays `foreign`
 *    on every edge, so the origin is never laundered.
 *
 * Node ids that are not path-qualified are rewritten to the engine's
 * `<source_file>#<label>` shape (a file node becomes its path), so the runner's
 * endpoint-to-file rule reads both arms the same way.
 *
 * Lives under `internal/bench/` only; nothing in `src/` imports it.
 */
import { adaptForeignGraph } from '../../../src/scripts/code_graph/foreign.js';
import type { CodeEdge, CodeGraph, EdgeConfidence, Relation } from '../../../src/scripts/code_graph/types.js';

export interface ForeignReadResult {
    graph: CodeGraph;
    unmapped_relations: Record<string, number>;
    unmapped_confidences: Record<string, number>;
    malformed_edges: number;
    rewritten_ids: number;
}

const CONFIDENCE_MAP: Readonly<Record<string, EdgeConfidence>> = {
    extracted: 'EXTRACTED',
    explicit: 'EXTRACTED',
    exact: 'EXTRACTED',
    definite: 'EXTRACTED',
    inferred: 'INFERRED',
    heuristic: 'INFERRED',
    ambiguous: 'AMBIGUOUS',
    guess: 'AMBIGUOUS',
    unknown: 'AMBIGUOUS',
};

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** One relation name through the shipped adapter, memoised. `null` = unmapped. */
const relationCache = new Map<string, Relation | null>();
function mapRelation(raw: string): Relation | null {
    const hit = relationCache.get(raw);
    if (hit !== undefined) return hit;
    const probe = adaptForeignGraph({ nodes: [{ id: 'a' }], links: [{ source: 'a', target: 'b', relation: raw }] });
    const mapped = probe?.graph.edges[0]?.relation ?? null;
    relationCache.set(raw, mapped);
    return mapped;
}

export function readForeignGraph(doc: unknown): ForeignReadResult | null {
    const adapted = adaptForeignGraph(doc);
    if (adapted === null || !isObject(doc)) return null;

    // Node id rewrite onto `<file>#<label>`.
    const idMap = new Map<string, string>();
    const taken = new Set<string>();
    let rewritten = 0;
    for (const n of adapted.graph.nodes) {
        const file = n.source_file;
        let id = n.id;
        if (file !== '' && n.id !== file && !n.id.startsWith(`${file}#`)) {
            id = n.kind === 'file' ? file : `${file}#${n.label}`;
            rewritten += 1;
        }
        let unique = id;
        for (let k = 2; taken.has(unique); k += 1) unique = `${id}~${k}`;
        taken.add(unique);
        idMap.set(n.id, unique);
    }
    const nodes = adapted.graph.nodes.map((n) => ({ ...n, id: idMap.get(n.id) as string }));

    // Walk the raw edges with the adapter's own acceptance rule, so every kept edge
    // carries the confidence its raw record stated.
    const rawEdges = (doc['links'] ?? doc['edges']) as unknown[];
    const edges: CodeEdge[] = [];
    const unmappedConf: Record<string, number> = {};
    for (const e of rawEdges) {
        if (!isObject(e)) continue;
        const source = e['source'];
        const target = e['target'];
        if (typeof source !== 'string' || typeof target !== 'string' || !idMap.has(source)) continue;
        const relation = mapRelation(typeof e['relation'] === 'string' ? e['relation'] : '');
        if (relation === null) continue;
        const rawConf = e['confidence'];
        let confidence: EdgeConfidence = 'AMBIGUOUS';
        const known = typeof rawConf === 'string' ? CONFIDENCE_MAP[rawConf.toLowerCase()] : undefined;
        if (known !== undefined) confidence = known;
        else {
            const key = rawConf === undefined ? '(none)' : String(rawConf);
            unmappedConf[key] = (unmappedConf[key] ?? 0) + 1;
        }
        edges.push({
            source: idMap.get(source) as string,
            target: idMap.get(target) ?? target,
            relation,
            confidence,
            resolved_via: confidence === 'EXTRACTED' ? 'compiler-index' : 'foreign',
            provider: 'foreign',
        } as CodeEdge);
    }
    if (edges.length !== adapted.graph.edges.length) {
        throw new Error(`foreign reader disagrees with the shipped adapter: ${edges.length} edges kept vs ${adapted.graph.edges.length}`);
    }

    const counts: Record<string, number> = { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 };
    for (const e of edges) counts[e.confidence] = (counts[e.confidence] ?? 0) + 1;
    const graph = { ...adapted.graph, nodes, edges, edge_confidence_counts: counts } as unknown as CodeGraph;
    return {
        graph,
        unmapped_relations: adapted.unmapped_relations,
        unmapped_confidences: unmappedConf,
        malformed_edges: adapted.malformed_edges,
        rewritten_ids: rewritten,
    };
}
