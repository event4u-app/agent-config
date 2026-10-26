/**
 * A replayed schema model as graph facts: one node per live table and column,
 * `member` from a table to its columns, `migrates` from every file that shaped
 * a table, and `references` for each foreign key — table to table, and column
 * to column with its actions. Every fact carries the witness of the statement
 * that last shaped it. Dropped tables produce nothing.
 *
 * The default connection keeps the bare ids (`table:users`); any other
 * connection is named in the id (`table:tenant:invoices`), so the same table
 * name on two connections is two nodes.
 */
import { leadingIndexState, type ConnectionSchema, type SchemaAt, type SchemaModel } from '../../../_lib/schema/replay.js';
import type { CodeEdge, CodeNode, FactMeta } from '../../types.js';

export function tableId(connection: string, table: string): string {
    return connection ? `table:${connection}:${table}` : `table:${table}`;
}

export function columnId(connection: string, table: string, column: string): string {
    return connection ? `column:${connection}:${table}.${column}` : `column:${table}.${column}`;
}

const fact = (at: SchemaAt, attrs?: FactMeta['attrs']): FactMeta => ({
    owner: at.file,
    witness: { file: at.file, line: at.line, hash: at.hash },
    rung: 'T1',
    resolved_via: 'schema-call',
    ...(attrs ? { attrs } : {}),
});

export interface SchemaGraph {
    nodes: CodeNode[];
    edges: CodeEdge[];
}

/** `source` nodes the graph already has; a `migrates` edge from anything else needs its file node first. */
export function schemaGraph(model: SchemaModel, knownNodes: ReadonlySet<string>): SchemaGraph {
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    const seenNode = new Set<string>();
    const seenEdge = new Set<string>();
    const node = (n: CodeNode): void => {
        if (seenNode.has(n.id) || knownNodes.has(n.id)) return;
        seenNode.add(n.id);
        nodes.push(n);
    };
    const edge = (source: string, target: string, relation: CodeEdge['relation'], at: SchemaAt, attrs?: FactMeta['attrs']): void => {
        const key = `${source}\0${relation}\0${target}`;
        if (seenEdge.has(key)) return;
        seenEdge.add(key);
        edges.push({ source, target, relation, confidence: 'EXTRACTED', resolved_via: 'schema-call', provider: 'native', fact: fact(at, attrs) });
    };
    const fileNode = (file: string): void => {
        if (!knownNodes.has(file)) node({ id: file, label: file.split('/').pop() ?? file, kind: 'file', source_file: file, source_location: [] });
    };

    for (const c of model.connections) emitConnection(c);
    return { nodes, edges };

    function emitConnection(c: ConnectionSchema): void {
        const live = new Set(c.tables.map((t) => t.name));
        for (const t of c.tables) {
            const tid = tableId(c.connection, t.name);
            node({
                id: tid,
                label: t.name,
                kind: 'table',
                source_file: t.at.file,
                source_location: [t.at.line, 1, t.at.line, 1],
                fact: fact(t.at, {
                    connection: c.connection || 'default',
                    engine: c.engine,
                    completeness: c.completeness,
                    uncertain: t.uncertain,
                    primary_key: [...t.primary_key],
                    indexes: t.indexes.map((ix) => `${ix.name}(${ix.columns.join(',')})${ix.unique ? ' unique' : ''}`),
                }),
            });
            for (const at of t.touched) {
                fileNode(at.file);
                edge(at.file, tid, 'migrates', at);
            }
            for (const col of t.columns) {
                const cid = columnId(c.connection, t.name, col.name);
                const indexed = leadingIndexState(t, [col.name], c.engine);
                node({
                    id: cid,
                    label: `${t.name}.${col.name}`,
                    kind: 'column',
                    source_file: col.at.file,
                    source_location: [col.at.line, 1, col.at.line, 1],
                    fact: fact(col.at, {
                        type: col.type,
                        nullable: col.nullable && !t.primary_key.includes(col.name),
                        default: col.default,
                        primary: t.primary_key.includes(col.name),
                        index: indexed,
                        uncertain: col.uncertain,
                    }),
                });
                edge(tid, cid, 'member', col.at);
            }
            const byTarget = new Map<string, typeof t.foreign_keys>();
            for (const fk of t.foreign_keys) {
                if (!live.has(fk.ref_table)) continue;
                const list = byTarget.get(fk.ref_table) ?? [];
                list.push(fk);
                byTarget.set(fk.ref_table, list);
                fk.columns.forEach((col, i) => {
                    const ref = fk.ref_columns[i] ?? 'id';
                    edge(columnId(c.connection, t.name, col), columnId(c.connection, fk.ref_table, ref), 'references', fk.at, {
                        name: fk.name,
                        on_delete: fk.on_delete,
                        on_update: fk.on_update,
                        index: leadingIndexState(t, fk.columns, c.engine),
                    });
                });
            }
            for (const [target, fks] of byTarget) {
                const first = fks[0];
                if (!first) continue;
                edge(tid, tableId(c.connection, target), 'references', first.at, {
                    columns: fks.map((fk) => fk.columns.join(',')),
                    ref_columns: fks.map((fk) => fk.ref_columns.join(',')),
                    on_delete: fks.map((fk) => fk.on_delete ?? 'no action'),
                    on_update: fks.map((fk) => fk.on_update ?? 'no action'),
                });
            }
        }
    }
}
