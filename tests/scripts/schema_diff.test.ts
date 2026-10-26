/**
 * Tests for src/scripts/_lib/schema/diff.ts and rename_scan.ts.
 *
 * The fixture pair current.sql / target.sql carries one delta per change class
 * and is the pre-registered ground truth; its header lists them. The three
 * invariants that exist because of a named failure mode each carry a dedicated
 * case: the normalisation-class gate, the ordinal-only non-result, and the
 * refusal to guess a rename.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseDdl } from '../../src/scripts/_lib/schema/adapters/ddl.js';
import { ingestProbe } from '../../src/scripts/_lib/schema/adapters/laravel_probe.js';
import { diffIr, serializeDiff, type SchemaDiff, type TableDiff } from '../../src/scripts/_lib/schema/diff.js';
import { scanPrismaMapDelta, scanRenamesInText, toRenameMap } from '../../src/scripts/_lib/schema/rename_scan.js';
import type { SchemaIr } from '../../src/scripts/_lib/schema/ir.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '..', 'fixtures', 'schema-erd');
const read = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const current = (): SchemaIr => parseDdl(read('current.sql'), { dialect: 'mysql', kind: 'sql', ref: 'current.sql' });
const target = (): SchemaIr => parseDdl(read('target.sql'), { dialect: 'mysql', kind: 'sql', ref: 'target.sql' });

const t = (d: SchemaDiff, name: string): TableDiff => {
    const found = d.tables.find((x) => x.name === name);
    if (found === undefined) throw new Error(`table ${name} absent from diff`);
    return found;
};
const col = (d: SchemaDiff, table: string, name: string) => t(d, table).columns.find((c) => c.name === name);

describe('diffIr — the fixture pair', () => {
    const result = diffIr(current(), target());
    const diff = result.diff as SchemaDiff;

    it('produces a diff and no gate finding for a same-class pair', () => {
        expect(result.findings.filter((f) => f.tier === 'gate')).toEqual([]);
        expect(diff).not.toBeNull();
        expect(diff.cross_source).toBe(false);
    });

    it('reports the union of both states, so a removed table is still visible', () => {
        expect(diff.tables.map((x) => x.name)).toEqual(['invoices', 'legacy_audit', 'orders', 'users']);
    });

    it('classifies added, removed and modified tables', () => {
        expect(t(diff, 'invoices').status).toBe('added');
        expect(t(diff, 'legacy_audit').status).toBe('removed');
        expect(t(diff, 'users').status).toBe('modified');
        expect(t(diff, 'orders').status).toBe('modified');
    });

    it('marks every child of a removed table removed rather than unchanged', () => {
        expect(t(diff, 'legacy_audit').columns.every((c) => c.status === 'removed')).toBe(true);
    });

    it('marks every child of an added table added', () => {
        expect(t(diff, 'invoices').columns.every((c) => c.status === 'added')).toBe(true);
    });

    it('classifies a type change with a type code and the full delta', () => {
        const name = col(diff, 'users', 'name');
        expect(name?.status).toBe('modified');
        expect(name?.codes).toEqual(['type']);
        expect(name?.deltas).toEqual([{ field: 'type', from: 'varchar(191)', to: 'text' }]);
    });

    it('classifies a nullability change with a null code', () => {
        const createdAt = col(diff, 'users', 'created_at');
        expect(createdAt?.status).toBe('modified');
        expect(createdAt?.codes).toContain('null');
        expect(createdAt?.deltas.some((d) => d.field === 'nullable' && d.from === 'true' && d.to === 'false')).toBe(true);
    });

    it('classifies an added and a removed column', () => {
        expect(col(diff, 'users', 'locale')?.status).toBe('added');
        expect(col(diff, 'orders', 'note')?.status).toBe('removed');
    });

    // The one case a naive differ gets wrong in the noisiest way: `status` moved
    // ahead of `name` in the target, and nothing about it changed.
    it('reports a column whose only change is its position as unchanged', () => {
        const status = col(diff, 'users', 'status');
        expect(status?.status).toBe('unchanged');
        expect(status?.deltas).toEqual([]);
        expect(current().tables.find((x) => x.name === 'users')?.columns.find((c) => c.name === 'status')?.ordinal).toBe(
            4,
        );
        expect(target().tables.find((x) => x.name === 'users')?.columns.find((c) => c.name === 'status')?.ordinal).toBe(
            3,
        );
    });

    it('classifies a foreign key whose referential action changed', () => {
        const fk = t(diff, 'orders').foreign_keys.find((f) => f.name === 'orders_user_id_foreign');
        expect(fk?.status).toBe('modified');
        expect(fk?.codes).toContain('on_delete');
        expect(fk?.deltas.some((d) => d.field === 'on_delete' && d.from === 'restrict' && d.to === 'cascade')).toBe(true);
    });

    it('carries a table-level code set without aggregating the children away', () => {
        const users = t(diff, 'users');
        expect(users.codes).toContain('cols');
        expect(users.columns.some((c) => c.status === 'modified')).toBe(true);
        expect(users.columns.some((c) => c.status === 'unchanged')).toBe(true);
    });

    it('carries both sides skip counters so the reader can see partial fidelity', () => {
        expect(diff.skipped.from.views).toBe(1);
        expect(diff.skipped.to.views).toBe(1);
    });

    it('counts every status', () => {
        expect(diff.counts.added).toBeGreaterThan(0);
        expect(diff.counts.removed).toBeGreaterThan(0);
        expect(diff.counts.modified).toBeGreaterThan(0);
        expect(diff.counts.unchanged).toBeGreaterThan(0);
    });

    it('serialises byte-identically across two runs', () => {
        const again = diffIr(current(), target()).diff as SchemaDiff;
        expect(serializeDiff(again)).toBe(serializeDiff(diff));
    });

    it('reports an unchanged schema as entirely unchanged', () => {
        const same = diffIr(current(), current()).diff as SchemaDiff;
        expect(same.counts.added).toBe(0);
        expect(same.counts.removed).toBe(0);
        expect(same.counts.modified).toBe(0);
        expect(same.tables.every((x) => x.status === 'unchanged')).toBe(true);
    });
});

describe('diffIr — the normalisation-class invariant', () => {
    const staticIr = current();
    const introspected = ingestProbe(JSON.parse(read('laravel-probe.json')), {
        kind: 'laravel-live',
        ref: 'default',
    }).ir as SchemaIr;

    it('refuses a cross-class diff with a gate finding and no diff', () => {
        const result = diffIr(introspected, staticIr);
        expect(result.diff).toBeNull();
        expect(result.findings.map((f) => f.code)).toContain('normalization-class-mix');
        expect(result.findings.every((f) => f.tier === 'gate')).toBe(true);
    });

    it('names the escape hatch in the refusal so the reader is not stuck', () => {
        const message = diffIr(introspected, staticIr).findings[0]?.message ?? '';
        expect(message).toContain('--allow-cross-source');
    });

    it('accepts the override but attaches a warning to the artefact', () => {
        const result = diffIr(introspected, staticIr, { allowCrossSource: true });
        expect(result.diff).not.toBeNull();
        expect(result.diff?.cross_source).toBe(true);
        expect(result.findings.map((f) => f.code)).toContain('cross-source-accepted');
        expect(result.findings.every((f) => f.tier === 'advice')).toBe(true);
    });

    it('advises on a dialect mismatch without refusing', () => {
        const other = { ...current(), dialect: 'pgsql' as const };
        const result = diffIr(current(), other);
        expect(result.diff).not.toBeNull();
        expect(result.findings.map((f) => f.code)).toContain('dialect-mismatch');
    });
});

describe('diffIr — renames need proof', () => {
    const from = parseDdl('CREATE TABLE `client` (`id` int NOT NULL, `mail` varchar(255) NOT NULL, PRIMARY KEY (`id`));', {
        dialect: 'mysql',
        kind: 'sql',
        ref: 'a',
    });
    const to = parseDdl('CREATE TABLE `customer` (`id` int NOT NULL, `email` varchar(255) NOT NULL, PRIMARY KEY (`id`));', {
        dialect: 'mysql',
        kind: 'sql',
        ref: 'b',
    });

    it('reports an unproven table rename as removed plus added', () => {
        const diff = diffIr(from, to).diff as SchemaDiff;
        expect(t(diff, 'client').status).toBe('removed');
        expect(t(diff, 'customer').status).toBe('added');
        expect(diff.tables.some((x) => x.status === 'renamed')).toBe(false);
    });

    it('advises on an unproven column rename of identical shape', () => {
        const sameTableFrom = parseDdl('CREATE TABLE `t` (`id` int NOT NULL, `mail` varchar(255) NOT NULL);', {
            dialect: 'mysql',
            kind: 'sql',
            ref: 'a',
        });
        const sameTableTo = parseDdl('CREATE TABLE `t` (`id` int NOT NULL, `email` varchar(255) NOT NULL);', {
            dialect: 'mysql',
            kind: 'sql',
            ref: 'b',
        });
        const result = diffIr(sameTableFrom, sameTableTo);
        const advisory = result.findings.find((f) => f.code === 'rename-suspected');
        expect(advisory?.tier).toBe('advice');
        expect(advisory?.message).toContain('--rename-map');
        // The advisory changes nothing about the classification.
        const diff = result.diff as SchemaDiff;
        expect(col(diff, 't', 'mail')?.status).toBe('removed');
        expect(col(diff, 't', 'email')?.status).toBe('added');
    });

    it('reports a proven table rename as renamed', () => {
        const diff = diffIr(from, to, { renameMap: { tables: { client: 'customer' } } }).diff as SchemaDiff;
        const renamed = diff.tables.find((x) => x.status === 'renamed');
        expect(renamed?.name).toBe('customer');
        expect(renamed?.renamed_from).toBe('client');
        expect(diff.tables.some((x) => x.status === 'removed')).toBe(false);
        expect(diff.tables.some((x) => x.status === 'added')).toBe(false);
    });

    it('reports a proven column rename as renamed and keeps the table stable', () => {
        const diff = diffIr(from, to, {
            renameMap: { tables: { client: 'customer' }, columns: { client: { mail: 'email' } } },
        }).diff as SchemaDiff;
        const renamedColumn = t(diff, 'customer').columns.find((c) => c.status === 'renamed');
        expect(renamedColumn?.name).toBe('email');
        expect(renamedColumn?.renamed_from).toBe('mail');
        expect(renamedColumn?.codes).toContain('rename');
    });

    it('advises when a rename-map entry names a pair that is not present', () => {
        const result = diffIr(from, to, { renameMap: { tables: { ghost: 'phantom' } } });
        expect(result.findings.map((f) => f.code)).toContain('rename-map-stale');
    });
});

describe('rename_scan', () => {
    it('reads a Laravel table rename with its file and line', () => {
        const text = ['<?php', 'return new class extends Migration {', "  Schema::rename('client', 'customer');", '};'].join(
            '\n',
        );
        const evidence = scanRenamesInText(text, 'm1.php');
        expect(evidence).toEqual([{ kind: 'table', from: 'client', to: 'customer', file: 'm1.php', line: 3 }]);
    });

    it('attributes a column rename to the nearest enclosing Schema::table block', () => {
        const text = [
            '<?php',
            "Schema::table('users', function (Blueprint $table) {",
            "    $table->renameColumn('mail', 'email');",
            '});',
            "Schema::table('orders', function (Blueprint $table) {",
            "    $table->renameColumn('note', 'comment');",
            '});',
        ].join('\n');
        const evidence = scanRenamesInText(text, 'm2.php');
        expect(evidence).toEqual([
            { kind: 'column', table: 'users', from: 'mail', to: 'email', file: 'm2.php', line: 3 },
            { kind: 'column', table: 'orders', from: 'note', to: 'comment', file: 'm2.php', line: 6 },
        ]);
    });

    it('builds a rename map the differ accepts', () => {
        const evidence = scanRenamesInText(
            ["Schema::rename('client', 'customer');", "Schema::table('customer', function ($t) {", "  $t->renameColumn('mail', 'email');", '});'].join(
                '\n',
            ),
            'm3.php',
        );
        expect(toRenameMap(evidence)).toEqual({
            tables: { client: 'customer' },
            columns: { customer: { mail: 'email' } },
        });
    });

    it('reads a Prisma @@map delta as a table rename', () => {
        const before = ['model User {', '  id Int @id', '  @@map("client")', '}'].join('\n');
        const after = ['model User {', '  id Int @id', '  @@map("customer")', '}'].join('\n');
        expect(scanPrismaMapDelta(before, after, 'schema.prisma')).toEqual([
            { kind: 'table', from: 'client', to: 'customer', file: 'schema.prisma', line: 0 },
        ]);
    });

    it('reads a Prisma @map delta as a column rename keyed by the source table', () => {
        const before = ['model User {', '  mail String @map("mail")', '  @@map("users")', '}'].join('\n');
        const after = ['model User {', '  mail String @map("email")', '  @@map("users")', '}'].join('\n');
        expect(scanPrismaMapDelta(before, after, 'schema.prisma')).toEqual([
            { kind: 'column', table: 'users', from: 'mail', to: 'email', file: 'schema.prisma', line: 0 },
        ]);
    });

    it('emits nothing when no rename was declared', () => {
        expect(scanRenamesInText("Schema::create('users', function ($t) { $t->string('email'); });", 'm4.php')).toEqual(
            [],
        );
        const same = ['model User {', '  id Int @id', '  @@map("users")', '}'].join('\n');
        expect(scanPrismaMapDelta(same, same, 'schema.prisma')).toEqual([]);
    });
});
