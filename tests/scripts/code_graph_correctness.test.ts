/**
 * Planted correctness fixtures and the recall ratchet.
 *
 * Each fixture under tests/fixtures/code-graph/correctness/ plants the defects
 * the base had; its expectation file lists facts that must exist and facts that
 * must not. `recall-baseline.json` holds how many must-exist facts each fixture
 * lists, and may only rise — so dropping an expectation, or the graph losing a
 * fact, fails here.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { affected, loadGraph, tree } from '../../src/scripts/code_graph/query.js';
import { openGraphIndex } from '../../src/scripts/code_graph/sqlite_store.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';
import { vocabularyErrors } from '../../src/scripts/code_graph/vocabulary.js';
import { GRAPH_TOOLS } from '../../src/scripts/mcp_server/graph_tools.js';
import { ToolCache } from '../../src/scripts/mcp_server/tools.js';

const ROOT = path.resolve(__dirname, '../fixtures/code-graph/correctness');
const BASELINE = JSON.parse(fs.readFileSync(path.join(ROOT, 'recall-baseline.json'), 'utf-8')) as Record<string, number | string>;

interface Expectation {
    fixture: string;
    must_exist: string[];
    must_not_exist: string[];
}

const EXPECTATIONS: Expectation[] = fs
    .readdirSync(path.join(ROOT, 'expected'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'expected', f), 'utf-8')) as Expectation);

/** Every fact of a graph as one comparable line. */
export function factsOf(g: CodeGraph): Set<string> {
    const out = new Set<string>();
    for (const n of g.nodes) {
        out.add(`node ${n.id}`);
        for (const [k, v] of Object.entries(n.fact?.attrs ?? {})) out.add(`attr ${n.id} ${k}=${JSON.stringify(v)}`);
    }
    for (const e of g.edges) {
        const key = `${e.source} ${e.relation} ${e.target}`;
        out.add(`edge ${key}`);
        for (const [k, v] of Object.entries(e.fact?.attrs ?? {})) out.add(`edge-attr ${key} ${k}=${JSON.stringify(v)}`);
    }
    return out;
}

/** The recall check, split out so a sabotage of it can be shown to fail. */
export function recallFailures(exp: Expectation, facts: ReadonlySet<string>, baseline: number | undefined): string[] {
    const fails: string[] = [];
    if (baseline === undefined) fails.push(`${exp.fixture}: no baseline entry`);
    else if (exp.must_exist.length < baseline) fails.push(`${exp.fixture}: ${exp.must_exist.length} must-exist facts, baseline ${baseline}`);
    for (const f of exp.must_exist) if (!facts.has(f)) fails.push(`missing: ${f}`);
    for (const f of exp.must_not_exist) if (facts.has(f)) fails.push(`present: ${f}`);
    return fails;
}

const graphs = new Map<string, CodeGraph>();
beforeAll(async () => {
    for (const exp of EXPECTATIONS) graphs.set(exp.fixture, (await buildFromRepo(path.join(ROOT, exp.fixture), null)).graph);
});

describe('recall ratchet over the planted fixtures', () => {
    it('has an expectation and a baseline for every fixture directory', () => {
        const dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'expected').map((d) => d.name).sort();
        expect(EXPECTATIONS.map((e) => e.fixture)).toEqual(dirs);
        for (const d of dirs) expect(typeof BASELINE[d], d).toBe('number');
    });

    for (const exp of EXPECTATIONS) {
        it(`${exp.fixture}: every must-exist fact is drawn, no must-not-exist fact is`, () => {
            expect(recallFailures(exp, factsOf(graphs.get(exp.fixture) as CodeGraph), BASELINE[exp.fixture] as number)).toEqual([]);
        });

        it(`${exp.fixture}: the graph passes the schema gate and the vocabulary`, () => {
            const g = graphs.get(exp.fixture) as CodeGraph;
            expect(validateGraph(JSON.parse(JSON.stringify(g))).errors).toEqual([]);
            expect(vocabularyErrors(g)).toEqual([]);
        });
    }

    it('fails when one must-exist fact is removed from what the graph draws', () => {
        const exp = EXPECTATIONS.find((e) => e.fixture === 'p1-blog') as Expectation;
        const facts = factsOf(graphs.get('p1-blog') as CodeGraph);
        const dropped = exp.must_exist[0] as string;
        facts.delete(dropped);
        expect(recallFailures(exp, facts, BASELINE['p1-blog'] as number)).toEqual([`missing: ${dropped}`]);
    });

    it('fails when the expectation lists fewer must-exist facts than the baseline', () => {
        const exp = EXPECTATIONS.find((e) => e.fixture === 'p1-blog') as Expectation;
        const shrunk = { ...exp, must_exist: exp.must_exist.slice(1) };
        const fails = recallFailures(shrunk, factsOf(graphs.get('p1-blog') as CodeGraph), BASELINE['p1-blog'] as number);
        expect(fails.some((f) => /baseline/.test(f))).toBe(true);
    });
});

describe('1.4 — a column reaches its relation and the code that filters on it', () => {
    let dir: string;
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('affected(comments.post_id) names the relation method and the controller action', async () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-p1-'));
        const cache = path.join(dir, 'graph.json');
        await buildFromRepo(path.join(ROOT, 'p1-blog'), cache);
        const g = loadGraph(cache);
        try {
            const text = affected(g, 'column:comments.post_id').lines.join('\n');
            expect(text).toContain('Comment::post');
            expect(text).toContain('Post::comments');
            expect(text).toContain('CommentController::index');
        } finally {
            g.close();
        }
    });
});

