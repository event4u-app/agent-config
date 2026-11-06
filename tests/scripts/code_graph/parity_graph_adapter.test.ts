import { describe, expect, it } from 'vitest';

import { adaptNodeLinkGraph, type NodeLinkGraph } from '../../../internal/bench/code-graph/parity_graph_adapter.js';

const native = {
    nodes: [
        { id: 'src/a.ts', label: 'src/a.ts', kind: 'file', source_file: 'src/a.ts', source_location: [] },
        { id: 'src/a.ts#run', label: 'run', kind: 'function', source_file: 'src/a.ts', source_location: [3, 1, 9, 2] },
        { id: 'src/b.ts', label: 'src/b.ts', kind: 'file', source_file: 'src/b.ts', source_location: [] },
        { id: 'src/b.ts#B', label: 'B', kind: 'class', source_file: 'src/b.ts', source_location: [2, 1, 12, 2] },
        { id: 'src/b.ts#B::other', label: 'other', kind: 'method', source_file: 'src/b.ts', source_location: [4, 20, 4, 40] },
        { id: 'src/b.ts#B::help', label: 'help', kind: 'method', source_file: 'src/b.ts', source_location: [4, 5, 6, 6] },
    ],
};

const n = (id: string, label: string, file: string | undefined, line: number) => ({ id, label, source_file: file, source_location: `L${line}` });
const l = (source: string, target: string, relation: string, confidence = 'EXTRACTED') => ({ source, target, relation, confidence });

const foreign: NodeLinkGraph = {
    nodes: [
        n('a', 'a.ts', 'src/a.ts', 1),
        n('a_run', 'run()', 'src/a.ts', 3),
        n('b', 'b.ts', 'src/b.ts', 1),
        n('b_b', 'B', 'src/b.ts', 2),
        n('b_help', '.help()', 'src/b.ts', 4),
        n('b_gone', 'gone()', 'src/b.ts', 30),
        n('ext', 'node:fs', undefined, 1),
    ],
    links: [
        l('a_run', 'b_help', 'calls'),
        l('a_run', 'b_b', 'calls', 'INFERRED'),
        l('a', 'b', 'imports_from'),
        l('a', 'b_b', 're_exports'),
        l('a_run', 'b_gone', 'indirect_call', 'INFERRED'),
        l('b_b', 'a_run', 'implements'),
        l('a', 'ext', 'imports'),
        l('a', 'a_run', 'contains'),
        l('a_run', 'missing_node', 'calls'),
    ],
};

describe('adaptNodeLinkGraph', () => {
    const out = adaptNodeLinkGraph(foreign, native);
    const find = (s: string, t: string) => out.edges.filter((e) => e.source === s && e.target === t);

    it('maps a symbol onto the native node declared on the same line, preferring the matching label', () => {
        expect(find('src/a.ts#run', 'src/b.ts#B::help')).toEqual([
            expect.objectContaining({ relation: 'calls', resolved_via: 'extracted:calls' }),
        ]);
    });

    it('keys the mechanism on the tool’s own confidence tag and the scored relation family', () => {
        expect(find('src/a.ts#run', 'src/b.ts#B')[0]?.resolved_via).toBe('inferred:calls');
        expect(find('src/a.ts', 'src/b.ts')[0]?.resolved_via).toBe('extracted:imports');
        expect(find('src/a.ts', 'src/b.ts#B')[0]?.resolved_via).toBe('extracted:imports');
        expect(find('src/b.ts#B', 'src/a.ts#run')[0]?.resolved_via).toBe('extracted:inherits');
    });

    it('folds the PHP reference relations onto their families and leaves framework bindings out', () => {
        const php = adaptNodeLinkGraph(
            { nodes: foreign.nodes, links: [l('b_b', 'a_run', 'mixes_in'), l('a_run', 'b_b', 'references_constant'), l('a', 'b', 'includes'), l('a_run', 'b_b', 'bound_to')] },
            native,
        );
        expect(php.edges.map((e) => e.resolved_via)).toEqual(['extracted:inherits', 'extracted:references', 'extracted:imports']);
        expect(php.stats.dropped_relation).toEqual({ bound_to: 1 });
    });

    it('falls back to the file id when no native declaration starts on that line, and counts it', () => {
        expect(find('src/a.ts#run', 'src/b.ts')[0]?.resolved_via).toBe('inferred:calls');
        expect(out.stats.unmapped_symbols).toBe(1);
    });

    it('sends a target with no file to an unresolved symbol, and drops non-reference relations', () => {
        expect(find('src/a.ts', 'symbol:ext')).toHaveLength(1);
        expect(out.edges.some((e) => e.relation === 'contains')).toBe(false);
        expect(out.stats.dropped_relation).toEqual({ contains: 1 });
        expect(out.stats.dangling).toBe(1);
        expect(out.edges).toHaveLength(7);
    });

    it('carries the native nodes, so symbol-level scoring reads the same ranges', () => {
        expect(out.nodes).toBe(native.nodes);
    });
});
