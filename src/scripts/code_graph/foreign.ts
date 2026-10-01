/**
 * Read a consumer's own code-graph file, in the shape another tool wrote it.
 *
 * The defect this closes: `detect.ts` already ACCEPTS a `links`-shaped
 * graph.json — `looksLikeGraph` passes anything with `nodes[]` and
 * `edges`-or-`links[]` carrying `source`/`target` — and then `query.ts`
 * `loadGraph` throws on it, because `validateGraph` demands `edges`,
 * `schema_version`, `source_checksum` and a per-edge `resolved_via` and
 * `provider`. So a consumer who ships a graph got told it was detected and
 * then watched every verb crash on it. Detected-but-unloadable is the worst
 * of both answers.
 *
 * What this module does NOT do is make those edges trustworthy. A foreign
 * relation vocabulary is another tool's, and mapping it is an interpretation:
 * their `calls` may be our `calls` or may be their build graph's dependency
 * arrow. So every adapted edge is tagged `resolved_via: 'foreign'`, which
 * joins the GUESS set — the same set `name-lookup` and `dynamic` are in — and
 * the gate verbs refuse a graph made only of guesses rather than answering
 * from one.
 *
 * A relation this module cannot map is COUNTED and DROPPED, never guessed
 * into the nearest native relation. A wrong edge that reads as a real one is
 * worse than a missing edge that reads as a number.
 */

import { createHash } from 'node:crypto';

import type { CodeGraph, CodeEdge, CodeNode, EdgeConfidence, Relation } from './types.js';
import { SCHEMA_VERSION } from './types.js';

/** What a foreign load produced, including what it could not use. */
export interface ForeignLoadResult {
    graph: CodeGraph;
    /** Edges dropped because their relation has no native counterpart. */
    unmapped_relations: Record<string, number>;
    /** Edges dropped because an endpoint was missing or not a string. */
    malformed_edges: number;
}

/**
 * Foreign relation vocabulary → ours.
 *
 * Deliberately small and literal. Every entry is a word whose meaning is the
 * same in both vocabularies; a word that is merely SIMILAR is left out, so it
 * lands in `unmapped_relations` and is reported rather than mapped on a hunch.
 * This is a list of OUR relation names and their obvious synonyms, not a table
 * of any particular tool's schema.
 */
const RELATION_MAP: Readonly<Record<string, Relation>> = {
    calls: 'calls',
    call: 'calls',
    invokes: 'calls',
    imports: 'imports',
    import: 'imports',
    requires: 'imports',
    uses: 'uses',
    use: 'uses',
    references: 'uses',
    inherits: 'inherits',
    extends: 'inherits',
    implements: 'inherits',
    member: 'member',
    contains: 'member',
    tests: 'tests',
    test: 'tests',
};

const KINDS = new Set([
    'file',
    'class',
    'interface',
    'trait',
    'function',
    'method',
    'constant',
    'type',
    'enum',
    'skipped',
]);

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Does this document look like a foreign graph rather than one of ours?
 *
 * `links` in place of `edges` is the clearest tell and is the shape
 * `detect.ts` already accepts. A document carrying `edges` but no
 * `schema_version` is foreign too — ours always writes one.
 */
export function looksForeign(doc: unknown): boolean {
    if (!isObject(doc)) return false;
    if (!Array.isArray(doc['nodes'])) return false;
    if (Array.isArray(doc['links'])) return true;
    return Array.isArray(doc['edges']) && typeof doc['schema_version'] !== 'number';
}

/**
 * Adapt a foreign graph document into the native shape.
 *
 * `schema_version` and `source_checksum` are SYNTHESISED: the first is ours
 * by definition once the document is in our shape, and the second is a digest
 * of the document itself, so a changed foreign file produces a changed
 * checksum and the cache layer behaves as it does for a native graph. Neither
 * is read off the foreign file — a number another tool wrote under the same
 * key would mean something else.
 */
export function adaptForeignGraph(doc: unknown): ForeignLoadResult | null {
    if (!isObject(doc)) return null;
    const rawNodes = doc['nodes'];
    const rawEdges = doc['links'] ?? doc['edges'];
    if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) return null;

    const nodes: CodeNode[] = [];
    const ids = new Set<string>();
    for (const n of rawNodes) {
        if (!isObject(n)) continue;
        const id = n['id'];
        if (typeof id !== 'string' || id === '') continue;
        const kind = typeof n['kind'] === 'string' && KINDS.has(n['kind']) ? n['kind'] : 'skipped';
        const sourceFile =
            typeof n['source_file'] === 'string'
                ? n['source_file']
                : typeof n['file'] === 'string'
                  ? n['file']
                  : '';
        nodes.push({
            id,
            label: typeof n['label'] === 'string' ? n['label'] : id,
            kind,
            source_file: sourceFile,
            // A foreign node rarely carries a span. An empty one is honest —
            // it says "no location recorded", where a fabricated [1,1] would
            // point a reader at the top of a file for no reason.
            source_location: Array.isArray(n['source_location']) ? n['source_location'] : [],
        } as CodeNode);
        ids.add(id);
    }

    const edges: CodeEdge[] = [];
    const unmapped: Record<string, number> = {};
    let malformed = 0;
    for (const e of rawEdges) {
        if (!isObject(e)) {
            malformed += 1;
            continue;
        }
        const source = e['source'];
        const target = e['target'];
        if (typeof source !== 'string' || typeof target !== 'string' || !ids.has(source)) {
            malformed += 1;
            continue;
        }
        const rawRelation = typeof e['relation'] === 'string' ? e['relation'] : '';
        const relation = RELATION_MAP[rawRelation.toLowerCase()];
        if (relation === undefined) {
            const key = rawRelation === '' ? '(none)' : rawRelation;
            unmapped[key] = (unmapped[key] ?? 0) + 1;
            continue;
        }
        edges.push({
            source,
            target,
            relation,
            // Not EXTRACTED: this package did not extract it and cannot say
            // how the tool that did arrived at it.
            confidence: 'AMBIGUOUS' as EdgeConfidence,
            resolved_via: 'foreign',
            provider: 'foreign',
        } as CodeEdge);
    }

    const counts: Record<string, number> = { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: edges.length };
    const graph = {
        schema_version: SCHEMA_VERSION,
        source_checksum: createHash('sha256')
            .update(JSON.stringify(doc), 'utf-8')
            .digest('hex'),
        languages: [],
        grammar_abi: 0,
        edge_confidence_counts: counts,
        suppressed_edge_counts: { dynamic_no_candidate: 0 },
        nodes,
        edges,
    } as unknown as CodeGraph;

    return { graph, unmapped_relations: unmapped, malformed_edges: malformed };
}

/** True when every edge in `g` came from a foreign file. */
export function isAllForeign(g: CodeGraph): boolean {
    return g.edges.length > 0 && g.edges.every((e) => e.resolved_via === 'foreign');
}
