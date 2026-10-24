/**
 * The estate index: a small, local, user-global table of what each registered
 * project declares, publishes and exports (ADR-299, Phase 4). Never a merged
 * graph — it stores package names, top-level symbol names and the names a
 * project references but does not resolve, and the cross-project edges derived
 * from them. Off by default (council O1): with the registry switch off nothing
 * here runs and no file is written.
 *
 * `runtime/projects/index.sqlite3`. A project's rows are replaced, never
 * appended, on its next refresh. Edges are labelled by how they are known:
 *
 *   package      A declares a dependency on a package B publishes — a stated fact
 *   unique-name  A references a name exactly one estate symbol declares — a guess
 *   mention      A references B's name without declaring it — a guess
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { readRegistry, registryDir, type RegistryOptions } from '../_lib/project_registry.js';
import { isSqliteAvailableSync, loadSqliteSync } from '../_lib/sqlite_guard.js';
import { isTestFile } from './build.js';
import { type ManifestFacts, manifestFacts } from './estate_manifests.js';
import { twinIsCurrent, sqliteTwinPath } from './sqlite_store.js';
import type { CodeGraph } from './types.js';

export type XVia = 'package' | 'unique-name' | 'mention';

export interface GraphFacts {
    exports: Array<{ name: string; kind: string }>;
    imports: Array<{ package: string; uses: number }>;
    refs: string[];
}

export interface XEdge {
    source: string;
    target: string;
    via: XVia;
    detail: string;
}

/** Stored as their index here: a kind name per row would be most of an export row's bytes. */
const KINDS = ['class', 'interface', 'trait', 'function', 'constant', 'type', 'enum'] as const;
const EXPORT_KINDS: ReadonlySet<string> = new Set(KINDS);

export function indexPath(opts: RegistryOptions = {}): string {
    return path.join(registryDir(opts), 'index.sqlite3');
}

/**
 * Top-level declarations outside test files. The graph records no
 * exportedness (`dead` refuses for the same reason), so a top-level symbol is
 * the closest stated fact; a member (`A::m`) never counts.
 */
function isTopLevel(id: string, kind: string, file: string): boolean {
    return EXPORT_KINDS.has(kind) && !id.includes('::') && id.split('#').length === 2 && !isTestFile(file);
}

function factsFrom(
    nodes: Iterable<{ id: string; label: string; kind: string | null; source_file: string | null }>,
    targets: Iterable<string>,
): GraphFacts {
    const exports = new Map<string, { name: string; kind: string }>();
    for (const n of nodes) {
        if (n.kind && isTopLevel(n.id, n.kind, n.source_file ?? '')) exports.set(n.id, { name: n.label, kind: n.kind });
    }
    const imports = new Map<string, number>();
    const refs = new Set<string>();
    for (const t of targets) {
        if (t.startsWith('external:')) {
            const hash = t.indexOf('#');
            const pkg = t.slice('external:'.length, hash < 0 ? undefined : hash);
            if (pkg) imports.set(pkg, (imports.get(pkg) ?? 0) + 1);
        } else if (t.startsWith('symbol:')) {
            refs.add(t.slice('symbol:'.length));
        }
    }
    return {
        exports: [...exports.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
        imports: [...imports.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, uses]) => ({ package: p, uses })),
        refs: [...refs].sort(),
    };
}

/**
 * The graph facts of one cache: from the graph in hand, else from its current
 * SQLite twin (two indexed column reads), else by parsing the JSON.
 */
export function graphFacts(cachePath: string, graph: CodeGraph | null = null): GraphFacts | null {
    if (graph) {
        return factsFrom(
            graph.nodes.map((n) => ({ id: n.id, label: n.label, kind: n.kind, source_file: n.source_file })),
            graph.edges.map((e) => e.target),
        );
    }
    if (twinIsCurrent(cachePath)) {
        try {
            const { DatabaseSync } = loadSqliteSync('code_graph.estate_index');
            const db = new DatabaseSync(sqliteTwinPath(cachePath), { readOnly: true });
            try {
                const nodes = db.prepare('SELECT id, label, kind, source_file FROM nodes').all() as Array<{
                    id: string;
                    label: string;
                    kind: string | null;
                    source_file: string | null;
                }>;
                const targets = (
                    db.prepare("SELECT target FROM edges WHERE target LIKE 'external:%' OR target LIKE 'symbol:%'").all() as Array<{ target: string }>
                ).map((r) => r.target);
                return factsFrom(nodes, targets);
            } finally {
                db.close();
            }
        } catch {
            /* fall through to the JSON */
        }
    }
    try {
        return graphFacts(cachePath, JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CodeGraph);
    } catch {
        return null;
    }
}

