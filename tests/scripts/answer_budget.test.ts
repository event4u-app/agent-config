/**
 * J.2 — budgets that hold: paged reads, graded fallback, packing by budget.
 */
import { describe, expect, it } from 'vitest';

import { budgetAnswer, budgetQueryReport, lineSubject, packPrefix, pageReads, tokensOf } from '../../src/scripts/code_graph/answer_budget.js';
import { PROBES, format, p95 } from '../../src/scripts/bench_answer_size.js';

const ids = (n: number, file = (i: number) => `src/dir_${i % 7}/module_${i}.ts`) => Array.from({ length: n }, (_, i) => `${file(i)}#symbol_with_a_long_name_${i}`);
const locate = (id: string) => `${id.split('#')[0]}:${id.length}`;

describe('pageReads', () => {
    it('is counted and paged', () => {
        const reads = Array.from({ length: 45 }, (_, i) => ({ path: `f${i}.ts`, lines: null }));
        expect(pageReads(reads, 1)).toMatchObject({ total: 45, page: 1, pages: 3 });
        expect(pageReads(reads, 3).items).toHaveLength(5);
        expect(pageReads(reads, 99).page).toBe(3);
        expect(pageReads([], 1)).toEqual({ items: [], total: 0, page: 1, pages: 1 });
    });
});

describe('packPrefix', () => {
    it('finds the longest prefix within budget', () => {
        const { n, value } = packPrefix(ids(200), (p) => ({ a: p }), 500);
        expect(tokensOf(value)).toBeLessThanOrEqual(500);
        expect(tokensOf({ a: ids(200).slice(0, n + 1) })).toBeGreaterThan(500);
    });
});

describe('budgetAnswer grades', () => {
    const header = { source: 'native' };
    const reads = [{ path: 'x.ts', lines: [1, 2] as [number, number] }];

    it('items when it fits, complete', () => {
        const r = budgetAnswer({ header, ids: ids(5), locate, reads });
        expect(r.budget).toMatchObject({ level: 'items', complete: true, shown: 5, total: 5 });
    });

    it('falls back items → locations → per-file → summary as the budget shrinks; always counted, always within budget', () => {
        const levels = [99999, 4000, 600].map((b) => {
            const r = budgetAnswer({ header, ids: ids(300), locate, reads }, b);
            expect(r.budget.tokens).toBeLessThanOrEqual(b);
            expect(r.budget.total).toBe(300);
            return r.budget.level;
        });
        expect(levels).toEqual(['items', 'locations', 'per-file']);
        // The summary is the floor: below one per-file row it is what remains, still counted.
        const s = budgetAnswer({ header, ids: ids(300), locate, reads }, 60);
        expect(s.budget).toMatchObject({ level: 'summary', complete: false, total: 300 });
        expect(s.budget.tokens).toBeLessThan(150);
    });

    it('the notice says how much was cut and to narrow the question', () => {
        expect(budgetAnswer({ header, ids: ids(300), locate, reads }, 600).budget.notice).toMatch(/narrow your question/);
    });
});

describe('query reports', () => {
    it('locates an edge line by its source node', () => {
        expect(lineSubject('EXTRACTED a.ts#f --calls--> b.ts#g')).toBe('a.ts#f');
        const g = { byId: new Map([['a.ts#f', { source_file: 'a.ts', source_location: [3, 1, 9, 1] }]]) };
        const lines = Array.from({ length: 400 }, (_, i) => `EXTRACTED a.ts#f --calls--> some/long/path/target_${i}.ts#fn_${i}`);
        const r = budgetQueryReport(g, { source: 's', seeds: ['x'], truncated: false, lines, recommended_reads: [] }, 800);
        expect(r.budget.tokens).toBeLessThanOrEqual(800);
        expect(['locations', 'per-file']).toContain(r.budget.level);
    });
});

describe('bench_answer_size', () => {
    it('declares the affected-hubs and graph-impact probes and formats a cost line', () => {
        expect(Object.keys(PROBES)).toEqual(expect.arrayContaining(['affected-hubs', 'graph-impact']));
        expect(format([{ probe: 'affected-hubs', case: 'affected x', raw_tokens: 3000, tokens: 1900, budget: 2000, level: 'items', shown: 5, total: 5, ok: true }])).toMatch(/3000 → 1900 tok .* cost ≈ 1900 tok per answer/);
        expect(p95([5, 1, 9, 3, 7, 2, 8, 4, 6, 10])).toBe(10);
    });
});
