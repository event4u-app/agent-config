/**
 * detect_index_parity — falsification spike S0.2 (static index parity).
 *
 * Part of the persistence-lint substrate defined by the roadmap
 * `road-to-scale-and-history-discipline.md` (rule R-A2, failure class F2,
 * tier `gate`, waiver kind `no-index`).
 *
 * Question the spike answers: can we statically join the query surface
 * (WHERE / ORDER BY columns in Eloquent + Prisma client code) to the schema
 * surface (Laravel migrations + schema.prisma) and check index presence?
 *
 * Classification per extracted column reference:
 *   - resolved + indexed        -> ok (no output)
 *   - resolved + NOT indexed    -> Finding F2/R-A2, unless a `no-index`
 *                                  waiver is on the line or the line above
 *                                  (waived findings are emitted with
 *                                  `waived: true` for auditability)
 *   - unresolvable (dynamic arg, raw SQL, unknown table/column)
 *                               -> counted as unresolved, NEVER a Finding
 *
 * All functions are pure; the only I/O is the directory walk in `analyze`.
 */

import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readLaravelSchema } from '../schema/readers/laravel_migrations.js';
import { readPrismaSchema } from '../schema/readers/prisma_schema.js';
import { leadingIndexState, replay, type ConnectionSchema, type Engine } from '../schema/replay.js';
import { type Finding, parse_waiver, is_ignored_dir } from './types';

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

export interface TableSchema {
    columns: Set<string>;
    indexed: Set<string>;
    /** Composite index column lists, in declared order (leftmost first). */
    composites: string[][];
    /** Columns counted as indexed only because a foreign key sits on a connection whose engine is unstated. */
    engine_assumed?: Set<string>;
}

/** table (Laravel) or model name (Prisma) -> schema */
export type SchemaMap = Map<string, TableSchema>;

/** The engine each replayed connection was judged against, per schema map (`''` = default connection). */
const ENGINES_OF = new WeakMap<SchemaMap, Map<string, Engine>>();

export function schema_engines(schema: SchemaMap): Map<string, Engine> {
    let m = ENGINES_OF.get(schema);
    if (!m) ENGINES_OF.set(schema, (m = new Map()));
    return m;
}

export interface ColumnRef {
    file: string; // relative to the analyzed dir
    line: number; // 1-indexed
    table: string | null; // null when the owning table/model is unknown
    column: string | null; // null when the column is dynamic / raw SQL
    kind: 'where' | 'orderBy';
    note?: string; // 'dynamic-arg' | 'raw-sql' | 'unknown-table' | 'unknown-column'
}

export interface IndexParityResult {
    findings: Finding[];
    /** WHERE columns resolved to a schema column. */
    resolved: number;
    /** WHERE columns that could not be resolved (dynamic, raw, unknown). */
    unresolved: number;
    /** resolved / (resolved + unresolved); 1 when there are no WHERE columns. */
    resolution_rate: number;
    /** Every extracted reference (where + orderBy), for auditing. */
    refs: ColumnRef[];
    /** WHERE references whose only support is a foreign key on a connection with an unstated engine. */
    engine_unverified: number;
    /** Engine per connection the schema was replayed on; `default` names the default connection. */
    engines: Record<string, Engine>;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function line_of(text: string, offset: number): number {
    let line = 1;
    for (let i = 0; i < offset && i < text.length; i++) {
        if (text[i] === '\n') line++;
    }
    return line;
}

/** Extract the balanced-delimiter span starting at `open` (index of the opener). */
function balanced_span(text: string, open: number, opener: string, closer: string): string {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        const c = text[i];
        if (c === opener) depth++;
        else if (c === closer) {
            depth--;
            if (depth === 0) return text.slice(open, i + 1);
        }
    }
    return text.slice(open); // unbalanced — return the rest; callers stay tolerant
}

