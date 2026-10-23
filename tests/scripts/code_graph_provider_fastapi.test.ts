import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { fastapiProvider } from '../../src/scripts/code_graph/providers/fastapi.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/fastapi');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const route = graph.nodes.find((n) => n.kind === 'route' && n.label === label);
    return graph.edges.filter((e) => e.source === route?.id && e.relation === 'routes-to').map((e) => e.target);
};
const injects = (source: string): string[] =>
    graph.edges.filter((e) => e.source === source && e.relation === 'injects').map((e) => e.target).sort();

describe('fastapi provider', () => {
    it('detects fastapi from pyproject.toml', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['fastapi']);
    });

    it('stays inactive without a manifest naming the distribution', () => {
        const probe = (manifests: Array<[string, string]>) => ({ manifests: new Map(manifests), markers: new Set<string>(), paths: [] });
        expect(fastapiProvider.detect(probe([]))).toEqual([]);
        expect(fastapiProvider.detect(probe([['requirements.txt', 'fastapi-utils==0.2\n']]))).toEqual([]);
        expect(fastapiProvider.detect(probe([['svc/requirements.txt', 'fastapi==0.110\n']]))).toEqual(['svc']);
    });

    it('routes an app decorator to the decorated function', () => {
        expect(routesTo('GET /health')).toEqual(['app/main.py#health']);
        expect(routesTo('POST /items')).toEqual(['app/main.py#create_item']);
    });

    it('applies the same-file APIRouter prefix', () => {
        expect(routesTo('GET /api/users')).toEqual(['app/users.py#list_users']);
        expect(routesTo('DELETE /api/users/{uid}')).toEqual(['app/users.py#delete_user']);
        expect(graph.nodes.some((n) => n.kind === 'route' && n.label === 'GET /users')).toBe(false);
    });

    it('reads no route off a receiver that is not an app or router, nor off a dict lookup', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual([
            'DELETE /api/users/{uid}',
            'GET /api/users',
            'GET /health',
            'POST /items',
        ]);
        expect(graph.edges.some((e) => e.relation === 'routes-to' && e.target === 'app/users.py#not_routed')).toBe(false);
    });

    it('draws Depends(fn) as an injection into the imported or same-file function', () => {
        expect(injects('app/main.py#create_item')).toEqual(['app/deps.py#get_db']);
        expect(injects('app/users.py#list_users')).toEqual(['app/deps.py#current_user']);
        expect(injects('app/users.py#delete_user')).toEqual(['app/users.py#audit_log']);
    });

    it('never injects the same-named function of another module, a lambda, or from a non-dependency', () => {
        expect(graph.edges.some((e) => e.relation === 'injects' && e.target === 'other/deps.py#get_db')).toBe(false);
        expect(injects('app/main.py#health')).toEqual([]);
        expect(graph.edges.filter((e) => e.relation === 'injects')).toHaveLength(3);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => e.relation === 'routes-to' || e.relation === 'injects');
        expect(mine.length).toBe(7);
        expect(mine.every((e) => e.provider_id === 'fastapi')).toBe(true);
        expect(mine.filter((e) => e.relation === 'injects').every((e) => e.resolved_via === 'di-binding')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