// Rows reference a project by its integer `key`, not its 12-hex id: the id
// repeated on every export row was a third of the file (measured on the 4.4
// fixture estate), and the size budget is 2 % of the graphs summarised.
const SCHEMA =
    'CREATE TABLE IF NOT EXISTS projects (key INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, root TEXT NOT NULL, indexed_at TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS declares (project INTEGER NOT NULL, ecosystem TEXT NOT NULL, package TEXT NOT NULL, manifest TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS publishes (project INTEGER NOT NULL, ecosystem TEXT NOT NULL, package TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS exports (project INTEGER NOT NULL, kind INTEGER NOT NULL, name TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS imports (project INTEGER NOT NULL, package TEXT NOT NULL, uses INTEGER NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS refs (project INTEGER NOT NULL, name TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS xedges (source INTEGER NOT NULL, target INTEGER NOT NULL, via TEXT NOT NULL, detail TEXT NOT NULL);';

const PER_PROJECT = ['declares', 'publishes', 'exports', 'imports', 'refs'];

/** Rebuild `xedges` from the per-project rows; a package edge suppresses both guesses for its pair. */
const XEDGES_SQL =
    'DELETE FROM xedges;' +
    "INSERT INTO xedges SELECT DISTINCT d.project, p.project, 'package', d.package FROM declares d " +
    'JOIN publishes p ON p.package = d.package AND p.ecosystem = d.ecosystem WHERE d.project <> p.project;' +
    "INSERT INTO xedges SELECT DISTINCT r.project, e.project, 'unique-name', r.name FROM refs r JOIN exports e ON e.name = r.name " +
    'WHERE e.project <> r.project AND r.name IN (SELECT name FROM exports GROUP BY name HAVING COUNT(*) = 1) ' +
    "AND NOT EXISTS (SELECT 1 FROM xedges x WHERE x.source = r.project AND x.target = e.project AND x.via = 'package');" +
    "INSERT INTO xedges SELECT DISTINCT m.project, p.key, 'mention', m.name FROM " +
    '(SELECT project, name FROM refs UNION SELECT project, package FROM imports) m JOIN projects p ON lower(p.name) = lower(m.name) ' +
    "WHERE p.key <> m.project AND NOT EXISTS (SELECT 1 FROM xedges x WHERE x.source = m.project AND x.target = p.key AND x.via = 'package');";

type Db = InstanceType<ReturnType<typeof loadSqliteSync>['DatabaseSync']>;

function openWritable(opts: RegistryOptions): Db {
    const file = indexPath(opts);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const { DatabaseSync } = loadSqliteSync('code_graph.estate_index');
    const fresh = !fs.existsSync(file);
    const db = new DatabaseSync(file);
    // Small pages: the index holds names only, and its size budget (4.4) is
    // measured against the project graphs it summarises.
    if (fresh) db.exec('PRAGMA page_size = 1024');
    db.exec('PRAGMA busy_timeout = 2000');
    db.exec(SCHEMA);
    return db;
}

