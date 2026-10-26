import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { diffBranches, gcBranches, indexBranch, listManifests, onBranches, readManifest } from '../../../src/scripts/code_graph/branches.js';

let root: string;
let build: string;
const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: root, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@x.invalid', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@x.invalid' } });
const w = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};
const lock = (react: string): string =>
    JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { react: '>=18' } }, 'node_modules/react': { version: react, resolved: `https://registry.npmjs.org/react/-/react-${react}.tgz` } } }, null, 2);
const migration = (body: string): string =>
    `<?php\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration {\n    public function up(): void\n    {\n        ${body}\n    }\n};\n`;

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-branches-')));
    build = path.join(root, '.cache');
    git('init', '-q', '-b', 'main');
    w('.gitignore', '.cache/\n');
    w('package.json', JSON.stringify({ dependencies: { react: '>=18' } }));
    w('package-lock.json', lock('18.2.0'));
    w('composer.json', JSON.stringify({ require: { 'laravel/framework': '^11.0' } }));
    w('src/a.ts', 'export function a(): number {\n    return 1;\n}\n');
    w('database/migrations/2026_01_01_000000_create_orders_table.php', migration("Schema::create('orders', function (Blueprint $table) {\n            $table->id();\n        });"));
    git('add', '.');
    git('commit', '-qm', 'init');
    git('checkout', '-qb', 'feat-x');
    w('package-lock.json', lock('19.0.0'));
    w('src/b.ts', 'export function b(): number {\n    return 2;\n}\n');
    w('database/migrations/2026_01_02_000000_add_status_to_orders.php', migration("Schema::table('orders', function (Blueprint $table) {\n            $table->string('status');\n        });"));
    git('add', '.');
    git('commit', '-qm', 'feat');
    git('checkout', '-q', 'main');
    git('branch', '-q', 'release/1');
    git('branch', '-q', 'old');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('branch manifests and content-addressed facts', () => {
    it('a branch differing in three files costs facts for those three only, read without a checkout', async () => {
        const first = await indexBranch(root, build, 'main', { day: '2026-10-01' });
        expect(first.written).toBeGreaterThan(0);
        const second = await indexBranch(root, build, 'feat-x', { day: '2026-10-01' });
        // src/b.ts → its symbols; package-lock.json → the package set; the new migration → its symbols and the schema set.
        expect(second.written).toBe(4);
        expect(git('rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main');
        expect(fs.existsSync(path.join(root, 'src', 'b.ts'))).toBe(false);
        const again = await indexBranch(root, build, 'feat-x', { day: '2026-10-01' });
        expect(again.written).toBe(0);
    }, 60_000);

    it('answers on which branches a column, a package version and a symbol exist', () => {
        expect(onBranches(build, 'orders.status').map((x) => x.ref)).toEqual(['feat-x']);
        expect(onBranches(build, 'react').map((x) => `${x.ref} ${x.what}`)).toEqual(['feat-x npm:react@19.0.0', 'main npm:react@18.2.0']);
        expect(onBranches(build, 'b').map((x) => x.ref)).toEqual(['feat-x']);
        expect(onBranches(build, 'src/a.ts').map((x) => x.ref)).toEqual(['feat-x', 'main']);
    });

    it('a branch diff is a manifest diff, then a fact diff', () => {
        const d = diffBranches(build, readManifest(build, 'main')!, readManifest(build, 'feat-x')!);
        expect(d.files.added).toEqual(['database/migrations/2026_01_02_000000_add_status_to_orders.php', 'src/b.ts']);
        expect(d.files.changed).toEqual(['package-lock.json']);
        expect(d.packages.changed).toEqual([['npm:react', '18.2.0', '19.0.0']]);
        expect(d.columns.added).toEqual(['orders.status']);
        expect(d.symbols.added).toContain('src/b.ts#b');
        expect(d.symbols.added.every((id) => id.startsWith('src/b.ts') || id.startsWith('database/migrations/2026_01_02'))).toBe(true);
        expect(d.symbols.removed).toEqual([]);
    });
});

describe('clean-up by itself', () => {
    it('drops an unseen or deleted branch with its facts, keeps pinned ones, deletes no git ref', async () => {
        await indexBranch(root, build, 'release/1', { day: '2026-10-01' });
        await indexBranch(root, build, 'old', { day: '2026-10-01' });
        git('branch', '-q', '-D', 'old');
        const r = gcBranches(root, build, { day: '2026-11-15', now: Date.now() + 3_600_000 });
        expect(r.dropped.map((x) => `${x.ref}: ${x.why}`).sort()).toEqual(['feat-x: unseen since 2026-10-01', 'old: the local branch is gone']);
        expect(r.kept.map((x) => `${x.ref}: ${x.why}`).sort()).toEqual(['main: default branch', 'release/1: release line']);
        expect(r.swept).toBe(4);
        expect(listManifests(build).map((m) => m.ref)).toEqual(['main', 'release/1']);
        expect(git('show-ref', '--verify', 'refs/heads/feat-x')).toMatch(/refs\/heads\/feat-x/);
    }, 60_000);
});

describe('the branch verbs', () => {
    const cli = (...args: string[]): { code: number; out: string } => {
        try {
            const out = execFileSync(path.resolve('node_modules/.bin/tsx'), [path.resolve('src/scripts/code_graph/cli.ts'), ...args, '--root', root, '--graph', path.join(root, '.cache', 'g.json')], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
            return { code: 0, out };
        } catch (e) {
            const err = e as { status?: number; stdout?: string };
            return { code: err.status ?? -1, out: err.stdout ?? '' };
        }
    };

    it('index, on-branches, branch-diff and why --branch answer from the store', () => {
        expect(cli('branches', 'index', 'main', 'feat-x').out).toMatch(/indexed main @ \w{8}[\s\S]*indexed feat-x @ \w{8}/);
        expect(cli('on-branches', 'orders.status').out).toMatch(/^feat-x\s+\w{8}\s+column orders\.status$/m);
        expect(cli('branch-diff', 'main', 'feat-x').out).toMatch(/packages changed \(1\):\n {2}npm:react 18\.2\.0 → 19\.0\.0/);
        const why = cli('why', 'react', '--branch', 'feat-x');
        expect(why.code).toBe(0);
        expect(why.out).toMatch(/react@19\.0\.0/);
        expect(cli('usage', 'react', '--branch', 'feat-x').code).toBe(1);
        expect(cli('branches', 'list').out).toMatch(/feat-x[\s\S]*main/);
    }, 120_000);
});
