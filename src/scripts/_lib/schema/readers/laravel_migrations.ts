/**
 * Laravel migrations → ordered DDL operations for `replay`.
 *
 * Reads only the `up()` body of each migration, in file-name order (the order
 * `artisan migrate` applies them), per connection: `Schema::connection('x')`
 * and a migration's own `$connection` property route a statement away from the
 * default. A statement inside an `if` is applied but marked uncertain; a
 * Blueprint call this reader does not know, or raw SQL, becomes a gap — so a
 * schema the reader could not fully see says `partial` instead of looking
 * complete.
 *
 * The engine per connection comes from the literal defaults in
 * `config/database.php`; no environment value is read.
 */
import type { IrForeignKey } from '../ir.js';
import type { ColumnSpec, DdlOp, Engine, SchemaAt } from '../replay.js';
import { ENGINES } from '../replay.js';
import { blankComments, closingBracket, lineIndex, splitTop, stringLiterals, witnessAt } from './text.js';

export interface SourceText {
    path: string;
    source: string;
}

export interface LaravelSchemaRead {
    ops: DdlOp[];
    engines: Map<string, Engine>;
    /** The default connection's configured name, when `config/database.php` states it literally. */
    defaultName: string | null;
}

/** A migration file: any PHP file under a `migrations/` directory. */
export function isLaravelMigration(p: string): boolean {
    return /(^|\/)migrations\/[^/]+\.php$/.test(p);
}

const ENGINE_OF: Record<string, Engine> = { mysql: 'mysql', mariadb: 'mariadb', pgsql: 'pgsql', postgres: 'pgsql', sqlite: 'sqlite', sqlsrv: 'sqlsrv' };