describe('every graph_* tool, answered from the real SQLite twin', () => {
    let root: string;
    const prev = process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'];

    beforeAll(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-twin-'));
        fs.cpSync(path.join(ROOT, 'p1-blog'), root, { recursive: true });
        await buildFromRepo(root, path.join(root, 'agents/runtime/state/code-graph-v1.json'));
        process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'] = '0';
    });
    afterAll(() => {
        if (prev === undefined) delete process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'];
        else process.env['AGENT_CONFIG_GRAPH_INDEXED_MIN_EDGES'] = prev;
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('reads through the index, not the JSON', () => {
        const cache = path.join(root, 'agents/runtime/state/code-graph-v1.json');
        const index = openGraphIndex(cache);
        expect(index).not.toBeNull();
        index?.close();
        const g = loadGraph(cache);
        expect(g.graph).toBeNull();
        expect(g.kindCount('column')).toBeGreaterThan(0);
        g.close();
    });

    it('graph_query: a kind filter returns only that kind, with its population line and witnesses', async () => {
        const r = await new ToolCache().dispatch('graph_query', { symbol: 'column:comments.post_id', kind: 'method', direction: 'in' }, root);
        expect(r['status']).toBe('ok');
        const items = r['items'] as Array<{ id: string; kind: string; at: string | null; confirm: string }>;
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((i) => i.kind === 'method')).toBe(true);
        expect(items.map((i) => i.id)).toContain('app/Http/Controllers/CommentController.php#CommentController::index');
        expect(items.every((i) => i.confirm === 'unconfirmed' && i.at !== null)).toBe(true);
        expect(String(r['population'])).toMatch(/the graph holds \d+ method node/);
        expect(r['total']).toBe(items.length);
        expect(r['hasMore']).toBe(false);
    });

    it('graph_query: an empty filtered answer names the population it searched', async () => {
        const r = await new ToolCache().dispatch('graph_query', { symbol: 'column:comments.post_id', kind: 'decision' }, root);
        expect(r['returned']).toBe(0);
        expect(String(r['population'])).toMatch(/0 found .*the graph holds 0 decision node/);
    });

    it('graph_query without filters keeps its old line answer', async () => {
        const r = await new ToolCache().dispatch('graph_query', { symbol: 'table:posts' }, root);
        expect(Array.isArray(r['lines'])).toBe(true);
        expect(r['items']).toBeUndefined();
    });

    it('graph_node: a relation and kind filter on a table', async () => {
        const r = await new ToolCache().dispatch('graph_node', { id: 'table:posts', direction: 'out', relation: 'references', kind: 'table' }, root);
        expect(r['status']).toBe('ok');
        expect((r['out'] as Array<{ id: string }>).map((e) => e.id)).toEqual(['table:users']);
    });

    it('graph_path: from a controller action to the table it reads', async () => {
        const r = await new ToolCache().dispatch('graph_path', { from: 'app/Http/Controllers/CommentController.php#CommentController::index', to: 'table:comments' }, root);
        expect(r['status']).toBe('ok');
        expect((r['lines'] as string[]).join(' ')).toContain('comments');
    });

    it('graph_tests_for, graph_dead, graph_impact answer over the twin', async () => {
        const cache = new ToolCache();
        const t = await cache.dispatch('graph_tests_for', { symbol: 'app/Models/Post.php#Post' }, root);
        expect(t['status']).toBe('ok');
        expect(t['tests']).toEqual([]);
        const d = await cache.dispatch('graph_dead', { accept_missing_exports: true }, root);
        expect(d['status']).toBe('ok');
        const i = await cache.dispatch('graph_impact', { diff: 'HEAD~1' }, root);
        expect(i['status']).toBe('error');
    });

    it('graph_map_status, graph_area and graph_estate say what they lack', async () => {
        const cache = new ToolCache();
        expect((await cache.dispatch('graph_map_status', {}, root))['map']).toBe('absent');
        expect((await cache.dispatch('graph_area', { area: 'a1' }, root))['status']).toBe('unavailable');
        expect((await cache.dispatch('graph_estate', { query: 'projects-using', name: 'x' }, root))['status']).toBe('unavailable');
    });

    it('covers every registered graph tool', () => {
        const covered = ['graph_query', 'graph_node', 'graph_path', 'graph_tests_for', 'graph_dead', 'graph_impact', 'graph_map_status', 'graph_area', 'graph_estate'];
        expect(Object.keys(GRAPH_TOOLS).sort()).toEqual(covered.sort());
    });
});

describe('the tree answer', () => {
    it('limits the list and says how many there were', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-tree-'));
        const cache = path.join(dir, 'graph.json');
        await buildFromRepo(path.join(ROOT, 'p1-blog'), cache);
        const g = loadGraph(cache);
        try {
            const r = tree(g, 'table:posts', { kinds: ['column'], direction: 'out', limit: 2 });
            expect(r.returned).toBe(2);
            expect(r.total).toBeGreaterThan(2);
            expect(r.hasMore).toBe(true);
            expect(r.tree[0]).toMatch(/^-member-> posts\.\w+ \[column\] at=database\/migrations\/.*:\d+ \(unconfirmed\)$/);
            const none = tree(g, 'no such thing at all xyz', { kinds: ['column'] });
            expect(none.population).toMatch(/the graph holds \d+ column node/);
        } finally {
            g.close();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
