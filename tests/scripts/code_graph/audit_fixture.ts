import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { writeProvenanceFixture } from './provenance_fixture.js';

/** Subjects of every commit the audit fixture writes — none may reach a committed map file. */
export const AUDIT_SUBJECTS = ['chore: init', 'add orders', 'Merge pull request #7 from acme/ABC-12-orders', 'feat: status (#9)', 'docs: note AC-1 holds', 'refactor: rename status migration (#11)'] as const;

/** The migration's path after the rename commit, and before it. */
export const RENAMED_MIGRATION = { from: 'database/migrations/2026_10_02_000000_add_status_to_orders_table.php', to: 'database/migrations/2026_10_02_000000_add_order_status.php' } as const;

/**
 * The audit fixture: the provenance history (a merge PR, a squash `feat: status (#9)`)
 * plus a squash that renames the status migration without changing its content.
 */
export function writeAuditFixture(): string {
    const root = writeProvenanceFixture();
    const git = (...args: string[]): void => {
        execFileSync('git', args, {
            cwd: root,
            stdio: 'ignore',
            env: { ...process.env, GIT_AUTHOR_NAME: 'Dev One', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev One', GIT_COMMITTER_EMAIL: 'dev@example.com', GIT_AUTHOR_DATE: '2026-10-03T10:00:00Z', GIT_COMMITTER_DATE: '2026-10-03T10:00:00Z' },
        });
    };
    fs.mkdirSync(path.join(root, path.dirname(RENAMED_MIGRATION.to)), { recursive: true });
    git('mv', RENAMED_MIGRATION.from, RENAMED_MIGRATION.to);
    git('commit', '-qm', AUDIT_SUBJECTS[5]);
    return root;
}

/**
 * The audit fixture with a PHP dependency tree (step 6.1 of
 * road-to-a-map-that-holds-on-the-real-repo): a classmap-only package used by a
 * root-namespace `use Dompdf;`, a PSR-4 package used through an alias, a
 * classmap class referenced fully qualified (`new \Parsedown()`), a declared but
 * unused package, and one declared in composer.json and never installed.
 * `withVendor: false` leaves `vendor/` out, as a fresh clone has it.
 */
export function writeAuditPhpFixture(opts: { withVendor?: boolean } = {}): string {
    const root = writeAuditFixture();
    const w = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    };
    w('composer.json', JSON.stringify({ require: { 'laravel/framework': '^11.0', 'dompdf/dompdf': '^2.0', 'acme/legacy': '^1.0', 'erusev/parsedown': '^1.7', 'acme/unused': '^1.0', 'ghost/missing': '^1.0' } }, null, 4));
    const pkg = (name: string, autoload: object): object => ({ name, version: '1.0.0', autoload, 'notification-url': 'https://packagist.org/downloads/' });
    w(
        'composer.lock',
        JSON.stringify(
            {
                packages: [
                    pkg('laravel/framework', { 'psr-4': { 'Illuminate\\': 'src/Illuminate/' } }),
                    pkg('dompdf/dompdf', { classmap: ['lib/'] }),
                    pkg('acme/legacy', { 'psr-4': { 'Acme\\Legacy\\': 'src/' } }),
                    pkg('erusev/parsedown', { classmap: ['Parsedown.php'] }),
                    pkg('acme/unused', { 'psr-4': { 'Acme\\Unused\\': 'src/' } }),
                ],
                'packages-dev': [],
            },
            null,
            4,
        ),
    );
    w('app/Report.php', "<?php\nnamespace App;\n\nuse Dompdf;\nuse Acme\\Legacy\\Thing as LegacyThing;\n\nclass Report\n{\n    public function run(): void\n    {\n        $pdf = new Dompdf();\n        $t = new LegacyThing();\n        $md = new \\Parsedown();\n    }\n}\n");
    if (opts.withVendor !== false) {
        w('vendor/composer/autoload_classmap.php', "<?php\n\n$vendorDir = dirname(__DIR__);\n$baseDir = dirname($vendorDir);\n\nreturn array(\n    'Dompdf' => $vendorDir . '/dompdf/dompdf/lib/Dompdf.php',\n    'Parsedown' => $vendorDir . '/erusev/parsedown/Parsedown.php',\n    'Composer\\\\InstalledVersions' => $vendorDir . '/composer/InstalledVersions.php',\n);\n");
        w('vendor/composer/autoload_psr4.php', "<?php\n\n$vendorDir = dirname(__DIR__);\n$baseDir = dirname($vendorDir);\n\nreturn array(\n    'Illuminate\\\\' => array($vendorDir . '/laravel/framework/src/Illuminate'),\n    'Acme\\\\Unused\\\\' => array($vendorDir . '/acme/unused/src'),\n    'Acme\\\\Legacy\\\\' => array($vendorDir . '/acme/legacy/src'),\n    'App\\\\' => array($baseDir . '/app'),\n);\n");
        w('vendor/composer/autoload_namespaces.php', "<?php\n\nreturn array(\n);\n");
        w('vendor/composer/autoload_files.php', "<?php\n\nreturn array(\n);\n");
        w(
            'vendor/composer/installed.json',
            JSON.stringify({ packages: ['laravel/framework', 'dompdf/dompdf', 'acme/legacy', 'erusev/parsedown', 'acme/unused'].map((name) => ({ name, version: '1.0.0', 'install-path': `../${name}` })) }, null, 4),
        );
    }
    return root;
}
