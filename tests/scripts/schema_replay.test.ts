import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parse_laravel_migrations, type SchemaMap } from '../../src/scripts/_lib/persistence/detect_index_parity.js';
import { laravelEngines, laravelMigrationOps, readLaravelSchema } from '../../src/scripts/_lib/schema/readers/laravel_migrations.js';
import { readSqlSchema, sqlDdlOps, sqlEngineHint } from '../../src/scripts/_lib/schema/readers/sql_ddl.js';
import { connectionToIr, leadingIndexState, replay, tableMap, type ReplayedTable } from '../../src/scripts/_lib/schema/replay.js';
import { validateIr } from '../../src/scripts/_lib/schema/ir.js';

const FIX = path.resolve(__dirname, '../fixtures/code-graph/correctness');

function tree(dir: string): Array<{ path: string; source: string }> {
    const out: Array<{ path: string; source: string }> = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else out.push({ path: path.relative(dir, p).split(path.sep).join('/'), source: fs.readFileSync(p, 'utf8') });
        }
    };
    walk(dir);
    return out;
}

function modelOf(dir: string) {
    const files = tree(path.join(FIX, dir));
    const read = readLaravelSchema(files, files.find((f) => f.path === 'config/database.php')?.source ?? null);
    return replay({ ops: read.ops, engines: read.engines });
}

const mig = (body: string, extra = ''): { path: string; source: string } => ({
    path: 'database/migrations/2024_01_01_000000_x.php',
    source: `<?php\nreturn new class {\n${extra}\n    public function up(): void\n    {\n${body}\n    }\n};\n`,
});

