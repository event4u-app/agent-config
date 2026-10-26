import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildFlows } from '../../src/scripts/code_graph/lanes/flows/flows.js';
import { spanHash } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import type { CodeEdge, CodeGraph, CodeNode, Relation, ResolvedVia } from '../../src/scripts/code_graph/types.js';

let root: string;

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flows-')));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

function node(id: string, kind: CodeNode['kind'], line = 1, label?: string): CodeNode {
    const file = id.split('#')[0] as string;
    return { id, label: label ?? id.split(/[#:]/).pop()!, kind, source_file: file, source_location: [line, 1, line, 1] };
}

function edge(source: string, target: string, relation: Relation, resolved_via: ResolvedVia = 'import-specifier'): CodeEdge {
    return { source, target, relation, confidence: 'EXTRACTED', resolved_via, provider: 'native' };
}

function graph(nodes: CodeNode[], edges: CodeEdge[]): CodeGraph {
    return {
        schema_version: 6,
        source_checksum: 'x',
        languages: ['php'],
        grammar_abi: 14,
        edge_confidence_counts: { EXTRACTED: edges.length, INFERRED: 0, AMBIGUOUS: 0 },
        suppressed_edge_counts: { dynamic_no_candidate: 0 },
        nodes,
        edges,
    };
}

const JOB = 'app/Jobs/SendReport.php#SendReport';
const HANDLE = `${JOB}::handle`;
const SVC = 'app/Services/ReportService.php#ReportService';
const BUILD = `${SVC}::build`;
const MODEL = 'app/Models/Report.php#Report';
const TABLE = 'table:reports';

/** job → service → model → table, the model's `create` inherited from outside the repository. */
function jobFixture(extraEdges: CodeEdge[] = []): CodeGraph {
    write('app/Jobs/SendReport.php', '<?php\nclass SendReport implements ShouldQueue\n{\n    public function handle() {}\n}\n');
    return graph(
        [node(JOB, 'class', 2), node(HANDLE, 'method', 4), node(SVC, 'class'), node(BUILD, 'method'), node(MODEL, 'class'), { id: TABLE, label: 'reports', kind: 'table', source_file: 'database/migrations/x.php', source_location: [] }],
        [
            edge(JOB, 'symbol:ShouldQueue', 'inherits', 'dynamic'),
            edge(HANDLE, BUILD, 'calls'),
            edge(BUILD, `${MODEL}::create`, 'calls', 'same-file'),
            edge(MODEL, TABLE, 'persists', 'schema-call'),
            ...extraEdges,
        ],
    );
}

describe('buildFlows — entries and reach', () => {
    it('a queued job reaches its table through the service and the model', () => {
        const out = buildFlows(jobFixture(), { root });
        expect(out.lane).toBe('flows');
        expect(out.facts).toHaveLength(1);
        const f = out.facts[0]!;
        expect(f.id).toBe(`flow:${JOB}`);
        expect(f.attrs).toMatchObject({ entry_kind: 'job', entry_basis: 'inherits-marker', tables: ['reports'], truncated_depth: false, truncated_branch: false, truncated_size: false });
        expect(f.attrs.nodes).toEqual([JOB, HANDLE, BUILD, MODEL, TABLE]);
        expect(f.witness).toEqual({ file: 'app/Jobs/SendReport.php', line: 2, hash: spanHash('class SendReport implements ShouldQueue') });
        expect(f.owner).toBe('app/Jobs/SendReport.php');
    });

    it('a route enters through its handler and records operations and environments it reaches', () => {
        write('routes/web.php', "Route::get('/r', [C::class, 'show']);\n");
        const g = graph(
            [node('routes/web.php#GET /r', 'route', 1, 'GET /r'), node('app/C.php#C::show', 'method'), node('app/Api.php#Api::send', 'method'), { ...node('ops#billing.charge', 'route'), kind: 'operation' as CodeNode['kind'], label: 'billing.charge' }, { ...node('env#prod', 'route'), kind: 'environment' as CodeNode['kind'], label: 'prod' }],
            [edge('routes/web.php#GET /r', 'app/C.php#C::show', 'routes-to', 'route-table'), edge('app/C.php#C::show', 'app/Api.php#Api::send', 'calls'), edge('app/Api.php#Api::send', 'ops#billing.charge', 'calls'), edge('app/Api.php#Api::send', 'env#prod', 'reads', 'literal-path')],
        );
        const f = buildFlows(g, { root }).facts[0]!;
        expect(f.attrs).toMatchObject({ entry_kind: 'route', entry_basis: 'route-table', operations: ['billing.charge'], environments: ['prod'], tables: [] });
    });

    it('a caller-declared entry becomes a flow; an unmarked class does not', () => {
        const g = jobFixture();
        g.edges = g.edges.filter((e) => e.relation !== 'inherits');
        expect(buildFlows(g, { root }).facts).toEqual([]);
        const f = buildFlows(g, { root, entries: [{ id: JOB, kind: 'listener' }] }).facts[0]!;
        expect(f.attrs).toMatchObject({ entry_kind: 'listener', entry_basis: 'declared', tables: ['reports'] });
    });

    it('does not walk a guessed edge', () => {
        const g = jobFixture();
        g.edges = g.edges.map((e) => (e.source === HANDLE ? { ...e, resolved_via: 'name-lookup' as ResolvedVia } : e));
        const f = buildFlows(g, { root }).facts[0]!;
        expect(f.attrs.nodes).toEqual([JOB, HANDLE]);
        expect(f.attrs.tables).toEqual([]);
    });

    it('does not walk relations outside calls, persists and reads', () => {
        const g = jobFixture();
        g.edges = g.edges.map((e) => (e.source === HANDLE ? { ...e, relation: 'uses' as Relation } : e));
        expect(buildFlows(g, { root }).facts[0]!.attrs.tables).toEqual([]);
    });

    it('leaves a flow out, with a reason, when its entry line cannot be read', () => {
        const g = jobFixture();
        fs.rmSync(path.join(root, 'app/Jobs/SendReport.php'));
        const out = buildFlows(g, { root });
        expect(out.facts).toEqual([]);
        expect(out.skipped[0]).toMatchObject({ file: 'app/Jobs/SendReport.php' });
    });
});

describe('buildFlows — caps', () => {
    function chain(length: number, fan = 1): CodeGraph {
        write('src/entry.ts', 'export class Entry extends Command {}\n');
        const nodes = [node('src/entry.ts#Entry', 'class'), node('src/entry.ts#Entry::run', 'method')];
        const edges = [edge('src/entry.ts#Entry', 'symbol:Command', 'inherits', 'dynamic')];
        let prev = 'src/entry.ts#Entry::run';
        for (let i = 0; i < length; i++) {
            const id = `src/f${i}.ts#f${i}`;
            nodes.push(node(id, 'function'));
            edges.push(edge(prev, id, 'calls'));
            for (let k = 0; k < fan - 1; k++) {
                const leaf = `src/leaf${i}_${k}.ts#l`;
                nodes.push(node(leaf, 'function'));
                edges.push(edge(prev, leaf, 'calls'));
            }
            prev = id;
        }
        return graph(nodes, edges);
    }

    it('stops at the depth cap and says so; a walk inside the cap is not marked', () => {
        const deep = buildFlows(chain(10), { root }).facts[0]!;
        expect(deep.attrs.truncated_depth).toBe(true);
        expect(deep.attrs.depth).toBe(8);
        const shallow = buildFlows(chain(7), { root }).facts[0]!;
        expect(shallow.attrs.truncated_depth).toBe(false);
        expect(shallow.attrs.size).toBe(9);
    });

    it('follows at most the branch cap per node and says so', () => {
        const f = buildFlows(chain(1, 20), { root }).facts[0]!;
        expect(f.attrs.truncated_branch).toBe(true);
        expect(f.attrs.size).toBe(2 + 12);
        expect(buildFlows(chain(1, 12), { root }).facts[0]!.attrs.truncated_branch).toBe(false);
    });

    it('stops at the size cap and says so', () => {
        const f = buildFlows(chain(6, 12), { root, max_nodes: 30 }).facts[0]!;
        expect(f.attrs.size).toBe(30);
        expect(f.attrs.truncated_size).toBe(true);
    });
});

describe('buildFlows — overlap', () => {
    it('folds a flow sharing more than half its nodes into the larger one', () => {
        const g = jobFixture([edge(HANDLE, 'app/Log.php#log', 'calls')]);
        g.nodes.push(node('app/Log.php#log', 'function'));
        write('app/Jobs/Again.php', 'class Again implements ShouldQueue {\n public function handle() {}\n}\n');
        g.nodes.push(node('app/Jobs/Again.php#Again', 'class'), node('app/Jobs/Again.php#Again::handle', 'method', 2));
        g.edges.push(edge('app/Jobs/Again.php#Again', 'symbol:ShouldQueue', 'inherits', 'dynamic'), edge('app/Jobs/Again.php#Again::handle', BUILD, 'calls'));
        const out = buildFlows(g, { root });
        expect(out.facts.map((f) => f.id)).toEqual([`flow:${JOB}`]);
        expect(out.facts[0]!.attrs.folded_entries).toEqual(['app/Jobs/Again.php#Again']);
    });

    it('keeps two flows that share half or less', () => {
        const g = jobFixture();
        write('app/Jobs/Other.php', 'class Other implements ShouldQueue {\n public function handle() {}\n}\n');
        g.nodes.push(node('app/Jobs/Other.php#Other', 'class'), node('app/Jobs/Other.php#Other::handle', 'method', 2), node('app/X.php#x', 'function'), node('app/Y.php#y', 'function'));
        g.edges.push(
            edge('app/Jobs/Other.php#Other', 'symbol:ShouldQueue', 'inherits', 'dynamic'),
            edge('app/Jobs/Other.php#Other::handle', 'app/X.php#x', 'calls'),
            edge('app/X.php#x', 'app/Y.php#y', 'calls'),
        );
        expect(buildFlows(g, { root }).facts.map((f) => f.id).sort()).toEqual(['flow:app/Jobs/Other.php#Other', `flow:${JOB}`]);
    });
});
