// MCP telemetry SQLite store — Phase 2 K1.
//
// Ingests the JSONL sink written by `scripts/mcp_server/telemetry.ts`
// into a queryable SQLite database. Idempotent: each JSONL line is hashed
// and stored as the primary key, so re-running `ingest` is safe and
// won't double-count records.
//
// Contract:
//
// - Source of truth stays the JSONL file. SQLite is a derived view.
// - Schema is documented in `docs/contracts/mcp-telemetry-store.md`.
// - stdlib-only — no ORM, so consumers can run this without extra
//   dependencies. The SQLite engine is Node's built-in `node:sqlite`,
//   imported lazily so the module still loads on a runtime that lacks it.
//
// Phase 2 K2 (`scripts/mcp_telemetry_query.ts`) reads from this store.
//
// TS twin of mcp_telemetry_store.py (py2ts). Mirrors the full public
// surface: IngestReport, resolve_source, resolve_db, ingest, main.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';

import { TELEMETRY_FILENAME, TELEMETRY_REL_DIR } from './mcp_server/telemetry.js';

export const DEFAULT_DB_REL = 'agents/runtime/mcp-telemetry/calls.sqlite3';
export const SCHEMA_VERSION = 1;

/** Outcome of one `ingest` run. */
export interface IngestReport {
    source_path: string;
    db_path: string;
    lines_read: number;
    lines_skipped: number;
    rows_inserted: number;
    rows_already_present: number;
}

/** Field-ordered dict mirroring IngestReport.as_dict(). */
function as_dict(report: IngestReport): Record<string, unknown> {
    return {
        source_path: report.source_path,
        db_path: report.db_path,
        lines_read: report.lines_read,
        lines_skipped: report.lines_skipped,
        rows_inserted: report.rows_inserted,
        rows_already_present: report.rows_already_present,
    };
}

/**
 * Compact JSON, Python `json.dumps(obj, separators=(",", ":"))` byte-parity:
 * insertion order preserved, `ensure_ascii=True` (non-ASCII → `\uXXXX`).
 */
function _py_json_dumps(value: unknown): string {
    if (value === null) {
        return 'null';
    }
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            return String(value);
        case 'string':
            return _py_json_string(value);
        case 'object':
            break;
        default:
            throw new TypeError(`Object of type ${typeof value} is not JSON serializable`);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _py_json_dumps(v)).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    const parts = Object.keys(obj).map(
        (k) => `${_py_json_string(k)}:${_py_json_dumps(obj[k])}`,
    );
    return `{${parts.join(',')}}`;
}

/** Escape a string like Python `json.dumps(..., ensure_ascii=True)`. */
function _py_json_string(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i += 1) {
        const code = s.charCodeAt(i);
        const ch = s[i] as string;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code >= 0x20 && code <= 0x7e) out += ch;
        else out += `\\u${code.toString(16).padStart(4, '0')}`;
    }
    return out + '"';
}

/** Coerce a JSON value the way Python `str(record.get(key, ""))` would. */
function _py_str(value: unknown): string {
    if (value === undefined) {
        // record.get(key, "") default — the field was absent.
        return '';
    }
    if (value === null) {
        return 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        // json.loads yields int for "1" and float for "1.0"; str() differs
        // ("1" vs "1.0"). JS collapses both to number, so an integral float
        // would render "1" not "1.0". Telemetry fields here are always JSON
        // strings in practice; numeric values are a defensive edge only.
        return String(value);
    }
    // Arrays / objects: Python str(dict)/str(list) repr. Defensive only —
    // telemetry fields are scalars. Mirror Python's repr loosely; these
    // never appear in the byte-compared paths.
    return _py_repr(value);
}

