// MCP telemetry query CLI — Phase 2 K2.
//
// Reads the SQLite store written by `scripts/mcp_telemetry_store.ts`
// and surfaces:
//
// - Per-tool attempt counts.
// - Distinct-consumer counts (`client_id_hash`).
// - Outcome ratios (`implemented` / `stub` / `latent_demand`).
// - Latent-demand names — tool names not in the catalog.
//
// Refresh cadence: cheap enough to run on every `task mcp:report`
// invocation. stdlib-only; reads (never writes) the DB via Node's
// built-in `node:sqlite`, imported lazily.
//
// TS twin of mcp_telemetry_query.py (py2ts). Mirrors the full public
// surface: ToolRow, summarise, main.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';

import { resolve_db } from './mcp_telemetry_store.js';

export interface ToolRow {
    tool_name: string;
    attempts: number;
    distinct_consumers: number;
    implemented: number;
    stub: number;
    latent_demand: number;
    last_ts: string | null;
}

/** Field-ordered dict mirroring ToolRow.as_dict(). */
function toolRowAsDict(t: ToolRow): Record<string, unknown> {
    return {
        tool_name: t.tool_name,
        attempts: t.attempts,
        distinct_consumers: t.distinct_consumers,
        implemented: t.implemented,
        stub: t.stub,
        latent_demand: t.latent_demand,
        last_ts: t.last_ts,
    };
}

/** Python error subclass marker so main() can mirror the FileNotFoundError branch. */
class FileNotFoundLikeError extends Error {}

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
                'mcp_telemetry_query requires Node with the built-in SQLite module.',
        );
    }
}

/** Open read-only. Mirrors `_connect_ro`; raises FileNotFound-like on absence. */
async function _connect_ro(db_path: string): Promise<DatabaseSync> {
    if (!fs.existsSync(db_path)) {
        throw new FileNotFoundLikeError(`telemetry db not found: ${db_path}`);
    }
    const { DatabaseSync } = await _loadSqlite();
    // `file:<posix>?mode=ro` — Python opens via the same URI form.
    const uri = `file:${_asPosix(db_path)}?mode=ro`;
    return new DatabaseSync(uri, { readOnly: true });
}

/** Mirror Python `Path.as_posix()` — forward slashes on every platform. */
function _asPosix(p: string): string {
    return p.split(path.sep).join('/');
}

function _query_tools(conn: DatabaseSync): ToolRow[] {
    const rows = conn
        .prepare(
            `
        SELECT
          tool_name,
          COUNT(*) AS attempts,
          COUNT(DISTINCT client_id_hash) AS distinct_consumers,
          SUM(CASE WHEN outcome = 'implemented' THEN 1 ELSE 0 END),
          SUM(CASE WHEN outcome = 'stub' THEN 1 ELSE 0 END),
          SUM(CASE WHEN outcome = 'latent_demand' THEN 1 ELSE 0 END),
          MAX(ts)
        FROM calls
        GROUP BY tool_name
        ORDER BY attempts DESC, tool_name ASC
        `,
        )
        .all();
    return rows.map((r) => {
        // node:sqlite returns named columns; positional aggregates carry the
        // SQL expression as the key. Read columns in SELECT order to mirror
        // the Python positional tuple (r[0]..r[6]).
        const tuple = _rowValues(r);
        return {
            tool_name: tuple[0] as string,
            attempts: _asInt(tuple[1]),
            distinct_consumers: _asInt(tuple[2]),
            implemented: _asInt(tuple[3]) || 0,
            stub: _asInt(tuple[4]) || 0,
            latent_demand: _asInt(tuple[5]) || 0,
            last_ts: (tuple[6] ?? null) as string | null,
        };
    });
}

/** Values of a node:sqlite row object in column (insertion) order. */
function _rowValues(row: Record<string, unknown>): unknown[] {
    return Object.keys(row).map((k) => row[k]);
}

/** Coerce a SQLite numeric column to a JS number (bigint-safe). */
function _asInt(value: unknown): number {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (typeof value === 'number') {
        return value;
    }
    if (value === null || value === undefined) {
        return 0;
    }
    return Number(value);
}

/** Catalog names — defensive: empty set if the catalog can't be loaded. */
async function _catalog_names(): Promise<Set<string>> {
    try {
        const mod = await import('./mcp_server/catalog.js');
        return new Set(mod.load_catalog().map((e) => e.name));
    } catch {
        return new Set();
    }
}

/** Pure-function summary used by both the CLI and the tests. */
export async function summarise(db_path: string): Promise<Record<string, unknown>> {
    let conn = await _connect_ro(db_path);
    let tools: ToolRow[];
    try {
        tools = _query_tools(conn);
    } finally {
        conn.close();
    }
    const catalog = await _catalog_names();
    const total_attempts = tools.reduce((acc, t) => acc + t.attempts, 0);
    const consumer_set = new Set<string>();
    conn = await _connect_ro(db_path);
    try {
        for (const row of conn.prepare('SELECT DISTINCT client_id_hash FROM calls').all()) {
            consumer_set.add(_rowValues(row)[0] as string);
        }
    } finally {
        conn.close();
    }
    const total_consumers = consumer_set.size;
    const latent_names = tools
        .filter((t) => t.latent_demand > 0 && catalog.size > 0 && !catalog.has(t.tool_name))
        .map((t) => t.tool_name);
    return {
        db_path,
        total_attempts,
        total_distinct_consumers: total_consumers,
        tools: tools.map((t) => toolRowAsDict(t)),
        latent_demand_names: _sortedUniqueByCodePoint(latent_names),
        catalog_known: catalog.size > 0,
    };
}

