/**
 * Schema replay — one schema model per connection, built by applying DDL
 * operations in the order the project applies them.
 *
 * A migration directory states history, not a state: `posts.author_id` indexed
 * in one file and un-indexed in a later one has no index, and a table created
 * then dropped does not exist. Readers turn each stack's files into the ordered
 * operation list below; `replay` is the only place that folds it into a state,
 * so the code graph, the index-parity linter and the differ all read the same
 * result. Every element keeps the witness of the operation that last shaped it.
 *
 * What a reader cannot settle is never guessed into the state: a conditional
 * statement is applied and marked `uncertain`, an unrecognised one is recorded
 * as a gap, and either makes that connection's completeness `partial`.
 */
import { IR_VERSION, emptySkipCounters, type Dialect, type IrColumn, type IrForeignKey, type IrIndex, type SchemaIr } from './ir.js';

export type Engine = 'mysql' | 'mariadb' | 'pgsql' | 'sqlite' | 'sqlsrv' | 'unknown';

export const ENGINES: readonly Engine[] = ['mysql', 'mariadb', 'pgsql', 'sqlite', 'sqlsrv', 'unknown'];

/** `complete`: every statement read and applied · `partial`: a gap or an uncertain statement · `unknown`: named, never read. */
export type Completeness = 'complete' | 'partial' | 'unknown';

/** Where a schema element was read: repository-relative file, 1-based line, hash of that line's text. */
export interface SchemaAt {
    file: string;
    line: number;
    hash: string;
}

interface OpBase {
    /** Connection name; `''` is the project's default connection. */
    connection: string;
    at: SchemaAt;
    /** Set when the statement only runs under a condition the reader cannot evaluate. */
    uncertain?: string;
}

export type ColumnSpec = Omit<IrColumn, 'ordinal'>;

export type DdlOp =
    | (OpBase & { op: 'create-table'; table: string })
    | (OpBase & { op: 'drop-table'; table: string })
    | (OpBase & { op: 'rename-table'; table: string; to: string })
    | (OpBase & { op: 'add-column'; table: string; column: ColumnSpec })
    | (OpBase & { op: 'modify-column'; table: string; column: ColumnSpec })
    | (OpBase & { op: 'drop-column'; table: string; column: string })
    | (OpBase & { op: 'rename-column'; table: string; column: string; to: string })
    | (OpBase & { op: 'add-index'; table: string; index: IrIndex; primary?: boolean })
    | (OpBase & { op: 'drop-index'; table: string; name: string })
    | (OpBase & { op: 'drop-primary'; table: string })
    | (OpBase & { op: 'add-fk'; table: string; fk: IrForeignKey })
    | (OpBase & { op: 'drop-fk'; table: string; name: string })
    | (OpBase & { op: 'gap'; reason: string });

export interface ReplayedColumn extends IrColumn {
    at: SchemaAt;
    uncertain: boolean;
}
export interface ReplayedIndex extends IrIndex {
    at: SchemaAt;
}
export interface ReplayedForeignKey extends IrForeignKey {
    at: SchemaAt;
}

export interface ReplayedTable {
    name: string;
    at: SchemaAt;
    columns: ReplayedColumn[];
    primary_key: string[];
    indexes: ReplayedIndex[];
    foreign_keys: ReplayedForeignKey[];
    /** Created or shaped by a statement whose condition the reader could not evaluate. */
    uncertain: boolean;
    /** Every statement that touched the table, in replay order. */
    touched: SchemaAt[];
}

export interface ConnectionSchema {
    connection: string;
    engine: Engine;
    completeness: Completeness;
    tables: ReplayedTable[];
    /** Tables created and later dropped: absent from the state, kept as history. */
    dropped: Array<{ table: string; at: SchemaAt }>;
    gaps: Array<{ at: SchemaAt; reason: string }>;
}

export interface SchemaModel {
    connections: ConnectionSchema[];
}

export interface ReplayInput {
    ops: readonly DdlOp[];
    /** Engine per connection name (`''` = default), when the project states it. */
    engines?: ReadonlyMap<string, Engine>;
    /** Connections the project names (a model's `$connection`) that no statement touched. */
    named?: readonly string[];
}

