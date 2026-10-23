import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { flaskProvider } from '../../src/scripts/code_graph/providers/flask.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/flask');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const route = graph.nodes.find((n) => n.kind === 'route' && n.label === label);
    return graph.edges.filter((e) => e.source === route?.id && e.relation === 'routes-to').map((e) => e.target);
};
const renders = (source: string): string[] =>
    graph.edges.filter((e) => e.source === source && e.relation === 'renders').map((e) => e.target);

describe('flask provider', () => {
    it('detects flask from requirements.txt', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['flask']);
    });

    it('stays inactive without a manifest naming the distribution', () => {
        const probe = (manifests: Array<[string, string]>) => ({ manifests: new Map(manifests), markers: new Set<string>(), paths: [] });
        expect(flaskProvider.detect(probe([]))).toEqual([]);
        expect(flaskProvider.detect(probe([['requirements.txt', 'flask-sqlalchemy==3.1\n']]))).toEqual([]);
        expect(flaskProvider.detect(probe([['pyproject.toml', 'dependencies = ["Flask>=3"]\n']]))).toEqual(['']);
    });

    it('routes @app.route to the decorated function, GET by default and one route per listed method', () => {
        expect(routesTo('GET /')).toEqual(['app/__init__.py#index']);
        expect(routesTo('GET /submit')).toEqual(['app/__init__.py#submit']);
        expect(routesTo('POST /submit')).toEqual(['app/__init__.py#submit']);
    });

    it('applies the same-file Blueprint url_prefix', () => {
        expect(routesTo('GET /admin/dash')).toEqual(['app/admin.py#dash']);
        expect(routesTo('POST /admin/shared')).toEqual(['app/admin.py#shared']);
        expect(graph.nodes.some((n) => n.kind === 'route' && n.label === 'GET /dash')).toBe(false);
    });

    it('reads no route off a dict receiver, as a decorator or as a call', () => {
        expect(graph.nodes.filter((n) => n.kind === 'route').map((n) => n.label).sort()).toEqual([
            'DELETE /admin/gone',
            'GET /',
            'GET /admin/dash',
            'GET /submit',
            'POST /admin/shared',
            'POST /submit',
        ]);
        expect(graph.edges.some((e) => e.relation === 'routes-to' && e.target === 'app/__init__.py#not_routed')).toBe(false);
    });

    it('renders the template under the app templates folder and the blueprint template_folder', () => {
        expect(renders('app/__init__.py#index')).toEqual(['app/templates/index.html']);
        expect(renders('app/admin.py#dash')).toEqual(['app/admin_templates/dash.html']);
    });

    it('draws nothing for a template in two folders, a missing one, or a runtime name — and never the unrelated same-named file', () => {
        expect(renders('app/admin.py#shared')).toEqual([]);
        expect(renders('app/admin.py#gone')).toEqual([]);
        expect(renders('app/__init__.py#submit')).toEqual([]);
        expect(graph.edges.some((e) => e.target === 'other/templates/index.html')).toBe(false);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => e.relation === 'routes-to' || e.relation === 'renders');
        expect(mine.length).toBe(8);
        expect(mine.every((e) => e.provider_id === 'flask')).toBe(true);
        expect(mine.filter((e) => e.relation === 'renders').every((e) => e.resolved_via === 'directive-scan')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