/** Loose Python `str()`/`repr()` for the never-hit container edge. */
function _py_repr(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((v) => _py_repr_inner(v)).join(', ')}]`;
    }
    if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const parts = Object.keys(obj).map(
            (k) => `${_py_repr_inner(k)}: ${_py_repr_inner(obj[k])}`,
        );
        return `{${parts.join(', ')}}`;
    }
    return _py_repr_inner(value);
}

function _py_repr_inner(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'string') return `'${value}'`;
    if (typeof value === 'number') return String(value);
    return _py_repr(value);
}

/**
 * Resolve a path like Python `Path(...).resolve()` — realpath the existing
 * prefix, tolerating a non-existent tail.
 */
function _resolvePath(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
}

export function resolve_source(consumer_root?: string | null): string {
    const root = _resolvePath(consumer_root ?? process.cwd());
    return path.join(root, TELEMETRY_REL_DIR, TELEMETRY_FILENAME);
}

export function resolve_db(consumer_root?: string | null): string {
    const root = _resolvePath(consumer_root ?? process.cwd());
    return path.join(root, DEFAULT_DB_REL);
}

// Python's stdlib sqlite3 emits nothing on stderr; node:sqlite is flagged
// experimental on node 22 and prints an `ExperimentalWarning: SQLite …` line
// to stderr on first import (stable / silent on node >= 23). Drop only that
// specific warning so the twin's stderr stays byte-identical to the Python
// original across node versions. Installed once, narrowly matched.
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

/** Lazy `node:sqlite` import — keeps the module loadable on a runtime without it. */
async function _loadSqlite(): Promise<typeof import('node:sqlite')> {
    _silenceSqliteExperimentalWarning();
    try {
        return await import('node:sqlite');
    } catch (exc) {
        const message = exc instanceof Error ? exc.message : String(exc);
        throw new Error(
            `node:sqlite is unavailable in this runtime (${message}). ` +
                'mcp_telemetry_store requires Node with the built-in SQLite module.',
        );
    }
}

/** Open + schema-init the DB. Mirrors the Python `_connect` helper. */
async function _connect(db_path: string): Promise<DatabaseSync> {
    fs.mkdirSync(path.dirname(db_path), { recursive: true });
    const { DatabaseSync } = await _loadSqlite();
    const conn = new DatabaseSync(db_path);
    conn.exec('PRAGMA journal_mode=WAL');
    conn.exec(
        `
        CREATE TABLE IF NOT EXISTS calls (
            line_hash TEXT PRIMARY KEY,
            tool_name TEXT NOT NULL,
            client_id_hash TEXT NOT NULL,
            ts TEXT NOT NULL,
            transport TEXT NOT NULL,
            outcome TEXT NOT NULL,
            ingested_at TEXT NOT NULL
        )
        `,
    );
    conn.exec('CREATE INDEX IF NOT EXISTS idx_calls_tool ON calls(tool_name)');
    conn.exec('CREATE INDEX IF NOT EXISTS idx_calls_ts ON calls(ts)');
    conn.exec('CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome)');
    return conn;
}

/**
 * Checkpoint the WAL into the main file, then revert the journal to
 * `DELETE`, before closing.
 *
 * The Python twin sets `PRAGMA journal_mode=WAL` and leaves the
 * connection's `-wal`/`-shm` sidecars in place, so its own read-only
 * query (which opens `file:...?mode=ro`) can still attach. `node:sqlite`
 * fully tears those sidecars down on `close()`, leaving a WAL-marked DB
 * with no `-shm` — which a read-only open refuses ("unable to open
 * database file"). Checkpointing into the main file and switching the
 * persisted journal mode back to `DELETE` produces a self-contained DB
 * that BOTH runtimes can open read-only — preserving the store↔query
 * cross-language contract during the migration window. The store's stdout
 * is unaffected (the DB file is a derived view, never byte-compared).
 */
function _finalize(conn: DatabaseSync): void {
    conn.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    conn.exec('PRAGMA journal_mode=DELETE');
    conn.close();
}

/** Mirror Python `str.splitlines(keepends=True)` over the file iterator. */
function _iter_lines(text: string): string[] {
    // The Python iterates the file object, yielding each line WITH its
    // trailing newline. Each line is then `.strip()`-ed before hashing, so
    // the keepends form only matters for empty-line detection (a bare "\n"
    // strips to "" and is skipped). Splitting on \n while preserving the
    // separator reproduces the iteration; a final no-newline line yields no
    // trailing empty.
    if (text === '') {
        return [];
    }
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] === '\n') {
            out.push(text.slice(start, i + 1));
            start = i + 1;
        }
    }
    if (start < text.length) {
        out.push(text.slice(start));
    }
    return out;
}

/** ISO-8601 UTC, seconds — mirrors `time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())`. */
function _now_iso(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Read the JSONL sink and upsert into SQLite. Idempotent. */
export async function ingest(options: {
    consumer_root?: string | null;
    source_override?: string | null;
    db_override?: string | null;
} = {}): Promise<IngestReport> {
    const source = options.source_override ?? resolve_source(options.consumer_root ?? null);
    const db_path = options.db_override ?? resolve_db(options.consumer_root ?? null);

    if (!fs.existsSync(source)) {
        // Still create the DB so K2 has something to query against.
        const conn = await _connect(db_path);
        _finalize(conn);
        return {
            source_path: source,
            db_path,
            lines_read: 0,
            lines_skipped: 0,
            rows_inserted: 0,
            rows_already_present: 0,
        };
    }

    const conn = await _connect(db_path);
    let inserted = 0;
    let already = 0;
    let read = 0;
    let skipped = 0;
    const now = _now_iso();
    try {
        const text = fs.readFileSync(source, { encoding: 'utf-8' });
        const stmt = conn.prepare(
            'INSERT OR IGNORE INTO calls ' +
                '(line_hash, tool_name, client_id_hash, ts, transport, ' +
                'outcome, ingested_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        for (const raw of _iter_lines(text)) {
            const stripped = raw.trim();
            if (stripped === '') {
                continue;
            }
            read += 1;
            let record: unknown;
            try {
                record = JSON.parse(stripped);
            } catch {
                skipped += 1;
                continue;
            }
            const rec =
                record !== null && typeof record === 'object' && !Array.isArray(record)
                    ? (record as Record<string, unknown>)
                    : {};
            const line_hash = crypto
                .createHash('sha256')
                .update(Buffer.from(stripped, 'utf-8'))
                .digest('hex');
            const result = stmt.run(
                line_hash,
                _py_str(rec['tool_name']),
                _py_str(rec['client_id_hash']),
                _py_str(rec['ts']),
                _py_str(rec['transport']),
                _py_str(rec['outcome']),
                now,
            );
            if (result.changes === 1) {
                inserted += 1;
            } else {
                already += 1;
            }
        }
    } finally {
        _finalize(conn);
    }
    return {
        source_path: source,
        db_path,
        lines_read: read,
        lines_skipped: skipped,
        rows_inserted: inserted,
        rows_already_present: already,
    };
}

interface ParsedArgs {
    consumer_root: string | null;
    source: string | null;
    db: string | null;
    json: boolean;
}

/** Minimal argparse mirror for this CLI's flags. */
function _parse_args(argv: string[]): ParsedArgs {
    const args: ParsedArgs = { consumer_root: null, source: null, db: null, json: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--consumer-root') args.consumer_root = argv[++i] as string;
        else if (a.startsWith('--consumer-root=')) args.consumer_root = a.slice('--consumer-root='.length);
        else if (a === '--source') args.source = argv[++i] as string;
        else if (a.startsWith('--source=')) args.source = a.slice('--source='.length);
        else if (a === '--db') args.db = argv[++i] as string;
        else if (a.startsWith('--db=')) args.db = a.slice('--db='.length);
        else if (a === '--json') args.json = true;
    }
    return args;
}

export async function main(argv?: string[]): Promise<number> {
    const args = _parse_args(argv ?? process.argv.slice(2));
    const report = await ingest({
        consumer_root: args.consumer_root,
        source_override: args.source,
        db_override: args.db,
    });
    if (args.json) {
        process.stdout.write(_py_json_dumps(as_dict(report)) + '\n');
    } else {
        process.stdout.write(
            `✅  ingested ${report.rows_inserted} new row(s) ` +
                `(skipped ${report.lines_skipped} malformed, ` +
                `${report.rows_already_present} already present)\n`,
        );
        process.stdout.write(`   source: ${report.source_path}\n`);
        process.stdout.write(`   db:     ${report.db_path}\n`);
    }
    return 0;
}

// Entry point — `process.exitCode`, never `process.exit`, so large stdout
// drains before the process ends.
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    void main().then((rc) => {
        process.exitCode = rc;
    });
}
