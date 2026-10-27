import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { mergeLaneOutputs } from '../../src/scripts/code_graph/lanes/merge.js';
import { lintGraph } from '../../src/scripts/code_graph/lint.js';
import type { CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';

const REPO = path.resolve(__dirname, '../..');
const node = (id: string, loc: number[] = [1, 1, 1, 5]): CodeNode => ({ id, label: id, kind: 'file', source_file: id, source_location: loc });
const graph = (nodes: CodeNode[], edges: CodeGraph['edges'] = []): CodeGraph =>
    ({ schema_version: 4, source_checksum: 'x', languages: [], nodes, edges, edge_confidence_counts: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 } }) as unknown as CodeGraph;
const w = { file: 'docs/ADR-1.md', line: 3, hash: 'h' };

function laneOut(to: string, attrs: Record<string, string> = {}): LaneOutput {
    return {
        lane: 'decisions',
        facts: [{ kind: 'decision', id: 'decision:ADR-1', name: 'ADR-1', attrs: {}, witness: w, rung: 'T1', owner: 'docs/ADR-1.md' }],
        relations: [{ relation: 'governs', from: 'decision:ADR-1', to, attrs, witness: w, rung: 'T1', owner: 'docs/ADR-1.md', guess: false }],
        skipped: [],
    } as LaneOutput;
}

describe('the endpoint contract in merge (2.4, H6)', () => {
    it('writes a lane edge that hits a node', () => {
        const r = mergeLaneOutputs(graph([node('src/a.ts')]), [laneOut('src/a.ts')]);
        expect(r.graph.edges.map((e) => e.target)).toEqual(['src/a.ts']);
        expect(r.refused).toEqual([]);
    });

    it('types a lane edge whose target is no node as unresolved with a reason, never a silent dangling edge', () => {
        const r = mergeLaneOutputs(graph([node('src/a.ts')]), [laneOut('agents/tickets/_registry.yml')]);
        expect(r.graph.edges[0]?.fact?.attrs).toMatchObject({ relation_state: 'unresolved', reason: 'target agents/tickets/_registry.yml is not a node of this graph' });
        expect(lintGraph(r.graph)).toEqual([]);
    });

    it('drops a pre-declared unresolved state once the target is a node', () => {
        const r = mergeLaneOutputs(graph([node('src/a.ts')]), [laneOut('src/a.ts', { relation_state: 'unresolved', reason: 'maybe elsewhere' })]);
        expect(r.graph.edges[0]?.fact?.attrs).toEqual({});
    });

    it('keeps an unresolved lane edge as a typed state with its reason', () => {
        const r = mergeLaneOutputs(graph([node('src/a.ts')]), [laneOut('image:built:../x/Dockerfile', { relation_state: 'unresolved', reason: 'outside the tree' })]);
        expect(r.graph.edges).toHaveLength(1);
        expect(r.graph.edges[0]?.fact?.attrs).toMatchObject({ relation_state: 'unresolved', reason: 'outside the tree' });
        expect(lintGraph(r.graph)).toEqual([]);
    });
});

describe('lintGraph', () => {
    it('passes a clean graph with core references the extractor leaves unresolved', () => {
        const g = graph([node('a'), node('b', [])], [{ source: 'a', target: 'symbol:Map', relation: 'calls', confidence: 'EXTRACTED', resolved_via: 'name-lookup', provider: 'native' }]);
        expect(lintGraph(g)).toEqual([]);
    });

    it('fails on a duplicate id, an invalid span, a dangling source and a planted dangling lane edge', () => {
        const g = graph(
            [node('a'), node('a'), node('b', [5, 1, 2, 1])],
            [
                { source: 'ghost', target: 'a', relation: 'calls', confidence: 'EXTRACTED', resolved_via: 'same-file', provider: 'native' },
                { source: 'a', target: 'env:NOPE', relation: 'configured-by', confidence: 'EXTRACTED', resolved_via: 'lane-read', provider: 'native', fact: { owner: 'a', witness: w, rung: 'T1', lane: 'interfaces', attrs: {} } },
            ],
        );
        expect(lintGraph(g).map((p) => p.kind)).toEqual(['duplicate-id', 'invalid-span', 'dangling-source', 'dangling-target']);
    });
});

describe('code-graph lint', () => {
    it('exits 1 naming the dangling endpoint of a planted graph, and 0 on a clean one', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-lint-'));
        const bad = path.join(dir, 'bad.json');
        const good = path.join(dir, 'good.json');
        fs.writeFileSync(bad, JSON.stringify(graph([node('a')], [{ source: 'a', target: 'nowhere', relation: 'calls', confidence: 'EXTRACTED', resolved_via: 'same-file', provider: 'native' }])));
        fs.writeFileSync(good, JSON.stringify(graph([node('a')])));
        const cli = (g: string) => spawnSync(path.join(REPO, 'scripts-run'), ['src/scripts/code_graph/cli', 'lint', '--graph', g], { encoding: 'utf-8' });
        const r = cli(bad);
        expect(r.status).toBe(1);
        expect(r.stdout).toMatch(/dangling-target: a calls nowhere/);
        expect(cli(good).status).toBe(0);
        execFileSync('rm', ['-rf', dir]);
    }, 60_000);
});
