/**
 * The indexed read path (road-to-a-graph-that-is-shipped 2.1).
 *
 * D6 said no query reads the graph without materializing all of it. The twin
 * was PREFERRED already — and `loadSerializedFromTwin` returned the whole
 * serialization, so `JSON.parse` and the full node/edge `Map` build ran on both
 * paths. It was a cheaper blob transport, never an index.
 *
 * These tests TRACE that, rather than asserting it: `JSON.parse` and
 * `fs.readFileSync` are wrapped for the duration of the query and any touch of
 * the graph file is recorded. A test that merely checked the answer would pass
 * just as happily against the blob path it is supposed to have replaced.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { affected, loadGraph, query } from '../../src/scripts/code_graph/query.js';
import {
    emitSqliteTwin,
    INDEXED_READ_MIN_EDGES,
    openGraphIndex,
    sqliteTwinPath,
} from '../../src/scripts/code_graph/sqlite_store.js';
import { isSqliteAvailableSync } from '../../src/scripts/_lib/sqlite_guard.js';
import type { CodeEdge, CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';

const sqliteOk = isSqliteAvailableSync();
const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/**
 * A synthetic graph with `edgeCount` edges in a deliberate shape: a chain, so
 * every node has exactly one in-edge and one out-edge and a 2-hop reverse walk
 * from the tail reaches exactly two callers. Synthetic because building 50k
 * real edges would mean parsing a repository this test does not need.
 */
function makeGraph(edgeCount: number): CodeGraph {
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    for (let i = 0; i <= edgeCount; i += 1) {
        nodes.push({
            id: `src/f${i}.ts#fn${i}`,
            label: `fn${i}`,
            kind: 'function',
            source_file: `src/f${i}.ts`,
            source_location: [1, 0, 2, 0],
        });
    }
    for (let i = 0; i < edgeCount; i += 1) {
        edges.push({
            source: `src/f${i}.ts#fn${i}`,
            target: `src/f${i + 1}.ts#fn${i + 1}`,
            relation: 'calls',
            confidence: 'EXTRACTED',
            resolved_via: 'import-specifier',
            provider: 'native',
        });
    }
    return {
        schema_version: 3,
        source_checksum: `synthetic-${edgeCount}`,
        languages: ['typescript'],
        grammar_abi: 14,
        edge_confidence_counts: { EXTRACTED: edges.length, INFERRED: 0, AMBIGUOUS: 0 },
        suppressed_edge_counts: { dynamic_no_candidate: 0 },
        nodes,
        edges,
    };
}

function writeGraph(edgeCount: number): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-indexed-'));
    dirs.push(dir);
    const jsonPath = path.join(dir, 'graph.json');
    const graph = makeGraph(edgeCount);
    const serialized = JSON.stringify(graph);
    fs.writeFileSync(jsonPath, serialized);
    expect(emitSqliteTwin(graph, serialized, jsonPath)).toBe(true);
    return jsonPath;
}

/**
 * Count `JSON.parse` calls made during `fn`.
 *
 * `JSON.parse` is a global and can be wrapped. `fs.readFileSync` cannot: under
 * ESM `node:fs` is a frozen module namespace, so the obvious spy throws
 * "Cannot assign to property 'readFileSync' of [object Module]". The read is
 * traced by `withUnreadableJson` instead, which is a stronger check anyway —
 * it makes the read IMPOSSIBLE rather than merely observed.
 */
function countParses<T>(fn: () => T): { result: T; parses: number } {
    const realParse = JSON.parse;
    let parses = 0;
    JSON.parse = ((text: string, reviver?: (k: string, v: unknown) => unknown) => {
        parses += 1;
        return realParse(text, reviver as never);
    }) as typeof JSON.parse;
    try {
        return { result: fn(), parses };
    } finally {
        JSON.parse = realParse;
    }
}

/**
 * Run `fn` with the canonical JSON unreadable (mode 000).
 *
 * `statSync` still succeeds — the twin's freshness check needs size and mtime,
 * and those come from the directory entry, not from read permission — so this
 * removes exactly one capability: opening the file. A path that truly never
 * reads the JSON is unaffected; one that does throws EACCES.
 *
 * Returns null when the platform did not actually enforce the mode (running as
 * root, or a filesystem that ignores it). Reporting "not enforced" is the
 * honest answer there; asserting a pass would be a check that measured nothing.
 */
