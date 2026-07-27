import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildFromRepo, serializeGraph } from '../../src/scripts/code_graph/build.js';
import { affected, loadGraph, query } from '../../src/scripts/code_graph/query.js';
import {
    emitSqliteTwin,
    GRAPH_STORE_VERSION,
    loadSerializedFromTwin,
    sqliteTwinPath,
    twinCounts,
} from '../../src/scripts/code_graph/sqlite_store.js';
import { isSqliteAvailableSync, loadSqliteSync, stampUserVersion } from '../../src/scripts/_lib/sqlite_guard.js';

const sqliteOk = isSqliteAvailableSync();

let tmp: string;
let jsonPath: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-sqlite-'));
    fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(tmp, 'src', 'a.ts'),
        'export function callee(): number { return 1; }\nexport function caller(): number { return callee(); }\n',
        'utf8',
    );
    jsonPath = path.join(tmp, 'native-cache.json');
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe.runIf(sqliteOk)('code-graph SQLite twin (ADR-129)', () => {
    it('build emits the twin beside the canonical JSON', async () => {
        await buildFromRepo(tmp, jsonPath);
        expect(fs.existsSync(jsonPath)).toBe(true);
        expect(fs.existsSync(sqliteTwinPath(jsonPath))).toBe(true);
        const counts = twinCounts(jsonPath);
        expect(counts).not.toBeNull();
        expect(counts!.nodes).toBeGreaterThan(0);
        expect(counts!.edges).toBeGreaterThan(0);
    });

    it('answers are byte-identical on both stores', async () => {
        await buildFromRepo(tmp, jsonPath);
        const twinSerialized = loadSerializedFromTwin(jsonPath);
        expect(twinSerialized).not.toBeNull();
        expect(twinSerialized).toBe(fs.readFileSync(jsonPath, 'utf8'));
        // full query round-trip on both paths
        const viaTwin = loadGraph(jsonPath);
        fs.rmSync(sqliteTwinPath(jsonPath));
        const viaJson = loadGraph(jsonPath);
        expect(serializeGraph(viaTwin.graph)).toBe(serializeGraph(viaJson.graph));
        expect(query(viaTwin, 'caller')).toEqual(query(viaJson, 'caller'));
        expect(affected(viaTwin, 'callee')).toEqual(affected(viaJson, 'callee'));
    });

    it('a stale twin (JSON changed after emission) is refused → JSON fallback', async () => {
        await buildFromRepo(tmp, jsonPath);
        // rewrite the JSON (different mtime/size) without re-emitting the twin
        const doctored = `${fs.readFileSync(jsonPath, 'utf8')}\n`;
        fs.writeFileSync(jsonPath, doctored, 'utf8');
        expect(loadSerializedFromTwin(jsonPath)).toBeNull();
    });

    it('a corrupt twin is a non-event: dropped, JSON path answers', async () => {
        await buildFromRepo(tmp, jsonPath);
        const twin = sqliteTwinPath(jsonPath);
        fs.writeFileSync(twin, fs.readFileSync(twin).subarray(0, 100)); // truncate mid-byte
        expect(loadSerializedFromTwin(jsonPath)).toBeNull();
        expect(fs.existsSync(twin)).toBe(false); // dropped for re-emission
        const g = loadGraph(jsonPath); // loads fine via JSON
        expect(g.graph.nodes.length).toBeGreaterThan(0);
        expect(fs.existsSync(twin)).toBe(true); // zero-touch re-emit happened
    });

    it('user_version mismatch → refused, then rebuilt from committed truth on next load', async () => {
        await buildFromRepo(tmp, jsonPath);
        const twin = sqliteTwinPath(jsonPath);
        const { DatabaseSync } = loadSqliteSync('test');
        const db = new DatabaseSync(twin);
        stampUserVersion(db, GRAPH_STORE_VERSION + 99);
        db.close();
        expect(loadSerializedFromTwin(jsonPath)).toBeNull();
        loadGraph(jsonPath); // JSON fallback + re-emit
        expect(loadSerializedFromTwin(jsonPath)).not.toBeNull(); // twin healthy again
    });

    it('rollback = delete the twin; nothing else changes', async () => {
        await buildFromRepo(tmp, jsonPath);
        const before = fs.readFileSync(jsonPath, 'utf8');
        fs.rmSync(sqliteTwinPath(jsonPath));
        expect(fs.readFileSync(jsonPath, 'utf8')).toBe(before);
        expect(loadGraph(jsonPath).graph.nodes.length).toBeGreaterThan(0);
    });
});

describe('graceful degradation without node:sqlite', () => {
    it('emit returns false instead of throwing when unavailable (or true when available)', async () => {
        const r = await buildFromRepo(tmp, jsonPath);
        const emitted = emitSqliteTwin(r.graph, r.json, jsonPath);
        expect(typeof emitted).toBe('boolean');
        if (!sqliteOk) {
            expect(emitted).toBe(false);
            expect(loadSerializedFromTwin(jsonPath)).toBeNull();
        }
    });
});