/** Replace one project's rows and re-derive the cross-project edges. */
export function writeProjectRows(
    id: string,
    root: string,
    facts: ManifestFacts & GraphFacts,
    opts: RegistryOptions = {},
): void {
    const db = openWritable(opts);
    try {
        db.exec('BEGIN IMMEDIATE');
        try {
            db.prepare(
                'INSERT INTO projects (id, name, root, indexed_at) VALUES (?, ?, ?, ?) ' +
                    'ON CONFLICT(id) DO UPDATE SET name = excluded.name, root = excluded.root, indexed_at = excluded.indexed_at',
            ).run(id, path.basename(root), root, (opts.now ?? new Date()).toISOString());
            const key = (db.prepare('SELECT key FROM projects WHERE id = ?').get(id) as { key: number }).key;
            for (const t of PER_PROJECT) db.prepare(`DELETE FROM ${t} WHERE project = ?`).run(key);
            const dec = db.prepare('INSERT INTO declares VALUES (?, ?, ?, ?)');
            for (const d of facts.declares) dec.run(key, d.ecosystem, d.package, d.manifest);
            const pub = db.prepare('INSERT INTO publishes VALUES (?, ?, ?)');
            for (const p of facts.publishes) pub.run(key, p.ecosystem, p.package);
            const exp = db.prepare('INSERT INTO exports VALUES (?, ?, ?)');
            for (const e of facts.exports) exp.run(key, KINDS.indexOf(e.kind as (typeof KINDS)[number]), e.name);
            const imp = db.prepare('INSERT INTO imports VALUES (?, ?, ?)');
            for (const i of facts.imports) imp.run(key, i.package, i.uses);
            const ref = db.prepare('INSERT INTO refs VALUES (?, ?)');
            for (const r of facts.refs) ref.run(key, r);
            db.exec(XEDGES_SQL);
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
        db.exec('VACUUM');
    } finally {
        db.close();
    }
}

/** Remove a project from the index (a `projects remove` / `prune`). */
export function dropProjectRows(id: string, opts: RegistryOptions = {}): void {
    if (!fs.existsSync(indexPath(opts)) || !isSqliteAvailableSync()) return;
    const db = openWritable(opts);
    try {
        const row = db.prepare('SELECT key FROM projects WHERE id = ?').get(id) as { key: number } | undefined;
        if (row) {
            for (const t of PER_PROJECT) db.prepare(`DELETE FROM ${t} WHERE project = ?`).run(row.key);
            db.prepare('DELETE FROM projects WHERE key = ?').run(row.key);
            db.exec(XEDGES_SQL);
            db.exec('VACUUM');
        }
    } finally {
        db.close();
    }
}

/**
 * The refresh hook: index `root` when the owner switched the index on. Returns
 * whether rows were written. Never throws — the index is a convenience and a
 * failure to write it never fails a refresh.
 */
export function indexAfterRefresh(id: string, root: string, cachePath: string, graph: CodeGraph | null, opts: RegistryOptions = {}): boolean {
    try {
        if (!readRegistry(opts).index || !isSqliteAvailableSync()) return false;
        const g = graphFacts(cachePath, graph);
        if (!g) return false;
        writeProjectRows(id, root, { ...manifestFacts(root), ...g }, opts);
        return true;
    } catch {
        return false;
    }
}

/** A read-only view of the index; `null` when there is none. */
export function openEstate(opts: RegistryOptions = {}): EstateReader | null {
    const file = indexPath(opts);
    if (!fs.existsSync(file) || !isSqliteAvailableSync()) return null;
    const { DatabaseSync } = loadSqliteSync('code_graph.estate_index');
    return new EstateReader(new DatabaseSync(file, { readOnly: true }));
}

export class EstateReader {
    constructor(private readonly db: Db) {}

    close(): void {
        this.db.close();
    }

    projects(): Array<{ id: string; name: string; root: string; indexed_at: string }> {
        return this.db.prepare('SELECT id, name, root, indexed_at FROM projects ORDER BY name, id').all() as Array<{
            id: string;
            name: string;
            root: string;
            indexed_at: string;
        }>;
    }

    xedges(): XEdge[] {
        return this.db
            .prepare(
                'SELECT s.id AS source, t.id AS target, x.via, x.detail FROM xedges x JOIN projects s ON s.key = x.source ' +
                    'JOIN projects t ON t.key = x.target ORDER BY s.id, t.id, x.via, x.detail',
            )
            .all() as unknown as XEdge[];
    }

    /** One project's rows of one table, with the project named by its id and an export's kind by name. */
    rows(table: 'declares' | 'publishes' | 'exports' | 'imports' | 'refs', project: string): Array<Record<string, unknown>> {
        const rows = this.db
            .prepare(`SELECT r.* FROM ${table} r JOIN projects p ON p.key = r.project WHERE p.id = ? ORDER BY 2, 3`)
            .all(project) as Array<Record<string, unknown>>;
        return rows.map((r) => ({
            ...r,
            project,
            ...(table === 'exports' ? { kind: KINDS[r['kind'] as number] ?? 'unknown' } : {}),
        }));
    }

    /** Projects that declare `pkg` (any ecosystem) or import it in code. */
    projectsUsing(pkg: string): Array<{ id: string; name: string; root: string; declared_in: string[]; imports: number }> {
        const rows = this.db
            .prepare(
                'SELECT p.id, p.name, p.root, ' +
                    "(SELECT group_concat(manifest, char(10)) FROM (SELECT DISTINCT manifest FROM declares WHERE project = p.key AND package = ?)) AS declared_in, " +
                    '(SELECT COALESCE(SUM(uses), 0) FROM imports WHERE project = p.key AND package = ?) AS imports ' +
                    'FROM projects p WHERE EXISTS (SELECT 1 FROM declares WHERE project = p.key AND package = ?) ' +
                    'OR EXISTS (SELECT 1 FROM imports WHERE project = p.key AND package = ?) ORDER BY p.name, p.id',
            )
            .all(pkg, pkg, pkg, pkg) as Array<{ id: string; name: string; root: string; declared_in: string | null; imports: number }>;
        return rows.map((r) => ({ ...r, declared_in: r.declared_in ? r.declared_in.split('\n').sort() : [], imports: Number(r.imports) }));
    }

    /** Projects that reference `name` without resolving it — candidates for a symbol another project declares. */
    referrers(name: string): Array<{ id: string; name: string; root: string }> {
        return this.db
            .prepare('SELECT DISTINCT p.id, p.name, p.root FROM refs r JOIN projects p ON p.key = r.project WHERE r.name = ? ORDER BY p.name, p.id')
            .all(name) as Array<{ id: string; name: string; root: string }>;
    }

    /** Projects that publish package `pkg`. */
    publishers(pkg: string): Array<{ id: string; name: string; root: string; ecosystem: string }> {
        return this.db
            .prepare('SELECT DISTINCT p.id, p.name, p.root, b.ecosystem FROM publishes b JOIN projects p ON p.key = b.project WHERE b.package = ? ORDER BY p.name, p.id')
            .all(pkg) as Array<{ id: string; name: string; root: string; ecosystem: string }>;
    }

    /** Projects that declare a top-level symbol named `name`. */
    exporters(name: string): Array<{ id: string; name: string; root: string; kind: string }> {
        const rows = this.db
            .prepare('SELECT p.id, p.name, p.root, e.kind FROM exports e JOIN projects p ON p.key = e.project WHERE e.name = ? ORDER BY p.name, p.id')
            .all(name) as Array<{ id: string; name: string; root: string; kind: number }>;
        return rows.map((r) => ({ ...r, kind: KINDS[r.kind] ?? 'unknown' }));
    }
}
