// Derived FTS5 index over curated memory + intake JSONL
// (road-to-reachable-code-memory Phase 6 item 2 / ADR-129).
//
// `memory_lookup.ts`'s `_score` is a literal substring/glob scorer over
// unsplit haystack text. A curated entry's `key` field normalises separators
// to spaces (`key: ai council cli repo local only`), so a hyphen/underscore
// query (`ai_council`, `roadmap-progress`) scores 0 against EVERY entry —
// not a ranking preference, a recall defect (ADR-129 context point 1). This
// module builds a real FTS5 index (unicode61 tokenizer splits on the same
// separators on both the indexed text and the query, so the mismatch
// disappears) as a DERIVED, gitignored, disposable accelerant — JSON/YAML
// stays canonical; deleting the derived SQLite file is always safe, it
// rebuilds on the next lookup.
//
// Node < 22.5 (no `node:sqlite`) or a build failure → every public function
// here degrades to `null`/no-hits rather than throwing; `memory_lookup.ts`'s
// substring `_score` is the documented, always-available fallback.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as NodeSqlite from 'node:sqlite';
import type { DatabaseSync } from 'node:sqlite';

import {
    loadSqliteSync,
    probeFts5Sync,
    readUserVersion,
    stampUserVersion,
} from './sqlite_guard.js';
import {
    _iter_curated_entries,
    _setMemoryRoot as _reportSetMemoryRoot,
    MEMORY_ROOT as _reportMemoryRoot,
} from '../memory_report.js';

/** Versioned in the path itself (cache-invalidation lint: `-v1-`). */
export const MEMORY_INDEX_REL = path.join('agents', 'runtime', 'state', 'memory-index-v1.sqlite3');
/** Stamped via `PRAGMA user_version` on every build (road-to-reachable-code-memory Phase 7). */
export const SCHEMA_VERSION = 1;

const CURATED_STATUS_EXCLUDE: ReadonlySet<string> = new Set(['deprecated', 'archived', 'superseded']);
const INDEX_TEXT_FIELDS: readonly string[] = ['path', 'key', 'symptom', 'feature', 'rule', 'body'];

export type IndexedSource = 'curated' | 'intake';

export interface IndexedEntry {
    id: string;
    mtype: string;
    source: IndexedSource;
    path: string;
    text: string;
}

/** One FTS5-recalled candidate. `relevance` is already a positive, `>0` value. */
export interface FtsHit {
    id: string;
    mtype: string;
    source: IndexedSource;
    path: string;
    relevance: number;
}

/** Absolute index path for a consumer root (defaults to `process.cwd()`). */
export function resolveIndexPath(consumerRoot?: string | null): string {
    return path.join(consumerRoot ?? process.cwd(), MEMORY_INDEX_REL);
}

function _pyStr(v: unknown): string {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    return String(v);
}

/** Mirrors `memory_lookup.ts`'s `_entryIndexText` — the fields `_score` reads. */
function _entryIndexText(entry: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const f of INDEX_TEXT_FIELDS) {
        const v = entry[f];
        if (typeof v === 'string') parts.push(v);
        else if (Array.isArray(v)) for (const x of v) parts.push(_pyStr(x));
    }
    return parts.join(' | ');
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Curated entries across both layouts, via `memory_report.ts`'s exported
 * iterator. `memory_report` keeps its own module-level `MEMORY_ROOT`
 * (separate from `memory_lookup.ts`'s), so this repoints it for the scan and
 * restores it immediately after — the two calls are synchronous and never
 * interleaved with another caller's use of that module state.
 */
function _collectCurated(memoryRoot: string): IndexedEntry[] {
    const out: IndexedEntry[] = [];
    // `_reportMemoryRoot` is a live ESM binding — reading it here captures
    // whatever `memory_report.ts` was actually set to (its own default, or a
    // prior caller's override), so restoring it below is exact, not a guess.
    const previous = _reportMemoryRoot;
    _reportSetMemoryRoot(memoryRoot);
    try {
        for (const [file, mtype, entry] of _iter_curated_entries()) {
            const status = entry['status'];
            if (typeof status === 'string' && CURATED_STATUS_EXCLUDE.has(status)) continue;
            const id = typeof entry['id'] === 'string' ? entry['id'] : '';
            if (id === '') continue;
            out.push({ id, mtype, source: 'curated', path: file, text: _entryIndexText(entry) });
        }
    } finally {
        _reportSetMemoryRoot(previous);
    }
    return out;
}

/** Sorted `*.jsonl` file names directly under `intakeRoot` (absent dir → []). */
function _globJsonl(intakeRoot: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(intakeRoot);
    } catch {
        return [];
    }
    return names.filter((n) => n.endsWith('.jsonl')).sort().map((n) => path.join(intakeRoot, n));
}

