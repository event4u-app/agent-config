/**
 * Zero-touch upgrade — road-to-reachable-code-memory Phase 7.
 *
 * Every derived SQLite store this suite writes (telemetry, the memory FTS
 * index) stamps `PRAGMA user_version` on create and rebuilds silently on
 * drift: absent, schema-mismatched, or corrupt → rebuilt from committed
 * truth on first use, with no error output requiring user action.
 *
 * `node:sqlite` gate: stable from Node 22.5; skipped entirely on an older
 * runtime (the CLI/module itself already degrades gracefully there).
 *
 * Two different in-test access styles, deliberately:
 *
 *   - The memory-index assertions call `_lib/memory_fts_index.ts` and
 *     `_lib/sqlite_guard.ts`'s SYNC (`createRequire`-based) API directly,
 *     in-process — this is what those modules are built around.
 *   - The telemetry-store assertions drive the tsx CLI via `runTs` (the
 *     SAME subprocess pattern the sibling `mcp_telemetry_store.test.ts` /
 *     `mcp_telemetry_query.test.ts` already use), rather than importing
 *     `ingest()` directly into this vitest process: `mcp_telemetry_store.ts`
 *     lazy-loads `node:sqlite` via a dynamic `await import(...)`, which
 *     Vite's in-process SSR module resolution (this Vite version predates
 *     `node:sqlite`) cannot resolve — a real subprocess (tsx/Node) has no
 *     such translation layer, so the CLI path is both the correct fix and
 *     the already-proven-working pattern for this exact module.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { REPO_ROOT, hasNodeSqlite, makeRoot, runTs, writeSink } from './_mcp_telemetry.js';
import {
    SCHEMA_VERSION as MEMORY_SCHEMA_VERSION,
    buildIndex,
    ensureIndex,
    isStale,
    queryIndex,
} from '../../src/scripts/_lib/memory_fts_index.js';
import { loadSqliteSync, readUserVersion, stampUserVersion } from '../../src/scripts/_lib/sqlite_guard.js';

const sqlite = hasNodeSqlite();

const TS_STORE = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_telemetry_store.ts');
const TELEMETRY_SCHEMA_VERSION = 1; // mcp_telemetry_store.ts's exported SCHEMA_VERSION — pinned here too so a bump is a visible, deliberate diff in this test.

const roots: string[] = [];
afterEach(() => {
    while (roots.length > 0) {
        const d = roots.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});
function tmpRoot(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    roots.push(d);
    return d;
}

/** A minimal single-file curated fixture memory_report.ts's iterator reads. */
function writeCuratedFixture(memoryRoot: string): void {
    fs.mkdirSync(memoryRoot, { recursive: true });
    fs.writeFileSync(
        path.join(memoryRoot, 'ownership.yml'),
        'version: 1\n' +
            'entries:\n' +
            '  - id: zero-touch-fixture-entry\n' +
            '    status: active\n' +
            '    key: zero touch upgrade fixture\n' +
            '    body: fixture body for the zero-touch upgrade suite\n',
    );
}

describe.skipIf(!sqlite)('memory FTS index — rebuild on drift', () => {
    it('a truncated (corrupt) index file is silently rebuilt on next ensureIndex()', () => {
        const root = tmpRoot('mfts-corrupt-');
        const memoryRoot = path.join(root, 'agents', 'memory');
        const intakeRoot = path.join(memoryRoot, 'intake');
        writeCuratedFixture(memoryRoot);
        const indexPath = path.join(root, 'idx.sqlite3');

        expect(ensureIndex(indexPath, memoryRoot, intakeRoot)).toBe(true);
        expect(queryIndex(indexPath, ['zero touch'], [])).not.toHaveLength(0);

        // Truncate mid-byte — a real "corruption is a non-event" scenario.
        const full = fs.readFileSync(indexPath);
        fs.writeFileSync(indexPath, full.subarray(0, Math.floor(full.length / 2)));
        expect(isStale(indexPath, memoryRoot, intakeRoot)).toBe(true);

        // The next ensureIndex() (what a real lookup calls) must rebuild
        // silently and succeed — no thrown error, no manual step.
        expect(ensureIndex(indexPath, memoryRoot, intakeRoot)).toBe(true);
        expect(isStale(indexPath, memoryRoot, intakeRoot)).toBe(false);
        expect(queryIndex(indexPath, ['zero touch'], [])).not.toHaveLength(0);
    });

    it('N-1 → N: a stale user_version is rebuilt to the current schema on next ensureIndex()', () => {
        const root = tmpRoot('mfts-upgrade-');
        const memoryRoot = path.join(root, 'agents', 'memory');
        const intakeRoot = path.join(memoryRoot, 'intake');
        writeCuratedFixture(memoryRoot);
        const indexPath = path.join(root, 'idx.sqlite3');

        buildIndex(indexPath, memoryRoot, intakeRoot);

        // Simulate an install-N-1 index left on disk: stamp a version below
        // the current one directly (bypassing the module's own build path).
        // The memory index always fully rebuilds (no incremental state to
        // preserve), so ANY mismatch — including the pre-versioning `0` —
        // takes the same rebuild path; no separate "legacy, keep data" case
        // applies here (unlike the telemetry store, which has rows to keep).
        const { DatabaseSync } = loadSqliteSync('zero_touch_upgrade.test');
        const conn = new DatabaseSync(indexPath);
        expect(readUserVersion(conn)).toBe(MEMORY_SCHEMA_VERSION);
        stampUserVersion(conn, Math.max(0, MEMORY_SCHEMA_VERSION - 1));
        conn.close();

        expect(isStale(indexPath, memoryRoot, intakeRoot)).toBe(true);

        // First lookup after the "upgrade" — must rebuild with no user action.
        expect(ensureIndex(indexPath, memoryRoot, intakeRoot)).toBe(true);
        const conn2 = new DatabaseSync(indexPath, { readOnly: true });
        expect(readUserVersion(conn2)).toBe(MEMORY_SCHEMA_VERSION);
        conn2.close();
        expect(queryIndex(indexPath, ['zero touch'], [])).not.toHaveLength(0);
    });
});

