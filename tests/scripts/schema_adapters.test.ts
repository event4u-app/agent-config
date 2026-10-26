/**
 * Tests for the four schema-erd adapters.
 *
 * Every adapter is held to the same three properties, because those are the
 * ones the rest of the pipeline depends on: the IR it emits validates clean, it
 * declares a normalisation class, and it counts what it dropped instead of
 * silently narrowing its own scope. Fixtures live in
 * tests/fixtures/schema-erd/ and are the pre-registered ground truth.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { serializeIr, validateIr, type SchemaIr } from '../../src/scripts/_lib/schema/ir.js';
import { parseDdl } from '../../src/scripts/_lib/schema/adapters/ddl.js';
import { parsePrisma } from '../../src/scripts/_lib/schema/adapters/prisma.js';
import { parseTbls } from '../../src/scripts/_lib/schema/adapters/tbls.js';
import { emitProbe, ingestProbe } from '../../src/scripts/_lib/schema/adapters/laravel_probe.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '..', 'fixtures', 'schema-erd');
const read = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const table = (ir: SchemaIr, name: string) => ir.tables.find((t) => t.name === name);
const column = (ir: SchemaIr, t: string, c: string) => table(ir, t)?.columns.find((x) => x.name === c);

describe('ddl adapter', () => {
    const ir = parseDdl(read('current.sql'), { dialect: 'mysql', kind: 'sql', ref: 'current.sql' });

    it('emits an IR that validates clean', () => {
        expect(validateIr(ir)).toEqual([]);
    });

    it('declares the static normalisation class', () => {
        expect(ir.source.normalization_class).toBe('static');
        expect(ir.source.kind).toBe('sql');
    });

    it('reads every base table and skips the view rather than dropping it silently', () => {
        expect(ir.tables.map((t) => t.name).sort()).toEqual(['legacy_audit', 'orders', 'users']);
        expect(ir.skipped.views).toBe(1);
    });

    it('reads column type, nullability, default and auto-increment', () => {
        expect(column(ir, 'users', 'id')).toMatchObject({ type: 'bigint unsigned', nullable: false, auto_increment: true });
        expect(column(ir, 'users', 'email')).toMatchObject({ type: 'varchar(255)', nullable: false });
        expect(column(ir, 'users', 'created_at')).toMatchObject({ nullable: true });
        expect(column(ir, 'orders', 'total_cents')?.default).toBe('0');
        expect(column(ir, 'orders', 'note')).toMatchObject({ type: 'text', nullable: true });
    });

    // An enum body carries commas and the keyword `default` inside quotes; both
    // would break a naive top-level split.
    it('keeps a parenthesised enum body attached to the type', () => {
        expect(column(ir, 'users', 'status')?.type).toBe("enum('active','pending','banned')");
        expect(column(ir, 'users', 'status')?.default).toBe("'pending'");
    });

    it('reads the primary key, the unique index and the plain index', () => {
        expect(table(ir, 'users')?.primary_key).toEqual(['id']);
        const unique = table(ir, 'users')?.indexes.find((x) => x.name === 'users_email_unique');
        expect(unique).toMatchObject({ columns: ['email'], unique: true });
        const plain = table(ir, 'orders')?.indexes.find((x) => x.name === 'orders_user_id_index');
        expect(plain).toMatchObject({ columns: ['user_id'], unique: false });
    });

    it('reads the foreign key with its referential action', () => {
        expect(table(ir, 'orders')?.foreign_keys[0]).toMatchObject({
            name: 'orders_user_id_foreign',
            columns: ['user_id'],
            ref_table: 'users',
            ref_columns: ['id'],
            on_delete: 'restrict',
        });
    });

    it('serialises byte-identically across two parses', () => {
        const again = parseDdl(read('current.sql'), { dialect: 'mysql', kind: 'sql', ref: 'current.sql' });
        expect(serializeIr(again)).toBe(serializeIr(ir));
    });

    it('counts a generated column instead of inventing a type for it', () => {
        const generated = parseDdl(
            'CREATE TABLE t (`id` int NOT NULL, `total` int GENERATED ALWAYS AS (`id` * 2) STORED, PRIMARY KEY (`id`));',
            { dialect: 'mysql', kind: 'sql', ref: 'inline' },
        );
        expect(generated.skipped.generated_columns).toBe(1);
        expect(table(generated, 't')?.columns.map((c) => c.name)).toEqual(['id']);
    });

    it('counts a check constraint and a trigger', () => {
        const extra = parseDdl(
            'CREATE TABLE t (`id` int NOT NULL, CONSTRAINT `c1` CHECK (`id` > 0));\n' +
                'CREATE TRIGGER trg BEFORE INSERT ON t FOR EACH ROW SET NEW.id = 1;',
            { dialect: 'mysql', kind: 'sql', ref: 'inline' },
        );
        expect(extra.skipped.check_constraints).toBe(1);
        expect(extra.skipped.triggers).toBe(1);
    });

    it('attaches a standalone CREATE INDEX and an ALTER TABLE foreign key', () => {
        const standalone = parseDdl(
            'CREATE TABLE a ("id" integer NOT NULL, PRIMARY KEY ("id"));\n' +
                'CREATE TABLE b ("id" integer NOT NULL, "a_id" integer NOT NULL, PRIMARY KEY ("id"));\n' +
                'CREATE UNIQUE INDEX b_a_id_uq ON b ("a_id");\n' +
                'ALTER TABLE b ADD CONSTRAINT b_a_id_fk FOREIGN KEY ("a_id") REFERENCES a ("id") ON DELETE CASCADE;',
            { dialect: 'pgsql', kind: 'sql', ref: 'inline' },
        );
        expect(table(standalone, 'b')?.indexes[0]).toMatchObject({ name: 'b_a_id_uq', unique: true });
        expect(table(standalone, 'b')?.foreign_keys[0]).toMatchObject({ ref_table: 'a', on_delete: 'cascade' });
    });

    it('preserves composite index column order', () => {
        const composite = parseDdl(
            'CREATE TABLE t (`a` int NOT NULL, `b` int NOT NULL, KEY `ix` (`b`,`a`));',
            { dialect: 'mysql', kind: 'sql', ref: 'inline' },
        );
        expect(table(composite, 't')?.indexes[0]?.columns).toEqual(['b', 'a']);
    });
});

describe('prisma adapter', () => {
    const ir = parsePrisma(read('schema.prisma'), { dialect: 'mysql', ref: 'schema.prisma' });

    it('emits an IR that validates clean and declares the static class', () => {
        expect(validateIr(ir)).toEqual([]);
        expect(ir.source.normalization_class).toBe('static');
        expect(ir.source.kind).toBe('prisma');
    });

    // Without @@map / @map resolution a Prisma IR and a DDL IR would disagree on
    // every mapped name while describing the same database.
    it('resolves @@map to the physical table name', () => {
        expect(ir.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
    });

    it('resolves @map to the physical column name', () => {
        expect(column(ir, 'users', 'name')).toBeDefined();
        expect(column(ir, 'users', 'fullName')).toBeUndefined();
        expect(column(ir, 'orders', 'total_cents')).toBeDefined();
    });

    it('prefers the native @db type over the Prisma scalar', () => {
        expect(column(ir, 'users', 'email')?.type).toBe('varchar(255)');
        expect(column(ir, 'users', 'name')?.type).toBe('varchar(191)');
    });

    it('reads optionality as nullability', () => {
        expect(column(ir, 'users', 'created_at')?.nullable).toBe(true);
        expect(column(ir, 'users', 'email')?.nullable).toBe(false);
    });

    it('resolves an enum-typed field to a concrete column rather than a relation', () => {
        expect(column(ir, 'users', 'status')?.type).toBe('userstatus');
    });

    it('reads @id, @unique and @@index', () => {
        expect(table(ir, 'users')?.primary_key).toEqual(['id']);
        expect(table(ir, 'users')?.indexes.some((x) => x.unique && x.columns[0] === 'email')).toBe(true);
        expect(table(ir, 'orders')?.indexes.some((x) => x.name === 'orders_user_id_index')).toBe(true);
    });

    // The list side of a relation is not a column and not a foreign key: the
    // key lives on the side that carries `fields:`.
    it('emits the foreign key on the owning side only', () => {
        expect(table(ir, 'users')?.foreign_keys).toEqual([]);
        expect(table(ir, 'orders')?.foreign_keys[0]).toMatchObject({
            name: 'orders_user_id_foreign',
            columns: ['user_id'],
            ref_table: 'users',
            ref_columns: ['id'],
            on_delete: 'restrict',
        });
    });

    it('emits no column for a relation field', () => {
        expect(column(ir, 'orders', 'user')).toBeUndefined();
        expect(column(ir, 'users', 'orders')).toBeUndefined();
    });

    it('serialises byte-identically across two parses', () => {
        const again = parsePrisma(read('schema.prisma'), { dialect: 'mysql', ref: 'schema.prisma' });
        expect(serializeIr(again)).toBe(serializeIr(ir));
    });
});

describe('tbls adapter', () => {
    const ir = parseTbls(JSON.parse(read('tbls-schema.json')), { dialect: 'mysql', ref: 'tbls-schema.json' });

    it('emits an IR that validates clean and declares the static class', () => {
        expect(validateIr(ir)).toEqual([]);
        expect(ir.source.normalization_class).toBe('static');
        expect(ir.source.kind).toBe('tbls-json');
    });

    it('counts a VIEW-typed entry rather than modelling it as a table', () => {
        expect(ir.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
        expect(ir.skipped.views).toBe(1);
    });

    it('counts a check constraint', () => {
        expect(ir.skipped.check_constraints).toBe(1);
    });

    // The primary key already lives in `primary_key`; a duplicate index entry
    // for it would read as an extra object in every diff.
    it('lifts the primary key out of the index list', () => {
        expect(table(ir, 'users')?.primary_key).toEqual(['id']);
        expect(table(ir, 'users')?.indexes.map((x) => x.name)).toEqual(['users_email_unique']);
    });

    it('reads uniqueness from the index definition', () => {
        expect(table(ir, 'users')?.indexes[0]?.unique).toBe(true);
        expect(table(ir, 'orders')?.indexes[0]?.unique).toBe(false);
    });

    it('maps a relation to a foreign key with its referential action', () => {
        expect(table(ir, 'orders')?.foreign_keys[0]).toMatchObject({
            columns: ['user_id'],
            ref_table: 'users',
            ref_columns: ['id'],
            on_delete: 'restrict',
        });
    });

    it('tolerates a document missing optional sections', () => {
        const sparse = parseTbls({ tables: [{ name: 't', columns: [{ name: 'id', type: 'int', nullable: false }] }] }, {
            dialect: 'sqlite',
            ref: 'inline',
        });
        expect(validateIr(sparse)).toEqual([]);
        expect(table(sparse, 't')?.indexes).toEqual([]);
    });

    it('serialises byte-identically across two parses', () => {
        const again = parseTbls(JSON.parse(read('tbls-schema.json')), { dialect: 'mysql', ref: 'tbls-schema.json' });
        expect(serializeIr(again)).toBe(serializeIr(ir));
    });
});

describe('laravel probe adapter', () => {
    it('emits a probe that reads schema through the native introspection API', () => {
        const probe = emitProbe();
        for (const call of ['getTables()', 'getColumns(', 'getIndexes(', 'getForeignKeys(']) {
            expect(probe).toContain(call);
        }
        expect(probe).toContain('json_encode');
    });

    it('scopes the probe to a named connection when one is given', () => {
        expect(emitProbe({ connection: 'tmp_erd' })).toContain('connection("tmp_erd")');
        expect(emitProbe()).not.toContain('connection(');
    });

    // The tool never opens a connection itself: that is what keeps it testable
    // here and keeps current and target state in one normalisation class.
    it('emits a probe that counts what it could not represent', () => {
        const probe = emitProbe();
        expect(probe).toContain('generated_columns');
        expect(probe).toContain("$skipped['views']");
    });

    const ingested = ingestProbe(JSON.parse(read('laravel-probe.json')), {
        kind: 'laravel-live',
        ref: 'default',
    });

    it('ingests a well-formed payload into a valid IR', () => {
        expect(ingested.findings).toEqual([]);
        expect(ingested.ir).not.toBeNull();
        expect(validateIr(ingested.ir)).toEqual([]);
    });

    it('labels an ingested state as introspection, not static', () => {
        expect(ingested.ir?.source.normalization_class).toBe('introspection');
        expect(ingested.ir?.source.kind).toBe('laravel-live');
    });

    it('carries the probe skip counters through rather than resetting them', () => {
        expect(ingested.ir?.skipped).toMatchObject({ views: 1, generated_columns: 1 });
    });

    it('maps the reported driver onto a dialect', () => {
        expect(ingested.ir?.dialect).toBe('mysql');
        const pg = ingestProbe({ dialect: 'postgres', skipped: {}, tables: [] }, { kind: 'laravel-live', ref: 'x' });
        expect(pg.findings.map((f) => f.code)).toContain('probe-skipped-counter-invalid');
    });

    it('reports rather than assumes on a payload it cannot read', () => {
        expect(ingestProbe('not json', { kind: 'laravel-live', ref: 'x' }).findings.map((f) => f.code)).toContain(
            'probe-not-an-object',
        );
        expect(
            ingestProbe({ dialect: 'oracle', skipped: {}, tables: [] }, { kind: 'laravel-live', ref: 'x' }).findings.map(
                (f) => f.code,
            ),
        ).toContain('probe-dialect-unknown');
        const noSkips = ingestProbe({ dialect: 'mysql', tables: [] }, { kind: 'laravel-live', ref: 'x' });
        expect(noSkips.findings.map((f) => f.code)).toContain('probe-skipped-missing');
        expect(noSkips.ir).toBeNull();
    });

    it('serialises byte-identically across two ingests', () => {
        const again = ingestProbe(JSON.parse(read('laravel-probe.json')), { kind: 'laravel-live', ref: 'default' });
        expect(serializeIr(again.ir as SchemaIr)).toBe(serializeIr(ingested.ir as SchemaIr));
    });
});
