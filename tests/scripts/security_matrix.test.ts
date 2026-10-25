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

    it('renders a Pest draft for a laravel graph and a vitest draft otherwise, each failing until bound', () => {
        const g = (p: string) =>
            buildMatrix({ nodes: [route('r', 'GET /a/{id}')], edges: [edge('r', 'h', p)] } as unknown as CodeGraph);
        expect(renderSkeleton(g('laravel'))).toContain("throw new RuntimeException('bind /a/{id}");
        expect(renderSkeleton(g('express'))).toContain('throw new Error("bind /a/{id}');
    });
});

describe('matrixForRepo', () => {
    it.each([
        ['nextjs', ['GET /api/users', 'POST /api/users']],
        ['express', ['GET /health', 'GET /users', 'POST /users']],
    ])('reads the %s fixture through the code graph without a model', async (stack, routes) => {
        const m = await matrixForRepo(path.join(FIXTURES, stack));
        expect(m.rows.map((r) => r.route)).toEqual(routes);
        expect(m.rows.every((r) => r.cases.length === 3)).toBe(true);
    });
});
