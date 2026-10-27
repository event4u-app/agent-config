/**
 * H.5 — regression hypotheses through the graph, synthetic graph only.
 */
import { describe, expect, it } from 'vitest';

import { type ChangeInWindow, reach, regressionHypotheses } from '../../src/scripts/code_graph/regression_paths.js';
import type { CodeEdge } from '../../src/scripts/code_graph/types.js';

const e = (source: string, target: string, relation: CodeEdge['relation'], resolved_via: CodeEdge['resolved_via'] = 'import-specifier'): CodeEdge => ({
    source,
    target,
    relation,
    confidence: resolved_via === 'name-lookup' ? 'INFERRED' : 'EXTRACTED',
    resolved_via,
    provider: 'native',
});

// checkout → total → round (3 hops away is format)
// checkout reads table:orders, which import#save writes
const edges: CodeEdge[] = [
    e('cart#checkout', 'calc#total', 'calls'),
    e('calc#total', 'calc#round', 'calls', 'name-lookup'),
    e('calc#round', 'fmt#digits', 'uses'),
    e('fmt#digits', 'fmt#pad', 'calls'),
    e('cart#checkout', 'table:orders', 'reads', 'schema-call'),
    e('import#save', 'table:orders', 'writes', 'schema-call'),
];

const change = (sha: string, date: string, symbols: string[], fix = false): ChangeInWindow => ({ sha, date, pr: `#${sha.length}`, tickets: [], fix, symbols });

describe('reach', () => {
    it('walks calls/uses forward and joins reads to writes of the same target', () => {
        const r = reach(edges, 'cart#checkout', 3);
        expect([...r.keys()].sort()).toEqual(['calc#round', 'calc#total', 'cart#checkout', 'fmt#digits', 'import#save']);
        expect(r.get('import#save')?.map((s) => s.relation)).toEqual(['reads', 'writes']);
    });
});

describe('regressionHypotheses', () => {
    const changes = [
        change('aaaa01', '2026-09-01', ['fmt#digits']),
        change('bbbb02', '2026-09-09', ['calc#round'], true),
        change('cccc03', '2026-09-09', ['calc#round']),
        change('dddd04', '2026-09-09', ['import#save']),
        change('eeee05', '2026-09-09', ['fmt#pad']),
        change('ffff06', '2026-09-09', ['unrelated#x']),
    ];
    const hs = regressionHypotheses({ edges }, ['cart#checkout'], changes, '2026-09-10');

    it('ranks by hop distance, then time to first seen, then fix-induced: the calculation fix ranks first', () => {
        expect(hs.map((h) => [h.sha, h.hops])).toEqual([
            ['bbbb02', 2],
            ['cccc03', 2],
            ['dddd04', 2],
            ['aaaa01', 3],
        ]);
    });

    it('a read→write join costs two hops, so it is cut where a call path of the same length is not', () => {
        expect(reach(edges, 'cart#checkout', 1).has('import#save')).toBe(false);
        expect(reach(edges, 'cart#checkout', 1).has('calc#total')).toBe(true);
        expect(regressionHypotheses({ edges }, ['cart#checkout'], changes, '2026-09-10').find((h) => h.sha === 'dddd04')?.path.map((p) => p.relation)).toEqual(['reads', 'writes']);
    });

    it('drops changes beyond k hops and changes the frames never reach', () => {
        expect(hs.map((h) => h.sha)).not.toContain('eeee05');
        expect(hs.map((h) => h.sha)).not.toContain('ffff06');
    });

    it('carries the path with per-edge witness and dashes guessed edges; state stays hypothesis', () => {
        const calc = hs.find((h) => h.sha === 'bbbb02');
        expect(calc?.state).toBe('hypothesis');
        expect(calc?.path.map((s) => [s.target, s.witness, s.dashed])).toEqual([
            ['calc#total', 'import-specifier/EXTRACTED', false],
            ['calc#round', 'name-lookup/INFERRED', true],
        ]);
        expect(calc?.pr).toBe('#6');
    });

    it('a wider k reaches further', () => {
        expect(regressionHypotheses({ edges }, ['cart#checkout'], changes, '2026-09-10', 4).map((h) => h.sha)).toContain('eeee05');
    });
});
