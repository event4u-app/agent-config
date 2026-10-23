import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { goHttpProvider } from '../../src/scripts/code_graph/providers/go_http.js';
import { makeKit, packageSymbol } from '../../src/scripts/code_graph/providers/shared/kit.js';
import type { CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/go-http');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const route = graph.nodes.find((n) => n.kind === 'route' && n.label === label);
    return graph.edges.filter((e) => e.source === route?.id && e.relation === 'routes-to').map((e) => e.target);
};

describe('go-http provider', () => {
    it('detects any go.mod and nothing without one', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['go-http']);
        expect(goHttpProvider.detect({ manifests: new Map(), markers: new Set(), paths: ['main.go'] })).toEqual([]);
        expect(goHttpProvider.detect({ manifests: new Map([['svc/go.mod', 'module example.com/svc\n']]), markers: new Set(), paths: [] })).toEqual(['svc']);
    });

    it('routes net/http registrations, reading a Go 1.22 verb from the pattern', () => {
        expect(routesTo('ANY /')).toEqual(['main.go#index']);
        expect(routesTo('GET /users')).toEqual(['internal/handlers/users.go#ListUsers']);
        expect(routesTo('POST /users/{id}')).toEqual(['internal/handlers/users.go#UpdateUser']);
    });

    it('resolves a handler declared in another file of the same package', () => {
        expect(routesTo('ANY /health')).toEqual(['health.go#healthHandler']);
    });

    it('resolves a method value to the one method of that name in the package', () => {
        expect(routesTo('ANY /orders')).toEqual(['main.go#server::handleOrders']);
    });

    it('carries a Gin group prefix through nested groups', () => {
        expect(routesTo('POST /api/items')).toEqual(['internal/handlers/items.go#CreateItem']);
        expect(routesTo('DELETE /api/v1/items/:id')).toEqual(['internal/handlers/items.go#DeleteItem']);
    });

    it('routes Gin, Echo and chi registrations to the same-file handler, not a same-named one elsewhere', () => {
        for (const label of ['GET /ping', 'GET /status', 'GET /chi']) expect(routesTo(label)).toEqual(['routers.go#ping']);
        const elsewhere = ['internal/other/users.go#ping', 'internal/other/users.go#ListUsers'];
        expect(graph.edges.some((e) => e.relation === 'routes-to' && elsewhere.includes(e.target))).toBe(false);
    });

    it('reads no route off a non-router receiver and invents no target for a closure', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual([
            'ANY /',
            'ANY /health',
            'ANY /orders',
            'DELETE /api/v1/items/:id',
            'GET /chi',
            'GET /ping',
            'GET /status',
            'GET /users',
            'POST /api/items',
            'POST /inline',
            'POST /users/{id}',
        ]);
        expect(routesTo('POST /inline')).toEqual([]);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => e.relation === 'routes-to');
        expect(mine.length).toBe(10);
        expect(mine.every((e) => e.provider_id === 'go-http')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('packageSymbol', () => {
    const node = (id: string, kind: CodeNode['kind'] = 'function'): CodeNode => ({
        id,
        label: id.split('#')[1] as string,
        kind,
        source_file: id.split('#')[0] as string,
        source_location: [1, 1, 1, 1],
    });
    const kitOf = (nodes: CodeNode[]) =>
        makeKit({ files: [], baseNodes: nodes, baseEdges: [], paths: [], resolution: {} as never, roots: [''] });

    it('finds the one symbol of that name in the same directory and extension', () => {
        const kit = kitOf([node('a/x.go#F'), node('b/y.go#F'), node('a/z.ts#F')]);
        expect(packageSymbol(kit, 'a/main.go', 'F', ['function'])).toBe('a/x.go#F');
    });

    it('returns null when the name is ambiguous, absent, or of another kind', () => {
        expect(packageSymbol(kitOf([node('a/x.go#F'), node('a/y.go#F')]), 'a/main.go', 'F', ['function'])).toBeNull();
        expect(packageSymbol(kitOf([node('a/sub/x.go#F')]), 'a/main.go', 'F', ['function'])).toBeNull();
        expect(packageSymbol(kitOf([node('a/x.go#F', 'class')]), 'a/main.go', 'F', ['function'])).toBeNull();
    });
});
