import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * A git repository with one history of each shape provenance reads:
 *   A  main     chore: init                          — the app, no route yet
 *   B  ABC-12-orders  add orders                     — the route and the orders table
 *   M  main     Merge pull request #7 from acme/ABC-12-orders
 *   C  main     feat: status (#9)                    — a squash: the status column
 *   D  main     docs: note AC-1 holds                 — prose naming an acceptance criterion
 */
export function writeProvenanceFixture(): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-prov-')));
    const w = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    };
    const git = (...args: string[]): void => {
        execFileSync('git', args, {
            cwd: root,
            stdio: 'ignore',
            env: { ...process.env, GIT_AUTHOR_NAME: 'Dev One', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev One', GIT_COMMITTER_EMAIL: 'dev@example.com', GIT_AUTHOR_DATE: '2026-10-01T10:00:00Z', GIT_COMMITTER_DATE: '2026-10-01T10:00:00Z' },
        });
    };
    git('init', '-q', '-b', 'main');
    w('package.json', JSON.stringify({ name: 'shop', dependencies: { express: '^4.0.0' } }, null, 2));
    w('composer.json', JSON.stringify({ require: { 'laravel/framework': '^11.0' } }, null, 2));
    w('src/app.js', "const express = require('express');\nconst app = express();\nmodule.exports = app;\n");
    w('README.md', '# shop\n');
    git('add', '.');
    git('commit', '-qm', 'chore: init');
    git('checkout', '-qb', 'ABC-12-orders');
    w('src/app.js', "const express = require('express');\nconst app = express();\napp.post('/orders', (req, res) => res.send('ok'));\nmodule.exports = app;\n");
    w(
        'database/migrations/2026_10_01_000000_create_orders_table.php',
        "<?php\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration {\n    public function up(): void\n    {\n        Schema::create('orders', function (Blueprint $table) {\n            $table->id();\n        });\n    }\n};\n",
    );
    git('add', '.');
    git('commit', '-qm', 'add orders');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', '-m', 'Merge pull request #7 from acme/ABC-12-orders', 'ABC-12-orders');
    w(
        'database/migrations/2026_10_02_000000_add_status_to_orders_table.php',
        "<?php\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration {\n    public function up(): void\n    {\n        Schema::table('orders', function (Blueprint $table) {\n            $table->string('status');\n        });\n    }\n};\n",
    );
    git('add', '.');
    git('commit', '-qm', 'feat: status (#9)');
    w('README.md', '# shop\n\nAC-1 holds.\n');
    git('add', '.');
    git('commit', '-qm', 'docs: note AC-1 holds');
    git('branch', '-q', '-D', 'ABC-12-orders');
    return root;
}
