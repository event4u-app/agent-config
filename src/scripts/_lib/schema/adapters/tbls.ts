/**
 * tbls adapter — maps a `schema.json` document onto SchemaIR.
 *
 * This is the generic escape hatch: any stack that can emit that shape gets a
 * diff without this repository growing a parser for its dialect. Normalisation
 * class is `static`, because the document is a file by the time it reaches here
 * — even though the tool that produced it read a live server. That is the
 * honest label: two `schema.json` files are mutually comparable, a
 * `schema.json` and a fresh introspection are not necessarily, because the two
 * pipelines normalise types and implicit indexes differently.
 */
import {
    IR_VERSION,
    emptySkipCounters,
    type Dialect,
    type IrColumn,
    type IrForeignKey,
    type IrIndex,
    type IrTable,
    type SchemaIr,
} from '../ir.js';
import { req } from '../_match.js';

interface TblsColumn {
    name?: unknown;
    type?: unknown;
    nullable?: unknown;
    default?: unknown;
    comment?: unknown;
}

interface TblsIndex {
    name?: unknown;
    def?: unknown;
    columns?: unknown;
}

interface TblsConstraint {
    name?: unknown;
    type?: unknown;
    def?: unknown;
    columns?: unknown;
    referenced_table?: unknown;
    referenced_columns?: unknown;
}

interface TblsTable {
    name?: unknown;
    type?: unknown;
    comment?: unknown;
    columns?: unknown;
    indexes?: unknown;
    constraints?: unknown;
}

interface TblsRelation {
    table?: unknown;
    columns?: unknown;
    parent_table?: unknown;
    parent_columns?: unknown;
    def?: unknown;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function referentialAction(def: string, keyword: 'DELETE' | 'UPDATE'): string | null {
    const m = new RegExp(`ON\\s+${keyword}\\s+(CASCADE|RESTRICT|SET NULL|NO ACTION|SET DEFAULT)`, 'i').exec(def);
    return m === null ? null : req(m, 1).toLowerCase();
}

export interface TblsParseOptions {
    dialect: Dialect;
    ref: string;
}

export function parseTbls(doc: unknown, opts: TblsParseOptions): SchemaIr {
    const skipped = emptySkipCounters();
    const root = (typeof doc === 'object' && doc !== null ? doc : {}) as Record<string, unknown>;
    const rawTables: TblsTable[] = Array.isArray(root.tables) ? (root.tables as TblsTable[]) : [];
    const relations: TblsRelation[] = Array.isArray(root.relations) ? (root.relations as TblsRelation[]) : [];

    const fkByTable = new Map<string, IrForeignKey[]>();
    for (const rel of relations) {
        const child = str(rel.table);
        if (child.length === 0) continue;
        const def = str(rel.def);
        const cols = strArray(rel.columns);
        const list = fkByTable.get(child) ?? [];
        list.push({
            name: `${child}_${cols.join('_')}_foreign`,
            columns: cols,
            ref_table: str(rel.parent_table),
            ref_columns: strArray(rel.parent_columns),
            on_update: referentialAction(def, 'UPDATE'),
            on_delete: referentialAction(def, 'DELETE'),
        });
        fkByTable.set(child, list);
    }

    const tables: IrTable[] = [];

    for (const t of rawTables) {
        const name = str(t.name);
        if (name.length === 0) continue;

        // tbls carries views in the same array, tagged by `type`.
        const tableType = str(t.type).toUpperCase();
        if (tableType.includes('VIEW')) {
            skipped.views += 1;
            continue;
        }

        const rawColumns: TblsColumn[] = Array.isArray(t.columns) ? (t.columns as TblsColumn[]) : [];
        const columns: IrColumn[] = rawColumns.map((c, i) => {
            const type = str(c.type);
            return {
                name: str(c.name),
                type: type.toLowerCase(),
                nullable: c.nullable === true,
                default: typeof c.default === 'string' && c.default.length > 0 ? c.default : null,
                auto_increment: /auto_increment|identity|nextval/i.test(`${type} ${str(c.default)}`),
                ordinal: i + 1,
                comment: typeof c.comment === 'string' && c.comment.length > 0 ? c.comment : null,
            };
        });

        const constraints: TblsConstraint[] = Array.isArray(t.constraints) ? (t.constraints as TblsConstraint[]) : [];
        let primaryKey: string[] = [];
        for (const c of constraints) {
            const type = str(c.type).toUpperCase();
            if (type.includes('PRIMARY KEY')) {
                primaryKey = strArray(c.columns);
                continue;
            }
            if (type.includes('CHECK')) {
                skipped.check_constraints += 1;
                continue;
            }
            // A foreign key present as a constraint but absent from `relations`
            // must still reach the IR, or the diagram loses an edge.
            if (type.includes('FOREIGN KEY')) {
                const refTable = str(c.referenced_table);
                if (refTable.length === 0) continue;
                const cols = strArray(c.columns);
                const list = fkByTable.get(name) ?? [];
                const already = list.some((fk) => fk.columns.join(',') === cols.join(',') && fk.ref_table === refTable);
                if (already) continue;
                const def = str(c.def);
                list.push({
                    name: str(c.name, `${name}_${cols.join('_')}_foreign`),
                    columns: cols,
                    ref_table: refTable,
                    ref_columns: strArray(c.referenced_columns),
                    on_update: referentialAction(def, 'UPDATE'),
                    on_delete: referentialAction(def, 'DELETE'),
                });
                fkByTable.set(name, list);
            }
        }

        const rawIndexes: TblsIndex[] = Array.isArray(t.indexes) ? (t.indexes as TblsIndex[]) : [];
        const indexes: IrIndex[] = [];
        for (const ix of rawIndexes) {
            const ixName = str(ix.name);
            const def = str(ix.def);
            // The primary key is already carried by `primary_key`; a duplicate
            // index entry for it would read as an extra object in the diff.
            if (ixName.toUpperCase() === 'PRIMARY' || /^\s*PRIMARY KEY/i.test(def)) continue;
            const cols = strArray(ix.columns);
            if (cols.length === 0) continue;
            indexes.push({
                name: ixName.length > 0 ? ixName : `${name}_${cols.join('_')}_index`,
                columns: cols,
                unique: /\bUNIQUE\b/i.test(def),
                type: /\bFULLTEXT\b/i.test(def) ? 'fulltext' : null,
            });
        }

        tables.push({
            name,
            comment: typeof t.comment === 'string' && t.comment.length > 0 ? t.comment : null,
            columns,
            primary_key: primaryKey,
            indexes,
            foreign_keys: fkByTable.get(name) ?? [],
        });
    }

    return {
        ir_version: IR_VERSION,
        dialect: opts.dialect,
        source: { kind: 'tbls-json', normalization_class: 'static', ref: opts.ref },
        skipped,
        tables,
    };
}
