/**
 * Data lane: what the schema facts of the code graph need beside the
 * migrations, read from files only — never from a database.
 *
 * The graph's own schema facts (T1) come from replaying migrations and SQL
 * schema files. This reader adds, on the source ladder:
 *
 *   T2  committed dumps the graph does not replay: `database/schema/*.sql`
 *       (`schema:dump`) and any committed `.sql` file headed as a `mysqldump`
 *       or `pg_dump` output. A table the migrations already define keeps its
 *       migration facts; a dump only adds what nothing else creates.
 *   T3  a schema-only snapshot the user produced and saved under
 *       `agents/map/data/snapshot/<connection>.sql` (`pg_dump --schema-only`,
 *       `mysqldump --no-data`; `default.sql` is the default connection).
 *   T4  framework oracle output saved under `agents/map/data/oracle/*.json`
 *       (`php artisan model:show <Model> --json`, one file per model).
 *
 * T3 and T4 are the ACTUAL schema; they become `table` / `column` facts whose
 * ids end in `@actual` / `@oracle`, so drift can set intended against actual.
 *
 * It also emits one `connection` fact per connection (engine, completeness,
 * whether the project declared it keyless) and annotates existing facts with
 * what the drift rules need: the table a relation key points into, soft
 * deletes, model delete hooks, redundant indexes, a key added before its
 * target table exists, a column whose name implies a key. The engine of a
 * connection the project does not state comes from the runtime lane's database
 * service when there is exactly one.
 *
 * Declarations the user writes in `agents/map/data/declarations.json`:
 * `{ "fk_mode": { "<connection>": "none" }, "virtual_relations":
 * [{ "subject": "column:comments.post_id", "reason": "…" }] }` — a keyless
 * connection exempts DR-1, a virtual relation is a waiver with its reason.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { laravelEngines } from '../../../_lib/schema/readers/laravel_migrations.js';
import { readSqlSchema } from '../../../_lib/schema/readers/sql_ddl.js';
import { type Engine, replay } from '../../../_lib/schema/replay.js';
import type { Waiver } from '../../drift.js';
import { isFixturePath } from '../../fixture_paths.js';
import { queryLinks } from './query_links.js';
import { isSqlSchemaPath } from '../../providers/sql_ddl.js';
import { columnId, tableId } from '../../providers/shared/schema_graph.js';
import type { CodeGraph, CodeNode } from '../../types.js';
import { spanHash, type LaneAnnotation, type LaneFact, type LaneOutput, type LaneRelation, type SourceRung, type Witness } from '../lane_fact.js';

export const SNAPSHOT_DIR = 'agents/map/data/snapshot';
export const ORACLE_DIR = 'agents/map/data/oracle';
export const DECLARATIONS_FILE = 'agents/map/data/declarations.json';

export interface DataLaneOutput extends LaneOutput {
    lane: 'data';
    annotations: LaneAnnotation[];
    /** Declared virtual relations and keyless connections, as waivers with their reason. */
    waivers: Waiver[];
    /** The actual-schema sources read, by rung. */
    actual: Array<{ rung: SourceRung; file: string }>;
}

export interface ReadDataOptions {
    /** The runtime lane's output, for the engine of a connection the project does not state. */
    runtime?: LaneOutput;
}

type Attrs = LaneFact['attrs'];

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.tscache', 'coverage']);
const SCHEMA_SOURCE = /(?:^|\/)(?:migrations?|migrate)\/|(?:^|\/)(?:schema|structure)\.sql$|\.prisma$/i;
const DUMP_HEAD = /^--\s*(?:MySQL dump|MariaDB dump|PostgreSQL database dump)|mysqldump|pg_dump/im;

function posix(rel: string): string {
    return rel.split(path.sep).join('/');
}

function sqlFiles(root: string, cap = 5000): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        if (out.length >= cap) return;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.isDirectory()) {
                if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name));
            } else if (e.isFile() && e.name.toLowerCase().endsWith('.sql')) out.push(posix(path.relative(root, path.join(dir, e.name))));
        }
    };
    walk(root);
    return out.sort();
}

