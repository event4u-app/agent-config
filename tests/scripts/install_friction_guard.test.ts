/**
 * CI install-friction guard (road-to-reachable-code-memory Phase 6).
 *
 * ADR-129's "zero new dependencies, no node-gyp, no build step" promise for
 * the `node:sqlite` substrate is only real if a regression actually breaks
 * the build. This asserts:
 *
 *   (a) `package.json` `dependencies` are EXACTLY the committed baseline —
 *       any new runtime dependency (a `node-sqlite3`-class native binding,
 *       an FTS engine polyfill, ...) fails the build until the baseline is
 *       deliberately updated.
 *   (b) no `node-gyp`, and no NEW `postinstall` / `preinstall` / `prebuild`
 *       lifecycle script beyond the one already committed (native builds
 *       hide behind exactly these hooks).
 *   (c) no `*.sqlite3` / `*.db` file is tracked in git — every derived
 *       SQLite store this suite writes is gitignored (`agents/runtime/`);
 *       one landing in the tracked tree means a derived artifact escaped
 *       its gitignore boundary.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const BASELINE_PATH = path.join(
    REPO_ROOT,
    'tests',
    'fixtures',
    'install-friction',
    'dependencies-baseline.json',
);

interface Baseline {
    dependencies: Record<string, string>;
    lifecycle_scripts: Record<string, string>;
}

function readPackageJson(): { dependencies?: Record<string, string>; scripts?: Record<string, string> } {
    return JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')) as {
        dependencies?: Record<string, string>;
        scripts?: Record<string, string>;
    };
}

function readBaseline(): Baseline {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
}

describe('install-friction guard — package.json', () => {
    it('runtime dependencies match the committed baseline exactly', () => {
        const pkg = readPackageJson();
        const baseline = readBaseline();
        expect(pkg.dependencies ?? {}).toEqual(baseline.dependencies);
    });

    it('carries no node-gyp dependency (native build tooling)', () => {
        const pkg = readPackageJson();
        expect(Object.keys(pkg.dependencies ?? {})).not.toContain('node-gyp');
    });

    it('has no NEW postinstall/preinstall/prebuild script beyond the baseline', () => {
        const pkg = readPackageJson();
        const baseline = readBaseline();
        const scripts = pkg.scripts ?? {};
        for (const hook of ['postinstall', 'preinstall', 'prebuild'] as const) {
            const current = scripts[hook];
            const known = baseline.lifecycle_scripts[hook];
            if (known === undefined) {
                // Baseline has no such hook today — one appearing now is new.
                expect(current, `unexpected new "${hook}" lifecycle script`).toBeUndefined();
            } else {
                // Baseline already carries this hook — it may exist, but must
                // be byte-identical (this test does not bless silent edits).
                expect(current).toBe(known);
            }
        }
    });
});

describe('install-friction guard — tracked tree', () => {
    it('tracks no *.sqlite3 or *.db file (every derived SQLite store is gitignored)', () => {
        const out = execFileSync('git', ['ls-files', '*.sqlite3', '*.db'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
        });
        const tracked = out.split('\n').filter((l) => l.trim() !== '');
        expect(tracked).toEqual([]);
    });
});
