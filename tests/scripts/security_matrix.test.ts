import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { buildMatrix, matrixForRepo, renderSkeleton } from '../../src/scripts/security_matrix.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/code-graph');

const route = (id: string, label: string) => ({ id, label, kind: 'route' as const, source_file: '', source_location: [] });
const edge = (source: string, target: string, provider_id: string) =>
    ({ source, target, relation: 'routes-to', confidence: 'EXTRACTED', resolved_via: 'convention', provider: 'convention', provider_id }) as const;

describe('buildMatrix', () => {
    it('crosses every API route with three accounts and expects the owner check on a parameterised path', () => {
        const graph = {
            nodes: [route('r1', 'GET /invoices/{id}'), route('r2', 'GET /api/items/[id]'), route('r3', 'POST /orders'), route('r4', 'PAGE /')],
            edges: [edge('r1', 'app/Http/InvoiceController.php#show', 'laravel')],
        } as unknown as CodeGraph;
        const m = buildMatrix(graph);
        expect(m.rows.map((r) => r.route)).toEqual(['GET /api/items/[id]', 'GET /invoices/{id}', 'POST /orders']);
        const inv = m.rows.find((r) => r.route === 'GET /invoices/{id}');
        expect(inv?.cases).toEqual([
            { as: 'anonymous', expect: '401' },
            { as: 'user-a', expect: '2xx' },
            { as: 'user-b', expect: '403|404' },
        ]);
        expect(inv?.handler).toBe('app/Http/InvoiceController.php#show');
        expect(m.rows.find((r) => r.route === 'POST /orders')?.owned).toBe(false);
        expect(m.skipped).toEqual([{ route: 'PAGE /', reason: 'not an API verb (page or view route)' }]);
    });

    it('keeps ROUTE-verb API routes, names a true reason for OPTIONS/HEAD/WS, and reads Django/Flask parameters', () => {
        const graph = {
            nodes: [
                route('a', 'ROUTE /api/hello'),
                route('b', 'OPTIONS /x'),
                route('c', 'WS /socket'),
                route('d', 'GET /items/<int:pk>/'),
                route('e', 'GET /archive/(?P<year>[0-9]{4})'),
                route('f', 'GET /users/<id>'),
            ],
            edges: [],
        } as unknown as CodeGraph;
        const m = buildMatrix(graph);
        expect(m.rows.map((r) => r.route)).toEqual(['GET /archive/(?P<year>[0-9]{4})', 'GET /items/<int:pk>/', 'GET /users/<id>', 'ROUTE /api/hello']);
        expect(m.rows.filter((r) => r.verb === 'GET').every((r) => r.owned)).toBe(true);
        expect(m.skipped).toEqual([
            { route: 'OPTIONS /x', reason: 'preflight/metadata verb — no resource is returned' },
            { route: 'WS /socket', reason: 'websocket — the request/response matrix does not apply; audit by hand' },
        ]);
    });

    it('renders each row in its own stack and escapes quotes and backslashes', () => {
        const m = buildMatrix({
            nodes: [route('l', "GET /it's/{id}"), route('x', 'GET /b/{id}')],
            edges: [edge('l', 'h', 'laravel'), edge('x', 'h2', 'express')],
        } as unknown as CodeGraph);
        const out = renderSkeleton(m);
        expect(out).toContain("throw new RuntimeException('bind /it\\'s/{id}");
        expect(out).toContain('throw new Error("bind /b/{id}');
    });

    it('renders a Pest draft for a laravel graph and a vitest draft otherwise, each failing until bound', () => {
        const g = (p: string) =>
            buildMatrix({ nodes: [route('r', 'GET /a/{id}')], edges: [edge('r', 'h', p)] } as unknown as CodeGraph);
        expect(renderSkeleton(g('laravel'))).toContain("throw new RuntimeException('bind /a/{id}");
        expect(renderSkeleton(g('express'))).toContain('throw new Error("bind /a/{id}');
    });
});

describe('matrixForRepo', () => {
    it.each([
        ['nextjs', ['GET /api/users', 'POST /api/users', 'ROUTE /api/health']],
        ['express', ['GET /health', 'GET /users', 'POST /users']],
    ])('reads the %s fixture through the code graph without a model', async (stack, routes) => {
        const m = await matrixForRepo(path.join(FIXTURES, stack));
        expect(m.rows.map((r) => r.route)).toEqual(routes);
        expect(m.rows.every((r) => r.cases.length === 3)).toBe(true);
    });
});
