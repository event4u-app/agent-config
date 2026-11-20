// The bundle hands its `yaml` copy to the chunks (hooks/bundled_yaml.ts + the
// chunk banner in hook_chunks.mjs), so a chunk never loads a second copy from
// node_modules (road-to-a-hook-system-that-pays-for-what-it-does 2.1).
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it } from 'vitest';

import { BUNDLED_YAML_GLOBAL } from '../../../src/scripts/hooks/bundled_yaml.js';
import { CHUNK_OPTIONS } from '../../../src/scripts/hook_chunks.mjs';

const realRequire = createRequire(import.meta.url);
const g = globalThis as Record<string, unknown>;
const saved = g[BUNDLED_YAML_GLOBAL];

afterEach(() => {
    g[BUNDLED_YAML_GLOBAL] = saved;
});

/** Run the chunk banner the way node runs a CJS chunk: `require` is a wrapper parameter. */
function bannerRequire(base: NodeJS.Require): NodeJS.Require {
    const run = new Function('require', '__filename', '__dirname', `${CHUNK_OPTIONS.banner.js}; return require;`) as (
        r: NodeJS.Require,
        f: string,
        d: string,
    ) => NodeJS.Require;
    return run(base, '/x/dist/hooks/c.chunk.cjs', '/x/dist/hooks');
}

describe('bundled yaml handoff', () => {
    it('the published value is the package exports object a plain require returns', () => {
        const published = g[BUNDLED_YAML_GLOBAL] as Record<string, unknown>;
        const plain = realRequire('yaml') as Record<string, unknown>;
        for (const k of ['parse', 'stringify', 'parseDocument', 'Document', 'YAMLMap']) {
            expect(typeof published[k], k).toBe(typeof plain[k]);
        }
        expect((published['parse'] as (s: string) => unknown)('a: 1')).toEqual({ a: 1 });
    });

    it('inside a chunk, require("yaml") returns the bundle copy and loads nothing', () => {
        const marker = { parse: () => 'bundled' };
        g[BUNDLED_YAML_GLOBAL] = marker;
        let loaded = 0;
        const base = Object.assign((id: string) => {
            loaded += 1;
            return realRequire(id);
        }, { resolve: realRequire.resolve, cache: realRequire.cache }) as unknown as NodeJS.Require;
        const r = bannerRequire(base);
        loaded = 0; // the banner itself requires node:url before it swaps `require`
        expect(r('yaml')).toBe(marker);
        expect(loaded).toBe(0);
        expect(r.resolve('yaml')).toBe(realRequire.resolve('yaml'));
        expect(r('node:path')).toBe(realRequire('node:path'));
        expect(loaded).toBe(1);
    });

    it('without the global, a chunk falls back to a real require', () => {
        g[BUNDLED_YAML_GLOBAL] = undefined;
        const r = bannerRequire(realRequire);
        expect((r('yaml') as { parse: (s: string) => unknown }).parse('b: 2')).toEqual({ b: 2 });
    });
});
