import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({ name: 'app_users', columns: [] }));
        await queryRunner.query('CREATE TABLE "audit_log" ("id" serial)');
    }

    async down(): Promise<void> {}
}