describe('Laravel migrations, replayed in order per connection', () => {
    it('keeps a table on the connection its statement names, never on the default', () => {
        const m = modelOf('p2-tenant');
        const tenant = m.connections.find((c) => c.connection === 'tenant');
        const def = m.connections.find((c) => c.connection === '');
        expect(tenant?.tables.map((t) => t.name)).toEqual(['customers', 'invoices']);
        expect(def?.tables.some((t) => t.name === 'invoices')).toBe(false);
        expect(tenant?.engine).toBe('pgsql');
        expect(def?.engine).toBe('mysql');
    });

    it('a dropped table is no table, and is kept as history', () => {
        const def = modelOf('p2-tenant').connections.find((c) => c.connection === '');
        expect(def?.tables.some((t) => t.name === 'legacy_things')).toBe(false);
        expect(def?.dropped.map((d) => d.table)).toEqual(['legacy_things']);
    });

    it('a statement inside an if is applied, marked uncertain, and makes the connection partial', () => {
        const def = modelOf('p2-tenant').connections.find((c) => c.connection === '');
        expect(def?.tables.find((t) => t.name === 'audits')?.uncertain).toBe(true);
        expect(def?.completeness).toBe('partial');
        const tenant = modelOf('p2-tenant').connections.find((c) => c.connection === 'tenant');
        expect(tenant?.completeness).toBe('complete');
    });

    it('an index dropped by a later migration no longer counts', () => {
        const posts = tableMap(modelOf('p1-blog').connections[0]!).get('posts') as ReplayedTable;
        expect(posts.indexes.map((i) => i.name)).toEqual([]);
        expect(leadingIndexState(posts, ['author_id'], 'pgsql')).toBe('missing');
    });

    it('decides the foreign-key index by engine: implicit on MySQL, missing on PostgreSQL, open when unknown', () => {
        const posts = tableMap(modelOf('p1-blog').connections[0]!).get('posts') as ReplayedTable;
        expect(leadingIndexState(posts, ['user_id'], 'pgsql')).toBe('missing');
        expect(leadingIndexState(posts, ['user_id'], 'sqlite')).toBe('missing');
        expect(leadingIndexState(posts, ['user_id'], 'mysql')).toBe('implicit');
        expect(leadingIndexState(posts, ['user_id'], 'mariadb')).toBe('implicit');
        expect(leadingIndexState(posts, ['user_id'], 'unknown')).toBe('engine-unknown');
        expect(leadingIndexState(posts, ['id'], 'pgsql')).toBe('declared');
        expect(leadingIndexState(posts, ['title'], 'mysql')).toBe('missing');
    });

    it('reads foreign-key actions from both the shorthand and the onDelete form', () => {
        const ops = laravelMigrationOps(
            mig(`Schema::create('a', function (Blueprint $t) {
    $t->foreignId('b_id')->constrained()->nullOnDelete()->cascadeOnUpdate();
    $t->unsignedBigInteger('c_id');
    $t->foreign('c_id')->references('id')->on('cs')->onDelete('restrict');
});`),
        );
        const fks = ops.flatMap((o) => (o.op === 'add-fk' ? [o.fk] : []));
        expect(fks.map((f) => [f.columns[0], f.ref_table, f.on_delete, f.on_update])).toEqual([
            ['b_id', 'bs', 'set null', 'cascade'],
            ['c_id', 'cs', 'restrict', null],
        ]);
    });

    it('replays renames and column drops, and drops the indexes built on a dropped column', () => {
        const m = replay({
            ops: [
                ...laravelMigrationOps(mig(`Schema::create('t', function (Blueprint $t) { $t->id(); $t->string('a')->index(); $t->string('b'); });`)),
                ...laravelMigrationOps({ ...mig(`Schema::table('t', function (Blueprint $t) { $t->renameColumn('b', 'c'); $t->dropColumn('a'); });`), path: 'database/migrations/2024_01_02_000000_y.php' }),
                ...laravelMigrationOps({ ...mig(`Schema::rename('t', 'u');`), path: 'database/migrations/2024_01_03_000000_z.php' }),
            ],
        });
        const t = m.connections[0]!.tables;
        expect(t.map((x) => x.name)).toEqual(['u']);
        expect(t[0]!.columns.map((c) => c.name)).toEqual(['id', 'c']);
        expect(t[0]!.indexes).toEqual([]);
    });

    it('records what it cannot read as a gap instead of guessing', () => {
        const ops = laravelMigrationOps(mig(`Schema::create('t', function (Blueprint $t) { $t->id(); $t->vector('emb', 3); });\nDB::statement('ALTER TABLE t ADD x int');`));
        const gaps = ops.flatMap((o) => (o.op === 'gap' ? [o.reason] : []));
        expect(gaps.some((g) => /vector\(\) not modelled/.test(g))).toBe(true);
        expect(gaps.some((g) => /raw SQL/.test(g))).toBe(true);
        expect(replay({ ops }).connections[0]!.completeness).toBe('partial');
    });

    it('routes a migration with its own $connection to that connection', () => {
        const ops = laravelMigrationOps(mig(`Schema::create('x', function (Blueprint $t) { $t->id(); });`, "    protected $connection = 'reports';"));
        expect(ops.every((o) => o.connection === 'reports')).toBe(true);
        expect(laravelMigrationOps(mig(`Schema::create('x', function (Blueprint $t) { $t->id(); });`, "    protected $connection = 'mysql';"), 'mysql').every((o) => o.connection === '')).toBe(true);
    });

    it('reads engines only from literal config defaults, never an environment value', () => {
        const { engines, defaultName } = laravelEngines("<?php return ['default' => env('DB_CONNECTION', 'sqlite'), 'connections' => ['sqlite' => ['driver' => 'sqlite'], 'legacy' => ['driver' => env('LEGACY_DRIVER')]]];");
        expect(defaultName).toBe('sqlite');
        expect(engines.get('')).toBe('sqlite');
        expect(engines.has('legacy')).toBe(false);
        expect(laravelEngines(null).engines.size).toBe(0);
    });

    it('witnesses every element at the line that shaped it', () => {
        const posts = tableMap(modelOf('p1-blog').connections[0]!).get('posts') as ReplayedTable;
        const col = posts.columns.find((c) => c.name === 'author_id');
        expect(col?.at.file).toBe('database/migrations/2024_01_01_000002_create_posts_table.php');
        expect(col?.at.line).toBe(14);
        expect(col?.at.hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('converts a replayed connection into valid SchemaIR for the differ and renderers', () => {
        expect(validateIr(connectionToIr(modelOf('p1-blog').connections[0]!, 'p1'))).toEqual([]);
    });
});

describe('SQL DDL, replayed in path order', () => {
    it('applies ALTER, CREATE/DROP INDEX and DROP TABLE', () => {
        const ops = sqlDdlOps({
            path: 'db/migrations/001.sql',
            source: 'CREATE TABLE a (id INT PRIMARY KEY, x INT);\nALTER TABLE a ADD COLUMN y INT, ADD CONSTRAINT a_y_fk FOREIGN KEY (y) REFERENCES b (id) ON DELETE SET NULL;\nCREATE INDEX a_x ON a (x);\nDROP INDEX a_x;\nALTER TABLE a DROP COLUMN x;',
        });
        const t = replay({ ops }).connections[0]!.tables[0]!;
        expect(t.columns.map((c) => c.name)).toEqual(['id', 'y']);
        expect(t.indexes).toEqual([]);
        expect(t.foreign_keys.map((f) => [f.name, f.on_delete])).toEqual([['a_y_fk', 'set null']]);
    });

    it('names the engine only when the text itself says so', () => {
        expect(sqlEngineHint('CREATE TABLE a (id INT AUTO_INCREMENT) ENGINE=InnoDB')).toBe('mysql');
        expect(sqlEngineHint('CREATE TABLE a (id BIGSERIAL)')).toBe('pgsql');
        expect(sqlEngineHint('CREATE TABLE a (id INTEGER PRIMARY KEY AUTOINCREMENT)')).toBe('sqlite');
        expect(sqlEngineHint('CREATE TABLE a (id INT)')).toBe('unknown');
        expect(readSqlSchema([{ path: 'a.sql', source: 'CREATE TABLE a (id BIGSERIAL);' }, { path: 'b.sql', source: 'CREATE TABLE b (id INT AUTO_INCREMENT);' }]).engine).toBe('unknown');
    });
});

describe('the index-parity linter reads the same replayed model', () => {
    const migrations = tree(path.join(FIX, 'p1-blog')).filter((f) => f.path.includes('migrations/'));

    it('stops counting an index a later migration dropped', () => {
        const schema: SchemaMap = new Map();
        parse_laravel_migrations(migrations, schema, null);
        expect(schema.get('posts')?.columns.has('author_id')).toBe(true);
        expect(schema.get('posts')?.indexed.has('author_id')).toBe(false);
    });

    it('counts a constrained foreign key as indexed on MySQL and not on PostgreSQL', () => {
        const cfg = (driver: string): string => `<?php return ['default' => '${driver}', 'connections' => ['${driver}' => ['driver' => '${driver}']]];`;
        const mysql: SchemaMap = new Map();
        parse_laravel_migrations(migrations, mysql, cfg('mysql'));
        const pgsql: SchemaMap = new Map();
        parse_laravel_migrations(migrations, pgsql, cfg('pgsql'));
        expect(mysql.get('posts')?.indexed.has('user_id')).toBe(true);
        expect(pgsql.get('posts')?.indexed.has('user_id')).toBe(false);
    });
});
