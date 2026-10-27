import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { fixtureScopeProblems, produceAreas } from '../../src/scripts/code_graph/map_area_payloads.js';
import { scopeOf } from '../../src/scripts/code_graph/scope.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';

let root: string;
let graph: CodeGraph;

const w = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-scope-facts-')));
    w('package.json', JSON.stringify({ name: 'shop', dependencies: { express: '^4.0.0' } }));
    w('src/app.js', "const express = require('express');\nconst app = express();\nfunction list(req, res) { res.send('ok'); }\napp.get('/orders', list);\nmodule.exports = app;\n");
    // A fixture project inside the repository: a declared, unused package and a larger flow.
    w('tests/fixtures/demo/package.json', JSON.stringify({ name: 'demo', dependencies: { express: '^4.0.0', 'left-pad': '^1.0.0' } }));
    w(
        'tests/fixtures/demo/app.js',
        "const express = require('express');\nconst app = express();\nfunction a(req, res) { b(); c(); d(); res.send('x'); }\nfunction b() { c(); }\nfunction c() { d(); }\nfunction d() { return 1; }\napp.get('/demo', a);\nmodule.exports = app;\n",
    );
    graph = (await buildFromRepo(root, null, { lanes: true })).graph;
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('scope on every fact (2.2, H1–H4)', () => {
    it('stamps a non-product scope on nodes and lane facts, and none on product ones', () => {
        const fixtureNode = graph.nodes.find((n) => n.source_file === 'tests/fixtures/demo/app.js');
        expect(fixtureNode?.scope).toBe('fixture');
        expect(graph.nodes.find((n) => n.source_file === 'src/app.js')?.scope).toBeUndefined();
        const lanePkg = graph.nodes.find((n) => n.fact?.lane === 'systems' && n.fact.owner === 'tests/fixtures/demo/package.json');
        expect(lanePkg?.scope).toBe('fixture');
    });

    it('keeps fixture findings out of the default view and counts them', () => {
        const { areas } = produceAreas(root, graph);
        const sys = areas.systems!;
        expect(sys.findings.every((f) => f.witnesses.some((x) => scopeOf(x.file) === 'product'))).toBe(true);
        // Since 6.2 the systems lane raises no SY-1 on a fixture manifest at all; a graph that still
        // carries one (an older lane build) is filtered here and counted.
        const legacy: CodeGraph = {
            ...graph,
            nodes: graph.nodes.map((n) => (n.fact?.lane === 'systems' && n.fact.attrs?.['name'] === 'left-pad' ? { ...n, fact: { ...n.fact, attrs: { ...n.fact.attrs, unused: true, unused_ref: 'tests/fixtures/demo/package.json:1:00000000' } } } : n)),
        };
        const old = produceAreas(root, legacy).areas.systems!;
        expect(old.findings.some((f) => f.subject.includes('left-pad'))).toBe(false);
        expect(old.fixture_findings).toBe(1);
    });

    it('starts every tour in product scope', () => {
        const { areas } = produceAreas(root, graph);
        expect((areas.tours ?? []).length).toBeGreaterThan(0);
        for (const t of areas.tours ?? []) expect(scopeOf(t.steps[0]?.item ?? '')).toBe('product');
    });

    it('reports no product-view finding and no tour in fixture scope', () => {
        expect(fixtureScopeProblems(produceAreas(root, graph).areas)).toEqual([]);
    });
});
