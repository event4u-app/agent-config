/**
 * Prisma adapter — reads a `schema.prisma` into SchemaIR.
 *
 * Normalisation class is `static`: this is a parsed file, not a server read.
 * The consequence is stated in the differ, not here — a Prisma-derived state
 * may not be diffed against a live introspection without the explicit override,
 * because the two describe the same column differently.
 *
 * `@map` and `@@map` resolve to the physical name so a Prisma-derived IR is
 * comparable with a DDL-derived one at all. Without that resolution the two
 * would disagree on every renamed field while describing identical databases.
 *
 * A relation field (a list, or a scalar typed as another model) is not a
 * column: it is the foreign key its `@relation(fields: …)` names, and it is
 * emitted as such. An `enum` block is recorded so a field typed by it resolves
 * to a concrete type rather than a model reference.
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

const SCALARS = new Set([
    'String',
    'Boolean',
    'Int',
    'BigInt',
    'Float',
    'Decimal',
    'DateTime',
    'Json',
    'Bytes',
    'Unsupported',
]);

interface RawBlock {
    kind: 'model' | 'enum' | 'other';
    name: string;
    lines: string[];
}

function blocks(text: string): RawBlock[] {
    const out: RawBlock[] = [];
    const lines = text.split(/\r?\n/);
    let current: RawBlock | null = null;
    let depth = 0;
    for (const raw of lines) {
        const line = raw.replace(/\/\/.*$/, '').trim();
        if (current === null) {
            const m = /^(model|enum|type|view|datasource|generator)\s+([A-Za-z_]\w*)\s*\{/.exec(line);
            if (m === null) continue;
            const kind = m[1] === 'model' ? 'model' : m[1] === 'enum' ? 'enum' : 'other';
            current = { kind, name: req(m, 2), lines: [] };
            depth = 1;
            continue;
        }
        depth += (line.match(/\{/g) ?? []).length;
        depth -= (line.match(/\}/g) ?? []).length;
        if (depth <= 0) {
            out.push(current);
            current = null;
            continue;
        }
        if (line.length > 0) current.lines.push(line);
    }
    if (current !== null) out.push(current);
    return out;
}

function quotedArg(attr: string): string | null {
    const m = /\(\s*"([^"]*)"\s*\)/.exec(attr);
    return m === null ? null : req(m, 1);
}

function bracketList(text: string): string[] {
    const m = /\[([^\]]*)\]/.exec(text);
    if (m === null) return [];
    return req(m, 1)
        .split(',')
        .map((s) => s.trim().replace(/\(.*$/, ''))
        .filter((s) => s.length > 0);
}

/** Named argument of an attribute: `fields: [a, b]` / `map: "x"`. */
function namedArg(attr: string, key: string): string | null {
    const m = new RegExp(`${key}\\s*:\\s*(\\[[^\\]]*\\]|"[^"]*"|[A-Za-z_]\\w*)`).exec(attr);
    return m === null ? null : req(m, 1);
}

export interface PrismaParseOptions {
    dialect: Dialect;
    ref: string;
}