/** Python `sorted(set(names))` — dedupe then sort by Unicode code point. */
function _sortedUniqueByCodePoint(names: string[]): string[] {
    return [...new Set(names)].sort(_cmp_code_points);
}

function _cmp_code_points(a: string, b: string): number {
    const ai = [...a];
    const bi = [...b];
    const n = Math.min(ai.length, bi.length);
    for (let i = 0; i < n; i += 1) {
        const ca = (ai[i] as string).codePointAt(0) as number;
        const cb = (bi[i] as string).codePointAt(0) as number;
        if (ca !== cb) return ca - cb;
    }
    return ai.length - bi.length;
}

/** Unicode code-point length — Python `len(str)`, not UTF-16 `.length`. */
function _pyLen(s: string): number {
    return [...s].length;
}

/** Left-justify to `width` code points with spaces — Python `{:<width}`. */
function _ljust(s: string, width: number): string {
    const pad = width - _pyLen(s);
    return pad > 0 ? s + ' '.repeat(pad) : s;
}

/** Right-justify to `width` code points with spaces — Python `{:>width}`. */
function _rjust(value: number | string, width: number): string {
    const s = String(value);
    const pad = width - _pyLen(s);
    return pad > 0 ? ' '.repeat(pad) + s : s;
}

function _print_human(report: Record<string, unknown>): void {
    const tools = report['tools'] as Record<string, unknown>[];
    process.stdout.write(
        `📊  ${report['total_attempts']} attempts across ` +
            `${tools.length} tool(s) — ` +
            `${report['total_distinct_consumers']} distinct consumer(s)\n`,
    );
    process.stdout.write(`   db: ${report['db_path']}\n`);
    process.stdout.write('\n');
    if (tools.length === 0) {
        process.stdout.write('(no telemetry rows — run scripts/mcp_telemetry_store.py first)\n');
        return;
    }
    process.stdout.write(
        `  ${_ljust('tool', 28)}  ${_rjust('att', 5)}  ${_rjust('cons', 5)}  ` +
            `${_rjust('impl', 5)}  ${_rjust('stub', 5)}  ${_rjust('lat', 5)}  last_ts\n`,
    );
    for (const t of tools) {
        process.stdout.write(
            `  ${_ljust(t['tool_name'] as string, 28)}  ${_rjust(t['attempts'] as number, 5)}  ` +
                `${_rjust(t['distinct_consumers'] as number, 5)}  ${_rjust(t['implemented'] as number, 5)}  ` +
                `${_rjust(t['stub'] as number, 5)}  ${_rjust(t['latent_demand'] as number, 5)}  ` +
                `${(t['last_ts'] as string | null) ?? '—'}\n`,
        );
    }
    const latent = report['latent_demand_names'] as string[];
    if (latent.length > 0) {
        process.stdout.write('\n');
        process.stdout.write('⚠️  latent-demand names not in catalog:\n');
        for (const n of latent) {
            process.stdout.write(`   - ${n}\n`);
        }
    }
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

interface ParsedArgs {
    consumer_root: string | null;
    db: string | null;
    json: boolean;
}

/** Minimal argparse mirror for this CLI's flags. */
function _parse_args(argv: string[]): ParsedArgs {
    const args: ParsedArgs = { consumer_root: null, db: null, json: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--consumer-root') args.consumer_root = argv[++i] as string;
        else if (a.startsWith('--consumer-root=')) args.consumer_root = a.slice('--consumer-root='.length);
        else if (a === '--db') args.db = argv[++i] as string;
        else if (a.startsWith('--db=')) args.db = a.slice('--db='.length);
        else if (a === '--json') args.json = true;
    }
    return args;
}

export async function main(argv?: string[]): Promise<number> {
    const args = _parse_args(argv ?? process.argv.slice(2));
    const db_path = args.db ?? resolve_db(args.consumer_root);
    let report: Record<string, unknown>;
    try {
        report = await summarise(db_path);
    } catch (exc) {
        if (exc instanceof FileNotFoundLikeError) {
            const msg = `❌  ${exc.message}\n   run \`python3 scripts/mcp_telemetry_store.py\` first.`;
            if (args.json) {
                process.stdout.write(_py_json_dumps({ error: exc.message }) + '\n');
            } else {
                process.stderr.write(msg + '\n');
            }
            return 1;
        }
        throw exc;
    }
    if (args.json) {
        process.stdout.write(_py_json_dumps(report) + '\n');
    } else {
        _print_human(report);
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
