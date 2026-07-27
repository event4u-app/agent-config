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

/** Bump on ANY table/column change — a mismatch sends readers to the JSON. */
export const GRAPH_STORE_VERSION = 1;

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
                    'CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, relation TEXT NOT NULL, confidence TEXT NOT NULL, candidates TEXT);' +
                    'CREATE INDEX edges_source ON edges(source);' +
                    'CREATE INDEX edges_target ON edges(target);',
            );
            const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
            meta.run('source_checksum', graph.source_checksum);
            meta.run('json_size', String(stat.size));
            meta.run('json_mtime_ms', String(stat.mtimeMs));
            meta.run('graph_json', serialized);
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
                'INSERT INTO edges (source, target, relation, confidence, candidates) VALUES (?, ?, ?, ?, ?)',
            );
            for (const e of graph.edges) {
                insEdge.run(e.source, e.target, e.relation, e.confidence, e.candidates ? JSON.stringify(e.candidates) : null);
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
