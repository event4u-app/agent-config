/**
 * DDL adapter — reads `CREATE TABLE` statements into SchemaIR.
 *
 * Serves both `--source sql` (a hand-written or exported `.sql` file) and
 * `--source schema-dump` (a framework's dumped schema), because both are the
 * same input: DDL text. Normalisation class is `static` in both cases — nothing
 * here was read back from a server.
 *
 * This is a parser, and parsers meet dialects. The honest position is that
 * unsupported constructs are *counted*, not ignored: a `CREATE VIEW`, a
 * `CREATE TRIGGER`, a `CHECK` constraint or a generated column increments its
 * `skipped` counter, and the computed scope line then states partial fidelity
 * instead of the caller having to assume it.
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
    type SkipCounters,
    type SourceKind,
} from '../ir.js';
import { at, opt, req } from '../_match.js';

/** Strip line and block comments without eating string literals. */
function stripComments(sql: string): string {
    let out = '';
    let i = 0;
    let quote: string | null = null;
    while (i < sql.length) {
        const c = at(sql, i);
        if (quote !== null) {
            out += c;
            if (c === '\\' && i + 1 < sql.length) {
                out += at(sql, i + 1);
                i += 2;
                continue;
            }
            if (c === quote) quote = null;
            i += 1;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            quote = c;
            out += c;
            i += 1;
            continue;
        }
        if (c === '-' && at(sql, i + 1) === '-') {
            while (i < sql.length && at(sql, i) !== '\n') i += 1;
            continue;
        }
        if (c === '#') {
            while (i < sql.length && at(sql, i) !== '\n') i += 1;
            continue;
        }
        if (c === '/' && at(sql, i + 1) === '*') {
            i += 2;
            while (i < sql.length && !(at(sql, i) === '*' && at(sql, i + 1) === '/')) i += 1;
            i += 2;
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}

export function unquoteIdent(raw: string): string {
    const s = raw.trim();
    if (s.length >= 2) {
        const first = at(s, 0);
        const last = at(s, s.length - 1);
        if ((first === '`' && last === '`') || (first === '"' && last === '"') || (first === '[' && last === ']')) {
            return s.slice(1, -1);
        }
    }
    // A qualified name keeps only its final segment: the IR is single-schema.
    const parts = s.split('.');
    return (parts[parts.length - 1] ?? s).replace(/[`"[\]]/g, '');
}

/** Split on commas that sit at paren depth zero and outside any quote. */
export function splitTopLevel(body: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let current = '';
    for (let i = 0; i < body.length; i += 1) {
        const c = at(body, i);
        if (quote !== null) {
            current += c;
            if (c === '\\' && i + 1 < body.length) {
                current += at(body, i + 1);
                i += 1;
                continue;
            }
            if (c === quote) quote = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            quote = c;
            current += c;
            continue;
        }
        if (c === '(') depth += 1;
        if (c === ')') depth -= 1;
        if (c === ',' && depth === 0) {
            parts.push(current);
            current = '';
            continue;
        }
        current += c;
    }
    if (current.trim().length > 0) parts.push(current);
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

export function columnList(raw: string): string[] {
    return splitTopLevel(raw)
        .map((c) => unquoteIdent(c.replace(/\s+(asc|desc)$/i, '').replace(/\(\d+\)$/, '')))
        .filter((c) => c.length > 0);
}

/** Match the balanced parenthesised body that starts at `from`. */
function balancedBody(text: string, from: number): { body: string; end: number } | null {
    const open = text.indexOf('(', from);
    if (open < 0) return null;
    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < text.length; i += 1) {
        const c = at(text, i);
        if (quote !== null) {
            if (c === '\\') {
                i += 1;
                continue;
            }
            if (c === quote) quote = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            quote = c;
            continue;
        }
        if (c === '(') depth += 1;
        else if (c === ')') {
            depth -= 1;
            if (depth === 0) return { body: text.slice(open + 1, i), end: i };
        }
    }
    return null;
}

const TABLE_CONSTRAINT_HEAD =
    /^(constraint\b|primary\s+key\b|unique\b|key\b|index\b|foreign\s+key\b|check\b|fulltext\b|spatial\b)/i;

export function parseColumn(clause: string, ordinal: number, skipped: SkipCounters): IrColumn | null {
    const m = /^(`[^`]+`|"[^"]+"|\[[^\]]+\]|[A-Za-z_][\w$]*)\s+([\s\S]+)$/.exec(clause);
    if (m === null) return null;
    const name = unquoteIdent(req(m, 1));
    const rest = req(m, 2).trim();

    // A generated column is a real object this IR does not represent — count it
    // and drop the column, rather than recording a type it does not have.
    if (/\b(generated\s+always\s+as|\bas\s*\()/i.test(rest) && /\b(virtual|stored|generated)\b/i.test(rest)) {
        skipped.generated_columns += 1;
        return null;
    }

    // The type is everything up to the first recognised modifier keyword, with
    // any parenthesised length or enum body kept attached.
    let type = rest;
    const stop =
        /\s+(not\s+null|null|default|auto_increment|primary\s+key|unique|comment|references|collate|character\s+set|charset|generated|on\s+update|check|first|after|unsigned\s+zerofill)\b/i;
    let cursor = 0;
    let cut = rest.length;
    while (cursor < rest.length) {
        const slice = rest.slice(cursor);
        const hit = stop.exec(slice);
        if (hit === null) break;
        const absolute = cursor + (hit.index ?? 0);
        // Skip a keyword that sits inside a parenthesised body (enum values).
        const before = rest.slice(0, absolute);
        const opens = (before.match(/\(/g) ?? []).length;
        const closes = (before.match(/\)/g) ?? []).length;
        if (opens > closes) {
            cursor = absolute + hit[0].length;
            continue;
        }
        cut = absolute;
        break;
    }
    type = rest.slice(0, cut).trim();
    // `unsigned` and `zerofill` are part of the type, not modifiers.
    const tail = rest.slice(cut);
    const typeSuffix = /^\s*(unsigned|zerofill)(\s+(unsigned|zerofill))*/i.exec(tail);
    if (typeSuffix !== null) type = `${type} ${typeSuffix[0].trim()}`.replace(/\s+/g, ' ');

    const nullable = !/\bnot\s+null\b/i.test(rest);
    const auto = /\bauto_increment\b/i.test(rest) || /\bgenerated\s+by\s+default\s+as\s+identity\b/i.test(rest);

    let def: string | null = null;
    const dm = /\bdefault\s+('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[\w.+-]+(?:\([^)]*\))?)/i.exec(rest);
    if (dm !== null) def = req(dm, 1).trim();

    let comment: string | null = null;
    const cm = /\bcomment\s+'((?:[^'\\]|\\.)*)'/i.exec(rest);
    if (cm !== null) comment = opt(cm, 1);

    return { name, type: type.toLowerCase(), nullable, default: def, auto_increment: auto, ordinal, comment };
}

export function parseCreateTable(
    stmt: string,
    skipped: SkipCounters,
): { table: IrTable; inlineUnique: IrIndex[] } | null {
    const head = /create\s+(?:temporary\s+)?table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/i.exec(stmt);
    if (head === null) return null;
    const name = unquoteIdent(req(head, 1));
    const bal = balancedBody(stmt, head.index + head[0].length - 1);
    if (bal === null) return null;

    const columns: IrColumn[] = [];
    const indexes: IrIndex[] = [];
    const foreignKeys: IrForeignKey[] = [];
    let primaryKey: string[] = [];
    const inlineUnique: IrIndex[] = [];
    let ordinal = 0;
    let anonymousFk = 0;

    for (const clause of splitTopLevel(bal.body)) {
        if (!TABLE_CONSTRAINT_HEAD.test(clause)) {
            ordinal += 1;
            const col = parseColumn(clause, ordinal, skipped);
            if (col === null) {
                ordinal -= 1;
                continue;
            }
            columns.push(col);
            if (/\bprimary\s+key\b/i.test(clause)) primaryKey = [col.name];
            if (/\bunique\b/i.test(clause) && !/\bunique\s*\(/i.test(clause)) {
                inlineUnique.push({ name: `${name}_${col.name}_unique`, columns: [col.name], unique: true, type: null });
            }
            continue;
        }

        // A named CHECK constraint is a real object the IR does not carry.
        if (/^check\b/i.test(clause) || /^constraint\s+\S+\s+check\b/i.test(clause)) {
            skipped.check_constraints += 1;
            continue;
        }

        const fk =
            /(?:constraint\s+(\S+)\s+)?foreign\s+key\s*\(([^)]*)\)\s*references\s+([^\s(]+)\s*\(([^)]*)\)([\s\S]*)$/i.exec(
                clause,
            );
        if (fk !== null) {
            const tail = fk[5] ?? '';
            const onDelete = /on\s+delete\s+(cascade|restrict|set\s+null|no\s+action|set\s+default)/i.exec(tail);
            const onUpdate = /on\s+update\s+(cascade|restrict|set\s+null|no\s+action|set\s+default)/i.exec(tail);
            anonymousFk += 1;
            foreignKeys.push({
                name: fk[1] !== undefined ? unquoteIdent(fk[1]) : `${name}_fk_${anonymousFk}`,
                columns: columnList(req(fk, 2)),
                ref_table: unquoteIdent(req(fk, 3)),
                ref_columns: columnList(req(fk, 4)),
                on_update: onUpdate !== null ? req(onUpdate, 1).toLowerCase().replace(/\s+/g, ' ') : null,
                on_delete: onDelete !== null ? req(onDelete, 1).toLowerCase().replace(/\s+/g, ' ') : null,
            });
            continue;
        }

        const pk = /^(?:constraint\s+\S+\s+)?primary\s+key\s*\(([^)]*)\)/i.exec(clause);
        if (pk !== null) {
            primaryKey = columnList(req(pk, 1));
            continue;
        }

        const idx =
            /^(?:constraint\s+(\S+)\s+)?(unique|fulltext|spatial)?\s*(?:key|index)?\s*(`[^`]+`|"[^"]+"|[A-Za-z_][\w$]*)?\s*\(([^)]*)\)/i.exec(
                clause,
            );
        if (idx !== null) {
            const kind = (idx[2] ?? '').toLowerCase();
            const cols = columnList(req(idx, 4));
            if (cols.length === 0) continue;
            const explicit = idx[1] ?? idx[3];
            indexes.push({
                name: explicit !== undefined ? unquoteIdent(explicit) : `${name}_${cols.join('_')}_index`,
                columns: cols,
                unique: kind === 'unique',
                type: kind === 'fulltext' || kind === 'spatial' ? kind : null,
            });
        }
    }

    return {
        table: { name, comment: null, columns, primary_key: primaryKey, indexes, foreign_keys: foreignKeys },
        inlineUnique,
    };
}

export interface DdlParseOptions {
    dialect: Dialect;
    kind: Extract<SourceKind, 'sql' | 'schema-dump'>;
    ref: string;
}

/** Split DDL text into statements, respecting quotes and parens. */
function statements(sql: string): string[] {
    const out: string[] = [];
    let current = '';
    let depth = 0;
    let quote: string | null = null;
    for (let i = 0; i < sql.length; i += 1) {
        const c = at(sql, i);
        if (quote !== null) {
            current += c;
            if (c === '\\' && i + 1 < sql.length) {
                current += sql[i + 1];
                i += 1;
                continue;
            }
            if (c === quote) quote = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') {
            quote = c;
            current += c;
            continue;
        }
        if (c === '(') depth += 1;
        if (c === ')') depth -= 1;
        if (c === ';' && depth === 0) {
            out.push(current);
            current = '';
            continue;
        }
        current += c;
    }
    if (current.trim().length > 0) out.push(current);
    return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function parseDdl(sql: string, opts: DdlParseOptions): SchemaIr {
    const clean = stripComments(sql);
    const skipped = emptySkipCounters();
    const tables: IrTable[] = [];
    const byName = new Map<string, IrTable>();

    for (const stmt of statements(clean)) {
        if (/^create\s+(or\s+replace\s+)?(materialized\s+)?view\b/i.test(stmt)) {
            skipped.views += 1;
            continue;
        }
        if (/^create\s+(?:definer\s*=\s*\S+\s+)?trigger\b/i.test(stmt)) {
            skipped.triggers += 1;
            continue;
        }
        if (/^create\s+(?:temporary\s+)?table\b/i.test(stmt)) {
            const parsed = parseCreateTable(stmt, skipped);
            if (parsed === null) continue;
            for (const ix of parsed.inlineUnique) {
                if (!parsed.table.indexes.some((e) => e.name === ix.name)) parsed.table.indexes.push(ix);
            }
            tables.push(parsed.table);
            byName.set(parsed.table.name, parsed.table);
            continue;
        }

        // Standalone index and constraint statements attach to an existing table.
        const ci =
            /^create\s+(unique\s+)?index\s+(\S+)\s+on\s+([^\s(]+)\s*\(([^)]*)\)/i.exec(stmt) ??
            /^create\s+(unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(\S+)\s+on\s+([^\s(]+)\s*\(([^)]*)\)/i.exec(stmt);
        if (ci !== null) {
            const t = byName.get(unquoteIdent(req(ci, 3)));
            if (t !== undefined) {
                t.indexes.push({
                    name: unquoteIdent(req(ci, 2)),
                    columns: columnList(req(ci, 4)),
                    unique: ci[1] !== undefined,
                    type: null,
                });
            }
            continue;
        }

        const alterFk =
            /^alter\s+table\s+([^\s]+)\s+add\s+(?:constraint\s+(\S+)\s+)?foreign\s+key\s*\(([^)]*)\)\s*references\s+([^\s(]+)\s*\(([^)]*)\)([\s\S]*)$/i.exec(
                stmt,
            );
        if (alterFk !== null) {
            const t = byName.get(unquoteIdent(req(alterFk, 1)));
            if (t !== undefined) {
                const tail = alterFk[6] ?? '';
                const onDelete = /on\s+delete\s+(cascade|restrict|set\s+null|no\s+action|set\s+default)/i.exec(tail);
                const onUpdate = /on\s+update\s+(cascade|restrict|set\s+null|no\s+action|set\s+default)/i.exec(tail);
                t.foreign_keys.push({
                    name:
                        alterFk[2] !== undefined
                            ? unquoteIdent(alterFk[2])
                            : `${t.name}_fk_${t.foreign_keys.length + 1}`,
                    columns: columnList(req(alterFk, 3)),
                    ref_table: unquoteIdent(req(alterFk, 4)),
                    ref_columns: columnList(req(alterFk, 5)),
                    on_update: onUpdate !== null ? req(onUpdate, 1).toLowerCase().replace(/\s+/g, ' ') : null,
                    on_delete: onDelete !== null ? req(onDelete, 1).toLowerCase().replace(/\s+/g, ' ') : null,
                });
            }
        }
    }

    return {
        ir_version: IR_VERSION,
        dialect: opts.dialect,
        source: { kind: opts.kind, normalization_class: 'static', ref: opts.ref },
        skipped,
        tables,
    };
}