export function parsePrisma(text: string, opts: PrismaParseOptions): SchemaIr {
    const skipped = emptySkipCounters();
    const parsed = blocks(text);
    const enums = new Set(parsed.filter((b) => b.kind === 'enum').map((b) => b.name));
    const models = parsed.filter((b) => b.kind === 'model');
    const modelNames = new Set(models.map((m) => m.name));

    // A `view` block is a real object this IR does not represent — counted so
    // the computed scope line states partial fidelity rather than assuming it.
    skipped.views += (text.match(/^\s*view\s+[A-Za-z_]\w*\s*\{/gm) ?? []).length;

    // First pass: physical table name per model, and physical column name per field.
    const tableName = new Map<string, string>();
    const fieldMap = new Map<string, Map<string, string>>();
    for (const m of models) {
        const mapAttr = m.lines.find((l) => l.startsWith('@@map'));
        tableName.set(m.name, mapAttr !== undefined ? (quotedArg(mapAttr) ?? m.name) : m.name);
        const fm = new Map<string, string>();
        for (const line of m.lines) {
            if (line.startsWith('@@') || line.startsWith('@')) continue;
            const fm2 = /^([A-Za-z_]\w*)\s+(\S+)([\s\S]*)$/.exec(line);
            if (fm2 === null) continue;
            const attrs = fm2[3] ?? '';
            const mapped = /@map\s*\(/.test(attrs) ? quotedArg(attrs.slice(attrs.indexOf('@map'))) : null;
            fm.set(req(fm2, 1), mapped ?? req(fm2, 1));
        }
        fieldMap.set(m.name, fm);
    }

    const tables: IrTable[] = [];

    for (const m of models) {
        const columns: IrColumn[] = [];
        const indexes: IrIndex[] = [];
        const foreignKeys: IrForeignKey[] = [];
        let primaryKey: string[] = [];
        const localMap = fieldMap.get(m.name) ?? new Map<string, string>();
        const physical = tableName.get(m.name) ?? m.name;
        let ordinal = 0;

        for (const line of m.lines) {
            if (line.startsWith('@@')) {
                if (line.startsWith('@@id')) {
                    primaryKey = bracketList(line).map((f) => localMap.get(f) ?? f);
                    continue;
                }
                if (line.startsWith('@@unique')) {
                    const cols = bracketList(line).map((f) => localMap.get(f) ?? f);
                    const named = namedArg(line, 'map');
                    indexes.push({
                        name:
                            named !== null
                                ? named.replace(/"/g, '')
                                : `${physical}_${cols.join('_')}_key`,
                        columns: cols,
                        unique: true,
                        type: null,
                    });
                    continue;
                }
                if (line.startsWith('@@index')) {
                    const cols = bracketList(line).map((f) => localMap.get(f) ?? f);
                    const named = namedArg(line, 'map');
                    indexes.push({
                        name:
                            named !== null
                                ? named.replace(/"/g, '')
                                : `${physical}_${cols.join('_')}_idx`,
                        columns: cols,
                        unique: false,
                        type: null,
                    });
                    continue;
                }
                continue;
            }

            const f = /^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(\[\]|\?)?\s*([\s\S]*)$/.exec(line);
            if (f === null) continue;
            const fieldName = req(f, 1);
            const baseType = req(f, 2);
            const modifier = f[3] ?? '';
            const attrs = f[4] ?? '';

            // A relation field is a foreign key or the inverse side of one,
            // never a column.
            if (modelNames.has(baseType)) {
                if (modifier === '[]') continue; // inverse side — lives on the other model
                const relation = /@relation\s*\(([\s\S]*)\)/.exec(attrs);
                if (relation === null) continue;
                const relationArgs = req(relation, 1);
                const fields = namedArg(relationArgs, 'fields');
                const references = namedArg(relationArgs, 'references');
                if (fields === null || references === null) continue;
                const localCols = bracketList(fields).map((x) => localMap.get(x) ?? x);
                const targetMap = fieldMap.get(baseType) ?? new Map<string, string>();
                const refCols = bracketList(references).map((x) => targetMap.get(x) ?? x);
                const onDelete = namedArg(relationArgs, 'onDelete');
                const onUpdate = namedArg(relationArgs, 'onUpdate');
                const named = namedArg(relationArgs, 'map');
                foreignKeys.push({
                    name:
                        named !== null
                            ? named.replace(/"/g, '')
                            : `${physical}_${localCols.join('_')}_fkey`,
                    columns: localCols,
                    ref_table: tableName.get(baseType) ?? baseType,
                    ref_columns: refCols,
                    on_update: onUpdate !== null ? onUpdate.toLowerCase() : null,
                    on_delete: onDelete !== null ? onDelete.toLowerCase() : null,
                });
                continue;
            }

            if (!SCALARS.has(baseType) && !enums.has(baseType)) continue;

            ordinal += 1;
            const columnName = localMap.get(fieldName) ?? fieldName;
            // A native type annotation is the more precise truth when present.
            const native = /@db\.([A-Za-z_]\w*(?:\([^)]*\))?)/.exec(attrs);
            const type = (native !== null ? req(native, 1) : baseType).toLowerCase();
            const def = /@default\s*\(([\s\S]*?)\)\s*(?:@|$)/.exec(attrs);

            columns.push({
                name: columnName,
                type,
                nullable: modifier === '?',
                default: def !== null ? req(def, 1).trim() : null,
                auto_increment: /@default\s*\(\s*autoincrement\s*\(\s*\)\s*\)/.test(attrs),
                ordinal,
                comment: null,
            });

            if (/@id\b/.test(attrs)) primaryKey = [columnName];
            if (/@unique\b/.test(attrs)) {
                indexes.push({
                    name: `${physical}_${columnName}_key`,
                    columns: [columnName],
                    unique: true,
                    type: null,
                });
            }
        }

        tables.push({ name: physical, comment: null, columns, primary_key: primaryKey, indexes, foreign_keys: foreignKeys });
    }

    return {
        ir_version: IR_VERSION,
        dialect: opts.dialect,
        source: { kind: 'prisma', normalization_class: 'static', ref: opts.ref },
        skipped,
        tables,
    };
}
