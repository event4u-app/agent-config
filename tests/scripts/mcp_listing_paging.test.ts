/**
 * J.6 — listing tools page: index mode by default, counted, paged; the first
 * page of list_skills, list_rules and memory_lookup stays within 2,000 tokens.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { gpt_tokens } from '../../src/scripts/_lib/token_count.js';
import { LISTING_PAGE_SIZE, pageListing } from '../../src/scripts/mcp_server/listing_page.js';
import { ALLOWLIST, ToolCache } from '../../src/scripts/mcp_server/tools.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tok = (v: unknown): number => gpt_tokens(JSON.stringify(v)).tokens;

describe('pageListing', () => {
    const items = Array.from({ length: 120 }, (_, i) => ({ name: `s${i}`, description: 'long text '.repeat(20), source: 'x' }));
    it('defaults to index rows, counts all, and pages', () => {
        const r = pageListing(items, {}, 'skills', ['name']);
        expect(r).toMatchObject({ count: 120, page: 1, pages: 3, detail: 'index' });
        expect((r['skills'] as unknown[])[0]).toEqual({ name: 's0' });
        expect((pageListing(items, { page: 3 }, 'skills', ['name'])['skills'] as unknown[]).length).toBe(120 - 2 * LISTING_PAGE_SIZE);
        expect((pageListing(items, { detail: 'full' }, 'skills', ['name'])['skills'] as Array<Record<string, unknown>>)[0]?.['description']).toBeDefined();
    });

    it('a page past the last is empty and still says how many there are', () => {
        expect(pageListing(items, { page: 9 }, 'skills', ['name'])).toEqual({ count: 120, skills: [], page: 9, pages: 3, detail: 'index' });
    });

    it('rejects a bad page or detail', () => {
        expect(() => pageListing(items, { page: 0 }, 'skills', ['name'])).toThrow(/page/);
        expect(() => pageListing(items, { detail: 'all' }, 'skills', ['name'])).toThrow(/detail/);
    });
});

describe('the tools', () => {
    it('declare detail and page, and memory_lookup defaults to index', () => {
        for (const t of ['list_skills', 'list_rules']) expect(Object.keys((ALLOWLIST[t]?.input_schema as { properties: object }).properties)).toEqual(['detail', 'page']);
        expect(((ALLOWLIST['memory_lookup']?.input_schema as { properties: Record<string, { default?: string }> }).properties['detail'])?.default).toBe('index');
    });

    for (const [tool, args] of [
        ['list_skills', {}],
        ['list_rules', {}],
        ['memory_lookup', { types: ['historical-patterns', 'incident-learnings', 'product-rules'] }],
    ] as const) {
        it(`${tool}: the first page is within 2,000 tokens`, async () => {
            const result = await new ToolCache().dispatch(tool, args, ROOT);
            expect(tok(result)).toBeLessThanOrEqual(2000);
        });
    }
});
