/**
 * Raw SQL DDL files → ordered DDL operations for `replay`.
 *
 * Statements are read in file order and files in path order (the numbered
 * migration convention). CREATE TABLE reuses the DDL adapter's clause parser;
 * ALTER, CREATE/DROP INDEX, DROP and RENAME TABLE are replayed. A statement
 * that changes schema in a way this reader does not model is a gap; data
 * statements (INSERT, UPDATE, …) are not schema and are skipped silently.
 */
import { columnList, parseColumn, parseCreateTable, unquoteIdent } from '../adapters/ddl.js';
import { emptySkipCounters, type IrForeignKey } from '../ir.js';
import type { DdlOp, Engine, SchemaAt } from '../replay.js';
import { blankComments, lineIndex, splitTop, witnessAt } from './text.js';

export interface SourceText {
    path: string;
    source: string;
}

/** Statements with their start offset, split on `;` outside quotes and brackets. */
function statements(src: string): Array<{ text: string; offset: number }> {
    return splitTop(src, ';').map((p) => {
        const lead = p.text.length - p.text.trimStart().length;
        return { text: p.text.trim(), offset: p.offset + lead };
    });
}

const ACTION = /(cascade|restrict|set\s+null|no\s+action|set\s+default)/i;

function fkFromClause(table: string, clause: string, fallbackName: string): IrForeignKey | null {
    const m = /(?:constraint\s+(\S+)\s+)?foreign\s+key\s*\(([^)]*)\)\s*references\s+([^\s(]+)\s*\(([^)]*)\)([\s\S]*)$/i.exec(clause);
    if (!m) return null;
    const tail = m[5] ?? '';
    const del = new RegExp(`on\\s+delete\\s+${ACTION.source}`, 'i').exec(tail);
    const upd = new RegExp(`on\\s+update\\s+${ACTION.source}`, 'i').exec(tail);
    return {
        name: m[1] ? unquoteIdent(m[1]) : fallbackName,
        columns: columnList(m[2] as string),
        ref_table: unquoteIdent(m[3] as string),
        ref_columns: columnList(m[4] as string),
        on_delete: del ? (del[1] as string).toLowerCase().replace(/\s+/g, ' ') : null,
        on_update: upd ? (upd[1] as string).toLowerCase().replace(/\s+/g, ' ') : null,
    };
}

/** The engine a DDL text is written for, when its own syntax says so. */
export function sqlEngineHint(text: string): Engine {
    if (/\bENGINE\s*=\s*\w+/i.test(text) || /\bAUTO_INCREMENT\b/i.test(text)) return 'mysql';
    if (/\b(BIG)?SERIAL\b/i.test(text) || /\bGENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY\b/i.test(text)) return 'pgsql';
    if (/\bAUTOINCREMENT\b/i.test(text)) return 'sqlite';
    return 'unknown';
}

