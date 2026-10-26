/**
 * Column pairs the code joins on: query-builder joins
 * (`->join('customers', 'orders.customer_id', '=', 'customers.id')`, knex's
 * `.join('customers', 'orders.customer_id', 'customers.id')`) and raw SQL
 * equalities between two qualified columns in an `ON` / `WHERE` / `AND` clause,
 * with the aliases a nearby `FROM` / `JOIN` declares. A pair counts only when
 * both columns exist in the schema the graph holds — an unqualified or
 * unresolvable name draws nothing, so every link here is stated in the code,
 * never matched by name.
 */
import { spanHash, type Witness } from '../lane_fact.js';

export interface QueryLink {
    /** Column ids of the two sides, in the order the code names them. */
    a: string;
    b: string;
    witness: Witness;
    /** `builder` for a query-builder join, `sql` for a raw SQL equality. */
    via: 'builder' | 'sql';
}

/** Lines before an equality searched for the `FROM` / `JOIN` that declares its aliases. */
const ALIAS_WINDOW = 15;
const BUILDER_JOIN = /(?:->|\.)(?:join|leftJoin|rightJoin|innerJoin|joinWhere)\(\s*['"](\w+)(?:\s+as\s+(\w+))?['"]\s*,\s*['"](\w+)\.(\w+)['"]\s*,\s*(?:['"](?:=|==)['"]\s*,\s*)?['"](\w+)\.(\w+)['"]/gi;
const SQL_EQ = /\b(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)\b/g;
const SQL_CLAUSE = /\b(?:ON|WHERE|AND)\b/i;
const SQL_TABLE = /\b(?:FROM|JOIN)\s+[`"]?(\w+)[`"]?(?:\s+(?:AS\s+)?(?!ON\b|WHERE\b|JOIN\b|LEFT\b|RIGHT\b|INNER\b|OUTER\b|CROSS\b|GROUP\b|ORDER\b|LIMIT\b|USING\b)(\w+))?/gi;

/**
 * Every joined column pair in `files`. `column(table, name)` returns the graph id
 * of a schema column, or undefined when the schema has no such column.
 */
export function queryLinks(files: ReadonlyArray<{ path: string; text: string }>, column: (table: string, name: string) => string | undefined): QueryLink[] {
    const out: QueryLink[] = [];
    const seen = new Set<string>();
    const push = (a: string | undefined, b: string | undefined, file: string, lines: string[], at: number, via: QueryLink['via']): void => {
        if (!a || !b || a === b) return;
        const key = `${a}|${b}|${file}|${at}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ a, b, via, witness: { file, line: at + 1, hash: spanHash((lines[at] ?? '').trim()) } });
    };
    for (const f of files) {
        const lines = f.text.split('\n');
        lines.forEach((line, i) => {
            for (const m of line.matchAll(BUILDER_JOIN)) {
                const alias = new Map<string, string>([[m[1] as string, m[1] as string]]);
                if (m[2]) alias.set(m[2], m[1] as string);
                const t = (x: string): string => alias.get(x) ?? x;
                push(column(t(m[3] as string), m[4] as string), column(t(m[5] as string), m[6] as string), f.path, lines, i, 'builder');
            }
            if (!SQL_CLAUSE.test(line)) return;
            const eqs = [...line.matchAll(SQL_EQ)];
            if (!eqs.length) return;
            const alias = new Map<string, string>();
            for (let j = Math.max(0, i - ALIAS_WINDOW); j <= i; j++) {
                for (const m of (lines[j] ?? '').matchAll(SQL_TABLE)) {
                    alias.set(m[1] as string, m[1] as string);
                    if (m[2]) alias.set(m[2], m[1] as string);
                }
            }
            if (!alias.size) return;
            for (const m of eqs) {
                const ta = alias.get(m[1] as string);
                const tb = alias.get(m[3] as string);
                if (!ta || !tb) continue;
                push(column(ta, m[2] as string), column(tb, m[4] as string), f.path, lines, i, 'sql');
            }
        });
    }
    return out;
}
