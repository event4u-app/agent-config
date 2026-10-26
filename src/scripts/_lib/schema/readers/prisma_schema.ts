/**
 * `schema.prisma` → DDL operations for `replay`.
 *
 * A Prisma schema declares a state rather than a history, so each model becomes
 * one create plus its columns, keys and relations, witnessed at the model's or
 * field's own line. The block parsing is the Prisma adapter's; this reader only
 * adds the witnesses and the model → table names the query side needs.
 */
import { parsePrisma } from '../adapters/prisma.js';
import type { DdlOp, Engine, SchemaAt } from '../replay.js';
import { lineIndex, witnessAt } from './text.js';

export interface SourceText {
    path: string;
    source: string;
}

const PROVIDER_ENGINE: Record<string, Engine> = { mysql: 'mysql', postgresql: 'pgsql', postgres: 'pgsql', sqlite: 'sqlite', sqlserver: 'sqlsrv', cockroachdb: 'pgsql' };

export interface PrismaSchemaRead {
    ops: DdlOp[];
    engine: Engine;
    /** Model name → physical table name (`@@map`). */
    modelTables: Map<string, string>;
    /** Model name → field name → physical column name (`@map`), scalar fields only. */
    fieldColumns: Map<string, Map<string, string>>;
}

export function readPrismaSchema(file: SourceText): PrismaSchemaRead {
    const src = file.source;
    const lineOf = lineIndex(src);
    const at = (offset: number): SchemaAt => witnessAt(file.path, src, lineOf, offset);
    const provider = /datasource\s+\w+\s*\{[^}]*\bprovider\s*=\s*"(\w+)"/.exec(src)?.[1] ?? '';
    const engine = PROVIDER_ENGINE[provider] ?? 'unknown';
    const ir = parsePrisma(src, { dialect: engine === 'pgsql' ? 'pgsql' : engine === 'sqlite' ? 'sqlite' : 'mysql', ref: file.path });

    const modelTables = new Map<string, string>();
    const fieldColumns = new Map<string, Map<string, string>>();
    const modelAt = new Map<string, number>();
    for (const m of src.matchAll(/^\s*model\s+(\w+)\s*\{/gm)) {
        const name = m[1] as string;
        const open = (m.index as number) + m[0].length;
        const close = src.indexOf('\n}', open);
        const body = src.slice(open, close < 0 ? src.length : close);
        const mapped = /@@map\s*\(\s*"([^"]+)"\s*\)/.exec(body)?.[1] ?? name;
        modelTables.set(name, mapped);
        modelAt.set(mapped, m.index as number);
        const fields = new Map<string, string>();
        for (const f of body.matchAll(/^\s*(\w+)\s+\w+(?:\?|\[\])?([^\n]*)$/gm)) {
            const col = /@map\(\s*"([^"]+)"\s*\)/.exec(f[2] ?? '')?.[1];
            fields.set(f[1] as string, col ?? (f[1] as string));
        }
        fieldColumns.set(name, fields);
    }
    const fieldAt = (table: string, column: string): SchemaAt => {
        const start = modelAt.get(table) ?? 0;
        const close = src.indexOf('\n}', start);
        const body = src.slice(start, close < 0 ? src.length : close);
        const esc = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const hit = new RegExp(`^[ \\t]*${esc}\\s`, 'm').exec(body) ?? new RegExp(`@map\\(\\s*"${esc}"`).exec(body);
        return at(start + (hit ? hit.index : 0));
    };

    const ops: DdlOp[] = [];
    const base = { connection: '' };
    for (const t of ir.tables) {
        const tAt = at(modelAt.get(t.name) ?? 0);
        ops.push({ ...base, op: 'create-table', table: t.name, at: tAt });
        for (const c of t.columns) {
            const { ordinal: _o, ...spec } = c;
            ops.push({ ...base, op: 'add-column', table: t.name, column: spec, at: fieldAt(t.name, c.name) });
        }
        if (t.primary_key.length) ops.push({ ...base, op: 'add-index', table: t.name, primary: true, index: { name: 'primary', columns: t.primary_key, unique: true, type: null }, at: tAt });
        for (const ix of t.indexes) ops.push({ ...base, op: 'add-index', table: t.name, index: ix, at: tAt });
        for (const fk of t.foreign_keys) ops.push({ ...base, op: 'add-fk', table: t.name, fk, at: fieldAt(t.name, fk.columns[0] ?? '') });
    }
    return { ops, engine, modelTables, fieldColumns };
}