function read(root: string, rel: string): string | null {
    try {
        return fs.readFileSync(path.join(root, rel), 'utf-8');
    } catch {
        return null;
    }
}

/** The witness of the first line in `text` matching `re`, or of line 1. */
function lineWitness(file: string, text: string, re?: RegExp): Witness {
    const lines = text.split('\n');
    const i = re ? lines.findIndex((l) => re.test(l)) : -1;
    const at = i < 0 ? 0 : i;
    return { file, line: at + 1, hash: spanHash((lines[at] ?? '').trim()) };
}

const ref = (w: Witness): string => `${w.file}:${w.line}:${w.hash}`;

/** Coarse type family, so a migration's `varchar` and a dump's `character varying(255)` compare equal. */
export function typeFamily(type: string): string {
    const t = type.toLowerCase().replace(/\bunsigned\b|\bzerofill\b/g, '').trim();
    if (/^tinyint\s*\(\s*1\s*\)|^bool/.test(t)) return 'bool';
    if (/^(bigint|int8|bigserial|serial8)\b/.test(t)) return 'int64';
    if (/^(smallint|int2|smallserial)\b/.test(t)) return 'int16';
    if (/^tinyint\b/.test(t)) return 'int8';
    if (/^(int|integer|int4|mediumint|serial)\b/.test(t)) return 'int32';
    if (/^(decimal|numeric|money)\b/.test(t)) return 'decimal';
    if (/^(float|double|real)\b/.test(t)) return 'float';
    if (/^(timestamp|datetime)/.test(t)) return 'timestamp';
    if (/^date\b/.test(t)) return 'date';
    if (/^time\b/.test(t)) return 'time';
    if (/^jsonb?\b/.test(t)) return 'json';
    if (/^uuid\b/.test(t)) return 'uuid';
    if (/^(varchar|character|char|text|tinytext|mediumtext|longtext|string|citext|enum|set)\b/.test(t)) return 'string';
    if (/^(blob|bytea|binary|varbinary|longblob)\b/.test(t)) return 'binary';
    return t.replace(/\s*\(.*$/, '');
}

const RUNTIME_ENGINE: Record<string, Engine> = { postgres: 'pgsql', mysql: 'mysql', mariadb: 'mariadb', sqlserver: 'sqlsrv', sqlite: 'sqlite' };

/** A table name with its schema qualifier dropped (`public.posts` → `posts`). */
const bareTable = (name: string): string => name.split('.').pop() ?? name;

interface ActualTable {
    connection: string;
    name: string;
    witness: Witness;
    columns: Array<{ name: string; type: string; nullable: boolean; witness: Witness }>;
}

function actualFromSql(file: string, text: string, connection: string): { tables: ActualTable[]; engine: Engine } {
    const read = readSqlSchema([{ path: file, source: text }]);
    const ops = read.ops.map((op) => ('table' in op && typeof op.table === 'string' ? { ...op, table: bareTable(op.table), connection } : { ...op, connection }));
    const model = replay({ ops: ops as typeof read.ops });
    const tables: ActualTable[] = [];
    for (const c of model.connections) {
        for (const t of c.tables) {
            tables.push({
                connection,
                name: t.name,
                witness: { ...t.at },
                columns: t.columns.map((col) => ({ name: col.name, type: col.type, nullable: col.nullable, witness: { ...col.at } })),
            });
        }
    }
    return { tables, engine: read.engine };
}

interface OracleModel {
    class?: string;
    database?: string;
    table?: string;
    attributes?: Array<{ name?: string; type?: string | null; nullable?: boolean; appended?: unknown }>;
    observers?: Array<{ event?: string; observer?: unknown }>;
}

function actualFromOracle(file: string, text: string, defaultName: string | null): { table: ActualTable | null; hooks: Witness | null; model: string | null } {
    let doc: OracleModel;
    try {
        doc = JSON.parse(text) as OracleModel;
    } catch {
        return { table: null, hooks: null, model: null };
    }
    if (typeof doc.table !== 'string' || doc.table === '') return { table: null, hooks: null, model: null };
    const tableName = doc.table;
    const columns: ActualTable['columns'] = [];
    for (const a of doc.attributes ?? []) {
        if (typeof a.name !== 'string' || typeof a.type !== 'string' || a.appended) continue;
        const name = a.name;
        columns.push({ name, type: a.type, nullable: a.nullable === true, witness: lineWitness(file, text, new RegExp(`"name"\\s*:\\s*"${name.replace(/[^\w]/g, '')}"`)) });
    }
    const hook = (doc.observers ?? []).find((o) => o.event === 'deleting' || o.event === 'deleted');
    return {
        table: { connection: !doc.database || doc.database === 'default' || doc.database === defaultName ? '' : doc.database, name: tableName, witness: lineWitness(file, text, /"table"\s*:/), columns },
        hooks: hook ? lineWitness(file, text, new RegExp(`"event"\\s*:\\s*"${hook.event ?? ''}"`)) : null,
        model: typeof doc.class === 'string' ? doc.class : null,
    };
}

interface Declarations {
    fk_mode?: Record<string, string>;
    virtual_relations?: Array<{ rule?: string; subject?: string; reason?: string }>;
}

/** Leading-prefix and duplicate indexes of one table, from the graph's `indexes` and `primary_key` attributes. */
export function redundantIndexes(indexes: readonly string[], primaryKey: readonly string[]): string[] {
    const parsed = indexes
        .map((s) => /^(.*)\(([^)]*)\)(\s+unique)?$/.exec(s))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => ({ name: m[1] as string, cols: (m[2] as string).split(',').filter(Boolean), unique: Boolean(m[3]) }));
    const all = [...parsed, ...(primaryKey.length ? [{ name: 'primary key', cols: [...primaryKey], unique: true }] : [])];
    const out: string[] = [];
    for (const a of parsed) {
        if (a.unique) continue;
        const cover = all.find((b) => b !== a && b.cols.length >= a.cols.length && a.cols.every((c, i) => b.cols[i] === c) && (b.cols.length > a.cols.length || b.name < a.name || b.unique));
        if (cover) out.push(`${a.name}(${a.cols.join(',')}) is a leading prefix of ${cover.name}(${cover.cols.join(',')})`);
    }
    return out;
}

