import { describe, expect, it } from 'vitest';

import { edgeCensus } from '../../../internal/bench/code-graph/edge_census.js';

const node = (id: string, label: string, kind = 'function') => ({
    id,
    label,
    kind,
    source_file: id.split('#')[0] as string,
    source_location: [1, 0, 1, 0],
});

const call = (source: string, target: string, resolved_via = 'name-lookup', confidence = 'INFERRED') => ({
    source,
    target,
    relation: 'calls',
    confidence,
    resolved_via,
    provider: 'native',
});

describe('edgeCensus', () => {
    it('counts a name-lookup call whose label two top-level callables share', () => {
        const graph = {
            nodes: [node('a.ts#run', 'run'), node('b.ts#run', 'run'), node('c.ts#solo', 'solo'), node('d.ts', 'd.ts', 'file')],
            edges: [call('d.ts', 'a.ts#run'), call('d.ts', 'c.ts#solo')],
        };
        const c = edgeCensus(graph as never);
        expect(c.name_lookup_calls).toBe(2);
        expect(c.name_lookup_multi).toBe(1);
        expect(c.top_multi_labels).toEqual([['run', 1]]);
    });

    it('ignores the same shape when the edge is stated, or the twin is a method or another language', () => {
        const graph = {
            nodes: [node('a.ts#run', 'run'), node('b.ts#C::run', 'run', 'method'), node('c.php#run', 'run'), node('d.ts', 'd.ts', 'file')],
            edges: [call('d.ts', 'a.ts#run'), call('d.ts', 'a.ts#run', 'import-specifier', 'EXTRACTED')],
        };
        const c = edgeCensus(graph as never);
        expect(c.name_lookup_calls).toBe(1);
        expect(c.name_lookup_multi).toBe(0);
    });

    it('counts symbol targets, the ambiguous ones, collisions and the suppressed counts', () => {
        const graph = {
            nodes: [node('d.ts', 'd.ts', 'file')],
            edges: [
                { ...call('d.ts', 'symbol:run', 'name-lookup', 'AMBIGUOUS'), ambiguity_reason: 'name-collision' },
                call('d.ts', 'symbol:x', 'name-lookup', 'EXTRACTED'),
            ],
            suppressed_edge_counts: { dynamic_no_candidate: 3 },
        };
        const c = edgeCensus(graph as never);
        expect(c).toMatchObject({ symbol_targets: 2, symbol_targets_ambiguous: 1, name_collision_edges: 1 });
        expect(c.suppressed_edge_counts).toEqual({ dynamic_no_candidate: 3 });
    });
});
