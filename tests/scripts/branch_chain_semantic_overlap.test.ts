import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { levelStatus, makeGit, renderStatus, semanticKeys } from '../../src/scripts/_lib/branch_chain_status.js';

let root: string;
const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 'me', GIT_AUTHOR_EMAIL: 'me@example.com', GIT_COMMITTER_NAME: 'me', GIT_COMMITTER_EMAIL: 'me@example.com' } });
const w = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};
const migration = (body: string): string => `<?php\nreturn new class extends Migration {\n    public function up(): void\n    {\n        ${body}\n    }\n};\n`;

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-semantic-')));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'me@example.com');
    w('package.json', JSON.stringify({ name: 'app', dependencies: { express: '^4.0.0' } }, null, 2));
    git('add', '.');
    git('commit', '-qm', 'init');
    git('checkout', '-qb', 'x');
    w('database/migrations/2026_01_02_add_status_x.php', migration("Schema::table('orders', function (Blueprint $table) {\n            $table->string('status');\n        });"));
    w('routes/web.php', "<?php\nRoute::get('/orders', [OrderController::class, 'index']);\n");
    git('add', '.');
    git('commit', '-qm', 'x adds status');
    git('checkout', '-q', 'main');
    w('database/migrations/2026_01_01_add_status_main.php', migration("Schema::table('orders', function (Blueprint $table) {\n            $table->string('status')->nullable();\n        });"));
    w('routes/api.php', "<?php\nRoute::get('/orders', [ApiOrderController::class, 'index']);\n");
    git('add', '.');
    git('commit', '-qm', 'main adds status');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('semantic early warning (7.5, H18)', () => {
    it('reads tables, columns, packages and routes from an added diff', () => {
        const diff = [
            "+        Schema::create('invoices', function (Blueprint $table) {",
            "+            $table->decimal('amount');",
            '+    "lodash": "^4.17.0",',
            "+Route::post('/invoices', [InvoiceController::class, 'store']);",
            '+ALTER TABLE orders ADD COLUMN note text;',
        ].join('\n');
        expect(semanticKeys(diff).sort()).toEqual(['column amount', 'column orders.note', 'package lodash', 'route POST /invoices', 'table invoices'].sort());
    });

    it('warns on the column and the route both sides added, in different files', () => {
        const s = levelStatus(makeGit(root), { branch: 'x', parent: 'main', source: 'recorded' });
        expect(s.overlap).toEqual([]);
        expect(s.semantic).toEqual(['column status', 'route GET /orders']);
        expect(renderStatus([s])[0]).toMatch(/both added: column status, route GET \/orders/);
    });
});