/**
 * Intake entries, supersede-chains resolved (later `{"type":"supersede",
 * "supersedes":<id>}` lines drop the target). A self-contained twin of
 * `memory_lookup.ts`'s private `_iter_intake_entries` (kept intentionally
 * separate — that generator is per-mtype and not exported; duplicating the
 * ~20-line supersede resolution here is cheaper than coupling two modules'
 * private generators together for a build-time-only scan).
 */
function _collectIntake(intakeRoot: string): IndexedEntry[] {
    const out: IndexedEntry[] = [];
    for (const jsonl of _globJsonl(intakeRoot)) {
        const by_id = new Map<string, Record<string, unknown>>();
        const superseded = new Set<string>();
        let content: string;
        try {
            content = fs.readFileSync(jsonl, 'utf-8');
        } catch {
            continue;
        }
        for (let line of content.split(/\n/)) {
            line = line.trim();
            if (!line) continue;
            let obj: unknown;
            try {
                obj = JSON.parse(line);
            } catch {
                continue;
            }
            if (!_isPlainObject(obj)) continue;
            if (obj['type'] === 'supersede') {
                const target = obj['supersedes'];
                if (typeof target === 'string') superseded.add(target);
                continue;
            }
            const eid = obj['id'];
            if (typeof eid === 'string') by_id.set(eid, obj);
        }
        for (const [eid, obj] of by_id.entries()) {
            if (superseded.has(eid)) continue;
            const mtype = typeof obj['entry_type'] === 'string' ? obj['entry_type'] : '';
            out.push({ id: eid, mtype, source: 'intake', path: jsonl, text: _entryIndexText(obj) });
        }
    }
    return out;
}

/** All indexable entries (curated + intake) for one memory tree. */
export function collectEntries(memoryRoot: string, intakeRoot: string): IndexedEntry[] {
    return [..._collectCurated(memoryRoot), ..._collectIntake(intakeRoot)];
}

/** Newest mtime (ms) across every source file the index is built from. */
function _sourcesMaxMtimeMs(memoryRoot: string, intakeRoot: string): number {
    let max = 0;
    const bump = (p: string): void => {
        try {
            const st = fs.statSync(p);
            if (st.mtimeMs > max) max = st.mtimeMs;
        } catch {
            /* absent — ignore */
        }
    };
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.isFile() && e.name.endsWith('.yml')) bump(full);
        }
    };
    // Curated: both the flat `<type>.yml` files and the `<type>/*.yml` dirs.
    let memEntries: fs.Dirent[];
    try {
        memEntries = fs.readdirSync(memoryRoot, { withFileTypes: true });
        for (const e of memEntries) {
            const full = path.join(memoryRoot, e.name);
            if (e.isFile() && e.name.endsWith('.yml')) bump(full);
            else if (e.isDirectory()) walk(full);
        }
    } catch {
        /* memory root absent — total stays 0 */
    }
    for (const f of _globJsonl(intakeRoot)) bump(f);
    return max;
}

const META_KEY_SOURCES_MTIME = 'sources_mtime_ms';

/**
 * Whether the index at `indexPath` is missing, schema-mismatched, corrupt, or
 * stale relative to its sources. Any read failure (including a truncated /
 * corrupt file — road-to-reachable-code-memory Phase 7) counts as stale;
 * corruption is a non-event, not an error the caller has to handle.
 */
export function isStale(indexPath: string, memoryRoot: string, intakeRoot: string): boolean {
    if (!fs.existsSync(indexPath)) return true;
    let sqlite: typeof NodeSqlite;
    try {
        sqlite = loadSqliteSync('memory_fts_index.isStale');
    } catch {
        return true; // no sqlite → caller will skip building anyway
    }
    let conn: DatabaseSync | null = null;
    try {
        conn = new sqlite.DatabaseSync(indexPath, { readOnly: true });
        if (readUserVersion(conn) !== SCHEMA_VERSION) return true;
        const row = conn.prepare('SELECT value FROM _meta WHERE key = ?').get(META_KEY_SOURCES_MTIME);
        const stored = row?.['value'];
        const storedMs = typeof stored === 'string' ? Number(stored) : NaN;
        if (!Number.isFinite(storedMs)) return true;
        return _sourcesMaxMtimeMs(memoryRoot, intakeRoot) > storedMs;
    } catch {
        return true; // corrupt / unreadable → rebuild
    } finally {
        try {
            conn?.close();
        } catch {
            /* best-effort */
        }
    }
}

export interface BuildReport {
    indexPath: string;
    entriesIndexed: number;
}

/**
 * Rebuild the index from scratch (JSON/YAML is canonical — a full rebuild is
 * always correct and cheap enough for the corpus sizes this suite runs at;
 * "rebuilt batch/lazy" per the roadmap, never incremental). Deletes any
 * existing file first so a corrupt/partial index never lingers.
 */