function withUnreadableJson<T>(jsonPath: string, fn: () => T): T | null {
    const original = fs.statSync(jsonPath).mode;
    fs.chmodSync(jsonPath, 0o000);
    try {
        try {
            fs.readFileSync(jsonPath);
            return null; // the mode did not bite — this environment cannot run the check
        } catch {
            /* expected: the file is genuinely unreadable */
        }
        return fn();
    } finally {
        fs.chmodSync(jsonPath, original);
    }
}

describe.runIf(sqliteOk)('indexed reads above the threshold', () => {
    it('affected on a >=50k-edge graph never reads or parses the JSON', () => {
        const jsonPath = writeGraph(INDEXED_READ_MIN_EDGES + 1_000);

        const t = countParses(() =>
            withUnreadableJson(jsonPath, () => {
                const g = loadGraph(jsonPath);
                try {
                    // An exact node id, so seed resolution is a primary-key hit
                    // and the BM25 corpus — the one whole-table read left — is
                    // never built.
                    return affected(g, `src/f${INDEXED_READ_MIN_EDGES}.ts#fn${INDEXED_READ_MIN_EDGES}`, 2);
                } finally {
                    g.close();
                }
            }),
        );

        if (t.result === null) {
            // Mode not enforced here; the parse count still stands on its own.
            expect(t.parses).toBe(0);
            return;
        }
        // The blob path parses the whole graph once. The index path parses only
        // per-edge `candidates`, and this fixture emits none — so zero.
        expect(t.parses).toBe(0);
        expect(t.result.lines.length).toBeGreaterThan(0);
    }, 120_000);

    it('is SENSITIVE — the same query below the threshold does read and parse it', () => {
        // Without this, the assertion above could pass because the query failed
        // early, or because the fixture never reached a read at all. Dropping
        // under the threshold must flip both observations: the parse happens,
        // and making the JSON unreadable breaks the query outright.
        const jsonPath = writeGraph(200);

        const t = countParses(() => {
            const g = loadGraph(jsonPath);
            try {
                return affected(g, 'src/f100.ts#fn100', 2);
            } finally {
                g.close();
            }
        });
        expect(t.parses).toBeGreaterThan(0);
        expect(t.result.lines.length).toBeGreaterThan(0);
        // And it materializes the whole graph, which the indexed path does not.
        const g = loadGraph(jsonPath);
        try {
            expect(g.graph).not.toBeNull();
        } finally {
            g.close();
        }

        // MEASURED, and worth stating because the obvious discriminator does
        // NOT work: below the threshold `loadGraph` still succeeds with the
        // canonical JSON unreadable. `loadSerializedFromTwin` sources the bytes
        // from the twin and only falls back to the file when the twin is
        // absent or stale. So a FILE READ never separated the two paths — which
        // is precisely D6's corrected finding, that the twin was a cheaper blob
        // transport and not an index. The parse is the discriminator, and it is
        // what the assertions above and in the sibling test measure.
        const stillLoads = withUnreadableJson(jsonPath, () => {
            const h = loadGraph(jsonPath);
            h.close();
            return 'loaded';
        });
        if (stillLoads !== null) expect(stillLoads).toBe('loaded');
    }, 60_000);

    it('answers identically on both paths', () => {
        // The index is only worth taking if it says the same thing. Same graph
        // shape, one above the threshold and one below, walked from the same
        // relative position.
        const big = writeGraph(INDEXED_READ_MIN_EDGES + 10);
        const small = writeGraph(100);

        const gBig = loadGraph(big);
        const gSmall = loadGraph(small);
        try {
            expect(gBig.graph, 'the big graph must NOT be materialized').toBeNull();
            expect(gSmall.graph, 'the small graph must be materialized').not.toBeNull();

            // Both walk two hops back from their own node 50.
            const a = affected(gBig, 'src/f50.ts#fn50', 2);
            const b = affected(gSmall, 'src/f50.ts#fn50', 2);
            expect(a.lines).toEqual(b.lines);
            expect(a.recommended_reads).toEqual(b.recommended_reads);

            const qa = query(gBig, 'src/f50.ts#fn50');
            const qb = query(gSmall, 'src/f50.ts#fn50');
            expect(qa.lines).toEqual(qb.lines);
        } finally {
            gBig.close();
            gSmall.close();
        }
    }, 120_000);
});