const stemCandidates = (stem: string): string[] => [`${stem}s`, `${stem}es`, stem.endsWith('y') ? `${stem.slice(0, -1)}ies` : '', stem].filter(Boolean);

function waiversOf(declared: Declarations): { waivers: Waiver[]; refused: string[] } {
    const waivers: Waiver[] = [];
    const refused: string[] = [];
    for (const v of declared.virtual_relations ?? []) {
        if (typeof v.subject !== 'string' || typeof v.reason !== 'string' || v.reason.trim() === '') {
            refused.push(`virtual relation ${String(v.subject)} needs a subject and a non-empty reason`);
            continue;
        }
        waivers.push({ rule: v.rule ?? 'DR-1', subject: v.subject, reason: `declared virtual relation: ${v.reason.trim()}` });
    }
    return { waivers, refused };
}

/** The waivers the user declared, for a caller holding a graph the lane already merged into. */
export function readDeclaredWaivers(root: string): Waiver[] {
    const text = read(root, DECLARATIONS_FILE);
    if (text === null) return [];
    try {
        return waiversOf(JSON.parse(text) as Declarations).waivers;
    } catch {
        return [];
    }
}

export function readData(root: string, graph: CodeGraph, opts: ReadDataOptions = {}): DataLaneOutput {
    const out: DataLaneOutput = { lane: 'data', facts: [], relations: [], skipped: [], annotations: [], waivers: [], actual: [] };
    const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
    const outE = new Map<string, CodeGraph['edges']>();
    const inE = new Map<string, CodeGraph['edges']>();
    for (const e of graph.edges) {
        outE.set(e.source, [...(outE.get(e.source) ?? []), e]);
        inE.set(e.target, [...(inE.get(e.target) ?? []), e]);
    }
    const tables = graph.nodes.filter((n) => n.kind === 'table' && n.fact);
    const connOf = (t: CodeNode): string => String(t.fact?.attrs?.['connection'] ?? 'default');
    const tableOfColumn = (id: string): CodeNode | undefined => {
        const m = (inE.get(id) ?? []).find((e) => e.relation === 'member' && byId.get(e.source)?.kind === 'table');
        return m ? byId.get(m.source) : undefined;
    };
    const persisted = (cls: string): CodeNode | undefined => {
        const e = (outE.get(cls) ?? []).find((x) => x.relation === 'persists');
        return e ? byId.get(e.target) : undefined;
    };
    const annotations = new Map<string, Attrs>();
    const annotate = (id: string, attrs: Attrs): void => {
        if (!byId.get(id)?.fact) return;
        annotations.set(id, { ...(annotations.get(id) ?? {}), ...attrs });
    };
    const declared: Declarations = (() => {
        const text = read(root, DECLARATIONS_FILE);
        if (text === null) return {};
        try {
            return JSON.parse(text) as Declarations;
        } catch (e) {
            out.skipped.push({ file: DECLARATIONS_FILE, reason: `not valid JSON: ${(e as Error).message}` });
            return {};
        }
    })();

    // Columns the code joins on in a query: both sides carry the pair and where it was read.
    const CODE_FILE = /\.(?:php|ts|tsx|js|jsx|mjs|cjs|py|rb|go|java|kt|cs|sql)$/;
    const columnsOf = new Map<string, Map<string, string>>();
    for (const t of tables) {
        const cols = columnsOf.get(t.label) ?? new Map<string, string>();
        for (const e of outE.get(t.id) ?? []) {
            const c = byId.get(e.target);
            if (e.relation === 'member' && c?.kind === 'column') cols.set(c.label.slice(t.label.length + 1), c.id);
        }
        columnsOf.set(t.label, cols);
    }
    const codeFiles = graph.nodes
        .filter((n) => n.kind === 'file' && CODE_FILE.test(n.source_file) && !SCHEMA_SOURCE.test(n.source_file) && !isFixturePath(n.source_file))
        .map((n) => ({ path: n.source_file, text: read(root, n.source_file) ?? '' }))
        .filter((f) => /join|\bON\b|WHERE/i.test(f.text));
    const joined = new Map<string, string[]>();
    for (const l of queryLinks(codeFiles, (t, c) => columnsOf.get(t)?.get(c))) {
        for (const [from, to] of [[l.a, l.b], [l.b, l.a]] as const) joined.set(from, [...(joined.get(from) ?? []), `${to} ${ref(l.witness)}`]);
    }
    for (const [id, links] of joined) annotate(id, { 'data:query_links': [...new Set(links)].sort() });

    // Relation keys: which table a key column points into, and whether across connections.
    for (const e of graph.edges) {
        if (e.relation !== 'uses' || e.resolved_via !== 'orm-relation' || byId.get(e.target)?.kind !== 'column') continue;
        const col = byId.get(e.target)!;
        const colTable = tableOfColumn(col.id);
        const rel = (outE.get(e.source) ?? []).find((x) => x.relation === 'relates');
        const related = rel ? persisted(rel.target) : undefined;
        const ownerClass = (inE.get(e.source) ?? []).find((x) => x.relation === 'member' && byId.get(x.source)?.kind === 'class');
        const ownTable = ownerClass ? persisted(ownerClass.source) : undefined;
        if (!colTable) continue;
        const refTable = related && related.id !== colTable.id ? related : ownTable && ownTable.id !== colTable.id ? ownTable : undefined;
        const column = col.label.slice(colTable.label.length + 1);
        annotate(col.id, {
            'data:table': colTable.label,
            'data:column': column,
            ...(refTable
                ? {
                      'data:ref_table': refTable.label,
                      'data:ref_column': String((refTable.fact?.attrs?.['primary_key'] as string[] | undefined)?.[0] ?? 'id'),
                      'data:cross_connection': connOf(refTable) !== connOf(colTable),
                  }
                : {}),
        });
    }
    // Foreign keys: names for the fix text, and a key added before its target table exists.
    for (const e of graph.edges) {
        if (e.relation !== 'references' || byId.get(e.source)?.kind !== 'column') continue;
        const src = byId.get(e.source)!;
        const srcTable = tableOfColumn(src.id);
        const target = byId.get(e.target);
        const targetTable = target ? tableOfColumn(target.id) : undefined;
        if (!srcTable) continue;
        const attrs: Attrs = { 'data:table': srcTable.label, 'data:column': src.label.slice(srcTable.label.length + 1) };
        const fkFile = e.fact?.witness.file;
        const created = targetTable?.fact?.witness;
        if (fkFile && created && fkFile !== created.file && path.posix.basename(fkFile) < path.posix.basename(created.file) && path.posix.dirname(fkFile) === path.posix.dirname(created.file)) {
            attrs['data:fk_before_target'] = `${created.file}:${created.line}`;
        }
        annotate(src.id, attrs);
    }

    // Tables: soft deletes, model delete hooks, redundant indexes, implied keys.
    const observerMethods = new Map<string, CodeNode>();
    for (const n of graph.nodes) {
        const m = /([A-Za-z_]\w*)Observer::(deleting|deleted)$/.exec(n.id);
        if (n.kind === 'method' && m) observerMethods.set(m[1] as string, n);
    }
    const hookRe = /(?:static|self)::(?:deleting|deleted|forceDeleting|forceDeleted)\s*\(|['"](?:deleting|deleted)['"]\s*=>/;
    for (const t of tables) {
        const attrs: Attrs = {};
        const members = (outE.get(t.id) ?? []).filter((e) => e.relation === 'member').map((e) => byId.get(e.target)).filter((c): c is CodeNode => c?.kind === 'column');
        const deletedAt = members.find((c) => c.label.endsWith('.deleted_at'));
        const models = (inE.get(t.id) ?? []).filter((e) => e.relation === 'persists').map((e) => byId.get(e.source)).filter((m): m is CodeNode => m !== undefined);
        for (const m of models) {
            const text = read(root, m.source_file);
            if (text === null) continue;
            if (/\buse\s+SoftDeletes\b|\bSoftDeletes\s*[,;]/.test(text)) attrs['data:soft_deletes'] = ref(lineWitness(m.source_file, text, /\bSoftDeletes\b/));
            if (hookRe.test(text)) attrs['data:delete_hooks'] = ref(lineWitness(m.source_file, text, hookRe));
            const observer = observerMethods.get(m.label);
            if (observer && attrs['data:delete_hooks'] === undefined) {
                const otext = read(root, observer.source_file);
                if (otext) attrs['data:delete_hooks'] = ref(lineWitness(observer.source_file, otext, /function\s+(deleting|deleted)\s*\(/));
            }
        }
        if (attrs['data:soft_deletes'] === undefined && deletedAt?.fact) attrs['data:soft_deletes'] = ref(deletedAt.fact.witness);
        const redundant = redundantIndexes((t.fact?.attrs?.['indexes'] as string[] | undefined) ?? [], (t.fact?.attrs?.['primary_key'] as string[] | undefined) ?? []);
        if (redundant.length) attrs['data:redundant_indexes'] = redundant;
        if (Object.keys(attrs).length) annotate(t.id, attrs);

        const prefix = t.id.slice(0, t.id.length - t.label.length);
        for (const c of members) {
            const name = c.label.slice(t.label.length + 1);
            const m = /^(\w+)_id$/.exec(name);
            if (!m || c.fact?.attrs?.['primary'] === true) continue;
            if ((outE.get(c.id) ?? []).some((e) => e.relation === 'references')) continue;
            if ((inE.get(c.id) ?? []).some((e) => e.relation === 'uses') || joined.has(c.id)) continue;
            const target = stemCandidates(m[1] as string).map((s) => `${prefix}${s}`).find((id) => id !== t.id && byId.get(id)?.kind === 'table');
            if (target) annotate(c.id, { 'data:implied_target': target });
        }
    }

    // Schema sources in a test, fixture or benchmark tree are never the project's
    // data model: no provider replays them and no dump below is read from there.
    const fixtureSchema = new Set<string>();
    for (const n of graph.nodes) if (n.kind === 'file' && SCHEMA_SOURCE.test(n.source_file) && isFixturePath(n.source_file)) fixtureSchema.add(n.source_file);
    const sqlAll = sqlFiles(root);
    for (const f of sqlAll) if (isFixturePath(f) && !f.startsWith('agents/')) fixtureSchema.add(f);
    if (fixtureSchema.size > 0) out.skipped.push({ file: '.', reason: `${fixtureSchema.size} schema file(s) under test, fixture or benchmark trees not read as this project's data model` });

    // T2: committed dumps nothing else replays.
    for (const file of sqlAll) {
        if (isSqlSchemaPath(file) || isFixturePath(file) || file.startsWith('agents/')) continue;
        const text = read(root, file);
        if (text === null) continue;
        const isDump = /^database\/schema\/[^/]+\.sql$/.test(file) || DUMP_HEAD.test(text.slice(0, 2048));
        if (!isDump) continue;
        if (/^\s*INSERT\s+INTO/im.test(text)) {
            out.skipped.push({ file, reason: 'dump holds data rows; only a schema-only dump is read' });
            continue;
        }
        const { tables: dumped } = actualFromSql(file, text, '');
        for (const t of dumped) {
            const tid = tableId('', t.name);
            if (byId.has(tid)) continue;
            out.facts.push({ kind: 'table', id: tid, name: t.name, attrs: { connection: 'default', engine: null, completeness: 'partial', source: file }, witness: t.witness, rung: 'T2', owner: file });
            for (const col of t.columns) {
                const cid = columnId('', t.name, col.name);
                out.facts.push({ kind: 'column', id: cid, name: `${t.name}.${col.name}`, attrs: { type: col.type, nullable: col.nullable, 'data:type_family': typeFamily(col.type) }, witness: col.witness, rung: 'T2', owner: file });
                out.relations.push({ relation: 'member', from: tid, to: cid, attrs: {}, witness: col.witness, rung: 'T2', owner: file, guess: false });
            }
        }
    }

    // T3 / T4: the actual schema.
    const config = read(root, 'config/database.php');
    const defaultConnection = laravelEngines(config).defaultName;
    const actual: Array<{ rung: SourceRung; suffix: string; file: string; table: ActualTable }> = [];
    const snapEngines = new Map<string, Engine>();
    for (const file of sqlFiles(root).filter((f) => f.startsWith(`${SNAPSHOT_DIR}/`))) {
        const text = read(root, file);
        if (text === null) continue;
        const base = path.posix.basename(file, '.sql');
        const conn = base === 'default' ? '' : base;
        const r = actualFromSql(file, text, conn);
        if (r.engine !== 'unknown') snapEngines.set(conn || 'default', r.engine);
        for (const t of r.tables) actual.push({ rung: 'T3', suffix: '@actual', file, table: t });
        out.actual.push({ rung: 'T3', file });
    }
    let oracleFiles: string[] = [];
    try {
        oracleFiles = fs
            .readdirSync(path.join(root, ORACLE_DIR))
            .filter((f) => f.endsWith('.json'))
            .sort()
            .map((f) => `${ORACLE_DIR}/${f}`);
    } catch {
        oracleFiles = [];
    }
    for (const file of oracleFiles) {
        const text = read(root, file);
        if (text === null) continue;
        const r = actualFromOracle(file, text, defaultConnection);
        if (!r.table) {
            out.skipped.push({ file, reason: 'not `model:show --json` output (no table)' });
            continue;
        }
        actual.push({ rung: 'T4', suffix: '@oracle', file, table: r.table });
        out.actual.push({ rung: 'T4', file });
        if (r.hooks) annotate(tableId(r.table.connection, r.table.name), { 'data:delete_hooks': ref(r.hooks) });
    }
    const seenActual = new Set<string>();
    for (const a of actual) {
        const intended = tableId(a.table.connection, a.table.name);
        const tid = `${intended}${a.suffix}`;
        if (seenActual.has(tid)) continue;
        seenActual.add(tid);
        const intendedSeen = byId.get(intended)?.kind === 'table' || out.facts.some((f) => f.id === intended);
        if (intendedSeen) annotate(intended, { 'data:actual_seen': tid });
        out.facts.push({
            kind: 'table',
            id: tid,
            name: a.table.name,
            attrs: { connection: a.table.connection || 'default', source: a.file, intended_seen: intendedSeen, intended: intendedSeen ? intended : null },
            witness: a.table.witness,
            rung: a.rung,
            owner: a.file,
        });
        for (const col of a.table.columns) {
            const cid = `${columnId(a.table.connection, a.table.name, col.name)}${a.suffix}`;
            out.facts.push({
                kind: 'column',
                id: cid,
                name: `${a.table.name}.${col.name}`,
                attrs: { type: col.type, nullable: col.nullable, 'data:type_family': typeFamily(col.type), source: a.file },
                witness: col.witness,
                rung: a.rung,
                owner: a.file,
            });
            out.relations.push({ relation: 'member', from: tid, to: cid, attrs: {}, witness: col.witness, rung: a.rung, owner: a.file, guess: false });
        }
    }
    if (actual.length) {
        for (const n of graph.nodes) if (n.kind === 'column' && n.fact) annotate(n.id, { 'data:type_family': typeFamily(String(n.fact.attrs?.['type'] ?? '')) });
        for (const f of out.facts) if (f.kind === 'column' && f.rung === 'T2') f.attrs['data:type_family'] = typeFamily(String(f.attrs['type'] ?? ''));
    }

    // Connections.
    const runtimeEngines = [
        ...new Set(
            (opts.runtime?.facts ?? [])
                .filter((f) => f.kind === 'service' && typeof f.attrs['db_engine'] === 'string')
                .map((f) => RUNTIME_ENGINE[String(f.attrs['db_engine'])])
                .filter((e): e is Engine => e !== undefined),
        ),
    ];
    let prismaKeyless = false;
    const prisma = read(root, 'prisma/schema.prisma');
    if (prisma && /relationMode\s*=\s*"prisma"|referentialIntegrity\s*=\s*"prisma"/.test(prisma)) prismaKeyless = true;
    const conns = new Map<string, CodeNode[]>();
    for (const t of tables) conns.set(connOf(t), [...(conns.get(connOf(t)) ?? []), t]);
    for (const a of actual) conns.set(a.table.connection || 'default', conns.get(a.table.connection || 'default') ?? []);
    for (const [name, ts] of [...conns].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const first = ts[0]?.fact?.witness;
        const fromConfig = config ? lineWitness('config/database.php', config, name === 'default' ? /['"]default['"]\s*=>/ : new RegExp(`['"]${name}['"]\\s*=>\\s*\\[`)) : null;
        const configHit = fromConfig && config && new RegExp(name === 'default' ? `['"]default['"]\\s*=>` : `['"]${name}['"]\\s*=>`).test(config);
        const witness = configHit ? fromConfig : first ?? actual.find((x) => (x.table.connection || 'default') === name)?.table.witness;
        if (!witness) continue;
        const stated = (ts[0]?.fact?.attrs?.['engine'] as string | undefined) ?? snapEngines.get(name) ?? 'unknown';
        const fromRuntime = stated === 'unknown' && runtimeEngines.length === 1 ? runtimeEngines[0] : undefined;
        const fkMode = declared.fk_mode?.[name] === 'none' || (prismaKeyless && name === 'default') ? 'none' : 'keys';
        out.facts.push({
            kind: 'connection',
            id: `connection:${name}`,
            name,
            attrs: {
                connection: name,
                engine: stated === 'unknown' ? null : stated,
                effective_engine: fromRuntime ?? (stated === 'unknown' ? null : stated),
                engine_source: fromRuntime ? 'runtime' : stated === 'unknown' ? null : 'project',
                completeness: String(ts[0]?.fact?.attrs?.['completeness'] ?? 'unknown'),
                fk_mode: fkMode,
                tables: ts.length,
            },
            witness: { ...witness },
            rung: 'T1',
            owner: witness.file,
        });
    }

    const declaredWaivers = waiversOf(declared);
    out.waivers = declaredWaivers.waivers;
    for (const reason of declaredWaivers.refused) out.skipped.push({ file: DECLARATIONS_FILE, reason });
    out.annotations = [...annotations].map(([id, attrs]) => ({ id, attrs })).sort((a, b) => (a.id < b.id ? -1 : 1));
    out.facts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
}
