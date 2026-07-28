/**
 * Versioned-cache lint (road-to-retrieval-substrate-hardening B5b).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runChecks, scanFile } from '../../src/scripts/lint_versioned_cache.js';

describe('scanFile — cache-file path literals', () => {
    it('flags an unversioned derived cache with no justification', () => {
        const src = `const P = 'agents/runtime/state/knowledge-index.json';\nwriteFileSync(P, data);\n`;
        const v = scanFile('x.ts', src);
        expect(v).toHaveLength(1);
        expect(v[0]?.literal).toContain('knowledge-index.json');
    });

    it('passes a path with a v<N> namespace', () => {
        const src = `const P = 'agents/runtime/state/knowledge-index-v1.json';\n`;
        expect(scanFile('x.ts', src)).toHaveLength(0);
    });

    it('passes a path with a ${version} interpolation', () => {
        const src = 'const P = `cache/idx-${SCHEMA_version}-cache.json`;\n';
        expect(scanFile('x.ts', src)).toHaveLength(0);
    });

    it('passes an unversioned cache with an inline invalidation comment', () => {
        const src =
            `// cache-invalidation: fully overwritten every stop, no format drift\n` +
            `const P = 'agents/runtime/state/hot-cache.json';\n`;
        expect(scanFile('x.ts', src)).toHaveLength(0);
    });

    it('ignores ordinary (non-cache-suffix) json paths', () => {
        const src = `const P = 'internal/schemas/retrieval-v1.schema.json';\nconst Q = 'package.json';\n`;
        expect(scanFile('x.ts', src)).toHaveLength(0);
    });

    it('flags the learning sidecar and stat-index suffixes', () => {
        const a = scanFile('a.ts', `const P = 'x/.agent-learning.json';\n`);
        const b = scanFile('b.ts', `const P = 'x/foo.stat-index.json';\n`);
        expect(a).toHaveLength(1);
        expect(b).toHaveLength(1);
    });

    // road-to-reachable-code-memory Phase 6: .sqlite3 / .db coverage.
    it('flags an unversioned .sqlite3 path with no justification', () => {
        const src = `export const DB = 'agents/runtime/mcp-telemetry/calls.sqlite3';\n`;
        const v = scanFile('x.ts', src);
        expect(v).toHaveLength(1);
        expect(v[0]?.literal).toContain('calls.sqlite3');
    });

    it('passes a .sqlite3 path with a v<N> namespace', () => {
        const src = `export const IDX = 'agents/runtime/state/memory-index-v1.sqlite3';\n`;
        expect(scanFile('x.ts', src)).toHaveLength(0);
    });

    it('passes an unversioned .db with an inline invalidation comment', () => {
        const src =
            `// cache-invalidation: PRAGMA user_version stamped on every connect\n` +
            `export const DB = 'agents/runtime/state/graph.db';\n`;
        expect(scanFile('x.ts', src)).toHaveLength(0);
    });

    it('ignores an ordinary non-cache .json path even when a sibling line has .db noise', () => {
        // The .sqlite3/.db branch must not accidentally widen the .json branch.
        const src = `const P = 'package.json';\nconst NOTE = 'see docs/foo.db.md for background';\n`;
        expect(scanFile('x.ts', src)).toHaveLength(0);
    });
});

describe('runChecks — directory walk', () => {
    let tmp = '';
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vcache-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('collects violations across a tree and skips node_modules', () => {
        fs.mkdirSync(path.join(tmp, 'node_modules', 'dep'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'good.ts'), `const P = 'a/idx-v2-index.json';\n`);
        fs.writeFileSync(path.join(tmp, 'bad.ts'), `const P = 'a/thing-cache.json';\n`);
        fs.writeFileSync(
            path.join(tmp, 'node_modules', 'dep', 'noisy.ts'),
            `const P = 'a/vendor-cache.json';\n`,
        );
        const v = runChecks(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]?.file).toContain('bad.ts');
    });
});

describe('the live src/scripts tree is clean', () => {
    it('has no unversioned derived caches today', () => {
        const root = path.resolve(__dirname, '..', '..', 'src', 'scripts');
        expect(runChecks(root)).toEqual([]);
    });
});
