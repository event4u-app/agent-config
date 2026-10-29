import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { readDecisions } from '../../src/scripts/code_graph/lanes/decisions/decisions.js';
import { scanFile } from '../../src/scripts/code_graph/lanes/interfaces/call_sites.js';
import { readInterfaces } from '../../src/scripts/code_graph/lanes/interfaces/index.js';
import { readRuntime } from '../../src/scripts/code_graph/lanes/runtime/index.js';
import { produceAreas } from '../../src/scripts/code_graph/map_area_payloads.js';

const roots: string[] = [];
afterAll(() => {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

function repo(files: Record<string, string>): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-cause-')));
    roots.push(root);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    return root;
}

const EMPTY_CONFIG = { names: new Map(), exampleNames: new Set<string>() } as unknown as Parameters<typeof scanFile>[2];

describe('interfaces: a call site is code, never a comment or a string (H8)', () => {
    it('reads the real fetch and skips the one in a comment and the one in a string literal', () => {
        const text = [
            "// fetch('/in-a-comment')",
            "/* await fetch('/in-a-block-comment') */",
            "const doc = \"fetch('/in-a-string')\";",
            "const tpl = `see fetch('/in-a-template')`;",
            "export async function load() { return fetch('/orders'); }",
        ].join('\n');
        const paths = scanFile('src/api.js', text, EMPTY_CONFIG).calls.map((c) => c.target.path);
        expect(paths).toEqual(['/orders']);
    });
});

describe('interfaces: configuration edges use the env-var id scheme (H6)', () => {
    it('points configured-by at the env-var node the runtime lane writes for the same read', () => {
        const root = repo({ 'src/api.js': "const base = process.env.API_URL;\nexport async function load() { return fetch(base + '/orders'); }\n" });
        const targets = readInterfaces(root)
            .relations.filter((r) => r.relation === 'configured-by')
            .map((r) => r.to);
        expect(targets).toContain('env-var:code:src/api.js#API_URL');
        expect(targets.some((t) => t.startsWith('env:'))).toBe(false);
        const runtimeIds = new Set(readRuntime(root).facts.map((f) => f.id));
        for (const t of targets) expect(runtimeIds.has(t)).toBe(true);
    });
});

describe('decisions: governs only a path the graph holds (H6)', () => {
    it('draws governs to a node path and counts any other mention as unresolved', () => {
        const root = repo({
            'docs/decisions/ADR-001-orders.md': '# ADR-001 Orders\n\n## Status\n\nAccepted\n\nThe rule lives in `src/orders.ts` and in `config/orders.yaml`.\n',
            'src/orders.ts': 'export const x = 1;\n',
            'config/orders.yaml': 'a: 1\n',
        });
        const files = ['docs/decisions/ADR-001-orders.md', 'src/orders.ts', 'config/orders.yaml'];
        const out = readDecisions(root, { files, nodes: new Set(['src/orders.ts']) });
        expect(out.relations.filter((r) => r.relation === 'governs').map((r) => r.to)).toEqual(['src/orders.ts']);
        expect(out.dropped.unresolved).toBe(1);
    });
});

describe('tours: a delivery step only for a workflow whose paths hold a flow file (H4)', () => {
    const app = "const express = require('express');\nconst app = express();\nfunction list(req, res) { res.send('ok'); }\napp.get('/orders', list);\nmodule.exports = app;\n";
    const wf = (paths: string): string => `name: CI\non:\n  push:\n    paths:\n      - '${paths}'\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n`;

    it('names the workflow whose path filter matches a file of the flow', async () => {
        const root = repo({ 'package.json': '{"name":"shop","dependencies":{"express":"^4.0.0"}}', 'src/app.js': app, '.github/workflows/ci.yml': wf('src/**') });
        const { graph } = await buildFromRepo(root, null, { lanes: true });
        const steps = (produceAreas(root, graph).areas.tours ?? []).flatMap((t) => t.steps).filter((s) => s.area === 'delivery');
        expect(steps.length).toBeGreaterThan(0);
        expect(steps[0]?.item).toBe('workflow/.github/workflows/ci.yml');
    }, 120_000);

    it('adds no delivery step when no workflow path filter holds a flow file', async () => {
        const root = repo({ 'package.json': '{"name":"shop","dependencies":{"express":"^4.0.0"}}', 'src/app.js': app, '.github/workflows/docs.yml': wf('docs/**') });
        const { graph } = await buildFromRepo(root, null, { lanes: true });
        const tours = produceAreas(root, graph).areas.tours ?? [];
        expect(tours.length).toBeGreaterThan(0);
        expect(tours.flatMap((t) => t.steps).filter((s) => s.area === 'delivery')).toEqual([]);
    }, 120_000);
});
