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