/** One SQL file → operations on the default connection. */
export function sqlDdlOps(file: SourceText): DdlOp[] {
    const src = blankComments(file.source, 'sql');
    const lineOf = lineIndex(src);
    const at = (offset: number): SchemaAt => witnessAt(file.path, file.source, lineOf, offset);
    const ops: DdlOp[] = [];
    const base = { connection: '' };
    for (const st of statements(src)) {
        const s = st.text;
        if (/^create\s+(?:temporary\s+)?table\b/i.test(s)) {
            const parsed = parseCreateTable(s, emptySkipCounters());
            if (!parsed) {
                ops.push({ ...base, op: 'gap', at: at(st.offset), reason: 'CREATE TABLE not readable' });
                continue;
            }
            const t = parsed.table;
            ops.push({ ...base, op: 'create-table', table: t.name, at: at(st.offset) });
            const colAt = (name: string): SchemaAt => {
                const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const hit = new RegExp(`[(,]\\s*[\`"\\[]?${esc}[\`"\\]]?\\s`, 'i').exec(s);
                return at(st.offset + (hit ? hit.index + hit[0].search(/[^\s(,]/) : 0));
            };
            for (const c of t.columns) {
                const { ordinal: _o, ...spec } = c;
                ops.push({ ...base, op: 'add-column', table: t.name, column: spec, at: colAt(c.name) });
            }
            if (t.primary_key.length) ops.push({ ...base, op: 'add-index', table: t.name, primary: true, index: { name: 'primary', columns: t.primary_key, unique: true, type: null }, at: at(st.offset) });
            for (const ix of [...t.indexes, ...parsed.inlineUnique]) ops.push({ ...base, op: 'add-index', table: t.name, index: ix, at: at(st.offset) });
            for (const fk of t.foreign_keys) ops.push({ ...base, op: 'add-fk', table: t.name, fk, at: colAt(fk.columns[0] ?? '') });
            continue;
        }
        const ci = /^create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(\S+)\s+on\s+([^\s(]+)\s*(?:using\s+\w+\s*)?\(([^)]*)\)/i.exec(s);
        if (ci) {
            ops.push({ ...base, op: 'add-index', table: unquoteIdent(ci[3] as string), index: { name: unquoteIdent(ci[2] as string), columns: columnList(ci[4] as string), unique: Boolean(ci[1]), type: null }, at: at(st.offset) });
            continue;
        }
        const di = /^drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(\S+)(?:\s+on\s+(\S+))?/i.exec(s);
        if (di) {
            ops.push({ ...base, op: 'drop-index', table: di[2] ? unquoteIdent(di[2]) : '', name: unquoteIdent(di[1] as string), at: at(st.offset) });
            continue;
        }
        const dt = /^drop\s+table\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+cascade|\s+restrict)?$/i.exec(s);
        if (dt) {
            for (const n of (dt[1] as string).split(',')) ops.push({ ...base, op: 'drop-table', table: unquoteIdent(n), at: at(st.offset) });
            continue;
        }
        const rt = /^rename\s+table\s+(\S+)\s+to\s+(\S+)/i.exec(s);
        if (rt) {
            ops.push({ ...base, op: 'rename-table', table: unquoteIdent(rt[1] as string), to: unquoteIdent(rt[2] as string), at: at(st.offset) });
            continue;
        }
        const alter = /^alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(\S+)\s+([\s\S]+)$/i.exec(s);
        if (alter) {
            const table = unquoteIdent(alter[1] as string);
            const restOffset = st.offset + s.length - (alter[2] as string).length;
            for (const part of splitTop(alter[2] as string, ',')) {
                const a = part.text.trim();
                const pAt = at(restOffset + part.offset);
                const push = (op: Record<string, unknown>): void => {
                    ops.push({ ...base, table, at: pAt, ...op } as DdlOp);
                };
                let m: RegExpExecArray | null;
                if ((m = /^add\s+(?:constraint\s+\S+\s+)?foreign\s+key\b/i.exec(a))) {
                    const fk = fkFromClause(table, a, `${table}_fk_${part.offset}`);
                    if (fk) push({ op: 'add-fk', fk });
                } else if ((m = /^add\s+(?:constraint\s+\S+\s+)?primary\s+key\s*\(([^)]*)\)/i.exec(a))) {
                    push({ op: 'add-index', primary: true, index: { name: 'primary', columns: columnList(m[1] as string), unique: true, type: null } });
                } else if ((m = /^add\s+(?:constraint\s+(\S+)\s+)?(unique\s+)?(?:index|key)?\s*(\S+)?\s*\(([^)]*)\)/i.exec(a)) && !/^add\s+column\b/i.test(a)) {
                    const cols = columnList(m[4] as string);
                    const name = m[1] ?? m[3];
                    push({ op: 'add-index', index: { name: name ? unquoteIdent(name) : `${table}_${cols.join('_')}_index`, columns: cols, unique: Boolean(m[2]), type: null } });
                } else if ((m = /^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?([\s\S]+)$/i.exec(a))) {
                    const col = parseColumn(m[1] as string, 1, emptySkipCounters());
                    if (col) {
                        const { ordinal: _o, ...spec } = col;
                        push({ op: 'add-column', column: spec });
                    } else push({ op: 'gap', reason: `ALTER TABLE ${table} ADD not readable` });
                } else if ((m = /^drop\s+foreign\s+key\s+(\S+)/i.exec(a))) {
                    push({ op: 'drop-fk', name: unquoteIdent(m[1] as string) });
                } else if ((m = /^drop\s+constraint\s+(?:if\s+exists\s+)?(\S+)/i.exec(a))) {
                    push({ op: 'drop-fk', name: unquoteIdent(m[1] as string) });
                    push({ op: 'drop-index', name: unquoteIdent(m[1] as string) });
                } else if (/^drop\s+primary\s+key/i.test(a)) {
                    push({ op: 'drop-primary' });
                } else if ((m = /^drop\s+(?:index|key)\s+(\S+)/i.exec(a))) {
                    push({ op: 'drop-index', name: unquoteIdent(m[1] as string) });
                } else if ((m = /^drop\s+(?:column\s+)?(?:if\s+exists\s+)?(\S+)/i.exec(a))) {
                    push({ op: 'drop-column', column: unquoteIdent(m[1] as string) });
                } else if ((m = /^rename\s+column\s+(\S+)\s+to\s+(\S+)/i.exec(a))) {
                    push({ op: 'rename-column', column: unquoteIdent(m[1] as string), to: unquoteIdent(m[2] as string) });
                } else if ((m = /^rename\s+(?:to|as)\s+(\S+)/i.exec(a))) {
                    push({ op: 'rename-table', to: unquoteIdent(m[1] as string) });
                } else {
                    push({ op: 'gap', reason: `ALTER TABLE ${table} clause not modelled: ${a.slice(0, 40)}` });
                }
            }
            continue;
        }
        if (/^create\s+(or\s+replace\s+)?(materialized\s+)?view\b|^create\s+(?:definer\s*=\s*\S+\s+)?trigger\b|^create\s+(type|domain|sequence|function|procedure)\b/i.test(s)) {
            ops.push({ ...base, op: 'gap', at: at(st.offset), reason: `${s.split(/\s+/).slice(0, 3).join(' ')} not modelled` });
        }
    }
    return ops;
}

/** Every SQL schema file in `files`, in path order, with the engine the text names. */
export function readSqlSchema(files: readonly SourceText[]): { ops: DdlOp[]; engine: Engine } {
    const sql = files.filter((f) => f.path.toLowerCase().endsWith('.sql')).sort((a, b) => (a.path < b.path ? -1 : 1));
    const engines = new Set(sql.map((f) => sqlEngineHint(f.source)).filter((e) => e !== 'unknown'));
    return { ops: sql.flatMap(sqlDdlOps), engine: engines.size === 1 ? ([...engines][0] as Engine) : 'unknown' };
}
