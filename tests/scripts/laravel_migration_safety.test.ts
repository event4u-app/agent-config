/**
 * R-A6 for Laravel migrations: fire, near-miss and waived cases. The near-miss
 * is the same operations on a table the same migration creates.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { scan_dir as scan } from '../../src/scripts/_lib/persistence/detect_migration_safety_laravel.js';
import { analyze } from '../../src/scripts/_lib/persistence/detect_index_parity.js';
import { run_lint } from '../../src/scripts/lint_persistence.js';

const scan_dir = (dir: string) => scan(dir).findings;

const tmp: string[] = [];
afterAll(() => {
    for (const d of tmp) fs.rmSync(d, { recursive: true, force: true });
});

const HEAD = `<?php
use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;
return new class extends Migration {
    public function up(): void {
`;
const TAIL = `    }
};
`;
const CREATE = `        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('number');
            $table->decimal('legacy_total');
        });
`;

function project(files: Record<string, string>, driver = 'pgsql'): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-'));
    tmp.push(dir);
    fs.mkdirSync(path.join(dir, 'config'));
    fs.writeFileSync(
        path.join(dir, 'config', 'database.php'),
        `<?php\nreturn ['default' => env('DB_CONNECTION', '${driver}'), 'connections' => ['${driver}' => ['driver' => '${driver}']]];\n`,
    );
    fs.mkdirSync(path.join(dir, 'database', 'migrations'), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, 'database', 'migrations', name), HEAD + body + TAIL);
    }
    return dir;
}

const ALTER = (line: string): string => `        Schema::table('invoices', function (Blueprint $table) {
            ${line}
        });
`;

describe('Laravel migration safety (R-A6, advice)', () => {
    it('fires on each shape against a table an earlier migration created', () => {
        const dir = project({
            '2024_01_01_000001_create.php': CREATE,
            '2024_02_01_000001_drop.php': ALTER(`$table->dropColumn('legacy_total');`),
            '2024_02_01_000002_change.php': ALTER(`$table->string('number', 64)->change();`),
            '2024_02_01_000003_notnull.php': ALTER(`$table->string('currency');`),
            '2024_02_01_000004_index.php': ALTER(`$table->index('number');`),
            '2024_02_01_000005_droptable.php': `        Schema::drop('invoices');\n`,
        });
        const f = scan_dir(dir);
        expect(f.map((x) => /^\[(\w[\w-]*)\]/.exec(x.message)?.[1]).sort()).toEqual([
            'blocking',
            'blocking',
            'data-dependent',
            'destructive',
            'destructive',
        ]);
        expect(f.every((x) => x.tier === 'advice' && x.failure_class === 'F6')).toBe(true);
    });

    it('stays silent on the same operations inside the creating migration', () => {
        const dir = project({
            '2024_01_01_000001_create.php':
                CREATE + ALTER(`$table->dropColumn('legacy_total'); $table->string('currency'); $table->index('number');`),
        });
        expect(scan_dir(dir)).toEqual([]);
    });

    it('does not flag a nullable column, a defaulted column, or an index on mysql', () => {
        const dir = project(
            {
                '2024_01_01_000001_create.php': CREATE,
                '2024_02_01_000001_ok.php': ALTER(
                    `$table->string('a')->nullable(); $table->string('b')->default('x'); $table->index('number');`,
                ),
            },
            'mysql',
        );
        expect(scan_dir(dir)).toEqual([]);
    });

    it('reports a guarded drop as conditional instead of skipping it', () => {
        const dir = project({
            '2024_01_01_000001_create.php': CREATE,
            '2024_02_01_000001_guarded.php': `        if (Schema::hasColumn('invoices', 'legacy_total')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropColumn('legacy_total');
            });
        }
`,
        });
        const f = scan_dir(dir);
        expect(f).toHaveLength(1);
        expect(f[0]!.message).toMatch(/conditional/);
    });

    it('does not flag columns the database fills: useCurrent, storedAs', () => {
        const dir = project({
            '2024_01_01_000001_create.php': CREATE,
            '2024_02_01_000001_ok.php': ALTER(
                `$table->timestamp('issued_at')->useCurrent();\n            $table->string('slug')->storedAs('lower(number)');`,
            ),
        });
        expect(scan_dir(dir)).toEqual([]);
    });

    it('treats ->default(null) on a NOT NULL column as no default', () => {
        const dir = project({
            '2024_01_01_000001_create.php': CREATE,
            '2024_02_01_000001_null.php': ALTER(`$table->string('x')->default(null);`),
        });
        expect(scan_dir(dir).map((x) => x.message)).toEqual([expect.stringMatching(/data-dependent/)]);
    });

    it('does not borrow the default engine for a connection the config does not name', () => {
        const dir = project({
            '2024_01_01_000001_create.php': CREATE,
            '2024_02_01_000001_other.php': `        Schema::connection('other')->table('events', function (Blueprint $table) {
            $table->index('kind');
        });
`,
        });
        expect(scan_dir(dir)).toEqual([]);
    });

    it('follows a rename inside the creating migration', () => {
        const dir = project({
            '2024_01_01_000001_create.php':
                `        Schema::create('tmp', function (Blueprint $table) { $table->id(); $table->string('x'); });\n        Schema::rename('tmp', 'orders');\n` +
                `        Schema::table('orders', function (Blueprint $table) { $table->index('x'); });\n`,
        });
        expect(scan_dir(dir)).toEqual([]);
    });

    it('keeps a service that drops a temporary table a query file for index parity', () => {
        const dir = project({ '2024_01_01_000001_create.php': CREATE });
        fs.mkdirSync(path.join(dir, 'app', 'Services'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'app', 'Services', 'Cleanup.php'),
            `<?php\nnamespace App\\Services;\nuse App\\Models\\Invoice;\nclass Cleanup { public function run() {\n    Invoice::where('number', 'x')->get();\n    Schema::dropIfExists('tmp_export');\n} }\n`,
        );
        expect(analyze(dir).refs.some((r) => r.column === 'number')).toBe(true);
        expect(scan_dir(dir)).toEqual([]);
    });

    it('fails the run on a migration-unsafe waiver with no reason', () => {
        const dir = project({
            '2024_01_01_000001_create.php': CREATE,
            '2024_02_01_000001_drop.php': ALTER(`// migration-unsafe:\n            $table->dropColumn('legacy_total');`),
        });
        expect(run_lint(dir, ['eloquent']).empty_reason_waivers).toHaveLength(1);
    });

    it('counts a migration-unsafe waiver as waived', () => {
        const dir = project({
            '2024_01_01_000001_create.php': CREATE,
            '2024_02_01_000001_drop.php': ALTER(
                `// migration-unsafe: column unused since 2023, backed up\n            $table->dropColumn('legacy_total');`,
            ),
        });
        const f = scan_dir(dir);
        expect(f).toHaveLength(1);
        expect(f[0]!.waived).toBe(true);
    });
});
