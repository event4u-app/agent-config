/**
 * `road-to-a-graph-that-wins` 3.2 — the two diff detectors read edges.
 *
 * Each fixture pairs an accepted-edge case with a guess-only one, because the
 * whole claim is that a guess edge does not move the graph-backed verdict. The
 * plain detector must answer identically with and without a graph.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { type LoadedGraph, loadGraph } from '../../src/scripts/code_graph/query.js';
import type { CodeEdge, CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';
import { graphBackedSilentCatch, scanDiff as scanCatch } from '../../src/scripts/detect_silent_catch.js';
import { analyze, graphBackedTampering } from '../../src/scripts/detect_verification_tampering.js';

type N = Partial<CodeNode> & { id: string };
type E = Partial<CodeEdge> & { source: string; target: string };

function load(nodes: N[], edges: E[]): LoadedGraph {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-detect-'));
    const graph = {
        schema_version: 3,
        source_checksum: 'hand',
        languages: ['typescript'],
        grammar_abi: 14,
        edge_confidence_counts: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 },
        nodes: nodes.map((n) => ({ label: n.id.split('#').pop(), kind: 'function', source_file: n.id.split('#')[0], source_location: [1, 1, 3, 1], ...n })),
        edges: edges.map((e) => ({ relation: 'calls', confidence: 'INFERRED', resolved_via: 'import-specifier', provider: 'native', ...e })),
    } as unknown as CodeGraph;
    const file = path.join(root, 'graph.json');
    fs.writeFileSync(file, JSON.stringify(graph));
    return loadGraph(file, 'native:hand');
}

function deletedTest(file: string, subject: string): string {
    return [
        `diff --git a/${file} b/${file}`,
        'deleted file mode 100644',
        'index 1111111..0000000',
        `--- a/${file}`,
        '+++ /dev/null',
        '@@ -1,2 +0,0 @@',
        `-import { ${subject} } from '../src/${subject}.js';`,
        `-it('works', () => { expect(${subject}()).toBe(1); });`,
        '',
    ].join('\n');
}

function addedCatch(file: string): string {
    return [
        `diff --git a/${file} b/${file}`,
        'index aaaaaaa..bbbbbbb 100644',
        `--- a/${file}`,
        `+++ b/${file}`,
        '@@ -3,2 +3,6 @@',
        ' export function run(): void {',
        '+    try {',
        '+        work();',
        '+    } catch (e) {',
        '+    }',
        ' }',
        '',
    ].join('\n');
}

describe('3.2 — detect_verification_tampering reads edges', () => {
    const diff = deletedTest('tests/live.test.ts', 'live') + deletedTest('tests/guessed.test.ts', 'guessed');
    const graph = (): LoadedGraph =>
        load(
            [
                { id: 'tests/live.test.ts', kind: 'file' },
                { id: 'tests/guessed.test.ts', kind: 'file' },
                { id: 'src/live.ts#live' },
                { id: 'src/guessed.ts#guessed' },
                { id: 'src/app.ts#useLive', source_location: [7, 1, 9, 1] },
                { id: 'src/other.ts#maybe' },
            ],
            [
                { source: 'tests/live.test.ts', target: 'src/live.ts#live', relation: 'tests', resolved_via: 'test-import' },
                { source: 'tests/guessed.test.ts', target: 'src/guessed.ts#guessed', relation: 'tests', resolved_via: 'test-import' },
                { source: 'src/app.ts#useLive', target: 'src/live.ts#live' },
                { source: 'src/other.ts#maybe', target: 'src/guessed.ts#guessed', resolved_via: 'name-lookup' },
            ],
        );

    it('a deleted test whose subject keeps an accepted caller fires; a guess-only caller does not', () => {
        const g = graph();
        const r = graphBackedTampering(diff, '', g);
        g.close();
        expect(r.plain_outcome).toBe(analyze(diff, '', null).outcome);
        const live = r.rows.find((x) => x.file === 'tests/live.test.ts')!;
        const guessed = r.rows.find((x) => x.file === 'tests/guessed.test.ts')!;
        expect(live.plain).toBe('fire');
        expect(live.graph).toBe('fire');
        expect(live.edges).toContainEqual({
            source: 'src/app.ts#useLive',
            target: 'src/live.ts#live',
            relation: 'calls',
            resolved_via: 'import-specifier',
            witness: 'src/app.ts:7',
        });
        expect(guessed.plain).toBe('fire');
        expect(guessed.graph).toBe('quiet');
        expect(guessed.edges.every((e) => e.resolved_via !== 'name-lookup')).toBe(true);
        expect(guessed.guess_edges.map((e) => e.resolved_via)).toEqual(['name-lookup']);
    });

    it('the paired verdict is taken against the plain detector', () => {
        const g = graph();
        const r = graphBackedTampering(diff, '', g, { 'tests/live.test.ts:1': true, 'tests/guessed.test.ts:1': false });
        g.close();
        expect(r.paired_verdict.wins).toBe(1);
        expect(r.paired_verdict.losses).toBe(0);
        expect(r.paired_verdict.kind).toBe('underpowered');
    });

    it('degrades to the plain verdict when no graph exists', () => {
        const r = graphBackedTampering(diff, '', null);
        expect(r.graph_used).toBe(false);
        expect(r.plain_outcome).toBe(analyze(diff, '', null).outcome);
        expect(r.rows.every((x) => x.plain === 'fire' && x.graph === null && x.edges.length === 0)).toBe(true);
        expect(r.paired_verdict.discordant).toBe(0);
    });
});

describe('3.2 — detect_silent_catch reads edges', () => {
    const diff = addedCatch('src/handler.ts') + addedCatch('src/stray.ts');
    const graph = (): LoadedGraph =>
        load(
            [
                { id: 'route:GET /orders', kind: 'route', source_file: 'routes/web.ts', source_location: [2, 1, 2, 1] },
                { id: 'src/ctl.ts#index', source_location: [4, 1, 9, 1] },
                { id: 'src/handler.ts#run', source_location: [3, 1, 8, 1] },
                { id: 'src/stray.ts#run', source_location: [3, 1, 8, 1] },
                { id: 'src/x.ts#somewhere', source_location: [5, 1, 6, 1] },
            ],
            [
                { source: 'route:GET /orders', target: 'src/ctl.ts#index', relation: 'routes-to', resolved_via: 'route-table' },
                { source: 'src/ctl.ts#index', target: 'src/handler.ts#run' },
                { source: 'src/ctl.ts#index', target: 'src/x.ts#somewhere' },
                { source: 'src/x.ts#somewhere', target: 'src/stray.ts#run', resolved_via: 'dynamic', confidence: 'AMBIGUOUS' },
            ],
        );

    it('a catch on an accepted path from a route fires; one reachable only through a guess does not', () => {
        const g = graph();
        const r = graphBackedSilentCatch(diff, g);
        g.close();
        expect(r.rows.map((x) => x.plain)).toEqual(scanCatch(diff).map(() => 'fire'));
        const hit = r.rows.find((x) => x.file === 'src/handler.ts')!;
        const stray = r.rows.find((x) => x.file === 'src/stray.ts')!;
        expect(hit.graph).toBe('fire');
        expect(hit.edges.map((e) => `${e.source}->${e.target}`)).toEqual([
            'route:GET /orders->src/ctl.ts#index',
            'src/ctl.ts#index->src/handler.ts#run',
        ]);
        expect(hit.edges[0]?.witness).toBe('routes/web.ts:2');
        expect(stray.graph).toBe('quiet');
        expect(stray.guess_edges.map((e) => e.resolved_via)).toEqual(['dynamic']);
    });

    it('the paired verdict is taken against the plain detector, and no graph degrades', () => {
        const g = graph();
        const r = graphBackedSilentCatch(diff, g, { 'src/handler.ts:6': true, 'src/stray.ts:6': false });
        g.close();
        expect(r.paired_verdict.wins).toBe(1);
        expect(r.paired_verdict.losses).toBe(0);
        const none = graphBackedSilentCatch(diff, null);
        expect(none.graph_used).toBe(false);
        expect(none.rows.every((x) => x.graph === null)).toBe(true);
    });
});
