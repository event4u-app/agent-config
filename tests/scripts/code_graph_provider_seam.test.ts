import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo, readProjectProbe } from '../../src/scripts/code_graph/build.js';
import { type GraphPass, PASSES, runPasses } from '../../src/scripts/code_graph/passes.js';
import { activeProviders, type ConventionProvider, EMPTY_PROBE } from '../../src/scripts/code_graph/providers/index.js';
import { laravelProvider } from '../../src/scripts/code_graph/providers/laravel.js';
import type { CodeEdge, CodeNode } from '../../src/scripts/code_graph/types.js';

let root: string;

function write(base: string, rel: string, body: string): void {
    const p = path.join(base, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-seam-')));
    write(root, 'packages/api/composer.json', JSON.stringify({ require: { 'laravel/framework': '^11.0' } }));
    write(root, 'packages/web/package.json', JSON.stringify({ dependencies: { express: '^4.0.0' } }));
    write(root, 'packages/lib/composer.json', JSON.stringify({ require: { 'guzzlehttp/guzzle': '^7.0' } }));
    write(root, 'tools/app/artisan', '#!/usr/bin/env php\n');
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('project probe and detection by markers', () => {
    it('reads manifests and marker files, not suffixes', () => {
        const probe = readProjectProbe(root);
        expect([...probe.manifests.keys()].sort()).toEqual([
            'packages/api/composer.json',
            'packages/lib/composer.json',
            'packages/web/package.json',
        ]);
        expect([...probe.markers]).toEqual(['tools/app/artisan']);
    });

    it('activates one provider per package root, several at once', () => {
        const express: ConventionProvider = {
            id: 'fake-express',
            detect: (probe) =>
                [...probe.manifests]
                    .filter(([p, t]) => p.endsWith('package.json') && t.includes('"express"'))
                    .map(([p]) => path.posix.dirname(p)),
            build: () => ({ nodes: [], edges: [] }),
        };
        const active = activeProviders(readProjectProbe(root), [laravelProvider, express]);
        expect(active.map((a) => [a.provider.id, a.roots])).toEqual([
            ['laravel', ['packages/api', 'tools/app']],
            ['fake-express', ['packages/web']],
        ]);
    });

    it('detects nothing on an empty probe', () => {
        expect(activeProviders(EMPTY_PROBE)).toEqual([]);
    });
});

describe('the ordered pass list', () => {
    it('runs convention providers, then docs, then SCIP', () => {
        expect(PASSES.map((p) => p.id)).toEqual(['convention-providers', 'docs', 'scip']);
    });

    it('reports a throwing pass and leaves the graph as the other passes made it', () => {
        const node: CodeNode = { id: 'a.ts', label: 'a.ts', kind: 'file', source_file: 'a.ts', source_location: [] };
        const edge: CodeEdge = {
            source: 'a.ts',
            target: 'b.ts',
            relation: 'imports',
            confidence: 'EXTRACTED',
            resolved_via: 'import-specifier',
            provider: 'native',
        };
        const adds: GraphPass = { id: 'adds', applies: () => true, run: () => ({ nodes: [node], edges: [edge] }) };
        const throws: GraphPass = {
            id: 'throws',
            applies: () => true,
            run: () => {
                throw new Error('boom');
            },
        };
        const base = { files: [], docs: [], scip: [], resolution: { psr4: [], alias: [] } as never, probe: EMPTY_PROBE };
        const nodes: CodeNode[] = [];
        const edges: CodeEdge[] = [];
        const report = runPasses(base, nodes, edges, [throws, adds]);
        expect(report.failures).toEqual([{ pass: 'throws', reason: 'boom' }]);
        expect(nodes).toEqual([node]);
        expect(edges).toEqual([edge]);
    });
});

describe('a provider runs only where its markers are', () => {
    it('draws no framework edges in a PHP tree without a framework marker', async () => {
        const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-bare-')));
        try {
            write(bare, 'composer.json', JSON.stringify({ autoload: { 'psr-4': { 'App\\': 'app/' } } }));
            write(bare, 'database/migrations/2024_01_01_create_books.php', "<?php\nSchema::create('books', function ($t) {});\n");
            write(bare, 'app/Book.php', '<?php\nnamespace App;\nclass Book extends Model {}\n');
            const { graph } = await buildFromRepo(bare, null);
            expect(graph.nodes.some((n) => n.kind === 'table')).toBe(false);
            expect(graph.edges.some((e) => e.relation === 'migrates' || e.relation === 'persists')).toBe(false);
        } finally {
            fs.rmSync(bare, { recursive: true, force: true });
        }
    });
});
