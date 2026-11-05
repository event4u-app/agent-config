import { describe, expect, it } from 'vitest';

import { deriveModelTable, migrationTouchesTable, tableOfModel } from '../../../internal/bench/code-graph/model_table.js';

describe('tableOfModel', () => {
    it('reads an explicit $table property', () => {
        expect(tableOfModel('class Apikey extends Model { protected $table = "api_keys"; }', 'Apikey')).toBe('api_keys');
    });

    it('falls back to the snake-case plural of the class name', () => {
        expect(tableOfModel('class WebhookDelivery extends Model {}', 'WebhookDelivery')).toBe('webhook_deliveries');
        expect(tableOfModel('class Thread extends Model {}', 'Thread')).toBe('threads');
        expect(tableOfModel('class VariantStructureAxis extends Model {}', 'VariantStructureAxis')).toBe('variant_structure_axes');
        expect(tableOfModel('class WebhookLog extends Model {}', 'WebhookLog')).toBe('webhook_logs');
        expect(tableOfModel('class Address extends Model {}', 'Address')).toBe('addresses');
    });
});

describe('migrationTouchesTable', () => {
    it('counts create, table, rename and drop on the table, and raw DDL', () => {
        expect(migrationTouchesTable("Schema::create('threads', function () {});", 'threads')).toBe(true);
        expect(migrationTouchesTable('Schema::table("threads", fn () => null);', 'threads')).toBe(true);
        expect(migrationTouchesTable("Schema::rename('old_threads', 'threads');", 'threads')).toBe(true);
        expect(migrationTouchesTable("Schema::dropIfExists('threads');", 'threads')).toBe(true);
        expect(migrationTouchesTable('DB::statement("ALTER TABLE `threads` ADD COLUMN x int");', 'threads')).toBe(true);
    });

    it('ignores a row-only migration and a table whose name merely contains the target', () => {
        expect(migrationTouchesTable("DB::table('threads')->update(['x' => 1]);", 'threads')).toBe(false);
        expect(migrationTouchesTable("Schema::create('thread_messages', function () {});", 'threads')).toBe(false);
        expect(migrationTouchesTable("Schema::create('threads_archive', function () {});", 'threads')).toBe(false);
    });
});

describe('deriveModelTable', () => {
    const files: Record<string, string> = {
        'app/Models/Thread.php': 'namespace App\\Models;\nclass Thread extends Model {}',
        'app/Models/ThreadMessage.php': 'class ThreadMessage extends Model {}',
        'database/migrations/2026_01_01_create_threads_table.php': "Schema::create('threads', function () {});",
        'database/migrations/2026_02_01_add_team_to_threads.php': "Schema::table('threads', function () {});",
        'database/migrations/2026_03_01_backfill_threads.php': "DB::table('threads')->update([]);",
        'database/migrations/2026_04_01_create_thread_messages.php': "Schema::create('thread_messages', function () {});",
        'vendor/x/database/migrations/create_threads.php': "Schema::create('threads', function () {});",
    };
    const read = (p: string): string => files[p] ?? '';

    it('answers the model file plus the schema migrations of its table, never vendor', () => {
        expect(deriveModelTable('Thread', Object.keys(files), read)).toEqual({
            table: 'threads',
            files: ['app/Models/Thread.php', 'database/migrations/2026_01_01_create_threads_table.php', 'database/migrations/2026_02_01_add_team_to_threads.php'],
        });
    });

    it('finds package migrations under a capitalised Database/Migrations directory', () => {
        const pkg: Record<string, string> = {
            'packages/Webkul/Webhook/src/Models/WebhookLog.php': 'class WebhookLog extends Model {}',
            'packages/Webkul/Webhook/src/Database/Migrations/2025_09_20_webhook_logs.php': "Schema::create('webhook_logs', function () {});",
        };
        expect(deriveModelTable('WebhookLog', Object.keys(pkg), (p) => pkg[p] ?? '')?.files).toEqual([
            'packages/Webkul/Webhook/src/Models/WebhookLog.php',
            'packages/Webkul/Webhook/src/Database/Migrations/2025_09_20_webhook_logs.php',
        ]);
    });

    it('refuses to pick between two declarations of the model class', () => {
        const two = { ...files, 'packages/Other/Models/Thread.php': 'class Thread extends Model {}' };
        expect(deriveModelTable('Thread', Object.keys(two), (p) => two[p as keyof typeof two] ?? '')).toBeNull();
    });
});