/** Engines per connection from `config/database.php` literals; `''` is the default connection. */
export function laravelEngines(configSource: string | null): { engines: Map<string, Engine>; defaultName: string | null } {
    const engines = new Map<string, Engine>();
    if (!configSource) return { engines, defaultName: null };
    const src = blankComments(configSource, 'php');
    const def = /['"]default['"]\s*=>\s*(?:env\(\s*['"]\w+['"]\s*,\s*)?['"](\w+)['"]/.exec(src)?.[1] ?? null;
    const head = /['"]connections['"]\s*=>\s*\[/.exec(src);
    if (head) {
        const open = head.index + head[0].length - 1;
        const close = closingBracket(src, open);
        const body = src.slice(open + 1, close < 0 ? src.length : close);
        for (const m of body.matchAll(/['"](\w+)['"]\s*=>\s*\[/g)) {
            const o = (m.index as number) + m[0].length - 1;
            const c = closingBracket(body, o);
            const conf = body.slice(o, c < 0 ? body.length : c);
            const driver = /['"]driver['"]\s*=>\s*(?:env\(\s*['"]\w+['"]\s*,\s*)?['"](\w+)['"]/.exec(conf)?.[1];
            if (driver) engines.set(m[1] as string, ENGINE_OF[driver] ?? 'unknown');
        }
    }
    if (def) engines.set('', engines.get(def) ?? 'unknown');
    for (const [k, v] of engines) if (!ENGINES.includes(v)) engines.set(k, 'unknown');
    return { engines, defaultName: def };
}

interface Call {
    name: string;
    args: string;
}

/** `$t->a(x)->b(y)` → [{a, x}, {b, y}]; null when the statement is not a chain on `$var`. */
function chainOf(stmt: string, v: string): Call[] | null {
    const s = stmt.trim();
    const head = new RegExp(`^\\$${v}\\s*->\\s*`).exec(s);
    if (!head) return null;
    const calls: Call[] = [];
    let i = head[0].length;
    while (i < s.length) {
        const m = /^(\w+)\s*\(/.exec(s.slice(i));
        if (!m) return calls.length ? calls : null;
        const open = i + m[0].length - 1;
        const close = closingBracket(s, open);
        if (close < 0) return null;
        calls.push({ name: m[1] as string, args: s.slice(open + 1, close) });
        i = close + 1;
        const arrow = /^\s*->\s*/.exec(s.slice(i));
        if (!arrow) break;
        i += arrow[0].length;
    }
    return calls;
}

/** String or string-array argument N (0-based) of a call. */
function argStrings(args: string, n: number): string[] {
    const parts = splitTop(args, ',');
    const part = parts[n]?.text.trim() ?? '';
    if (!/^['"[]/.test(part)) return [];
    return stringLiterals(part);
}

const TYPE_MAP: Record<string, string> = {
    string: 'varchar',
    char: 'char',
    text: 'text',
    tinyText: 'tinytext',
    mediumText: 'mediumtext',
    longText: 'longtext',
    integer: 'int',
    tinyInteger: 'tinyint',
    smallInteger: 'smallint',
    mediumInteger: 'mediumint',
    bigInteger: 'bigint',
    unsignedInteger: 'int unsigned',
    unsignedTinyInteger: 'tinyint unsigned',
    unsignedSmallInteger: 'smallint unsigned',
    unsignedMediumInteger: 'mediumint unsigned',
    unsignedBigInteger: 'bigint unsigned',
    decimal: 'decimal',
    unsignedDecimal: 'decimal unsigned',
    float: 'float',
    double: 'double',
    boolean: 'boolean',
    enum: 'enum',
    set: 'set',
    json: 'json',
    jsonb: 'jsonb',
    date: 'date',
    dateTime: 'datetime',
    dateTimeTz: 'datetime',
    time: 'time',
    timeTz: 'time',
    timestamp: 'timestamp',
    timestampTz: 'timestamp',
    year: 'year',
    binary: 'blob',
    uuid: 'uuid',
    ulid: 'char(26)',
    ipAddress: 'varchar(45)',
    macAddress: 'varchar(17)',
    foreignId: 'bigint unsigned',
    foreignUuid: 'uuid',
    foreignUlid: 'char(26)',
};
const AUTO_KEYS: Record<string, string> = {
    id: 'bigint unsigned',
    bigIncrements: 'bigint unsigned',
    increments: 'int unsigned',
    smallIncrements: 'smallint unsigned',
    tinyIncrements: 'tinyint unsigned',
    mediumIncrements: 'mediumint unsigned',
};
/** Calls that change nothing the schema model records. */
const NEUTRAL = new Set(['engine', 'charset', 'collation', 'comment', 'temporary']);

const ACTION_CALLS: Record<string, [kind: 'delete' | 'update', action: string]> = {
    cascadeOnDelete: ['delete', 'cascade'],
    restrictOnDelete: ['delete', 'restrict'],
    nullOnDelete: ['delete', 'set null'],
    noActionOnDelete: ['delete', 'no action'],
    cascadeOnUpdate: ['update', 'cascade'],
    restrictOnUpdate: ['update', 'restrict'],
    nullOnUpdate: ['update', 'set null'],
    noActionOnUpdate: ['update', 'no action'],
};

function indexName(table: string, cols: readonly string[], type: string): string {
    return `${table}_${cols.join('_')}_${type}`.toLowerCase().replace(/[-.]/g, '_');
}

function snakePlural(name: string): string {
    const snake = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    if (/[^aeiou]y$/.test(snake)) return `${snake.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/.test(snake)) return `${snake}es`;
    return `${snake}s`;
}

function snake(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Blueprint statements of one `create` / `table` closure → operations. */
function blueprintOps(
    body: string,
    bodyOffset: number,
    v: string,
    table: string,
    base: { connection: string; uncertain?: string },
    at: (offset: number) => SchemaAt,
): DdlOp[] {
    const ops: DdlOp[] = [];
    const push = (offset: number, op: Record<string, unknown>): void => {
        ops.push({ ...base, at: at(offset), ...op } as DdlOp);
    };
    for (const part of splitTop(body, ';')) {
        const offset = bodyOffset + part.offset + (part.text.length - part.text.trimStart().length);
        const chain = chainOf(part.text, v);
        if (!chain) {
            if (part.text.trim() !== '') push(offset, { op: 'gap', reason: `statement not read: ${part.text.trim().slice(0, 60)}` });
            continue;
        }
        const head = chain[0] as Call;
        const mods = chain.slice(1);
        const mod = (n: string): Call | undefined => mods.find((m) => m.name === n);
        const first = argStrings(head.args, 0);
        const change = Boolean(mod('change'));

        const fkFrom = (cols: string[], refTable: string | null, refCols: string[], nameHint?: string): void => {
            let onDelete: string | null = null;
            let onUpdate: string | null = null;
            for (const m of mods) {
                const a = ACTION_CALLS[m.name];
                if (a) {
                    if (a[0] === 'delete') onDelete = a[1];
                    else onUpdate = a[1];
                }
                if (m.name === 'onDelete') onDelete = (stringLiterals(m.args)[0] ?? '').toLowerCase() || null;
                if (m.name === 'onUpdate') onUpdate = (stringLiterals(m.args)[0] ?? '').toLowerCase() || null;
            }
            if (!refTable) return;
            const fk: IrForeignKey = {
                name: nameHint ?? indexName(table, cols, 'foreign'),
                columns: cols,
                ref_table: refTable,
                ref_columns: refCols.length ? refCols : ['id'],
                on_delete: onDelete,
                on_update: onUpdate,
            };
            push(offset, { op: 'add-fk', table, fk });
        };
        const inlineIndexes = (col: string): void => {
            if (mod('primary')) push(offset, { op: 'add-index', table, primary: true, index: { name: 'primary', columns: [col], unique: true, type: null } });
            if (mod('unique')) push(offset, { op: 'add-index', table, index: { name: argStrings(mod('unique')?.args ?? '', 0)[0] ?? indexName(table, [col], 'unique'), columns: [col], unique: true, type: null } });
            if (mod('index')) push(offset, { op: 'add-index', table, index: { name: argStrings(mod('index')?.args ?? '', 0)[0] ?? indexName(table, [col], 'index'), columns: [col], unique: false, type: null } });
        };
        const column = (name: string, type: string, extra: Partial<ColumnSpec> = {}): void => {
            const nullableCall = mod('nullable');
            const nullable = nullableCall ? !/^\s*false\s*$/.test(nullableCall.args) : extra.nullable ?? false;
            const defCall = mod('default');
            const spec: ColumnSpec = {
                name,
                type,
                nullable,
                default: defCall ? defCall.args.trim() : extra.default ?? null,
                auto_increment: extra.auto_increment ?? Boolean(mod('autoIncrement')),
                comment: mod('comment') ? stringLiterals(mod('comment')?.args ?? '')[0] ?? null : null,
            };
            push(offset, { op: change ? 'modify-column' : 'add-column', table, column: spec });
        };

        const name = head.name;
        if (AUTO_KEYS[name]) {
            const col = first[0] ?? 'id';
            column(col, AUTO_KEYS[name] as string, { auto_increment: true });
            push(offset, { op: 'add-index', table, primary: true, index: { name: 'primary', columns: [col], unique: true, type: null } });
            continue;
        }
        if (name === 'foreignIdFor') {
            const model = /([\w\\]+)::class/.exec(head.args)?.[1]?.split('\\').pop();
            const col = argStrings(head.args, 1)[0] ?? (model ? `${snake(model)}_id` : null);
            if (!col) {
                push(offset, { op: 'gap', reason: 'foreignIdFor with an unreadable model' });
                continue;
            }
            column(col, 'bigint unsigned');
            inlineIndexes(col);
            const constrained = mod('constrained');
            if (constrained) fkFrom([col], argStrings(constrained.args, 0)[0] ?? (model ? snakePlural(model) : null), argStrings(constrained.args, 1));
            continue;
        }
        if (TYPE_MAP[name] && first[0]) {
            const col = first[0];
            column(col, TYPE_MAP[name] as string);
            inlineIndexes(col);
            const constrained = mod('constrained');
            if (constrained) {
                const stem = col.replace(/_id$/, '');
                fkFrom([col], argStrings(constrained.args, 0)[0] ?? snakePlural(stem), argStrings(constrained.args, 1));
            }
            const references = mod('references');
            const on = mod('on');
            if (references && on) fkFrom([col], stringLiterals(on.args)[0] ?? null, stringLiterals(references.args));
            continue;
        }
        if (name === 'timestamps' || name === 'timestampsTz' || name === 'nullableTimestamps') {
            column('created_at', 'timestamp', { nullable: true });
            column('updated_at', 'timestamp', { nullable: true });
            continue;
        }
        if (name === 'softDeletes' || name === 'softDeletesTz') {
            column(first[0] ?? 'deleted_at', 'timestamp', { nullable: true });
            continue;
        }
        if (name === 'rememberToken') {
            column('remember_token', 'varchar(100)', { nullable: true });
            continue;
        }
        if (name === 'morphs' || name === 'nullableMorphs' || name === 'uuidMorphs' || name === 'ulidMorphs') {
            const stem = first[0];
            if (!stem) continue;
            const nullable = name === 'nullableMorphs';
            column(`${stem}_type`, 'varchar', { nullable });
            column(`${stem}_id`, name === 'uuidMorphs' ? 'uuid' : name === 'ulidMorphs' ? 'char(26)' : 'bigint unsigned', { nullable });
            push(offset, { op: 'add-index', table, index: { name: indexName(table, [`${stem}_type`, `${stem}_id`], 'index'), columns: [`${stem}_type`, `${stem}_id`], unique: false, type: null } });
            continue;
        }
        if (name === 'index' || name === 'unique' || name === 'primary' || name === 'fullText' || name === 'spatialIndex') {
            if (first.length === 0) {
                push(offset, { op: 'gap', reason: `${name}() with columns this reader cannot read` });
                continue;
            }
            const explicit = argStrings(head.args, 1)[0];
            if (name === 'primary') {
                push(offset, { op: 'add-index', table, primary: true, index: { name: 'primary', columns: first, unique: true, type: null } });
                continue;
            }
            const suffix = name === 'unique' ? 'unique' : name === 'fullText' ? 'fulltext' : name === 'spatialIndex' ? 'spatialindex' : 'index';
            push(offset, {
                op: 'add-index',
                table,
                index: { name: explicit ?? indexName(table, first, suffix), columns: first, unique: name === 'unique', type: name === 'fullText' ? 'fulltext' : name === 'spatialIndex' ? 'spatial' : null },
            });
            continue;
        }
        if (name === 'foreign') {
            const references = mod('references');
            const on = mod('on');
            fkFrom(first, on ? stringLiterals(on.args)[0] ?? null : null, references ? stringLiterals(references.args) : [], argStrings(head.args, 1)[0]);
            if (!on) push(offset, { op: 'gap', reason: 'foreign() without a readable on()' });
            continue;
        }
        if (name === 'dropColumn' || name === 'dropColumns') {
            const cols = splitTop(head.args, ',').flatMap((p) => stringLiterals(p.text));
            for (const c of cols) push(offset, { op: 'drop-column', table, column: c });
            continue;
        }
        if (name === 'renameColumn') {
            const [from, to] = stringLiterals(head.args);
            if (from && to) push(offset, { op: 'rename-column', table, column: from, to });
            continue;
        }
        if (name === 'dropIndex' || name === 'dropUnique' || name === 'dropFullText' || name === 'dropSpatialIndex' || name === 'dropForeign') {
            const isArray = /^\s*\[/.test(head.args);
            const suffix = { dropIndex: 'index', dropUnique: 'unique', dropFullText: 'fulltext', dropSpatialIndex: 'spatialindex', dropForeign: 'foreign' }[name] as string;
            const idx = isArray ? indexName(table, first, suffix) : (first[0] ?? '');
            push(offset, { op: name === 'dropForeign' ? 'drop-fk' : 'drop-index', table, name: idx });
            continue;
        }
        if (name === 'dropConstrainedForeignId' && first[0]) {
            push(offset, { op: 'drop-fk', table, name: indexName(table, [first[0]], 'foreign') });
            push(offset, { op: 'drop-column', table, column: first[0] });
            continue;
        }
        if (name === 'dropPrimary') {
            push(offset, { op: 'drop-primary', table });
            continue;
        }
        if (name === 'dropTimestamps' || name === 'dropTimestampsTz') {
            push(offset, { op: 'drop-column', table, column: 'created_at' });
            push(offset, { op: 'drop-column', table, column: 'updated_at' });
            continue;
        }
        if (name === 'dropSoftDeletes' || name === 'dropSoftDeletesTz') {
            push(offset, { op: 'drop-column', table, column: first[0] ?? 'deleted_at' });
            continue;
        }
        if (name === 'dropRememberToken') {
            push(offset, { op: 'drop-column', table, column: 'remember_token' });
            continue;
        }
        if (name === 'dropMorphs' && first[0]) {
            push(offset, { op: 'drop-index', table, name: indexName(table, [`${first[0]}_type`, `${first[0]}_id`], 'index') });
            push(offset, { op: 'drop-column', table, column: `${first[0]}_type` });
            push(offset, { op: 'drop-column', table, column: `${first[0]}_id` });
            continue;
        }
        if (name === 'rename' && first[0]) {
            push(offset, { op: 'rename-table', table, to: first[0] });
            continue;
        }
        if (NEUTRAL.has(name)) continue;
        push(offset, { op: 'gap', reason: `Blueprint call ${name}() not modelled` });
    }
    return ops;
}

/** `[start, end)` ranges of `if` / `else` / `foreach` / `while` blocks inside `body`. */
function conditionalRanges(body: string): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (const m of body.matchAll(/\b(?:if|elseif|foreach|while)\s*\(/g)) {
        const open = (m.index as number) + m[0].length - 1;
        const close = closingBracket(body, open);
        if (close < 0) continue;
        const brace = /^\s*\{/.exec(body.slice(close + 1));
        if (!brace) continue;
        const b = close + 1 + brace[0].length - 1;
        const end = closingBracket(body, b);
        if (end > 0) out.push([b, end]);
    }
    for (const m of body.matchAll(/\belse\s*\{/g)) {
        const b = (m.index as number) + m[0].length - 1;
        const end = closingBracket(body, b);
        if (end > 0) out.push([b, end]);
    }
    return out;
}

/** One migration file → operations. `defaultName` folds `connection('mysql')` into the default when that is its name. */
export function laravelMigrationOps(file: SourceText, defaultName: string | null = null): DdlOp[] {
    const src = blankComments(file.source, 'php');
    const lineOf = lineIndex(src);
    const at = (offset: number): SchemaAt => witnessAt(file.path, file.source, lineOf, offset);
    const norm = (c: string | undefined | null): string => (!c || c === defaultName ? '' : c);
    const classConnection = /\$connection\s*=\s*['"](\w+)['"]/.exec(src)?.[1];
    const up = /function\s+up\s*\([^)]*\)\s*(?::\s*\??\w+\s*)?\{/.exec(src);
    if (!up) return [];
    const upOpen = up.index + up[0].length - 1;
    const upClose = closingBracket(src, upOpen);
    const body = src.slice(upOpen, upClose < 0 ? src.length : upClose);
    const conditional = conditionalRanges(body);
    const ops: DdlOp[] = [];
    let sawSchema = false;

    for (const m of body.matchAll(/Schema::(?:connection\(\s*['"](\w+)['"]\s*\)\s*->\s*)?(create|table|drop|dropIfExists|rename|dropColumns)\s*\(/g)) {
        sawSchema = true;
        const local = m.index as number;
        const offset = upOpen + local;
        const connection = norm(m[1] ?? classConnection);
        const cond = conditional.some(([s, e]) => s < local && local < e);
        const base = cond ? { connection, uncertain: 'statement inside a condition the reader cannot evaluate' } : { connection };
        const open = local + m[0].length - 1;
        const close = closingBracket(body, open);
        const args = body.slice(open + 1, close < 0 ? body.length : close);
        const names = argStrings(args, 0);
        const table = names[0];
        if (!table) {
            ops.push({ ...base, op: 'gap', at: at(offset), reason: `Schema::${m[2]}() with a table name built at runtime` });
            continue;
        }
        const verb = m[2] as string;
        if (verb === 'drop' || verb === 'dropIfExists') {
            ops.push({ ...base, op: 'drop-table', table, at: at(offset) });
            continue;
        }
        if (verb === 'rename') {
            const to = argStrings(args, 1)[0];
            if (to) ops.push({ ...base, op: 'rename-table', table, to, at: at(offset) });
            continue;
        }
        if (verb === 'dropColumns') {
            for (const c of splitTop(args, ',').slice(1).flatMap((p) => stringLiterals(p.text))) ops.push({ ...base, op: 'drop-column', table, column: c, at: at(offset) });
            continue;
        }
        if (verb === 'create') ops.push({ ...base, op: 'create-table', table, at: at(offset) });
        const closure = /function\s*\(\s*(?:\??[\w\\]+\s+)?\$(\w+)\s*\)\s*(?:use\s*\([^)]*\)\s*)?(?::\s*\w+\s*)?\{/.exec(args);
        if (!closure) {
            ops.push({ ...base, op: 'gap', at: at(offset), reason: `Schema::${verb}('${table}') without a readable closure` });
            continue;
        }
        const bOpen = closure.index + closure[0].length - 1;
        const bClose = closingBracket(args, bOpen);
        const bBody = args.slice(bOpen + 1, bClose < 0 ? args.length : bClose);
        const bOffset = upOpen + open + 1 + bOpen + 1;
        ops.push(...blueprintOps(bBody, bOffset, closure[1] as string, table, base, at));
    }

    for (const m of body.matchAll(/\bDB::(?:connection\([^)]*\)\s*->\s*)?(?:statement|unprepared)\s*\(/g)) {
        ops.push({ connection: norm(classConnection), op: 'gap', at: at(upOpen + (m.index as number)), reason: 'raw SQL statement not replayed' });
    }
    if (!sawSchema && ops.length === 0 && /\bSchema::/.test(body)) {
        ops.push({ connection: norm(classConnection), op: 'gap', at: at(upOpen), reason: 'schema calls in a shape this reader does not read' });
    }
    return ops;
}

/** Every migration under `files`, in apply order, plus the configured engines. */
export function readLaravelSchema(files: readonly SourceText[], configSource: string | null): LaravelSchemaRead {
    const { engines, defaultName } = laravelEngines(configSource);
    const migrations = files.filter((f) => isLaravelMigration(f.path)).sort((a, b) => {
        const ka = a.path.split('/').pop() as string;
        const kb = b.path.split('/').pop() as string;
        return ka < kb ? -1 : ka > kb ? 1 : a.path < b.path ? -1 : 1;
    });
    const ops = migrations.flatMap((f) => laravelMigrationOps(f, defaultName));
    return { ops, engines, defaultName };
}
