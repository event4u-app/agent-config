// Shared `node:sqlite` guard — lazy import, availability probe, FTS5 probe,
// and `PRAGMA user_version` helpers (road-to-reachable-code-memory Phase 6/7).
//
// Extracted from the two telemetry twins (mcp_telemetry_store.ts /
// mcp_telemetry_query.ts) so every derived SQLite store (telemetry, the
// memory FTS index, the graph store) shares one guard instead of three
// copies of the same lazy-import + warning-silencer dance.
//
// `node:sqlite` ships from Node 22.5 (experimental on 22.x, stable/silent on
// >= 23); the package's supported floor is `>=20.11` (package.json
// `engines`), so every caller MUST treat this module's failure modes as
// expected, not exceptional — lazy import + graceful fallback, never a hard
// dependency (ADR-129).
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import type * as NodeSqlite from 'node:sqlite';

/** Thrown by {@link loadSqlite} when `node:sqlite` cannot be imported here. */
export class SqliteUnavailableError extends Error {
    constructor(callerName: string, cause: string) {
        super(
            `node:sqlite is unavailable in this runtime (${cause}). ` +
                `${callerName} requires Node with the built-in SQLite module.`,
        );
        this.name = 'SqliteUnavailableError';
    }
}

// Node 22 flags `node:sqlite` experimental and prints an `ExperimentalWarning:
// SQLite …` line to stderr on first import (stable / silent on Node >= 23).
// Drop only that specific warning so stderr stays byte-stable across Node
// versions (CLI intent tests pin exact stderr bytes). Installed once,
// narrowly matched — every other `emitWarning` call passes through unchanged.
let _sqliteWarningSilenced = false;
function _silenceSqliteExperimentalWarning(): void {
    if (_sqliteWarningSilenced) return;
    _sqliteWarningSilenced = true;
    const orig = process.emitWarning.bind(process);
    process.emitWarning = ((warning: string | Error, ...rest: unknown[]): void => {
        const text = typeof warning === 'string' ? warning : (warning?.message ?? '');
        if (/SQLite is an experimental/i.test(text)) return;
        (orig as (w: string | Error, ...a: unknown[]) => void)(warning, ...rest);
    }) as typeof process.emitWarning;
}

/**
 * Lazy `node:sqlite` import — keeps the caller module loadable on a runtime
 * without it. `callerName` (e.g. `"mcp_telemetry_store"`) is folded into the
 * thrown message so each caller's error text stays distinguishable.
 *
 * Throws {@link SqliteUnavailableError} on failure; callers that want a
 * non-throwing check should use {@link isSqliteAvailable} first.
 */
export async function loadSqlite(callerName: string): Promise<typeof NodeSqlite> {
    _silenceSqliteExperimentalWarning();
    try {
        return await import('node:sqlite');
    } catch (exc) {
        const message = exc instanceof Error ? exc.message : String(exc);
        throw new SqliteUnavailableError(callerName, message);
    }
}

/** Non-throwing availability probe — true iff `node:sqlite` imports cleanly. */
export async function isSqliteAvailable(): Promise<boolean> {
    _silenceSqliteExperimentalWarning();
    try {
        await import('node:sqlite');
        return true;
    } catch {
        return false;
    }
}

/**
 * Whether this runtime's `node:sqlite` supports FTS5 — probed via an
 * in-memory `CREATE VIRTUAL TABLE ... USING fts5` + `MATCH` round-trip
 * (ADR-129: re-verified live on v25.9.0). Some minimal SQLite builds omit
 * the FTS5 extension even when `node:sqlite` itself loads, so this is a
 * separate probe from {@link isSqliteAvailable}.
 */
export async function probeFts5(): Promise<boolean> {
    let sqlite: typeof NodeSqlite;
    try {
        sqlite = await loadSqlite('sqlite_guard.probeFts5');
    } catch {
        return false;
    }
    let conn: DatabaseSync | null = null;
    try {
        conn = new sqlite.DatabaseSync(':memory:');
        conn.exec("CREATE VIRTUAL TABLE _fts5_probe USING fts5(body)");
        conn.exec("INSERT INTO _fts5_probe(body) VALUES ('probe')");
        const row = conn.prepare("SELECT body FROM _fts5_probe WHERE _fts5_probe MATCH 'probe'").get();
        return row !== undefined;
    } catch {
        return false;
    } finally {
        try {
            conn?.close();
        } catch {
            /* best-effort */
        }
    }
}

// --- Synchronous variants ---------------------------------------------------
//
// `node:sqlite`'s `DatabaseSync` API is itself fully synchronous; the async
// variants above exist only because the two telemetry twins happen to be
// async CLIs. A caller that must stay synchronous end-to-end (memory_lookup.ts
// — `retrieve()` is called synchronously all over the codebase and by tests)
// uses `createRequire` for a sync `require('node:sqlite')` instead of the
// dynamic `import()`, mirroring the file's own existing `_lazy_tokenizer()`
// sync-require pattern for `./_lib/token_count.js`.
let _require: NodeJS.Require | undefined;
function _syncRequire(): NodeJS.Require {
    if (_require === undefined) {
        _require = createRequire(import.meta.url);
    }
    return _require;
}

/** Synchronous `node:sqlite` require — see "Synchronous variants" above. */
export function loadSqliteSync(callerName: string): typeof NodeSqlite {
    _silenceSqliteExperimentalWarning();
    try {
        return _syncRequire()('node:sqlite') as typeof NodeSqlite;
    } catch (exc) {
        const message = exc instanceof Error ? exc.message : String(exc);
        throw new SqliteUnavailableError(callerName, message);
    }
}

/** Non-throwing sync availability probe — true iff `node:sqlite` requires cleanly. */
export function isSqliteAvailableSync(): boolean {
    _silenceSqliteExperimentalWarning();
    try {
        _syncRequire()('node:sqlite');
        return true;
    } catch {
        return false;
    }
}

/** Sync twin of {@link probeFts5} — see "Synchronous variants" above. */
export function probeFts5Sync(): boolean {
    let sqlite: typeof NodeSqlite;
    try {
        sqlite = loadSqliteSync('sqlite_guard.probeFts5Sync');
    } catch {
        return false;
    }
    let conn: DatabaseSync | null = null;
    try {
        conn = new sqlite.DatabaseSync(':memory:');
        conn.exec("CREATE VIRTUAL TABLE _fts5_probe USING fts5(body)");
        conn.exec("INSERT INTO _fts5_probe(body) VALUES ('probe')");
        const row = conn.prepare("SELECT body FROM _fts5_probe WHERE _fts5_probe MATCH 'probe'").get();
        return row !== undefined;
    } catch {
        return false;
    } finally {
        try {
            conn?.close();
        } catch {
            /* best-effort */
        }
    }
}

/** Read `PRAGMA user_version` — 0 on a freshly created (never-stamped) DB. */
export function readUserVersion(conn: DatabaseSync): number {
    const row = conn.prepare('PRAGMA user_version').get();
    const v = row?.['user_version'];
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'number') return v;
    return 0;
}

/**
 * Stamp `PRAGMA user_version`. SQLite's `PRAGMA` statements take no bind
 * parameters, so `version` is range-checked (small non-negative 32-bit
 * integer) before string interpolation.
 */
export function stampUserVersion(conn: DatabaseSync, version: number): void {
    if (!Number.isInteger(version) || version < 0 || version > 2 ** 31 - 1) {
        throw new RangeError(`stampUserVersion: version out of range: ${version}`);
    }
    conn.exec(`PRAGMA user_version = ${version}`);
}