export function buildIndex(indexPath: string, memoryRoot: string, intakeRoot: string): BuildReport {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    try {
        fs.rmSync(indexPath, { force: true });
        fs.rmSync(`${indexPath}-wal`, { force: true });
        fs.rmSync(`${indexPath}-shm`, { force: true });
    } catch {
        /* best-effort */
    }
    const { DatabaseSync } = loadSqliteSync('memory_fts_index.buildIndex');
    const conn = new DatabaseSync(indexPath);
    let count = 0;
    try {
        conn.exec('PRAGMA journal_mode=WAL');
        conn.exec(
            "CREATE VIRTUAL TABLE entries USING fts5(id UNINDEXED, mtype UNINDEXED, source UNINDEXED, path UNINDEXED, text)",
        );
        conn.exec('CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        const stmt = conn.prepare(
            'INSERT INTO entries (id, mtype, source, path, text) VALUES (?, ?, ?, ?, ?)',
        );
        for (const e of collectEntries(memoryRoot, intakeRoot)) {
            stmt.run(e.id, e.mtype, e.source, e.path, e.text);
            count += 1;
        }
        const metaStmt = conn.prepare('INSERT INTO _meta (key, value) VALUES (?, ?)');
        metaStmt.run(META_KEY_SOURCES_MTIME, String(_sourcesMaxMtimeMs(memoryRoot, intakeRoot)));
        stampUserVersion(conn, SCHEMA_VERSION);
        conn.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        conn.exec('PRAGMA journal_mode=DELETE');
    } finally {
        conn.close();
    }
    return { indexPath, entriesIndexed: count };
}

/**
 * Ensure a fresh index exists at `indexPath`, building/rebuilding it when
 * absent or stale. Returns `false` (never throws) when `node:sqlite` or FTS5
 * is unavailable, or the build itself fails — callers fall back to `_score`.
 */
export function ensureIndex(indexPath: string, memoryRoot: string, intakeRoot: string): boolean {
    if (!probeFts5Sync()) return false;
    try {
        if (isStale(indexPath, memoryRoot, intakeRoot)) {
            buildIndex(indexPath, memoryRoot, intakeRoot);
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Turn a raw query key into an FTS5 MATCH clause of separate, implicitly
 * AND'd barewords.
 *
 * FTS5's QUERY GRAMMAR (not the content tokenizer) treats an unbroken
 * hyphen/underscore run as ONE bareword — `adr-number-collision` tokenizes
 * to 6 tokens, but a single ungapped bareword is matched as an EXACT
 * ADJACENT PHRASE of those tokens, not a free AND. That reintroduces a
 * separator-shaped recall gap one layer up (a hyphenated query key with the
 * matching words in non-adjacent or reordered position in the entry text
 * would miss). Replacing every separator with a literal SPACE here forces
 * the grammar to see distinct barewords — implicit AND, any position — which
 * is the recall behaviour this index exists to provide.
 */
function _sanitizeFtsClause(key: string): string {
    // Keep letters/digits; every other character (hyphen, underscore, quote,
    // paren, colon, asterisk, ...) becomes a bareword boundary.
    return key.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Query the FTS5 index for `keys` (OR'd — any key matching is a hit),
 * optionally restricted to `types`. Never throws — a MATCH syntax error or a
 * read failure resolves to `[]`, the caller's cue to stay on `_score`.
 */
export function queryIndex(
    indexPath: string,
    keys: readonly string[],
    types: readonly string[],
): FtsHit[] {
    const clauses = keys.map(_sanitizeFtsClause).filter((c) => c.length > 0);
    if (clauses.length === 0) return [];
    let sqlite: typeof NodeSqlite;
    try {
        sqlite = loadSqliteSync('memory_fts_index.queryIndex');
    } catch {
        return [];
    }
    let conn: DatabaseSync | null = null;
    try {
        conn = new sqlite.DatabaseSync(indexPath, { readOnly: true });
        const matchQuery = clauses.map((c) => `(${c})`).join(' OR ');
        const typeFilter = types.length > 0 ? `AND mtype IN (${types.map(() => '?').join(',')})` : '';
        const rows = conn
            .prepare(
                `SELECT id, mtype, source, path, bm25(entries) AS score
                 FROM entries
                 WHERE entries MATCH ? ${typeFilter}
                 ORDER BY score ASC`,
            )
            .all(matchQuery, ...types);
        return rows.map((r) => {
            // bm25(): more negative is a better match. Flip to a positive
            // "relevance" so the caller's ranking math reads naturally.
            const bm25 = typeof r['score'] === 'number' ? r['score'] : Number(r['score'] ?? 0);
            return {
                id: String(r['id']),
                mtype: String(r['mtype']),
                source: (r['source'] as IndexedSource) ?? 'curated',
                path: String(r['path']),
                relevance: Math.max(0, -bm25),
            };
        });
    } catch {
        return [];
    } finally {
        try {
            conn?.close();
        } catch {
            /* best-effort */
        }
    }
}