function snake_case(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Naive pluralization matching Laravel's common cases (User -> users). */
function pluralize(word: string): string {
    if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
    return `${word}s`;
}

function model_to_table(model: string): string {
    return pluralize(snake_case(model));
}

function ensure_table(schema: SchemaMap, table: string): TableSchema {
    let t = schema.get(table);
    if (!t) {
        t = { columns: new Set(), indexed: new Set(), composites: [] };
        schema.set(table, t);
    }
    return t;
}

// ---------------------------------------------------------------------------
// Schema — the replayed model the code graph reads too (one reader per stack)
// ---------------------------------------------------------------------------

/**
 * Fold one replayed connection into the index-parity map. A column counts as
 * indexed when a primary key or index leads with it, or when the engine itself
 * indexes the foreign key on it. On an engine the project does not state, a
 * constrained foreign key keeps counting as indexed: the gate does not raise a
 * finding whose truth depends on which server runs the schema.
 */
function add_connection(schema: SchemaMap, c: ConnectionSchema, key_of: (table: string) => string[] = (t) => [t]): void {
    for (const t of c.tables) {
        for (const key of key_of(t.name)) {
            const entry = ensure_table(schema, key);
            for (const col of t.columns) entry.columns.add(col.name);
            for (const list of [t.primary_key, ...t.indexes.map((ix) => ix.columns)]) {
                if (list.length === 0) continue;
                entry.indexed.add(list[0]!);
                if (list.length > 1) entry.composites.push([...list]);
            }
            for (const fk of t.foreign_keys) {
                const state = leadingIndexState(t, fk.columns, c.engine);
                if (state === 'implicit' || state === 'engine-unknown') entry.indexed.add(fk.columns[0]!);
                if (state === 'engine-unknown') (entry.engine_assumed ??= new Set()).add(fk.columns[0]!);
            }
        }
    }
    const engines = schema_engines(schema);
    if (!engines.has(c.connection) || engines.get(c.connection) === 'unknown') engines.set(c.connection, c.engine);
}

/** Laravel migrations (one file or several, applied in name order) into `schema`. */
export function parse_laravel_migrations(text: string | Array<{ path: string; source: string }>, schema: SchemaMap, config: string | null = null): void {
    const files = typeof text === 'string' ? [{ path: 'migrations/inline.php', source: text }] : text;
    const read = readLaravelSchema(files, config);
    for (const c of replay({ ops: read.ops, engines: read.engines }).connections) add_connection(schema, c);
}

/** A `schema.prisma` into `schema`, keyed by MODEL name with FIELD names, as the client queries them. */
export function parse_prisma_schema(text: string, schema: SchemaMap): void {
    const read = readPrismaSchema({ path: 'schema.prisma', source: text });
    const tmp: SchemaMap = new Map();
    for (const c of replay({ ops: read.ops, engines: new Map([['', read.engine]]) }).connections) add_connection(tmp, c);
    for (const [name, engine] of schema_engines(tmp)) {
        const engines = schema_engines(schema);
        if (!engines.has(name) || engines.get(name) === 'unknown') engines.set(name, engine);
    }
    for (const [model, table] of read.modelTables) {
        const physical = tmp.get(table);
        if (!physical) continue;
        const entry = ensure_table(schema, model);
        const fields = read.fieldColumns.get(model) ?? new Map<string, string>();
        const field_of = new Map([...fields].map(([f, col]) => [col, f] as const));
        const name = (col: string): string => field_of.get(col) ?? col;
        for (const col of physical.columns) entry.columns.add(name(col));
        for (const col of physical.indexed) entry.indexed.add(name(col));
        for (const list of physical.composites) entry.composites.push(list.map(name));
        for (const col of physical.engine_assumed ?? []) (entry.engine_assumed ??= new Set()).add(name(col));
    }
}

// ---------------------------------------------------------------------------
// Query surface — PHP (Eloquent / query builder)
// ---------------------------------------------------------------------------

const PHP_QUERY_METHODS = /(::|->)\s*(whereRaw|orderByRaw|whereNotIn|whereIn|where|orderBy)\s*\(/g;

/** Extract WHERE / ORDER BY refs from a single PHP statement chain. */
function extract_php_chain_refs(
    text: string,
    chain_start: number,
    table: string | null,
    file: string,
    refs: ColumnRef[],
): void {
    const end = text.indexOf(';', chain_start);
    const stmt = text.slice(chain_start, end === -1 ? text.length : end);
    PHP_QUERY_METHODS.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PHP_QUERY_METHODS.exec(stmt)) !== null) {
        const method = m[2]!;
        const arg_at = chain_start + m.index + m[0].length;
        const line = line_of(text, chain_start + m.index);
        const kind: ColumnRef['kind'] = method.startsWith('orderBy') ? 'orderBy' : 'where';

        if (method === 'whereRaw' || method === 'orderByRaw') {
            refs.push({ file, line, table, column: null, kind, note: 'raw-sql' });
            continue;
        }

        const rest = text.slice(arg_at).replace(/^\s*/, '');
        if (rest.startsWith("'") || rest.startsWith('"')) {
            const lit = rest.match(/^['"]([\w.]+)['"]/);
            // `table.col` qualified names: keep the column part.
            const column = lit ? lit[1]!.split('.').pop()! : null;
            refs.push({ file, line, table, column, kind, ...(column ? {} : { note: 'dynamic-arg' }) });
        } else if (rest.startsWith('[')) {
            // where(['a' => .., 'b' => ..]) — every key is a WHERE column.
            const arr = balanced_span(text, arg_at + (text.slice(arg_at).length - rest.length), '[', ']');
            for (const key of arr.matchAll(/['"](\w+)['"]\s*=>/g)) {
                refs.push({ file, line, table, column: key[1]!, kind });
            }
        } else {
            // where($var, ...) / closures / expressions — dynamic, unresolvable.
            refs.push({ file, line, table, column: null, kind, note: 'dynamic-arg' });
        }
    }
}

export function extract_php_refs(
    text: string,
    file: string,
    model_table_map: Record<string, string>,
): ColumnRef[] {
    const refs: ColumnRef[] = [];

    // Model static chains: User::where(...), Post::whereIn(...), Model::query()->...
    for (const m of text.matchAll(/\b([A-Z]\w*)::(?=query\(\)|where|orderBy)/g)) {
        const model = m[1]!;
        if (model === 'DB' || model === 'Schema') continue;
        const table = model_table_map[model] ?? model_to_table(model);
        extract_php_chain_refs(text, m.index, table, file, refs);
    }

    // Query-builder chains: DB::table('orders')->where(...)
    for (const m of text.matchAll(/\bDB::table\(\s*['"](\w+)['"]\s*\)/g)) {
        extract_php_chain_refs(text, m.index, m[1]!, file, refs);
    }

    // Relation chains: $user->posts()->where(...) — the relation method name is
    // taken as the related table name (Laravel convention: hasMany posts()).
    for (const m of text.matchAll(/\$\w+->([a-z]\w*)\(\)\s*->\s*(?=where|orderBy)/g)) {
        extract_php_chain_refs(text, m.index, snake_case(m[1]!), file, refs);
    }

    return refs;
}

// ---------------------------------------------------------------------------
// Query surface — TypeScript (Prisma client)
// ---------------------------------------------------------------------------

/** Depth-1 keys of an object literal `{ ... }`, recursing into AND/OR/NOT. */
function object_depth1_keys(obj: string): { keys: string[]; dynamic: boolean } {
    const keys: string[] = [];
    let dynamic = false;
    let depth = 0;
    for (let i = 0; i < obj.length; i++) {
        const c = obj[i]!;
        if (c === '{' || c === '[' || c === '(') { depth++; continue; }
        if (c === '}' || c === ']' || c === ')') { depth--; continue; }
        if (depth !== 1) continue;
        if (c === '.' && obj.slice(i, i + 3) === '...') { dynamic = true; i += 2; continue; }
        const rest = obj.slice(i);
        const key = rest.match(/^(\w+)\s*:/);
        if (key) {
            if (key[1] === 'AND' || key[1] === 'OR' || key[1] === 'NOT') {
                // Recurse into each object of the boolean-operator array/object.
                const val_at = i + key[0].length;
                const val = obj.slice(val_at).replace(/^\s*/, '');
                const open = val[0];
                if (open === '[' || open === '{') {
                    const span = balanced_span(obj, val_at + (obj.slice(val_at).length - val.length), open, open === '[' ? ']' : '}');
                    if (open === '[') {
                        for (const inner of span.matchAll(/\{/g)) {
                            const sub = balanced_span(span, inner.index, '{', '}');
                            const r = object_depth1_keys(sub);
                            keys.push(...r.keys);
                            dynamic = dynamic || r.dynamic;
                        }
                    } else {
                        const r = object_depth1_keys(span);
                        keys.push(...r.keys);
                        dynamic = dynamic || r.dynamic;
                    }
                    i = val_at + span.length - 1;
                    // Depth bookkeeping was skipped for the recursed span; rebalance
                    // by continuing the outer scan after it (depth unchanged: the
                    // span is balanced).
                    continue;
                }
            }
            keys.push(key[1]!);
            i += key[0].length - 1;
            continue;
        }
        // Bare identifier at depth 1 not followed by ':' → shorthand property
        // ({ email } is fine — it IS the key) handled below via lookahead.
        const short = rest.match(/^(\w+)\s*[,}]/);
        if (short) {
            keys.push(short[1]!);
            i += short[1]!.length - 1;
        }
    }
    return { keys, dynamic };
}

export function extract_prisma_refs(text: string, file: string, schema: SchemaMap): ColumnRef[] {
    const refs: ColumnRef[] = [];

    // Model resolution: client property is the camelCase model name.
    const models = [...schema.keys()];
    const model_for = (prop: string): string | null =>
        models.find((mm) => mm[0]!.toLowerCase() + mm.slice(1) === prop) ?? null;

    // Raw SQL escape hatches — always unresolved.
    for (const m of text.matchAll(/\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)\b/g)) {
        refs.push({ file, line: line_of(text, m.index), table: null, column: null, kind: 'where', note: 'raw-sql' });
    }

    const call_re = /\b(?:prisma|db|client)\.(\w+)\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|count|aggregate|groupBy|updateMany|deleteMany|update|delete)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = call_re.exec(text)) !== null) {
        const table = model_for(m[1]!);
        const args_open = m.index + m[0].length - 1;
        const args = balanced_span(text, args_open, '(', ')');

        for (const clause of ['where', 'orderBy'] as const) {
            const kind: ColumnRef['kind'] = clause;
            const c_re = new RegExp(String.raw`\b${clause}\s*(:)?`, 'g');
            let cm: RegExpExecArray | null;
            while ((cm = c_re.exec(args)) !== null) {
                // Only consider depth-1 occurrences within the args object; a crude
                // but adequate guard: require the match to be followed by ':' or be
                // a shorthand (`where,` / `where }`).
                const after = args.slice(cm.index + cm[0].length).replace(/^\s*/, '');
                const line = line_of(text, args_open + cm.index);
                if (!cm[1]) {
                    // Shorthand `{ where }` — a dynamic variable.
                    if (/^[,}]/.test(after)) {
                        refs.push({ file, line, table, column: null, kind, note: 'dynamic-arg' });
                    }
                    continue;
                }
                if (after.startsWith('{')) {
                    const at = args_open + (args.length - args.slice(cm.index + cm[0].length).replace(/^\s*/, '').length) + cm.index + cm[0].length;
                    // Simpler: locate the '{' within args relative to cm.
                    const brace_in_args = args.indexOf('{', cm.index + cm[0].length);
                    const obj = balanced_span(args, brace_in_args, '{', '}');
                    const { keys, dynamic } = object_depth1_keys(obj);
                    for (const key of keys) {
                        refs.push({ file, line, table, column: key, kind });
                    }
                    if (dynamic) refs.push({ file, line, table, column: null, kind, note: 'dynamic-arg' });
                    void at;
                } else if (after.startsWith('[')) {
                    // orderBy: [{ a: 'asc' }, { b: 'desc' }]
                    const brack_in_args = args.indexOf('[', cm.index + cm[0].length);
                    const arr = balanced_span(args, brack_in_args, '[', ']');
                    for (const om of arr.matchAll(/(\w+)\s*:/g)) {
                        if (om[1] === 'asc' || om[1] === 'desc') continue;
                        refs.push({ file, line, table, column: om[1]!, kind });
                    }
                } else {
                    // where: someVariable — dynamic.
                    refs.push({ file, line, table, column: null, kind, note: 'dynamic-arg' });
                }
            }
        }
    }

    return refs;
}

// ---------------------------------------------------------------------------
// Classification + entry point
// ---------------------------------------------------------------------------

export function classify_refs(
    refs: ColumnRef[],
    schema: SchemaMap,
    file_lines: Map<string, string[]>,
): IndexParityResult {
    const findings: Finding[] = [];
    let resolved = 0;
    let unresolved = 0;
    let engine_unverified = 0;

    for (const ref of refs) {
        const table = ref.table ? schema.get(ref.table) : undefined;
        const is_resolved = !!(ref.column && table && table.columns.has(ref.column));

        if (!is_resolved) {
            if (!ref.note) {
                ref.note = !ref.column ? 'dynamic-arg' : !table ? 'unknown-table' : 'unknown-column';
            }
            if (ref.kind === 'where') unresolved++;
            continue;
        }
        if (ref.kind === 'where') resolved++;

        // Composite support: a non-leftmost column of a composite index is
        // covered when every column left of it in that index appears in the
        // same query chain (same file, within a ±3-line window) — the
        // real-world WHERE a AND b shape a composite (a, b) fully serves.
        const chain_cols = new Set(
            refs
                .filter(
                    (r) =>
                        r.file === ref.file &&
                        r.table === ref.table &&
                        r.column &&
                        Math.abs(r.line - ref.line) <= 3,
                )
                .map((r) => r.column as string),
        );
        const composite_covered = table!.composites.some((idx) => {
            const pos = idx.indexOf(ref.column!);
            if (pos < 0) return false;
            return idx.slice(0, pos).every((c) => chain_cols.has(c));
        });

        if (ref.kind === 'where' && !composite_covered && table!.engine_assumed?.has(ref.column!)) engine_unverified++;
        if (!table!.indexed.has(ref.column!) && !composite_covered) {
            const lines = file_lines.get(ref.file) ?? [];
            const waiver = parse_waiver(lines, ref.line - 1);
            const waived = waiver !== null && waiver.kind === 'no-index';
            findings.push({
                failure_class: 'F2',
                rule: 'R-A2',
                file: ref.file,
                line: ref.line,
                message: `${ref.kind === 'where' ? 'WHERE' : 'ORDER BY'} on ${ref.table}.${ref.column} has no supporting index`,
                tier: 'gate',
                ...(waived ? { waived: true, waiver_reason: waiver.reason } : {}),
            });
        }
    }

    const total = resolved + unresolved;
    return {
        findings,
        resolved,
        unresolved,
        resolution_rate: total === 0 ? 1 : resolved / total,
        refs,
        engine_unverified,
        engines: Object.fromEntries([...schema_engines(schema)].map(([k, v]) => [k === '' ? 'default' : k, v])),
    };
}

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        let st;
        try {
            // lstat: never FOLLOW symlinks — a hostile tree could link outside
            // the scanned root (council PR-review finding); broken links must
            // not crash the walk either.
            st = lstatSync(p);
        } catch {
            continue;
        }
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) {
            if (!is_ignored_dir(entry)) out.push(...walk(p));
        } else out.push(p);
    }
    return out;
}