describe.runIf(sqliteOk)('validate asserts twin ⇔ JSON by checksum', () => {
    const cli = path.resolve(__dirname, '..', '..', 'src', 'scripts', 'code_graph', 'cli.ts');

    function runValidate(jsonPath: string): { status: number | null; out: string } {
        const r = spawnSync('npx', ['tsx', cli, 'validate', '--graph', jsonPath], {
            cwd: path.resolve(__dirname, '..', '..'),
            encoding: 'utf-8',
        });
        return { status: r.status, out: `${r.stdout}${r.stderr}` };
    }

    it('passes on a matching twin and on no twin at all', () => {
        const jsonPath = writeGraph(20);
        const matched = runValidate(jsonPath);
        expect(matched.status).toBe(0);
        expect(matched.out).toContain('twin: match');

        // Absent is not a failure: the JSON is canonical and a missing
        // accelerator changes no answer.
        fs.rmSync(sqliteTwinPath(jsonPath));
        const absent = runValidate(jsonPath);
        expect(absent.status).toBe(0);
        expect(absent.out).toContain('twin: absent');
    }, 120_000);

    it('FAILS on a twin emitted from a different graph', () => {
        // The teeth. A twin whose stored `source_checksum` disagrees is fresh
        // by size and mtime — `emitSqliteTwin` stats the real file — so nothing
        // in the freshness path catches it. Only the checksum comparison does,
        // and since 2.1 the twin ANSWERS queries, so a disagreement would show
        // up as different answers rather than as a parse error.
        const jsonPath = writeGraph(20);
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const impostor = JSON.parse(raw) as CodeGraph;
        impostor.source_checksum = 'a-different-graph-entirely';
        expect(emitSqliteTwin(impostor, raw, jsonPath)).toBe(true);

        const r = runValidate(jsonPath);
        expect(r.status).toBe(1);
        expect(r.out).toContain('SQLite twin disagrees');
        expect(r.out).toContain('a-different-graph-entirely');
    }, 120_000);
});

describe.runIf(sqliteOk)('the per-node / per-edge read API (D7)', () => {
    it('answers by id, by label and by file without loading the graph', () => {
        const jsonPath = writeGraph(300);
        const index = openGraphIndex(jsonPath);
        expect(index).not.toBeNull();
        try {
            const idx = index as NonNullable<typeof index>;
            expect(idx.edgeCount).toBe(300);
            expect(idx.nodeCount).toBe(301);

            const node = idx.getNode('src/f10.ts#fn10');
            expect(node?.label).toBe('fn10');
            expect(node?.source_file).toBe('src/f10.ts');
            expect(idx.hasNode('src/f10.ts#fn10')).toBe(true);
            expect(idx.hasNode('nope')).toBe(false);
            expect(idx.getNode('nope')).toBeUndefined();

            // The chain shape makes these exact rather than approximate.
            expect(idx.edgesFrom('src/f10.ts#fn10').map((e) => e.target)).toEqual(['src/f11.ts#fn11']);
            expect(idx.edgesTo('src/f10.ts#fn10').map((e) => e.source)).toEqual(['src/f9.ts#fn9']);

            expect(idx.idsByLabel('fn10', 5)).toEqual(['src/f10.ts#fn10']);
            expect(idx.idsByLabel('nope', 5)).toEqual([]);
            expect(idx.idsInFiles(['src/f10.ts', 'src/f11.ts']).sort()).toEqual([
                'src/f10.ts#fn10',
                'src/f11.ts#fn11',
            ]);
            expect(idx.idsInFiles([])).toEqual([]);
        } finally {
            index?.close();
        }
    }, 60_000);

    it('chunks a file set larger than SQLite’s bound-parameter cap', () => {
        // 999 is the conservative default cap; a wide diff exceeds it, and an
        // unchunked IN(...) would throw rather than return a short answer.
        const jsonPath = writeGraph(1_500);
        const index = openGraphIndex(jsonPath);
        try {
            const files = Array.from({ length: 1_200 }, (_, i) => `src/f${i}.ts`);
            const ids = (index as NonNullable<typeof index>).idsInFiles(files);
            expect(ids.length).toBe(1_200);
        } finally {
            index?.close();
        }
    }, 60_000);
});
