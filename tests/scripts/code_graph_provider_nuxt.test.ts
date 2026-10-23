import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/nuxt');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const routesTo = (label: string): string[] => {
    const ids = graph.nodes.filter((n) => n.kind === 'route' && n.label === label).map((n) => n.id);
    return graph.edges.filter((e) => ids.includes(e.source) && e.relation === 'routes-to').map((e) => e.target);
};

describe('nuxt provider', () => {
    it('detects nuxt from package.json', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['nuxt']);
    });

    it('routes pages without requiring an index page, keeping dynamic segments', () => {
        expect(routesTo('PAGE /about')).toEqual(['pages/about.vue']);
        expect(routesTo('PAGE /users/[id]')).toEqual(['pages/users/[id].vue']);
        expect(graph.edges.some((e) => e.resolved_via === 'fs-route')).toBe(false);
    });

    it('routes server handlers, reading a verb suffix and the api prefix', () => {
        expect(routesTo('GET /api/users')).toEqual(['server/api/users.get.ts']);
        expect(routesTo('ROUTE /api/users/[id]')).toEqual(['server/api/users/[id].ts']);
        expect(routesTo('ROUTE /feed')).toEqual(['server/routes/feed.ts']);
    });

    it('draws no route for a component or a server utility', () => {
        const targets = graph.edges.filter((e) => e.relation === 'routes-to').map((e) => e.target);
        expect(targets).not.toContain('components/AppButton.vue');
        expect(targets).not.toContain('server/utils/db.ts');
        expect(graph.nodes.filter((n) => n.kind === 'route')).toHaveLength(5);
    });

    it('stamps its edges and keeps the graph valid', () => {
        expect(graph.edges.filter((e) => e.relation === 'routes-to').every((e) => e.provider_id === 'nuxt')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});

describe('nuxt provider without a manifest', () => {
    it('stays inactive', async () => {
        const { graph: g } = await buildFromRepo(path.join(FIXTURE, 'server'), null);
        expect(g.providers ?? []).toEqual([]);
        expect(g.edges.some((e) => e.provider_id === 'nuxt')).toBe(false);
    });
});
