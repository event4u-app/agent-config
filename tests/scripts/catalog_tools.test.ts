// Tests for src/scripts/mcp_server/catalog_tools.ts — the lazy-catalog tool
// handlers (built + tested; registered as discovery stubs, activation deferred).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import {
    LOAD_PREAMBLE,
    ROOT,
    _resetCache,
    catalogInspect,
    catalogLoad,
    catalogSearch,
} from '../../src/scripts/mcp_server/catalog_tools.js';
import { main as buildIndex } from '../../src/scripts/build_catalog_index.js';

beforeAll(() => {
    // Ensure the on-disk index exists and is fresh for loadIndex().
    buildIndex(['--quiet']);
    _resetCache();
});

describe('catalog_tools — registration (tools/list surface)', () => {
    it('registers the three catalog tools as discovery stubs (implemented_on: [])', () => {
        const catalog = JSON.parse(
            fs.readFileSync(path.join(ROOT, 'src/scripts/mcp_server/consumer_tool_catalog.json'), 'utf-8'),
        ) as { tools: Array<{ name: string; implemented_on: string[]; side_effect: string }> };
        const names = new Set(catalog.tools.map((t) => t.name));
        for (const n of ['catalog_search', 'catalog_inspect', 'catalog_load']) {
            expect(names.has(n)).toBe(true);
            const t = catalog.tools.find((x) => x.name === n)!;
            expect(t.implemented_on).toEqual([]); // stub — activation deferred
            expect(t.side_effect).toBe('ro'); // read-only
        }
        // The write-adjacent delegate tool must NOT exist.
        expect(names.has('catalog_delegate')).toBe(false);
    });
});

describe('catalog_tools — catalog_search', () => {
    it('returns ranked summaries with scores, no bodies', async () => {
        const res = await catalogSearch({ query: 'incident rollback blast radius', class: 'skill', limit: 5 });
        expect(res['count']).toBeGreaterThan(0);
        const results = res['results'] as Array<Record<string, unknown>>;
        expect(results.length).toBeLessThanOrEqual(5);
        expect(results.some((r) => r['id'] === 'skill:blast-radius-analyzer')).toBe(true);
        for (const r of results) {
            expect(typeof r['score']).toBe('number');
            expect(r).not.toHaveProperty('body'); // search never carries a body
        }
    });
});

describe('catalog_tools — catalog_inspect', () => {
    it('returns metadata only by default; body only on the explicit flag', async () => {
        const meta = await catalogInspect({ id: 'skill:api-design' });
        expect(meta['id']).toBe('skill:api-design');
        expect(meta).not.toHaveProperty('body');

        const withBody = await catalogInspect({ id: 'skill:api-design', include_body: true });
        expect(typeof withBody['body']).toBe('string');
        expect((withBody['body'] as string).length).toBeGreaterThan(0);
    });

    it('unknown id → error, never a crash', async () => {
        const res = await catalogInspect({ id: 'skill:__does_not_exist__' });
        expect(res['error']).toMatch(/unknown catalog id/);
    });
});

describe('catalog_tools — catalog_load', () => {
    it('loads a body wrapped in the neutral subordination preamble', async () => {
        const res = await catalogLoad({ id: 'skill:api-design' });
        expect(res['id']).toBe('skill:api-design');
        expect((res['body'] as string).startsWith(LOAD_PREAMBLE)).toBe(true);
        expect((res['body'] as string).length).toBeGreaterThan(LOAD_PREAMBLE.length);
    });

    it('unknown id → error', async () => {
        const res = await catalogLoad({ id: 'persona:__nope__' });
        expect(res['error']).toMatch(/unknown catalog id/);
    });
});