interface MutableConnection {
    tables: Map<string, ReplayedTable>;
    dropped: Array<{ table: string; at: SchemaAt }>;
    gaps: Array<{ at: SchemaAt; reason: string }>;
    uncertain: boolean;
    ops: number;
}

/** Fold ordered DDL operations into one schema per connection. */
export function replay(input: ReplayInput): SchemaModel {
    const conns = new Map<string, MutableConnection>();
    const conn = (name: string): MutableConnection => {
        let c = conns.get(name);
        if (!c) {
            c = { tables: new Map(), dropped: [], gaps: [], uncertain: false, ops: 0 };
            conns.set(name, c);
        }
        return c;
    };
    const tableFor = (c: MutableConnection, name: string, at: SchemaAt): ReplayedTable => {
        let t = c.tables.get(name);
        if (!t) {
            // An alter on a table no statement created: the creation lives
            // somewhere this reader did not see.
            c.gaps.push({ at, reason: `table "${name}" altered before any statement created it` });
            t = { name, at, columns: [], primary_key: [], indexes: [], foreign_keys: [], uncertain: true, touched: [] };
            c.tables.set(name, t);
        }
        return t;
    };

    for (const op of input.ops) {
        const c = conn(op.connection);
        c.ops += 1;
        if (op.uncertain) {
            c.uncertain = true;
            c.gaps.push({ at: op.at, reason: op.uncertain });
        }
        if (op.op === 'gap') {
            c.gaps.push({ at: op.at, reason: op.reason });
            continue;
        }
        if (op.op === 'create-table') {
            const prev = c.tables.get(op.table);
            if (prev) {
                prev.touched.push(op.at);
                continue;
            }
            c.tables.set(op.table, {
                name: op.table,
                at: op.at,
                columns: [],
                primary_key: [],
                indexes: [],
                foreign_keys: [],
                uncertain: Boolean(op.uncertain),
                touched: [op.at],
            });
            continue;
        }
        if (op.op === 'drop-table') {
            if (c.tables.delete(op.table)) c.dropped.push({ table: op.table, at: op.at });
            continue;
        }
        if (op.op === 'drop-index' && op.table === '') {
            for (const x of c.tables.values()) x.indexes = x.indexes.filter((ix) => ix.name !== op.name);
            continue;
        }
        const t = tableFor(c, op.table, op.at);
        t.touched.push(op.at);
        if (op.uncertain) t.uncertain = true;
        switch (op.op) {
            case 'rename-table': {
                c.tables.delete(op.table);
                t.name = op.to;
                c.tables.set(op.to, t);
                break;
            }
            case 'add-column': {
                if (t.columns.some((x) => x.name === op.column.name)) break;
                t.columns.push({ ...op.column, ordinal: t.columns.length + 1, at: op.at, uncertain: Boolean(op.uncertain) });
                break;
            }
            case 'modify-column': {
                const i = t.columns.findIndex((x) => x.name === op.column.name);
                if (i < 0) t.columns.push({ ...op.column, ordinal: t.columns.length + 1, at: op.at, uncertain: Boolean(op.uncertain) });
                else t.columns[i] = { ...op.column, ordinal: (t.columns[i] as ReplayedColumn).ordinal, at: op.at, uncertain: Boolean(op.uncertain) };
                break;
            }
            case 'drop-column': {
                t.columns = t.columns.filter((x) => x.name !== op.column).map((x, i) => ({ ...x, ordinal: i + 1 }));
                // A dropped column takes the indexes and keys built on it.
                t.indexes = t.indexes.filter((ix) => !ix.columns.includes(op.column));
                t.foreign_keys = t.foreign_keys.filter((fk) => !fk.columns.includes(op.column));
                t.primary_key = t.primary_key.filter((x) => x !== op.column);
                break;
            }
            case 'rename-column': {
                const rename = (x: string): string => (x === op.column ? op.to : x);
                for (const col of t.columns) if (col.name === op.column) col.name = op.to;
                for (const ix of t.indexes) ix.columns = ix.columns.map(rename);
                for (const fk of t.foreign_keys) fk.columns = fk.columns.map(rename);
                t.primary_key = t.primary_key.map(rename);
                break;
            }
            case 'add-index': {
                if (op.primary) {
                    t.primary_key = [...op.index.columns];
                    break;
                }
                t.indexes = t.indexes.filter((ix) => ix.name !== op.index.name);
                t.indexes.push({ ...op.index, columns: [...op.index.columns], at: op.at });
                break;
            }
            case 'drop-index':
                t.indexes = t.indexes.filter((ix) => ix.name !== op.name);
                break;
            case 'drop-primary':
                t.primary_key = [];
                break;
            case 'add-fk':
                t.foreign_keys = t.foreign_keys.filter((fk) => fk.name !== op.fk.name);
                t.foreign_keys.push({ ...op.fk, columns: [...op.fk.columns], ref_columns: [...op.fk.ref_columns], at: op.at });
                break;
            case 'drop-fk':
                t.foreign_keys = t.foreign_keys.filter((fk) => fk.name !== op.name);
                break;
        }
    }

    for (const n of input.named ?? []) if (!conns.has(n)) conns.set(n, { tables: new Map(), dropped: [], gaps: [], uncertain: false, ops: 0 });

    const engines = input.engines ?? new Map<string, Engine>();
    const out: ConnectionSchema[] = [];
    for (const [name, c] of [...conns].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
        out.push({
            connection: name,
            engine: engines.get(name) ?? 'unknown',
            completeness: c.ops === 0 ? 'unknown' : c.gaps.length > 0 || c.uncertain ? 'partial' : 'complete',
            tables: [...c.tables.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
            dropped: c.dropped,
            gaps: c.gaps,
        });
    }
    return { connections: out };
}

/** The connection's tables by name. */
export function tableMap(c: ConnectionSchema): Map<string, ReplayedTable> {
    return new Map(c.tables.map((t) => [t.name, t]));
}

/**
 * Whether lookups on `columns` (in order) can seek through an index.
 *
 * `declared` — a primary key or index whose leading columns are exactly these;
 * `implicit` — none declared, but the engine creates one for a foreign key on
 * them (InnoDB on MySQL and MariaDB does, PostgreSQL and SQLite never do);
 * `missing` — neither; `engine-unknown` — only a foreign key, on an engine the
 * project does not state, so the answer depends on what runs it.
 */
export type IndexState = 'declared' | 'implicit' | 'missing' | 'engine-unknown';

export function leadingIndexState(t: ReplayedTable, columns: readonly string[], engine: Engine): IndexState {
    const leads = (list: readonly string[]): boolean => columns.length > 0 && columns.every((c, i) => list[i] === c);
    if (leads(t.primary_key) || t.indexes.some((ix) => leads(ix.columns))) return 'declared';
    if (!t.foreign_keys.some((fk) => leads(fk.columns))) return 'missing';
    if (engine === 'mysql' || engine === 'mariadb') return 'implicit';
    if (engine === 'unknown') return 'engine-unknown';
    return 'missing';
}

const DIALECT_OF: Partial<Record<Engine, Dialect>> = { mysql: 'mysql', mariadb: 'mariadb', pgsql: 'pgsql', sqlite: 'sqlite' };

/** One connection as SchemaIR, so the differ and the renderers read replayed state too. */
export function connectionToIr(c: ConnectionSchema, ref: string): SchemaIr {
    return {
        ir_version: IR_VERSION,
        dialect: DIALECT_OF[c.engine] ?? 'mysql',
        source: { kind: 'sql', normalization_class: 'static', ref },
        skipped: emptySkipCounters(),
        tables: c.tables.map((t) => ({
            name: t.name,
            comment: null,
            columns: t.columns.map(({ at: _at, uncertain: _u, ...col }) => col),
            primary_key: [...t.primary_key],
            indexes: t.indexes.map(({ at: _at, ...ix }) => ix),
            foreign_keys: t.foreign_keys.map(({ at: _at, ...fk }) => fk),
        })),
    };
}