export interface AnalyzeOptions {
    /** Explicit Model -> table overrides (else snake_case + pluralize). */
    model_table_map?: Record<string, string>;
}

/**
 * Analyze a fixture/source directory: build the schema map from migrations and
 * schema.prisma files, extract the query surface from .php and .ts files, and
 * classify every WHERE / ORDER BY column reference.
 */
export function analyze(dir: string, opts: AnalyzeOptions = {}): IndexParityResult {
    const files = walk(dir);
    const schema: SchemaMap = new Map();
    const query_files: Array<{ rel: string; text: string; lang: 'php' | 'ts' }> = [];

    const migrations: Array<{ path: string; source: string }> = [];
    let config: string | null = null;
    for (const f of files) {
        const rel = relative(dir, f);
        if (f.endsWith('.prisma')) {
            parse_prisma_schema(readFileSync(f, 'utf8'), schema);
        } else if (f.endsWith('.php')) {
            const text = readFileSync(f, 'utf8');
            const posix = rel.split('\\').join('/');
            if (posix === 'config/database.php') config = text;
            if (/Schema::(?:connection\([^)]*\)\s*->\s*)?(?:create|table)\(/.test(text)) {
                migrations.push({ path: /(^|\/)migrations\//.test(posix) ? posix : `migrations/${posix}`, source: text });
            } else query_files.push({ rel, text, lang: 'php' });
        } else if (f.endsWith('.ts')) {
            query_files.push({ rel, text: readFileSync(f, 'utf8'), lang: 'ts' });
        }
    }

    if (migrations.length > 0) parse_laravel_migrations(migrations, schema, config);

    const refs: ColumnRef[] = [];
    const file_lines = new Map<string, string[]>();
    for (const qf of query_files) {
        file_lines.set(qf.rel, qf.text.split('\n'));
        if (qf.lang === 'php') {
            refs.push(...extract_php_refs(qf.text, qf.rel, opts.model_table_map ?? {}));
        } else {
            refs.push(...extract_prisma_refs(qf.text, qf.rel, schema));
        }
    }

    return classify_refs(refs, schema, file_lines);
}