describe.skipIf(!sqlite)('mcp telemetry store — rebuild on drift', () => {
    it('a truncated (corrupt) telemetry db is silently rebuilt on next ingest run', () => {
        const root = makeRoot('mtel-corrupt-');
        roots.push(root);
        // First run with no sink written — the store creates the empty DB.
        const first = runTs(TS_STORE, ['--consumer-root', root, '--json']);
        expect(first.status).toBe(0);
        const dbPath = path.join(root, 'agents', 'runtime', 'mcp-telemetry', 'calls.sqlite3');
        expect(fs.existsSync(dbPath)).toBe(true);

        const full = fs.readFileSync(dbPath);
        fs.writeFileSync(dbPath, full.subarray(0, Math.floor(full.length / 2)));

        // The next run must not error on the corrupt file — it discards and rebuilds.
        writeSink(root, ['{"tool_name":"t","client_id_hash":"c","ts":"2026-01-01T00:00:00Z","transport":"stdio","outcome":"implemented"}']);
        const second = runTs(TS_STORE, ['--consumer-root', root, '--json']);
        expect(second.status).toBe(0);
        expect(second.stderr).toBe('');
        const report = JSON.parse(second.stdout) as Record<string, unknown>;
        expect(report.rows_inserted).toBe(1);

        const { DatabaseSync } = loadSqliteSync('zero_touch_upgrade.test');
        const conn = new DatabaseSync(dbPath, { readOnly: true });
        expect(readUserVersion(conn)).toBe(TELEMETRY_SCHEMA_VERSION);
        conn.close();
    });

    it('a stale user_version DB is silently rebuilt (schema drift, not the 0/never-stamped legacy case)', () => {
        const root = makeRoot('mtel-upgrade-');
        roots.push(root);
        const first = runTs(TS_STORE, ['--consumer-root', root]); // creates + stamps SCHEMA_VERSION
        expect(first.status).toBe(0);
        const dbPath = path.join(root, 'agents', 'runtime', 'mcp-telemetry', 'calls.sqlite3');

        const { DatabaseSync } = loadSqliteSync('zero_touch_upgrade.test');
        const conn = new DatabaseSync(dbPath);
        expect(readUserVersion(conn)).toBe(TELEMETRY_SCHEMA_VERSION);
        stampUserVersion(conn, TELEMETRY_SCHEMA_VERSION + 41); // simulate an incompatible future schema
        conn.close();

        // Next run must detect the mismatch and rebuild — not error, not
        // silently keep serving the mismatched schema.
        writeSink(root, ['{"tool_name":"t","client_id_hash":"c","ts":"2026-01-01T00:00:00Z","transport":"stdio","outcome":"implemented"}']);
        const second = runTs(TS_STORE, ['--consumer-root', root, '--json']);
        expect(second.status).toBe(0);
        const report = JSON.parse(second.stdout) as Record<string, unknown>;
        expect(report.rows_inserted).toBe(1); // rebuilt table, re-ingested from the JSONL source of truth

        const conn2 = new DatabaseSync(dbPath, { readOnly: true });
        expect(readUserVersion(conn2)).toBe(TELEMETRY_SCHEMA_VERSION);
        conn2.close();
    });

    it('a pre-Phase-7 DB (user_version 0, never stamped) is treated as legacy, not drift', () => {
        const root = makeRoot('mtel-legacy-');
        roots.push(root);
        writeSink(root, ['{"tool_name":"t","client_id_hash":"c","ts":"2026-01-01T00:00:00Z","transport":"stdio","outcome":"implemented"}']);
        const first = runTs(TS_STORE, ['--consumer-root', root, '--json']);
        expect(first.status).toBe(0);
        const dbPath = path.join(root, 'agents', 'runtime', 'mcp-telemetry', 'calls.sqlite3');

        // Roll it back to the pre-Phase-7 unstamped state (user_version 0)
        // without touching the table — the "legacy-path sweep" case.
        const { DatabaseSync } = loadSqliteSync('zero_touch_upgrade.test');
        const conn = new DatabaseSync(dbPath);
        stampUserVersion(conn, 0);
        conn.close();

        // Second run over the SAME (unchanged) sink — idempotent re-ingest,
        // not a rebuild: the row from the first run is still there.
        const second = runTs(TS_STORE, ['--consumer-root', root, '--json']);
        expect(second.status).toBe(0);
        const report = JSON.parse(second.stdout) as Record<string, unknown>;
        expect(report.rows_inserted).toBe(0);
        expect(report.rows_already_present).toBe(1); // table was never dropped, just unversioned

        const conn2 = new DatabaseSync(dbPath, { readOnly: true });
        expect(readUserVersion(conn2)).toBe(TELEMETRY_SCHEMA_VERSION);
        conn2.close();
    });
});
