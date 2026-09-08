/**
 * Derived SQLite twin of the code-graph JSON cache (ADR-129, Phase 6 of
 * road-to-reachable-code-memory).
 *
 * `build` additionally emits `<cache>.sqlite3` beside the canonical JSON;
 * the query path PREFERS the SQLite twin (cheap freshness check via the
 * JSON's stat + stored source_checksum) and falls back to parsing the JSON
 * when the twin is absent, stale, corrupt, version-mismatched, or the
 * runtime has no `node:sqlite` (engines floor is Node >=20.11; the module
 * needs >=22.5 — sqlite_guard's lazy import keeps old Nodes on the JSON
 * path).
 *
 * INVARIANTS (ADR-129):
 * - JSON stays canonical and byte-deterministic; the SQLite file is a
 *   derived, gitignored, disposable accelerator. Rollback = delete it.
 * - Answers are byte-identical on both stores — the loader reconstructs the
 *   exact `CodeGraph` object (`serializeGraph` equality is the test).
 * - Rollback triggers (recorded, not ship gates): query p95 <= 50 ms and
 *   heap <= 10 MB on the SQLite path — a miss reverts THAT store to the
 *   JSON fallback plus an incident note.
 * - Zero-touch upgrades (Phase 7): `PRAGMA user_version` stamps the schema;
 *   a mismatch / corrupt / absent twin is silently rebuilt from the
 *   committed truth (the JSON) on the next load — never a user action.
 */
import * as fs from 'node:fs';

import {
    isSqliteAvailableSync,
    loadSqliteSync,
    readUserVersion,
    stampUserVersion,
} from '../_lib/sqlite_guard.js';
import type { CodeEdge, CodeGraph, CodeNode } from './types.js';

/**
 * Bump on ANY table/column change — a mismatch sends readers to the JSON.
 *
 * 1 → 2 (2.1): `edges` gained `resolved_via` and `provider`; `nodes` gained
 * indexes on `label` and `source_file`; `meta` gained `node_count` /
 * `edge_count`. A v1 twin has none of them, and the indexed read path below
 * would silently answer from missing columns.
 *
 * 2 → 3 (2.2): those two columns are now REQUIRED on every edge. A v2 twin has
 * the columns but may have written them NULL, from a graph built before the
 * fields existed — which reads back as a valid edge carrying a fabricated
 * mechanism. Refusing it costs nothing, because the twin is derived and the
 * next build re-emits it.
 *
 * 3 → 4 (3.2): the `Relation` union gained `tests`, so a v3 twin carries no
 * `tests` rows for a graph whose JSON has them. No COLUMN changed, which is
 * precisely why the bump is needed rather than optional: a v3 twin would read
 * back cleanly, answer `tests-for` with the empty set, and the caller could not
 * tell "nothing tests this" from "this twin predates the relation". An index
 * that answers a question it cannot answer is worse than one that refuses.
 */
export const GRAPH_STORE_VERSION = 4;

/**
 * Edge count at or above which the indexed read path replaces the blob path.
 *
 * A DECLARED threshold, not a measured crossover — nothing establishes that
 * 50k is where the two paths actually cross. Below it, building the in-memory
 * Maps is cheap enough that the extra SQL round-trips per hop are not worth
 * paying; above it, `JSON.parse` plus two `Map`s over every edge is the
 * dominant cost and it is paid before the first question is answered.
 */
export const INDEXED_READ_MIN_EDGES = 50_000;

/** Derived twin path for a JSON cache path.
 * cache-invalidation: versioned via PRAGMA user_version (GRAPH_STORE_VERSION), not the filename. */
export function sqliteTwinPath(jsonPath: string): string {
    return jsonPath.endsWith('.json') ? `${jsonPath.slice(0, -5)}.sqlite3` : `${jsonPath}.sqlite3`;
}

/**
 * Emit the SQLite twin beside the JSON cache. Best-effort: returns false
 * (never throws) when `node:sqlite` is unavailable or the write fails — the
 * JSON path remains the source of truth either way.
 *
 * Storage model: nodes/edges land in real tables (queryable, and the FTS-free
 * structure the rollback triggers measure), while `meta.graph_json` carries
 * the byte-exact canonical serialization so the loader can guarantee
 * byte-identical answers without re-deriving key order.
 */
