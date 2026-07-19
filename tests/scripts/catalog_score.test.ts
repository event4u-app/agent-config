// Tests for src/scripts/_lib/catalog_score.ts — catalog search over the real
// index, reusing the shared LexicalIndex (no second scorer).
import { describe, expect, it } from 'vitest';

import { buildEntries } from '../../src/scripts/build_catalog_index.js';
import { searchCatalog } from '../../src/scripts/_lib/catalog_score.js';

const ENTRIES = buildEntries();

describe('catalog_score — searchCatalog', () => {
    it('ranks the relevant skills for a real query', () => {
        const hits = searchCatalog(ENTRIES, 'incident rollback blast radius', { cls: 'skill', limit: 8 });
        const ids = hits.map((h) => h.entry.id);
        // The purpose-built incident/blast-radius skills must surface near the top.
        expect(ids).toContain('skill:blast-radius-analyzer');
        expect(hits.length).toBeGreaterThan(0);
        // Scores are descending.
        for (let i = 1; i < hits.length; i++) {
            expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
        }
    });

    it('an empty / whitespace query returns no hits (never dumps the catalog)', () => {
        expect(searchCatalog(ENTRIES, '')).toEqual([]);
        expect(searchCatalog(ENTRIES, '   ')).toEqual([]);
    });

    it('respects the class filter', () => {
        const hits = searchCatalog(ENTRIES, 'review architecture', { cls: 'persona', limit: 10 });
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.every((h) => h.entry.cls === 'persona')).toBe(true);
    });

    it('respects the limit', () => {
        const hits = searchCatalog(ENTRIES, 'test', { limit: 3 });
        expect(hits.length).toBeLessThanOrEqual(3);
    });

    it('respects the pack filter (tag membership)', () => {
        const hits = searchCatalog(ENTRIES, 'endpoint validation', { pack: 'engineering-base', limit: 10 });
        expect(hits.every((h) => h.entry.tags.includes('engineering-base'))).toBe(true);
    });
});
