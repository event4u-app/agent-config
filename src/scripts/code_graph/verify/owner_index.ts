/**
 * Reads of the SQLite index by fact owner — what the overlay and the shrink
 * guard select on. Kept out of `sqlite_store.ts` because that module ships in
 * the hook bundle, which has no room for reads no hook makes.
 *
 * Opened on the same conditions as `openGraphIndex` (current store version,
 * recorded against the JSON's size and mtime), so the two never disagree about
 * whether the index can be trusted.
 */
import { loadSqliteSync } from '../../_lib/sqlite_guard.js';
import { indexBackedGraph, type LoadedGraph } from '../query.js';
import { type EdgeRow, type NodeRow, openGraphIndex, sqliteTwinPath, toEdge, toNode } from '../sqlite_store.js';
import type { CodeEdge, CodeNode } from '../types.js';

/** The file whose rewrite replaces a node: its fact's owner, else the file it is declared in. */
export function nodeOwner(n: CodeNode): string {
    return n.fact?.owner ?? (n.source_file || n.id);
}

/** An edge's identity across two builds of one tree. */
export function edgeKey(e: { source: string; relation: string; target: string }): string {
    return `${e.source}\0${e.relation}\0${e.target}`;
}

/** The graph through its SQLite index only, whatever its size; null when the index cannot serve. Never parses the JSON. */
export function loadIndexedGraph(graphPath: string, source = graphPath): LoadedGraph | null {
    const index = openGraphIndex(graphPath);
    return index ? indexBackedGraph(index, source, graphPath) : null;
}

/** The `source_checksum` a loaded graph answers from: the one an overlay must have been computed against. */
export function graphChecksum(g: LoadedGraph): string {
    if (g.graph) return g.graph.source_checksum;
    const index = openGraphIndex(g.answeredBy);
    try {
        return index?.sourceChecksum ?? '';
    } finally {
        index?.close();
    }
}

export interface OwnerIndex {
    /** Nodes and edges whose owner is one of `files` — what a rewrite of those files replaces. */
    factsOwnedBy(files: readonly string[]): { nodes: CodeNode[]; edges: CodeEdge[] };
    /** Every fact's identity (node id, or {@link edgeKey}) with its owner — a whole-table read. */
    factOwners(): Map<string, string>;
    /** The lane readers whose facts this index holds. */
    factLanes(): string[];
    close(): void;
}

/** Owner reads over the index beside `jsonPath`, or null when the index cannot serve. */
export function openOwnerIndex(jsonPath: string): OwnerIndex | null {
    const check = openGraphIndex(jsonPath);
    if (!check) return null;
    check.close();
    const { DatabaseSync } = loadSqliteSync('code_graph.verify.owner_index');
    const db = new DatabaseSync(sqliteTwinPath(jsonPath), { readOnly: true });
    const CHUNK = 400;
    // The owner is derived in SQL, the same rule as `nodeOwner`, so the twin's schema stays as the hook bundle ships it.
    const NODE_OWNER = "COALESCE(json_extract(n.fact, '$.owner'), NULLIF(n.source_file, ''), n.id)";
    const EDGE_OWNER = `COALESCE(json_extract(e.fact, '$.owner'), ${NODE_OWNER.replace('n.id', 'e.source')})`;
    const EDGES = 'FROM edges e LEFT JOIN nodes n ON n.id = e.source';
    return {
        factsOwnedBy(files) {
            const nodes: CodeNode[] = [];
            const edges: CodeEdge[] = [];
            for (let i = 0; i < files.length; i += CHUNK) {
                const slice = files.slice(i, i + CHUNK);
                const marks = slice.map(() => '?').join(',');
                for (const r of db.prepare(`SELECT * FROM nodes n WHERE ${NODE_OWNER} IN (${marks})`).all(...slice) as unknown as NodeRow[]) nodes.push(toNode(r));
                for (const r of db.prepare(`SELECT e.* ${EDGES} WHERE ${EDGE_OWNER} IN (${marks})`).all(...slice) as unknown as EdgeRow[]) edges.push(toEdge(r));
            }
            return { nodes, edges };
        },
        factOwners() {
            const out = new Map<string, string>();
            for (const r of db.prepare(`SELECT n.id AS id, ${NODE_OWNER} AS owner FROM nodes n`).all() as { id: string; owner: string }[]) out.set(r.id, r.owner);
            for (const r of db.prepare(`SELECT e.source AS source, e.relation AS relation, e.target AS target, ${EDGE_OWNER} AS owner ${EDGES}`).all() as { source: string; relation: string; target: string; owner: string }[]) {
                out.set(edgeKey(r), r.owner);
            }
            return out;
        },
        factLanes() {
            return (db.prepare("SELECT DISTINCT json_extract(fact, '$.lane') AS lane FROM nodes WHERE fact IS NOT NULL").all() as { lane: string | null }[])
                .map((r) => r.lane)
                .filter((l): l is string => typeof l === 'string')
                .sort();
        },
        close() {
            db.close();
        },
    };
}
