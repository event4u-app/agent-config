// Tests for src/skills/corpus-grounding/scripts/bm25_search.ts (ADR-094 py2ts).
//
// TS unit tests over the BM25 math / CSV parsing / filters.
//
// Float parity is the load-bearing concern here: BM25 produces tf-idf floats
// whose exact bit pattern (and the descending-with-stable-ties sort) must
// be correct. Determinism: pure functions over inline fixtures, no clock,
// no network, no git drift.
import { describe, expect, it } from 'vitest';

import * as bm from '../../src/skills/corpus-grounding/scripts/bm25_search.js';

describe('bm25_search — tokenize parity', () => {
    it('lowercases, strips punctuation, drops <3-char tokens (code-point length)', () => {
        expect(bm.BM25.tokenize('Über-Café 123 a_b naïve €5 你好世界 ab abc')).toEqual([
            'über',
            'café',
            '123',
            'a_b',
            'naïve',
            '你好世界',
            'abc',
        ]);
    });

    it('coerces non-string input via str() before tokenizing', () => {
        expect(bm.BM25.tokenize(12345)).toEqual(['12345']);
    });
});

describe('bm25_search — BM25 scoring math', () => {
    const docs = [
        'Muted Palette muted calm soft A restrained low-saturation palette',
        'Vibrant Palette vibrant bold bright High-saturation energetic colors',
        'Fintech Blue fintech trust blue Conservative blue trust palette',
    ];

    it('produces the canonical tf-idf scores, sorted descending with stable ties', () => {
        const b = new bm.BM25();
        b.fit(docs);
        const scored = b.score('muted calm palette');
        expect(scored.map(([, s]) => s)).toEqual([
            2.572773032492082, 0.13353139262452257, 0.13353139262452257,
        ]);
        // Stable tie: indices 1 and 2 keep original order.
        expect(scored.map(([i]) => i)).toEqual([0, 1, 2]);
    });

    it('empty corpus → no scores', () => {
        const b = new bm.BM25();
        b.fit([]);
        expect(b.N).toBe(0);
        expect(b.score('anything')).toEqual([]);
    });
});

describe('bm25_search — filters', () => {
    const rows: bm.Row[] = [
        { Name: 'A', Severity: 'HIGH' },
        { Name: 'B', Severity: 'low' },
        { Name: 'C', Severity: 'High and dry' },
    ];
    it('no filters → all rows', () => {
        expect(bm.apply_filters(rows, null)).toEqual(rows);
        expect(bm.apply_filters(rows, {})).toEqual(rows);
    });
    it('single value is a case-insensitive substring match', () => {
        expect(bm.apply_filters(rows, { Severity: 'high' }).map((r) => r.Name)).toEqual(['A', 'C']);
    });
    it('list value matches when ANY accepted value is a substring', () => {
        expect(bm.apply_filters(rows, { Severity: ['low', 'dry'] }).map((r) => r.Name)).toEqual([
            'B',
            'C',
        ]);
    });
    it('unknown column never matches → empty', () => {
        expect(bm.apply_filters(rows, { Nope: 'x' })).toEqual([]);
    });
});

describe('bm25_search — search_rows', () => {
    it('unknown retriever raises ValueError with the Python message', () => {
        expect(() => bm.search_rows('whatever.csv', [], [], 'q', 3, null, 'bogus')).toThrow(
            "Unknown retriever: 'bogus'. Available: ['bm25', 'hybrid', 'structured']",
        );
    });
    it('missing file → error dict, no scores key', () => {
        const r = bm.search_rows('/nonexistent/path/x.csv', ['Name'], ['Name'], 'q');
        expect(r.error).toBe('File not found: /nonexistent/path/x.csv');
        expect(r.count).toBe(0);
        expect(r.results).toEqual([]);
        expect('scores' in r).toBe(false);
    });
});
