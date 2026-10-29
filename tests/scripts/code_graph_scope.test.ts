import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { classifyScope, explainScope, isDocOrExamplePath, isTestFile, readScopeRules, scopeOf } from '../../src/scripts/code_graph/scope.js';

const REPO = path.resolve(__dirname, '../..');

describe('the one scope classifier (2.1)', () => {
    it.each([
        ['src/app.ts', 'product'],
        ['internal/bench/ab/map-task-set/t1/src/a.ts', 'bench'],
        ['tests/fixtures/p1-blog/database/migrations/x.php', 'fixture'],
        ['tests/scripts/code_graph_scope.test.ts', 'test'],
        ['src/foo.spec.ts', 'test'],
        ['app/Tests/UserTest.php', 'test'],
        ['docs/guide.md', 'doc'],
        ['README.md', 'doc'],
        ['node_modules/lodash/index.js', 'vendored'],
        ['vendor/laravel/framework/src/x.php', 'vendored'],
        ['dist/agent-src/rules/x.md', 'generated'],
        ['public/app.min.js', 'generated'],
    ])('%s → %s', (p, want) => {
        expect(scopeOf(p)).toBe(want);
    });

    it('decides on the path relative to the scanned root, never on the root itself', () => {
        expect(scopeOf('database/migrations/2026_create_orders.php')).toBe('product');
    });

    it('keeps the predicates the lanes read on one source', () => {
        expect(isTestFile('internal/bench/x.ts')).toBe(true);
        expect(isTestFile('tests/fixtures/a.php')).toBe(true);
        expect(isTestFile('src/app.ts')).toBe(false);
        expect(isDocOrExamplePath('examples/a.ts')).toBe(true);
        expect(isDocOrExamplePath('tests/README.md')).toBe(false);
    });

    it('lets a layers.yaml scope override win over a default rule, and says so', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-scope-'));
        const file = path.join(dir, 'layers.yaml');
        fs.writeFileSync(file, 'scope:\n  - scope: product\n    paths: ["internal/bench/keep/**"]\n  - scope: nonsense\n    paths: ["x/**"]\n');
        const rules = readScopeRules(file);
        expect(rules).toHaveLength(1);
        expect(classifyScope('internal/bench/keep/a.ts', rules)).toEqual({ scope: 'product', rule: 'internal/bench/keep/**', override: true });
        expect(scopeOf('internal/bench/other.ts', rules)).toBe('bench');
        expect(explainScope('internal/bench/keep/a.ts', rules)).toBe('internal/bench/keep/a.ts: product (override internal/bench/keep/**)');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('`code-graph scope` names the scope and the default rule', () => {
        const out = execFileSync(path.join(REPO, 'scripts-run'), ['src/scripts/code_graph/cli', 'scope', 'internal/bench/x.ts', 'src/app.ts', '--root', REPO], { encoding: 'utf-8' });
        expect(out).toMatch(/bench \(default rule bench\/\)/);
        expect(out).toMatch(/src\/app\.ts: product \(no rule matched\)/);
    }, 60_000);
});