export function emitSqliteTwin(graph: CodeGraph, serialized: string, jsonPath: string): boolean {
    if (!isSqliteAvailableSync()) return false;
    const twin = sqliteTwinPath(jsonPath);
    const tmp = `${twin}.tmp-${process.pid}`;
    try {
        const { DatabaseSync } = loadSqliteSync('code_graph.sqlite_store');
        let stat: fs.Stats;
        try {
            stat = fs.statSync(jsonPath);
        } catch {
            return false; // no canonical JSON — nothing to twin
        }
        fs.rmSync(tmp, { force: true });
        const db = new DatabaseSync(tmp);
        try {
            db.exec('PRAGMA journal_mode = MEMORY');
            db.exec(
                'CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);' +
                    'CREATE TABLE nodes (id TEXT PRIMARY KEY, label TEXT NOT NULL, kind TEXT, source_file TEXT, l0 INTEGER, l1 INTEGER, l2 INTEGER, l3 INTEGER);' +
                    'CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, relation TEXT NOT NULL, confidence TEXT NOT NULL, candidates TEXT, ambiguity_reason TEXT, resolved_via TEXT, provider TEXT);' +
                    'CREATE INDEX edges_source ON edges(source);' +
                    'CREATE INDEX edges_target ON edges(target);' +
                    // Seed resolution and the changed-file seed set are the two
                    // reads that would otherwise scan every node. `id` needs no
                    // index — it is the PRIMARY KEY.
                    'CREATE INDEX nodes_label ON nodes(label);' +
                    'CREATE INDEX nodes_source_file ON nodes(source_file);',
            );
            const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
            meta.run('source_checksum', graph.source_checksum);
            meta.run('json_size', String(stat.size));
            meta.run('json_mtime_ms', String(stat.mtimeMs));
            meta.run('graph_json', serialized);
            // Counts live in meta so a reader can pick its path from one row
            // instead of a COUNT(*) over the table it is deciding whether to
            // read at all.
            meta.run('node_count', String(graph.nodes.length));
            meta.run('edge_count', String(graph.edges.length));
            const insNode = db.prepare(
                'INSERT INTO nodes (id, label, kind, source_file, l0, l1, l2, l3) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            );
            for (const n of graph.nodes) {
                const loc = n.source_location ?? [];
                insNode.run(
                    n.id,
                    n.label,
                    (n as { kind?: string }).kind ?? null,
                    n.source_file ?? null,
                    (loc[0] as number | undefined) ?? null,
                    (loc[1] as number | undefined) ?? null,
                    (loc[2] as number | undefined) ?? null,
                    (loc[3] as number | undefined) ?? null,
                );
            }
            const insEdge = db.prepare(
                'INSERT INTO edges (source, target, relation, confidence, candidates, ambiguity_reason, resolved_via, provider) ' +
                    'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            );
            for (const e of graph.edges) {
                insEdge.run(
                    e.source,
                    e.target,
                    e.relation,
                    e.confidence,
                    e.candidates ? JSON.stringify(e.candidates) : null,
                    e.ambiguity_reason ?? null,
                    e.resolved_via,
                    e.provider,
                );
            }
            stampUserVersion(db, GRAPH_STORE_VERSION);
        } finally {
            db.close();
        }
        fs.renameSync(tmp, twin);
        return true;
    } catch {
        fs.rmSync(tmp, { force: true });
        return false;
    }
}

/**
 * Load the canonical serialization from a FRESH SQLite twin, or null when the
 * twin is absent / stale (JSON changed since emission) / corrupt /
 * version-mismatched / unsupported runtime. Callers fall back to reading the
 * JSON — and best-effort re-emit the twin from it (zero-touch rebuild).
 */
export function loadSerializedFromTwin(jsonPath: string): string | null {
    if (!isSqliteAvailableSync()) return null;
    const twin = sqliteTwinPath(jsonPath);
    if (!fs.existsSync(twin)) return null;
    let stat: fs.Stats;
    try {
        stat = fs.statSync(jsonPath);
    } catch {
        return null; // canonical JSON gone — the twin has no truth to mirror
    }
    try {
        const { DatabaseSync } = loadSqliteSync('code_graph.sqlite_store');
        const db = new DatabaseSync(twin, { readOnly: true });
        try {
            if (readUserVersion(db) !== GRAPH_STORE_VERSION) return null;
            const rows = db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[];
            const meta = new Map(rows.map((r) => [r.key, r.value]));
            if (meta.get('json_size') !== String(stat.size)) return null;
            if (meta.get('json_mtime_ms') !== String(stat.mtimeMs)) return null;
            const serialized = meta.get('graph_json');
            return serialized && serialized.length > 0 ? serialized : null;
        } finally {
            db.close();
        }
    } catch {
        // Corrupt twin is a non-event: drop it so the next build re-emits.
        fs.rmSync(twin, { force: true });
        return null;
    }
}

/**
 * A per-node / per-edge read API over the twin — the thing this module did not
 * export before (road-to-a-graph-that-is-shipped D7).
 *
 * Every export it had took a PATH and returned the whole graph: the serialized
 * blob, or a pair of counts. So "the query path prefers SQLite" was true and
 * bought nothing — `loadSerializedFromTwin` hands back the entire
 * serialization, and the caller then parses it and builds a `Map` over every
 * node and every edge. The twin was a cheaper blob transport, never an index.
 *
 * These reads take an id, a label, or a file, and touch only the rows that
 * answer. Statements are prepared once per handle because a BFS calls
 * `edgesTo` once per frontier node, and re-preparing per hop would hand back
 * the constant factor the index just removed.
 *
 * The handle owns an open database and MUST be closed. Every method is safe
 * after `close()` only in the sense that it will throw — callers hold it for
 * the duration of one query and release it.
 */
export interface GraphIndex {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly sourceChecksum: string;
    getNode(id: string): CodeNode | undefined;
    hasNode(id: string): boolean;
    /** Out-edges: everything `id` points at. */
    edgesFrom(id: string): CodeEdge[];
    /** In-edges: everything pointing at `id` — the reverse-BFS direction. */
    edgesTo(id: string): CodeEdge[];
    /** Exact-label resolution, served by `nodes_label`. */
    idsByLabel(label: string, limit: number): string[];
    /** Non-file nodes declared in any of `files` — the changed-seed lookup. */
    idsInFiles(files: readonly string[]): string[];
    /** Every node id, sorted. A whole-table read, for `dead` only — see
     * `LoadedGraph.allNodeIds`. */
    allNodeIds(): string[];
    /** Every node's id + searchable text. The ONLY whole-table read, and it
     * exists because a BM25 fallback genuinely needs the corpus. Callers reach
     * it only after an exact id AND an exact label both missed. */
    lexicalCorpus(): { id: string; text: string }[];
    close(): void;
}

interface NodeRow {
    id: string;
    label: string;
    kind: string | null;
    source_file: string | null;
    l0: number | null;
    l1: number | null;
    l2: number | null;
    l3: number | null;
}

interface EdgeRow {
    source: string;
    target: string;
    relation: string;
    confidence: string;
    candidates: string | null;
    ambiguity_reason: string | null;
    resolved_via: string | null;
    provider: string | null;
}

function toNode(r: NodeRow): CodeNode {
    const loc = [r.l0, r.l1, r.l2, r.l3].filter((v): v is number => typeof v === 'number');
    return {
        id: r.id,
        label: r.label,
        kind: (r.kind ?? 'file') as CodeNode['kind'],
        source_file: r.source_file ?? '',
        source_location: loc,
    };
}

function toEdge(r: EdgeRow): CodeEdge {
    const e: CodeEdge = {
        source: r.source,
        target: r.target,
        relation: r.relation as CodeEdge['relation'],
        confidence: r.confidence as CodeEdge['confidence'],
        // The SQL columns are nullable, the TypeScript fields are not. A null
        // can only come from a twin emitted before these fields existed, which
        // GRAPH_STORE_VERSION already refuses — so this coalesce is unreachable
        // in a healthy tree and is written to fail READABLE rather than to
        // fabricate: `name-lookup` is the weakest mechanism, so a mislabelled
        // edge is under-trusted rather than over-trusted by Phase 3's filter.
        resolved_via: (r.resolved_via ?? 'name-lookup') as CodeEdge['resolved_via'],
        provider: (r.provider ?? 'native') as CodeEdge['provider'],
    };
    if (r.candidates) e.candidates = JSON.parse(r.candidates) as string[];
    if (r.ambiguity_reason === 'receiver-unknown' || r.ambiguity_reason === 'hierarchy-unresolved') {
        e.ambiguity_reason = r.ambiguity_reason;
    }
    return e;
}

/**
 * Open the twin for INDEXED reads, or null when it cannot serve them.
 *
 * Null on exactly the conditions `loadSerializedFromTwin` already refuses on —
 * absent, stale against the JSON's size/mtime, corrupt, version-mismatched, no
 * `node:sqlite` — so the two paths agree about when the twin is trustworthy
 * and a caller never has to ask twice.
 */
export function openGraphIndex(jsonPath: string): GraphIndex | null {
    if (!isSqliteAvailableSync()) return null;
    const twin = sqliteTwinPath(jsonPath);
    if (!fs.existsSync(twin)) return null;
    let stat: fs.Stats;
    try {
        stat = fs.statSync(jsonPath);
    } catch {
        return null;
    }
    try {
        const { DatabaseSync } = loadSqliteSync('code_graph.sqlite_store');
        const db = new DatabaseSync(twin, { readOnly: true });
        try {
            if (readUserVersion(db) !== GRAPH_STORE_VERSION) {
                db.close();
                return null;
            }
            const rows = db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[];
            const meta = new Map(rows.map((r) => [r.key, r.value]));
            if (meta.get('json_size') !== String(stat.size) || meta.get('json_mtime_ms') !== String(stat.mtimeMs)) {
                db.close();
                return null;
            }
            const nodeCount = Number(meta.get('node_count') ?? NaN);
            const edgeCount = Number(meta.get('edge_count') ?? NaN);
            if (!Number.isFinite(nodeCount) || !Number.isFinite(edgeCount)) {
                // A v2 twin always carries both. Missing means something wrote
                // this file that is not this module, and guessing the counts
                // would be worse than declining.
                db.close();
                return null;
            }

            const qNode = db.prepare('SELECT * FROM nodes WHERE id = ?');
            const qFrom = db.prepare('SELECT * FROM edges WHERE source = ?');
            const qTo = db.prepare('SELECT * FROM edges WHERE target = ?');
            const qLabel = db.prepare('SELECT id FROM nodes WHERE label = ? LIMIT ?');

            return {
                nodeCount,
                edgeCount,
                sourceChecksum: meta.get('source_checksum') ?? '',
                getNode(id) {
                    const r = qNode.get(id) as unknown as NodeRow | undefined;
                    return r ? toNode(r) : undefined;
                },
                hasNode(id) {
                    return (qNode.get(id) as unknown as NodeRow | undefined) !== undefined;
                },
                edgesFrom(id) {
                    return (qFrom.all(id) as unknown as EdgeRow[]).map(toEdge);
                },
                edgesTo(id) {
                    return (qTo.all(id) as unknown as EdgeRow[]).map(toEdge);
                },
                idsByLabel(labelText, limit) {
                    return (qLabel.all(labelText, limit) as { id: string }[]).map((r) => r.id);
                },
                idsInFiles(files) {
                    if (files.length === 0) return [];
                    // Chunked because SQLite caps bound parameters (999 on the
                    // conservative default build) and a changed-file set from a
                    // wide diff can exceed it.
                    const out: string[] = [];
                    const CHUNK = 400;
                    for (let i = 0; i < files.length; i += CHUNK) {
                        const slice = files.slice(i, i + CHUNK);
                        const marks = slice.map(() => '?').join(',');
                        const stmt = db.prepare(
                            `SELECT id FROM nodes WHERE kind != 'file' AND source_file IN (${marks})`,
                        );
                        for (const r of stmt.all(...slice) as { id: string }[]) out.push(r.id);
                    }
                    return out;
                },
                allNodeIds() {
                    return (db.prepare('SELECT id FROM nodes ORDER BY id').all() as { id: string }[]).map(
                        (r) => r.id,
                    );
                },
                lexicalCorpus() {
                    return (db.prepare('SELECT id, label FROM nodes').all() as { id: string; label: string }[]).map(
                        (r) => ({ id: r.id, text: `${r.label} ${r.id}` }),
                    );
                },
                close() {
                    db.close();
                },
            };
        } catch (err) {
            db.close();
            throw err;
        }
    } catch {
        return null;
    }
}

/** Structured node/edge access for future in-process consumers (kept minimal:
 * the loader above guarantees byte-identical answers; these are for tooling). */
export function twinCounts(jsonPath: string): { nodes: number; edges: number } | null {
    if (!isSqliteAvailableSync()) return null;
    const twin = sqliteTwinPath(jsonPath);
    if (!fs.existsSync(twin)) return null;
    try {
        const { DatabaseSync } = loadSqliteSync('code_graph.sqlite_store');
        const db = new DatabaseSync(twin, { readOnly: true });
        try {
            const n = db.prepare('SELECT COUNT(*) AS c FROM nodes').get() as { c: number };
            const e = db.prepare('SELECT COUNT(*) AS c FROM edges').get() as { c: number };
            return { nodes: n.c, edges: e.c };
        } finally {
            db.close();
        }
    } catch {
        return null;
    }
}

export type { CodeEdge, CodeGraph, CodeNode };
